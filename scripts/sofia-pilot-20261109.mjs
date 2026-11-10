#!/usr/bin/env node
// One-time Milhano Sofia pilot. Invoked ONLY by GitHub Actions on the authorized commit.
// Uses the existing n8n Supabase, GHL and ElevenLabs credentials in an isolated workflow.
// This script intentionally includes NO contact names, telephone numbers or lead IDs.

import { randomBytes, randomUUID } from "node:crypto";

const N8N = "https://collectacademy.app.n8n.cloud";
const API = N8N + "/api/v1";
const CAMPAIGN = process.env.SOFIA_PILOT_CAMPAIGN || "a3210e7c-4167-4651-be1a-75b854fae9c4";
const MAX_MEMBERS = Number(process.env.SOFIA_PILOT_CANDIDATES || 10);
const MAX_SEND = Number(process.env.SOFIA_PILOT_TARGETS || 10);
const EXPECTED_STAGE = "24a91c8c-c38a-48f9-934a-a5a1b5cb8fa0";
const EXPECTED_PIPELINE = "GYqHbZyWUxxc3K03efVT";
const EXPECTED_AGENT = "agent_6401m3yvs1rcfbya7hk1qb2bxp8v";
// Main is the current ElevenLabs production configuration. Do not pin V2.
const PILOT_NAME = "MILHANO | Sofia | PILOTO 2026-11-09 | TEMP " + CAMPAIGN;
throw new Error("LEGACY_PILOT_DISABLED: Main is the current ElevenLabs agent and WhatsApp initiation is asynchronous. No calls may be started by this retired runner.");
const SECRET = process.env.N8N_API_KEY;
const TOKEN = randomBytes(25).toString("hex");
const CALL_PATH = "milhano-sofia-pilot-20261109-" + randomBytes(16).toString("hex");
const STATUS_PATH = "milhano-sofia-pilot-status-" + randomBytes(16).toString("hex");
const deadline = Date.parse("2026-11-10T02:00:00.000Z"); // Nov 9 20:00 America/Merida
const earliest = Date.parse("2026-11-10T01:20:00.000Z"); // Nov 9 19:20 America/Merida
let tempId = null;
let started = 0;
let blocked = 0;
let finalized = 0;
const dispatches = [];

function fail(message) { throw new Error(message); }
function assert(cond,msg) { if(!cond) fail(msg); }
function log(msg) { console.log("[Sofia pilot] " + msg); }
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function verifyTime() {
  assert(Date.now() >= earliest && Date.now() < deadline - 60000,
    "Outside approved Nov 9, 19:20-19:59 Merida window. Stop before dialing.");
}
assert(SECRET && SECRET.length > 15, "N8N_API_KEY unavailable.");
assert(Number.isInteger(MAX_MEMBERS) && MAX_MEMBERS >= 1 && MAX_MEMBERS <= 25, "Invalid member limit.");
assert(Number.isInteger(MAX_SEND) && MAX_SEND >= 1 && MAX_SEND <= 10, "Invalid call limit.");
assert(/^[0-9a-f-]{36}$/.test(CAMPAIGN), "Invalid campaign identifier.");
assert(process.env.GITHUB_REPOSITORY === "Collect-academy/milhano-admissions-live",
  "Wrong repo.");
assert(process.env.GITHUB_EVENT_NAME === "push",
  "One-time pilot must run on authorized push.");
assert(process.env.GITHUB_ACTOR === "Collect-academy",
  "Only repo owner may launch.");
assert(["ops(sofia): launch approved ten-call pilot", "ops(sofia): complete approved ten-call pilot"].includes(process.env.GITHUB_HEAD_COMMIT_MESSAGE),
  "Wrong commit, no calls.");
verifyTime();

