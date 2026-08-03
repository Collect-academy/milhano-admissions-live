"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { DailyKpi } from "@/lib/types";

function shortDate(value: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "short",
  }).format(new Date(`${value}T12:00:00`));
}

export function DashboardCharts({
  daily,
  rangeLabel,
}: {
  daily: DailyKpi[];
  rangeLabel: string;
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{rangeLabel}</p>
          <h2>Daily Admissions Activity</h2>
        </div>
        <p className="panel-note">
          Historical events by date, not only the current stage.
        </p>
      </div>

      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={daily}
            margin={{
              top: 8,
              right: 18,
              left: -12,
              bottom: 0,
            }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
            />
            <XAxis
              dataKey="metric_date"
              minTickGap={26}
              tick={{ fontSize: 11 }}
              tickFormatter={shortDate}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11 }}
            />
            <Tooltip
              labelFormatter={(label) =>
                new Intl.DateTimeFormat("en-CA", {
                  dateStyle: "long",
                }).format(
                  new Date(`${label}T12:00:00`),
                )
              }
            />
            <Legend />
            <Line
              dataKey="new_leads"
              dot={false}
              name="New Leads"
              stroke="var(--green)"
              strokeWidth={2}
              type="monotone"
            />
            <Line
              dataKey="tours_scheduled"
              dot={false}
              name="School Tours Booked"
              stroke="var(--gold)"
              strokeWidth={2}
              type="monotone"
            />
            <Line
              dataKey="enrolled"
              dot={false}
              name="Closed"
              stroke="var(--blue)"
              strokeWidth={2}
              type="monotone"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
