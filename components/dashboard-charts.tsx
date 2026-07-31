"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { DailyKpi, FunnelSummary } from "@/lib/types";

type Props = {
  funnel: FunnelSummary[];
  daily: DailyKpi[];
  rangeLabel: string;
};

function shortDate(value: string): string {
  const date = new Date(`${value}T12:00:00`);

  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

export function FunnelChart({ data }: { data: FunnelSummary[] }) {
  return (
    <div className="chart-wrapper chart-tall">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 24, left: 12, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="stage_name"
            width={155}
            tick={{ fontSize: 12 }}
          />
          <Tooltip
            formatter={(value) => [Number(value).toLocaleString("es-MX"), "Leads"]}
          />
          <Bar
            dataKey="reached_count"
            name="Alcanzaron el hito"
            fill="var(--green)"
            radius={[0, 7, 7, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DailyActivityChart({ data }: { data: DailyKpi[] }) {
  return (
    <div className="chart-wrapper">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 8, right: 18, left: -12, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="metric_date"
            tickFormatter={shortDate}
            minTickGap={26}
            tick={{ fontSize: 11 }}
          />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip
            labelFormatter={(label) =>
              new Intl.DateTimeFormat("es-MX", {
                dateStyle: "long",
              }).format(new Date(`${label}T12:00:00`))
            }
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="new_leads"
            name="Leads"
            stroke="var(--green)"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="fits"
            name="Fit"
            stroke="var(--gold)"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="enrolled"
            name="Inscritos"
            stroke="var(--blue)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DashboardCharts({
  funnel,
  daily,
  rangeLabel,
}: Props) {
  return (
    <>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Cohorte · {rangeLabel}</p>
            <h2>Cascada estándar</h2>
          </div>
          <p className="panel-note">
            Excluye ingresos directos y no inventa hitos intermedios.
          </p>
        </div>
        <FunnelChart data={funnel} />
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{rangeLabel}</p>
            <h2>Actividad diaria</h2>
          </div>
          <p className="panel-note">
            Eventos históricos por fecha, no sólo el stage final.
          </p>
        </div>
        <DailyActivityChart data={daily} />
      </section>
    </>
  );
}
