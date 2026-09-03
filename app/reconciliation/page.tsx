import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  FilePenLine,
  GitCompareArrows,
  ShieldAlert,
} from "lucide-react";

import { saveReconciliationEntry } from "@/app/reconciliation/actions";
import { DashboardLayout } from "@/components/dashboard-layout";
import { HelpTip } from "@/components/help-tip";
import { DateRangeFilter } from "@/components/date-range-filter";
import {
  getOperationalReconciliation,
  type OperationalCascadeMetric,
} from "@/lib/cascade";
import {
  dateRangeParams,
  dateRangeQuery,
  resolveDateRange,
} from "@/lib/date-range";
import { dateLabel, dateTimeLabel, number } from "@/lib/format";
import {
  getReconciliationEntries,
  getReconciliationUsers,
} from "@/lib/reconciliation";
import { requireAdmissionsAppUser } from "@/lib/auth";
import { getDashboardLocale } from "@/lib/i18n";
import { tr, type Locale } from "@/lib/locale";
import { conceptDefinition, metricLabel } from "@/lib/concepts";

export const dynamic = "force-dynamic";

type SearchParams = Record<
  string,
  string | string[] | undefined
>;

function first(
  value: string | string[] | undefined,
): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}


const SYSTEM_RECORD_KEYS = new Set([
  "new_leads",
  "number_of_dials",
  "answered_calls",
  "unique_contacted_leads",
  "responded_leads",
  "qualified_leads",
  "school_tours_booked",
  "school_tours_today",
  "school_tours_attended",
  "trial_days_booked",
  "trial_days_showed",
  "closed",
]);

function statusLabel(status: string, locale: Locale): string {
  const labels: Record<string, { en: string; es: string }> = {
    system: { en: "System only", es: "Solo sistema" },
    reconciled: { en: "Reconciled", es: "Reconciliado" },
    mixed: { en: "Mixed data", es: "Datos mixtos" },
    mixed_reconciled: { en: "Mixed · Reconciled", es: "Mixto · Reconciliado" },
    unreconciled: { en: "Unreconciled gap", es: "Gap sin reconciliar" },
    data_issue: { en: "System / data issue", es: "Problema de sistema / datos" },
    reported_manual: { en: "Manual report", es: "Reporte manual" },
    unreported: { en: "No report", es: "Sin reporte" },
  };
  return labels[status]?.[locale] ?? status;
}

function statusClass(status: string): string {
  if (["reconciled", "system"].includes(status)) {
    return "status-good";
  }
  if (status === "data_issue") return "status-bad";
  return "status-pending";
}

function metricHref(
  metric: OperationalCascadeMetric,
  rangeQuery: string,
): string {
  return `/reconciliation?metric=${encodeURIComponent(
    metric.metric_key,
  )}&${rangeQuery}`;
}

