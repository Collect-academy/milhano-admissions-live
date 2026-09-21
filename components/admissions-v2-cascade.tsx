import Link from "next/link";
import {
  Activity,
  CheckCircle2,
  CircleX,
  ContactRound,
  MessageCircleReply,
  MessageSquareText,
  Route,
  School,
  UserRoundCheck,
} from "lucide-react";

import type { V2CascadeMetric } from "@/lib/admissions-v2";
import type { DateRange } from "@/lib/date-range";
import { dateRangeQuery } from "@/lib/date-range";
import { number } from "@/lib/format";

const iconByMetric = {
  new_leads: Activity,
  unique_contacted_leads: ContactRound,
  responded_leads: MessageCircleReply,
  meaningful_conversations: MessageSquareText,
  qualified_leads: CheckCircle2,
  school_tours_booked: Route,
  school_tours_attended: School,
  trial_days_booked: Route,
  trial_days_showed: School,
  closed: UserRoundCheck,
  disqualified: CircleX,
} as const;

export function AdmissionsV2Cascade({
  eyebrow,
  title,
  note,
  metrics,
  range,
  compact = false,
  clickable = true,
  scope = "general",
  infoMetric,
}: {
  eyebrow: string;
  title: string;
  note?: string;
  metrics: V2CascadeMetric[];
  range: DateRange;
  compact?: boolean;
  clickable?: boolean;
  scope?: "general" | "setter" | "closer";
  infoMetric?: V2CascadeMetric & { helper?: string };
}) {
  const query = dateRangeQuery(range);

  return (
    <section className={`panel v2-cascade-panel ${compact ? "v2-cascade-compact" : ""}`}>
      <div className="panel-heading v2-cascade-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        {note ? <p className="panel-note">{note}</p> : null}
      </div>

      <div className="v2-funnel-flow">
        {metrics.map((metric, index) => {
          const Icon = iconByMetric[metric.metric_key as keyof typeof iconByMetric] ?? Activity;
          const toneClass =
            scope === "closer" && ["school_tours_attended", "trial_days_showed"].includes(metric.metric_key)
              ? "v2-kpi-card-async"
              : scope === "closer" && metric.metric_key === "closed"
                ? "v2-kpi-card-closed"
                : "";
          const body = (
            <>
              <div className="v2-kpi-topline">
                <span className="v2-step-number">{String(index + 1).padStart(2, "0")}</span>
                <span className="v2-kpi-icon"><Icon size={16} strokeWidth={1.9} /></span>
              </div>
              <p className="v2-kpi-label">{metric.label}</p>
              <p className="v2-kpi-value">{number(metric.value)}</p>
            </>
          );

          return (
            <div className="v2-funnel-step" key={metric.metric_key}>
              {clickable ? (
                <Link
                  className={`v2-kpi-card ${toneClass}`}
                  href={`/v2/leads?metric=${encodeURIComponent(metric.metric_key)}&scope=${scope}&${query}`}
                >
                  {body}
                </Link>
              ) : (
                <article className={`v2-kpi-card v2-kpi-card-static ${toneClass}`}>{body}</article>
              )}
            </div>
          );
        })}
      </div>

      {infoMetric ? (
        <div className="v2-info-scorecard-row">
          <Link
            className="v2-info-scorecard"
            href={`/v2/leads?metric=${encodeURIComponent(infoMetric.metric_key)}&scope=${scope}&${query}`}
          >
            <span className="v2-info-scorecard-icon"><CircleX size={16} strokeWidth={1.9} /></span>
            <span>
              <strong>{infoMetric.label}</strong>
              {infoMetric.helper ? <small>{infoMetric.helper}</small> : null}
            </span>
            <b>{number(infoMetric.value)}</b>
          </Link>
        </div>
      ) : null}
    </section>
  );
}
