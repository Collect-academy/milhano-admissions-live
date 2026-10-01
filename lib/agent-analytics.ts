import "server-only";

import type { DateRange } from "@/lib/date-range";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const SETTER_PIPELINE_ID = "GYqHbZyWUxxc3K03efVT";
const CLOSER_PIPELINE_ID = "z1FEJfbtOHusjdwe40Ko";
const PATHI_GHL_USER_ID = "LTJEPAdClnxPxUd2mRXp";

export type AgentDirectoryEntry = {
  ghl_user_id: string;
  display_name: string;
};

export type AgentActivityEvent = {
  event_timestamp: string;
  event_kind: "assignment" | "crm_stage" | "call" | "whatsapp" | "communication";
  ghl_opportunity_id: string | null;
  ghl_contact_id: string | null;
  event_label: string | null;
  agent_id: string;
  attribution_basis: "explicit_owner" | "owner_at_event" | "communication_user" | "pathi_fallback_unassigned" | string;
};

export type AgentScatterPoint = {
  id: string;
  x: number;
  y: number;
  date: string;
  time: string;
  agentId: string;
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
  pathiFallbackEvents: number;
  byKind: Record<AgentActivityEvent["event_kind"], number>;
};

export type AgentSetterJourney = {
  new_leads_assigned: number;
  new_leads_contacted: number;
  new_to_contacted_pct: number | null;
  calls_made: number;
  responded: number;
  no_answer: number;
  disqualified: number;
  meaningful: number;
  qualified: number;
  tour_booked: number;
  calls_to_responded_pct: number | null;
  responded_to_meaningful_pct: number | null;
  meaningful_to_qualified_pct: number | null;
  contacted_to_tour_pct: number | null;
};

type LocalParts = {
  date: string;
  hour: number;
  minute: number;
};

type AppUserRow = {
  ghl_user_id: string | null;
  display_name: string | null;
};

