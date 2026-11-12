import { randomUUID, randomBytes } from 'node:crypto';
const HOST='https://collectacademy.app.n8n.cloud', API=HOST+'/api/v1', LOC='ojR4ZB7H3KiuY5kESilq';
const KEY=process.env.N8N_API_KEY;
if(!KEY)throw Error('N8N_API_KEY missing');
const FIELDS=['TCE27 | Retreat Entry Date','TCE27 | Webinar Entry Date'];
const nonce=randomBytes(24).toString('hex'), hook='tce27-field-setup-'+randomBytes(18).toString('hex');
const gh={httpHeaderAuth:{id:'xdPGXIbW6yrWua0s',name:'Collect GHL API'}};
const mk=(id,name,type,version,parameters,position,more={})=>({id,name,type,typeVersion:version,position,parameters,...more});
const hn=(method,url,more={})=>({method,url,authentication:'genericCredentialType',genericAuthType:'httpHeaderAuth',sendHeaders:true,headerParameters:{parameters:[{name:'Version',value:'v3'},{name:'Accept',value:'application/json'}]},options:{timeout:20000},...more});
const nodes=[
mk('1','Webhook | Field Setup','n8n-nodes-base.webhook',2,{httpMethod:'POST',path:hook,responseMode:'responseNode',options:{}},[240,300],{webhookId:randomUUID()}),
mk('2','Code | Authorize','n8n-nodes-base.code',2,{mode:'runOnceForAllItems',jsCode:"const p=$input.first().json.body||{};if(p.nonce!=="+JSON.stringify(nonce)+"||p.action!=='create'||!"+JSON.stringify(FIELDS)+".includes(p.name))throw Error('Unauthorized');return [{json:{name:p.name}}];"},[460,300]),
mk('3','GHL | Get Fields','n8n-nodes-base.httpRequest',4.2,hn('GET','https://services.leadconnectorhq.com/locations/'+LOC+'/customFields',{sendQuery:true,queryParameters:{parameters:[{name:'model',value:'opportunity'}]}}),[700,300],{credentials:gh}),
mk('4','Code | Existing','n8n-nodes-base.code',2,{mode:'runOnceForAllItems',jsCode:"const name=$('Code | Authorize').first().json.name;const a=$input.first().json.customFields;if(!Array.isArray(a))throw Error('No GHL customFields');const hits=a.filter(x=>x.name===name&&x.model==='opportunity');if(hits.length>1||hits.length&&hits[0].dataType!=='DATE')throw Error('Field conflict');return [{json:{name,exists:hits.length===1,id:hits[0]?.id||null,key:hits[0]?.fieldKey||null}}];"},[910,300]),
mk('5','IF | Already Exists','n8n-nodes-base.if',2.2,{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict',version:2},combinator:'and',conditions:[{id:randomUUID(),leftValue:'={{ $json.exists }}',rightValue:true,operator:{type:'boolean',operation:'true'}}]}},[1130,300]),
mk('6','Code | Existing Result','n8n-nodes-base.code',2,{mode:'runOnceForAllItems',jsCode:"const x=$input.first().json;return [{json:{ok:true,created:false,field:x.name,fieldId:x.id,fieldKey:x.key}}];"},[1340,160]),
mk('7','GHL | Create Field','n8n-nodes-base.httpRequest',4.2,hn('POST','https://services.leadconnectorhq.com/locations/'+LOC+'/customFields',{sendBody:true,specifyBody:'json',jsonBody:"={{ JSON.stringify({name:$json.name,dataType:'DATE',model:'opportunity'}) }}"}),[1340,400],{credentials:gh}),
mk('8','Code | Created Result','n8n-nodes-base.code',2,{mode:'runOnceForAllItems',jsCode:"const f=$input.first().json.customField;if(!f?.id||f.dataType!=='DATE'||f.model!=='opportunity')throw Error('GHL did not confirm');return [{json:{ok:true,created:true,field:$('Code | Authorize').first().json.name,fieldId:f.id,fieldKey:f.fieldKey}}];"},[1560,400]),
mk('9','Respond | Done','n8n-nodes-base.respondToWebhook',1.1,{respondWith:'json',responseBody:'={{ JSON.stringify($json) }}',options:{}},[1760,290])];
const link=(s)=>({main:[[{node:s,type:'main',index:0}]]});
const wf={name:'TCE27 | 00 | Provision Entry Fields | One Time',nodes,settings:{executionOrder:'v1'},connections:{
'Webhook | Field Setup':link('Code | Authorize'),'Code | Authorize':link('GHL | Get Fields'),'GHL | Get Fields':link('Code | Existing'),'Code | Existing':link('IF | Already Exists'),
'IF | Already Exists':{main:[[{node:'Code | Existing Result',type:'main',index:0}],[{node:'GHL | Create Field',type:'main',index:0}]]},
'Code | Existing Result':link('Respond | Done'),'GHL | Create Field':link('Code | Created Result'),'Code | Created Result':link('Respond | Done')}};
async function api(method,route,body){
 const r=await fetch(API+route,{method,headers:{'X-N8N-API-KEY':KEY,'Accept':'application/json',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const s=await r.text();let j;try{j=JSON.parse(s)}catch{j={raw:s.slice(0,400)}}
 if(!r.ok)throw Error(method+' '+route+' HTTP '+r.status+' '+JSON.stringify(j).slice(0,400));return j;
}
let id=null,active=false;
try{
 const w=await api('POST','/workflows',wf);id=w.id;if(!id)throw Error('Cannot create workflow');
 await api('POST','/workflows/'+id+'/publish');active=true;
 await new Promise(r=>setTimeout(r,2200));
 const confirmed=[];
 for(const name of FIELDS){let result=null;
  for(let i=0;i<4;i++){
   const r=await fetch(HOST+'/webhook/'+hook,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create',name,nonce})});
   const s=await r.text();if(r.status===404&&i<3){await new Promise(x=>setTimeout(x,1800));continue}
   try{result=JSON.parse(s)}catch{throw Error('Invalid response '+r.status+' '+s.slice(0,300))}
   if(!r.ok||!result.ok||!result.fieldId)throw Error('Field '+name+' failed: '+JSON.stringify(result).slice(0,400));
   break;
  }
  if(!result)throw Error('No response for field '+name);
  confirmed.push({name,id:result.fieldId,key:result.fieldKey,created:result.created});
 }
 console.log('ENTRY_FIELDS_CONFIRMED '+JSON.stringify({location:LOC,fields:confirmed,contactsModified:0,opportunitiesModified:0,ghlWorkflowsModified:0}));
}finally{
 if(id){
  if(active){try{await api('POST','/workflows/'+id+'/unpublish')}catch(e){try{await api('POST','/workflows/'+id+'/deactivate')}catch(e2){console.error('UNPUBLISH_FAILED '+id+' '+e2.message)}}}
  try{await api('DELETE','/workflows/'+id);console.log('FIELD_SETUP_WORKFLOW_REMOVED '+id)}catch(e){console.error('DELETE_FAILED '+id+' '+e.message)}
 }
}
