import { Activity, Gauge, UserRoundCog } from "lucide-react";

import { AgentActivityScatter } from "@/components/agent-activity-scatter";
import { AgentConversionFunnel } from "@/components/agent-conversion-funnel";
import { AgentProductivity } from "@/components/agent-productivity";
import { DashboardLayout } from "@/components/dashboard-layout";
import { DashboardRefreshButton } from "@/components/dashboard-refresh-button";
import { DateRangeFilter } from "@/components/date-range-filter";
import { KpiCard } from "@/components/kpi-card";
import { ADMISSIONS_V2_CUTOVER, clampV2Range } from "@/lib/admissions-v2";
import { getAgentActivityAnalysis, getAgentSetterFunnel } from "@/lib/agent-analytics";
import { getAgentProductivity } from "@/lib/agent-productivity";
import { resolveDateRange, type DateRange } from "@/lib/date-range";
import { dateLabel, number } from "@/lib/format";
import { getDashboardLocale } from "@/lib/i18n";
import { tr } from "@/lib/locale";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

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
  const requestedAgentId = Array.isArray(params.agent) ? params.agent[0] ?? "" : params.agent ?? "";

  const productivityBase = await getAgentProductivity(range, "");
  const fallbackAgent = [...productivityBase.rows]
    .sort((a, b) => (b.opportunities_worked + b.stage_moves) - (a.opportunities_worked + a.stage_moves))[0];
  const selectedAgentId = requestedAgentId === "all"
    ? "all"
    : productivityBase.rows.some((row) => row.ghl_user_id === requestedAgentId)
      ? requestedAgentId
      : fallbackAgent?.ghl_user_id ?? "all";
  const detailAgentId = selectedAgentId === "all" ? "" : selectedAgentId;
  const selected = productivityBase.rows.find((row) => row.ghl_user_id === detailAgentId) ?? null;
  const productivity = { ...productivityBase, selected };

  const [activity, funnel] = await Promise.all([
    getAgentActivityAnalysis(range, detailAgentId),
    getAgentSetterFunnel(range, detailAgentId),
  ]);

  return (
    <DashboardLayout
      eyebrow="Milhano · Setter Operations"
      statusLabel={`${tr(locale, "Period", "Periodo")} ${dateLabel(range.start)} – ${dateLabel(range.end)}`}
      subtitle={tr(
        locale,
        "Agent-level CRM cadence and Setter conversion analysis without treating first-to-last activity as worked hours.",
        "Cadencia de CRM y conversión Setter por agente, sin interpretar el intervalo primera–última actividad como horas trabajadas.",
      )}
      title={tr(locale, "Agent Performance", "Productividad de agentes")}
    >
      <div className="v2-toolbar">
        <div className="agent-view-badge"><UserRoundCog size={16} /> SETTER</div>
        <DashboardRefreshButton />
      </div>

      <DateRangeFilter basePath="/agentes" range={range} locale={locale} preserve={{ agent: selectedAgentId || undefined }} />

      <AgentProductivity
        data={productivity}
        range={range}
        selectedAgentId={selectedAgentId}
        locale={locale}
      />

      {selected ? (
        <div className="agent-focus-kpis kpi-grid">
          <KpiCard
            icon={Activity}
            label={tr(locale, "Attributable events", "Eventos atribuibles")}
            value={number(activity.totalEvents)}
            helper={`${number(activity.workWindowEvents)} entre 07:00–15:00`}
            locale={locale}
          />
          <KpiCard
            icon={Gauge}
            label={tr(locale, "Active cadence blocks", "Bloques activos de cadencia")}
            value={number(activity.activeThirtyMinuteBlocks)}
            helper={tr(locale, "30-minute blocks with at least one event", "Bloques de 30 min con al menos un evento")}
            locale={locale}
          />
          <KpiCard
            icon={UserRoundCog}
            label={tr(locale, "Selected agent", "Agente seleccionado")}
            value={selected.display_name}
            helper={`${number(selected.current_assigned)} opps asignadas actualmente`}
            locale={locale}
          />
        </div>
      ) : null}

      <AgentActivityScatter data={activity} locale={locale} />
      <AgentConversionFunnel data={funnel} locale={locale} />

      <p className="agent-analysis-footnote">
        {tr(
          locale,
          "CRM stage activity is attributed by owner-at-event; assignments come from Opportunity webhooks; calls and WhatsApp only count when GHL provides an attributable user and the message is not automated. These are operational signals, not payroll timekeeping.",
          "La actividad de stages se atribuye por owner-at-event; las asignaciones vienen de webhooks de Opportunity; llamadas y WhatsApp sólo cuentan cuando GHL entrega un usuario atribuible y el mensaje no es automatizado. Son señales operativas, no control de nómina.",
        )}
      </p>
    </DashboardLayout>
  );
}
