"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SofiaAttemptRow } from "@/lib/sofia-call-tracking";

const esTime=(x:string|null|undefined)=>x?new Date(x).toLocaleString("es-MX",{timeZone:"America/Merida",dateStyle:"short",timeStyle:"short"}):"—";
const n=(x:number)=>new Intl.NumberFormat("es-MX").format(x);
const OUTCOME:Record<string,string>={
 permission_requested:"Autorización solicitada",
 answered:"Contestó",
 no_answer:"No contestó",
 rejected:"Rechazó llamada",
 permission_declined:"Rechazó permiso",
 needs_review:"Revisar resultado"
};
const COLORS:Record<string,string>={
 answered:"#178c6b",no_answer:"#d59b32",rejected:"#c95b50",permission_requested:"#557db9",
 permission_declined:"#8b688d",needs_review:"#84919c"
};
type Filter="all"|"permission_requested"|"answered_1"|"no_answer_1"|"rejected_1"|"attempt_2"|"answered_2"|"needs_review";

export function SofiaAttemptsMonitor({rows}:{rows:SofiaAttemptRow[]}) {
 const [filter,setFilter]=useState<Filter>("all");
 const [search,setSearch]=useState("");
 const [campaign,setCampaign]=useState("all");
 const [busy,setBusy]=useState<string|null>(null);
 const [notice,setNotice]=useState("");
 const [held,setHeld]=useState<Record<string,boolean>>({});
 const counts=useMemo(()=>({
  permissions:new Set(rows.map(r=>r.ghl_contact_id)).size,
  firstAnswered:rows.filter(r=>r.attempt_number===1&&r.outcome==="answered").length,
  firstNoAnswer:rows.filter(r=>r.attempt_number===1&&r.outcome==="no_answer").length,
  firstRejected:rows.filter(r=>r.attempt_number===1&&r.outcome==="rejected").length,
  secondSent:rows.filter(r=>r.attempt_number>=2).length,
  secondAnswered:rows.filter(r=>r.attempt_number>=2&&r.outcome==="answered").length,
  pending:rows.filter(r=>r.outcome==="permission_requested").length,
  review:rows.filter(r=>r.outcome==="needs_review").length
 }),[rows]);
 const cards:{id:Filter;label:string;value:number;description:string}[]=[
  {id:"all",label:"Contactos con solicitud",value:counts.permissions,description:"ElevenLabs aceptó la solicitud"},
  {id:"permission_requested",label:"Pendientes de resultado",value:counts.pending,description:"No equivale a permiso concedido"},
  {id:"answered_1",label:"Contestaron 1.er intento",value:counts.firstAnswered,description:"Con evidencia de respuesta"},
  {id:"no_answer_1",label:"No contestaron 1.er intento",value:counts.firstNoAnswer,description:"Segundo intento a los 2 min"},
  {id:"rejected_1",label:"Rechazaron 1.er intento",value:counts.firstRejected,description:"Segundo intento a los 15 min"},
  {id:"attempt_2",label:"Recibieron 2.º intento",value:counts.secondSent,description:"Intento enviado a ElevenLabs"},
  {id:"answered_2",label:"Contestaron 2.º intento",value:counts.secondAnswered,description:"Con detalle de conversación"},
  {id:"needs_review",label:"Resultados por revisar",value:counts.review,description:"Sin evidencia para clasificar"}
 ];
 const campaigns=useMemo(()=>[...new Set(rows.map(r=>r.campaign_id).filter((x):x is string=>Boolean(x)))],[rows]);
 const chosen=useMemo(()=>rows.filter(r=>{
  if(campaign!=="all"&&r.campaign_id!==campaign)return false;
  if(search&&!([r.contact_name,r.opportunity_name??"",r.phone_last4??"",r.conversation_id,r.ghl_opportunity_id]
   .join(" ").toLowerCase().includes(search.toLowerCase())))return false;
  if(filter==="permission_requested")return r.outcome==="permission_requested";
  if(filter==="answered_1")return r.attempt_number===1&&r.outcome==="answered";
  if(filter==="no_answer_1")return r.attempt_number===1&&r.outcome==="no_answer";
  if(filter==="rejected_1")return r.attempt_number===1&&r.outcome==="rejected";
  if(filter==="attempt_2")return r.attempt_number>=2;
  if(filter==="answered_2")return r.attempt_number>=2&&r.outcome==="answered";
  if(filter==="needs_review")return r.outcome==="needs_review";
  return true;
 }),[rows,filter,search,campaign]);
 const chart=useMemo(()=>{
  const statuses=["answered","no_answer","rejected","permission_requested","needs_review"];
  return [1,2].map(step=>({
   attempt:step===1?"1.er intento":"2.º intento",
   ...Object.fromEntries(statuses.map(k=>[k,rows.filter(r=>(step===1?r.attempt_number===1:r.attempt_number>=2)
    &&r.outcome===k).length]))
  }));
 },[rows]);
 const pie=useMemo(()=>Object.entries(OUTCOME).map(([name,label])=>({
  name:label,value:rows.filter(r=>r.outcome===name).length,color:COLORS[name]??"#84919c"
 })).filter(x=>x.value>0),[rows]);

 async function retryHold(r:SofiaAttemptRow,hold:boolean) {
  if(!r.campaign_member_id||busy)return;
  setBusy(r.campaign_member_id);setNotice("");
  try{
   const response=await fetch("/api/sofia/retry-control",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({member_id:r.campaign_member_id,hold})
   });
   const result=await response.json();
   if(!response.ok)throw new Error(result.error??"No se pudo actualizar.");
   setHeld(v=>({...v,[r.campaign_member_id!]:hold}));
   setNotice(hold?"Reintento pausado.":"Reintento liberado.");
  }catch(e){setNotice(e instanceof Error?e.message:"No se pudo actualizar.");}
  finally{setBusy(null);}
 }
 return <div className="sofia-tracking">
  <div className="sofia-tracking-kpis">
   {cards.map(c=><button type="button" key={c.id} onClick={()=>setFilter(c.id)}
     className={"sofia-tracking-metric "+(filter===c.id?"selected":"")}>
    <span>{c.label}</span><strong>{n(c.value)}</strong><small>{c.description}</small>
   </button>)}
  </div>
  <div className="sofia-tracking-chart-grid">
   <section className="panel">
    <h2>Resultados por intento</h2>
    <div style={{height:280}}>
     <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chart}>
       <CartesianGrid strokeDasharray="3 3" vertical={false}/>
       <XAxis dataKey="attempt"/><YAxis allowDecimals={false}/><Tooltip/>
       <Legend/>
       <Bar dataKey="answered" stackId="x" name="Contestaron" fill={COLORS.answered}/>
       <Bar dataKey="no_answer" stackId="x" name="Sin respuesta" fill={COLORS.no_answer}/>
       <Bar dataKey="rejected" stackId="x" name="Rechazadas" fill={COLORS.rejected}/>
       <Bar dataKey="permission_requested" stackId="x" name="Pendientes" fill={COLORS.permission_requested}/>
       <Bar dataKey="needs_review" stackId="x" name="Revisión" fill={COLORS.needs_review}/>
      </BarChart>
     </ResponsiveContainer>
    </div>
   </section>
   <section className="panel">
    <h2>Distribución de resultados</h2>
    {pie.length?<div style={{height:280}}><ResponsiveContainer width="100%" height="100%">
     <PieChart><Pie data={pie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} label>
      {pie.map(x=><Cell key={x.name} fill={x.color}/>)}
     </Pie><Tooltip/><Legend/></PieChart>
    </ResponsiveContainer></div>:<p>No hay resultados todavía.</p>}
   </section>
  </div>
  <section className="panel">
   <h2>Contactos y conversaciones</h2>
   <p className="subtitle">Cada fila corresponde a una solicitud registrada, no necesariamente a una llamada conectada. El orden de intentos se calcula por oportunidad.</p>
   <div className="sofia-tracking-filters">
    <input aria-label="Buscar contacto o conversación" value={search} onChange={e=>setSearch(e.target.value)}
      placeholder="Nombre, teléfono, oportunidad o conversación"/>
    <select aria-label="Filtrar por resultado" value={filter} onChange={e=>setFilter(e.target.value as Filter)}>
     {cards.map(x=><option key={x.id} value={x.id}>{x.id==="all"?"Todos":x.label}</option>)}
    </select>
    <select aria-label="Filtrar por campaña" value={campaign} onChange={e=>setCampaign(e.target.value)}>
     <option value="all">Todas las campañas</option>
     {campaigns.map(id=><option key={id} value={id}>{id.slice(0,8)}</option>)}
    </select>
    <span>{n(chosen.length)} registros</span>
   </div>
   {notice?<p role="status" className="sofia-caveat">{notice}</p>:null}
   <div className="sofia-scroll">
    <table className="sofia-table sofia-tracking-table">
     <thead><tr><th>Contacto</th><th>Solicitud</th><th>Intento</th><th>Resultado</th><th>Duración</th><th>Detalles</th><th>Acción</th></tr></thead>
     <tbody>{chosen.slice(0,500).map(r=>{
      const onHold=held[r.campaign_member_id??""]??r.retry_held??false;
      const canManage=r.campaign_member_id&&r.attempt_number===1
       &&["rejected","no_answer"].includes(r.outcome)&&r.member_status!=="completed"
       &&r.member_status!=="cancelled";
      return <tr key={r.conversation_id}>
       <td><strong>{r.opportunity_name??r.contact_name}</strong><small>····{r.phone_last4??"—"}</small></td>
       <td>{esTime(r.sent_at)}<small>{r.source==="sofia_campaign"?"Campaña":"Individual"}</small></td>
       <td><strong>{r.attempt_number===1?"1.º":r.attempt_number===2?"2.º":r.attempt_number+"º"}</strong></td>
       <td><span style={{color:COLORS[r.outcome]??"inherit",fontWeight:700}}>
        {OUTCOME[r.outcome]??r.outcome}</span>
        {onHold?<small>Reintento pausado</small>:r.member_status==="queued"&&r.next_at?<small>Próximo: {esTime(r.next_at)}</small>:null}
       </td>
       <td>{r.duration_seconds==null?"—":Math.round(Number(r.duration_seconds))+" s"}</td>
       <td><details>
        <summary>Ver llamada</summary>
        <p><strong>Resultado:</strong> {r.call_outcome??OUTCOME[r.outcome]??"Pendiente"}</p>
        {r.termination_reason?<p><strong>Terminación:</strong> {r.termination_reason}</p>:null}
        <p><strong>Resumen:</strong> {r.transcript_summary??"Sin resumen verificable"}</p>
        <p><strong>Inició:</strong> {esTime(r.started_at)} · <strong>Terminó:</strong> {esTime(r.ended_at)}</p>
        <p><strong>Conversación:</strong> {r.conversation_id}</p>
       </details></td>
       <td>{canManage?<button type="button" className="secondary-button"
        disabled={busy===r.campaign_member_id}
        onClick={()=>retryHold(r,!onHold)}>
        {onHold?"Liberar reintento":"Pausar reintento"}</button>:<span className="subtitle">—</span>}</td>
      </tr>;
     })}</tbody>
    </table>
   </div>
   {chosen.length>500?<p>Mostrando 500 registros. Usa los filtros para encontrar otros.</p>:null}
   {chosen.length===0?<p>No hay conversaciones en el filtro elegido.</p>:null}
  </section>
 </div>;
}
