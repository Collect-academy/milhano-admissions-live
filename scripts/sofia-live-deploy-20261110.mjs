#!/usr/bin/env node
import {readFileSync} from "node:fs";
import {randomBytes} from "node:crypto";

const ROOT="https://collectacademy.app.n8n.cloud/api/v1";
const KEY=process.env.N8N_API_KEY;
const WORDS="ops(sofia): deploy live campaign and call reconciliation workflows";
const LIVE03="03 Individual Feed v1.1 International";
const LIVE06="MILHANO | Sofia | 06 Campaign Scheduler | PROTECTED";
const LIVE07="MILHANO | Sofia | 07 Conversation Reconciliation | SAFE DRAFT";
const EXPECTED_AGENT="agent_6401m3yvs1rcfbya7hk1qb2bxp8v";
const assert=(condition,message)=>{if(!condition)throw Error(message);};
assert(KEY?.length>15&&process.env.GITHUB_REPOSITORY==="Collect-academy/milhano-admissions-live",
 "Missing API secret or wrong repository.");
assert(process.env.GITHUB_EVENT_NAME==="push"&&process.env.GITHUB_HEAD_COMMIT_MESSAGE===WORDS,
 "Unexpected launch event.");
assert(process.env.GITHUB_ACTOR==="Collect-academy","Only owner can deploy.");
async function api(method,path,data){
 assert(path.startsWith("/workflows"),"Disallowed API path");
 const r=await fetch(ROOT+path,{method,headers:{"X-N8N-API-KEY":KEY,"Accept":"application/json",
  ...(data===undefined?{}:{"Content-Type":"application/json"})},
  ...(data===undefined?{}:{body:JSON.stringify(data)}),
  signal:AbortSignal.timeout(25000)});
 if(!r.ok)throw Error("n8n "+method+" "+path.split("?")[0]+" HTTP "+r.status);
 return r.json();
}
async function inventory(){
 let all=[],cursor;
 for(let i=0;i<12;i++){
  const r=await api("GET","/workflows?limit=250"+(cursor?"&cursor="+encodeURIComponent(cursor):""));
  assert(Array.isArray(r.data),"Bad n8n list");
  all.push(...r.data);if(!r.nextCursor)return all;cursor=r.nextCursor;
 }
 throw Error("Incomplete workflow listing");
}
const list=await inventory();
async function exact(name){
 const matches=list.filter(w=>w.name===name);
 assert(matches.length===1,"Expected one "+name);
 return api("GET","/workflows/"+matches[0].id);
}
async function backup(w,name){
 const matches=list.filter(x=>x.name===name);
 if(matches.length){assert(matches.length===1&&!matches[0].active,"Backup name collision");return;}
 const r=await api("POST","/workflows",{name,settings:w.settings,nodes:w.nodes,connections:w.connections});
 assert(r.id&&!r.active,"Inactive backup creation failed");
 console.log("BACKUP:",name);
}
function load(path,name){
 const obj=JSON.parse(readFileSync(path,"utf8"));
 assert(obj.name===name&&obj.active===false,"Bad workflow source "+path);
 const seen=new Set(obj.nodes.map(n=>n.name));
 assert(seen.size===obj.nodes.length,"Duplicate node name");
 for(const [from,value] of Object.entries(obj.connections??{})){
  assert(seen.has(from),"Missing node "+from);
  for(const group of value.main??[])for(const edge of group)assert(seen.has(edge.node),"Missing dest "+edge.node);
 }
 return {name:obj.name,nodes:obj.nodes,connections:obj.connections,settings:obj.settings};
}
async function update(w,body,nodeName){
 await api("PUT","/workflows/"+w.id,body);
 const newer=await api("GET","/workflows/"+w.id);
 assert(newer.nodes.some(n=>n.name===nodeName),"Update verification failed for "+nodeName);
 return newer;
}
async function publish(w){
 if(w.active)return w;
 await api("POST","/workflows/"+w.id+"/publish",{});
 const now=await api("GET","/workflows/"+w.id);
 assert(now.active===true,"Publication failed: "+w.name);
 console.log("PUBLISHED:",w.name);
 return now;
}
const feeds=list.filter(x=>String(x.name??"").includes(LIVE03)&&x.active);
assert(feeds.length===1,"Cannot uniquely identify production WF03.");
const wf03=await api("GET","/workflows/"+feeds[0].id);
const n=wf03.nodes.find(x=>x.name==="Normalize | Feed Trigger");
const outbound=wf03.nodes.find(x=>x.name==="Prepare | ElevenLabs Outbound");
const el=wf03.nodes.find(x=>x.name==="ElevenLabs | Start WhatsApp Outbound");
assert(n?.parameters?.jsCode&&outbound?.parameters?.jsCode&&el?.credentials,"Source WF03 incomplete");
assert(n.parameters.jsCode.includes(EXPECTED_AGENT)&&n.parameters.jsCode.includes("test_mode: false"),"WF03 agent/test mode unexpected");
assert(!outbound.parameters.jsCode.includes("branch_id:")&&!outbound.parameters.jsCode.includes("agtbrch_5901m66tpzs8eqtryhadxb29zbk4"),
 "Production WF03 forces legacy ElevenLabs branch.");
