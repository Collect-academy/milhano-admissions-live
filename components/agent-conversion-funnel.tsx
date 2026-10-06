import { ArrowRight } from "lucide-react";

import type { AgentSetterJourney } from "@/lib/agent-analytics";
import type { Locale } from "@/lib/locale";
import { tr } from "@/lib/locale";

function pct(value: number | null) {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

function ratio(numerator: number, denominator: number) {
  if (!denominator) return null;
  return (numerator / denominator) * 100;
}

export function AgentConversionFunnel({ data, locale }: { data: AgentSetterJourney; locale: Locale }) {
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
    {
      label: "Tour Booked",
      value: data.tour_booked,
      rate: ratio(data.tour_booked, data.qualified),
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
              "Calls made is the operational count of unique opportunities with at least one real stage movement during the selected period. It is not a literal phone-call count. Later milestones are cumulative: an opportunity that reaches Qualified also counts as Meaningful, and one that reaches Tour Booked also counts as Qualified and Meaningful. Follow-ups without a stage change are not included yet. Unassigned historical opportunities are temporarily attributed to Paty.",
              "Llamadas hechas es el conteo operativo de opportunities únicas con al menos un cambio real de stage durante el periodo seleccionado; no es el conteo literal de llamadas telefónicas. Los milestones posteriores son acumulativos: una opp que llega a Qualified también cuenta en Meaningful, y una que llega a Tour Booked también cuenta en Qualified y Meaningful. Los seguimientos sin cambio de stage todavía no entran. Las opps históricas sin assignee se atribuyen temporalmente a Paty.",
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
          "Reconciliation: Calls made = No response + Responded. Responded = Disqualified + Callback/follow-up + Meaningful Conversation. Meaningful, Qualified and Tour Booked are cumulative milestones, so a later stage implies the previous stages even when GHL was moved directly and the intermediate stage event was skipped.",
          "Cuadre: Llamadas hechas = No respondieron + Respondieron. Respondieron = Disqualified + Callback/seguimiento + Meaningful Conversation. Meaningful, Qualified y Tour Booked son milestones acumulativos, así que un stage posterior implica los anteriores aunque en GHL hayan movido la opp directamente y se hayan saltado el evento intermedio.",
        )}
      </p>
    </section>
  );
}
