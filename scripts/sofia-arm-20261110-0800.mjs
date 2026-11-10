#!/usr/bin/env node
/*
 * One-time authorized publication of the Nov 10 08:00 Merida Sofía batch.
 * No direct call endpoints, no contact data, no secrets persisted to repository.
 * Publishes only 05 stage audit, 07 conversation reconciliation, 08 timed batch.
 */
const API="https://collectacademy.app.n8n.cloud/api/v1";
const KEY=process.env.N8N_API_KEY;
const REPO="Collect-academy/milhano-admissions-live";
const MESSAGE="ops(sofia): arm 10 WhatsApp authorizations Nov10 0800 Merida";
const START=Date.parse("2026-11-10T14:00:00.000Z");
const STAGE="MILHANO | Sofia | 05 Stage Decision Engine V1 | DRY RUN";
const POLL="MILHANO | Sofia | 07 Conversation Reconciliation | SAFE DRAFT";
const BATCH="MILHANO | Sofia | 08 One Shot Authorizations | 10 NOV 08:00 MERIDA";
const FEED="MILHANO | AI Setter TEST | 03 Individual Feed v1.1 International";
function assert(v,message){if(!v)throw new Error(message);}
assert(KEY && KEY.length>15,"Missing N8N_API_KEY.");
assert(process.env.GITHUB_REPOSITORY===REPO,"Wrong repository.");
assert(process.env.GITHUB_EVENT_NAME==="push"&&process.env.GITHUB_HEAD_COMMIT_MESSAGE===MESSAGE,
 "Not the authorized one-time arm event.");
assert(process.env.GITHUB_ACTOR==="Collect-academy","Only repository owner can arm this batch.");
assert(Date.now()<START-5*60_000,"Too late to publish; the batch will not be rescheduled automatically.");
async function api(method,path,body){
 const response=await fetch(API+path,{method,headers:{"X-N8N-API-KEY":KEY,
  Accept:"application/json",...(body===undefined?{}:{"Content-Type":"application/json"})},
  ...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw new Error("n8n "+method+" "+path.split("?")[0]+" returned HTTP "+response.status);
 return response.json();
}
async function inventory(){
 let all=[],cursor=null;
 for(let i=0;i<20;i++){
  const x=await api("GET","/workflows?limit=250"+(cursor?"&cursor="+encodeURIComponent(cursor):""));
  assert(Array.isArray(x.data),"Bad workflow list.");
  all.push(...x.data);
  if(!x.nextCursor)return all;
  cursor=x.nextCursor;
 }
 throw new Error("Incomplete workflow inventory.");
}
const list=await inventory();
async function unique(name){
 const matches=list.filter(x=>x.name===name);
 assert(matches.length===1,"Cannot uniquely identify "+name);
 return api("GET","/workflows/"+encodeURIComponent(matches[0].id));
}
const wf03=await unique(FEED);
assert(wf03.active===true,"Current production WF03 is not active.");
const normalize=wf03.nodes.find(n=>n.name==="Normalize | Feed Trigger")?.parameters?.jsCode??"";
const outbound=wf03.nodes.find(n=>n.name==="Prepare | ElevenLabs Outbound")?.parameters?.jsCode??"";
assert(normalize.includes("agent_6401m3yvs1rcfbya7hk1qb2bxp8v") &&
 normalize.includes("test_mode: false"),"WF03 agent or mode mismatch.");
assert(!outbound.includes("branch_id")&&!outbound.includes("agtbrch_5901m66tpzs8eqtryhadxb29zbk4"),
 "WF03 forces a non-main branch. Publication stopped.");
const stage=await unique(STAGE),poll=await unique(POLL),batch=await unique(BATCH);
assert(!stage.isArchived&&!poll.isArchived&&!batch.isArchived,"An audit workflow was archived.");
const runtime=stage.nodes.find(n=>n.name==="Supabase | Runtime Stage Gate");
const gate=stage.nodes.find(n=>n.name==="Safety Gate | Stage Writes Controlled");
assert(runtime&&gate&&gate.parameters.jsCode.includes("Supabase | Runtime Stage Gate"),
 "Stage mutations do not have a runtime safety gate.");
const sender=poll.nodes.find(n=>n.name==="WF05 | Evaluate Terminal Call");
assert(sender?.parameters?.headerParameters?.parameters?.some(h=>h.name==="X-Milhano-Stage-Token"),
 "Stage audit authorization missing.");
const poller=poll.nodes.find(n=>n.name==="ElevenLabs | Agent Main Metadata");
assert(poller?.credentials,"ElevenLabs main metadata credential missing.");
const schedule=batch.nodes.find(n=>n.name==="Schedule | Nov 10 at 08:00 Merida");
assert(schedule?.parameters?.rule?.interval?.[0]?.expression==="0 8 10 11 *","Wrong schedule cron.");
assert(batch.settings?.timezone==="America/Merida","Wrong timezone.");
const claimant=batch.nodes.find(n=>n.name==="Supabase | Claim One Time Authorization Batch");
const sends=batch.nodes.find(n=>n.name==="WF03 | Schedule WhatsApp Authorization And Call");
assert(claimant?.parameters?.url?.includes("milhano_ai_wa_claim_scheduled_job"),"Missing one-time lock.");
assert(sends?.parameters?.jsonBody?.includes("sofia_scheduled_authorizations_20261110_0800"),"Unapproved batch source.");
assert(batch.nodes.find(n=>n.name==="Select | Ten Oldest Valid And DND-Free"),
 "Required live GHL validation missing.");
assert(batch.nodes.find(n=>n.name==="Supabase | Reserve Ten Before Sending"),
 "Required atomic reservation missing.");
if(batch.active===true){
 console.log("08 one-shot already published; no changes applied.");
 process.exit(0);
}
async function publish(source){
 if(source.active){console.log("Already published:",source.name);return;}
 const res=await api("POST","/workflows/"+encodeURIComponent(source.id)+"/publish",{});
 const fresh=await api("GET","/workflows/"+encodeURIComponent(source.id));
 assert(fresh.active===true,"Publication not confirmed for "+source.name);
 console.log("Published:",source.name);
}
await publish(stage);
await publish(poll);
await publish(batch);
const fresh=await unique(BATCH);
assert(fresh.active===true&&fresh.settings.timezone==="America/Merida","Final schedule verification failed.");
console.log("SCHEDULE ARMED: Tuesday 2026-11-10 08:00 America/Merida; 10 requests, no calls initiated by this script.");
