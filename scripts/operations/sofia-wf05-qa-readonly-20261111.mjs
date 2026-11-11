// One-time read-only WF05 investigation. Never print PII, API keys, tokens or payload bodies.
const key=process.env.N8N_API_KEY;
if(!key)throw Error("MISSING_N8N_READ_KEY");
const base="https://collectacademy.app.n8n.cloud/api/v1";
async function get(path){const r=await fetch(base+path,{headers:{"X-N8N-API-KEY":key},signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error("N8N_HTTP_"+r.status);return r.json();}
const wf=await get("/workflows/XRQCfu656gk98RWp");
const names=["Prepare | Stage Decision Audit","Supabase | Runtime Stage Gate","Safety Gate | Stage Writes Controlled","Guard | Compare-And-Apply","Supabase | Evaluate Exclusive Stage"];
console.log("WF05_STATUS",JSON.stringify({id:wf.id,name:wf.name,active:wf.active,versionId:wf.versionId,nodeCount:wf.nodes?.length}));
for(const name of names){const node=wf.nodes?.find(n=>n.name===name);console.log("WF05_NODE",JSON.stringify({name,present:!!node,code:node?.type?.includes("code")?node.parameters?.jsCode:null,postBody:node?.parameters?.jsonBody??null,method:node?.parameters?.method??null}));}
const runs=await get("/executions?workflowId=XRQCfu656gk98RWp&limit=30");
console.log("WF05_EXECUTIONS",JSON.stringify((runs.data??[]).slice(0,10).map(x=>({id:x.id,status:x.status,startedAt:x.startedAt}))));
for(const run of (runs.data??[]).slice(0,8)){
 const detail=await get("/executions/"+run.id+"?includeData=true"),steps=detail.data?.resultData?.runData??{};
 function vals(name){return (steps[name]??[]).flatMap(s=>(s.data?.main??[]).flatMap(a=>(a??[]).map(x=>x.json??{})));}
 const stage=vals("Prepare | Stage Decision Audit"),gate=vals("Safety Gate | Stage Writes Controlled"),ctrl=vals("Supabase | Runtime Stage Gate"),evals=vals("Supabase | Evaluate Exclusive Stage");
 const errors=Object.entries(steps).filter(([n,ar])=>ar.some(e=>e.error)).map(([n])=>n);
 console.log("WF05_RUN",JSON.stringify({id:run.id,status:run.status,errors,
  stage:stage.map(x=>({decision:x.decision?.action??x.decision,identity_verified:x.identity_verified,note_verified:x.note_verified,reason:x.decision_reason??x.reason})),
  runtime:ctrl.map(x=>({stage_writes_enabled:x.stage_writes_enabled})),
  gateCount:gate.length,
  evalCount:evals.length,
  lastNodes:Object.entries(steps).slice(-5).map(([n])=>n)}));
}
