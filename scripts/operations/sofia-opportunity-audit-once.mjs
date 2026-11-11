// One-shot read-only n8n inventory; does not log tokens or workflow bodies.
const token=process.env.N8N_API_KEY;
if(!token||process.env.GITHUB_REPOSITORY!=="Collect-academy/milhano-admissions-live")throw Error("Missing audit token or repository mismatch");
const root="https://collectacademy.app.n8n.cloud/api/v1";
async function read(path){const r=await fetch(root+path,{headers:{"X-N8N-API-KEY":token,Accept:"application/json"},signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error("N8N_READ_FAILED "+r.status);return r.json();}
const list=await read("/workflows?limit=250");
for(const wf of list.data??[]){if(!/^MILHANO \| Sofia \| (0[34567]|BACKUP)/.test(wf.name))continue;
 if(!wf.active||/BACKUP/.test(wf.name))continue;
 const detail=await read("/workflows/"+encodeURIComponent(wf.id));
 const nodes=detail.nodes??[];
 const signature=nodes.filter(n=>/GHL \| Update Opportunity Fields|WF07 \| Forward|WF05 \| Handoff|Supabase \| Close Claim|Commit Outcome|Verify \| Live GHL|Create Call Summary/.test(n.name)).map(n=>n.name);
 const dnd=nodes.find(n=>n.name==="Verify | Live GHL Eligibility")?.parameters?.jsCode??"";
 const tokenOnFeed=nodes.find(n=>n.name==="WF03 | Existing Individual Feed")?.parameters?.headerParameters?.parameters?.some(h=>String(h.name??"").toLowerCase()==="x-milhano-batch-secret");
 const authNodes=nodes.filter(n=>n.name==="ElevenLabs | Check Main Agent"||n.name==="ElevenLabs | Fetch Pending Conversation").map(n=>({name:n.name,creds:n.credentials??{},authentication:n.parameters?.authentication??null,genericAuthType:n.parameters?.genericAuthType??null}));
 console.log("ELEVENLABS_BINDINGS",JSON.stringify({workflow:wf.name,nodes:authNodes}));
 console.log("ACTIVE_WORKFLOW",JSON.stringify({id:wf.id,name:wf.name,active:wf.active,nodes:nodes.length,signature,hasStrictDndFix:dnd.includes("ct.dnd===true"),feedHasBatchKey:Boolean(tokenOnFeed)}));
}


if(process.env.N8N_COMPARE_07==="1"){
 const {readFileSync}=await import("node:fs");
 const wf= (list.data??[]).find(w=>w.name==="MILHANO | Sofia | 07 Post Call + Initiation Failure Reconciliation | WEBHOOK"&&w.active);
 if(!wf)throw Error("Live WF07 unavailable");
 const live=await read("/workflows/"+wf.id);
 const stored=JSON.parse(readFileSync("n8n/IMPORTAR_MILHANO_07_SOFIA_POSTCALL_RETRIES_2026-11-10.json","utf8"));
 const diff=live.nodes.map(n=>{
 const x=stored.nodes.find(i=>i.name===n.name);
 if(!x)return {name:n.name,change:"missing_source"};
 const key=(v)=>JSON.stringify(v??{});return {name:n.name,paramSame:key(n.parameters)===key(x.parameters),typeSame:n.type===x.type,credsLive:Object.keys(n.credentials??{}),credsStored:Object.keys(x.credentials??{})};
 });
 console.log("WF07_SOURCE_COMPARISON",JSON.stringify(diff));
 console.log("WF07_CONNECTION_EQUAL",JSON.stringify(live.connections)===JSON.stringify(stored.connections));
}

if(process.env.N8N_SAFE_PARAMS_07==="1"){
 const wf=(list.data??[]).find(w=>w.name==="MILHANO | Sofia | 07 Post Call + Initiation Failure Reconciliation | WEBHOOK"&&w.active);
 const active=await read("/workflows/"+wf.id);
 const wanted=new Set(["Webhook | Post Call Outcome","ElevenLabs | Check Main Agent","Supabase | Pending Conversations","ElevenLabs | Fetch Pending Conversation"]);
 for(const n of active.nodes??[]){
  if(!wanted.has(n.name))continue;
  const params=structuredClone(n.parameters??{});
  for(const h of params.headerParameters?.parameters??[]){if(/token|key|secret|authorization/i.test(h.name??""))h.value="[REDACTED]";}
  for(const k of ["jsonBody","body","sendBody"]){if(/key|token|secret/i.test(JSON.stringify(params[k]??"")))delete params[k];}
  console.log("WF07_LIVE_SAFE_PARAMS",JSON.stringify({name:n.name,parameters:params,credentials:n.credentials??{}}));
 }
}

if(process.env.N8N_VERIFY_IMPORT_TOKENS==="1"){
 const {createHash}=await import("node:crypto");
 for(const name of ["MILHANO | Sofia | 04 Post Call V2 + WF07 + WF05 Handoff Sequential","MILHANO | Sofia | 06 Campaign Scheduler | WEBHOOK ONLY"]){
  const found=(list.data??[]).find(w=>w.name===name&&w.active);if(!found)throw Error("Missing live workflow "+name);
  const live=await read("/workflows/"+found.id);
  const wanted=name.includes("04 Post Call")?"x-milhano-stage-token":"x-milhano-batch-secret";
  const nodes=name.includes("04 Post Call")?["WF05 | Handoff After Saved Note","WF05 | Handoff Existing Note"]:["WF03 | Existing Individual Feed"];
  const hashes=[];
  for(const nodeName of nodes){const node=live.nodes.find(n=>n.name===nodeName);
  const h=(node?.parameters?.headerParameters?.parameters??[]).find(i=>i.name?.toLowerCase()===wanted);
  if(!h?.value)throw Error("Required live secret missing "+nodeName);
  hashes.push({node:nodeName,hash:createHash("sha256").update(h.value).digest("hex").slice(0,16)});}
  console.log("IMPORT_TOKEN_HASHES",JSON.stringify({name,hashes}));
 }
}
