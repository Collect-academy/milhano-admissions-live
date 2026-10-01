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

import type { AgentActivityAnalysis, AgentScatterPoint } from "@/lib/agent-analytics";
import type { Locale } from "@/lib/locale";
import { tr } from "@/lib/locale";

const labels: Record<AgentScatterPoint["kind"], { en: string; es: string }> = {
  assignment: { en: "Owner assignment", es: "Asignación owner" },
  crm_stage: { en: "CRM stage", es: "Movimiento CRM" },
  call: { en: "Call", es: "Llamada" },
  whatsapp: { en: "WhatsApp", es: "WhatsApp" },
  communication: { en: "Communication", es: "Comunicación" },
};

function hourLabel(value: number) {
  const hour = Math.floor(value);
  const minute = Math.round((value - hour) * 60);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function tooltipLabel(point: AgentScatterPoint, locale: Locale) {
  return `${point.date} · ${point.time} · ${locale === "es" ? labels[point.kind].es : labels[point.kind].en}`;
}

export function AgentActivityScatter({ data, locale }: { data: AgentActivityAnalysis; locale: Locale }) {
  const series = (kind: AgentScatterPoint["kind"]) => data.scatter.filter((point) => point.kind === kind);

  return (
    <section className="panel agent-activity-panel">
      <div className="panel-heading compact-panel-heading">
        <div>
          <p className="eyebrow">07:00–15:00 · MÉRIDA</p>
          <h2>{tr(locale, "Activity cadence", "Cadencia de actividad")}</h2>
          <p className="panel-note">
            {tr(
              locale,
              "Each point is a 15-minute block. Y is the number of attributable events in that block; this does not treat the span between the first and last event as worked time.",
              "Cada punto es un bloque de 15 minutos. Y es la cantidad de eventos atribuibles en ese bloque; no se interpreta el intervalo entre la primera y última acción como tiempo trabajado.",
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
                name={tr(locale, "Time", "Horario")}
              />
              <YAxis type="number" dataKey="y" allowDecimals={false} tick={{ fontSize: 11 }} name={tr(locale, "Interactions", "Interacciones")} />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                formatter={(value) => [Number(value), tr(locale, "Interactions", "Interacciones")]}
                labelFormatter={(_, payload) => {
                  const point = payload?.[0]?.payload as AgentScatterPoint | undefined;
                  return point ? tooltipLabel(point, locale) : "";
                }}
              />
              <Legend />
              <Scatter data={series("crm_stage")} name={tr(locale, "CRM stages", "Movimientos CRM")} fill="var(--green)" />
              <Scatter data={series("assignment")} name={tr(locale, "Assignments", "Asignaciones")} fill="var(--gold)" />
              <Scatter data={series("call")} name={tr(locale, "Calls", "Llamadas")} fill="var(--blue)" />
              <Scatter data={series("whatsapp")} name="WhatsApp" fill="var(--red)" />
            </ScatterChart>
          </ResponsiveContainer>
        ) : (
          <div className="agent-chart-empty">{tr(locale, "No attributable activity in this period.", "No hay actividad atribuible en este periodo.")}</div>
        )}
      </div>

      <div className="agent-activity-source-note">
        <span>CRM <strong>{data.byKind.crm_stage}</strong></span>
        <span>{tr(locale, "Assignments", "Asignaciones")} <strong>{data.byKind.assignment}</strong></span>
        <span>{tr(locale, "Calls", "Llamadas")} <strong>{data.byKind.call}</strong></span>
        <span>WhatsApp <strong>{data.byKind.whatsapp}</strong></span>
        {data.outsideWorkWindow ? <span>{tr(locale, "Outside 07–15", "Fuera de 07–15")} <strong>{data.outsideWorkWindow}</strong></span> : null}
      </div>
    </section>
  );
}
