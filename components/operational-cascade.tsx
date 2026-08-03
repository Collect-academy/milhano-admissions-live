import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";

import type { OperationalCascadeMetric } from "@/lib/cascade";
import {
  dateRangeQuery,
  type DateRange,
} from "@/lib/date-range";
import { number } from "@/lib/format";

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
          Every scorecard is clickable. “School Tours Today”
          always uses the current date in Mérida.
        </p>
      </div>

      <div className="operational-cascade">
        {metrics.map((metric, index) => (
          <div
            className="cascade-step-wrapper"
            key={metric.metric_key}
          >
            <Link
              className="cascade-scorecard"
              href={`/leads?metric=${encodeURIComponent(
                metric.metric_key,
              )}&${query}`}
              title={metric.definition}
            >
              <div className="cascade-scorecard-top">
                <span>{index + 1}</span>
                {metric.metric_scope === "today" ? (
                  <CalendarDays size={15} />
                ) : null}
              </div>
              <strong>{number(metric.metric_value)}</strong>
              <h3>{metric.label}</h3>
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
