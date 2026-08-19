import { FileClock, PencilLine, Send, Save } from "lucide-react";

import { DashboardLayout } from "@/components/dashboard-layout";
import { DateRangeFilter } from "@/components/date-range-filter";
import { EmptyState } from "@/components/empty-state";
import { resolveDateRange } from "@/lib/date-range";
import { getEodChangeLogs, getEodTourChangeLogs, type EodFieldChange, type EodTourChangeLog } from "@/lib/eod-logs";
import { dateLabel, dateTimeLabel } from "@/lib/format";
import { getDashboardLocale } from "@/lib/i18n";
import { tr, type Locale } from "@/lib/locale";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

const FIELD_LABELS: Record<string, { en: string; es: string }> = {
  new_leads_received: { en: "Total Leads", es: "Leads Totales" },
  ads_leads_reported: { en: "Ads Leads", es: "Leads Ads" },
  organic_leads_reported: { en: "Organic", es: "Orgánico" },
  contacted_reported: { en: "Contacted", es: "Contactados" },
  responses_reported: { en: "Responses", es: "Respuestas" },
  meaningful_conversations_reported: { en: "Meaningful Conversations", es: "Conversaciones Significativas" },
  qualified_leads: { en: "Qualified / Fit", es: "Qualified / Fit" },
  school_tours_scheduled: { en: "ST Booked", es: "ST Booked" },
  school_tours_attended: { en: "ST Attended", es: "ST Attended" },
  closed_leads: { en: "Closed", es: "Closed / Inscrito" },
};

function fieldLabel(key: string, locale: Locale): string {
  return FIELD_LABELS[key]?.[locale] ?? key;
}

function valueLabel(value: number | null, locale: Locale): string {
  return value === null ? tr(locale, "blank", "vacío") : String(value);
}

function actionLabel(action: string, locale: Locale): string {
  const labels: Record<string, { en: string; es: string }> = {
    save_draft: { en: "saved draft", es: "guardó borrador" },
    submit: { en: "submitted EOD", es: "envió EOD" },
    edit_submitted: { en: "updated submitted EOD", es: "actualizó EOD enviado" },
    admin_edit: { en: "corrected EOD", es: "corrigió EOD" },
  };
  return labels[action]?.[locale] ?? action;
}

function commentsChanged(before: string | null, after: string | null): boolean {
  return before !== after;
}

function compactChanges(changes: EodFieldChange[], locale: Locale): string {
  if (!changes.length) return tr(locale, "No KPI field changes", "Sin cambios de campos KPI");
  return changes
    .map((change) => `${fieldLabel(change.metric_key, locale)} ${valueLabel(change.old_value, locale)} → ${valueLabel(change.new_value, locale)}`)
    .join(" · ");
}

function tourStateSummary(log: EodTourChangeLog, state: Record<string, unknown>[]) {
  const bookings = state.filter((row) => String(row.booking_submission_id ?? "") === log.submission_id);
  const outcomes = state.filter((row) => String(row.attendance_submission_id ?? "") === log.submission_id);
  const closed = outcomes.filter((row) => String(row.close_outcome ?? "") === "closed");
  const contacts = bookings
    .map((row) => `${String(row.phone ?? "Sin teléfono")} · ${String(row.contact_name ?? row.student_name ?? "Sin nombre")}`)
    .slice(0, 4);
  return { bookings: bookings.length, outcomes: outcomes.length, closed: closed.length, contacts };
}

function tourLogText(log: EodTourChangeLog, locale: Locale): string {
  const before = tourStateSummary(log, log.before_state);
  const after = tourStateSummary(log, log.after_state);
  const parts = [
    `ST Booked ${before.bookings} → ${after.bookings}`,
    `${tr(locale, "ST outcomes", "Outcomes ST")} ${before.outcomes} → ${after.outcomes}`,
    `Closed ${before.closed} → ${after.closed}`,
  ];
  if (after.contacts.length) parts.push(after.contacts.join(" / "));
  return parts.join(" · ");
}