export default async function ReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const currentUser = await requireAdmissionsAppUser();
  const locale = await getDashboardLocale();
  const params = await searchParams;
  const range = resolveDateRange(params);
  const [metrics, entries, users] = await Promise.all([
    getOperationalReconciliation(range),
    getReconciliationEntries(range),
    getReconciliationUsers(),
  ]);

  const requestedMetric = first(params.metric);
  const selected =
    metrics.find((metric) => metric.metric_key === requestedMetric) ??
    metrics.find((metric) => metric.metric_key === "new_leads") ??
    metrics[0];

  const rangeQuery = dateRangeQuery(range);
  const preservedRange = dateRangeParams(range);
  const userNames = new Map(
    users.map((user) => [user.id, user.display_name]),
  );
  const selectedEntries = entries.filter(
    (entry) => entry.metric_key === selected?.metric_key,
  );
  const error = first(params.error);
  const notice = first(params.notice);
  const advisors = users.filter((user) => user.role === "advisor");

  return (
    <DashboardLayout
      eyebrow={tr(locale, "Data Quality", "Calidad de Datos")}
      title={tr(locale, "Reconciliation", "Reconciliación")}
      subtitle={tr(locale, "Compare immutable GHL/System data with reported totals and verified activity outside GHL.", "Compara los datos inmutables de GHL/Sistema con los totales reportados y la actividad verificada fuera de GHL.")}
      statusLabel={`${tr(locale, "Period", "Periodo")} ${dateLabel(range.start)} – ${dateLabel(range.end)}`}
    >
      <DateRangeFilter
        basePath="/reconciliation"
        preserve={{ metric: selected?.metric_key }}
        range={range}
        locale={locale}
      />

      <section className="reconciliation-report-bar">
        <div>
          <strong>{tr(locale, "GHL tracking gap report", "Reporte de fuga de tracking GHL")}</strong>
          <span>{tr(locale, "Compare each KPI's GHL/System count with the reported total, verified outside-GHL activity and unresolved gap.", "Compara el conteo GHL/Sistema de cada KPI con el total reportado, la actividad verificada fuera de GHL y el gap pendiente.")}</span>
        </div>
        <a className="secondary-button report-download-link" href={`/reconciliation/export?${rangeQuery}`}>
          <Download size={16} /> {tr(locale, "Download CSV", "Descargar CSV")}
        </a>
      </section>

      {error ? (
        <section className="eod-feedback eod-feedback-error">
          <AlertTriangle size={19} />
          <div>
            <strong>{tr(locale, "Unable to save adjustment", "No se pudo guardar el ajuste")}</strong>
            <span>{error}</span>
          </div>
        </section>
      ) : null}

      {notice === "saved" ? (
        <section className="eod-feedback eod-feedback-good">
          <CheckCircle2 size={19} />
          <div>
            <strong>{tr(locale, "Reconciliation entry saved", "Entrada de reconciliación guardada")}</strong>
            <span>
              {tr(locale, "The GHL number was not overwritten. The new report / manual-extra layer is now visible in the selected period.", "El número de GHL no fue sobrescrito. La nueva capa de reporte / manual extra ya es visible en el periodo seleccionado.")}
            </span>
          </div>
        </section>
      ) : null}

      <section className="reconciliation-principle">
        <Database size={18} />
        <div>
          <strong>{tr(locale, "Operational Total = GHL/System + Known Outside GHL", "Total Operativo = GHL/Sistema + Conocido Fuera de GHL")}</strong>
          <span>
            {tr(locale, "“Reported Total” is evidence, not an automatic adjustment. The gap stays visible until the missing activity is verified.", "“Total Reportado” es evidencia, no un ajuste automático. El gap permanece visible hasta verificar la actividad faltante.")}
          </span>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{tr(locale, "Metric map", "Mapa de métricas")}</p>
            <h2>{tr(locale, "System vs Reported", "Sistema vs Reportado")}</h2>
          </div>
          <p className="panel-note">
            {tr(locale, "Yellow means mixed/manual data or an open gap. Red is reserved for a known system/data-quality problem.", "Amarillo significa datos mixtos/manuales o un gap abierto. Rojo se reserva para un problema conocido de sistema/calidad de datos.")}
          </p>
        </div>

        <div className="reconciliation-metric-grid">
          {metrics.map((metric) => (
            <Link
              className={`reconciliation-metric-card ${
                selected?.metric_key === metric.metric_key
                  ? "reconciliation-metric-selected"
                  : ""
              }`}
              href={metricHref(metric, rangeQuery)}
              key={metric.metric_key}
            >
              <div>
                <strong>{metricLabel(metric.metric_key, locale, metric.label)} <HelpTip text={metric.definition} /></strong>
                <span
                  className={`status-pill ${statusClass(
                    metric.reconciliation_status,
                  )}`}
                >
                  {statusLabel(metric.reconciliation_status, locale)}
                </span>
              </div>
              {metric.system_value !== null ? (
                <p>
                  <b>{number(metric.operational_total)}</b>
                  <span>
                    GHL {number(metric.system_value)}
                    {metric.manual_extra_value > 0
                      ? ` · +${number(
                          metric.manual_extra_value,
                        )} manual`
                      : ""}
                  </span>
                </p>
              ) : (
                <p>
                  <b>
                    {metric.reported_value === null
                      ? "—"
                      : number(metric.reported_value)}
                  </b>
                  <span>{tr(locale, "Manual reporting dimension", "Dimensión de reporte manual")}</span>
                </p>
              )}
              {metric.reported_value !== null ? (
                <small>
                  Reported {number(metric.reported_value)}
                  {metric.gap !== null && metric.gap !== 0
                    ? ` · Gap ${metric.gap > 0 ? "+" : ""}${number(
                        metric.gap,
                      )}`
                    : ""}
                </small>
              ) : (
                <small>{tr(locale, "No reported total for this exact period", "Sin total reportado para este periodo exacto")}</small>
              )}
            </Link>
          ))}
        </div>
      </section>

      {selected ? (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{tr(locale, "Selected metric", "Métrica seleccionada")}</p>
              <h2>{metricLabel(selected.metric_key, locale, selected.label)} <HelpTip text={selected.definition} /></h2>
            </div>
            <span
              className={`status-pill ${statusClass(
                selected.reconciliation_status,
              )}`}
            >
              {statusLabel(selected.reconciliation_status, locale)}
            </span>
          </div>

          <div className="reconciliation-summary-grid">
            <article>
              <span>GHL / {tr(locale, "System", "Sistema")} <HelpTip text={conceptDefinition("system_value", locale)} /></span>
              <strong>
                {selected.system_value === null
                  ? "—"
                  : number(selected.system_value)}
              </strong>
            </article>
            <article>
              <span>{tr(locale, "Known Outside GHL", "Conocido Fuera de GHL")} <HelpTip text={conceptDefinition("manual_extra", locale)} /></span>
              <strong>
                +{number(selected.manual_extra_value)}
              </strong>
              <small>
                EOD {number(selected.eod_manual_extra)} · Admin {number(
                  selected.admin_manual_extra,
                )}
              </small>
            </article>
            <article>
              <span>{tr(locale, "Operational Total", "Total Operativo")} <HelpTip text={conceptDefinition("operational_total", locale)} /></span>
              <strong>
                {selected.operational_total === null
                  ? "—"
                  : number(selected.operational_total)}
              </strong>
            </article>
            <article>
              <span>{tr(locale, "Reported Total", "Total Reportado")} <HelpTip text={conceptDefinition("reported_total", locale)} /></span>
              <strong>
                {selected.reported_value === null
                  ? "—"
                  : number(selected.reported_value)}
              </strong>
              <small>{selected.reported_source ?? "No report"}</small>
            </article>
            <article>
              <span>{tr(locale, "Remaining Gap", "Gap Restante")} <HelpTip text={conceptDefinition("gap", locale)} /></span>
              <strong>
                {selected.gap === null
                  ? "—"
                  : `${selected.gap > 0 ? "+" : ""}${number(
                      selected.gap,
                    )}`}
              </strong>
            </article>
          </div>

          <div className="reconciliation-definition">
            <GitCompareArrows size={17} />
            <span>{selected.definition}</span>
            {selected.system_value !== null &&
            SYSTEM_RECORD_KEYS.has(selected.metric_key) ? (
              <Link
                className="secondary-button"
                href={`/leads?metric=${encodeURIComponent(
                  selected.metric_key,
                )}&${rangeQuery}`}
              >
                {tr(locale, "View GHL Records", "Ver Registros GHL")}
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}

      {selected && currentUser.role === "admin" ? (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{tr(locale, "Admin correction / backfill", "Corrección admin / backfill")}</p>
              <h2>{tr(locale, "Add Report or Verified Manual Extra", "Agregar Reporte o Manual Extra Verificado")}</h2>
            </div>
            <p className="panel-note">
              {tr(locale, "Use Manual Extra only when you know the activity is not already inside GHL or a submitted daily EOD.", "Usa Manual Extra solo cuando sepas que la actividad no está ya dentro de GHL o de un EOD diario enviado.")}
            </p>
          </div>

          {selected.metric_scope === "today" ? (
            <div className="reconciliation-readonly">
              <ShieldAlert size={18} />
              <span>
                {tr(locale, "This metric is current-day system data and does not accept period-level manual adjustments.", "Esta métrica es dato de sistema del día actual y no acepta ajustes manuales por periodo.")}
              </span>
            </div>
          ) : (
            <form
              action={saveReconciliationEntry}
              className="reconciliation-form"
            >
              {Object.entries(preservedRange).map(([key, value]) => (
                <input
                  key={key}
                  name={key}
                  type="hidden"
                  value={value}
                />
              ))}
              <input
                name="metric"
                type="hidden"
                value={selected.metric_key}
              />

              <label>
                <span>{tr(locale, "Metric", "Métrica")}</span>
                <select
                  defaultValue={selected.metric_key}
                  name="metric_key"
                >
                  {metrics
                    .filter(
                      (metric) => metric.metric_scope !== "today",
                    )
                    .map((metric) => (
                      <option
                        key={metric.metric_key}
                        value={metric.metric_key}
                      >
                        {metricLabel(metric.metric_key, locale, metric.label)}
                      </option>
                    ))}
                </select>
              </label>

              <label>
                <span>{tr(locale, "From", "Desde")}</span>
                <input
                  defaultValue={range.start}
                  name="period_start"
                  required
                  type="date"
                />
              </label>

              <label>
                <span>{tr(locale, "To", "Hasta")}</span>
                <input
                  defaultValue={range.end}
                  name="period_end"
                  required
                  type="date"
                />
              </label>

              <label>
                <span>{tr(locale, "Reported by", "Reportado por")}</span>
                <select name="advisor_app_user_id" defaultValue="">
                  <option value="">{tr(locale, "Team / external report", "Equipo / reporte externo")}</option>
                  {advisors.map((advisor) => (
                    <option key={advisor.id} value={advisor.id}>
                      {advisor.display_name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>{tr(locale, "Reported Total", "Total Reportado")} <HelpTip text={conceptDefinition("reported_total", locale)} /></span>
                <input
                  min="0"
                  name="reported_value"
                  placeholder={tr(locale, "Optional", "Opcional")}
                  step="1"
                  type="number"
                />
              </label>

              <label>
                <span>{tr(locale, "Known Outside GHL", "Conocido Fuera de GHL")} <HelpTip text={conceptDefinition("manual_extra", locale)} /></span>
                <input
                  disabled={!selected.supports_manual_extra}
                  min="0"
                  name="manual_extra_value"
                  placeholder={
                    selected.supports_manual_extra
                      ? "0"
                      : tr(locale, "Not additive", "No aditivo")
                  }
                  step="1"
                  type="number"
                />
              </label>

              <label>
                <span>{tr(locale, "Entry Type", "Tipo de Entrada")}</span>
                <select
                  defaultValue="admin_adjustment"
                  name="source_type"
                >
                  <option value="admin_adjustment">
                    {tr(locale, "Admin adjustment", "Ajuste admin")}
                  </option>
                  <option value="historical_report">
                    {tr(locale, "Historical report", "Reporte histórico")}
                  </option>
                </select>
              </label>

              <label className="reconciliation-note-field">
                <span>{tr(locale, "Evidence / reason", "Evidencia / razón")}</span>
                <input
                  name="note"
                  placeholder={tr(locale, "Example: 3 WhatsApp calls confirmed outside GHL", "Ejemplo: 3 llamadas WhatsApp confirmadas fuera de GHL")}
                  type="text"
                />
              </label>

              <label className="reconciliation-issue-check">
                <input name="system_issue_flag" type="checkbox" />
                <span>
                  {tr(locale, "Flag this metric as a known system/data-quality issue", "Marcar esta métrica como problema conocido de sistema/calidad de datos")}
                </span>
              </label>

              <button className="primary-button" type="submit">
                <FilePenLine size={16} />
                {tr(locale, "Save Reconciliation Entry", "Guardar Reconciliación")}
              </button>
            </form>
          )}
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{tr(locale, "Audit trail", "Historial de Auditoría")}</p>
            <h2>
              {selected ? metricLabel(selected.metric_key, locale, selected.label) : tr(locale, "Metric", "Métrica")} {tr(locale, "Entries", "Entradas")} · {range.label}
            </h2>
          </div>
        </div>

        {selectedEntries.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{tr(locale, "Period", "Periodo")}</th>
                  <th>{tr(locale, "Advisor", "Asesora")}</th>
                  <th>{tr(locale, "Type", "Tipo")}</th>
                  <th>{tr(locale, "Reported", "Reportado")}</th>
                  <th>{tr(locale, "Manual Extra", "Manual Extra")}</th>
                  <th>{tr(locale, "System Issue", "Problema Sistema")}</th>
                  <th>{tr(locale, "Note", "Nota")}</th>
                  <th>{tr(locale, "Saved", "Guardado")}</th>
                  <th>{tr(locale, "Version", "Versión")}</th>
                </tr>
              </thead>
              <tbody>
                {selectedEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      {entry.period_start} → {entry.period_end}
                    </td>
                    <td>
                      {entry.advisor_app_user_id
                        ? userNames.get(entry.advisor_app_user_id) ??
                          "Unknown"
                        : "Team"}
                    </td>
                    <td>{entry.source_type}</td>
                    <td>
                      {entry.reported_value === null
                        ? "—"
                        : number(entry.reported_value)}
                    </td>
                    <td>+{number(entry.manual_extra_value)}</td>
                    <td>{entry.system_issue_flag ? tr(locale, "Yes", "Sí") : tr(locale, "No", "No")}</td>
                    <td>{entry.note ?? "—"}</td>
                    <td>{dateTimeLabel(entry.created_at)}</td>
                    <td>{entry.is_active ? tr(locale, "Current", "Actual") : tr(locale, "Superseded", "Reemplazada")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="reconciliation-readonly">
            <GitCompareArrows size={18} />
            <span>{tr(locale, "No manual reconciliation entries overlap this period.", "No hay entradas manuales de reconciliación que coincidan con este periodo.")}</span>
          </div>
        )}
      </section>
    </DashboardLayout>
  );
}