const existing=n.parameters.jsCode.match(/const MILHANO_CAMPAIGN_SHARED="([a-f0-9]{64})";/);
const secret=existing?existing[1]:randomBytes(32).toString("hex");
const hadPatch=Boolean(existing);
if(!hadPatch){
 const anchor="const dispatchKey = "+String.fromCharCode(96)+"wf03:";
 assert(n.parameters.jsCode.includes(anchor),"Expected dedup-key source missing.");
 const pre=
 'const MILHANO_CAMPAIGN_SHARED="'+secret+'";\n'+
 'const campaignSource=source==="sofia_campaign_scheduler";\n'+
 'const submittedCampaignKey=String(b.dispatch_key??"");\n'+
 'const validCampaignKey=/^campaign:[0-9a-f-]{36}:member:[0-9a-f-]{36}:attempt:[12]$/.test(submittedCampaignKey);\n'+
 'const campaignAuthenticated=String(input.headers?.["x-milhano-batch-secret"]??"")===MILHANO_CAMPAIGN_SHARED;\n'+
 'const campaignBlocked=campaignSource&&(!validCampaignKey||!campaignAuthenticated);\n'+
 'const dispatchKey=campaignSource&&validCampaignKey&&campaignAuthenticated?submittedCampaignKey:'+String.fromCharCode(96)+'wf03:';
 n.parameters.jsCode=n.parameters.jsCode.replace(anchor,pre);
 assert(n.parameters.jsCode.includes("const missing = [];"),"Missing WF03 safety anchor");
 n.parameters.jsCode=n.parameters.jsCode.replace("const missing = [];",
  "const missing = [];\nif(campaignBlocked)missing.push('UNAUTHORIZED_CAMPAIGN_REQUEST');");
}
const s6=load("n8n/MILHANO_06_Sofia_Batch_Scheduler_V1_DISABLED.json",LIVE06);
const s7=load("n8n/MILHANO_07_Sofia_Conversation_Reconciliation_DRAFT.json",LIVE07);
const scheduler=s6.nodes.find(n=>n.name==="WF03 | Existing Individual Feed");
assert(scheduler?.parameters?.jsonBody?.includes("dispatch_key"),"Missing unique campaign dispatch key");
scheduler.parameters.headerParameters??={parameters:[]};
scheduler.parameters.headerParameters.parameters=
 scheduler.parameters.headerParameters.parameters.filter(h=>h.name.toLowerCase()!=="x-milhano-batch-secret");
scheduler.parameters.headerParameters.parameters.push({name:"X-Milhano-Batch-Secret",value:secret});
for(const name of ["ElevenLabs | Check Main Agent","ElevenLabs | Fetch Pending Conversation"]){
 const node=s7.nodes.find(n=>n.name===name);
 assert(node,"Missing ElevenLabs status node");
 node.credentials=el.credentials;
 node.parameters.authentication=el.parameters.authentication;
 node.parameters.genericAuthType=el.parameters.genericAuthType??"httpHeaderAuth";
 delete node.parameters.nodeCredentialType;
}
assert(s6.nodes.find(n=>n.name==="Supabase | Claim One Due")?.parameters.url.includes("milhano_ai_claim_due_batch"),
 "No actual multi-contact claim");
assert(s7.nodes.find(n=>n.name==="Supabase | Commit Outcome and Automatic Retry")?.parameters.url.includes("milhano_ai_record_final_call"),
 "No verified retry reconciliation");
const w6=await exact(LIVE06),w7=await exact(LIVE07);
await backup(wf03,"MILHANO | BACKUP WF03 before batch retries 2026-11-10");
await backup(w7,"MILHANO | BACKUP WF07 before automatic retries 2026-11-10");
if(!hadPatch){
 const updated=await update(wf03,{name:wf03.name,nodes:wf03.nodes,connections:wf03.connections,settings:wf03.settings},"Normalize | Feed Trigger");
 assert(updated.active===true,"WF03 lost publication status");
 assert(updated.nodes.find(x=>x.name==="Normalize | Feed Trigger").parameters.jsCode.includes("MILHANO_CAMPAIGN_SHARED"),"WF03 patch not saved");
 console.log("WF03 campaign-only auth and dedup key updated.");
}
const up7=await update(w7,s7,"Supabase | Commit Outcome and Automatic Retry");
await publish(up7);
const up6=await update(w6,s6,"Supabase | Claim One Due");
await publish(up6);
const check=await Promise.all([wf03.id,w6.id,w7.id].map(id=>api("GET","/workflows/"+id)));
assert(check.every(w=>w.active),"03, 06, 07 must all be active");
assert(check[2].nodes.some(n=>n.name==="Classify | Confirmed Final Call"),"07 classifier not active");
console.log("SOFIA_LIVE_WORKFLOWS_READY=true");
console.log("Global Supabase dispatch flag unchanged. No calls were sent by deployment.");
