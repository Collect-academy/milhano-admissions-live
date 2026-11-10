const API="https://collectacademy.app.n8n.cloud/api/v1",KEY=process.env.N8N_API_KEY;
if(!KEY||process.env.GITHUB_REPOSITORY!=="Collect-academy/milhano-admissions-live")
 throw Error("Missing authorized runtime context");
async function get(path){
 const r=await fetch(API+path,{headers:{"X-N8N-API-KEY":KEY,"Accept":"application/json"},signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw Error("API status "+r.status+" for "+path.split("?")[0]);
 return r.json();
}
let all=[],cursor;
for(let i=0;i<10;i++){
 const data=await get("/workflows?limit=250"+(cursor?"&cursor="+encodeURIComponent(cursor):""));
 all.push(...data.data);if(!data.nextCursor)break;cursor=data.nextCursor;
}
for(const mark of ["03 Individual Feed v1.1 International","06 Campaign Scheduler | PROTECTED","07 Conversation Reconciliation | SAFE DRAFT"]){
 const list=all.filter(w=>String(w.name??"").includes(mark));
 if(list.length!==1)throw Error("Workflow inventory ambiguous: "+mark);
 const w=list[0];console.log("WORKFLOW",mark,"ACTIVE",w.active);
 if(!w.active)process.exitCode=1;
 try{
  const executions=await get("/executions?workflowId="+w.id+"&limit=5");
  for(const e of executions.data??[]){
   const recent=Date.parse(e.startedAt??e.createdAt??0);
   if(Date.now()-recent>30*60_000)continue;
   console.log("EXECUTION",mark,e.id,e.status,"started",e.startedAt??"unknown");
   if(mark.includes("07 Conversation")&&e.status==="success"&&e.id===(executions.data??[])[0]?.id){
    try{
      const detail=await get("/executions/"+e.id+"?includeData=true");
      const runData=detail.data?.resultData?.runData??{};
      for(const [name,entries] of Object.entries(runData)){
        const count=entries.reduce((n,r)=>n+(r.data?.main??[]).reduce((sum,group)=>sum+(group?.length??0),0),0);
        console.log("NODE_COUNTS",name,count,"error",entries.some(r=>Boolean(r.error)));
      }
    }catch(error){console.log("NODE_AUDIT_UNAVAILABLE",String(error.message).slice(0,100));}
   }
   if(e.status==="error"){
    const detail=await get("/executions/"+e.id+"?includeData=true");
    const result=detail.data?.resultData??{},failure=result.error??{};
    const lastNode=result.lastNodeExecuted??failure.node?.name??"unknown";
    console.log("EXECUTION_ERROR_NODE",mark,lastNode,"type",failure.name??"unknown");
    process.exitCode=1;
   }
  }
 }catch(e){console.log("EXECUTION_AUDIT_UNAVAILABLE",mark,String(e.message).slice(0,100));process.exitCode=1}
}
