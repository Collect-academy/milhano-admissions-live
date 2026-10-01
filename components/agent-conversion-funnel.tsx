import { ArrowRight } from "lucide-react";

import type { AgentSetterFunnel } from "@/lib/agent-analytics";
import type { Locale } from "@/lib/locale";
import { tr } from "@/lib/locale";

function pct(value: number | null) {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

export function AgentConversionFunnel({ data, locale }: { data: AgentSetterFunnel; locale: Locale }) {
  const steps = [
    { label: "New Leads", value: data.new_leads, rate: null },
    { label: "Contacted", value: data.contacted, rate: data.new_to_contacted_pct },
    { label: "Responded", value: data.responded, rate: data.contacted_to_responded_pct },
    { label: "Meaningful", value: data.meaningful, rate: data.responded_to_meaningful_pct },
    { label: "Qualified", value: data.qualified, rate: data.meaningful_to_qualified_pct },
  ];

  return (
    <section className="panel agent-conversion-panel">
      <div className="panel-heading compact-panel-heading">
        <div>
          <p className="eyebrow">SETTER · COHORTE ATRIBUIDA</p>
          <h2>{tr(locale, "Stage transformation", "Transformación entre stages")}</h2>
          <p className="panel-note">
            {tr(
              locale,
              "Leads are attributed to the first Setter owner observed in GHL. Contacted / Responded / Meaningful / Qualified use the same cascade definitions as Admissions V2.",
              "Los leads se atribuyen al primer owner Setter observado en GHL. Contacted / Responded / Meaningful / Qualified usan las mismas definiciones de la cascada de Admisiones V2.",
            )}
          </p>
        </div>
      </div>

      {data.new_leads ? (
        <>
          <div className="agent-conversion-flow">
            {steps.map((step, index) => (
              <div className="agent-conversion-node-wrap" key={step.label}>
                {index ? <div className="agent-conversion-arrow"><ArrowRight size={15} /><strong>{pct(step.rate)}</strong></div> : null}
                <div className="agent-conversion-node">
                  <span>{step.label}</span>
                  <strong>{step.value}</strong>
                </div>
              </div>
            ))}
          </div>
          <div className="agent-tour-conversion">
            <div>
              <span>{tr(locale, "School Tours booked", "School Tours agendados")}</span>
              <strong>{data.tour_booked}</strong>
            </div>
            <div>
              <span>{tr(locale, "Contacted → ST booked", "Contacted → ST booked")}</span>
              <strong>{pct(data.contacted_to_tour_pct)}</strong>
            </div>
          </div>
        </>
      ) : (
        <div className="agent-funnel-empty">
          {tr(
            locale,
            "No newly created lead cohort is attributed to this agent in the selected period. Their backlog activity can still appear in the cadence chart above.",
            "No hay una cohorte de leads nuevos atribuida a este agente en el periodo seleccionado. Su trabajo sobre backlog sí puede aparecer en la gráfica de cadencia de arriba.",
          )}
        </div>
      )}
    </section>
  );
}
