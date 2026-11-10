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
import { createHash } from "node:crypto";
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
    name: "MILHANO | Sofia | 06 Batch Scheduler | DISABLED DRAFT",
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
  assert(process.env.GITHUB_EVENT_NAME === "workflow_dispatch",
    "Draft synchronization must be triggered manually.");
  assert(process.env.GITHUB_ACTOR === "Collect-academy",
    "Only the repository owner may request draft synchronization.");
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
  if (MODE === "check") {
    const feedList = list.filter(w => /03 Individual Feed/i.test(w.name ?? ""));
    console.log("Sofia WF03 feed matches:", feedList.length);
    for (const feed of feedList) {
      const detail = await callApi("GET", "/workflows/" + encodeURIComponent(feed.id));
      const nodes = detail.nodes ?? [];
      const webhookPaths = nodes.filter(n => n.type === "n8n-nodes-base.webhook").map(n => n.parameters?.path);
      const source = nodes.map(n => typeof n.parameters?.jsCode === "string" ? n.parameters.jsCode : "").join("\n");
      const allParameters = JSON.stringify(nodes.map(n=>n.parameters??{}));
      const text = source + allParameters;
      const modeLiteral = text.match(/test_mode\\s*:\\s*(true|false)/i);
      const callsApi = /elevenlabs\\.io\\/v1\\/convai\\/whatsapp\\/outbound-call/i.test(text);
      const hasBranchId = /agtbrch_5901m66tpzs8eqtryhadxb29zbk4/.test(text);
      console.log("Sofia WF03:", JSON.stringify({
        name:feed.name, active:detail.active, archived:detail.isArchived===true,
        webhookPaths, nodeCount:nodes.length, testModeLiteral:modeLiteral?.[1]??"not-detected",
        elevenLabsOutboundConfigured:callsApi, explicitV2BranchReference:hasBranchId
      }));
    }
    console.log("READ-ONLY check completed. No workflow was created or edited.");
    return;
  }
  const changes = [];
  const plannedSources = [];
  for (const source of SOURCES) {
    const target = loadSource(source);
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
  console.log("Planned changes:", changes.length, "/ 3 allowlisted draft workflows.");
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
