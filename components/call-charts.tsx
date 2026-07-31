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

import type { CallDaily } from "@/lib/types";

function shortDate(value: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
  }).format(new Date(`${value}T12:00:00`));
}

export function CallActivityChart({ data }: { data: CallDaily[] }) {
  const recent = data.slice(-30);

  return (
    <div className="chart-wrapper">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={recent} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="activity_date"
            tickFormatter={shortDate}
            minTickGap={22}
            tick={{ fontSize: 11 }}
          />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend />
          <Bar
            dataKey="outbound_attempts"
            name="Intentos outbound"
            fill="var(--green)"
            radius={[5, 5, 0, 0]}
          />
          <Bar
            dataKey="inbound_calls"
            name="Inbound"
            fill="var(--blue)"
            radius={[5, 5, 0, 0]}
          />
          <Bar
            dataKey="meaningful_3min_plus_calls"
            name="3+ minutos"
            fill="var(--gold)"
            radius={[5, 5, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PickupRateChart({ data }: { data: CallDaily[] }) {
  const recent = data.slice(-30);

  return (
    <div className="chart-wrapper">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={recent} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="activity_date"
            tickFormatter={shortDate}
            minTickGap={22}
            tick={{ fontSize: 11 }}
          />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`]} />
          <Legend />
          <Line
            type="monotone"
            dataKey="ghl_pickup_rate_pct"
            name="Pickup GHL"
            stroke="var(--blue)"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="meaningful_3min_pickup_rate_pct"
            name="Pickup 3+ min"
            stroke="var(--green)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
