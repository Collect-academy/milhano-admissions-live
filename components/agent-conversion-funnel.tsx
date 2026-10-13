import Link from "next/link";
import { ArrowRight, Route, School } from "lucide-react";

import type { AgentCloserMetrics, AgentSetterJourney } from "@/lib/agent-analytics";
import type { DateRange } from "@/lib/date-range";
import { dateRangeQuery } from "@/lib/date-range";
import type { Locale } from "@/lib/locale";
import { tr } from "@/lib/locale";

function pct(value: number | null) {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

export function AgentConversionFunnel({
  data,
  closerMetrics,
  locale,
  range,
}: {
  data: AgentSetterJourney;
  closerMetrics: AgentCloserMetrics;
  locale: Locale;
  range: DateRange;
}) {
  const steps = [
    {
      label: tr(locale, "Calls made", "Llamadas hechas"),
      value: data.opportunities_moved,
      rate: null,
    },
    {
      label: tr(locale, "Responded", "Respondieron"),
      value: data.responded,
      rate: data.moved_to_responded_pct,
    },
    {
      label: "Meaningful Conversation",
      value: data.meaningful,
      rate: data.responded_to_meaningful_pct,
    },
    {
      label: "Qualified",
      value: data.qualified,
      rate: data.meaningful_to_qualified_pct,
    },
  ];

  const query = dateRangeQuery(range);
  const closerCards = [
    {
      metricKey: "school_tours_booked",
      label: "ST Booked",
      value: closerMetrics.school_tours_booked,
      Icon: Route,
      asyncTone: false,
    },
    {
      metricKey: "school_tours_attended",
      label: "ST Attended",
      value: closerMetrics.school_tours_attended,
      Icon: School,
      asyncTone: true,
    },
    {
      metricKey: "trial_days_booked",
      label: tr(locale, "Trial Day Booked", "Pasadía Booked"),
      value: closerMetrics.trial_days_booked,
      Icon: Route,
      asyncTone: false,
    },
    {
      metricKey: "trial_days_showed",
      label: tr(locale, "Trial Day Attended", "Pasadía Attended"),
      value: closerMetrics.trial_days_attended,
      Icon: School,
      asyncTone: true,
    },
  ];

  return (
    <section className="panel agent-conversion-panel">
      <div className="panel-heading compact-panel-heading">
        <div>
          <p className="eyebrow">SETTER · OPPORTUNITIES</p>
          <h2>{tr(locale, "Opportunity journey", "Viaje de opportunities")}</h2>
          <p className="panel-note">
            {tr(
              locale,
              "Calls made is the operational count of unique opportunities worked during the selected period; it is not a literal phone-call count. Stage movements are attributed first to the real GHL user identified by Audit Logs. Meaningful and Qualified are cumulative milestones. School Tour and Trial Day appointment outcomes are shown separately below and mirror V2 Summary exactly for the same date range.",
              "Llamadas hechas es el conteo operativo de opportunities trabajadas durante el periodo seleccionado; no es el conteo literal de llamadas telefónicas. Los movimientos de stage se atribuyen primero al usuario real identificado por Audit Logs de GHL. Meaningful y Qualified son milestones acumulativos. Los resultados de School Tour y Pasadía se muestran aparte abajo y son una calca exacta de V2 Summary para el mismo rango de fechas.",
            )}
          </p>
        </div>
      </div>

      <div className="agent-cohort-strip">
        <div>
          <span>{tr(locale, "New assigned opportunities", "Nuevas opps asignadas")}</span>
          <strong>{data.new_leads_assigned}</strong>
        </div>
        <ArrowRight size={16} />
        <div>
          <span>{tr(locale, "Reached Contacted", "Llegaron a Contacted")}</span>
          <strong>{data.new_leads_contacted}</strong>
        </div>
        <div className="agent-cohort-rate">
          <span>New Lead → Contacted</span>
          <strong>{pct(data.new_to_contacted_pct)}</strong>
        </div>
      </div>

      <div className="agent-conversion-flow">
        {steps.map((step, index) => (
          <div className="agent-conversion-node-wrap" key={step.label}>
            {index ? (
              <div className="agent-conversion-arrow">
                <ArrowRight size={15} />
                <strong>{step.rate === null ? "" : pct(step.rate)}</strong>
              </div>
            ) : null}
            <div className="agent-conversion-node">
              <span>{step.label}</span>
              <strong>{step.value}</strong>
            </div>
          </div>
        ))}
      </div>

      <div className="panel-heading compact-panel-heading" style={{ marginTop: 18, marginBottom: 8 }}>
        <div>
          <p className="eyebrow">CLOSER · MISMA FUENTE QUE V2 SUMMARY</p>
          <h3>{tr(locale, "Appointments in the selected period", "Citas del periodo seleccionado")}</h3>
          <p className="panel-note">
            {tr(
              locale,
              "These four scorecards use the exact same backend values and drill-downs as V2 Summary. Team and Cinthia show the period totals; other individual setters show zero because these outcomes belong to the Closer view.",
              "Estas cuatro scorecards usan exactamente los mismos valores y drill-downs que V2 Summary. Team y Cinthia muestran los totales del periodo; los demás setters individuales muestran cero porque estos outcomes pertenecen a la vista de Closer.",
            )}
          </p>
        </div>
      </div>

      <div className="v2-funnel-flow">
        {closerCards.map(({ metricKey, label, value, Icon, asyncTone }, index) => (
          <div className="v2-funnel-step" key={metricKey}>
            <Link
              className={`v2-kpi-card ${asyncTone ? "v2-kpi-card-async" : ""}`}
              href={`/v2/leads?metric=${encodeURIComponent(metricKey)}&scope=closer&${query}`}
            >
              <div className="v2-kpi-topline">
                <span className="v2-step-number">{String(index + 1).padStart(2, "0")}</span>
                <span className="v2-kpi-icon"><Icon size={16} strokeWidth={1.9} /></span>
              </div>
              <div className="v2-kpi-label-row">
                <p className="v2-kpi-label">{label}</p>
              </div>
              <p className="v2-kpi-value">{value}</p>
            </Link>
          </div>
        ))}
      </div>

      <div className="agent-followup-panel">
        <div className="agent-followup-heading">
          <div>
            <span>{tr(locale, "No Answer follow-ups", "Seguimientos No Answer")}</span>
            <strong>{data.no_answer_followups}</strong>
          </div>
          <div className="agent-health-badge">
            <span>{tr(locale, "Inferred WA attempts", "Intentos WA inferidos")}</span>
            <strong>{data.inferred_no_answer_call_attempts}</strong>
          </div>
          {data.unassigned_stage_moves ? (
            <div className="agent-health-badge">
              <span>{tr(locale, "Unassigned stage moves", "Movimientos sin owner")}</span>
              <strong>{data.unassigned_stage_moves}</strong>
            </div>
          ) : null}
        </div>
        <div className="agent-followup-flow">
          <div><span>Day 1 → Day 2</span><strong>{data.no_answer_d1_to_d2}</strong></div>
          <div><span>Day 2 → Day 3</span><strong>{data.no_answer_d2_to_d3}</strong></div>
          <div><span>Day 3 → Nurturing A</span><strong>{data.no_answer_d3_to_nurturing}</strong></div>
          <div><span>{tr(locale, "Other moves from No Answer", "Otros desde No Answer")}</span><strong>{data.no_answer_other_moves}</strong></div>
        </div>
        <p className="agent-followup-note">
          {tr(
            locale,
            "WhatsApp call attempts are not directly available in the current ingestion. For a no-response progression Day 1→2, Day 2→3 or Day 3→Nurturing A, the operational equivalence is two WhatsApp call attempts for one card movement.",
            "Las llamadas de WhatsApp no están disponibles directamente en la ingesta actual. Para un avance sin respuesta Day 1→2, Day 2→3 o Day 3→Nurturing A, usamos la equivalencia operativa de dos intentos de llamada por un movimiento de tarjeta.",
          )}
        </p>
      </div>

      <div className="agent-journey-outcomes">
        <div>
          <span>{tr(locale, "No response", "No respondieron")}</span>
          <strong>{data.no_answer}</strong>
          <small>{tr(locale, "Attempted opportunities with no response outcome in the period", "Opps intentadas sin ningún outcome de respuesta en el periodo")}</small>
        </div>
        <div>
          <span>Disqualified</span>
          <strong>{data.disqualified}</strong>
          <small>{tr(locale, "Responded, but exited through Disqualified before Meaningful", "Respondieron, pero salieron por Disqualified antes de Meaningful")}</small>
        </div>
        <div>
          <span>{tr(locale, "Callback / follow-up", "Callback / seguimiento")}</span>
          <strong>{data.callback}</strong>
          <small>{tr(locale, "Responded, but remained in Callback before Meaningful", "Respondieron, pero quedaron en Callback antes de Meaningful")}</small>
        </div>
      </div>

      <p className="agent-attribution-note">
        {tr(
          locale,
          "Reconciliation: Calls made = No response + Responded. Responded = Disqualified + Callback/follow-up + Meaningful Conversation. Stage actor comes from exact Audit Log matching whenever available. Meaningful and Qualified are cumulative milestones. Appointment scorecards are sourced from the same V2 Summary closer metrics and use the same clickable event drill-down.",
          "Cuadre: Llamadas hechas = No respondieron + Respondieron. Respondieron = Disqualified + Callback/seguimiento + Meaningful Conversation. El actor del movimiento sale del match exacto con Audit Logs siempre que esté disponible. Meaningful y Qualified son milestones acumulativos. Las scorecards de citas salen de las mismas métricas Closer de V2 Summary y usan el mismo drill-down clicable por evento.",
        )}
      </p>
    </section>
  );
}
