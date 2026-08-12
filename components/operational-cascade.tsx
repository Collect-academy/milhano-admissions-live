import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";

import type { OperationalCascadeMetric } from "@/lib/cascade";
import {
  dateRangeQuery,
  type DateRange,
} from "@/lib/date-range";
import { number } from "@/lib/format";

const statusLabels: Record<string, string> = {
  system: "System",
  reconciled: "Reconciled",
  mixed: "Mixed",
  mixed_reconciled: "Mixed · Reconciled",
  unreconciled: "Gap",
  data_issue: "Data issue",
  reported_manual: "Reported",
  unreported: "No report",
};

function statusTone(status: string): string {
  if (status === "data_issue") return "cascade-tone-error";
  if (status === "unreconciled") return "cascade-tone-gap";
  if (["mixed", "mixed_reconciled"].includes(status)) {
    return "cascade-tone-mixed";
  }
  if (["reconciled", "system"].includes(status)) {
    return "cascade-tone-good";
  }
  return "cascade-tone-neutral";
}

export function OperationalCascade({
  metrics,
  range,
}: {
  metrics: OperationalCascadeMetric[];
  range: DateRange;
}) {
  const query = dateRangeQuery(range);

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Unified terminology</p>
          <h2>Admissions Operational Cascade</h2>
        </div>
        <p className="panel-note">
          Total = GHL/System + verified Manual Extra. Click any
          scorecard to see the system count, reported count and gap.
        </p>
      </div>

      <div className="operational-cascade">
        {metrics.map((metric, index) => (
          <div
            className="cascade-step-wrapper"
            key={metric.metric_key}
          >
            <Link
              className={`cascade-scorecard ${statusTone(
                metric.reconciliation_status,
              )}`}
              href={`/reconciliation?metric=${encodeURIComponent(
                metric.metric_key,
              )}&${query}`}
              title={metric.definition}
            >
              <div className="cascade-scorecard-top">
                <span>{index + 1}</span>
                <div className="cascade-top-meta">
                  {metric.metric_scope === "today" ? (
                    <CalendarDays size={15} />
                  ) : null}
                  <small>
                    {statusLabels[metric.reconciliation_status] ??
                      metric.reconciliation_status}
                  </small>
                </div>
              </div>
              <strong>{number(metric.metric_value)}</strong>
              <h3>{metric.label}</h3>
              <div className="cascade-breakdown">
                <span>
                  GHL {number(metric.system_value)}
                </span>
                {metric.manual_extra_value > 0 ? (
                  <span>
                    +{number(metric.manual_extra_value)} manual
                  </span>
                ) : null}
                {metric.reported_value !== null ? (
                  <span>
                    Reported {number(metric.reported_value)}
                  </span>
                ) : null}
                {metric.gap !== null && metric.gap !== 0 ? (
                  <span className="cascade-gap-text">
                    Gap {metric.gap > 0 ? "+" : ""}
                    {number(metric.gap)}
                  </span>
                ) : null}
              </div>
              <p>
                {metric.metric_scope === "today"
                  ? "Current day"
                  : range.label}
              </p>
            </Link>

            {index < metrics.length - 1 ? (
              <ArrowRight
                aria-hidden="true"
                className="cascade-arrow"
                size={18}
              />
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
