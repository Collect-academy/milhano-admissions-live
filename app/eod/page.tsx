import Link from "next/link";
import {
  AlertTriangle,
  CalendarPlus,
  CheckCircle2,
  Clock3,
  Download,
  PencilLine,
  Save,
  Send,
  X,
} from "lucide-react";

import { openHistoricalEod, saveEodSubmission } from "@/app/eod/actions";
import { DashboardLayout } from "@/components/dashboard-layout";
import { DateRangeFilter } from "@/components/date-range-filter";
import { EmptyState } from "@/components/empty-state";
import { HelpTip } from "@/components/help-tip";
import { conceptDefinition } from "@/lib/concepts";
import { requireCurrentAppUser } from "@/lib/auth";
import { dateRangeParams, resolveDateRange } from "@/lib/date-range";
import { getEodData } from "@/lib/data";
import {
  buildManualEodRecords,
  groupManualEodRecords,
  MANUAL_EOD_KEYS,
  type ManualEodMetricKey,
  type ManualEodTotals,
} from "@/lib/eod-manual";
import { dateLabel, dateTimeLabel, number } from "@/lib/format";
import { getDashboardLocale } from "@/lib/i18n";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { tr, type Locale } from "@/lib/locale";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

const EOD_COPY: Record<ManualEodMetricKey, {
  definitionKey: string;
  en: string;
  es: string;
}> = {
  new_leads_received: { definitionKey: "new_leads", en: "Total Leads", es: "Leads Totales" },
  ads_leads_reported: { definitionKey: "ads_leads", en: "Ads", es: "Ads" },
  organic_leads_reported: { definitionKey: "organic_leads", en: "Organic", es: "Orgánico" },
  contacted_reported: { definitionKey: "contacted_reported", en: "Contacted", es: "Contactados" },
  responses_reported: { definitionKey: "responses_reported", en: "Responded", es: "Respondieron" },
  meaningful_conversations_reported: { definitionKey: "meaningful_conversations", en: "Meaningful", es: "Meaningful" },
  qualified_leads: { definitionKey: "qualified_leads", en: "Qualified / Fit", es: "Qualified / Fit" },
  school_tours_scheduled: { definitionKey: "school_tours_booked", en: "ST Booked", es: "ST Booked" },
  school_tours_attended: { definitionKey: "school_tours_attended", en: "ST Attended", es: "ST Attended" },
};

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function labelFor(key: ManualEodMetricKey, locale: Locale): string {
  const copy = EOD_COPY[key];
  return locale === "es" ? copy.es : copy.en;
}

function statusLabel(status: string, locale: Locale): string {
  const labels: Record<string, [string, string]> = {
    draft: ["Draft", "Borrador"],
    submitted: ["Submitted", "Enviado"],
    validated: ["Validated", "Validado"],
    review: ["Under Review", "En revisión"],
    missed: ["Not Submitted", "No enviado"],
    blocked: ["Legacy Blocked", "Bloqueo legacy"],
  };
  const pair = labels[status];
  return pair ? (locale === "es" ? pair[1] : pair[0]) : status;
}

function meridaToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Merida",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatMonth(monthKey: string, locale: Locale): string {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat(locale === "es" ? "es-MX" : "en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 15)));
}