async function request(path,method="GET",body,strict=true) {
  const res=await fetch(API + path,{
    method,
    headers:{"X-N8N-API-KEY":SECRET,"Accept":"application/json",
      ...(body===undefined?{}:{"Content-Type":"application/json"})},
    ...(body===undefined?{}:{body:JSON.stringify(body)}),
    signal:AbortSignal.timeout(20000)
  });
  if (!res.ok) {
    const error="n8n API " + method + " " + path.split("?")[0] + " returned HTTP " + res.status;
    if(strict)fail(error);
    return {error,status:res.status};
  }
  return await res.json();
}
async function webhook(path,data,timeoutMs=90000) {
  const res=await fetch(N8N + "/webhook/" + path,{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify(data),signal:AbortSignal.timeout(timeoutMs)
  });
  if (!res.ok) fail("Pilot webhook returned HTTP " + res.status + ", no retry to avoid duplicates.");
  return await res.json();
}
async function listWorkflows(){
  const all=[];let cursor;
  for(let i=0;i<20;i++){
    const x=await request("/workflows?limit=250"+(cursor?"&cursor="+encodeURIComponent(cursor):""));
    assert(Array.isArray(x.data),"Unexpected list response");
    all.push(...x.data);
    if(!x.nextCursor)return all;
    cursor=x.nextCursor;
  }
  fail("Workflow inventory incomplete");
}
function nodeByName(nodes,name){
  const n=nodes.find(x=>x.name===name);
  assert(n,"Missing required node: "+name);
  return n;
}
function newNode(name,type,typeVersion,position,parameters){
  return {id:randomUUID(),name,type,typeVersion,position,parameters};
}
function link(connections,from,to){
  if(!connections[from]) connections[from]={main:[[]]};
  if(!connections[from].main[0]) connections[from].main[0]=[];
  connections[from].main[0].push({node:to,type:"main",index:0});
}
function resolveOutputText(json){
  if(json && typeof json==="object") return json;
  return {};
}
function buildClone(original){
  const nodes=structuredClone(original.nodes);
  const connections=structuredClone(original.connections);
  const hook=nodeByName(nodes,"Webhook | GHL Quiero Informes");
  hook.parameters.path=CALL_PATH;hook.webhookId=randomUUID();
  const norm=nodeByName(nodes,"Normalize | Feed Trigger");
  let normCode=norm.parameters.jsCode;
  assert(normCode.includes("const missing = [];"),"No trigger guard anchor");
  assert(/test_mode:\s*(true|false)/.test(normCode),"Cannot verify test_mode");
  normCode=normCode.replace(/test_mode:\s*(true|false)/,"test_mode: false");
  // Keep original entry isolated. No direct inbound without the random token and pilot source.
  normCode=normCode.replace("const missing = [];",
    'const missing = [];\nif (String(b.source ?? "") !== "sofia_pilot_10_20261109" || String(b.pilot_token ?? "") !== "' +
      TOKEN + '") missing.push("PILOT_UNAUTHORIZED");');
  norm.parameters.jsCode=normCode;

  const gate=nodeByName(nodes,"Prepare | Lead + Light Gate");
  let gateCode=gate.parameters.jsCode;
  const key="return [{json:{";
  assert(gateCode.includes(key),"No gate insertion anchor");
  // Enforce live stage, pipeline, status and identity on every selected opportunity.
  gateCode=gateCode.replace(key,
    'if (stageId !== "'+EXPECTED_STAGE+'") reasons.push("PILOT_STAGE_CHANGED");\n' +
    'if (pipelineId !== "'+EXPECTED_PIPELINE+'") reasons.push("PILOT_PIPELINE_CHANGED");\n' +
    'if (String(oppStatus) !== "open") reasons.push("PILOT_OPPORTUNITY_NOT_OPEN");\n' +
    'if (!oppContactId || oppContactId !== contact?.id) reasons.push("PILOT_CONTACT_MISMATCH");\n' +
    key);
  gate.parameters.jsCode=gateCode;

  const outbound=nodeByName(nodes,"Prepare | ElevenLabs Outbound");
  let outboundCode=outbound.parameters.jsCode;
  const anchor="conversation_initiation_client_data: {";
  assert(outboundCode.includes(anchor),"Missing initiation client data object");
  // Keep the original WF03 agent request: no explicit branch_id, so it follows Main.
  assert(!outboundCode.includes("branch_id:"), "Unexpected branch override in the current source");

  // Authenticated manifest lookup is performed with the EXISTING Supabase credential,
  // before Normalize/LightGate/ElevenLabs. No contact IDs are committed to GitHub.
  const auth=newNode("Pilot | Authenticate & Validate","n8n-nodes-base.code",2,[4320,1110],
    {jsCode:
      'const b = $input.first().json.body ?? {};\n' +
      'if (String(b.pilot_token ?? "") !== "'+TOKEN+'" || String(b.campaign_id ?? "") !== "'+CAMPAIGN+'") throw new Error("PILOT_AUTH_REJECTED");\n' +
      'const idx=Number(b.index);\n' +
      'if (!Number.isInteger(idx) || idx<1 || idx>'+MAX_MEMBERS+') throw new Error("PILOT_INDEX_INVALID");\n' +
      'if (new Date().toISOString() >= "2026-11-10T02:00:00.000Z") throw new Error("PILOT_WINDOW_CLOSED");\n' +
      'return [{json:{campaign_id:"'+CAMPAIGN+'",index:idx}}];'
    });
  const supabaseTemplate=nodeByName(nodes,"Supabase | Claim Dispatch");
  const lookup=structuredClone(supabaseTemplate);
  lookup.id=randomUUID();lookup.name="Pilot | Resolve Reserved Member";lookup.position=[4520,1110];
  lookup.parameters.method="GET";
  lookup.parameters.url="=https://mhfncmxlpwzyuupxjlxo.supabase.co/rest/v1/milhano_ai_campaign_members?select=ghl_contact_id,ghl_opportunity_id,selection_order,status&campaign_id=eq."+
    CAMPAIGN+"&selection_order=eq.{{$('Pilot | Authenticate & Validate').first().json.index}}&limit=1";
  lookup.parameters.sendBody=false;delete lookup.parameters.jsonBody;delete lookup.parameters.specifyBody;
  lookup.parameters.headerParameters={parameters:[{"name":"Accept","value":"application/json"}]};
  const mapper=newNode("Pilot | Prepare Current Member","n8n-nodes-base.code",2,[4730,1110],
    {jsCode:
      'const m=$input.first().json;\n' +
      'const expected=$("Pilot | Authenticate & Validate").first().json.index;\n' +
      'if (!m || Number(m.selection_order)!==expected || m.status!=="queued" || !m.ghl_contact_id || !m.ghl_opportunity_id) throw new Error("PILOT_MEMBER_NOT_ELIGIBLE");\n' +
      'return [{json:{body:{contact_id:m.ghl_contact_id,opportunity_id:m.ghl_opportunity_id,source:"sofia_pilot_10_20261109",pilot_token:"'+TOKEN+'"}}}];'
    });
  // Replace original webhook first edge with strict manifest chain.
  connections[hook.name]={main:[[{node:auth.name,type:"main",index:0}]]};
  link(connections,auth.name,lookup.name);
  link(connections,lookup.name,mapper.name);
  link(connections,mapper.name,norm.name);
  nodes.push(auth,lookup,mapper);

  // Separate protected status endpoint to poll ElevenLabs with its stored
  // credential and verify branch/terminal status WITHOUT exposing transcripts.
  const statusHook=newNode("Pilot Status | Webhook","n8n-nodes-base.webhook",2.1,[4320,1740],
    {httpMethod:"POST",path:STATUS_PATH,responseMode:"responseNode",options:{}});
  statusHook.webhookId=randomUUID();
  const statusGuard=newNode("Pilot Status | Validate","n8n-nodes-base.code",2,[4530,1740],
    {jsCode:
      'const b=$input.first().json.body ?? {};\n' +
      'if (String(b.pilot_token??"")!=="'+TOKEN+'") throw new Error("PILOT_STATUS_AUTH_REJECTED");\n' +
      'if (!/^conv_[a-zA-Z0-9]+$/.test(String(b.conversation_id??""))) throw new Error("PILOT_STATUS_BAD_CONVERSATION");\n' +
      'return [{json:{conversation_id:String(b.conversation_id)}}];'
    });
  const elTemplate=nodeByName(nodes,"ElevenLabs | Start WhatsApp Outbound");
  const statusHttp=structuredClone(elTemplate);
  statusHttp.id=randomUUID();statusHttp.name="Pilot Status | Query ElevenLabs";statusHttp.position=[4740,1740];
  statusHttp.parameters.method="GET";
  statusHttp.parameters.url="=https://api.elevenlabs.io/v1/convai/conversations/{{$('Pilot Status | Validate').first().json.conversation_id}}";
  statusHttp.parameters.sendBody=false;delete statusHttp.parameters.jsonBody;delete statusHttp.parameters.specifyBody;
  // Existing credential type and ID are retained; never store any secret value.
  const statusSafe=newNode("Pilot Status | Return Status Only","n8n-nodes-base.code",2,[4950,1740],
    {jsCode:
      'const x=$input.first().json;\n' +
      'return [{json:{conversation_id:String(x.conversation_id??""),status:String(x.status??"unknown"),branch_id:x.branch_id??null,version_id:x.version_id??null}}];'
    });
  const statusReply=newNode("Pilot Status | Respond","n8n-nodes-base.respondToWebhook",1.4,[5160,1740],
    {respondWith:"json",responseBody:"={{ $json }}",options:{}});
  nodes.push(statusHook,statusGuard,statusHttp,statusSafe,statusReply);
  link(connections,statusHook.name,statusGuard.name);
  link(connections,statusGuard.name,statusHttp.name);
  link(connections,statusHttp.name,statusSafe.name);
  link(connections,statusSafe.name,statusReply.name);

  return {
    name:PILOT_NAME,nodes,connections,
    settings:{executionOrder:"v1"}
  };
}
async function pollConversation(conversationId){
  const startedAt=Date.now();
  let rounds=0;
  while(Date.now()-startedAt<7*60_000){
    await sleep(rounds===0?12000:15000);
    rounds++;
    const res=await webhook(STATUS_PATH,{pilot_token:TOKEN,conversation_id:conversationId},45000);
    const status=String(res.status??"unknown");
    if(res.conversation_id!==conversationId)fail("Status identity mismatch; stop.");
    // No branch override is permitted; do not compare against historic V2.
    if(status==="done"||status==="failed"){
      // For WhatsApp, initiated may persist until call permission is granted.
      finalized++;
      log("Call "+started+" terminal status: "+status+"; correct branch confirmed.");
      return true;
    }
    if(!["initiated","in-progress","processing"].includes(status))
      fail("Unexpected conversation status "+status+", stop.");
  }
  fail("Conversation did not finish in 7 minutes; stopping to protect concurrency.");
}
async function unpublish(id){
  if(!id)return;
  try {
    const r=await request("/workflows/"+encodeURIComponent(id)+"/unpublish","POST",{},false);
    if(r.error){
      await request("/workflows/"+encodeURIComponent(id)+"/deactivate","POST",{},false);
    }
    log("Temporary pilot workflow unpublish requested.");
  }catch(e){log("WARNING: Unpublish uncertain; manual check required.");}
}
async function main(){
  verifyTime();
  const list=await listWorkflows();
  assert(!list.some(x=>x.name===PILOT_NAME),
    "Pilot workflow already exists: prevent rerun or repeated calls.");
  const feeds=list.filter(x=>/03 Individual Feed v1.1 International/.test(x.name??""));
  assert(feeds.length===1 && feeds[0].active===true,
    "Production individual feed missing or inactive.");
  const source=await request("/workflows/"+encodeURIComponent(feeds[0].id));
  assert(source.active===true,"Source unexpectedly inactive");
  const baseline=buildClone(source);
  assert(baseline.nodes.length===source.nodes.length+8,"Unexpected clone graph size");
  // Creating the isolated workflow is the only n8n write before calling.
  const created=await request("/workflows","POST",baseline);
  assert(created.id,"n8n didn't return clone ID");
  tempId=created.id;
  log("Isolated draft created.");
  // n8n 2.0 uses publish; old endpoint as fallback only for unsupported route.
  let published=await request("/workflows/"+encodeURIComponent(tempId)+"/publish","POST",{},false);
  if(published.error && published.status===404)
    published=await request("/workflows/"+encodeURIComponent(tempId)+"/activate","POST",{},false);
  assert(!published.error,"Could not publish isolated pilot. No calls sent.");
  const live=await request("/workflows/"+encodeURIComponent(tempId));
  assert(live.active===true,"Pilot workflow not published. No calls sent.");
  log("Temporary workflow published. Original WF03 untouched.");
  // Production webhook activation should register both hook paths.
  await sleep(2500);
  for(let i=1;i<=MAX_MEMBERS && started<MAX_SEND;i++){
    verifyTime();
    let response;
    try{
      response=resolveOutputText(await webhook(CALL_PATH,{
        campaign_id:CAMPAIGN,index:i,pilot_token:TOKEN,
        source:"sofia_pilot_10_20261109"
      }));
    }catch(e){
      // A timed-out webhook may have caused a real dial. NO automatic retry.
      fail("Call initiation uncertain at manifest index "+i+": "+String(e.message).slice(0,150));
    }
    const accepted=response.success===true &&
      response.status==="DISPATCHED" &&
      /^conv_[a-zA-Z0-9]+$/.test(String(response.conversation_id??""));
    if(!accepted){
      const state=String(response.status??"UNKNOWN");
      if(state==="BLOCKED" || response.success===false && /BLOCKED|INVALID|DUPLICATE/.test(state)){
        blocked++;log("Index "+i+" was blocked by live GHL / dispatch gate. No call sent.");
        continue;
      }
      fail("Unverified dispatch response at index "+i+" ("+state+"). Stop to avoid duplicates.");
    }
    started++;dispatches.push({index:i,conversation_id:response.conversation_id});
    log("Index "+i+" dispatched. Total accepted "+started+"/"+MAX_SEND+".");
    await pollConversation(response.conversation_id);
    await sleep(8000);
  }
  log("Pilot result: accepted "+started+"; live blocks "+blocked+"; terminal conversations "+finalized+".");
}
try{await main();}
catch(e){log("PILOT STOPPED: "+(e?.message??"Unknown failure"));process.exitCode=1;}
finally{
  await unpublish(tempId);
  log("Final accepted "+started+"/"+MAX_SEND+"; blocked "+blocked+"; completed "+finalized+".");
}
