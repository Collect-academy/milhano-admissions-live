import Link from "next/link";
import { UserRoundCog } from "lucide-react";

import { AgentActivityScatter } from "@/components/agent-activity-scatter";
import { AgentConversionFunnel } from "@/components/agent-conversion-funnel";
import { DashboardLayout } from "@/components/dashboard-layout";
import { DashboardRefreshButton } from "@/components/dashboard-refresh-button";
import { DateRangeFilter } from "@/components/date-range-filter";
import { ADMISSIONS_V2_CUTOVER, clampV2Range } from "@/lib/admissions-v2";
import {
  getAgentActivityAnalysis,
  getSetterAgentDirectory,
  getSetterAgentJourney,
} from "@/lib/agent-analytics";
import { dateRangeParams, resolveDateRange, type DateRange } from "@/lib/date-range";
import { dateLabel } from "@/lib/format";
import { getDashboardLocale } from "@/lib/i18n";
import { tr } from "@/lib/locale";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function hrefFor(range: DateRange, agent = "all") {
  const params = new URLSearchParams(dateRangeParams(range));
  params.set("agent", agent);
  return `/agentes?${params.toString()}`;
}

export default async function AgentsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const requestedRange = resolveDateRange(params);
  const effective = clampV2Range(requestedRange.start, requestedRange.end);
  const range: DateRange = {
    ...requestedRange,
    start: effective.start,
    end: effective.end,
    label: requestedRange.start < ADMISSIONS_V2_CUTOVER
      ? `${dateLabel(effective.start)} – ${dateLabel(effective.end)}`
      : requestedRange.label,
  };
  const locale = await getDashboardLocale();
  const requestedAgentId = Array.isArray(params.agent) ? params.agent[0] ?? "all" : params.agent ?? "all";
  const agents = await getSetterAgentDirectory();
  const selectedAgentId = requestedAgentId === "all" || !agents.some((agent) => agent.ghl_user_id === requestedAgentId)
    ? "all"
    : requestedAgentId;
  const detailAgentId = selectedAgentId === "all" ? "" : selectedAgentId;
  const selectedAgent = agents.find((agent) => agent.ghl_user_id === detailAgentId) ?? null;
  const scopeLabel = selectedAgent?.display_name ?? tr(locale, "All team", "Todo el equipo");

  const [activity, journey] = await Promise.all([
    getAgentActivityAnalysis(range, detailAgentId),
    getSetterAgentJourney(range, detailAgentId),
  ]);

  return (
    <DashboardLayout
      eyebrow="Milhano · Setter Operations"
      statusLabel={`${tr(locale, "Period", "Periodo")} ${dateLabel(range.start)} – ${dateLabel(range.end)}`}
      subtitle={tr(
        locale,
        "Opportunity-level Setter productivity, CRM cadence and stage transformation by team or agent.",
        "Productividad Setter por opportunity, cadencia de CRM y transformación entre stages por equipo o agente.",
      )}
      title={tr(locale, "Agent Performance", "Productividad de agentes")}
    >
      <div className="v2-toolbar">
        <div className="agent-view-badge"><UserRoundCog size={16} /> SETTER</div>
        <DashboardRefreshButton />
      </div>

      <DateRangeFilter basePath="/agentes" range={range} locale={locale} preserve={{ agent: selectedAgentId }} />

      <section className="panel agent-scope-panel">
        <div className="panel-heading compact-panel-heading agent-productivity-heading">
          <div>
            <p className="eyebrow">OPPORTUNITY OWNER · GHL USER ID</p>
            <h2>{scopeLabel}</h2>
            <p className="panel-note">
              {tr(
                locale,
                "The dashboard unit is the opportunity. Contact owner is not used in these productivity metrics.",
                "La unidad del dashboard es la opportunity. El owner del contacto no se usa en estas métricas de productividad.",
              )}
            </p>
          </div>
          <form className="agent-productivity-filter" method="get">
            {Object.entries(dateRangeParams(range)).map(([key, value]) => (
              <input key={key} type="hidden" name={key} value={value} />
            ))}
            <label>
              <span>{tr(locale, "Team / agent", "Equipo / agente")}</span>
              <select name="agent" defaultValue={selectedAgentId}>
                <option value="all">{tr(locale, "All team", "Todo el equipo")}</option>
                {agents.map((agent) => (
                  <option key={agent.ghl_user_id} value={agent.ghl_user_id}>{agent.display_name}</option>
                ))}
              </select>
            </label>
            <button className="primary-button" type="submit">{tr(locale, "Apply", "Aplicar")}</button>
            {selectedAgentId !== "all" ? (
              <Link className="secondary-button" href={hrefFor(range, "all")}>{tr(locale, "View team", "Ver equipo")}</Link>
            ) : null}
          </form>
        </div>
      </section>

      <AgentConversionFunnel data={journey} locale={locale} />
      <AgentActivityScatter data={activity} locale={locale} agents={agents} />

      <p className="agent-analysis-footnote">
        {tr(
          locale,
          "Stage actions use Opportunity ownership. We first use the owner captured at the event; if it is missing, we recover the latest owner before the event or an owner claimed within the next 60 minutes. Historical movements before Oct 6 may still use the Paty legacy fallback. From Oct 6 onward, truly unassigned movements stay unassigned. Contact owner is never used for productivity attribution.",
          "Las acciones de stage usan el ownership de la Opportunity. Primero usamos el owner capturado en el evento; si falta, recuperamos el último owner anterior o un owner reclamado dentro de los siguientes 60 minutos. Los movimientos históricos anteriores al 6 de octubre todavía pueden usar el fallback legacy de Paty. Desde el 6 de octubre, los movimientos realmente sin assignee permanecen Sin asignar. El owner del Contact nunca se usa para atribuir productividad.",
        )}
      </p>
    </DashboardLayout>
  );
}
