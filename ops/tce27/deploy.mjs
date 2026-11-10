// Isolated Collect TCE27 deployment via existing n8n API secret.
// Only exact workflow name and webhook are in scope. No Milhano workflow writes.
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { resolve } from "node:path";

const name = "TCE27 | 02 | Public Capture -> GHL | TCE 1 2027 (CSV validated) | DRAFT";
const hook = "tce27-public-miniform-v1";
const credential = "xdPGXIbW6yrWua0s";
const api = "https://collectacademy.app.n8n.cloud/api/v1";
const key = process.env.N8N_API_KEY;
const mode = process.argv[2] ?? "preflight";
if (!["preflight","publish"].includes(mode)) throw Error("Unknown mode");
if (!key) throw Error("Missing existing N8N_API_KEY repo secret");
const packed = readFileSync(resolve("ops/tce27/collect-wf02.json.gz.b64"), "utf8").trim();
const w = JSON.parse(gunzipSync(Buffer.from(packed,"base64")).toString("utf8"));
function insist(ok,why){if(!ok)throw Error(why);}
insist(w.active===false && w.name===name, "Unexpected workflow identity or active source");
insist(w.settings?.timezone==="America/Toronto","Incorrect timezone");
const webhooks=w.nodes.filter(n=>n.type==="n8n-nodes-base.webhook");
insist(webhooks.length===1 && webhooks[0].parameters?.path===hook && !!webhooks[0].webhookId,"Unexpected webhook");
const creds=w.nodes.flatMap(n=>Object.values(n.credentials??{}));
insist(creds.length===5&&creds.every(c=>c.id===credential&&c.name==="Collect GHL API"),"Non-Collect credential referenced");
const config=w.nodes.find(n=>n.name==="Code | Normalize & Config")?.parameters?.jsCode??"";
insist(config.includes("ojR4ZB7H3KiuY5kESilq")&&config.includes("Lp51AslVPg5iqVnBBGTa")&&config.includes("0af21d93-2c84-4154-a166-cd59117511ec"),"Collect account or pipeline/stage mismatch");
insist(config.includes("webinarPipelineId:''"),"Webinar block unexpectedly removed");
for(const node of w.nodes.filter(n=>n.type==="n8n-nodes-base.code"))new Function(node.parameters.jsCode);
const target={name:w.name,nodes:w.nodes,connections:w.connections,settings:w.settings};
async function request(method,path,body){
 const res=await fetch(api+path,{
  method,headers:{"X-N8N-API-KEY":key,"Accept":"application/json",...(body?{"Content-Type":"application/json"}:{})},
  ...(body?{body:JSON.stringify(body)}:{})
 });
 const raw=await res.text();
 let obj={};try{obj=raw?JSON.parse(raw):{}}catch{obj={detail:"non-json-response"}}
 if(!res.ok){const e=Error(method+" "+path+" HTTP "+res.status+" "+JSON.stringify(obj).slice(0,350));e.status=res.status;throw e;}
 return obj;
}
async function all(){
 const out=[];let cursor;
 for(let i=0;i<30;i++){
  const x=await request("GET","/workflows?limit=100"+(cursor?"&cursor="+encodeURIComponent(cursor):""));
  out.push(...(x.data??[]));cursor=x.nextCursor;if(!cursor)return out;
 }
 throw Error("Incomplete workflow listing");
}
const items=await all();
const matching=items.filter(x=>x.name===name);
insist(matching.length<=1,"Multiple workflows with exact TCE27 name");
const details=await Promise.all(items.map(x=>request("GET","/workflows/"+encodeURIComponent(x.id))));
const collisions=details.filter(x=>x.name!==name&&x.nodes?.some(n=>n.type==="n8n-nodes-base.webhook"&&n.parameters?.path===hook));
insist(collisions.length===0,"Existing workflow already owns TCE27 public webhook");
const existing=details.find(x=>x.name===name);
insist(!existing||!existing.isArchived,"Target is archived");
if(existing?.active){
 const path=existing.nodes?.find(n=>n.type==="n8n-nodes-base.webhook")?.parameters?.path;
 insist(path===hook,"Existing published workflow uses a different webhook");
 console.log("ALREADY_ACTIVE",JSON.stringify({id:existing.id,name,hook}));
 process.exit(0);
}
console.log("PREFLIGHT_OK",JSON.stringify({name,webhook:hook,existing_id:existing?.id??null,credential_reference:"Collect GHL API",other_workflows_modified:0}));
if(mode==="preflight")process.exit(0);
let saved;
if(existing){
 saved=await request("PUT","/workflows/"+encodeURIComponent(existing.id)+"?publishIfActive=false",target);
} else saved=await request("POST","/workflows",target);
insist(!!saved.id,"No workflow ID returned from save");
insist(saved.active!==true,"Unexpected auto-activation; audit needed");
try{await request("POST","/workflows/"+encodeURIComponent(saved.id)+"/publish");}
catch(e){if(e.status!==404)throw e;await request("POST","/workflows/"+encodeURIComponent(saved.id)+"/activate");}
const active=await request("GET","/workflows/"+encodeURIComponent(saved.id));
insist(active.active===true,"Workflow did not confirm as active");
insist(active.name===name&&active.nodes?.some(n=>n.type==="n8n-nodes-base.webhook"&&n.parameters?.path===hook),"Active workflow identity/path mismatch");
console.log("PUBLISHED_OK",JSON.stringify({id:active.id,name,hook,active:true,credential_reference:"Collect GHL API",retreat_stage:"Registered",webinar:"blocked",other_workflows_modified:0}));
