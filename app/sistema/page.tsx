import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  Clock3,
  DatabaseZap,
  Info,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import { DashboardLayout } from "@/components/dashboard-layout";
import { EmptyState } from "@/components/empty-state";
import { KpiCard } from "@/components/kpi-card";
import { dateTimeLabel, number } from "@/lib/format";
import { getSystemHealthData } from "@/lib/system-health";

export const dynamic = "force-dynamic";

const statusLabels = {
  healthy: "Healthy",
  warning: "Warning",
  error: "Error",
  pending: "Pending",
  unknown: "Unknown",
  pass: "Pass",
  info: "Info",
};

function statusClass(status: string): string {
  if (status === "healthy" || status === "pass") {
    return "status-pill status-good";
  }

  if (status === "error") {
    return "status-pill status-bad";
  }

  return "status-pill status-pending";
}

function ageLabel(minutes: number | null): string {
  if (minutes === null) return "No execution";

  if (minutes < 60) {
    return `${Math.round(minutes)} min`;
  }

  if (minutes < 1440) {
    return `${Math.round(minutes / 60)} hr`;
  }

  return `${Math.round(minutes / 1440)} days`;
}

export default async function SystemPage() {
  const data = await getSystemHealthData();

  const healthy = data.health.filter(
    (row) => row.status === "healthy",
  ).length;
  const warning = data.health.filter(
    (row) =>
      row.status === "warning" ||
      row.status === "unknown",
  ).length;
  const errors =
    data.health.filter((row) => row.status === "error").length +
    data.quality.filter((row) => row.status === "error").length;
  const qualityIssues = data.quality.reduce(
    (total, row) =>
      total +
      (row.status === "warning" || row.status === "error"
        ? row.issue_count
        : 0),
    0,
  );

  return (
    <DashboardLayout
      eyebrow="Reliability"
      title="System Health"
      subtitle="Synchronization freshness and basic data-quality checks."
      statusLabel={`Overall Status: ${
        statusLabels[data.overallStatus]
      }`}
    >
      <section
        className={
          data.overallStatus === "healthy"
            ? "scope-banner scope-banner-success"
            : data.overallStatus === "error"
              ? "scope-banner system-banner-error"
              : "scope-banner"
        }
      >
        {data.overallStatus === "healthy" ? (
          <ShieldCheck size={20} />
        ) : data.overallStatus === "error" ? (
          <XCircle size={20} />
        ) : (
          <AlertTriangle size={20} />
        )}
        <div>
          <strong>
            {data.overallStatus === "healthy"
              ? "Monitored components are within their expected windows."
              : data.overallStatus === "error"
                ? "At least one component or data check is in error."
                : "Some components are pending or require review."}
          </strong>
          <span>
            This monitor detects stale data; it does not replace
            GHL reconciliation.
          </span>
        </div>
      </section>

      <section className="kpi-grid pipeline-kpi-grid">
        <KpiCard
          label="Healthy Components"
          value={number(healthy)}
          helper={`${number(data.health.length)} monitored`}
          icon={CheckCircle2}
        />
        <KpiCard
          label="Warnings"
          value={number(warning)}
          helper="Require observation"
          icon={AlertTriangle}
        />
        <KpiCard
          label="Errors"
          value={number(errors)}
          helper="Require action"
          icon={XCircle}
        />
        <KpiCard
          label="Data Issues"
          value={number(qualityIssues)}
          helper="Warnings + errors"
          icon={DatabaseZap}
        />
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Freshness</p>
            <h2>Operational Components</h2>
          </div>
          <p className="panel-note">
            WhatsApp and Calls should update every 15 minutes.
          </p>
        </div>

        {data.health.length ? (
          <div className="health-card-grid">
            {data.health.map((row) => (
              <article
                className="health-component-card"
                key={row.component_key}
              >
                <div className="health-card-heading">
                  <strong>{row.component_label}</strong>
                  <span className={statusClass(row.status)}>
                    {statusLabels[row.status]}
                  </span>
                </div>

                <div className="health-card-meta">
                  <div>
                    <Clock3 size={15} />
                    <span>
                      Last Success:{" "}
                      {dateTimeLabel(row.last_success_at)}
                    </span>
                  </div>
                  <div>
                    <CircleHelp size={15} />
                    <span>
                      Age: {ageLabel(row.age_minutes)}
                    </span>
                  </div>
                </div>

                <details>
                  <summary>Technical Details</summary>
                  <pre>
                    {JSON.stringify(row.details, null, 2)}
                  </pre>
                </details>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState message="No health checks have been generated yet." />
        )}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Validation</p>
            <h2>Data Quality</h2>
          </div>
          <p className="panel-note">
            Informational checks do not invalidate KPIs.
          </p>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Check</th>
                <th>Status</th>
                <th>Records</th>
                <th>Impact / Context</th>
                <th>Checked</th>
              </tr>
            </thead>
            <tbody>
              {data.quality.map((row) => (
                <tr key={row.check_key}>
                  <td>{row.check_label}</td>
                  <td>
                    <span className={statusClass(row.status)}>
                      {statusLabels[row.status]}
                    </span>
                  </td>
                  <td>{number(row.issue_count)}</td>
                  <td>
                    <code className="inline-json">
                      {JSON.stringify(row.details)}
                    </code>
                  </td>
                  <td>{dateTimeLabel(row.last_checked_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <section className="monitoring-note">
          <Info size={18} />
          <p>
            Manual messages from the shared WhatsApp channel without
            a user are expected. Team volume remains
            valid even without individual attribution.
          </p>
        </section>
      </section>
    </DashboardLayout>
  );
}
