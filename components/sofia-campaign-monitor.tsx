"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { SofiaCampaign } from "@/lib/sofia-analytics";

type Campaign = SofiaCampaign & {
  updated_at: string;
  operational_status: string;
  requests_sent: number;
  claimed: number;
  awaiting_authorization_or_result: number;
  completed: number;
  review_needed: number;
  excluded: number;
  cancelled_members: number;
  in_progress_members: number;
  permission_events: number;
  approvals_confirmed: number;
  requests_with_permission_event: number;
  calls_recorded: number;
  answered_contacts: number;
  meaningful_contacts: number;
  approval_signal: "unavailable" | "partial" | "observed";
  approval_rate_pct: number | null;
  opted_in: number;
  not_opted_in: number;
  pending_opt_in: number;
  not_sent_opt_in: number;
  next_scheduled_at: string | null;
  last_member_update_at: string | null;
};
type Member = {
  member_id: string;
  campaign_id: string;
  ghl_contact_id: string;
  ghl_opportunity_id: string;
  contact_name: string;
  opportunity_name: string;
  member_status: string;
  display_status: string;
  attempts_total: number;
  dispatched_at: string | null;
  next_scheduled_at: string | null;
  excluded_reason: string | null;
  conversation_id: string | null;
  last_attempt_status: string | null;
  last_attempt_error: string | null;
  connection_outcome: string | null;
  call_outcome: string | null;
  meaningful_conversation: boolean | null;
  qualified: boolean | null;
  call_started_at: string | null;
  call_finished_at: string | null;
  summary_es: string | null;
  transcript_summary: string | null;
  collected_variables: Record<string, unknown> | null;
  permission_state: string | null;
  permission_requested_at: string | null;
  permission_approved_at: string | null;
  approval_evidence: "unavailable" | "not_confirmed" | "confirmed" | "declined";
  opt_in_status: "opted_in" | "not_opted_in" | "pending" | "not_sent";
  opt_in_evidence: "explicit_event" | "call_event" | "explicit_decline" | null;
};
const STATUS: Record<string,string> = {
  in_progress: "En progreso",
  needs_review: "Requiere revisión",
  completed: "Completado",
  draft: "Borrador",
  paused: "Pausado",
  scheduled: "Programado",
  cancelled: "Cancelado"
};
const MEMBER_STATUS: Record<string,string> = {
  completed:"Finalizado", excluded:"Excluido",cancelled:"Cancelado",
  needs_review:"Requiere revisión",retry_scheduled:"Reintento programado",
  scheduled:"Programado",sending:"Enviando solicitud",
  call_observed:"Llamada registrada",
  awaiting_authorization_or_result:"Solicitud enviada · sin resultado final",
  unknown:"Por verificar"
};
const fmt = (value:string|null|undefined) => value
  ? new Date(value).toLocaleString("es-MX",{timeZone:"America/Merida",dateStyle:"short",timeStyle:"short"})
  : "—";
const n = (value:number) => new Intl.NumberFormat("es-MX").format(value);
const str = (value:unknown) =>
  typeof value==="string"&&value.trim()?value.trim():"—";
const percent = (a:number,b:number) => b>0?(100*a/b).toFixed(1)+"%":"—";

