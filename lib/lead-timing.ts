import "server-only";

import { createSupabaseAdmin } from "@/lib/supabase-admin";

export type FollowupEvent = { at: string; stage: string };
export type CallEvent = { at: string; status: string | null; connected: boolean };

export type LeadTiming = {
  ghl_opportunity_id: string;
  ghl_contact_id: string | null;
  lead_at: string | null;
  first_human_attempt_at: string | null;
  first_response_at: string | null;
  manual_call_attempts: number;
  unanswered_call_followups: number;
  no_answer_stage_followups: number;
  followup_history: FollowupEvent[];
  call_history: CallEvent[];
  school_tour_booked_at: string | null;
  school_tour_scheduled_at: string | null;
  school_tour_status: string | null;
  trial_day_booked_at: string | null;
  trial_day_scheduled_at: string | null;
  trial_day_status: string | null;
  closed_at: string | null;
  contact_opportunity_count: number;
};

export function elapsed(start: string | null | undefined, end: string | null | undefined): string {
  if (!start || !end) return "—";
  const difference = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(difference) || difference < 0) return "No comparable";
  const mins = Math.floor(difference / 60_000);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ${mins % 60} min`;
  return `${Math.floor(hours / 24)} d ${hours % 24} h`;
}

export async function getLeadTimingRows(ids: string[]): Promise<LeadTiming[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return [];
  const supabase = createSupabaseAdmin();
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += 100) chunks.push(unique.slice(i, i + 100));
  // At most two concurrent RPCs to protect Supabase and avoid pressure on other views.
  const rows: LeadTiming[] = [];
  for (let i = 0; i < chunks.length; i += 2) {
    const results = await Promise.all(chunks.slice(i, i + 2).map((chunk) =>
      supabase.rpc("milhano_get_lead_timing_v1", { p_opportunity_ids: chunk }),
    ));
    for (const result of results) {
      if (result.error) throw new Error(`Unable to load lead timing: ${result.error.message}`);
      rows.push(...((result.data ?? []) as LeadTiming[]));
    }
  }
  return rows;
}

export type ContactTiming = {
  ghl_opportunity_id: string;
  first_human_attempt_at: string | null;
  first_response_at: string | null;
  no_answer_stage_followups: number;
  unanswered_call_followups: number;
};

export async function getContactTimingRows(ids: string[]): Promise<ContactTiming[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return [];
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase.rpc("milhano_get_contact_timing_v1", { p_opportunity_ids: unique.slice(0, 2000) });
  if (error) throw new Error(`Unable to load contact timing: ${error.message}`);
  return (data ?? []) as ContactTiming[];
}


/** Evidence of the first observable management action, not proof of call time. */
export type StageTransition = {
  at: string;
  from_stage: string | null;
  to_stage: string | null;
};

export type ManagementEvidence = {
  ghl_opportunity_id: string;
  first_management_at: string | null;
  first_management_source: "stage_change" | "appointment_created" | "manual_outbound" | null;
  first_real_stage_at: string | null;
  first_real_stage_to: string | null;
  first_appointment_booked_at: string | null;
  first_manual_outbound_at: string | null;
  first_commercial_progress_at: string | null;
  first_commercial_progress_source: "progress_stage" | "appointment_created" | null;
  real_stage_followup_count: number;
  real_stage_history: StageTransition[];
};

export async function getManagementEvidenceRows(ids: string[]): Promise<ManagementEvidence[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return [];
  const supabase = createSupabaseAdmin();
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += 200) chunks.push(unique.slice(i, i + 200));
  const rows: ManagementEvidence[] = [];
  for (let i = 0; i < chunks.length; i += 2) {
    const results = await Promise.all(chunks.slice(i, i + 2).map(chunk =>
      supabase.rpc("milhano_get_management_evidence_v1", { p_opportunity_ids: chunk })
    ));
    for (const result of results) {
      if (result.error) throw new Error(`Unable to load management evidence: ${result.error.message}`);
      rows.push(...((result.data ?? []) as ManagementEvidence[]));
    }
  }
  return rows;
}

/** Stage changes and appointment bookings are latest-known evidence, never exact call timestamps. */
export function managementElapsed(
  leadAt: string | null | undefined,
  evidence: ManagementEvidence | null | undefined,
): string {
  if (!evidence?.first_management_at) return "Sin evidencia";
  const duration = elapsed(leadAt, evidence.first_management_at);
  if (duration === "—" || duration === "No comparable") return duration;
  return evidence.first_management_source === "manual_outbound" ? duration : `≤ ${duration}`;
}

export function managementSourceLabel(source: ManagementEvidence["first_management_source"]): string {
  if (source === "stage_change") return "Cambio real de stage (GHL) · el contacto pudo ser anterior";
  if (source === "appointment_created") return "Cita creada · evidencia indirecta; no es hora de llamada";
  if (source === "manual_outbound") return "Comunicación saliente manual registrada en GHL";
  return "Sin gestión observable en los registros disponibles";
}
