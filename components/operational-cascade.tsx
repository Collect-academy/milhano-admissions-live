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

import { HelpTip } from "@/components/help-tip";
import type { OperationalCascadeMetric } from "@/lib/cascade";
import { conceptDefinition, metricLabel } from "@/lib/concepts";
import { dateRangeQuery, type DateRange } from "@/lib/date-range";
import { number } from "@/lib/format";
import type { FunnelTransitionRate } from "@/lib/home-v17";
import type { Locale } from "@/lib/locale";
import { tr } from "@/lib/locale";

function ratioPercent(from: number, to: number): string {
  if (from <= 0) return "—";
  return `${((to / from) * 100).toFixed(to > from ? 0 : 1)}%`;
}

function transitionText(
  fromKey: string,
  from: number,
  to: number,
  transitions: Map<string, FunnelTransitionRate>,
): string {
  const transition = transitions.get(fromKey);
  if (transition?.conversion_pct !== null && transition?.conversion_pct !== undefined) {
    return `${Number(transition.conversion_pct).toFixed(1)}%`;
  }
  return ratioPercent(from, to);
}

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

export function OperationalCascade({
  metrics,
  range,
  locale = "en",
  mode = "operational",
  transitionRates = [],
}: {
  metrics: OperationalCascadeMetric[];
  range: DateRange;
  locale?: Locale;
  mode?: "operational" | "system";
  transitionRates?: FunnelTransitionRate[];
}) {
  const query = dateRangeQuery(range);
  const stagePriority: Record<string, number> = {
    new_leads: 10,
    unique_contacted_leads: 20,
    responded_leads: 30,
    meaningful_conversations: 40,
    qualified_leads: 50,
    school_tours_booked: 60,
    school_tours_attended: 70,
    trial_days_booked: 80,
    trial_days_showed: 90,
    closed: 100,
  };
  const orderedMetrics = [...metrics].sort((a, b) => {
    const left = stagePriority[a.metric_key] ?? (1000 + a.display_order);
    const right = stagePriority[b.metric_key] ?? (1000 + b.display_order);
    return left === right ? a.display_order - b.display_order : left - right;
  });
  const transitions = new Map(transitionRates.map((rate) => [rate.from_metric_key, rate]));

  return (
    <section className="panel manual-summary-panel ghl-cascade-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">
            {mode === "system" ? "GHL / SYSTEM" : tr(locale, "Unified terminology", "Terminología unificada")}
          </p>
          <h2>
            {mode === "system"
              ? tr(locale, "GHL Admissions Funnel", "Cascada GHL de Admisiones")
              : tr(locale, "Admissions Operational Funnel", "Cascada Operativa de Admisiones")}
          </h2>
        </div>
        <p className="panel-note">
          {mode === "system"
            ? tr(
                locale,
                "Cards show automated GHL/System evidence. Arrow percentages use same-lead cohort progression, so they cannot exceed 100%.",
                "Las cards muestran evidencia automática GHL/System. Los porcentajes usan avance de la misma cohorte de leads, por lo que no pueden superar 100%.",
              )
            : tr(
                locale,
                "Operational Total = GHL/System + verified activity outside GHL.",
                "Total operativo = GHL/System + actividad verificada fuera de GHL.",
              )}
        </p>
      </div>

      <div className="manual-funnel-flow ghl-funnel-flow">
        {orderedMetrics.map((metric, index) => {
          const definition = conceptDefinition(metric.metric_key, locale) ?? metric.definition;
          const Icon = iconByMetric[metric.metric_key as keyof typeof iconByMetric] ?? Activity;
          const value = Number(mode === "system" ? (metric.system_value ?? 0) : metric.metric_value);
          const nextMetric = orderedMetrics[index + 1];
          const nextValue = nextMetric
            ? Number(mode === "system" ? (nextMetric.system_value ?? 0) : nextMetric.metric_value)
            : 0;

          return (
            <div className="manual-funnel-step" key={metric.metric_key}>
              <Link
                className="kpi-card cascade-kpi-card"
                href={`/leads?metric=${encodeURIComponent(metric.metric_key)}&${query}`}
              >
                <div className="kpi-icon">
                  <Icon size={19} strokeWidth={1.8} />
                </div>
                <div>
                  <p className="kpi-label">
                    {metricLabel(metric.metric_key, locale, metric.label)} <HelpTip text={definition} />
                  </p>
                  <p className="kpi-value">{number(value)}</p>
                  <p className="kpi-helper">
                    {mode === "system"
                      ? tr(locale, "GHL/System evidence", "Evidencia GHL/System")
                      : metric.reported_value !== null
                        ? `${tr(locale, "Reported", "Reportado")} ${number(metric.reported_value)}`
                        : range.label}
                  </p>
                </div>
              </Link>

              {nextMetric ? (
                <div className="flow-arrow" aria-label={`${metric.metric_key} → ${nextMetric.metric_key}`}>
                  <strong>{transitionText(metric.metric_key, value, nextValue, transitions)}</strong>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
