// One-shot no-write verification of active School Tour tool. Avoid contact names and IDs.
const key=process.env.N8N_API_KEY;if(!key)throw Error("N8N_API_KEY_MISSING");
const b="https://collectacademy.app.n8n.cloud/api/v1";
async function get(p){const r=await fetch(b+p,{headers:{"X-N8N-API-KEY":key},signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error("N8N_HTTP_"+r.status);return r.json();}
const wf=await get("/workflows/UAelC9gvToYMLFd3");
console.log("TOOL02_STATUS",JSON.stringify({id:wf.id,name:wf.name,active:wf.active,nodes:wf.nodes?.length,versionId:wf.versionId}));
for(const name of ["Normalize | Booking","Validate | TEST Opportunity","Resolve | ST Opportunity","Normalize | ST Profile"]){
 const n=wf.nodes.find(n=>n.name===name);
 const code=n?.parameters?.jsCode??"";
 console.log("TOOL02_POLICY",JSON.stringify({node:name,exists:!!n,hasTestPipeline:code.includes("V9W73rNXYhGVYbp1HZV8"),
 hasSetterPipeline:code.includes("GYqHbZyWUxxc3K03efVT"),onlyTestError:code.includes("no open TEST opportunity"),usesSearchByContact:code.includes("contact_search")}));
}
const runs=await get("/executions?workflowId=UAelC9gvToYMLFd3&limit=75");
const last=(runs.data??[]).slice(0,75);
console.log("TOOL02_EXEC_COUNT",last.length);
let booked=0,attempted=0,failed=0,profile=0,availability=0;
const examples=[];
for(const x of last){
 const full=await get("/executions/"+x.id+"?includeData=true");
 const rd=full.data?.resultData?.runData??{};
 const names=Object.keys(rd);
 const isBook=names.includes("Webhook | Book School Tour"),isProfile=names.includes("Webhook | Save School Tour Profile"),isAvailability=names.includes("Webhook | Check Availability");
 if(isBook){attempted++;if(names.includes("Finalize | Booking Success"))booked++;if(names.includes("Respond | Booking Failed Safely"))failed++;}
 if(isProfile)profile++;if(isAvailability)availability++;
 const errors=Object.entries(rd).filter(([n,a])=>a.some(t=>t.error)).map(([n])=>n);
 if(isBook&&examples.length<12)examples.push({executionId:x.id,status:x.status,startedAt:x.startedAt,
  validatedTestOpp:names.includes("Validate | TEST Opportunity"),created:names.includes("GHL | Create School Tour"),
  completed:names.includes("Finalize | Booking Success"),failed:names.includes("Respond | Booking Failed Safely"),errors,
  lastNodes:names.slice(-3)});
}
console.log("TOOL02_OBSERVED",JSON.stringify({attempted,booked,failed,profile,availability,examples}));
