import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";

import { HelpTip } from "@/components/help-tip";
import type { OperationalCascadeMetric } from "@/lib/cascade";
import { conceptDefinition, metricLabel } from "@/lib/concepts";
import { dateRangeQuery, type DateRange } from "@/lib/date-range";
import { number } from "@/lib/format";
import type { Locale } from "@/lib/locale";
import { tr } from "@/lib/locale";

function statusLabel(status: string, locale: Locale): string {
  const labels: Record<string, [string, string]> = {
    system: ["System", "Sistema"],
    reconciled: ["Reconciled", "Reconciliado"],
    mixed: ["Mixed", "Mixto"],
    mixed_reconciled: ["Mixed · Reconciled", "Mixto · Reconciliado"],
    unreconciled: ["Gap", "Gap"],
    data_issue: ["Data issue", "Problema de datos"],
    reported_manual: ["Reported", "Reportado"],
    unreported: ["No report", "Sin reporte"],
  };
  const pair = labels[status];
  return pair ? (locale === "es" ? pair[1] : pair[0]) : status;
}

function statusTone(status: string): string {
  if (status === "data_issue") return "cascade-tone-error";
  if (status === "unreconciled") return "cascade-tone-gap";
  if (["mixed", "mixed_reconciled"].includes(status)) return "cascade-tone-mixed";
  if (["reconciled", "system"].includes(status)) return "cascade-tone-good";
  return "cascade-tone-neutral";
}

export function OperationalCascade({
  metrics,
  range,
  locale = "en",
}: {
  metrics: OperationalCascadeMetric[];
  range: DateRange;
  locale?: Locale;
}) {
  const query = dateRangeQuery(range);

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{tr(locale, "Unified terminology", "Terminología unificada")}</p>
          <h2>{tr(locale, "Admissions Operational Cascade", "Cascada Operativa de Admisiones")}</h2>
        </div>
        <p className="panel-note">
          {tr(
            locale,
            "Operational Total = GHL/System + verified activity outside GHL. Click any scorecard to audit the number.",
            "Total operativo = GHL/System + actividad verificada fuera de GHL. Haz clic en cualquier scorecard para auditar el número.",
          )}
        </p>
      </div>

      <div className="operational-cascade">
        {metrics.map((metric, index) => {
          const definition = conceptDefinition(metric.metric_key, locale) ?? metric.definition;
          return (
            <div className="cascade-step-wrapper" key={metric.metric_key}>
              <Link
                className={`cascade-scorecard ${statusTone(metric.reconciliation_status)}`}
                href={`/reconciliation?metric=${encodeURIComponent(metric.metric_key)}&${query}`}
              >
                <div className="cascade-scorecard-top">
                  <span>{index + 1}</span>
                  <div className="cascade-top-meta">
                    {metric.metric_scope === "today" ? <CalendarDays size={15} /> : null}
                    <small>{statusLabel(metric.reconciliation_status, locale)}</small>
                  </div>
                </div>
                <strong>{number(metric.metric_value)}</strong>
                <h3>
                  {metricLabel(metric.metric_key, locale, metric.label)} <HelpTip text={definition} />
                </h3>
                <div className="cascade-breakdown">
                  <span>{tr(locale, "GHL", "GHL")} {number(metric.system_value)}</span>
                  {metric.manual_extra_value > 0 ? (
                    <span>+{number(metric.manual_extra_value)} {tr(locale, "manual", "manual")}</span>
                  ) : null}
                  {metric.reported_value !== null ? (
                    <span>{tr(locale, "Reported", "Reportado")} {number(metric.reported_value)}</span>
                  ) : null}
                  {metric.gap !== null && metric.gap !== 0 ? (
                    <span className="cascade-gap-text">Gap {metric.gap > 0 ? "+" : ""}{number(metric.gap)}</span>
                  ) : null}
                </div>
                <p>{metric.metric_scope === "today" ? tr(locale, "Current day", "Día actual") : range.label}</p>
              </Link>

              {index < metrics.length - 1 ? <ArrowRight aria-hidden="true" className="cascade-arrow" size={18} /> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
