import {readFileSync} from "node:fs";
import {gunzipSync} from "node:zlib";
const id="L8GWSUQP7DK90Ad0";
const origin="https://collectacademy.app.n8n.cloud/api/v1";
const key=process.env.N8N_API_KEY;
if(!key)throw Error("Missing existing N8N_API_KEY");
const packed=readFileSync("ops/tce27/collect-wf02.json.gz.b64","utf8").trim();
const base=JSON.parse(gunzipSync(Buffer.from(packed,"base64")).toString("utf8"));
const names=base.nodes.map(n=>n.name);
function ensure(ok,msg){if(!ok)throw Error(msg);}
async function api(method,path,body){
 const response=await fetch(origin+path,{method,headers:{"X-N8N-API-KEY":key,"Accept":"application/json",...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const txt=await response.text();let data={};
 try{data=JSON.parse(txt)}catch{data={detail:"Invalid JSON"}}
 if(!response.ok)throw Error(method+" "+path+" HTTP "+response.status+" "+JSON.stringify(data).slice(0,350));
 return data;
}
const live=await api("GET","/workflows/"+id);
ensure(live.id===id && live.name===base.name && live.active===true,"Identity mismatch / inactive target");
ensure(live.nodes.length===base.nodes.length || live.nodes.length===base.nodes.length-1,"Unexpected node count");
ensure(live.nodes.every(n=>names.includes(n.name)),"Unexpected foreign node");
ensure(live.nodes.find(n=>n.name==="Webhook | TCE27 Public Capture").parameters.path==="tce27-public-miniform-v1","Webhook mismatch");
ensure(live.nodes.filter(n=>n.credentials).every(n=>Object.values(n.credentials).every(c=>c.id==="xdPGXIbW6yrWua0s")),"Foreign GHL credential");
const already=!live.nodes.some(n=>n.name==="GHL | Add Tag");
if(already){console.log("ALREADY_UPDATED",JSON.stringify({id,active:live.active}));process.exit(0)}
ensure(live.nodes.find(n=>n.name==="Code | Normalize & Config").parameters.jsCode===base.nodes.find(n=>n.name==="Code | Normalize & Config").parameters.jsCode,"Unexpected live config drift");
const next=structuredClone(base);
next.nodes=next.nodes.filter(n=>n.name!=="GHL | Add Tag");
next.connections["GHL | Upsert Contact"].main[0][0].node="GHL | Search Opportunity";
delete next.connections["GHL | Add Tag"];
const normal=next.nodes.find(n=>n.name==="Code | Normalize & Config");
let js=normal.parameters.jsCode;
const oldTag=" tag:funnel==='retreat'?'tce27_retreat_public_lead':'tce27_webinar_registered',\n";
ensure(js.includes(oldTag),"Legacy tag mapping missing");
js=js.replace(oldTag,"");
const pattern=/const short=v=>[^\n]+\nconst opportunityName=[^\n]+;/;
ensure(pattern.test(js),"Legacy opportunity title mapping missing");
const title=[
"// La oportunidad es la fuente de entrada a las comms. NO se crean tags.",
"// Priorizamos IDs precisos de Meta Ads; tracking completo en la nota de GHL.",
"const short=(v,max)=>String(v||'-').replace(/[|\\n\\r]/g,' ').slice(0,max);",
"const bits=[funnel==='retreat'?'TCE27':'WEBINAR MX 2026',",
" 'CID='+short(attr.campaign_id||attr.utm_campaign_id,40),",
" 'ASID='+short(attr.adset_id||attr.utm_adset_id,40),",
" 'ADID='+short(attr.ad_id||attr.utm_ad_id,40),",
" 'S='+short(attr.utm_source,22),",
" 'M='+short(attr.utm_medium,15),",
" 'C='+short(attr.utm_campaign||attr.campaign_name,40),",
" 'CTA='+short(attr.cta_position,20),",
" 'N='+short(name,42)];",
"let opportunityName=bits.join(' | ');",
"if(opportunityName.length>250){",
" // Mantener IDs y nombre; comprimir campos descriptivos si es preciso.",
" bits[6]='C='+short(attr.utm_campaign||attr.campaign_name,12);",
" bits[7]='CTA='+short(attr.cta_position,12);",
" bits[8]='N='+short(name,28);",
" opportunityName=bits.join(' | ').slice(0,250);",
"}"
].join("\n");
js=js.replace(pattern,title);
normal.parameters.jsCode=js;
next.nodes.find(n=>n.name==="GHL | Attribution Note").onError="continueRegularOutput";
for(const n of next.nodes.filter(n=>n.type==="n8n-nodes-base.code"))new Function(n.parameters.jsCode);
ensure(!JSON.stringify(next).includes("tce27_retreat_public_lead"),"Tag remains");
ensure(next.nodes.filter(n=>n.credentials).length===4,"Credential node mismatch");
ensure(js.includes("ojR4ZB7H3KiuY5kESilq") && js.includes("Lp51AslVPg5iqVnBBGTa") && js.includes("0af21d93-2c84-4154-a166-cd59117511ec"),"Collect IDs mismatch");
console.log("PREFLIGHT_OK",JSON.stringify({id,tag_removed:true,credential:"Collect GHL API",other_workflows_modified:0}));
const payload={name:next.name,nodes:next.nodes,connections:next.connections,settings:next.settings};
await api("PUT","/workflows/"+id,payload);
await api("POST","/workflows/"+id+"/publish");
const check=await api("GET","/workflows/"+id);
ensure(check.active===true && check.nodes.length===next.nodes.length,"Saved workflow not active");
ensure(!check.nodes.some(n=>n.name==="GHL | Add Tag"),"Tag step still exists after publishing");
ensure(check.nodes.find(n=>n.name==="Code | Normalize & Config").parameters.jsCode===js,"Unexpected persisted code");
console.log("UPDATED_AND_PUBLISHED",JSON.stringify({id,active:true,nodes:check.nodes.length,tag_removed:true,trigger_in_ghl:"Opportunity Created",other_workflows_modified:0}));
