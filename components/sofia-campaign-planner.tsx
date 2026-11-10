"use client";

import { useEffect, useMemo, useState } from "react";
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
export function SofiaCampaignPlanner({candidates,campaigns,canPlan,dispatchEnabled}:{candidates:SofiaCandidate[];campaigns:SofiaCampaign[];canPlan:boolean;dispatchEnabled:boolean}) {
 const [stage,setStage]=useState("all"),[sort,setSort]=useState<"asc"|"desc">("asc");
 const [from,setFrom]=useState(""),[to,setTo]=useState(""),[search,setSearch]=useState("");
 const [selected,setSelected]=useState<string[]>([]);
 const [requestedCount,setRequestedCount]=useState("20");
 const [name,setName]=useState("Lote Sofía · "+day());
 const [windows,setWindows]=useState<WindowInput[]>([{date:day(1),start:"08:00",end:"11:00"}]);
 const [busy,setBusy]=useState(false),[status,setStatus]=useState<{ok:boolean;message:string}|null>(null);
 const filtered=useMemo(()=>candidates.filter(c=>
   (stage==="all"||c.stage===stage) &&
   (!from||c.createdAt.slice(0,10)>=from) &&
   (!to||c.createdAt.slice(0,10)<=to) &&
   (!search||[c.name,c.opportunityId,c.phoneLast4].join(" ").toLowerCase().includes(search.toLowerCase()))
 ).sort((a,b)=>sort==="asc"?a.createdAt.localeCompare(b.createdAt):b.createdAt.localeCompare(a.createdAt)),[candidates,stage,sort,from,to,search]);
 const candidateById=new Map(candidates.map(c=>[c.opportunityId,c]));
 const chosen=selected.map(id=>candidateById.get(id)).filter((c):c is SofiaCandidate=>Boolean(c));
 const [manualSending,setManualSending]=useState(false);
 const [manualLoading,setManualLoading]=useState(false);
 const [manualRecord,setManualRecord]=useState<{status:string;conversation_id:string|null}|null>(null);
 const [manualNotice,setManualNotice]=useState<string|null>(null);
 const selectedOne=chosen.length===1 ? chosen[0] : null;
 const selectedOneId=selectedOne?.opportunityId??null;
 useEffect(()=>{
   let alive=true;
   setManualNotice(null);setManualRecord(null);
   if(!selectedOneId){setManualLoading(false);return;}
   setManualLoading(true);
   fetch("/api/sofia/dispatch-one?opportunity_id="+encodeURIComponent(selectedOneId),{cache:"no-store"})
    .then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j.error??"No se pudo comprobar el historial.");return j;})
    .then(j=>{if(alive)setManualRecord(j.record??null);})
    .catch(e=>{if(alive)setManualNotice(e instanceof Error?e.message:"No se pudo comprobar el historial.");})
    .finally(()=>{if(alive)setManualLoading(false);});
   return ()=>{alive=false;};
 },[selectedOneId]);

 async function sendSelectedNow(){
   if(!canPlan||manualSending||manualLoading||manualRecord||!selectedOne||!selectedOne.eligible)return;
   if(!window.confirm("¿Enviar una autorización real por WhatsApp a "+selectedOne.name+"? Se hará un solo intento, sin reenvío automático."))return;
   setManualSending(true);setManualNotice(null);
   try{
     const r=await fetch("/api/sofia/dispatch-one",{
       method:"POST",headers:{"Content-Type":"application/json"},
       body:JSON.stringify({opportunity_id:selectedOne.opportunityId,contact_id:selectedOne.contactId,confirm:"ENVIAR_UNA_AUTORIZACION"})
     });
     const result=await r.json();
     setManualNotice(result.message??result.error??"Respuesta registrada.");
     const check=await fetch("/api/sofia/dispatch-one?opportunity_id="+encodeURIComponent(selectedOne.opportunityId),{cache:"no-store"}).then(x=>x.json());
     if(check.record)setManualRecord(check.record);
     if(!r.ok && !check.record)setManualNotice("Estado sin confirmar. Verifica n8n antes de intentar otra vez.");
   }catch{setManualNotice("Resultado incierto; consulta n8n antes de volver a enviar.");}
   finally{setManualSending(false);}
 }

 function addFiltered(n:number|"all") {
  const available=filtered.filter(c=>c.eligible&&!selected.includes(c.opportunityId));
  const next=n==="all"?available:available.slice(0,n);
  setSelected(prev=>[...prev,...next.map(c=>c.opportunityId)]);
 }
 function addExactCount() {
  const count=Number(requestedCount);
  if(!Number.isSafeInteger(count)||count<1){setStatus({ok:false,message:"Escribe una cantidad entera mayor a cero."});return;}
  const remaining=filtered.filter(c=>c.eligible&&!selected.includes(c.opportunityId));
  if(count>remaining.length){setStatus({ok:false,message:`Solo quedan ${remaining.length} contactos elegibles sin seleccionar con estos filtros.`});return;}
  setStatus(null);
  addFiltered(count);
 }
 function updateWindow(index:number,key:keyof WindowInput,value:string) {
  setWindows(prev=>prev.map((w,i)=>i===index?{...w,[key]:value}:w));
 }
 const schedule=useMemo(()=>{
  try {
   const indexed=windows.map((w,i)=>({...asUTC(w),index:i})).sort((a,b)=>a.startMs-b.startMs);
   if(indexed.some((w,i)=>w.endMs<=w.startMs||w.startMs<=Date.now()
    ||w.endMs>Date.now()+90*86400*1000||(i>0&&indexed[i-1].endMs>w.startMs)))
    return {error:"Corrige fechas, horas o ventanas solapadas.",
      slots:[] as {window_index:number;scheduled_at:string}[]};
   // Each window groups its permission requests at its start, without invented
   // seven-minute slots. Approval and call timing is managed asynchronously
   // by WhatsApp/ElevenLabs, not by this planning calendar.
   const slots=Array.from({length:chosen.length},(_,i)=>{
     const w=indexed[Math.min(Math.floor(i*indexed.length/chosen.length),indexed.length-1)];
     return {window_index:w.index,scheduled_at:w.start_at};
   });
   return {error:"",slots};
  } catch {return {error:"Una de las fechas o ventanas no es válida.",
    slots:[] as {window_index:number;scheduled_at:string}[]};}
 },[windows,chosen.length]);
  async function controlCampaign(c:SofiaCampaign,action:"start"|"resume"|"pause"|"cancel") {
  if(!canPlan||busy)return;
  if(action==="cancel" && !window.confirm("¿Cancelar esta campaña? No se contactará a los pendientes."))return;
  if(["start","resume"].includes(action)&&!window.confirm("¿Activar el envío de solicitudes de WhatsApp para "+c.selected+" contactos? Podrían recibir llamadas cuando autoricen. Cada contacto puede recibir hasta 2 intentos."))return;
  setBusy(true);setStatus(null);
  try{
    const r=await fetch("/api/sofia/campaigns/"+encodeURIComponent(c.id)+"/control",{
      method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action})});
    const x=await r.json();
    if(!r.ok)throw new Error(x.error??"No se pudo actualizar.");
    setStatus({ok:true,message:"Campaña actualizada: "+String(x.status??action)});
    window.location.reload();
  }catch(e){setStatus({ok:false,message:e instanceof Error?e.message:"Error desconocido"});}
  finally{setBusy(false);}
 }
 async function save(activate=false){
  if(!canPlan||busy||schedule.error||!chosen.length||chosen.some(c=>!c.eligible))return;
  if(activate&&!window.confirm("¿Activar "+chosen.length+" solicitudes de WhatsApp en los horarios elegidos, con un máximo de 2 intentos por contacto?"))return;
  setBusy(true);setStatus(null);
  try {
   const response=await fetch("/api/sofia/campaigns",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({name,activate,windows:windows.map(w=>{const x=asUTC(w);return {start_at:x.start_at,end_at:x.end_at};}),
     members:chosen.map((c,i)=>({ghl_contact_id:c.contactId,ghl_opportunity_id:c.opportunityId,
       window_index:schedule.slots[i].window_index,scheduled_at:schedule.slots[i].scheduled_at}))})});
   const result=await response.json();
   if(!response.ok)throw new Error(result.error??"No se pudo guardar.");
   setStatus({ok:true,message:activate?"Lote activado. ID: "+result.campaign_id+". El motor enviará las solicitudes al llegar el horario.":"Borrador guardado. ID: "+result.campaign_id});
   setSelected([]);
   window.location.reload();
  } catch(e){setStatus({ok:false,message:e instanceof Error?e.message:"Error desconocido"});} finally {setBusy(false);}
 }
 return <div className="sofia-planner">
  <section className="panel">
   <div className="sofia-panel-title"><h2>1. ¿A quiénes enviaremos la autorización?</h2><span className="sofia-count">{chosen.length} seleccionadas</span></div>
   <p className="subtitle">Seleccionar contactos no envía nada. Para probar con uno, selecciónalo y usa «Enviar 1 autorización ahora». Para crear un lote mayor, continúa con la programación de abajo.</p>
   <div className="sofia-filters">
    <label>Etapa<select value={stage} onChange={e=>setStage(e.target.value)}><option value="all">Todas</option>{Object.entries(stageLabels).map(([key,v])=><option key={key} value={key}>{v}</option>)}</select></label>
    <label>Fecha desde<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
    <label>Fecha hasta<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
    <label>Orden<select value={sort} onChange={e=>setSort(e.target.value==="desc"?"desc":"asc")}><option value="asc">Más antiguas primero</option><option value="desc">Más recientes primero</option></select></label>
    <label>Buscar<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nombre, ID o 4 dígitos"/></label>
   </div>
   <div className="sofia-selection-actions">
    <label>Cantidad a añadir <input type="number" min="1" step="1" value={requestedCount} onChange={e=>setRequestedCount(e.target.value)} style={{width:100}} /></label>
    <button type="button" className="secondary-button" onClick={addExactCount}>Añadir cantidad</button>
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
   <div className="sofia-picker-send">
    <div>
     <strong>Envío individual desde la selección</strong>
     <p className="subtitle">Elige una sola oportunidad para enviar su autorización ahora. No activa otros lotes ni reenvía solicitudes automáticamente.</p>
    </div>
    <button type="button" className="primary-button"
      disabled={!canPlan||!selectedOne||!selectedOne.eligible||manualSending||manualLoading||manualRecord!==null||Boolean(manualNotice&&manualNotice.includes("comprobar"))}
      onClick={sendSelectedNow}>
      {manualSending?"Enviando...":manualLoading?"Verificando...":"Enviar 1 autorización ahora"}
    </button>
    {manualRecord?<p className="sofia-ok" role="status">Solicitud registrada: {manualRecord.status}
      {manualRecord.conversation_id?" · "+manualRecord.conversation_id:""}. No se reenviará.</p>:null}
    {chosen.length>1?<p className="subtitle">Tienes {chosen.length} contactos seleccionados. Para enviarlos como lote utiliza «Crear y activar lote» en la sección 2; este botón es exclusivamente individual.</p>:null}
    {manualNotice?<p className="sofia-caveat" role="status">{manualNotice}</p>:null}
   </div>
  </section>
  <section className="panel">
   <div className="sofia-panel-title"><h2>2. ¿Cuándo enviamos las solicitudes del lote?</h2><span className="sofia-count">{dispatchEnabled?"Listo para activar":"Envío temporalmente bloqueado"}</span></div>
   <label className="sofia-name-label">Nombre de campaña<input value={name} maxLength={90} onChange={e=>setName(e.target.value)}/></label>
   <div className="sofia-window-title"><strong>Horarios de envío de autorizaciones · Mérida</strong><span>No son citas ni ventanas de llamada: la persona puede aceptar más tarde y ElevenLabs la llamará entonces.</span></div>
   {windows.map((w,i)=><div className="sofia-window" key={i}>
    <label>Día<input type="date" value={w.date} onChange={e=>updateWindow(i,"date",e.target.value)}/></label>
    <label>Enviar desde<input type="time" value={w.start} onChange={e=>updateWindow(i,"start",e.target.value)}/></label>
    <label>Ventana válida hasta<input type="time" value={w.end} onChange={e=>updateWindow(i,"end",e.target.value)}/></label>
    <button type="button" className="secondary-button" disabled={windows.length===1} onClick={()=>setWindows(prev=>prev.filter((_,j)=>i!==j))}>Quitar</button>
   </div>)}
   <button type="button" className="secondary-button" disabled={windows.length>=8} onClick={()=>setWindows(prev=>[...prev,{date:day(1),start:"16:00",end:"19:00"}])}>+ Añadir ventana</button>
   <p className="subtitle">Si eliges varios horarios, repartimos los contactos entre ellos. Dentro de cada horario no agregamos retrasos: ElevenLabs espera la autorización de cada familia y gestiona la capacidad de llamadas.</p>
   <div className="sofia-preview">
    <h3>Vista previa</h3>
    <div className="sofia-metric-line"><span>Contactos seleccionados</span><strong>{chosen.length}</strong></div>
    <div className="sofia-metric-line"><span>Solicitudes previstas</span><strong>{schedule.slots.length}</strong></div>
    <div className="sofia-metric-line"><span>Espera fija por contacto</span><strong>Ninguna</strong></div>
    <div className="sofia-metric-line"><span>Concurrencia de llamadas</span><strong>La gestiona ElevenLabs</strong></div>
    <div className="sofia-metric-line"><span>Primer envío previsto</span><strong>{schedule.slots.length?fmt(schedule.slots[0].scheduled_at):"—"}</strong></div>
    {schedule.error?<p className="sofia-error">{schedule.error}</p>:null}
    <p>Las solicitudes se distribuyen entre las ventanas, sin intervalos artificiales. <strong>Guardar borrador</strong> no envía nada. <strong>Crear y activar</strong> programa el envío real para las fechas elegidas. ElevenLabs gestiona las aceptaciones y las llamadas.</p>
   </div>
   <div className="sofia-selection-actions">
    <button type="button" className="secondary-button" disabled={!canPlan||busy||!chosen.length||Boolean(schedule.error)||name.trim().length<3} onClick={()=>save(false)}>
      Guardar borrador
    </button>
    <button type="button" className="primary-button" disabled={!canPlan||!dispatchEnabled||busy||!chosen.length||Boolean(schedule.error)||name.trim().length<3} onClick={()=>save(true)}>
      {busy?"Procesando...":"Crear y activar lote"}
    </button>
   </div>
   {!canPlan?<p className="sofia-error">Sólo los administradores pueden crear lotes.</p>:null}
   {status?<p role="status" className={status.ok?"sofia-ok":"sofia-error"}>{status.message}</p>:null}
  </section>
  <section className="panel">
   <h2>3. Campañas creadas</h2>
   <p className="subtitle">{dispatchEnabled?"Envío habilitado. Solicitudes según hora programada; reintentos automáticos según resultado.":"El envío masivo está desactivado temporalmente."}</p>
   <div className="sofia-scroll"><table className="sofia-table"><thead><tr><th>Nombre</th><th>Estado</th><th>Selección</th><th>Enviados o en curso</th><th>Pendientes</th><th>Revisión</th><th>Control</th></tr></thead>
   <tbody>{campaigns.map(c=><tr key={c.id}><td><strong>{c.name}</strong><small>{c.id}</small></td>
    <td>{c.status} {c.dry_run?"· sin envío":""}<small>Liberados: {c.released??0}/{c.selected}</small></td><td>{c.selected}</td><td>{c.in_flight}</td><td>{c.queued}</td><td>{c.review_needed}</td>
    <td><div className="sofia-row-actions">
      {c.status==="running"&&canPlan?<button type="button" className="secondary-button" disabled={busy} onClick={()=>controlCampaign(c,"pause")}>Pausar</button>:null}
      {canPlan&&dispatchEnabled&&["draft","paused","scheduled"].includes(c.status)?
        <button type="button" className="primary-button" disabled={busy} onClick={()=>controlCampaign(c,"start")}>Activar lote</button>:null}
      {canPlan&&["draft","paused","scheduled"].includes(c.status)?
        <button type="button" className="secondary-button" disabled={busy} onClick={()=>controlCampaign(c,"cancel")}>Cancelar</button>:null}
      {c.status==="running"?<small>En ejecución</small>:null}
    </div></td>
   </tr>)}</tbody></table>
   {campaigns.length===0?<p>Sin campañas configuradas todavía.</p>:null}</div>
  </section>
 </div>;
}
