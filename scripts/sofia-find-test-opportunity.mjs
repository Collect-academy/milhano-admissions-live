import {randomBytes,randomUUID} from "node:crypto";
const ORIGIN="https://collectacademy.app.n8n.cloud",API=ORIGIN+"/api/v1";
const KEY=process.env.N8N_API_KEY;
if(!KEY||process.env.GITHUB_REPOSITORY!=="Collect-academy/milhano-admissions-live")throw Error("Unauthorized read-only audit.");
async function api(method,path,body){
 const r=await fetch(API+path,{method,headers:{"X-N8N-API-KEY":KEY,Accept:"application/json","Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(25000)});
 if(!r.ok)throw Error("n8n "+method+" "+path.split("?")[0]+" HTTP "+r.status);
 return r.json();
}
const list=(await api("GET","/workflows?limit=250")).data??[];
const source=list.filter(x=>/03 Individual Feed v1.1 International/.test(x.name)&&x.active===true);
if(source.length!==1)throw Error("Cannot confirm active WF03.");
const original=await api("GET","/workflows/"+encodeURIComponent(source[0].id));
const templ=original.nodes.find(x=>x.name==="GHL | Get Opportunity");
if(!templ?.credentials)throw Error("GHL credential unavailable.");
let id=null;
const token=randomBytes(30).toString("hex"),route="milhano-readonly-opp-audit-"+randomBytes(10).toString("hex");
const code=(name,js,index)=>({id:randomUUID(),name,type:"n8n-nodes-base.code",typeVersion:2,position:[-800+index*250,0],parameters:{jsCode:js}});
const http=(name,q,index)=>{
 const n=structuredClone(templ);n.id=randomUUID();n.name=name;n.position=[-800+index*250,0];n.parameters.method="GET";
 n.parameters.url="https://services.leadconnectorhq.com/opportunities/search?locationId=ZzRtp9n8n76ARy99VzJc&pipelineId=GYqHbZyWUxxc3K03efVT&status=open&limit=50&q="+encodeURIComponent(q);
 n.parameters.sendHeaders=true;n.parameters.headerParameters={parameters:[{name:"Version",value:"v3"},{name:"Accept",value:"application/json"}]};
 delete n.parameters.sendBody;delete n.parameters.jsonBody;delete n.parameters.specifyBody;return n;
};
const nodes=[
 {id:randomUUID(),name:"Audit | Webhook",type:"n8n-nodes-base.webhook",typeVersion:2.1,webhookId:randomUUID(),position:[-1050,0],parameters:{httpMethod:"POST",path:route,responseMode:"responseNode",options:{}}},
 code("Audit | Token",'const h=$input.first().json.headers??{};if(String(h["x-milhano-audit"]??"")!=="'+token+'")throw Error("UNAUTHORIZED");return [{json:{ok:true}}];',1),
 http("GHL | Search Manquito","manquito",2),
 http("GHL | Search Testing","testing",3),
 code("Audit | Safe Selection",'const a=[$("GHL | Search Manquito").first().json,$("GHL | Search Testing").first().json];const seen=new Set();const out=a.flatMap(x=>x.opportunities??[]).filter(x=>{if(!x.id||seen.has(x.id))return false;seen.add(x.id);return true}).filter(x=>String(x.name??"").toLowerCase().includes("manquito")||String(x.name??"").toLowerCase().includes("testing")).map(x=>({id:x.id,name:x.name,contactId:x.contactId,pipelineId:x.pipelineId,pipelineStageId:x.pipelineStageId,status:x.status,createdAt:x.createdAt,updatedAt:x.updatedAt}));return [{json:{found:out.length,opportunities:out}}];',4),
 {id:randomUUID(),name:"Audit | Reply",type:"n8n-nodes-base.respondToWebhook",typeVersion:1.4,position:[540,0],parameters:{respondWith:"json",responseBody:"={{ $json }}",options:{}}}
];
const connections={};for(let i=0;i<nodes.length-1;i++)connections[nodes[i].name]={main:[[{node:nodes[i+1].name,type:"main",index:0}]]};
try{
 const created=await api("POST","/workflows",{name:"MILHANO | TEMP GHL Opportunity Search READ ONLY",nodes,connections,settings:{executionOrder:"v1"}});
 id=created.id;if(!id)throw Error("No temporary workflow ID.");
 await api("POST","/workflows/"+id+"/publish",{});
 await new Promise(r=>setTimeout(r,1500));
 const res=await fetch(ORIGIN+"/webhook/"+route,{method:"POST",headers:{"Content-Type":"application/json","x-milhano-audit":token},body:"{}",signal:AbortSignal.timeout(40000)});
 if(!res.ok)throw Error("Search webhook HTTP "+res.status);
 console.log("GHL_NEW_LEAD_MATCHES="+JSON.stringify(await res.json()));
}catch(error){console.error("GHL read-only audit failed:",error?.message);process.exitCode=1;}
finally{if(id){try{await api("POST","/workflows/"+id+"/unpublish",{});console.log("Temporary workflow unpublished");}catch(e){console.error("WARNING: temporary unpublish uncertain:",e.message);process.exitCode=1;}}}
