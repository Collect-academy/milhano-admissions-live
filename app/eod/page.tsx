import {
  AlertTriangle,
  CheckCircle2,
  Save,
  Send,
} from "lucide-react";

import { saveEodSubmission } from "@/app/eod/actions";
import { DashboardLayout } from "@/components/dashboard-layout";
import { DateRangeFilter } from "@/components/date-range-filter";
import { EmptyState } from "@/components/empty-state";
import { HelpTip } from "@/components/help-tip";
import { conceptDefinition } from "@/lib/concepts";
import { requireCurrentAppUser } from "@/lib/auth";
import { dateRangeParams, resolveDateRange } from "@/lib/date-range";
import { getEodData } from "@/lib/data";
import { dateLabel, dateTimeLabel, number } from "@/lib/format";
import { getDashboardLocale } from "@/lib/i18n";
import { tr, type Locale } from "@/lib/locale";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

const SIMPLE_EOD_KEYS = [
  "new_leads_received",
  "ads_leads_reported",
  "organic_leads_reported",
  "contacted_reported",
  "responses_reported",
  "qualified_leads",
  "school_tours_scheduled",
  "school_tours_attended",
] as const;

const EOD_COPY: Record<string, {
  definitionKey: string;
  en: string;
  es: string;
}> = {
  new_leads_received: { definitionKey: "new_leads", en: "Total Leads", es: "Leads Totales" },
  ads_leads_reported: { definitionKey: "ads_leads", en: "Ads Leads", es: "Leads Ads" },
  organic_leads_reported: { definitionKey: "organic_leads", en: "Organic Leads", es: "Orgánico" },
  contacted_reported: { definitionKey: "contacted_reported", en: "Contacted", es: "Contactados" },
  responses_reported: { definitionKey: "responses_reported", en: "# Responses", es: "# Respuestas" },
  qualified_leads: { definitionKey: "qualified_leads", en: "Qualified / Fit", es: "Qualified / Fit" },
  school_tours_scheduled: { definitionKey: "school_tours_booked", en: "ST Booked", es: "ST Booked" },
  school_tours_attended: { definitionKey: "school_tours_attended", en: "ST Attended", es: "ST Attended" },
};

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function labelFor(key: string, locale: Locale): string {
  const copy = EOD_COPY[key];
  if (!copy) return key;
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

export default async function EodPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const currentUser = await requireCurrentAppUser();
  const locale = await getDashboardLocale();
  const params = await searchParams;
  const range = resolveDateRange(params);
  const data = await getEodData(range);

  const latestDate = data.rows[0]?.eod_date ?? null;
  const latestRows = latestDate
    ? data.rows.filter((row) => row.eod_date === latestDate)
    : [];

  const visibleRows = currentUser.role === "advisor"
    ? latestRows.filter((row) => row.app_user_id === currentUser.id)
    : latestRows;

  const groups = new Map<string, {
    appUserId: string;
    submissionId: string;
    status: string;
    comments: string | null;
    submittedAt: string | null;
    rows: typeof visibleRows;
  }>();

  for (const row of visibleRows) {
    const current = groups.get(row.display_name) ?? {
      appUserId: row.app_user_id,
      submissionId: row.submission_id,
      status: row.submission_status,
      comments: row.submission_comments,
      submittedAt: row.submitted_at,
      rows: [],
    };
    current.rows.push(row);
    groups.set(row.display_name, current);
  }

  const preservedRange = dateRangeParams(range);
  const notice = first(params.notice);
  const error = first(params.error);

  return (
    <DashboardLayout
      eyebrow={tr(locale, "Daily report", "Reporte diario")}
      title="EOD"
      subtitle={tr(
        locale,
        "Enter the same simple numbers you would report to the team. The EOD can be submitted even when GHL differs.",
        "Ingresa los mismos números simples que reportarías al equipo. El EOD se puede enviar aunque GHL no cuadre.",
      )}
      statusLabel={latestDate ? `${tr(locale, "EOD", "EOD")} ${dateLabel(latestDate)}` : tr(locale, "No snapshot", "Sin snapshot")}
    >
      <DateRangeFilter basePath="/eod" range={range} locale={locale} />

      <section className="scope-banner eod-simple-banner">
        <CheckCircle2 size={19} />
        <div>
          <strong>{tr(locale, "Simple reporting", "Reporte simple")}</strong>
          <span>
            {tr(
              locale,
              "No GHL confirmation is required here. System-vs-reported differences are reviewed later in Reconciliation.",
              "Aquí no necesitas confirmar GHL. Las diferencias entre sistema y reporte se revisan después en Reconciliación.",
            )}
          </span>
        </div>
      </section>

      {error ? (
        <section className="eod-feedback eod-feedback-error">
          <AlertTriangle size={19} />
          <div><strong>{tr(locale, "Unable to save EOD", "No se pudo guardar el EOD")}</strong><span>{error}</span></div>
        </section>
      ) : null}

      {notice === "submitted" || notice === "saved" ? (
        <section className="eod-feedback eod-feedback-good">
          <CheckCircle2 size={19} />
          <div>
            <strong>{notice === "submitted" ? tr(locale, "EOD Submitted", "EOD Enviado") : tr(locale, "Draft Saved", "Borrador Guardado")}</strong>
            <span>{tr(locale, "Your reported numbers were saved. Any discrepancy remains auditable without blocking submission.", "Tus números reportados quedaron guardados. Cualquier discrepancia permanece auditable sin bloquear el envío.")}</span>
          </div>
        </section>
      ) : null}

      {groups.size ? (
        [...groups.entries()].map(([displayName, group]) => {
          const editable = currentUser.role === "admin" || (
            currentUser.role === "advisor" && currentUser.id === group.appUserId && !["submitted", "validated"].includes(group.status)
          );
          const rowMap = new Map(group.rows.map((row) => [row.metric_key, row]));
          const simpleRows = SIMPLE_EOD_KEYS
            .map((key) => rowMap.get(key))
            .filter((row): row is NonNullable<typeof row> => Boolean(row));

          const total = rowMap.get("new_leads_received")?.declared_value ?? null;
          const ads = rowMap.get("ads_leads_reported")?.declared_value ?? null;
          const organic = rowMap.get("organic_leads_reported")?.declared_value ?? null;
          const acquisitionMismatch = total !== null && ads !== null && organic !== null && total !== ads + organic;

          return (
            <section className="panel eod-simple-card" key={group.submissionId}>
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">{tr(locale, "Advisor EOD", "EOD Asesora")}</p>
                  <h2>{displayName}</h2>
                </div>
                <div className="eod-simple-status">
                  <span className="status-pill status-pending">{statusLabel(group.status, locale)}</span>
                  {group.submittedAt ? <small>{dateTimeLabel(group.submittedAt)}</small> : null}
                </div>
              </div>

              {acquisitionMismatch ? (
                <div className="eod-inline-warning">
                  <AlertTriangle size={16} />
                  <span>{tr(locale, `Ads + Organic = ${number((ads ?? 0) + (organic ?? 0))}, but Total Leads = ${number(total)}. You may still submit; this is only a warning.`, `Ads + Orgánico = ${number((ads ?? 0) + (organic ?? 0))}, pero Leads Totales = ${number(total)}. Puedes enviar de todas formas; solo es una alerta.`)}</span>
                </div>
              ) : null}

              <form action={saveEodSubmission} className="eod-simple-form">
                <input name="submission_id" type="hidden" value={group.submissionId} />
                {Object.entries(preservedRange).map(([key, value]) => (
                  <input key={key} name={key} type="hidden" value={value} />
                ))}

                <div className="eod-simple-grid">
                  {simpleRows.map((row) => {
                    const copy = EOD_COPY[row.metric_key];
                    return (
                      <label className="eod-simple-field" key={row.metric_key}>
                        <input name="metric_key" type="hidden" value={row.metric_key} />
                        <span>
                          {labelFor(row.metric_key, locale)}{" "}
                          <HelpTip text={copy ? conceptDefinition(copy.definitionKey, locale) : row.description} />
                        </span>
                        <input
                          defaultValue={row.declared_value ?? ""}
                          disabled={!editable}
                          min="0"
                          name={`declared__${row.metric_key}`}
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
                  <textarea
                    defaultValue={group.comments ?? ""}
                    disabled={!editable}
                    name="comments"
                    placeholder={tr(locale, "Example: Contacted = 21 calls + 12 WhatsApp. Mention anything outside GHL here.", "Ejemplo: Contactados = 21 llamadas + 12 WhatsApp. Anota aquí cualquier actividad fuera de GHL.")}
                    rows={3}
                  />
                </label>

                <div className="eod-form-actions">
                  {editable ? (
                    <>
                      <button className="secondary-button" name="intent" type="submit" value="save">
                        <Save size={16} /> {tr(locale, "Save Draft", "Guardar Borrador")}
                      </button>
                      <button className="primary-button" name="intent" type="submit" value="submit">
                        <Send size={16} /> {tr(locale, "Submit EOD", "Enviar EOD")}
                      </button>
                    </>
                  ) : (
                    <span className="eod-readonly-note">{tr(locale, "Read-only EOD.", "EOD de solo lectura.")}</span>
                  )}
                </div>
              </form>
            </section>
          );
        })
      ) : (
        <EmptyState message={tr(locale, "No EOD snapshot is available for this period.", "No hay snapshot EOD disponible para este periodo.")} />
      )}
    </DashboardLayout>
  );
}
