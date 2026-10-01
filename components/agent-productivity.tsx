import Link from "next/link";
import { Activity, MessageCircle, PhoneCall, Route, UserCheck, UsersRound } from "lucide-react";

import { KpiCard } from "@/components/kpi-card";
import type { AgentProductivityData } from "@/lib/agent-productivity";
import { dateRangeParams, type DateRange } from "@/lib/date-range";
import { number } from "@/lib/format";
import type { Locale } from "@/lib/locale";
import { tr } from "@/lib/locale";

function hrefFor(range: DateRange, agent = "") {
  const params = new URLSearchParams(dateRangeParams(range));
  if (agent) params.set("agent", agent);
  return `/?${params.toString()}`;
}

export function AgentProductivity({
  data,
  range,
  selectedAgentId,
  locale,
}: {
  data: AgentProductivityData;
  range: DateRange;
  selectedAgentId: string;
  locale: Locale;
}) {
  const selected = data.selected;

  return (
    <section className="panel agent-productivity-panel">
      <div className="panel-heading compact-panel-heading agent-productivity-heading">
        <div>
          <p className="eyebrow">OWNER · GHL USER ID</p>
          <h2>{tr(locale, "Agent productivity", "Productividad por agente")}</h2>
          <p className="panel-note">
            {tr(
              locale,
              "Current assignment is a live snapshot. Activity uses the GHL user attributed to stage changes and non-automated communications during the selected period.",
              "La asignación actual es una foto en vivo. La actividad usa el usuario GHL atribuido a cambios de stage y comunicaciones no automatizadas dentro del periodo.",
            )}
          </p>
        </div>
        <form className="agent-productivity-filter" method="get">
          {Object.entries(dateRangeParams(range)).map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)}
          <label>
            <span>{tr(locale, "Agent", "Agente")}</span>
            <select name="agent" defaultValue={selectedAgentId}>
              <option value="">{tr(locale, "All agents", "Todos los agentes")}</option>
              {data.rows.map((row) => <option key={row.ghl_user_id} value={row.ghl_user_id}>{row.display_name}</option>)}
            </select>
          </label>
          <button className="primary-button" type="submit">{tr(locale, "Apply", "Aplicar")}</button>
          {selectedAgentId ? <Link className="secondary-button" href={hrefFor(range)}>{tr(locale, "Clear", "Limpiar")}</Link> : null}
        </form>
      </div>

      <div className="agent-unassigned-note">
        <strong>{number(data.unassignedOpen)}</strong>
        <span>{tr(locale, "open admissions opportunities currently have no owner", "opportunities abiertas de admisiones siguen sin owner")}</span>
      </div>

      {selected ? (
        <>
          <div className="kpi-grid agent-productivity-kpis">
            <KpiCard icon={UserCheck} label={tr(locale, "Assigned now", "Asignadas ahora")} value={number(selected.current_assigned)} helper={`${number(selected.current_open)} abiertas`} locale={locale} />
            <KpiCard icon={UsersRound} label={tr(locale, "Opportunities worked", "Opps trabajadas")} value={number(selected.opportunities_worked)} helper={`${number(selected.stage_moves)} movimientos de stage`} locale={locale} />
            <KpiCard icon={PhoneCall} label={tr(locale, "Call attempts", "Intentos de llamada")} value={number(selected.call_attempts)} helper={`${number(selected.connected_calls)} conectadas · sólo GHL`} locale={locale} />
            <KpiCard icon={MessageCircle} label="WhatsApp manual" value={number(selected.manual_whatsapp)} helper={`${number(selected.meaningful_conversations)} conversaciones significativas`} locale={locale} />
            <KpiCard icon={Route} label={tr(locale, "Qualified / Tour", "Qualified / Tour")} value={`${number(selected.qualified_moves)} / ${number(selected.tour_booked_moves)}`} helper={tr(locale, "Attributed stage moves", "Movimientos de stage atribuidos")} locale={locale} />
            <KpiCard icon={Activity} label={tr(locale, "Closed", "Closed")} value={number(selected.closed_moves)} helper={`${number(selected.unique_contacts_worked)} contactos únicos trabajados`} locale={locale} />
          </div>
          <div className="agent-stage-strip">
            <span>New Lead <strong>{number(selected.current_new_lead)}</strong></span>
            <span>No Answer <strong>{number(selected.current_no_answer)}</strong></span>
            <span>Callback <strong>{number(selected.current_callback)}</strong></span>
            <span>Tour Attended <strong>{number(selected.tour_attended_moves)}</strong></span>
            <span>Pasadía Booked <strong>{number(selected.trial_booked_moves)}</strong></span>
            <span>Pasadía Attended <strong>{number(selected.trial_attended_moves)}</strong></span>
          </div>
        </>
      ) : (
        <div className="table-scroll agent-productivity-table-wrap">
          <table className="agent-productivity-table">
            <thead><tr><th>Agente</th><th>Asignadas</th><th>Abiertas</th><th>Opps trabajadas</th><th>Mov. stage</th><th>Llamadas</th><th>Conectadas</th><th>WhatsApp</th><th>Qualified</th><th>Tour booked</th><th>Closed</th></tr></thead>
            <tbody>{data.rows.map((row) => <tr key={row.ghl_user_id}>
              <td><Link className="lead-name-link" href={hrefFor(range, row.ghl_user_id)}>{row.display_name}</Link></td>
              <td>{number(row.current_assigned)}</td><td>{number(row.current_open)}</td><td>{number(row.opportunities_worked)}</td><td>{number(row.stage_moves)}</td><td>{number(row.call_attempts)}</td><td>{number(row.connected_calls)}</td><td>{number(row.manual_whatsapp)}</td><td>{number(row.qualified_moves)}</td><td>{number(row.tour_booked_moves)}</td><td>{number(row.closed_moves)}</td>
            </tr>)}</tbody>
          </table>
        </div>
      )}

      <p className="agent-attribution-note">
        {tr(locale,
          "Stage-change attribution currently means owner-at-event: it is a strong operational proxy when staff assign themselves before working the lead, but it is not a click-level audit log. Shared-channel WhatsApp and calls without a GHL user are intentionally not assigned to an agent.",
          "La atribución de cambios de stage actualmente significa owner al momento del evento: es un proxy operativo sólido si el equipo se asigna antes de trabajar el lead, pero no es un log de auditoría del clic exacto. WhatsApp del canal compartido y llamadas sin usuario GHL no se asignan artificialmente a ningún agente.")}
      </p>
    </section>
  );
}
