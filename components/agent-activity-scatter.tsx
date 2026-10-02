"use client";

import {
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { AgentActivityAnalysis, AgentDirectoryEntry, AgentScatterPoint } from "@/lib/agent-analytics";
import type { Locale } from "@/lib/locale";
import { tr } from "@/lib/locale";

const PATHI_ID = "LTJEPAdClnxPxUd2mRXp";
const CINTHIA_ID = "77kxc0w2hMphBCnyl9Fe";
const MIGUEL_ID = "CVHK8CdZzT6A7zLxr5Sg";
const JOSE_ID = "WieQXvNTFqSPfUgXy1LZ";

const knownColors: Record<string, string> = {
  [PATHI_ID]: "#8A9099",
  [CINTHIA_ID]: "#2F6FDB",
  [MIGUEL_ID]: "#2C8A62",
  [JOSE_ID]: "#C47A1A",
};

const fallbackColors = ["#C47A1A", "#8A5CC2", "#C65366", "#2E8FA3", "#B58A22"];

function hourLabel(value: number) {
  const hour = Math.floor(value);
  const minute = Math.round((value - hour) * 60);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function displayName(agentId: string, agents: AgentDirectoryEntry[]) {
  return agents.find((agent) => agent.ghl_user_id === agentId)?.display_name ?? `GHL · ${agentId.slice(-6)}`;
}

function colorFor(agentId: string, index: number) {
  return knownColors[agentId] ?? fallbackColors[index % fallbackColors.length];
}

type ScatterTooltipProps = {
  active?: boolean;
  payload?: Array<{ payload?: AgentScatterPoint }>;
  locale: Locale;
  agents: AgentDirectoryEntry[];
};

function ScatterTooltipContent({ active, payload, locale, agents }: ScatterTooltipProps) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;

  return (
    <div className="agent-scatter-tooltip">
      <strong>{displayName(point.agentId, agents)}</strong>
      <span>{point.date}</span>
      <span><b>{tr(locale, "Interaction time", "Hora de interacción")}:</b> {point.time}</span>
      <span><b>{tr(locale, "Number of interactions", "Número de interacciones")}:</b> {point.y}</span>
    </div>
  );
}

export function AgentActivityScatter({
  data,
  locale,
  agents,
}: {
  data: AgentActivityAnalysis;
  locale: Locale;
  agents: AgentDirectoryEntry[];
}) {
  const activeAgentIds = [...new Set(data.scatter.map((point) => point.agentId))];
  const series = activeAgentIds.map((agentId, index) => ({
    agentId,
    name: displayName(agentId, agents),
    color: colorFor(agentId, index),
    points: data.scatter.filter((point) => point.agentId === agentId),
  }));

  return (
    <section className="panel agent-activity-panel">
      <div className="panel-heading compact-panel-heading">
        <div>
          <p className="eyebrow">07:00–15:00 · MÉRIDA</p>
          <h2>{tr(locale, "Activity cadence", "Cadencia de actividad")}</h2>
          <p className="panel-note">
            {tr(
              locale,
              "Each point is a 15-minute block. Y is the number of attributable actions in that block; the span between the first and last action is not treated as worked time.",
              "Cada punto es un bloque de 15 minutos. Y es la cantidad de acciones atribuibles en ese bloque; el intervalo entre la primera y última acción no se interpreta como tiempo trabajado.",
            )}
          </p>
        </div>
      </div>

      <div className="agent-activity-stats">
        <div><span>{tr(locale, "Events in window", "Eventos en ventana")}</span><strong>{data.workWindowEvents}</strong></div>
        <div><span>{tr(locale, "Active 30-min blocks", "Bloques activos de 30 min")}</span><strong>{data.activeThirtyMinuteBlocks}</strong></div>
        <div><span>{tr(locale, "Median gap", "Pausa mediana")}</span><strong>{data.medianGapMinutes === null ? "—" : `${data.medianGapMinutes.toFixed(0)} min`}</strong></div>
        <div><span>{tr(locale, "Largest gap", "Pausa mayor")}</span><strong>{data.maxGapMinutes === null ? "—" : `${data.maxGapMinutes.toFixed(0)} min`}</strong></div>
        <div><span>{tr(locale, "Actions / active block", "Acciones / bloque activo")}</span><strong>{data.actionsPerActiveBlock.toFixed(1)}</strong></div>
      </div>

      <div className="agent-scatter-chart">
        {data.scatter.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 18, left: -8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="x"
                domain={[7, 15]}
                ticks={[7, 8, 9, 10, 11, 12, 13, 14, 15]}
                tickFormatter={hourLabel}
                tick={{ fontSize: 11 }}
              />
              <YAxis type="number" dataKey="y" allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                content={<ScatterTooltipContent locale={locale} agents={agents} />}
              />
              <Legend />
              {series.map((agent) => (
                <Scatter
                  key={agent.agentId}
                  data={agent.points}
                  name={agent.name}
                  fill={agent.color}
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        ) : (
          <div className="agent-chart-empty">{tr(locale, "No attributable activity in this period.", "No hay actividad atribuible en este periodo.")}</div>
        )}
      </div>

      <div className="agent-activity-source-note">
        <span>CRM <strong>{data.byKind.crm_stage}</strong></span>
        <span>{tr(locale, "Opportunity assignments", "Asignaciones opp")} <strong>{data.byKind.assignment}</strong></span>
        <span>{tr(locale, "Calls", "Llamadas")} <strong>{data.byKind.call}</strong></span>
        <span>WhatsApp <strong>{data.byKind.whatsapp}</strong></span>
        {data.outsideWorkWindow ? <span>{tr(locale, "Outside 07–15", "Fuera de 07–15")} <strong>{data.outsideWorkWindow}</strong></span> : null}
      </div>
    </section>
  );
}
