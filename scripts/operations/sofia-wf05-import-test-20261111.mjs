import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import assert from "node:assert/strict";
const path="n8n/importables/2026-11-11/MILHANO_WF05_CALLBACK_VERIFICATION_IMPORTAR.json";
const j=JSON.parse(readFileSync(path,"utf8"));
const names=j.nodes.map(n=>n.name),nodes=Object.fromEntries(j.nodes.map(n=>[n.name,n]));
assert.equal(j.nodes.length,22);assert.equal(new Set(names).size,names.length);
for(const [name,out] of Object.entries(j.connections)){assert.ok(nodes[name],name);for(const lane of out.main??[])for(const edge of lane)assert.ok(nodes[edge.node],edge.node);}
assert.equal(j.active,false);
assert.ok(nodes["Safety Gate | Stage Writes Controlled"].parameters.jsCode.includes("p.decision?.action!=='apply'"));
assert.ok(nodes["Supabase | Evaluate Exclusive Stage"].parameters.jsonBody.includes("p_callback_task_confirmed:$('Verify | GHL Follow-up Task').first().json.callback_task_confirmed===true"));
assert.ok(nodes["GHL | List Contact Follow-up Tasks"].parameters.url.includes("/tasks"));
const code=nodes["Verify | GHL Follow-up Task"].parameters.jsCode;
function run(row,raw){const ctx={$input:{first:()=>({json:raw})},
  $:name=>({first:()=>({json:name==="Verify | GHL Identity and Note"?
     {ghl_contact_id:"C1234",ghl_opportunity_id:"O1234",identity_verified:true,note_verified:true}:
     row})}),
  String,Array,Boolean,Number,Object,Error};
 return runInNewContext("(function(){"+code+"})()",ctx)[0].json.callback_task_confirmed;
}
const record={ghl_contact_id:"C1234",ghl_opportunity_id:"O1234",human_follow_up_task_id:"TASK1"};
assert.equal(run(record,{tasks:[{id:"TASK1",contactId:"C1234"}]}),true);
assert.equal(run(record,{tasks:[{id:"TASK2",contactId:"C1234"}]}),false);
assert.equal(run({...record,ghl_contact_id:"SOMEONE_ELSE"},{tasks:[{id:"TASK1",contactId:"C1234"}]}),false);
assert.equal(run(record,{error:true}),false);
assert.equal(run({}, {tasks:[{id:"TASK1",contactId:"C1234"}]}),false);
console.log("SOFIA_WF05_QA_PASS: stage gate unchanged, 22 nodes connected, confirmed and unconfirmed callback tasks handled safely");
