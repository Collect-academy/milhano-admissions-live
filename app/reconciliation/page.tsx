import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FilePenLine,
  GitCompareArrows,
  ShieldAlert,
} from "lucide-react";

import { saveReconciliationEntry } from "@/app/reconciliation/actions";
import { DashboardLayout } from "@/components/dashboard-layout";
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
import { requireCurrentAppUser } from "@/lib/auth";

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
  "meaningful_conversations",
  "qualified_leads",
  "school_tours_booked",
  "school_tours_today",
  "school_tours_attended",
  "trial_days_booked",
  "trial_days_showed",
  "closed",
]);

const statusLabels: Record<string, string> = {
  system: "System only",
  reconciled: "Reconciled",
  mixed: "Mixed data",
  mixed_reconciled: "Mixed · Reconciled",
  unreconciled: "Unreconciled gap",
  data_issue: "System / data issue",
  reported_manual: "Manual report",
  unreported: "No report",
};

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
  const currentUser = await requireCurrentAppUser();
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
      eyebrow="Data Quality"
      title="Reconciliation"
      subtitle="Compare immutable GHL/System data with reported totals and verified activity outside GHL."
      statusLabel={`Period ${dateLabel(range.start)} – ${dateLabel(
        range.end,
      )}`}
    >
      <DateRangeFilter
        basePath="/reconciliation"
        preserve={{ metric: selected?.metric_key }}
        range={range}
      />

      {error ? (
        <section className="eod-feedback eod-feedback-error">
          <AlertTriangle size={19} />
          <div>
            <strong>Unable to save adjustment</strong>
            <span>{error}</span>
          </div>
        </section>
      ) : null}

      {notice === "saved" ? (
        <section className="eod-feedback eod-feedback-good">
          <CheckCircle2 size={19} />
          <div>
            <strong>Reconciliation entry saved</strong>
            <span>
              The GHL number was not overwritten. The new report /
              manual-extra layer is now visible in the selected period.
            </span>
          </div>
        </section>
      ) : null}

      <section className="reconciliation-principle">
        <Database size={18} />
        <div>
          <strong>Operational Total = GHL/System + Known Outside GHL</strong>
          <span>
            “Reported Total” is evidence, not an automatic adjustment.
            The gap stays visible until the missing activity is verified.
          </span>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Metric map</p>
            <h2>System vs Reported</h2>
          </div>
          <p className="panel-note">
            Yellow means mixed/manual data or an open gap. Red is
            reserved for a known system/data-quality problem.
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
                <strong>{metric.label}</strong>
                <span
                  className={`status-pill ${statusClass(
                    metric.reconciliation_status,
                  )}`}
                >
                  {statusLabels[metric.reconciliation_status] ??
                    metric.reconciliation_status}
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
                  <span>Manual reporting dimension</span>
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
                <small>No reported total for this exact period</small>
              )}
            </Link>
          ))}
        </div>
      </section>

      {selected ? (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Selected metric</p>
              <h2>{selected.label}</h2>
            </div>
            <span
              className={`status-pill ${statusClass(
                selected.reconciliation_status,
              )}`}
            >
              {statusLabels[selected.reconciliation_status] ??
                selected.reconciliation_status}
            </span>
          </div>

          <div className="reconciliation-summary-grid">
            <article>
              <span>GHL / System</span>
              <strong>
                {selected.system_value === null
                  ? "—"
                  : number(selected.system_value)}
              </strong>
            </article>
            <article>
              <span>Known Outside GHL</span>
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
              <span>Operational Total</span>
              <strong>
                {selected.operational_total === null
                  ? "—"
                  : number(selected.operational_total)}
              </strong>
            </article>
            <article>
              <span>Reported Total</span>
              <strong>
                {selected.reported_value === null
                  ? "—"
                  : number(selected.reported_value)}
              </strong>
              <small>{selected.reported_source ?? "No report"}</small>
            </article>
            <article>
              <span>Remaining Gap</span>
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
                View GHL Records
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}

      {selected && currentUser.role === "admin" ? (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Admin correction / backfill</p>
              <h2>Add Report or Verified Manual Extra</h2>
            </div>
            <p className="panel-note">
              Use Manual Extra only when you know the activity is not
              already inside GHL or a submitted daily EOD.
            </p>
          </div>

          {selected.metric_scope === "today" ? (
            <div className="reconciliation-readonly">
              <ShieldAlert size={18} />
              <span>
                This metric is current-day system data and does not
                accept period-level manual adjustments.
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
                <span>Metric</span>
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
                        {metric.label}
                      </option>
                    ))}
                </select>
              </label>

              <label>
                <span>From</span>
                <input
                  defaultValue={range.start}
                  name="period_start"
                  required
                  type="date"
                />
              </label>

              <label>
                <span>To</span>
                <input
                  defaultValue={range.end}
                  name="period_end"
                  required
                  type="date"
                />
              </label>

              <label>
                <span>Reported by</span>
                <select name="advisor_app_user_id" defaultValue="">
                  <option value="">Team / external report</option>
                  {advisors.map((advisor) => (
                    <option key={advisor.id} value={advisor.id}>
                      {advisor.display_name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Reported Total</span>
                <input
                  min="0"
                  name="reported_value"
                  placeholder="Optional"
                  step="1"
                  type="number"
                />
              </label>

              <label>
                <span>Known Outside GHL</span>
                <input
                  disabled={!selected.supports_manual_extra}
                  min="0"
                  name="manual_extra_value"
                  placeholder={
                    selected.supports_manual_extra
                      ? "0"
                      : "Not additive"
                  }
                  step="1"
                  type="number"
                />
              </label>

              <label>
                <span>Entry Type</span>
                <select
                  defaultValue="admin_adjustment"
                  name="source_type"
                >
                  <option value="admin_adjustment">
                    Admin adjustment
                  </option>
                  <option value="historical_report">
                    Historical report
                  </option>
                </select>
              </label>

              <label className="reconciliation-note-field">
                <span>Evidence / reason</span>
                <input
                  name="note"
                  placeholder="Example: 3 WhatsApp calls confirmed outside GHL"
                  type="text"
                />
              </label>

              <label className="reconciliation-issue-check">
                <input name="system_issue_flag" type="checkbox" />
                <span>
                  Flag this metric as a known system/data-quality issue
                </span>
              </label>

              <button className="primary-button" type="submit">
                <FilePenLine size={16} />
                Save Reconciliation Entry
              </button>
            </form>
          )}
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Audit trail</p>
            <h2>
              {selected?.label ?? "Metric"} Entries · {range.label}
            </h2>
          </div>
        </div>

        {selectedEntries.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Advisor</th>
                  <th>Type</th>
                  <th>Reported</th>
                  <th>Manual Extra</th>
                  <th>System Issue</th>
                  <th>Note</th>
                  <th>Saved</th>
                  <th>Version</th>
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
                    <td>{entry.system_issue_flag ? "Yes" : "No"}</td>
                    <td>{entry.note ?? "—"}</td>
                    <td>{dateTimeLabel(entry.created_at)}</td>
                    <td>{entry.is_active ? "Current" : "Superseded"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="reconciliation-readonly">
            <GitCompareArrows size={18} />
            <span>No manual reconciliation entries overlap this period.</span>
          </div>
        )}
      </section>
    </DashboardLayout>
  );
}
