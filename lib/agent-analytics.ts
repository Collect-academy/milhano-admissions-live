import "server-only";

import type { DateRange } from "@/lib/date-range";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export type AgentActivityEvent = {
  event_timestamp: string;
  event_kind: "assignment" | "crm_stage" | "call" | "whatsapp" | "communication";
  ghl_opportunity_id: string | null;
  ghl_contact_id: string | null;
  event_label: string | null;
};

export type AgentScatterPoint = {
  id: string;
  x: number;
  y: number;
  date: string;
  time: string;
  kind: AgentActivityEvent["event_kind"];
  label: string;
};

export type AgentActivityAnalysis = {
  events: AgentActivityEvent[];
  scatter: AgentScatterPoint[];
  totalEvents: number;
  workWindowEvents: number;
  activeThirtyMinuteBlocks: number;
  medianGapMinutes: number | null;
  maxGapMinutes: number | null;
  actionsPerActiveBlock: number;
  outsideWorkWindow: number;
  byKind: Record<AgentActivityEvent["event_kind"], number>;
};

export type AgentSetterFunnel = {
  new_leads: number;
  contacted: number;
  responded: number;
  meaningful: number;
  qualified: number;
  tour_booked: number;
  new_to_contacted_pct: number | null;
  contacted_to_responded_pct: number | null;
  responded_to_meaningful_pct: number | null;
  meaningful_to_qualified_pct: number | null;
  contacted_to_tour_pct: number | null;
};

type LocalParts = {
  date: string;
  hour: number;
  minute: number;
};

const meridaFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Merida",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function localParts(timestamp: string): LocalParts {
  const parts = Object.fromEntries(
    meridaFormatter
      .formatToParts(new Date(timestamp))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2
    ? ordered[middle]
    : (ordered[middle - 1] + ordered[middle]) / 2;
}

function numeric(value: unknown): number {
  return Number(value ?? 0);
}

function nullableNumeric(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function getAgentActivityAnalysis(
  range: DateRange,
  agentId: string,
): Promise<AgentActivityAnalysis> {
  if (!agentId) {
    return {
      events: [],
      scatter: [],
      totalEvents: 0,
      workWindowEvents: 0,
      activeThirtyMinuteBlocks: 0,
      medianGapMinutes: null,
      maxGapMinutes: null,
      actionsPerActiveBlock: 0,
      outsideWorkWindow: 0,
      byKind: { assignment: 0, crm_stage: 0, call: 0, whatsapp: 0, communication: 0 },
    };
  }

  const admin = createSupabaseAdmin();
  const result = await admin.rpc("milhano_get_agent_activity", {
    p_start: range.start,
    p_end: range.end,
    p_agent_id: agentId,
  });
  if (result.error) {
    throw new Error(`No se pudo cargar la actividad del agente: ${result.error.message}`);
  }

  const events = ((result.data ?? []) as AgentActivityEvent[]).filter((event) => Boolean(event.event_timestamp));
  const byKind: AgentActivityAnalysis["byKind"] = {
    assignment: 0,
    crm_stage: 0,
    call: 0,
    whatsapp: 0,
    communication: 0,
  };

  const bucketMap = new Map<string, AgentScatterPoint>();
  const blockKeys = new Set<string>();
  const perDayMinutes = new Map<string, number[]>();
  let workWindowEvents = 0;
  let outsideWorkWindow = 0;

  events.forEach((event) => {
    const kind = event.event_kind in byKind ? event.event_kind : "communication";
    byKind[kind] += 1;
    const local = localParts(event.event_timestamp);
    const minutes = local.hour * 60 + local.minute;
    if (minutes < 7 * 60 || minutes >= 15 * 60) {
      outsideWorkWindow += 1;
      return;
    }

    workWindowEvents += 1;
    const quarter = Math.floor(local.minute / 15) * 15;
    const halfHour = Math.floor(local.minute / 30) * 30;
    blockKeys.add(`${local.date}|${local.hour}:${String(halfHour).padStart(2, "0")}`);

    const dayMinutes = perDayMinutes.get(local.date) ?? [];
    dayMinutes.push(minutes);
    perDayMinutes.set(local.date, dayMinutes);

    const key = `${local.date}|${local.hour}:${String(quarter).padStart(2, "0")}|${kind}`;
    const existing = bucketMap.get(key);
    if (existing) {
      existing.y += 1;
      return;
    }

    bucketMap.set(key, {
      id: key,
      x: local.hour + quarter / 60,
      y: 1,
      date: local.date,
      time: `${String(local.hour).padStart(2, "0")}:${String(quarter).padStart(2, "0")}`,
      kind,
      label: event.event_label ?? "Actividad",
    });
  });

  const gaps: number[] = [];
  perDayMinutes.forEach((minutes) => {
    const ordered = [...minutes].sort((a, b) => a - b);
    for (let i = 1; i < ordered.length; i += 1) gaps.push(ordered[i] - ordered[i - 1]);
  });

  return {
    events,
    scatter: [...bucketMap.values()].sort((a, b) => a.date.localeCompare(b.date) || a.x - b.x || a.kind.localeCompare(b.kind)),
    totalEvents: events.length,
    workWindowEvents,
    activeThirtyMinuteBlocks: blockKeys.size,
    medianGapMinutes: median(gaps),
    maxGapMinutes: gaps.length ? Math.max(...gaps) : null,
    actionsPerActiveBlock: blockKeys.size ? workWindowEvents / blockKeys.size : 0,
    outsideWorkWindow,
    byKind,
  };
}

export async function getAgentSetterFunnel(
  range: DateRange,
  agentId: string,
): Promise<AgentSetterFunnel> {
  const empty: AgentSetterFunnel = {
    new_leads: 0,
    contacted: 0,
    responded: 0,
    meaningful: 0,
    qualified: 0,
    tour_booked: 0,
    new_to_contacted_pct: null,
    contacted_to_responded_pct: null,
    responded_to_meaningful_pct: null,
    meaningful_to_qualified_pct: null,
    contacted_to_tour_pct: null,
  };
  if (!agentId) return empty;

  const admin = createSupabaseAdmin();
  const result = await admin.rpc("milhano_get_agent_setter_funnel", {
    p_start: range.start,
    p_end: range.end,
    p_agent_id: agentId,
  });
  if (result.error) {
    throw new Error(`No se pudo cargar la conversión Setter del agente: ${result.error.message}`);
  }

  const row = ((result.data ?? [])[0] ?? {}) as Record<string, unknown>;
  return {
    new_leads: numeric(row.new_leads),
    contacted: numeric(row.contacted),
    responded: numeric(row.responded),
    meaningful: numeric(row.meaningful),
    qualified: numeric(row.qualified),
    tour_booked: numeric(row.tour_booked),
    new_to_contacted_pct: nullableNumeric(row.new_to_contacted_pct),
    contacted_to_responded_pct: nullableNumeric(row.contacted_to_responded_pct),
    responded_to_meaningful_pct: nullableNumeric(row.responded_to_meaningful_pct),
    meaningful_to_qualified_pct: nullableNumeric(row.meaningful_to_qualified_pct),
    contacted_to_tour_pct: nullableNumeric(row.contacted_to_tour_pct),
  };
}