export function SofiaCampaignMonitor({
  canPlan,dispatchEnabled,busy,onControl
}:{
  canPlan:boolean;
  dispatchEnabled:boolean;
  busy:boolean;
  onControl:(campaign:SofiaCampaign,action:"start"|"resume"|"pause"|"cancel")=>Promise<void>;
}) {
  const [rows,setRows]=useState<Campaign[]>([]);
  const [members,setMembers]=useState<Member[]|null>(null);
  const [opened,setOpened]=useState<string|null>(null);
  const [search,setSearch]=useState("");
  const [approvalFilter,setApprovalFilter]=useState("all");
  const [error,setError]=useState("");
  const [detailError,setDetailError]=useState("");
  const [updated,setUpdated]=useState<string|null>(null);
  const [refresh,setRefresh]=useState(0);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    let alive=true;
    const update=async()=>{
      try {
        const response=await fetch("/api/sofia/campaigns/monitor",{cache:"no-store"});
        const json=await response.json();
        if(!response.ok)throw new Error(json.error??"No se pudo consultar el estado.");
        if(alive){setRows(json.campaigns??[]);setUpdated(json.updated_at??null);setError("");setLoading(false);}
      } catch(e) {
        if(alive){setError(e instanceof Error?e.message:"Error de actualización.");setLoading(false);}
      }
    };
    void update();
    const timer=setInterval(()=>void update(),15000);
    return ()=>{alive=false;clearInterval(timer);};
  },[refresh]);

  useEffect(()=>{
    let alive=true;
    setMembers(null);
    setSearch("");
    setApprovalFilter("all");
    setDetailError("");
    if(!opened)return;
    const update=async()=>{
      try{
        const response=await fetch("/api/sofia/campaigns/monitor?campaign_id="+encodeURIComponent(opened),{cache:"no-store"});
        const json=await response.json();
        if(!response.ok)throw new Error(json.error??"No se pudo consultar el detalle.");
        if(alive){setMembers(json.members??[]);setDetailError("");}
      }catch(e){
        if(alive)setDetailError(e instanceof Error?e.message:"Error al consultar contactos.");
      }
    };
    void update();
    const timer=setInterval(()=>void update(),15000);
    return ()=>{alive=false;clearInterval(timer);};
  },[opened,refresh]);

  const filteredMembers=useMemo(()=>members?.filter(m=>{
    if(approvalFilter==="confirmed"&&m.opt_in_status!=="opted_in")return false;
    if(approvalFilter==="missing"&&m.opt_in_status==="opted_in")return false;
    if(approvalFilter==="declined"&&m.opt_in_status!=="not_opted_in")return false;
    if(approvalFilter==="pending"&&m.opt_in_status!=="pending")return false;
    return !search||[m.contact_name,m.opportunity_name,m.ghl_opportunity_id,m.conversation_id??""]
      .join(" ").toLocaleLowerCase("es-MX").includes(search.toLocaleLowerCase("es-MX"));
  })??[],[members,search,approvalFilter]);

  const awaiting=rows.filter(c=>c.operational_status==="in_progress").length;

  return <section className="panel">
    <div className="sofia-panel-title">
      <div>
        <h2>3. Campañas creadas · seguimiento</h2>
        <p className="subtitle">
          {n(awaiting)} en progreso · Actualización automática cada 15 s · Última consulta: {fmt(updated)}
        </p>
      </div>
      <button type="button" className="secondary-button" onClick={()=>setRefresh(x=>x+1)}>
        Actualizar ahora
      </button>
    </div>
    <p className="subtitle">
      El estado se calcula con los resultados reales de los contactos. Una campaña puede terminar aunque
      su registro técnico aún diga running. Las autorizaciones pendientes no se cuentan como rechazos.
    </p>
    {error?<p className="sofia-error" role="alert">No se pudo actualizar: {error}</p>:null}
    {loading?<p className="subtitle">Consultando campañas…</p>:null}
    <div className="sofia-scroll">
      <table className="sofia-table">
        <thead><tr>
          <th>Campaña</th><th>Estado real</th><th>Leads</th><th>Solicitudes</th>
          <th>Sin resultado final</th><th>Contestaron</th>
          <th>Opted in</th><th>Not opted in</th><th>Pendientes de opt-in</th><th>Finalizados</th><th>Revisión</th><th>Control</th>
        </tr></thead>
        <tbody>{rows.map(c=><tr key={c.id}>
          <td>
            <strong>{c.name}</strong><small>{c.id}</small>
            <button type="button" className="secondary-button" style={{marginTop:6}}
              onClick={()=>setOpened(v=>v===c.id?null:c.id)}>
              {opened===c.id?"Ocultar contactos":"Ver contactos"}
            </button>
          </td>
          <td>
            <strong>{STATUS[c.operational_status]??c.operational_status}</strong>
            {c.operational_status==="in_progress"&&c.awaiting_authorization_or_result>0
              ?<small>Esperando autorización o cierre de llamada</small>:null}
            {c.operational_status==="in_progress"&&c.queued>0?<small>{c.queued} programados</small>:null}
          </td>
          <td>{c.selected}</td>
          <td>{c.requests_sent}<small>{percent(c.requests_sent,c.selected)} enviados</small></td>
          <td>{c.awaiting_authorization_or_result}</td>
          <td>{c.answered_contacts}<small>{percent(c.answered_contacts,c.requests_sent)} de solicitudes</small></td>
          <td>{c.opted_in}<small>{percent(c.opted_in,c.requests_sent)} de solicitudes</small></td>
          <td>{c.not_opted_in}</td>
          <td>{c.pending_opt_in}</td>
          <td>{c.completed+c.excluded+c.cancelled_members}<small>{c.selected>0?percent(c.completed+c.excluded+c.cancelled_members,c.selected):"—"}</small></td>
          <td>{c.review_needed}</td>
          <td>
            <div className="sofia-row-actions">
              {c.status==="running"&&c.operational_status==="in_progress"&&canPlan
                ?<button type="button" className="secondary-button" disabled={busy}
                  onClick={()=>void onControl(c,"pause")}>Pausar</button>:null}
              {canPlan&&dispatchEnabled&&["draft","paused","scheduled"].includes(c.status)
                ?<button type="button" className="primary-button" disabled={busy}
                  onClick={()=>void onControl(c,"start")}>Activar lote</button>:null}
              {canPlan&&["draft","paused","scheduled"].includes(c.status)
                ?<button type="button" className="secondary-button" disabled={busy}
                  onClick={()=>void onControl(c,"cancel")}>Cancelar</button>:null}
              {c.operational_status==="completed"||c.operational_status==="needs_review"
                ?<small>Sin envíos pendientes</small>:null}
            </div>
          </td>
        </tr>).flatMap((row,i)=>{
          const c=rows[i];
          if(opened!==c.id)return [row];
          return [row,<tr key={c.id+"-details"}><td colSpan={12}>
            <div style={{padding:"12px 4px"}}>
              <strong>Contactos · {c.name}</strong>
              <p className="subtitle">
                Solicitudes enviadas: {c.requests_sent} · Llamadas registradas: {c.calls_recorded} ·
                Conversaciones útiles: {c.meaningful_contacts} ·
                Reintentos pendientes: {c.queued} · Finalizados: {c.completed}
              </p>
              <p className="subtitle">
                Opted in = aceptación explícita registrada o llamada real iniciada (la llamada requiere autorización).
                Not opted in = rechazo explícito del permiso. Sin respuesta permanece pendiente, no se considera rechazo.
                La hora exacta del clic solo se conoce cuando hay evento del proveedor.
              </p>
              <div className="sofia-tracking-filters">
                <input aria-label="Buscar contacto del lote" value={search} onChange={e=>setSearch(e.target.value)}
                  placeholder="Buscar contacto o conversación"/>
                <select aria-label="Filtrar autorizaciones" value={approvalFilter}
                  onChange={e=>setApprovalFilter(e.target.value)}>
                  <option value="all">Todos</option>
                  <option value="confirmed">Opted in</option>
                  <option value="declined">Not opted in (rechazo)</option>
                  <option value="pending">Pendiente de opt-in</option>
                  <option value="missing">Sin opt-in confirmado</option>
                </select>
                <span>{filteredMembers.length} contactos visibles</span>
              </div>
              {detailError?<p className="sofia-error" role="alert">{detailError}</p>:null}
              {members===null?<p className="subtitle">Consultando contactos…</p>:
                <div className="sofia-scroll"><table className="sofia-table"><thead><tr>
                  <th>Contacto</th><th>Situación</th><th>Intentos</th><th>Autorización</th>
                  <th>Resultado</th><th>Último evento</th><th>Información</th>
                </tr></thead><tbody>{filteredMembers.map(m=><tr key={m.member_id}>
                  <td><strong>{m.opportunity_name||m.contact_name}</strong>
                    <small>{m.contact_name}</small>
                    <Link href={"/leads/"+encodeURIComponent(m.ghl_opportunity_id)}>Ver oportunidad</Link>
                  </td>
                  <td>{MEMBER_STATUS[m.display_status]??m.member_status}
                    {m.excluded_reason?<small>{m.excluded_reason}</small>:null}</td>
                  <td>{m.attempts_total}</td>
                  <td>{m.opt_in_status==="opted_in"?(m.opt_in_evidence==="explicit_event"?"Opted in · evento":"Opted in · llamada")
                    :m.opt_in_status==="not_opted_in"?"Not opted in · rechazó"
                    :m.opt_in_status==="pending"?"Pendiente de aceptar":"Sin solicitud"}</td>
                  <td>{m.connection_outcome==="human"?"Respondió"
                    :m.connection_outcome==="no_answer"?"No contestó"
                    :m.connection_outcome==="rejected"?"Rechazó"
                    :m.call_outcome??"Sin resultado final"}
                    {m.meaningful_conversation?<small>Conversación útil</small>:null}
                  </td>
                  <td>{fmt(m.call_finished_at??m.call_started_at??m.dispatched_at??m.next_scheduled_at)}</td>
                  <td>
                    <details><summary>Ver información</summary>
                      <p><strong>Resumen:</strong> {m.summary_es??m.transcript_summary??"No registrado"}</p>
                      <p><strong>Tutor:</strong> {str(m.collected_variables?.tutor_first_name)}
                        {" · "}<strong>Zona:</strong> {str(m.collected_variables?.residential_area)}</p>
                      <p><strong>Prioridades:</strong> {str(m.collected_variables?.school_priorities)}</p>
                      <p><strong>Motivo:</strong> {str(m.collected_variables?.change_reason)}</p>
                      <p><strong>Acción siguiente:</strong> {str(m.collected_variables?.next_action)}</p>
                      {m.conversation_id?<p><strong>Conversación:</strong> {m.conversation_id}</p>:null}
                      {m.last_attempt_error?<p><strong>Error:</strong> {m.last_attempt_error}</p>:null}
                    </details>
                  </td>
                </tr>)}</tbody></table></div>}
            </div>
          </td></tr>];
        })}</tbody>
      </table>
    </div>
    {!loading&&rows.length===0?<p className="subtitle">No hay campañas registradas.</p>:null}
    <p className="subtitle">
      «Sin resultado final» incluye solicitudes de WhatsApp que todavía pueden aceptarse.
      La actualización de esta página es de lectura: no inicia, cancela ni modifica llamadas.
    </p>
  </section>;
}
