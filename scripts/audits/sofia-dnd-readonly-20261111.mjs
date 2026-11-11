// Read-only forensic audit for WF06. Never writes to n8n, GHL or Supabase.
// Logs only booleans, object keys, aggregate counts and n8n execution IDs.
const API="https://collectacademy.app.n8n.cloud/api/v1";
const key=process.env.N8N_API_KEY;
if (!key || process.env.GITHUB_REPOSITORY!=="Collect-academy/milhano-admissions-live") throw Error("Missing audit credential or incorrect repository");
async function get(path){
 const response=await fetch(API+path,{headers:{"X-N8N-API-KEY":key,"Accept":"application/json"},signal:AbortSignal.timeout(25000)});
 if(!response.ok)throw Error("READ_ONLY_N8N_HTTP_"+response.status+"_"+path.split("?")[0]);
 return response.json();
}
function countBy(values){
 const counts={};for(const v of values){const k=typeof v==="undefined"?"undefined":v===null?"null":typeof v==="boolean"?String(v):typeof v==="string"?"string:"+v:typeof v;
 counts[k]=(counts[k]??0)+1;}return counts;
}
function items(runData,name){
 return (runData[name]??[]).flatMap(step=>(step.data?.main??[]).flatMap(group=>(group??[]).map(item=>item.json??{})));
}
function details(raw){
 const wrap=(raw.contact&&typeof raw.contact==="object")?"contact": "root";
 const ct=wrap==="contact"?raw.contact:raw;
 return {wrap,topKeys:Object.keys(raw).sort().join(","),contactKeys:Object.keys(ct).sort().join(","),
  rawDnd:ct.dnd,dndPresent:Object.prototype.hasOwnProperty.call(ct,"dnd"),
  dndValueType:typeof ct.dnd,dndSettings:ct.dndSettings,
  callStatus:ct.dndSettings?.call?.status,waStatus:ct.dndSettings?.whatsApp?.status??ct.dndSettings?.whatsapp?.status,
  isGhlError:Boolean(raw.error||Number(raw.statusCode)>=400),
  isMatch:Boolean(ct.id)};
}
let workflows=[],cursor=null;
for(let i=0;i<6;i++){const page=await get("/workflows?limit=250"+(cursor?"&cursor="+encodeURIComponent(cursor):""));workflows.push(...(page.data??[]));cursor=page.nextCursor;if(!cursor)break;}
const names=workflows.filter(w=>/06 Campaign Scheduler/.test(w.name??""));
console.log("WF06_CANDIDATES",JSON.stringify(names.map(w=>({id:w.id,name:w.name,active:w.active}))));
const wf=names.find(w=>w.active===true);
if(!wf)throw Error("WF06 live workflow not located");
const active=await get("/workflows/"+wf.id);
const verifier=active.nodes?.find(n=>n.name==="Verify | Live GHL Eligibility");
console.log("VERIFIER_CODE",JSON.stringify({hasDndStrictFalse:verifier?.parameters?.jsCode?.includes("ct.dnd!==false"), codeLength:verifier?.parameters?.jsCode?.length}));
const runs=await get("/executions?workflowId="+encodeURIComponent(wf.id)+"&limit=100");
const windowStart=Date.parse("2026-11-11T14:49:00Z"),windowEnd=Date.parse("2026-11-11T14:56:00Z");
const matched=(runs.data??[]).filter(r=>{
 const t=Date.parse(r.startedAt??r.createdAt??0);
 return t>=windowStart&&t<=windowEnd;
});
console.log("WF06_RECENT_RUN_COUNT",runs.data?.length??0,"TARGET_EXECUTIONS",JSON.stringify(matched.map(r=>({id:r.id,status:r.status,startedAt:r.startedAt}))));
const observations=[],checks=[],opps=[];
for(const run of matched){
 const full=await get("/executions/"+run.id+"?includeData=true");
 const data=full.data?.resultData?.runData??{};
 const contacts=items(data,"GHL | Recheck Contact");
 const verified=items(data,"Verify | Live GHL Eligibility");
 const opportunities=items(data,"GHL | Recheck Opportunity");
 const nodeErrors=Object.entries(data).filter(([name,entries])=>entries.some(x=>Boolean(x.error))).map(x=>x[0]);
 console.log("RUN",run.id,"COUNTS",JSON.stringify({contacts:contacts.length,verified:verified.length,opportunities:opportunities.length,nodeErrors}));
 observations.push(...contacts.map(details));
 checks.push(...verified.map(j=>({eligible:j.eligible,reason:j.reason??null})));
 opps.push(...opportunities.map(o=>({shape:o.opportunity?"opportunity":"root",hasPipeline:Boolean((o.opportunity??o).pipelineId),keys:Object.keys(o).sort().join(",")})));
}
console.log("CONTACT_RESPONSE_COUNT",observations.length);
console.log("CONTACT_ROOT_SHAPE",JSON.stringify(countBy(observations.map(x=>x.wrap))));
console.log("CONTACT_DND_VALUES",JSON.stringify(countBy(observations.map(x=>x.rawDnd))));
console.log("CONTACT_DND_FIELD_PRESENT",JSON.stringify(countBy(observations.map(x=>x.dndPresent))));
console.log("CONTACT_CALL_DND_STATUS",JSON.stringify(countBy(observations.map(x=>x.callStatus))));
console.log("CONTACT_WHATSAPP_DND_STATUS",JSON.stringify(countBy(observations.map(x=>x.waStatus))));
console.log("CONTACT_GHL_READ_ERRORS",JSON.stringify(countBy(observations.map(x=>x.isGhlError))));
console.log("CONTACT_ID_PRESENT",JSON.stringify(countBy(observations.map(x=>x.isMatch))));
console.log("CONTACT_TOP_KEYS",JSON.stringify([...new Set(observations.map(x=>x.topKeys))]));
console.log("CONTACT_INNER_KEYS",JSON.stringify([...new Set(observations.map(x=>x.contactKeys))]));
console.log("VERIFICATION_REASONS",JSON.stringify(countBy(checks.map(x=>x.reason))));
console.log("OPPORTUNITY_SHAPES",JSON.stringify(countBy(opps.map(x=>x.shape))));
if(observations.length===0) throw Error("NO_MATCHING_EXECUTION_OUTPUT; root cause remains unverified");
