import Link from "next/link";
import { CalendarDays } from "lucide-react";

import { HelpTip } from "@/components/help-tip";
import type { OperationalCascadeMetric } from "@/lib/cascade";
import { conceptDefinition, metricLabel } from "@/lib/concepts";
import { dateRangeQuery, type DateRange } from "@/lib/date-range";
import { number } from "@/lib/format";
import type { Locale } from "@/lib/locale";
import { tr } from "@/lib/locale";


function transitionPercent(from: number, to: number): string {
  if (from <= 0) return "—";
  const value = (to / from) * 100;
  return `${value.toFixed(value > 100 ? 0 : 1)}%`;
}

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
  mode = "operational",
}: {
  metrics: OperationalCascadeMetric[];
  range: DateRange;
  locale?: Locale;
  mode?: "operational" | "system";
}) {
  const query = dateRangeQuery(range);

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{mode === "system" ? "GHL / System" : tr(locale, "Unified terminology", "Terminología unificada")}</p>
          <h2>{mode === "system" ? tr(locale, "GHL Admissions Cascade", "Cascada de Admisiones GHL") : tr(locale, "Admissions Operational Cascade", "Cascada Operativa de Admisiones")}</h2>
        </div>
        <p className="panel-note">
          {tr(
            locale,
            mode === "system"
              ? "These are raw automated GHL/System counts for the selected period. Click any scorecard to audit the underlying records."
              : "Operational Total = GHL/System + verified activity outside GHL. Click any scorecard to audit the number.",
            mode === "system"
              ? "Estos son conteos automáticos crudos de GHL/System para el periodo seleccionado. Haz clic en cualquier scorecard para auditar los registros."
              : "Total operativo = GHL/System + actividad verificada fuera de GHL. Haz clic en cualquier scorecard para auditar el número.",
          )}
        </p>
      </div>

      <div className="operational-cascade">
        {metrics.map((metric, index) => {
          const definition = conceptDefinition(metric.metric_key, locale) ?? metric.definition;
          return (
            <div className="cascade-step-wrapper" key={metric.metric_key}>
              <Link
                className={`cascade-scorecard ${mode === "system" ? "cascade-tone-good" : statusTone(metric.reconciliation_status)}`}
                href={`/reconciliation?metric=${encodeURIComponent(metric.metric_key)}&${query}`}
              >
                <div className="cascade-scorecard-top">
                  <span>{index + 1}</span>
                  <div className="cascade-top-meta">
                    {metric.metric_scope === "today" ? <CalendarDays size={15} /> : null}
                    <small>{mode === "system" ? statusLabel("system", locale) : statusLabel(metric.reconciliation_status, locale)}</small>
                  </div>
                </div>
                <strong>{number(mode === "system" ? (metric.system_value ?? 0) : metric.metric_value)}</strong>
                <h3>
                  {metricLabel(metric.metric_key, locale, metric.label)} <HelpTip text={definition} />
                </h3>
                <div className="cascade-breakdown">
                  {metric.system_value !== null ? (
                    <span>{tr(locale, "GHL", "GHL")} {number(metric.system_value)}</span>
                  ) : null}
                  {mode === "operational" && metric.manual_extra_value > 0 ? (
                    <span>+{number(metric.manual_extra_value)} {tr(locale, "manual", "manual")}</span>
                  ) : null}
                  {mode === "operational" && metric.reported_value !== null ? (
                    <span>{tr(locale, "Reported", "Reportado")} {number(metric.reported_value)}</span>
                  ) : null}
                  {mode === "operational" && metric.gap !== null && metric.gap !== 0 ? (
                    <span className="cascade-gap-text">Gap {metric.gap > 0 ? "+" : ""}{number(metric.gap)}</span>
                  ) : null}
                </div>
                <p>{metric.metric_scope === "today" ? tr(locale, "Current day", "Día actual") : range.label}</p>
              </Link>

              {index < metrics.length - 1 ? (() => {
                const currentValue = Number(mode === "system" ? (metric.system_value ?? 0) : metric.metric_value);
                const nextMetric = metrics[index + 1];
                const nextValue = Number(mode === "system" ? (nextMetric.system_value ?? 0) : nextMetric.metric_value);
                return (
                  <div className="cascade-flow-arrow" aria-label={`${nextValue} / ${currentValue}`}>
                    <strong>{transitionPercent(currentValue, nextValue)}</strong>
                  </div>
                );
              })() : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
