#!/usr/bin/env node
/**
 * Milhano n8n API bridge.
 *
 * Modes:
 *  - check: READ-ONLY; confirm the stored GitHub secret can list n8n workflows.
 *  - preview: READ-ONLY; compare three allowlisted Sofia draft workflows.
 *  - sync-drafts: manually create/update only those exact inactive draft workflows.
 *
 * Never reads credentials, executions, customer data, or production workflow bodies
 * outside a matching, inactive draft. Never calls workflow activation endpoints.
 *
 * Run only from the protected main branch GitHub Actions workflow.
 */
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { auditSofiaDrafts } from "./n8n-preflight.mjs";

const API = "https://collectacademy.app.n8n.cloud/api/v1";
const SOURCE_BRANCH = "feature/sofia-ai-setter-campaigns-20261109";
const KEY = process.env.N8N_API_KEY;
const MODE = process.argv[2] || "check";

const SOURCES = [
  {
    path: "n8n/MILHANO_04_Sofia_Post_Call_Supabase_AI_Insights_V3_DRAFT.json",
    name: "MILHANO | Sofia | 04 Post Call + Supabase AI Insights | V3 PREVIEW",
  },
  {
    path: "n8n/MILHANO_05_Sofia_Stage_Decision_Engine_V1_DRAFT.json",
    name: "MILHANO | Sofia | 05 Stage Decision Engine V1 | DRY RUN",
  },
  {
    path: "n8n/MILHANO_06_Sofia_Batch_Scheduler_V1_DISABLED.json",
    name: "MILHANO | Sofia | 06 Campaign Scheduler | PROTECTED",
  },
  {
    path: "n8n/MILHANO_07_Sofia_Conversation_Reconciliation_DRAFT.json",
    name: "MILHANO | Sofia | 07 Conversation Reconciliation | SAFE DRAFT",
  },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
assert(["check", "preview", "sync-drafts"].includes(MODE), "Unsupported mode.");
assert(KEY && KEY.length >= 15, "N8N_API_KEY missing or invalid in GitHub Actions secrets.");
assert(process.env.GITHUB_REPOSITORY === "Collect-academy/milhano-admissions-live",
  "This bridge is restricted to the Milhano repository.");

if (MODE === "sync-drafts") {
  const explicitOneShot = process.env.GITHUB_EVENT_NAME === "push" &&
    process.env.GITHUB_HEAD_COMMIT_MESSAGE === "ops(sofia): safely import vetted draft workflows";
  const manual = process.env.GITHUB_EVENT_NAME === "workflow_dispatch";
  assert(explicitOneShot || manual, "Inactive draft sync needs an explicit authorized event.");
  assert(process.env.GITHUB_ACTOR === "Collect-academy", "Only the repository owner may request inactive imports.");
  assert(process.env.SYNC_CONFIRM === "IMPORTAR_BORRADORES_IA",
    "Confirmation phrase missing. No n8n changes were made.");
}

async function callApi(method, path, body) {
  assert(path.startsWith("/workflows"), "Disallowed API endpoint.");
  const response = await fetch(API + path, {
    method,
    headers: {
      Accept: "application/json",
      "X-N8N-API-KEY": KEY,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    throw new Error("n8n API request failed (" + method + " /workflows, HTTP " + response.status +
      "). Response body intentionally omitted to avoid exposing sensitive data.");
  }
  return response.json();
}

async function listWorkflows() {
  const all = [];
  let cursor = null;
  for (let page = 0; page < 20; page++) {
    const path = "/workflows?limit=250" + (cursor ? "&cursor=" + encodeURIComponent(cursor) : "");
    const result = await callApi("GET", path);
    assert(Array.isArray(result.data), "Unexpected n8n workflow-list response.");
    all.push(...result.data);
    if (!result.nextCursor) return all;
    cursor = result.nextCursor;
  }
  throw new Error("More than 20 workflow pages; refusing incomplete inventory.");
}

function loadSource({ path, name }) {
  // The bridge script comes from main; workflow JSON comes from the named
  // feature branch as untrusted data. Never execute its JavaScript nodes here.
  const raw = execFileSync(
    "git", ["show", "origin/" + SOURCE_BRANCH + ":" + path],
    { encoding: "utf8", maxBuffer: 3_000_000 }
  );
  const source = JSON.parse(raw);
  assert(source.name === name, "Unexpected source workflow name for " + path);
  assert(source.active === false, "Source workflow must explicitly be inactive: " + path);
  assert(Array.isArray(source.nodes) && source.nodes.length > 0, "Missing workflow nodes: " + path);
  assert(source.connections && typeof source.connections === "object", "Invalid connections: " + path);
  assert(source.settings && typeof source.settings === "object", "Invalid settings: " + path);

  // n8n public API treats id, active and publication metadata as read-only.
  // Only fields explicitly used for an inactive workflow are sent.
  return {
    name: source.name,
    nodes: source.nodes,
    connections: source.connections,
    settings: source.settings,
  };
}

function normalizedHash(value) {
  function ordered(value) {
    if (Array.isArray(value)) return value.map(ordered);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.keys(value).sort().map((k) => [k, ordered(value[k])]));
    }
    return value;
  }
  return createHash("sha256").update(JSON.stringify(ordered(value))).digest("hex").slice(0, 12);
}

async function main() {
  const list = await listWorkflows();
  const active = list.filter((wf) => wf.active === true).length;
  console.log("n8n API: connection verified.");
  console.log("Workflows visible:", list.length, "| Published:", active, "| Not published:", list.length - active);
  const pilotMatches = list.filter(w => w.name?.startsWith("MILHANO | Sofia | PILOTO"));
  console.log("Pilot temporary workflows:", pilotMatches.length);
  for (const wf of pilotMatches) {
    const detail = await callApi("GET","/workflows/"+encodeURIComponent(wf.id));
    console.log("Pilot workflow:",JSON.stringify({name:wf.name,active:detail.active,archived:detail.isArchived===true}));
  }
  const latestDrafts = list.filter(w => /^MILHANO \| Sofia \| 0[456] /.test(w.name ?? ""));
  console.log("Sofia 04/05/06 present on n8n:",latestDrafts.map(w=>({name:w.name,active:w.active})));
  {
    const feedList = list.filter(w => /03 Individual Feed/i.test(w.name ?? ""));
    console.log("Sofia WF03 feed matches:", feedList.length);
    for (const feed of feedList) {
      const detail = await callApi("GET", "/workflows/" + encodeURIComponent(feed.id));
      const nodes = detail.nodes ?? [];
      const webhookPaths = nodes.filter(n => n.type === "n8n-nodes-base.webhook").map(n => n.parameters?.path);
      const source = nodes.map(n => typeof n.parameters?.jsCode === "string" ? n.parameters.jsCode : "").join("\n");
      const allParameters = JSON.stringify(nodes.map(n=>n.parameters??{}));
      const text = source + allParameters;
      const modeLiteral = text.match(new RegExp("test_mode\\\\s*:\\\\s*(true|false)", "i"));
      const callsApi = text.includes("elevenlabs.io/v1/convai/whatsapp/outbound-call");
      const hasBranchId = /agtbrch_5901m66tpzs8eqtryhadxb29zbk4/.test(text);
      const norm = nodes.find(n => n.name === "Normalize | Feed Trigger")?.parameters?.jsCode ?? "";
      const outboundCode = nodes.find(n => n.name === "Prepare | ElevenLabs Outbound")?.parameters?.jsCode ?? "";
      const v2Branch = "agtbrch_5901m66tpzs8eqtryhadxb29zbk4";
      const fixedV2Branch = outboundCode.includes(v2Branch);
      const branchFieldPresent = outboundCode.includes("branch_id");
      const liveModeFalse = /test_mode:\\s*false/.test(norm);
      const liveModeTrue = /test_mode:\\s*true/.test(norm);
      const stageGateCode = nodes.find(n => n.name === "Prepare | Lead + Light Gate")?.parameters?.jsCode ?? "";
      const requiresExactStage = stageGateCode.includes("24a91c8c-c38a-48f9-934a-a5a1b5cb8fa0");
      console.log("Sofia WF03 node diagnostics:", JSON.stringify(
        nodes.filter(n => /Normalize|Prepare.*ElevenLabs|Outbound/i.test(n.name))
          .map(n => ({
            name: n.name, type: n.type,
            paramKeys: Object.keys(n.parameters ?? {}).slice(0,10),
            codeLength: String(n.parameters?.jsCode ?? "").length,
            testModeTextPresent: JSON.stringify(n.parameters ?? {}).includes("test_mode"),
            branchIdTextPresent: JSON.stringify(n.parameters ?? {}).includes("branch_id")
          }))
      ));
      console.log("Sofia WF03 extra preflight:", JSON.stringify({
        fixedV2Branch,branchFieldPresent,liveModeFalse,liveModeTrue,requiresExactStage
      }));
      console.log("Sofia WF03:", JSON.stringify({
        name:feed.name, active:detail.active, archived:detail.isArchived===true,
        webhookPaths, nodeCount:nodes.length, testModeLiteral:modeLiteral?.[1]??"not-detected",
        elevenLabsOutboundConfigured:callsApi, explicitV2BranchReference:hasBranchId
      }));
    }
  }
  if (MODE === "check") {
    console.log("READ-ONLY check completed. No workflow was created or edited.");
    return;
  }
  const stage05Name="MILHANO | Sofia | 05 Stage Decision Engine V1 | DRY RUN";
  const existing05=list.filter(w=>w.name===stage05Name);
  assert(existing05.length<=1,"Ambiguous stage engine target");
  let stageToken=randomBytes(32).toString("hex");
  if(existing05.length===1){
    const old=await callApi("GET","/workflows/"+encodeURIComponent(existing05[0].id));
    const code=old.nodes.find(n=>n.name==="Normalize | Verified Post Call Request")?.parameters?.jsCode??"";
    const found=code.match(/const STAGE_TOKEN="([a-f0-9]{64})";/);
    if(found)stageToken=found[1];
  }
  const changes = [];
  const plannedSources = [];
  for (const source of SOURCES) {
    const target = loadSource(source);
    if (target.name.includes("07 Conversation Reconciliation")) {
      const feed=list.filter(w=>/03 Individual Feed v1.1 International/.test(w.name??""));
      assert(feed.length===1 && feed[0].active===true, "Live WF03 not found for ElevenLabs credential binding.");
      const feedSource=await callApi("GET","/workflows/"+encodeURIComponent(feed[0].id));
      const eleven=feedSource.nodes.find(n=>n.name==="ElevenLabs | Start WhatsApp Outbound");
      const credentials=eleven?.credentials;
      assert(credentials && Object.keys(credentials).length>0,
        "Existing ElevenLabs authentication not available; refusing to import poller.");
      for (const name of ["ElevenLabs | Conversation Details", "ElevenLabs | Agent Main Metadata"]) {
        const newNode=target.nodes.find(n=>n.name===name);
        assert(newNode,"ElevenLabs required audit node missing.");
        newNode.credentials=credentials;
        newNode.parameters.authentication=eleven.parameters.authentication;
        if(eleven.parameters.genericAuthType)newNode.parameters.genericAuthType=eleven.parameters.genericAuthType;
        if(eleven.parameters.nodeCredentialType)newNode.parameters.nodeCredentialType=eleven.parameters.nodeCredentialType;
      }
      console.log("Reused existing ElevenLabs credential reference for conversation reconciler.");
    }
    if(target.name.includes("05 Stage Decision Engine")){
      const n=target.nodes.find(x=>x.name==="Normalize | Verified Post Call Request");
      assert(n,"Stage decision request validator missing");
      n.parameters.jsCode='const STAGE_TOKEN="'+stageToken+'";\\n'+
        'if(String($input.first().json.headers?.["x-milhano-stage-token"]??"")!==STAGE_TOKEN)return [];\\n'+n.parameters.jsCode;
      n.parameters.jsCode=n.parameters.jsCode.replaceAll("\\\\n","\\n");
    }
    if(target.name.includes("04 Post Call")||target.name.includes("07 Conversation Reconciliation")){
      const name=target.name.includes("04 Post Call")?"Stage Engine | Dispatch Confirmed Note":"WF05 | Evaluate Terminal Call";
      const n=target.nodes.find(x=>x.name===name);
      assert(n,"Stage decision sender missing");
      n.parameters.sendHeaders=true;
      n.parameters.headerParameters??={parameters:[]};
      n.parameters.headerParameters.parameters=n.parameters.headerParameters.parameters.filter(h=>h.name.toLowerCase()!=="x-milhano-stage-token");
      n.parameters.headerParameters.parameters.push({name:"X-Milhano-Stage-Token",value:stageToken});
    }
    plannedSources.push({ source, target });
    const matches = list.filter((wf) => wf.name === source.name);
    assert(matches.length <= 1, "Duplicate workflow names; refusing ambiguous update: " + source.name);
    if (matches.length === 0) {
      changes.push({ type: "create", source, target });
      console.log("New inactive draft:", source.name);
      continue;
    }
    const existing = matches[0];
    assert(existing.active === false && existing.isArchived !== true,
      "Refusing to modify a published or archived workflow: " + source.name);
    const detail = await callApi("GET", "/workflows/" + encodeURIComponent(existing.id));
    assert(detail.active === false && detail.name === source.name && detail.isArchived !== true,
      "Workflow state changed during read: " + source.name);
    const comparable = {
      name: detail.name,
      nodes: detail.nodes,
      connections: detail.connections,
      settings: detail.settings,
    };
    if (normalizedHash(comparable) === normalizedHash(target)) {
      console.log("Up to date:", source.name);
    } else {
      changes.push({ type: "update", source, target, id: existing.id });
      console.log("Draft change detected:", source.name);
    }
  }
  await auditSofiaDrafts(plannedSources, list, (id) => callApi("GET", "/workflows/" + encodeURIComponent(id)));
  console.log("Planned changes:", changes.length, "/ 4 allowlisted draft workflows.");
  if (MODE === "preview") {
    console.log("READ-ONLY preview completed. No workflow was created or edited.");
    return;
  }
  for (const change of changes) {
    if (change.type === "create") {
      const created = await callApi("POST", "/workflows", change.target);
      assert(created.id, "n8n did not confirm the created workflow ID.");
      assert(created.active === false, "Unexpected active workflow; stop and inspect immediately.");
      console.log("Created inactive draft:", change.source.name);
    } else {
      // Latest n8n API supports publishIfActive=false; still always fail closed for active workflows.
      const current = await callApi("GET", "/workflows/" + encodeURIComponent(change.id));
      assert(current.active === false && current.name === change.source.name &&
        current.isArchived !== true, "Workflow became active or was renamed; refusing update.");
      const updated = await callApi(
        "PUT",
        "/workflows/" + encodeURIComponent(change.id) + "?publishIfActive=false",
        change.target
      );
      assert(updated.id === change.id && updated.active === false,
        "Draft update was not confirmed as inactive.");
      console.log("Updated inactive draft:", change.source.name);
    }
  }
  console.log("Draft synchronization completed. No publish/activate request was issued.");
}

main().catch((error) => {
  console.error("n8n bridge:", error instanceof Error ? error.message : "Unknown error.");
  process.exitCode = 1;
});
