// Read-only forensic check: production workflows, metadata and provider call states.
// Do not print contact details, phone numbers, recordings, transcripts, raw payloads or secrets.
const N8N=process.env.N8N_API_KEY;
const EL=process.env.ELEVENLABS_API_KEY||process.env.ELEVENLABS_KEY||"";
if(!N8N)throw Error("N8N_KEY_UNAVAILABLE");
const base="https://collectacademy.app.n8n.cloud/api/v1";
async function read(path){
 const res=await fetch(base+path,{headers:{"X-N8N-API-KEY":N8N},signal:AbortSignal.timeout(25000)});
 if(!res.ok)throw Error("N8N_HTTP_"+res.status+" "+path.split("?")[0]);
 return res.json();
}
function items(runData,name){
 return (runData[name]??[]).flatMap(x=>(x.data?.main??[]).flatMap(y=>(y??[]).map(z=>z.json??{})));
}
let workflows=[],cursor;
for(let page=0;page<4;page++){const x=await read("/workflows?limit=250"+(cursor?"&cursor="+encodeURIComponent(cursor):""));workflows.push(...x.data??[]);cursor=x.nextCursor;if(!cursor)break;}
const wf03=workflows.find(x=>x.active&&/MILHANO.*03.*(Feed|Individual)/i.test(x.name));
const others=workflows.filter(x=>x.active&&/MILHANO.*(04 Post Call|07 Post Call)/i.test(x.name));
console.log("WF03_MATCH",JSON.stringify(wf03?{id:wf03.id,name:wf03.name,active:wf03.active}:null));
console.log("POSTCALL_MATCH",JSON.stringify(others.map(x=>({id:x.id,name:x.name}))));
console.log("ELEVEN_API_KEY_AVAILABLE",Boolean(EL));
if(!wf03)throw Error("WF03_NOT_FOUND");
const detail=await read("/workflows/"+wf03.id);
console.log("WF03_NODE_NAMES",JSON.stringify(detail.nodes?.map(n=>n.name)));
const runs=await read("/executions?workflowId="+encodeURIComponent(wf03.id)+"&limit=100");
const periods=[
{label:"09:48",start:Date.parse("2026-11-11T15:48:00Z"),end:Date.parse("2026-11-11T15:52:00Z")},
{label:"11:45",start:Date.parse("2026-11-11T17:45:00Z"),end:Date.parse("2026-11-11T17:50:00Z")},
{label:"12:03",start:Date.parse("2026-11-11T18:03:00Z"),end:Date.parse("2026-11-11T18:08:00Z")},
{label:"13:20",start:Date.parse("2026-11-11T19:20:00Z"),end:Date.parse("2026-11-11T19:26:00Z")}
];
const selected={};for(const p of periods)selected[p.label]=[];
const events=[];
for(const run of runs.data??[]){
 const t=Date.parse(run.startedAt??run.createdAt??0);
 const p=periods.find(p=>t>=p.start&&t<p.end);
 if(!p||selected[p.label].length>=4)continue;
 const full=await read("/executions/"+run.id+"?includeData=true");
 const rd=full.data?.resultData?.runData??{};
 const output=[];
 for(const [nodeName] of Object.entries(rd)){
  if(!/Eleven|Outbound|WhatsApp|Initiat|Submit/.test(nodeName))continue;
  for(const o of items(rd,nodeName)){
   const d=o.result??o.webhook_response??o.data??o;
   if(typeof d.conversation_id==="string"&&d.conversation_id.startsWith("conv_"))output.push({id:d.conversation_id,nodeName,status:d.status??null,success:d.success??null,message:d.message??null});
  }
 }
 const usable=output.find(o=>o.id);
 selected[p.label].push({id:usable?.id??null,success:usable?.success??null,runStatus:run.status,nodes:output.length});
}
console.log("WF03_EXAMPLES",JSON.stringify(Object.entries(selected).map(([period,runs])=>({period,count:runs.length,providerIds:runs.filter(r=>r.id).length,success:runs.filter(r=>r.success===true).length,runStatuses:runs.map(r=>r.runStatus)}))));
if(!EL){console.log("PROVIDER_READ_SKIPPED_NO_KEY");exit();}
async function readEl(id){
 const url="https://api.elevenlabs.io/v1/convai/conversations/"+encodeURIComponent(id);
 const r=await fetch(url,{headers:{"xi-api-key":EL,"Accept":"application/json"},signal:AbortSignal.timeout(25000)});
 if(!r.ok)return {http:r.status};
 const x=await r.json(),m=x.metadata??{};
 const summary={http:200,status:x.status??null,branch:x.branch_id??null,
  termination_reason:String(m.termination_reason??x.termination_reason??"").slice(0,130)||null,
  phone_call_status:String(m.phone_call_status??m.call_status??"").slice(0,80)||null,
  start:m.start_time_unix_secs??null,end:m.end_time_unix_secs??null,
  duration:m.call_duration_secs??null,transcriptMessages:Array.isArray(x.transcript)?x.transcript.length:null,
  errors:x.error?.code??x.analysis?.errors??null
 };
 return summary;
}
for(const [period,runs] of Object.entries(selected)){
 for(const item of runs.filter(r=>r.id)){
  const status=await readEl(item.id);
  console.log("EL_PROBE",JSON.stringify({period,...status}));
 }
}
