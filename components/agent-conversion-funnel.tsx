import { ArrowRight } from "lucide-react";

import type { AgentSetterJourney } from "@/lib/agent-analytics";
import type { Locale } from "@/lib/locale";
import { tr } from "@/lib/locale";

function pct(value: number | null) {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

export function AgentConversionFunnel({ data, locale }: { data: AgentSetterJourney; locale: Locale }) {
  const steps = [
    { label: tr(locale, "Calls made", "Llamadas hechas"), value: data.calls_made, rate: null },
    { label: tr(locale, "Responded", "Respondieron"), value: data.responded, rate: data.calls_to_responded_pct },
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
              "A worked opportunity is counted once when it leaves New Lead for another Setter stage. Contact ownership is not used in these metrics.",
              "Una opportunity se cuenta como trabajada una sola vez cuando sale de New Lead hacia otro stage del Setter. El owner del contacto no se usa en estas métricas.",
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
          <small>New Lead → No answer - Day 1</small>
        </div>
        <div>
          <span>{tr(locale, "Disqualified (Lost)", "Disqualified (Lost)")}</span>
          <strong>{data.disqualified}</strong>
          <small>New Lead → Disqualified</small>
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
          "Responded = Calls made − No response, exactly as defined operationally. Meaningful, Qualified and Tour Booked count opportunities from the worked cohort that reached those stages later, so an opportunity is not lost from the journey after advancing.",
          "Respondieron = Llamadas hechas − No respondieron, exactamente como se definió operativamente. Meaningful, Qualified y Tour Booked cuentan las opportunities de la cohorte trabajada que alcanzaron después esos stages, para que una opp no desaparezca del viaje al seguir avanzando.",
        )}
      </p>
    </section>
  );
}
