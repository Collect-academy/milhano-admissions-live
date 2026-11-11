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
