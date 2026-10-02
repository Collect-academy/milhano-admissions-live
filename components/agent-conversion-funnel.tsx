import { ArrowRight } from "lucide-react";

import type { AgentSetterJourney } from "@/lib/agent-analytics";
import type { Locale } from "@/lib/locale";
import { tr } from "@/lib/locale";

function pct(value: number | null) {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

export function AgentConversionFunnel({ data, locale }: { data: AgentSetterJourney; locale: Locale }) {
  const steps = [
    { label: tr(locale, "Opportunities moved", "Opps movidas de stage"), value: data.opportunities_moved, rate: null },
    { label: tr(locale, "Responded", "Respondieron"), value: data.responded, rate: data.moved_to_responded_pct },
    { label: "Meaningful Conversation", value: data.meaningful, rate: data.responded_to_meaningful_pct },
    { label: "Qualified", value: data.qualified, rate: data.meaningful_to_qualified_pct },
    { label: "Tour Booked", value: data.tour_booked, rate: null },
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
              "For this version, a worked opportunity is any opportunity with at least one real stage change during the selected period, regardless of the starting stage. The same opportunity counts once per agent even if it changes stage multiple times. Follow-ups without a stage change are not included yet. During the current historical transition, an unassigned opportunity is attributed to Paty. Contact ownership is not used.",
              "Para esta versión, una opportunity trabajada es cualquier opp que tenga al menos un cambio real de stage durante el periodo, sin importar desde qué stage partió. La misma opp cuenta una sola vez por agente aunque cambie de stage varias veces. Los seguimientos sin cambio de stage todavía no entran. Durante esta transición histórica, una opp sin assignee se atribuye a Paty. El owner del contacto no se usa.",
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

      <div className="agent-journey-outcomes">
        <div>
          <span>{tr(locale, "No response", "No respondieron")}</span>
          <strong>{data.no_answer}</strong>
          <small>{tr(locale, "Latest move in period → No answer / Never Answered", "Último movimiento del periodo → No answer / Never Answered")}</small>
        </div>
        <div>
          <span>{tr(locale, "Disqualified (Lost)", "Disqualified (Lost)")}</span>
          <strong>{data.disqualified}</strong>
          <small>{tr(locale, "Latest move in period → Disqualified", "Último movimiento del periodo → Disqualified")}</small>
        </div>
        <div className="agent-tour-rate">
          <span>Contacted → Tour Booked</span>
          <strong>{pct(data.contacted_to_tour_pct)}</strong>
          <small>{tr(locale, "Same worked-opportunity cohort", "Misma cohorte de opps trabajadas")}</small>
        </div>
      </div>

      <p className="agent-attribution-note">
        {tr(
          locale,
          "Responded = opportunities moved − No response. No response uses the latest stage movement in the selected period, so Day 1 → Day 2 follow-up movement still counts as no response. Meaningful, Qualified and Tour Booked count opportunities from the worked cohort that reached those stages later.",
          "Respondieron = opps movidas de stage − No respondieron. No respondieron usa el último movimiento de stage del periodo, por lo que un seguimiento Day 1 → Day 2 sigue contando como no respuesta. Meaningful, Qualified y Tour Booked cuentan las opps de la cohorte trabajada que alcanzaron después esos stages.",
        )}
      </p>
    </section>
  );
}