function formatShortDate(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "es" ? "es-MX" : "en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}

function totalCell(totals: ManualEodTotals, key: ManualEodMetricKey): string {
  return number(totals[key]);
}

export default async function EodPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const currentUser = await requireCurrentAppUser();
  const locale = await getDashboardLocale();
  const params = await searchParams;
  const range = resolveDateRange(params);
  const today = meridaToday();
  const todayRange = {
    key: "today" as const,
    start: today,
    end: today,
    label: "Today",
  };
  const [data, todayData] = await Promise.all([
    getEodData(range),
    getEodData(todayRange),
  ]);

  const advisorOptions = currentUser.role !== "advisor"
    ? await createSupabaseAdmin()
        .from("milhano_app_users")
        .select("id, display_name")
        .eq("role", "advisor")
        .eq("is_active", true)
        .order("display_name")
    : null;

  const historicalAdvisors = (advisorOptions?.data ?? []) as Array<{
    id: string;
    display_name: string;
  }>;

  const selectedAdvisorId = first(params.advisor);
  const roleScopedRows = currentUser.role === "advisor"
    ? data.rows.filter((row) => row.app_user_id === currentUser.id)
    : data.rows;
  const visibleRawRows = currentUser.role !== "advisor" && selectedAdvisorId
    ? roleScopedRows.filter((row) => row.app_user_id === selectedAdvisorId)
    : roleScopedRows;
  const visibleRecords = buildManualEodRecords(visibleRawRows);
  const groupedMonths = groupManualEodRecords(visibleRecords);

  const todayRoleRows = currentUser.role === "advisor"
    ? todayData.rows.filter((row) => row.app_user_id === currentUser.id)
    : todayData.rows;
  const todayVisibleRows = currentUser.role !== "advisor" && selectedAdvisorId
    ? todayRoleRows.filter((row) => row.app_user_id === selectedAdvisorId)
    : todayRoleRows;
  const todayRecords = buildManualEodRecords(todayVisibleRows);
  const todayRecord = currentUser.role === "advisor" || selectedAdvisorId
    ? todayRecords[0] ?? null
    : null;

  const latestDate = visibleRecords.at(-1)?.eodDate ?? null;
  const editSubmissionId = first(params.edit);
  const editRecord = visibleRecords.find((record) => record.submissionId === editSubmissionId) ?? null;
  const editRows = editRecord
    ? visibleRawRows.filter((row) => row.submission_id === editRecord.submissionId)
    : [];
  const editRowMap = new Map(editRows.map((row) => [row.metric_key, row]));
  const preservedRange = { ...dateRangeParams(range), ...(selectedAdvisorId ? { advisor: selectedAdvisorId } : {}) };
  const rangeQuery = new URLSearchParams(preservedRange).toString();
  const notice = first(params.notice);
  const error = first(params.error);
  const closeParams = new URLSearchParams(preservedRange);
  const yesterdayDate = (() => {
    const value = new Date(`${today}T12:00:00Z`);
    value.setUTCDate(value.getUTCDate() - 1);
    return value.toISOString().slice(0, 10);
  })();
  const todayEditParams = new URLSearchParams({
    range: "custom",
    from: today,
    to: today,
    ...(selectedAdvisorId ? { advisor: selectedAdvisorId } : {}),
    ...(todayRecord ? { edit: todayRecord.submissionId } : {}),
  });

  const editAllowed = editRecord
    ? currentUser.role === "admin" || (
        currentUser.role === "advisor" &&
        currentUser.id === editRecord.appUserId &&
        editRecord.status !== "validated"
      )
    : false;

  const totalRule = tr(
    locale,
    "Enter the final total for that day. Existing values are replaced, never added. Example: to correct 20 to 22, enter 22 — not +2.",
    "Ingresa el total final de ese día. Los valores existentes se reemplazan, nunca se suman. Ejemplo: para corregir 20 a 22, escribe 22 — no +2.",
  );

  return (
    <DashboardLayout
      eyebrow={tr(locale, "Daily reporting", "Reporte diario")}
      title="EOD"
      subtitle={tr(
        locale,
        "Review daily manual EODs, weekly totals and monthly totals. Click a date to correct its final values.",
        "Revisa los EOD manuales por día, totales semanales y totales mensuales. Haz clic en una fecha para corregir sus valores finales.",
      )}
      statusLabel={latestDate ? `${tr(locale, "Latest EOD", "Último EOD")} ${dateLabel(latestDate)}` : tr(locale, "No EOD", "Sin EOD")}
    >
      <DateRangeFilter basePath="/eod" range={range} locale={locale} preserve={{ advisor: selectedAdvisorId || undefined }} />

      {currentUser.role === "advisor" || currentUser.role === "admin" ? (
        <section className="eod-today-panel">
          <div className="eod-today-copy">
            <span className="eod-today-icon"><Clock3 size={20} /></span>
            <div>
              <p className="eyebrow">{tr(locale, "Today's EOD", "EOD de hoy")}</p>
              <h2>{dateLabel(today)}</h2>
              <span>{tr(locale, "Use this area for today's normal EOD. Previous dates are handled separately below.", "Usa esta sección para el EOD normal de hoy. Las fechas anteriores se manejan aparte abajo.")}</span>
            </div>
          </div>

          {todayRecord ? (
            <div className="eod-today-action">
              <span className="eod-table-status">{statusLabel(todayRecord.status, locale)}</span>
              <Link className="primary-button" href={`/eod?${todayEditParams.toString()}`}>
                <PencilLine size={16} />
                {todayRecord.status === "draft" || todayRecord.status === "blocked"
                  ? tr(locale, "Continue today's EOD", "Continuar EOD de hoy")
                  : todayRecord.status === "validated" && currentUser.role === "advisor"
                    ? tr(locale, "View today's EOD", "Ver EOD de hoy")
                    : tr(locale, "Edit today's EOD", "Editar EOD de hoy")}
              </Link>
            </div>
          ) : (
            <form action={openHistoricalEod} className="eod-today-action eod-today-create">
              <input name="historical_eod_date" type="hidden" value={today} />
              <input name="eod_context" type="hidden" value="today" />
              {currentUser.role === "admin" ? (
                selectedAdvisorId ? (
                  <input name="historical_advisor_id" type="hidden" value={selectedAdvisorId} />
                ) : (
                  <label>
                    <span>{tr(locale, "Advisor", "Asesora")}</span>
                    <select name="historical_advisor_id" required defaultValue="">
                      <option disabled value="">{tr(locale, "Select advisor", "Selecciona asesora")}</option>
                      {historicalAdvisors.map((advisor) => (
                        <option key={advisor.id} value={advisor.id}>{advisor.display_name}</option>
                      ))}
                    </select>
                  </label>
                )
              ) : null}
              <button className="primary-button" type="submit">
                <Send size={16} /> {tr(locale, "Fill today's EOD", "Subir EOD de hoy")}
              </button>
            </form>
          )}
        </section>
      ) : null}

      {currentUser.role !== "advisor" ? (
        <form action="/eod" className="eod-advisor-filter" method="get">
          {Object.entries(dateRangeParams(range)).map(([key, value]) => (
            <input key={key} name={key} type="hidden" value={value} />
          ))}
          <label>
            <span>{tr(locale, "Advisor view", "Vista de asesora")}</span>
            <select defaultValue={selectedAdvisorId} name="advisor">
              <option value="">{tr(locale, "All advisors", "Todas las asesoras")}</option>
              {historicalAdvisors.map((advisor) => (
                <option key={advisor.id} value={advisor.id}>{advisor.display_name}</option>
              ))}
            </select>
          </label>
          <button className="secondary-button" type="submit">{tr(locale, "Apply", "Aplicar")}</button>
        </form>
      ) : null}

      <section className="eod-history-toolbar">
        <div>
          <strong>{tr(locale, "Manual EOD history", "Historial manual EOD")}</strong>
          <span>{tr(locale, "Daily rows → weekly subtotal → monthly total", "Días → subtotal semanal → total mensual")}</span>
        </div>
        <Link className="secondary-button" href={`/eod/export?${rangeQuery}`}>
          <Download size={16} /> {tr(locale, "Export manual CSV", "Exportar CSV manual")}
        </Link>
      </section>

      {currentUser.role === "advisor" || currentUser.role === "admin" ? (
        <details className="historical-eod-panel" open={first(params.history) === "1"}>
          <summary>
            <CalendarPlus size={17} />
            <span>{tr(locale, "Add previous EOD", "Subir EOD anterior")}</span>
          </summary>
          <form action={openHistoricalEod} className="historical-eod-form">
            <label>
              <span>{tr(locale, "EOD date", "Fecha del EOD")}</span>
              <input max={yesterdayDate} name="historical_eod_date" required type="date" />
              <input name="eod_context" type="hidden" value="historical" />
            </label>

            {currentUser.role === "admin" ? (
              <label>
                <span>{tr(locale, "Advisor", "Asesora")}</span>
                <select name="historical_advisor_id" required defaultValue="">
                  <option disabled value="">{tr(locale, "Select advisor", "Selecciona asesora")}</option>
                  {historicalAdvisors.map((advisor) => (
                    <option key={advisor.id} value={advisor.id}>{advisor.display_name}</option>
                  ))}
                </select>
              </label>
            ) : null}

            <button className="primary-button" type="submit">
              <CalendarPlus size={16} /> {tr(locale, "Open previous EOD", "Abrir EOD anterior")}
            </button>
          </form>
        </details>
      ) : null}

      {error ? (
        <section className="eod-feedback eod-feedback-error">
          <AlertTriangle size={19} />
          <div><strong>{tr(locale, "Unable to save EOD", "No se pudo guardar el EOD")}</strong><span>{error}</span></div>
        </section>
      ) : null}

      {notice ? (
        <section className="eod-feedback eod-feedback-good">
          <CheckCircle2 size={19} />
          <div>
            <strong>{notice === "updated" ? tr(locale, "EOD Updated", "EOD Actualizado") : notice === "submitted" ? tr(locale, "EOD Submitted", "EOD Enviado") : tr(locale, "EOD Ready", "EOD Listo")}</strong>
            <span>{tr(locale, "The EOD table has been refreshed with the saved final totals.", "La tabla EOD se actualizó con los totales finales guardados.")}</span>
          </div>
        </section>
      ) : null}

      {groupedMonths.length ? groupedMonths.map((month) => (
        <section className="panel eod-history-panel" key={month.monthKey}>
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{tr(locale, "Manual EOD", "EOD Manual")}</p>
              <h2 className="capitalize-label">{formatMonth(month.monthKey, locale)}</h2>
            </div>
            <p className="panel-note">
              {tr(locale, `${month.totals.reportedDays} reported day(s) in this month.`, `${month.totals.reportedDays} día(s) reportado(s) en este mes.`)}
            </p>
          </div>

          <div className="table-scroll eod-history-scroll">
            <table className="eod-history-table">
              <thead>
                <tr>
                  <th>{tr(locale, "Date", "Fecha")}</th>
                  {currentUser.role !== "advisor" ? <th>{tr(locale, "Advisor", "Asesora")}</th> : null}
                  <th>{tr(locale, "Status", "Estado")}</th>
                  {MANUAL_EOD_KEYS.map((key) => (
                    <th key={key}>{labelFor(key, locale)} <HelpTip text={conceptDefinition(EOD_COPY[key].definitionKey, locale) ?? ""} /></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {month.weeks.map((week) => (
                  <FragmentWeek
                    currentUserRole={currentUser.role}
                    key={`${month.monthKey}-${week.weekStart}`}
                    locale={locale}
                    rangeQuery={rangeQuery}
                    week={week}
                  />
                ))}
                <tr className="eod-month-total-row">
                  <td colSpan={currentUser.role !== "advisor" ? 3 : 2}>
                    <strong>{tr(locale, "MONTH TOTAL", "TOTAL MES")}</strong>
                  </td>
                  {MANUAL_EOD_KEYS.map((key) => <td key={key}><strong>{totalCell(month.totals, key)}</strong></td>)}
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )) : (
        <EmptyState message={tr(locale, "No manual EOD data is available for this period.", "No hay datos EOD manuales disponibles para este periodo.")} />
      )}

      {editRecord ? (
        <div className="eod-modal-backdrop" role="presentation">
          <section aria-modal="true" className="eod-modal" role="dialog">
            <div className="eod-modal-heading">
              <div>
                <p className="eyebrow">{tr(locale, "Edit day", "Editar día")}</p>
                <h2>{dateLabel(editRecord.eodDate)} · {editRecord.advisorName}</h2>
                <span className="status-pill status-pending">{statusLabel(editRecord.status, locale)}</span>
              </div>
              <Link aria-label={tr(locale, "Close", "Cerrar")} className="eod-modal-close" href={`/eod?${closeParams.toString()}`}>
                <X size={20} />
              </Link>
            </div>

            <div className="eod-edit-rule">
              <strong>{tr(locale, "Edit final totals", "Editar totales finales")}</strong>
              <span>{totalRule}</span>
              <small>{tr(locale, "All fields are pre-filled. Change only what needs correction; unchanged fields remain the same and only real changes are written to Logs.", "Todos los campos vienen prellenados. Cambia solo lo necesario; los demás permanecen iguales y solo los cambios reales se escriben en Logs.")}</small>
            </div>

            <form action={saveEodSubmission} className="eod-simple-form">
              <input name="submission_id" type="hidden" value={editRecord.submissionId} />
              {Object.entries(preservedRange).map(([key, value]) => (
                <input key={key} name={key} type="hidden" value={value} />
              ))}

              <div className="eod-simple-grid">
                {MANUAL_EOD_KEYS.map((key) => {
                  const row = editRowMap.get(key);
                  if (!row) return null;
                  return (
                    <label className="eod-simple-field" key={key}>
                      <input name="metric_key" type="hidden" value={key} />
                      <span>{labelFor(key, locale)} <HelpTip text={`${conceptDefinition(EOD_COPY[key].definitionKey, locale) ?? row.description ?? ""} ${totalRule}`} /></span>
                      <input
                        defaultValue={row.declared_value ?? ""}
                        disabled={!editAllowed}
                        min="0"
                        name={`declared__${key}`}
                        placeholder="0"
                        step="1"
                        type="number"
                      />
                    </label>
                  );
                })}
              </div>

              <label className="eod-comments-field">
                <span>{tr(locale, "Notes / breakdown (optional)", "Notas / desglose (opcional)")}</span>
                <textarea defaultValue={editRecord.comments ?? ""} disabled={!editAllowed} name="comments" rows={3} />
              </label>

              <div className="eod-form-actions">
                {editAllowed ? (
                  ["submitted", "validated"].includes(editRecord.status) ? (
                    <button className="primary-button" name="intent" type="submit" value="submit"><Save size={16} /> {tr(locale, "Update EOD", "Actualizar EOD")}</button>
                  ) : (
                    <>
                      <button className="secondary-button" name="intent" type="submit" value="save"><Save size={16} /> {tr(locale, "Save Draft", "Guardar Borrador")}</button>
                      <button className="primary-button" name="intent" type="submit" value="submit"><Send size={16} /> {tr(locale, "Submit EOD", "Enviar EOD")}</button>
                    </>
                  )
                ) : <span className="eod-readonly-note">{tr(locale, "Read only for your role/status.", "Solo lectura para tu rol/estado.")}</span>}
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </DashboardLayout>
  );
}

function FragmentWeek({
  week,
  locale,
  rangeQuery,
  currentUserRole,
}: {
  week: ReturnType<typeof groupManualEodRecords>[number]["weeks"][number];
  locale: Locale;
  rangeQuery: string;
  currentUserRole: string;
}) {
  const columnSpan = currentUserRole !== "advisor" ? 12 : 11;
  return (
    <>
      <tr className="eod-week-heading-row">
        <td colSpan={columnSpan}>
          {tr(locale, "Week", "Semana")} · {formatShortDate(week.weekStart, locale)} – {formatShortDate(week.weekEnd, locale)}
        </td>
      </tr>
      {week.records.map((record) => (
        <tr key={record.submissionId}>
          <td>
            <Link className="eod-day-link" href={`/eod?${rangeQuery}&edit=${encodeURIComponent(record.submissionId)}`}>
              <PencilLine size={14} /> {dateLabel(record.eodDate)}
            </Link>
          </td>
          {currentUserRole !== "advisor" ? <td>{record.advisorName}</td> : null}
          <td><span className="eod-table-status">{statusLabel(record.status, locale)}</span></td>
          {MANUAL_EOD_KEYS.map((key) => <td key={key}>{record.values[key] === null ? "—" : number(record.values[key])}</td>)}
        </tr>
      ))}
      <tr className="eod-week-total-row">
        <td colSpan={currentUserRole !== "advisor" ? 3 : 2}><strong>{tr(locale, "WEEK TOTAL", "TOTAL SEMANA")}</strong></td>
        {MANUAL_EOD_KEYS.map((key) => <td key={key}><strong>{totalCell(week.totals, key)}</strong></td>)}
      </tr>
    </>
  );
}