function ActionIcon({ action }: { action: string }) {
  if (action === "submit") return <Send size={17} />;
  if (action === "save_draft") return <Save size={17} />;
  return <PencilLine size={17} />;
}

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const locale = await getDashboardLocale();
  const range = resolveDateRange(params);
  const [logs, tourLogs] = await Promise.all([
    getEodChangeLogs(range),
    getEodTourChangeLogs(range),
  ]);

  return (
    <DashboardLayout
      eyebrow={tr(locale, "Audit trail", "Historial de cambios")}
      title={tr(locale, "Logs", "Logs")}
      subtitle={tr(
        locale,
        "Simple EOD activity history: who changed what, for which advisor and date, with before → after values.",
        "Historial simple del EOD: quién cambió qué, para qué asesora y fecha, con valores antes → después.",
      )}
      statusLabel={`${dateLabel(range.start)} – ${dateLabel(range.end)}`}
    >
      <DateRangeFilter basePath="/logs" range={range} locale={locale} />

      <section className="scope-banner log-scope-banner">
        <FileClock size={19} />
        <div>
          <strong>{tr(locale, "Every EOD correction is traceable", "Cada corrección del EOD queda rastreable")}</strong>
          <span>{tr(locale, "EOD values are final totals, not increments. Editing 20 → 22 means the stored value becomes 22.", "Los valores del EOD son totales finales, no incrementos. Editar 20 → 22 significa que el valor guardado pasa a ser 22.")}</span>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{tr(locale, "EOD activity", "Actividad EOD")}</p>
            <h2>{tr(locale, `${logs.length + tourLogs.length} logged actions`, `${logs.length + tourLogs.length} acciones registradas`)}</h2>
          </div>
          <p className="panel-note">{tr(locale, "Newest first. Logs are visible to every authenticated dashboard user.", "Más recientes primero. Los logs son visibles para todos los usuarios autenticados del dashboard.")}</p>
        </div>

        {logs.length ? (
          <div className="activity-log-list">
            {logs.map((log) => {
              const actor = log.actor_name ?? tr(locale, "Unknown user", "Usuario desconocido");
              const sameUser = actor === log.advisor_name;
              const commentChanged = commentsChanged(log.comments_before, log.comments_after);
              return (
                <article className="activity-log-row" key={log.id}>
                  <div className="activity-log-icon"><ActionIcon action={log.action_type} /></div>
                  <div className="activity-log-main">
                    <div className="activity-log-title">
                      <strong>{actor}</strong>
                      <span>{actionLabel(log.action_type, locale)}</span>
                      <b>{dateLabel(log.eod_date)}</b>
                    </div>
                    {!sameUser ? (
                      <small>{tr(locale, `EOD owner: ${log.advisor_name}`, `EOD de: ${log.advisor_name}`)}</small>
                    ) : null}
                    <p>{compactChanges(log.changes, locale)}</p>
                    {commentChanged ? (
                      <span className="activity-log-note">{tr(locale, "Notes changed", "Notas actualizadas")}</span>
                    ) : null}
                  </div>
                  <time>{dateTimeLabel(log.created_at)}</time>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState message={tr(locale, "No EOD changes were logged in this period.", "No hay cambios de EOD registrados en este periodo.")} />
        )}
      </section>

      {tourLogs.length ? (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">School Tours</p>
              <h2>{tr(locale, "ST detail changes", "Cambios de detalle ST")}</h2>
            </div>
            <p className="panel-note">{tr(locale, "Contact, schedule, level and outcome changes are tracked separately from KPI totals.", "Los cambios de contacto, horario, nivel y outcome se rastrean aparte de los totales KPI.")}</p>
          </div>
          <div className="activity-log-list">
            {tourLogs.map((log) => {
              const actor = log.actor_name ?? tr(locale, "Unknown user", "Usuario desconocido");
              return (
                <article className="activity-log-row" key={log.id}>
                  <div className="activity-log-icon"><PencilLine size={17} /></div>
                  <div className="activity-log-main">
                    <div className="activity-log-title">
                      <strong>{actor}</strong>
                      <span>{tr(locale, "updated ST detail", "actualizó detalle ST")}</span>
                      <b>{dateLabel(log.eod_date)}</b>
                    </div>
                    {actor !== log.advisor_name ? <small>{tr(locale, `EOD owner: ${log.advisor_name}`, `EOD de: ${log.advisor_name}`)}</small> : null}
                    <p>{tourLogText(log, locale)}</p>
                  </div>
                  <time>{dateTimeLabel(log.created_at)}</time>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
    </DashboardLayout>
  );
}