type OpportunityOwnerRow = {
  assigned_user_id: string | null;
  assigned_user: string | null;
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

function fallbackName(userId: string, assignedUser: string | null | undefined): string {
  const clean = assignedUser?.trim();
  if (clean && clean !== userId) return clean;
  return `GHL · ${userId.slice(-6)}`;
}

function dashboardAgentName(userId: string, rawName: string): string {
  if (userId === PATHI_GHL_USER_ID) return "Paty Carrillo";
  return rawName;
}

export async function getSetterAgentDirectory(): Promise<AgentDirectoryEntry[]> {
  const admin = createSupabaseAdmin();
  const [usersResult, ownersResult] = await Promise.all([
    admin
      .from("milhano_app_users")
      .select("ghl_user_id,display_name")
      .eq("is_active", true)
      .not("ghl_user_id", "is", null),
    admin
      .from("milhano_opportunities")
      .select("assigned_user_id,assigned_user")
      .in("pipeline_id", [SETTER_PIPELINE_ID, CLOSER_PIPELINE_ID])
      .not("assigned_user_id", "is", null),
  ]);

  if (usersResult.error) {
    throw new Error(`No se pudo cargar el directorio GHL: ${usersResult.error.message}`);
  }
  if (ownersResult.error) {
    throw new Error(`No se pudieron cargar los owners de opportunities: ${ownersResult.error.message}`);
  }

  const names = new Map<string, string>();
  ((usersResult.data ?? []) as AppUserRow[]).forEach((row) => {
    if (!row.ghl_user_id) return;
    const name = row.display_name?.trim();
    if (name) names.set(row.ghl_user_id, dashboardAgentName(row.ghl_user_id, name));
  });

  ((ownersResult.data ?? []) as OpportunityOwnerRow[]).forEach((row) => {
    if (!row.assigned_user_id) return;
    if (!names.has(row.assigned_user_id)) {
      names.set(
        row.assigned_user_id,
        dashboardAgentName(row.assigned_user_id, fallbackName(row.assigned_user_id, row.assigned_user)),
      );
    }
  });

  // Paty must always remain selectable because unassigned historical opportunities
  // are temporarily attributed to her in the agent analytics view.
  if (!names.has(PATHI_GHL_USER_ID)) names.set(PATHI_GHL_USER_ID, "Paty Carrillo");

  return [...names.entries()]
    .map(([ghl_user_id, display_name]) => ({ ghl_user_id, display_name }))
    .sort((a, b) => a.display_name.localeCompare(b.display_name, "es"));
}

export async function getAgentActivityAnalysis(
  range: DateRange,
  agentId: string,
): Promise<AgentActivityAnalysis> {
  const admin = createSupabaseAdmin();
  const result = await admin.rpc("milhano_get_agent_activity", {
    p_start: range.start,
    p_end: range.end,
    p_agent_id: agentId,
  });
  if (result.error) {
    throw new Error(`No se pudo cargar la actividad del agente: ${result.error.message}`);
  }

  const events = ((result.data ?? []) as AgentActivityEvent[]).filter(
    (event) => Boolean(event.event_timestamp) && Boolean(event.agent_id),
  );
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
  let pathiFallbackEvents = 0;

  events.forEach((event) => {
    const kind = event.event_kind in byKind ? event.event_kind : "communication";
    byKind[kind] += 1;
    if (event.attribution_basis === "pathi_fallback_unassigned") pathiFallbackEvents += 1;

    const local = localParts(event.event_timestamp);
    const minutes = local.hour * 60 + local.minute;
    if (minutes < 7 * 60 || minutes >= 15 * 60) {
      outsideWorkWindow += 1;
      return;
    }

    workWindowEvents += 1;
    const quarter = Math.floor(local.minute / 15) * 15;
    const halfHour = Math.floor(local.minute / 30) * 30;
    blockKeys.add(`${local.date}|${local.hour}:${String(halfHour).padStart(2, "0")}|${event.agent_id}`);

    const dayMinutes = perDayMinutes.get(local.date) ?? [];
    dayMinutes.push(minutes);
    perDayMinutes.set(local.date, dayMinutes);

    const key = `${local.date}|${local.hour}:${String(quarter).padStart(2, "0")}|${event.agent_id}`;
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
      agentId: event.agent_id,
    });
  });

  const gaps: number[] = [];
  perDayMinutes.forEach((minutes) => {
    const ordered = [...minutes].sort((a, b) => a - b);
    for (let i = 1; i < ordered.length; i += 1) gaps.push(ordered[i] - ordered[i - 1]);
  });

  return {
    events,
    scatter: [...bucketMap.values()].sort(
      (a, b) => a.date.localeCompare(b.date) || a.x - b.x || a.agentId.localeCompare(b.agentId),
    ),
    totalEvents: events.length,
    workWindowEvents,
    activeThirtyMinuteBlocks: blockKeys.size,
    medianGapMinutes: median(gaps),
    maxGapMinutes: gaps.length ? Math.max(...gaps) : null,
    actionsPerActiveBlock: blockKeys.size ? workWindowEvents / blockKeys.size : 0,
    outsideWorkWindow,
    pathiFallbackEvents,
    byKind,
  };
}

export async function getSetterAgentJourney(
  range: DateRange,
  agentId: string,
): Promise<AgentSetterJourney> {
  const admin = createSupabaseAdmin();
  const result = await admin.rpc("milhano_get_setter_agent_journey", {
    p_start: range.start,
    p_end: range.end,
    p_agent_id: agentId,
  });
  if (result.error) {
    throw new Error(`No se pudo cargar el viaje Setter: ${result.error.message}`);
  }

  const row = ((result.data ?? [])[0] ?? {}) as Record<string, unknown>;
  return {
    new_leads_assigned: numeric(row.new_leads_assigned),
    new_leads_contacted: numeric(row.new_leads_contacted),
    new_to_contacted_pct: nullableNumeric(row.new_to_contacted_pct),
    calls_made: numeric(row.calls_made),
    responded: numeric(row.responded),
    no_answer: numeric(row.no_answer),
    disqualified: numeric(row.disqualified),
    meaningful: numeric(row.meaningful),
    qualified: numeric(row.qualified),
    tour_booked: numeric(row.tour_booked),
    calls_to_responded_pct: nullableNumeric(row.calls_to_responded_pct),
    responded_to_meaningful_pct: nullableNumeric(row.responded_to_meaningful_pct),
    meaningful_to_qualified_pct: nullableNumeric(row.meaningful_to_qualified_pct),
    contacted_to_tour_pct: nullableNumeric(row.contacted_to_tour_pct),
  };
}
