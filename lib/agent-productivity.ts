import "server-only";

import { createSupabaseAdmin } from "@/lib/supabase-admin";
import type { DateRange } from "@/lib/date-range";

export type AgentProductivityRow = {
  ghl_user_id: string;
  display_name: string;
  current_assigned: number;
  current_open: number;
  current_new_lead: number;
  current_no_answer: number;
  current_callback: number;
  stage_moves: number;
  opportunities_worked: number;
  qualified_moves: number;
  tour_booked_moves: number;
  tour_attended_moves: number;
  trial_booked_moves: number;
  trial_attended_moves: number;
  closed_moves: number;
  call_attempts: number;
  connected_calls: number;
  manual_whatsapp: number;
  meaningful_conversations: number;
  unique_contacts_worked: number;
};

export type AgentProductivityData = {
  rows: AgentProductivityRow[];
  selected: AgentProductivityRow | null;
  unassignedOpen: number;
};

function numbers(row: Record<string, unknown>): AgentProductivityRow {
  const numericKeys = [
    "current_assigned",
    "current_open",
    "current_new_lead",
    "current_no_answer",
    "current_callback",
    "stage_moves",
    "opportunities_worked",
    "qualified_moves",
    "tour_booked_moves",
    "tour_attended_moves",
    "trial_booked_moves",
    "trial_attended_moves",
    "closed_moves",
    "call_attempts",
    "connected_calls",
    "manual_whatsapp",
    "meaningful_conversations",
    "unique_contacts_worked",
  ] as const;

  const result = { ...row } as Record<string, unknown>;
  numericKeys.forEach((key) => { result[key] = Number(result[key] ?? 0); });
  return result as AgentProductivityRow;
}

export async function getAgentProductivity(
  range: DateRange,
  selectedAgentId = "",
): Promise<AgentProductivityData> {
  const admin = createSupabaseAdmin();
  const [productivity, unassigned] = await Promise.all([
    admin.rpc("milhano_get_agent_productivity", {
      p_start: range.start,
      p_end: range.end,
    }),
    admin.rpc("milhano_get_unassigned_admissions_count"),
  ]);

  if (productivity.error) {
    throw new Error(`No se pudo cargar productividad por owner: ${productivity.error.message}`);
  }
  if (unassigned.error) {
    throw new Error(`No se pudo cargar la cola sin owner: ${unassigned.error.message}`);
  }

  const rows = ((productivity.data ?? []) as Record<string, unknown>[]).map(numbers);
  return {
    rows,
    selected: rows.find((row) => row.ghl_user_id === selectedAgentId) ?? null,
    unassignedOpen: Number(unassigned.data ?? 0),
  };
}
