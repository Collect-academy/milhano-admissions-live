// One-shot production hotfix. Edits exactly one DND predicate in WF06.
// No new calls, no contact mutations, no changes to other workflows.
import { readFileSync } from "node:fs";
const API="https://collectacademy.app.n8n.cloud/api/v1";
const KEY=process.env.N8N_API_KEY;
const WORKFLOW_ID="ejxcZpXHp1ZFh2MA";
const WORKFLOW_NAME="MILHANO | Sofia | 06 Campaign Scheduler | WEBHOOK ONLY";
const TARGET_NODE="Verify | Live GHL Eligibility";
const OLD="else if(ct.dnd!==false)reason='CONTACT_DND';";
const NEW="else if(ct.dnd===true)reason='CONTACT_DND';";
const REPO="Collect-academy/milhano-admissions-live";
const assert=(v,msg)=>{if(!v)throw Error(msg);};
assert(process.env.GITHUB_REPOSITORY===REPO,"WRONG_REPOSITORY");
assert(process.env.GITHUB_REF==="refs/heads/main","NOT_MAIN");
assert(process.env.GITHUB_ACTOR==="Collect-academy","UNEXPECTED_ACTOR");
assert(KEY?.length>15,"N8N_SECRET_MISSING");
async function api(method,path,body){
  assert(path==="/workflows/"+WORKFLOW_ID||path==="/workflows/"+WORKFLOW_ID+"/publish","DISALLOWED_PATH");
  const r=await fetch(API+path,{method,headers:{"X-N8N-API-KEY":KEY,Accept:"application/json",...(body?{"Content-Type":"application/json"}:{})},
   ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});
  if(!r.ok)throw Error("N8N_HTTP_"+r.status+"_"+method);
  return r.json();
}
const source=JSON.parse(readFileSync("n8n/IMPORTAR_MILHANO_06_SOFIA_BATCH_WEBHOOK_2026-11-10.json","utf8"));
const sourceNode=source.nodes.find(n=>n.name===TARGET_NODE);
assert(source.name===WORKFLOW_NAME&&sourceNode?.parameters?.jsCode?.includes(NEW)&&!sourceNode.parameters.jsCode.includes(OLD),"SOURCE_NOT_PATCHED");
const wf=await api("GET","/workflows/"+WORKFLOW_ID);
assert(wf.name===WORKFLOW_NAME&&wf.active===true&&Array.isArray(wf.nodes)&&wf.connections&&wf.settings,"LIVE_TARGET_MISMATCH");
const candidates=wf.nodes.filter(n=>n.name===TARGET_NODE);
assert(candidates.length===1,"TARGET_NODE_NOT_UNIQUE");
const before=candidates[0].parameters?.jsCode;
assert(typeof before==="string","TARGET_NODE_CODE_MISSING");
const oldCount=before.split(OLD).length-1;
const newCount=before.split(NEW).length-1;
assert(oldCount===1||oldCount===0&&newCount===1,"UNEXPECTED_PRODUCTION_CODE");
if(oldCount===1){
  const nodes=JSON.parse(JSON.stringify(wf.nodes));
  const target=nodes.find(n=>n.name===TARGET_NODE);
  target.parameters.jsCode=before.replace(OLD,NEW);
  assert(target.parameters.jsCode.replace(NEW,OLD)===before,"NON_ATOMIC_CODE_CHANGE");
  await api("PUT","/workflows/"+WORKFLOW_ID,{name:wf.name,nodes,connections:wf.connections,settings:wf.settings});
  console.log("WF06_DND_HOTFIX_UPDATED");
} else console.log("WF06_DND_HOTFIX_ALREADY_SAVED");
let latest=await api("GET","/workflows/"+WORKFLOW_ID);
const updated=latest.nodes.find(n=>n.name===TARGET_NODE)?.parameters?.jsCode??"";
assert(updated.includes(NEW)&&!updated.includes(OLD)&&latest.active===true,"UPDATED_CODE_NOT_VERIFIED");
// Modern n8n maintains published versions separately. Publishing the exact verified
// workflow makes the saved change effective without sending a single call.
await api("POST","/workflows/"+WORKFLOW_ID+"/publish",{});
latest=await api("GET","/workflows/"+WORKFLOW_ID);
const final=latest.nodes.find(n=>n.name===TARGET_NODE)?.parameters?.jsCode??"";
assert(latest.active===true&&final.includes(NEW)&&!final.includes(OLD),"PUBLISHED_HOTFIX_NOT_VERIFIED");
console.log("WF06_DND_HOTFIX_VERIFIED",JSON.stringify({workflowId:WORKFLOW_ID,active:latest.active,versionId:latest.versionId??null,activeVersionId:latest.activeVersionId??null,publishedVersionId:latest.publishedVersionId??null,condition:NEW}));
