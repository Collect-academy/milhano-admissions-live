import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { elapsed, getLeadTimingRows, getManagementEvidenceRows, managementElapsed, managementSourceLabel } from "@/lib/lead-timing";
import { formatMeridaDateTime } from "@/lib/operational-date";
import { getDashboardLocale } from "@/lib/i18n";
import { tr } from "@/lib/locale";

export default async function LeadTimingDetail({ params }: {params: Promise<{opportunityId:string}>}) {
  const { opportunityId } = await params;
  const id = decodeURIComponent(opportunityId);
  const locale = await getDashboardLocale();
  const supabase = createSupabaseAdmin();
  const [timingRows, managementRows, leadResult] = await Promise.all([
    getLeadTimingRows([id]),
    getManagementEvidenceRows([id]),
    supabase.from("milhano_opportunities").select("opportunity_name,student_name,contact_name,current_stage,pipeline_name").eq("ghl_opportunity_id",id).maybeSingle(),
  ]);
  if (leadResult.error) throw new Error(leadResult.error.message);
  const timing = timingRows[0];
  if (!timing || !leadResult.data) notFound();
  const lead = leadResult.data;
  const title = lead.student_name || lead.opportunity_name || lead.contact_name || "Lead";
  const evidence = managementRows[0];
  const stageHistory = evidence?.real_stage_history ?? [];
  const events = stageHistory.filter(event => /no answer|seguimiento|callback/i.test(event.to_stage ?? ""));
  const calls = timing.call_history ?? [];
  const metrics = [
    ["Ingreso → primera gestión detectable",managementElapsed(timing.lead_at,evidence),managementSourceLabel(evidence?.first_management_source ?? null)],
    ["Ingreso → primer avance comercial",elapsed(timing.lead_at,evidence?.first_commercial_progress_at),evidence?.first_commercial_progress_source === "appointment_created" ? "Evidencia: cita agendada; no equivale a hora de respuesta" : "Cambio real a etapa comercial positiva"],
    ["Llamadas salientes registradas (GHL)",String(timing.manual_call_attempts),"No incluye llamadas realizadas fuera de GHL, como WhatsApp Calling"],
    ["Seguimientos No Answer Day 2/3",String(evidence?.real_stage_followup_count ?? 0),"Solo cambios reales; excluye stages iniciales"],
    ["Agendamiento → School Tour",elapsed(timing.school_tour_booked_at,timing.school_tour_scheduled_at),"Creación de cita → horario programado"],
    ["School Tour → Pasadía",elapsed(timing.school_tour_scheduled_at,timing.trial_day_scheduled_at),"Fechas programadas, no confirmación de asistencia"],
    ["Pasadía → Closing",elapsed(timing.trial_day_scheduled_at,timing.closed_at),"Fecha programada → movimiento Closed/Enrolled"],
  ];
  return <DashboardLayout
    eyebrow="Admissions V2 · Lead timing"
    title={title}
    subtitle={`${lead.pipeline_name ?? "—"} · ${lead.current_stage ?? "—"}`}
    statusLabel="GHL → Supabase"
  >
    <div className="detail-actions" style={{gap:12}}>
      <Link className="secondary-button" href="/analisis-leads">← {tr(locale,"All leads","Todos los leads")}</Link>
      <Link className="secondary-button" href={`/leads/${encodeURIComponent(id)}`}>{tr(locale,"Original record","Expediente original")} →</Link>
    </div>
    {timing.contact_opportunity_count > 1 ? <section className="panel"><strong>Contacto compartido</strong><p className="panel-note">Este contacto tiene {timing.contact_opportunity_count} oportunidades. Las interacciones de WhatsApp y llamadas están asociadas al contacto y pueden involucrar a varios hermanos. Los School Tours y las Pasadías siguen la atribución individual que usa V2 Summary.</p></section> : null}
    <section className="panel">
      <h2>Indicadores de tiempo</h2>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(205px,1fr))",gap:12,marginTop:16}}>
        {metrics.map(([name,value,description])=><div key={name} style={{border:"1px solid var(--border, #d4dce1)",padding:14,borderRadius:12}}>
          <small style={{display:"block",marginBottom:8}}>{name}</small>
          <strong style={{fontSize:22}}>{value}</strong>
          <small style={{display:"block",marginTop:8,opacity:0.75}}>{description}</small>
        </div>)}
      </div>
      <p className="panel-note" style={{marginTop:16}}>Los cambios de stage indican que el equipo gestionó la opportunity, pero no garantizan la hora de una llamada. Si aparece ≤, hubo evidencia comercial a más tardar en esa fecha. La propuesta verbal de agenda sigue sin evento propio en GHL.</p>
    </section>
    <section className="panel">
      <h2>Fechas de cada etapa (Mérida)</h2>
      <div className="table-scroll"><table><thead><tr><th>Etapa</th><th>Fecha real</th><th>Estado</th></tr></thead><tbody>
        <tr><td>Opportunity creada</td><td>{formatMeridaDateTime(timing.lead_at,locale)}</td><td>GHL</td></tr>
        <tr><td>Primera gestión detectable</td><td><strong>{formatMeridaDateTime(evidence?.first_management_at,locale)}</strong></td><td>{managementSourceLabel(evidence?.first_management_source ?? null)}</td></tr>
        <tr><td>Primer movimiento real de stage</td><td>{formatMeridaDateTime(evidence?.first_real_stage_at,locale)}</td><td>{evidence?.first_real_stage_to ?? "—"}</td></tr>
        <tr><td>Primer mensaje/llamada manual saliente registrada</td><td>{formatMeridaDateTime(timing.first_human_attempt_at,locale)}</td><td>No incluye llamadas por WhatsApp sin registro</td></tr>
        <tr><td>Primer avance comercial detectable</td><td>{formatMeridaDateTime(evidence?.first_commercial_progress_at,locale)}</td><td>{evidence?.first_commercial_progress_source === "appointment_created" ? "Cita creada" : evidence?.first_commercial_progress_source === "progress_stage" ? "Cambio de stage" : "—"}</td></tr>
        <tr><td>School Tour agendado</td><td>{formatMeridaDateTime(timing.school_tour_booked_at,locale)}</td><td>Creación de cita</td></tr>
        <tr><td>School Tour programado</td><td><strong>{formatMeridaDateTime(timing.school_tour_scheduled_at,locale)}</strong></td><td>{timing.school_tour_status ?? "—"}</td></tr>
        <tr><td>Pasadía agendada</td><td>{formatMeridaDateTime(timing.trial_day_booked_at,locale)}</td><td>Creación de cita</td></tr>
        <tr><td>Pasadía programada</td><td><strong>{formatMeridaDateTime(timing.trial_day_scheduled_at,locale)}</strong></td><td>{timing.trial_day_status ?? "—"}</td></tr>
        <tr><td>Closing</td><td>{formatMeridaDateTime(timing.closed_at,locale)}</td><td>Movimiento Closed/Enrolled</td></tr>
      </tbody></table></div>
    </section>
    <section className="panel"><h2>Seguimientos y sus intervalos</h2>
      <p className="panel-note">{timing.manual_call_attempts} llamadas salientes registradas · {events.length} movimientos de seguimiento reales</p>
      <div className="table-scroll"><table><thead><tr><th>Evento</th><th>Fecha (Mérida)</th><th>Intervalo anterior</th></tr></thead><tbody>
        {events.map((event,index)=><tr key={`${event.at}-${index}`}><td>{event.from_stage ?? "—"} → {event.to_stage ?? "—"}</td><td>{formatMeridaDateTime(event.at,locale)}</td><td>{index ? elapsed(events[index-1].at,event.at) : "—"}</td></tr>)}
        {!events.length ? <tr><td colSpan={3}>Sin movimientos de seguimiento registrados.</td></tr> : null}
      </tbody></table></div>
      <h3 style={{marginTop:20}}>Todos los movimientos reales de stage</h3>
      <div className="table-scroll"><table><thead><tr><th>De → A</th><th>Fecha (Mérida)</th><th>Intervalo anterior</th></tr></thead><tbody>
        {stageHistory.map((event,index)=><tr key={`${event.at}-${index}`}><td>{event.from_stage ?? "—"} → {event.to_stage ?? "—"}</td><td>{formatMeridaDateTime(event.at,locale)}</td><td>{index ? elapsed(stageHistory[index-1].at,event.at) : "—"}</td></tr>)}
        {!stageHistory.length ? <tr><td colSpan={3}>Sin cambios reales de stage registrados. Los stages iniciales importados no se consideran evidencia.</td></tr> : null}
      </tbody></table></div>
      {calls.length ? <><h3 style={{marginTop:20}}>Llamadas e intervalos</h3><div className="table-scroll"><table><thead><tr><th>Intento</th><th>Fecha (Mérida)</th><th>Estado GHL</th><th>Intervalo anterior</th></tr></thead><tbody>
        {calls.map((call,index)=><tr key={`${call.at}-${index}`}><td>{index+1}</td><td>{formatMeridaDateTime(call.at,locale)}</td><td>{call.connected ? "Contestada" : call.status || "No confirmada"}</td><td>{index ? elapsed(calls[index-1].at,call.at) : "—"}</td></tr>)}
      </tbody></table></div></> : null}
    </section>
    <section className="panel"><p className="panel-note">Advertencia analítica: una asociación temporal no prueba causalidad. Antes de explicar un no-show por demora en el contacto, deben compararse otros factores y muestras equivalentes. Las citas reprogramadas muestran la fecha actual sincronizada en GHL, no todo su historial previo.</p></section>
  </DashboardLayout>;
}
