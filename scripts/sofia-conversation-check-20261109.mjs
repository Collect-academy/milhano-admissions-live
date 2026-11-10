import { setTimeout as delay } from "node:timers/promises";
const KEY=process.env.N8N_API_KEY;
const ORIGIN="https://collectacademy.app.n8n.cloud";
const CAMPAIGN="a3210e7c-4167-4651-be1a-75b854fae9c4";
const CONVERSATION="conv_6501m71gzhzdfazt29bvbemtzzwv";
if(!KEY)throw new Error("Missing n8n API secret.");
async function api(path,method="GET",body){
 const res=await fetch(ORIGIN+"/api/v1"+path,{method,headers:{"X-N8N-API-KEY":KEY,Accept:"application/json","Content-Type":"application/json"},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(25000)});
 if(!res.ok)throw new Error("n8n "+method+" "+path+" HTTP "+res.status);
 return await res.json();
}
const all=(await api("/workflows?limit=250")).data;
const matches=all.filter(w=>w.name==="MILHANO | Sofia | PILOTO 10 New Lead 2026-11-09 | TEMP");
if(matches.length!==1)throw new Error("Temporary pilot workflow not found.");
const id=matches[0].id;
const wf=await api("/workflows/"+encodeURIComponent(id));
if(wf.active)throw new Error("Safety: pilot workflow unexpectedly still published.");
const guard=wf.nodes.find(n=>n.name==="Pilot Status | Validate")?.parameters?.jsCode??"";
const token=guard.match(/[0-9a-f]{50}/)?.[0];
const path=wf.nodes.find(n=>n.name==="Pilot Status | Webhook")?.parameters?.path;
if(!token || !path?.startsWith("milhano-sofia-pilot-status-"))throw new Error("Pilot status authentication unavailable.");
let rePublished=false;
try{
 let r=await fetch(ORIGIN+"/api/v1/workflows/"+encodeURIComponent(id)+"/publish",{method:"POST",headers:{"X-N8N-API-KEY":KEY,Accept:"application/json","Content-Type":"application/json"},body:"{}",signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw new Error("Could not publish status probe "+r.status);
 rePublished=true;
 await delay(2000);
 const res=await fetch(ORIGIN+"/webhook/"+path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({pilot_token:token,conversation_id:CONVERSATION}),signal:AbortSignal.timeout(45000)});
 if(!res.ok)throw new Error("Status endpoint HTTP "+res.status);
 const data=await res.json();
 console.log("Sofía conversation status:", JSON.stringify({status:data.status,branchMatchesV2:data.branch_id==="agtbrch_5901m66tpzs8eqtryhadxb29zbk4",branchPresent:!!data.branch_id}));
}finally{
 if(rePublished){
  const r=await fetch(ORIGIN+"/api/v1/workflows/"+encodeURIComponent(id)+"/unpublish",{method:"POST",headers:{"X-N8N-API-KEY":KEY,Accept:"application/json","Content-Type":"application/json"},body:"{}",signal:AbortSignal.timeout(20000)});
  console.log("Temporary pilot unpublish:",r.status);
 }
}
