"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { WhatsAppDaily } from "@/lib/types";
import type { Locale } from "@/lib/locale";

function shortDate(value: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "short",
  }).format(new Date(`${value}T12:00:00`));
}

export function WhatsAppActivityChart({ data, locale = "en" }: { data: WhatsAppDaily[]; locale?: Locale }) {
  return (
    <div className="chart-wrapper">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="activity_date"
            tickFormatter={shortDate}
            minTickGap={22}
            tick={{ fontSize: 11 }}
          />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip
            labelFormatter={(label) =>
              new Intl.DateTimeFormat("en-CA", {
                dateStyle: "long",
              }).format(new Date(`${label}T12:00:00`))
            }
          />
          <Legend />
          <Bar
            dataKey="inbound_messages"
            name={locale === "es" ? "Entrantes" : "Inbound"}
            stackId="messages"
            fill="var(--blue)"
            radius={[0, 0, 0, 0]}
          />
          <Bar
            dataKey="manual_outbound_messages"
            name={locale === "es" ? "Salientes manuales" : "Manual Outbound"}
            stackId="messages"
            fill="var(--green)"
            radius={[5, 5, 0, 0]}
          />
          <Line
            type="monotone"
            dataKey="active_conversations"
            name={locale === "es" ? "Conversaciones" : "Conversations"}
            stroke="var(--gold)"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function WhatsAppClassificationChart({ data, locale = "en" }: { data: WhatsAppDaily[]; locale?: Locale }) {
  return (
    <div className="chart-wrapper">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
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
            dataKey="admissions_related_messages"
            name={locale === "es" ? "Con Opportunity" : "With Opportunity"}
            stackId="classification"
            fill="var(--green)"
          />
          <Bar
            dataKey="general_or_unclassified_messages"
            name={locale === "es" ? "General / Sin clasificar" : "General / Unclassified"}
            stackId="classification"
            fill="var(--gold)"
            radius={[5, 5, 0, 0]}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
