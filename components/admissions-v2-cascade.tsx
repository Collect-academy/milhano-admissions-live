import Link from "next/link";
import {
  Activity,
  CheckCircle2,
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
} as const;

function ratio(from: number, to: number) {
  if (from <= 0) return "—";
  return `${Math.min(100, (to / from) * 100).toFixed(1)}%`;
}

export function AdmissionsV2Cascade({
  eyebrow,
  title,
  note,
  metrics,
  range,
  compact = false,
}: {
  eyebrow: string;
  title: string;
  note: string;
  metrics: V2CascadeMetric[];
  range: DateRange;
  compact?: boolean;
}) {
  const query = dateRangeQuery(range);

  return (
    <section className={`panel v2-cascade-panel ${compact ? "v2-cascade-compact" : ""}`}>
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        <p className="panel-note">{note}</p>
      </div>

      <div className="v2-funnel-flow">
        {metrics.map((metric, index) => {
          const Icon = iconByMetric[metric.metric_key as keyof typeof iconByMetric] ?? Activity;
          const next = metrics[index + 1];
          return (
            <div className="v2-funnel-step" key={metric.metric_key}>
              <Link className="kpi-card cascade-kpi-card v2-kpi-card" href={`/v2/leads?metric=${encodeURIComponent(metric.metric_key)}&${query}`}>
                <div className="kpi-icon"><Icon size={19} strokeWidth={1.8} /></div>
                <div>
                  <p className="kpi-label">{metric.label}</p>
                  <p className="kpi-value">{number(metric.value)}</p>
                  <p className="kpi-helper">Misma cohorte V2</p>
                </div>
              </Link>
              {next ? <div className="flow-arrow"><strong>{ratio(metric.value, next.value)}</strong></div> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
