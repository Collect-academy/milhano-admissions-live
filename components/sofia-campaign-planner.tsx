"use client";

import { useMemo, useState } from "react";
import type { SofiaCandidate, SofiaCampaign } from "@/lib/sofia-analytics";

type WindowInput={date:string;start:string;end:string};
const TZ="-06:00"; // America/Merida in 2026; explicit offset avoids browser-local timezone drift.
const day=(add=0)=>{
  const d=new Date(Date.now()-6*3600000+add*86400000);
  return d.toISOString().slice(0,10);
};
function asUTC(w:WindowInput) {
  const start=new Date(w.date+"T"+w.start+":00"+TZ),end=new Date(w.date+"T"+w.end+":00"+TZ);
  return {start_at:start.toISOString(),end_at:end.toISOString(),startMs:start.getTime(),endMs:end.getTime()};
}
const fmt=(v:string)=>new Date(v).toLocaleString("es-MX",{timeZone:"America/Merida",dateStyle:"short",timeStyle:"short"});
const stageLabels:Record<string,string>={"New Lead":"Nuevo lead","No answer - Day 1":"Sin respuesta D1","No answer - Day 2":"Sin respuesta D2","No answer - Day 3":"Sin respuesta D3","Never Answered / Nurturing A":"Sin respuesta / nutrición"};
export function SofiaCampaignPlanner({candidates,campaigns,canPlan}:{candidates:SofiaCandidate[];campaigns:SofiaCampaign[];canPlan:boolean}) {
 const [stage,setStage]=useState("all"),[sort,setSort]=useState<"asc"|"desc">("asc");
 const [from,setFrom]=useState(""),[to,setTo]=useState(""),[search,setSearch]=useState("");
 const [selected,setSelected]=useState<string[]>([]);
 const [count,setCount]=useState(10),[name,setName]=useState("Lote Sofía · "+day());
 const [windows,setWindows]=useState<WindowInput[]>([{date:day(1),start:"08:00",end:"11:00"}]);
 const [busy,setBusy]=useState(false),[status,setStatus]=useState<{ok:boolean;message:string}|null>(null);
 const filtered=useMemo(()=>candidates.filter(c=>
   (stage==="all"||c.stage===stage) &&
   (!from||c.createdAt.slice(0,10)>=from) &&
   (!to||c.createdAt.slice(0,10)<=to) &&
   (!search||[c.name,c.opportunityId,c.phoneLast4].join(" ").toLowerCase().includes(search.toLowerCase()))
 ).sort((a,b)=>sort==="asc"?a.createdAt.localeCompare(b.createdAt):b.createdAt.localeCompare(a.createdAt)),[candidates,stage,sort,from,to,search]);
 const visibleSelected=filtered.filter(c=>selected.includes(c.opportunityId));
 const chosen=candidates.filter(c=>selected.includes(c.opportunityId));
 const valid=chosen.filter(c=>c.eligible);
 function addFiltered(n:number|"all") {
  const available=filtered.filter(c=>c.eligible&&!selected.includes(c.opportunityId));
  const next=n==="all"?available:available.slice(0,n);
  setSelected(prev=>[...prev,...next.map(c=>c.opportunityId)]);
 }
 function updateWindow(index:number,key:keyof WindowInput,value:string) {
  setWindows(prev=>prev.map((w,i)=>i===index?{...w,[key]:value}:w));
 }
 const schedule=useMemo(()=>{
  try{
   const indexed=windows.map((w,i)=>({...asUTC(w),index:i})).sort((a,b)=>a.startMs-b.startMs);
   if(indexed.some((w,i)=>w.endMs<=w.startMs||w.startMs<=Date.now()||w.endMs>Date.now()+90*86400*1000
    ||(i>0&&indexed[i-1].endMs>w.startMs)))return {error:"Corrige fechas, horas o ventanas solapadas.",slots:[] as {window_index:number;scheduled_at:string}[]};
   const slots:{window_index:number;scheduled_at:string}[]=[];
   for(const w of indexed) for(let time=w.startMs;time+7*60000<=w.endMs;time+=7*60000)
    slots.push({window_index:w.index,scheduled_at:new Date(time).toISOString()});
   if(slots.length<chosen.length)return {error:"No caben todos los contactos en esas ventanas a 7 minutos por intento. Añade horarios o reduce el lote.",slots};
   return {error:"",slots};
  }catch{return {error:"Una de las fechas o ventanas no es válida.",slots:[] as {window_index:number;scheduled_at:string}[]};}
 },[windows,chosen.length]);
 async function save(){
  if(!canPlan||busy||schedule.error||!chosen.length||chosen.some(c=>!c.eligible))return;
  setBusy(true);setStatus(null);
  try {
   const response=await fetch("/api/sofia/campaigns",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({name,windows:windows.map(w=>{const x=asUTC(w);return {start_at:x.start_at,end_at:x.end_at};}),
     members:chosen.map((c,i)=>({ghl_contact_id:c.contactId,ghl_opportunity_id:c.opportunityId,
       window_index:schedule.slots[i].window_index,scheduled_at:schedule.slots[i].scheduled_at}))})});
   const result=await response.json();
   if(!response.ok)throw new Error(result.error??"No se pudo guardar.");
   setStatus({ok:true,message:"Borrador creado. ID: "+result.campaign_id+". No está autorizado para llamar; falta revisión y activación del motor."});
   setSelected([]);
   window.location.reload();
  } catch(e){setStatus({ok:false,message:e instanceof Error?e.message:"Error desconocido"});} finally {setBusy(false);}
 }
 return <div className="sofia-planner">
  <section className="panel">
   <div className="sofia-panel-title"><h2>1. Selecciona oportunidades</h2><span className="sofia-count">{chosen.length} seleccionadas</span></div>
   <p className="subtitle">Datos sincronizados desde GHL. Sólo oportunidades abiertas de Setter; la elegibilidad final se vuelve a verificar antes de llamar.</p>
   <div className="sofia-filters">
    <label>Etapa<select value={stage} onChange={e=>setStage(e.target.value)}><option value="all">Todas</option>{Object.entries(stageLabels).map(([key,v])=><option key={key} value={key}>{v}</option>)}</select></label>
    <label>Fecha desde<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
    <label>Fecha hasta<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
    <label>Orden<select value={sort} onChange={e=>setSort(e.target.value)}><option value="asc">Más antiguas primero</option><option value="desc">Más recientes primero</option></select></label>
    <label>Buscar<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nombre, ID o 4 dígitos"/></label>
   </div>
   <div className="sofia-selection-actions">
    <button type="button" className="secondary-button" onClick={()=>addFiltered(10)}>+10</button>
    <button type="button" className="secondary-button" onClick={()=>addFiltered(50)}>+50</button>
    <button type="button" className="secondary-button" onClick={()=>addFiltered("all")}>Seleccionar elegibles filtrados</button>
    <button type="button" className="secondary-button" onClick={()=>setSelected([])}>Limpiar selección</button>
    <span>{filtered.length} resultados · {filtered.filter(x=>x.eligible).length} elegibles</span>
   </div>
   <div className="sofia-scroll"><table className="sofia-table"><thead><tr>
    <th>Selección</th><th>Contacto</th><th>Etapa</th><th>Oportunidad creada</th><th>Estado</th>
   </tr></thead><tbody>{filtered.slice(0,1000).map(c=><tr key={c.opportunityId}>
    <td><input type="checkbox" checked={selected.includes(c.opportunityId)} disabled={!c.eligible}
     onChange={e=>setSelected(prev=>e.target.checked?[...prev,c.opportunityId]:prev.filter(x=>x!==c.opportunityId))}/></td>
    <td><strong>{c.name}</strong><small>Tel. ····{c.phoneLast4} · {c.opportunityId}</small></td>
    <td>{stageLabels[c.stage]??c.stage}</td><td>{c.createdAt?fmt(c.createdAt):"—"}</td>
    <td><span className={c.eligible?"sofia-ok":"sofia-blocked"}>{c.eligible?"Elegible preliminar":c.exclusion}</span></td>
   </tr>)}</tbody></table></div>
   {filtered.length>1000?<p className="subtitle">Se muestran los primeros 1,000 registros. Refina filtros para seleccionar el resto.</p>:null}
  </section>
  <section className="panel">
   <div className="sofia-panel-title"><h2>2. Planifica el lote</h2><span className="sofia-count">Modo borrador seguro</span></div>
   <label className="sofia-name-label">Nombre de campaña<input value={name} maxLength={90} onChange={e=>setName(e.target.value)}/></label>
   <div className="sofia-window-title"><strong>Ventanas horarias de Mérida</strong><span>Intervalos de 7 minutos para planificación (no reserva de línea ni duración garantizada)</span></div>
   {windows.map((w,i)=><div className="sofia-window" key={i}>
    <label>Día<input type="date" value={w.date} onChange={e=>updateWindow(i,"date",e.target.value)}/></label>
    <label>Desde<input type="time" value={w.start} onChange={e=>updateWindow(i,"start",e.target.value)}/></label>
    <label>Hasta<input type="time" value={w.end} onChange={e=>updateWindow(i,"end",e.target.value)}/></label>
    <button type="button" className="secondary-button" disabled={windows.length===1} onClick={()=>setWindows(prev=>prev.filter((_,j)=>i!==j))}>Quitar</button>
   </div>)}
   <button type="button" className="secondary-button" disabled={windows.length>=8} onClick={()=>setWindows(prev=>[...prev,{date:day(1),start:"16:00",end:"19:00"}])}>+ Añadir ventana</button>
   <div className="sofia-preview">
    <h3>Vista previa</h3>
    <div className="sofia-metric-line"><span>Contactos</span><strong>{chosen.length}</strong></div>
    <div className="sofia-metric-line"><span>Espacios calculados</span><strong>{schedule.slots.length}</strong></div>
    <div className="sofia-metric-line"><span>Concurrencia de prueba</span><strong>1 llamada</strong></div>
    <div className="sofia-metric-line"><span>Inicio del lote</span><strong>{schedule.slots.length?fmt(schedule.slots[0].scheduled_at):"—"}</strong></div>
    {schedule.error?<p className="sofia-error">{schedule.error}</p>:null}
    <p>Al guardar se crea un borrador en Supabase. No dispara llamadas, no mueve oportunidades y no escribe en GHL.</p>
   </div>
   <button type="button" className="primary-button" disabled={!canPlan||busy||!chosen.length||Boolean(schedule.error)||name.trim().length<3} onClick={save}>
    {busy?"Guardando...":"Guardar planificación sin activar llamadas"}
   </button>
   {!canPlan?<p className="sofia-error">Sólo los administradores pueden crear lotes.</p>:null}
   {status?<p role="status" className={status.ok?"sofia-ok":"sofia-error"}>{status.message}</p>:null}
  </section>
  <section className="panel">
   <h2>3. Campañas creadas</h2>
   <div className="sofia-scroll"><table className="sofia-table"><thead><tr><th>Nombre</th><th>Estado</th><th>Selección</th><th>Pendientes</th><th>En progreso</th><th>Revisión</th><th>Creada</th></tr></thead>
   <tbody>{campaigns.map(c=><tr key={c.id}><td><strong>{c.name}</strong><small>{c.id}</small></td>
    <td>{c.status} {c.dry_run?"· simulación":""}</td><td>{c.selected}</td><td>{c.queued}</td><td>{c.in_flight}</td><td>{c.review_needed}</td><td>{fmt(c.created_at)}</td></tr>)}</tbody></table>
   {campaigns.length===0?<p>Sin campañas configuradas todavía.</p>:null}</div>
  </section>
 </div>;
}
