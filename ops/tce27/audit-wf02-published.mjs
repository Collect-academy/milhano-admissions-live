const KEY=process.env.N8N_API_KEY;
if(!KEY)throw Error("Missing N8N_API_KEY");
const B='https://collectacademy.app.n8n.cloud/api/v1';
async function get(path){
 const r=await fetch(B+path,{headers:{'X-N8N-API-KEY':KEY,Accept:'application/json'}});
 const txt=await r.text();let j;try{j=JSON.parse(txt)}catch{j={message:txt.slice(0,100)}}
 if(!r.ok)throw Error('n8n API '+r.status+' '+path+' '+JSON.stringify(j).slice(0,200));
 return j;
}
const list=await get('/workflows?limit=250');
const found=(list.data||[]).filter(x=>String(x.name||'').includes('TCE27')&&String(x.name||'').includes('Public Capture'));
if(!found.length)console.log('WF02_NONE_FOUND');
for(const x of found){
 const wf=await get('/workflows/'+x.id);
 const hooks=(wf.nodes||[]).filter(n=>n.type?.endsWith('.webhook')).map(n=>({path:n.parameters?.path,responseMode:n.parameters?.responseMode}));
 const xs=await get('/executions?workflowId='+x.id+'&limit=10');
 const ex=(xs.data||[]).map(e=>({id:e.id,status:e.status,startedAt:e.startedAt,stoppedAt:e.stoppedAt}));
 console.log('WF02_READ_ONLY '+JSON.stringify({name:x.name,id:x.id,active:wf.active,archived:wf.isArchived,webhooks:hooks,lastTen:ex}));
}
