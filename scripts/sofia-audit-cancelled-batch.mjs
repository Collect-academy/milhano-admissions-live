const API="https://collectacademy.app.n8n.cloud/api/v1",KEY=process.env.N8N_API_KEY;
if(!KEY||process.env.GITHUB_REPOSITORY!=="Collect-academy/milhano-admissions-live")throw Error("Invalid audit context");
async function api(method,path,body){
 const response=await fetch(API+path,{method,headers:{"X-N8N-API-KEY":KEY,"Accept":"application/json","Content-Type":"application/json"},
 ...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error("n8n API "+method+" failed HTTP "+response.status);
 return response.json();
}
const list=[];let cursor=null;
for(let i=0;i<10;i++){const result=await api("GET","/workflows?limit=250"+(cursor?"&cursor="+encodeURIComponent(cursor):""));list.push(...result.data);if(!result.nextCursor)break;cursor=result.nextCursor;}
for(const marker of ["03 Individual Feed v1.1 International","04 Post Call + Supabase AI Insights","05 Stage Decision Engine V1","07 Conversation Reconciliation","08 One Shot Authorizations"]){
 const found=list.filter(w=>String(w.name??"").includes(marker));
 console.log("WORKFLOW_STATUS="+JSON.stringify({marker,found:found.length,items:found.map(w=>({name:w.name,active:w.active}))}));
}
const target=list.filter(w=>w.name==="MILHANO | Sofia | 08 One Shot Authorizations | 10 NOV 08:00 MERIDA");
if(target.length!==1)throw Error("Cannot uniquely identify cancelled batch workflow.");
if(target[0].active===true){
 await api("POST","/workflows/"+encodeURIComponent(target[0].id)+"/unpublish",{});
 console.log("CANCELLED_BATCH_UNPUBLISH_REQUESTED=true");
}
const verify=await api("GET","/workflows/"+encodeURIComponent(target[0].id));
if(verify.active!==false)throw Error("Cancelled batch still active!");
console.log("CANCELLED_BATCH_CONFIRMED_INACTIVE=true");
