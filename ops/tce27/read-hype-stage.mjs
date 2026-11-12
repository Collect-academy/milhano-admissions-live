import {randomBytes,randomUUID} from 'node:crypto';
const KEY=process.env.N8N_API_KEY,HOST='https://collectacademy.app.n8n.cloud',API=HOST+'/api/v1';
const PIPELINE='Lp51AslVPg5iqVnBBGTa',LOCATION='ojR4ZB7H3KiuY5kESilq',nonce=randomBytes(20).toString('hex'),path='tce27-read-stage-'+randomBytes(16).toString('hex');
if(!KEY)throw Error('Missing N8N_API_KEY');
const conn=dest=>({main:[[{node:dest,type:'main',index:0}]]});
const nodes=[
{id:'1',name:'Webhook | Check Stage',type:'n8n-nodes-base.webhook',typeVersion:2,position:[200,300],webhookId:randomUUID(),parameters:{httpMethod:'POST',path,responseMode:'responseNode',options:{}}},
{id:'2',name:'Code | Verify',type:'n8n-nodes-base.code',typeVersion:2,position:[450,300],parameters:{mode:'runOnceForAllItems',jsCode:"const b=$input.first().json.body||{};if(b.key!=="+JSON.stringify(nonce)+")throw Error('Unauthorized');return [{json:{ok:true}}];"}},
{id:'3',name:'GHL | Read Pipeline',type:'n8n-nodes-base.httpRequest',typeVersion:4.2,position:[700,300],parameters:{method:'GET',url:'https://services.leadconnectorhq.com/opportunities/pipelines/'+PIPELINE,authentication:'genericCredentialType',genericAuthType:'httpHeaderAuth',sendHeaders:true,headerParameters:{parameters:[{name:'Version',value:'v3'},{name:'Accept',value:'application/json'}]},options:{timeout:18000}},credentials:{httpHeaderAuth:{id:'xdPGXIbW6yrWua0s',name:'Collect GHL API'}}},
{id:'4',name:'Code | Select Stage',type:'n8n-nodes-base.code',typeVersion:2,position:[950,300],parameters:{mode:'runOnceForAllItems',jsCode:"const o=$input.first().json;const p=o.pipeline||o;const id=p.id||p.pipelineId;if(id!=="+JSON.stringify(PIPELINE)+")throw Error('Incorrect GHL pipeline ID');if(p.locationId&&p.locationId!=="+JSON.stringify(LOCATION)+")throw Error('Incorrect GHL location');if(!Array.isArray(p.stages))throw Error('Pipeline has no stages array');const matches=p.stages.filter(x=>String(x.name||'').trim().toLowerCase()==='hype sequence');if(matches.length!==1)throw Error('Expected exactly one hype sequence stage; found '+matches.length);return [{json:{ok:true,pipelineId:id,pipelineName:p.name,locationId:p.locationId||null,hypeStageId:matches[0].id,hypeStageName:matches[0].name,stages:p.stages.map(x=>({id:x.id,name:x.name})),readOnly:true}}];"}},
{id:'5',name:'Respond | Data',type:'n8n-nodes-base.respondToWebhook',typeVersion:1.1,position:[1200,300],parameters:{respondWith:'json',responseBody:'={{ JSON.stringify($json) }}',options:{}}}
];
const wf={name:'TCE27 | Read Stage ID One-Time',nodes,settings:{executionOrder:'v1'},connections:{'Webhook | Check Stage':conn('Code | Verify'),'Code | Verify':conn('GHL | Read Pipeline'),'GHL | Read Pipeline':conn('Code | Select Stage'),'Code | Select Stage':conn('Respond | Data')}};
async function api(method,route,data){const r=await fetch(API+route,{method,headers:{'X-N8N-API-KEY':KEY,Accept:'application/json',...(data?{'Content-Type':'application/json'}:{})},...(data?{body:JSON.stringify(data)}:{})});const raw=await r.text();let j;try{j=JSON.parse(raw)}catch{j={raw:raw.slice(0,250)}}if(!r.ok)throw Error(method+' '+route+' HTTP '+r.status+' '+JSON.stringify(j).slice(0,300));return j}
let id,active=false;
try{
 const w=await api('POST','/workflows',wf);id=w.id;if(!id)throw Error('No temp workflow id');
 await api('POST','/workflows/'+id+'/publish');active=true;
 await new Promise(r=>setTimeout(r,1800));
 let result=null;
 for(let i=0;i<5;i++){
  const r=await fetch(HOST+'/webhook/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:nonce})});
  const s=await r.text();if(r.status===404&&i<4){await new Promise(x=>setTimeout(x,1400));continue}
  try{result=JSON.parse(s)}catch{throw Error('Bad response '+r.status+' '+s.slice(0,200))}
  if(!r.ok||result.ok!==true||!result.hypeStageId)throw Error('Not verified '+r.status+' '+JSON.stringify(result).slice(0,300));
  break;
 }
 if(!result)throw Error('No read-only result');
 console.log('GHL_TCE27_HYPE_STAGE_VERIFIED '+JSON.stringify(result));
}finally{if(id){if(active){try{await api('POST','/workflows/'+id+'/unpublish')}catch(e){console.error('Unpublish failed '+e.message)}}try{await api('DELETE','/workflows/'+id);console.log('READ_ONLY_BRIDGE_REMOVED '+id)}catch(e){console.error('Cleanup failed '+e.message)}}}
