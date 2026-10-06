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
              "Calls made is the operational count of unique opportunities with at least one real stage movement during the selected period; an actual School Tour booking created in GHL also counts as work evidence when the stage event is missing. It is not a literal phone-call count. Meaningful and Qualified are cumulative milestones, while Tour Booked now comes from real GHL appointment bookings created in the selected period. No Answer follow-up movements count in agent productivity. Since Oct 6, an owner can claim a previously unattributed movement only within 60 minutes; after that, it remains unassigned.",
              "Llamadas hechas es el conteo operativo de opportunities únicas con al menos un cambio real de stage durante el periodo seleccionado; una cita real de School Tour creada en GHL también sirve como evidencia de trabajo si faltó el evento de stage. No es el conteo literal de llamadas telefónicas. Meaningful y Qualified son milestones acumulativos, mientras que Tour Booked ahora sale de citas reales creadas en GHL dentro del periodo. Los movimientos de seguimiento de No Answer sí cuentan en productividad. Desde el 6 de octubre, un owner sólo puede reclamar un movimiento sin atribución dentro de los siguientes 60 minutos; después queda Sin asignar.",
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
          "Reconciliation: Calls made = No response + Responded. Responded = Disqualified + Callback/follow-up + Meaningful Conversation. Meaningful and Qualified are cumulative milestones. Tour Booked is audited against real School Tour appointments created in GHL during the period and attributed to the appointment creator; downstream cleanup movements no longer inflate it.",
          "Cuadre: Llamadas hechas = No respondieron + Respondieron. Respondieron = Disqualified + Callback/seguimiento + Meaningful Conversation. Meaningful y Qualified son milestones acumulativos. Tour Booked se audita contra citas reales de School Tour creadas en GHL durante el periodo y se atribuye al creador de la cita; los movimientos posteriores de limpieza ya no lo inflan.",
        )}
      </p>
    </section>
  );
}
