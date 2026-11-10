import {randomBytes,randomUUID} from "node:crypto";
const API="https://collectacademy.app.n8n.cloud/api/v1",ORIGIN="https://collectacademy.app.n8n.cloud";
const key=process.env.N8N_API_KEY,token=randomBytes(20).toString("hex");
if(!key||process.env.GITHUB_REPOSITORY!=="Collect-academy/milhano-admissions-live")throw Error("Invalid API or repository.");
const req=async(method,path,data)=>{
 const res=await fetch(API+path,{method,headers:{"X-N8N-API-KEY":key,Accept:"application/json","Content-Type":"application/json"},
 ...(data?{body:JSON.stringify(data)}:{}),signal:AbortSignal.timeout(20000)});
 if(!res.ok)throw Error("n8n "+method+" "+path.split("?")[0]+" HTTP "+res.status);
 return await res.json();
};
let id=null;try{
const all=(await req("GET","/workflows?limit=250")).data;
const live=all.filter(x=>/03 Individual Feed v1.1 International/.test(x.name)&&x.active===true);
if(live.length!==1)throw Error("Live WF03 unavailable");
const wf=await req("GET","/workflows/"+live[0].id);
const original=wf.nodes.find(x=>x.name==="ElevenLabs | Start WhatsApp Outbound");
if(!original?.credentials)throw Error("ElevenLabs credential missing");
const route="milhano-ai-main-audit-"+randomBytes(12).toString("hex");
const check={id:randomUUID(),name:"Audit | Authorize",type:"n8n-nodes-base.code",typeVersion:2,position:[100,80],
 parameters:{jsCode:'const headers=$input.first().json.headers??{};if(String(headers["x-milhano-audit"])!=="'+token+'")throw new Error("ACCESS_DENIED");return [{json:{ok:true}}];'}};
const hook={id:randomUUID(),name:"Audit | Webhook",type:"n8n-nodes-base.webhook",typeVersion:2.1,position:[-100,80],
 webhookId:randomUUID(),parameters:{httpMethod:"POST",path:route,responseMode:"responseNode",options:{}}};
const http=JSON.parse(JSON.stringify(original));http.id=randomUUID();http.name="Audit | Get Main Agent";http.position=[300,80];
http.parameters.method="GET";http.parameters.url="https://api.elevenlabs.io/v1/convai/agents/agent_6401m3yvs1rcfbya7hk1qb2bxp8v";
http.parameters.sendBody=false;delete http.parameters.jsonBody;delete http.parameters.specifyBody;
const safe={id:randomUUID(),name:"Audit | Safe Output",type:"n8n-nodes-base.code",typeVersion:2,position:[500,80],
 parameters:{jsCode:'const d=$input.first().json;return [{json:{agent_id:d.agent_id,main_branch_id:d.main_branch_id??null,active_branch_id:d.branch_id??null,version_id:d.version_id??null}}];'}};
const reply={id:randomUUID(),name:"Audit | Respond",type:"n8n-nodes-base.respondToWebhook",typeVersion:1.4,position:[700,80],
 parameters:{respondWith:"json",responseBody:"={{ $json }}",options:{}}};
const nodes=[hook,check,http,safe,reply],connections={};
for(let i=0;i<nodes.length-1;i++)connections[nodes[i].name]={main:[[{node:nodes[i+1].name,type:"main",index:0}]]};
const created=await req("POST","/workflows",{name:"MILHANO | Sofia | TEMP Read Main Branch",nodes,connections,settings:{executionOrder:"v1"}});
id=created.id;
await req("POST","/workflows/"+id+"/publish",{});
await new Promise(r=>setTimeout(r,1000));
const res=await fetch(ORIGIN+"/webhook/"+route,{method:"POST",headers:{"x-milhano-audit":token,"Content-Type":"application/json"},body:"{}",signal:AbortSignal.timeout(30000)});
if(!res.ok)throw Error("Read only branch audit HTTP "+res.status);
const d=await res.json();
if(d.agent_id!=="agent_6401m3yvs1rcfbya7hk1qb2bxp8v"||!d.main_branch_id)throw Error("Agent main branch ID not verifiable.");
console.log("Sofia main branch verified:",JSON.stringify(d));
}catch(e){console.error("Sofia branch audit failed:",String(e.message).slice(0,190));process.exitCode=1;}
finally{if(id){try{await req("POST","/workflows/"+id+"/unpublish",{});console.log("Temporary agent audit unpublished");}catch(e){console.error("Temporary audit unpublish needs manual check.");process.exitCode=1;}}}
