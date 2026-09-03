import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  MessageSquareText,
  PhoneCall,
  Save,
} from "lucide-react";

import { saveSchoolTourDetails } from "@/app/leads/[opportunityId]/actions";
import { DashboardLayout } from "@/components/dashboard-layout";
import { requireAdmissionsAppUser } from "@/lib/auth";
import { getLeadDetail } from "@/lib/cascade";
import { getDashboardLocale } from "@/lib/i18n";
import { tr } from "@/lib/locale";
import { HelpTip } from "@/components/help-tip";
import { conceptDefinition, stageConceptDefinition } from "@/lib/concepts";
import {
  dateLabel,
  dateTimeInputValue,
  dateTimeLabel,
  duration,
} from "@/lib/format";
import {
  attendanceLabel,
  stageLabel,
} from "@/lib/terminology";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ saved?: string; error?: string }>;

export default async function LeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ opportunityId: string }>;
  searchParams: SearchParams;
}) {
  const currentUser = await requireAdmissionsAppUser();
  const locale = await getDashboardLocale();
  const canEdit = currentUser.role !== "viewer";
  const { opportunityId } = await params;
  const notices = await searchParams;
  const data = await getLeadDetail(
    decodeURIComponent(opportunityId),
  );

  if (!data) notFound();

  const opportunity = data.opportunity;
  const tour = data.schoolTour;
  const leadName =
    opportunity.student_name ||
    opportunity.contact_name ||
    opportunity.opportunity_name ||
    "Lead Detail";

  return (
    <DashboardLayout
      eyebrow={tr(locale, "Lead Details", "Detalle del Lead")}
      title={leadName}
      subtitle={tr(locale, "School Tour attendance, objections, notes and stage history.", "Asistencia a School Tour, objeciones, notas e historial de stages.")}
      statusLabel={stageLabel(opportunity.current_stage, locale)}
    >
      <Link className="secondary-button inline-back-link" href="/leads?metric=school_tours_attended">
        <ArrowLeft size={16} />
        {tr(locale, "Back to Lead List", "Volver a la Lista")}
      </Link>

      {notices.saved ? (
        <section className="eod-feedback eod-feedback-good">
          <CheckCircle2 size={18} />
          <div>
            <strong>{tr(locale, "School Tour details saved", "Detalles de School Tour guardados")}</strong>
            <span>{tr(locale, "The scorecards and lead list now use the updated information.", "Los scorecards y la lista de leads ya usan la información actualizada.")}</span>
          </div>
        </section>
      ) : null}

      {notices.error ? (
        <section className="eod-feedback eod-feedback-error">
          <MessageSquareText size={18} />
          <div>
            <strong>{tr(locale, "Unable to save", "No se pudo guardar")}</strong>
            <span>{notices.error}</span>
          </div>
        </section>
      ) : null}

      <section className="lead-profile-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{tr(locale, "Contact", "Contacto")}</p>
              <h2>{tr(locale, "Lead Profile", "Perfil del Lead")}</h2>
            </div>
          </div>
          <dl className="detail-list">
            <div><dt>Contact</dt><dd>{opportunity.contact_name ?? "—"}</dd></div>
            <div><dt>Student</dt><dd>{opportunity.student_name ?? "—"}</dd></div>
            <div><dt>Phone</dt><dd>{opportunity.phone ?? "—"}</dd></div>
            <div><dt>Email</dt><dd>{opportunity.email ?? "—"}</dd></div>
            <div><dt>{tr(locale, "Current Stage", "Stage Actual")} <HelpTip text={conceptDefinition("current_stage", locale)} /></dt><dd>{stageLabel(opportunity.current_stage, locale)} <HelpTip text={stageConceptDefinition(opportunity.current_stage, locale)} /></dd></div>
            <div><dt>{tr(locale, "Owner", "Asesora")}</dt><dd>{opportunity.assigned_user ?? opportunity.historical_advisor ?? tr(locale, "Unassigned", "Sin asignar")}</dd></div>
            <div><dt>Source <HelpTip text={conceptDefinition("raw_source", locale)} /></dt><dd>{opportunity.source ?? "—"}</dd></div>
            <div><dt>Grade</dt><dd>{opportunity.grade_interest ?? "—"}</dd></div>
            <div><dt>Priority</dt><dd>{opportunity.priority ?? "—"}</dd></div>
            <div><dt>Lead Date</dt><dd>{dateLabel(opportunity.original_lead_date ?? opportunity.created_at)}</dd></div>
          </dl>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{tr(locale, "Structured layer", "Capa estructurada")}</p>
              <h2>{tr(locale, "School Tour Details", "Detalles de School Tour")}</h2>
            </div>
            <CalendarClock size={19} />
          </div>

          <form action={saveSchoolTourDetails} className="school-tour-form">
            <input
              name="ghl_opportunity_id"
              type="hidden"
              value={opportunity.ghl_opportunity_id}
            />

            <div className="tour-form-grid">
              <label>
                <span>{tr(locale, "Scheduled For", "Agendado Para")}</span>
                <input
                  defaultValue={dateTimeInputValue(tour.scheduled_for)}
                  disabled={!canEdit}
                  name="scheduled_for"
                  type="datetime-local"
                />
              </label>

              <label>
                <span>{tr(locale, "Attendance", "Asistencia")}</span>
                <select
                  defaultValue={tour.attendance_status}
                  disabled={!canEdit}
                  name="attendance_status"
                >
                  <option value="unknown">{tr(locale, "Unknown", "Desconocido")}</option>
                  <option value="scheduled">{tr(locale, "Scheduled", "Agendado")}</option>
                  <option value="showed">{tr(locale, "Showed", "Asistió")}</option>
                  <option value="no_show">No-show</option>
                  <option value="cancelled">{tr(locale, "Cancelled", "Cancelado")}</option>
                </select>
              </label>

              <label>
                <span>{tr(locale, "Attended At", "Asistió el")}</span>
                <input
                  defaultValue={dateTimeInputValue(tour.attended_at)}
                  disabled={!canEdit}
                  name="attended_at"
                  type="datetime-local"
                />
              </label>

              <label className="tour-checkbox">
                <input
                  defaultChecked={tour.has_objection}
                  disabled={!canEdit}
                  name="has_objection"
                  type="checkbox"
                />
                <span>{tr(locale, "Has Objection", "Tiene Objeción")}</span>
              </label>
            </div>

            <label>
              <span>{tr(locale, "Objection Summary", "Resumen de Objeción")}</span>
              <textarea
                defaultValue={tour.objection_summary ?? ""}
                disabled={!canEdit}
                name="objection_summary"
                placeholder="Budget, distance, schedule, grade availability, decision-maker, etc."
                rows={3}
              />
            </label>

            <label>
              <span>{tr(locale, "No-show Reason", "Razón No-show")}</span>
              <textarea
                defaultValue={tour.no_show_reason ?? ""}
                disabled={!canEdit}
                name="no_show_reason"
                placeholder="Required when Attendance = No-show"
                rows={2}
              />
            </label>

            <label>
              <span>{tr(locale, "School Tour Notes", "Notas School Tour")}</span>
              <textarea
                defaultValue={tour.school_tour_notes ?? ""}
                disabled={!canEdit}
                name="school_tour_notes"
                placeholder="What happened during the visit, family reactions and next action."
                rows={5}
              />
            </label>

            {canEdit ? (
              <button
                className="primary-button tour-save-button"
                type="submit"
              >
                <Save size={16} />
                {tr(locale, "Save School Tour Details", "Guardar Detalles School Tour")}
              </button>
            ) : (
              <p className="eod-readonly-note">
                {tr(locale, "Leadership accounts can review these details but cannot edit them.", "Las cuentas de dirección pueden revisar estos detalles pero no editarlos.")}
              </p>
            )}
          </form>

          <p className="panel-note lead-detail-updated">
            {tr(locale, "Current status", "Estado actual")}: {attendanceLabel(tour.attendance_status, locale)}
            {tour.school_tour_updated_at
              ? ` · Updated ${dateTimeLabel(tour.school_tour_updated_at)}`
              : ""}
          </p>
        </article>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{tr(locale, "Legacy context", "Contexto histórico")}</p>
            <h2>{tr(locale, "Historical Comments", "Comentarios Históricos")}</h2>
          </div>
        </div>
        <p className="legacy-comments">
          {opportunity.historical_comments ??
            tr(locale, "No historical comments were imported for this lead.", "No se importaron comentarios históricos para este lead.")}
        </p>
      </section>

      <div className="two-column">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{tr(locale, "CRM history", "Historial CRM")}</p>
              <h2>{tr(locale, "Stage Timeline", "Timeline de Stages")}</h2>
            </div>
          </div>
          <div className="timeline-list">
            {data.stageEvents.map((event) => (
              <article key={event.event_id}>
                <span>{dateTimeLabel(event.event_timestamp)}</span>
                <strong>{stageLabel(event.to_stage, locale)} <HelpTip text={stageConceptDefinition(event.to_stage, locale)} /></strong>
                <p>
                  {stageLabel(event.from_stage, locale)} → {stageLabel(event.to_stage, locale)}
                  {event.note ? ` · ${event.note}` : ""}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{tr(locale, "GHL activity", "Actividad GHL")}</p>
              <h2>{tr(locale, "Recent Calls", "Llamadas Recientes")}</h2>
            </div>
            <PhoneCall size={19} />
          </div>
          <div className="timeline-list">
            {data.calls.length ? (
              data.calls.map((call) => (
                <article key={call.event_id}>
                  <span>{dateTimeLabel(call.event_timestamp)}</span>
                  <strong>
                    {call.direction === "outbound" ? tr(locale, "Outbound", "Saliente") : tr(locale, "Inbound", "Entrante")} ·{" "}
                    {duration(call.call_duration_seconds)}
                  </strong>
                  <p>
                    {call.is_meaningful_conversation
                      ? tr(locale, "Meaningful Conversation", "Conversación Significativa")
                      : call.is_connected_raw
                        ? tr(locale, "Connected Call", "Llamada Contestada")
                        : call.call_status ?? tr(locale, "Call Attempt", "Intento de Llamada")}
                  </p>
                </article>
              ))
            ) : (
              <p>{tr(locale, "No GHL calls are linked to this opportunity.", "No hay llamadas GHL vinculadas a esta opportunity.")}</p>
            )}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
