import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  MessageCircle,
  PhoneCall,
  Route,
} from "lucide-react";

import { DashboardLayout } from "@/components/dashboard-layout";
import { HelpTip } from "@/components/help-tip";
import { getLeadDetail } from "@/lib/cascade";
import { conceptDefinition, stageConceptDefinition } from "@/lib/concepts";
import {
  dateLabel,
  dateTimeLabel,
  duration,
} from "@/lib/format";
import { getDashboardLocale } from "@/lib/i18n";
import { tr } from "@/lib/locale";
import { stageLabel } from "@/lib/terminology";

export const dynamic = "force-dynamic";

function appointmentLabel(type: string) {
  return type === "trial_day" ? "Pasadía" : type === "school_tour" ? "School Tour" : type;
}

function statusLabel(status: string | null) {
  const value = String(status ?? "").toLowerCase();
  if (["showed","completed","show","attended"].includes(value)) return "Asistió";
  if (["noshow","no_show"].includes(value)) return "No-show";
  if (["cancelled","canceled"].includes(value)) return "Cancelada";
  if (value === "confirmed") return "Confirmada";
  return status || "—";
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ opportunityId: string }>;
}) {
  const locale = await getDashboardLocale();
  const { opportunityId } = await params;
  const data = await getLeadDetail(decodeURIComponent(opportunityId));

  if (!data) notFound();

  const opportunity = data.opportunity;
  const leadName =
    opportunity.student_name ||
    opportunity.contact_name ||
    opportunity.opportunity_name ||
    "Lead";

  return (
    <DashboardLayout
      eyebrow={tr(locale, "GHL truth", "Verdad GHL")}
      title={leadName}
      subtitle={tr(
        locale,
        "Current opportunity, appointments and recent activity synchronized from GoHighLevel.",
        "Opportunity, citas y actividad reciente sincronizadas desde GoHighLevel.",
      )}
      statusLabel={stageLabel(opportunity.current_stage, locale)}
    >
      <Link className="secondary-button inline-back-link" href="/">
        <ArrowLeft size={16} />
        {tr(locale, "Back to dashboard", "Volver al dashboard")}
      </Link>

      <section className="lead-profile-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">GHL · Opportunity</p>
              <h2>Perfil actual</h2>
            </div>
          </div>
          <dl className="detail-list">
            <div><dt>Contacto</dt><dd>{opportunity.contact_name ?? "—"}</dd></div>
            <div><dt>Alumno</dt><dd>{opportunity.student_name ?? opportunity.opportunity_name ?? "—"}</dd></div>
            <div><dt>Teléfono</dt><dd>{opportunity.phone ?? "—"}</dd></div>
            <div><dt>Email</dt><dd>{opportunity.email ?? "—"}</dd></div>
            <div>
              <dt>Stage actual <HelpTip text={conceptDefinition("current_stage", locale)} /></dt>
              <dd>{stageLabel(opportunity.current_stage, locale)} <HelpTip text={stageConceptDefinition(opportunity.current_stage, locale)} /></dd>
            </div>
            <div><dt>Pipeline</dt><dd>{opportunity.pipeline_name ?? "—"}</dd></div>
            <div><dt>Status</dt><dd>{opportunity.status ?? "—"}</dd></div>
            <div><dt>Lost reason</dt><dd>{opportunity.lost_reason ?? "—"}</dd></div>
            <div><dt>Asesora</dt><dd>{opportunity.assigned_user ?? "Sin asignar"}</dd></div>
            <div><dt>Source</dt><dd>{opportunity.source ?? "—"}</dd></div>
            <div><dt>Grado</dt><dd>{opportunity.grade_interest ?? "—"}</dd></div>
            <div><dt>Creado en GHL</dt><dd>{opportunity.created_at ? dateTimeLabel(opportunity.created_at) : "—"}</dd></div>
            <div><dt>Último sync</dt><dd>{opportunity.last_truth_synced_at ? dateTimeLabel(opportunity.last_truth_synced_at) : "—"}</dd></div>
          </dl>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Calendarios GHL</p>
              <h2>School Tours y Pasadías</h2>
            </div>
            <CalendarClock size={19} />
          </div>

          <div className="ghl-appointment-list">
            {data.appointments.length ? data.appointments.map((appointment) => (
              <article className="ghl-appointment-card" key={appointment.appointment_id}>
                <div className="ghl-appointment-top">
                  <strong>{appointmentLabel(appointment.appointment_type)}</strong>
                  <span className={`ghl-status-pill ghl-status-${String(appointment.appointment_status).toLowerCase().replace(/[^a-z]+/g,"-")}`}>
                    {statusLabel(appointment.appointment_status)}
                  </span>
                </div>
                <dl className="detail-list compact-detail-list">
                  <div><dt>Creada</dt><dd>{appointment.date_added ? dateTimeLabel(appointment.date_added) : "—"}</dd></div>
                  <div><dt>Programada</dt><dd>{appointment.start_time ? dateTimeLabel(appointment.start_time) : "—"}</dd></div>
                  <div><dt>Calendario</dt><dd>{appointment.calendar_name ?? "—"}</dd></div>
                  <div><dt>Actualizada</dt><dd>{appointment.date_updated ? dateTimeLabel(appointment.date_updated) : "—"}</dd></div>
                </dl>
                {appointment.notes ? <p className="ghl-appointment-note">{appointment.notes}</p> : null}
              </article>
            )) : (
              <p className="panel-note">No hay School Tours o Pasadías vinculadas a esta opportunity/contacto en GHL.</p>
            )}
          </div>
        </article>
      </section>

      {opportunity.historical_comments ? (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Contexto existente</p>
              <h2>Comentarios</h2>
            </div>
          </div>
          <p className="legacy-comments">{opportunity.historical_comments}</p>
        </section>
      ) : null}

      <div className="two-column">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">CRM</p>
              <h2>Timeline de stages</h2>
            </div>
            <Route size={19} />
          </div>
          <div className="timeline-list">
            {data.stageEvents.length ? data.stageEvents.map((event) => (
              <article key={event.event_id}>
                <span>{dateTimeLabel(event.event_timestamp)}</span>
                <strong>{stageLabel(event.to_stage, locale)}</strong>
                <p>
                  {stageLabel(event.from_stage, locale)} → {stageLabel(event.to_stage, locale)}
                  {event.note ? ` · ${event.note}` : ""}
                </p>
              </article>
            )) : <p>Sin movimientos de stage sincronizados.</p>}
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Actividad GHL</p>
              <h2>Actividad reciente</h2>
            </div>
            <MessageCircle size={19} />
          </div>
          <div className="timeline-list">
            {data.recentActivity.length ? data.recentActivity.map((event) => {
              const isCall = event.channel.toLowerCase() === "call";
              return (
                <article key={event.event_id}>
                  <span>{dateTimeLabel(event.event_timestamp)}</span>
                  <strong>
                    {isCall ? (
                      <>
                        <PhoneCall size={13} /> {event.direction === "outbound" ? "Llamada saliente" : "Llamada entrante"}
                        {event.call_duration_seconds != null ? ` · ${duration(event.call_duration_seconds)}` : ""}
                      </>
                    ) : (
                      `${event.channel} · ${event.direction === "outbound" ? "Saliente" : "Entrante"}`
                    )}
                  </strong>
                  <p>
                    {isCall
                      ? event.is_meaningful_conversation
                        ? "Conversación significativa"
                        : event.is_connected_raw
                          ? "Contestada"
                          : event.call_status ?? "Intento"
                      : event.is_meaningful_whatsapp
                        ? "Conversación significativa"
                        : event.delivery_status ?? event.message_type ?? "Mensaje"}
                  </p>
                </article>
              );
            }) : <p>Sin actividad reciente sincronizada.</p>}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
