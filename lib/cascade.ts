import "server-only";

import { createSupabaseAdmin } from "@/lib/supabase-admin";
import type { DateRange } from "@/lib/date-range";

export type OperationalCascadeMetric = {
  metric_key: string;
  label: string;
  display_order: number;
  metric_value: number;
  metric_scope: "selected_period" | "today";
  definition: string;
};

export type CascadeLead = {
  metric_key: string;
  ghl_opportunity_id: string | null;
  ghl_contact_id: string | null;
  lead_name: string;
  contact_name: string | null;
  student_name: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
  current_stage: string | null;
  opportunity_status: string | null;
  operational_owner: string | null;
  grade_interest: string | null;
  activity_at: string | null;
  activity_count: number;
  scheduled_for: string | null;
  attendance_status: string;
  attended_at: string | null;
  has_objection: boolean;
  objection_summary: string | null;
  school_tour_notes: string | null;
  no_show_reason: string | null;
  historical_comments: string | null;
};

export type LeadDetail = {
  opportunity: {
    ghl_opportunity_id: string;
    ghl_contact_id: string | null;
    opportunity_name: string | null;
    contact_name: string | null;
    student_name: string | null;
    phone: string | null;
    email: string | null;
    source: string | null;
    current_stage: string | null;
    status: string | null;
    assigned_user: string | null;
    historical_advisor: string | null;
    grade_interest: string | null;
    level: string | null;
    priority: string | null;
    original_lead_date: string | null;
    created_at: string | null;
    updated_at: string | null;
    historical_comments: string | null;
  };
  schoolTour: {
    scheduled_for: string | null;
    attendance_status: string;
    attended_at: string | null;
    has_objection: boolean;
    objection_summary: string | null;
    school_tour_notes: string | null;
    no_show_reason: string | null;
    school_tour_updated_at: string | null;
  };
  stageEvents: Array<{
    event_id: string;
    from_stage: string | null;
    to_stage: string | null;
    event_timestamp: string;
    event_source: string | null;
    note: string | null;
  }>;
  calls: Array<{
    event_id: string;
    direction: string;
    call_status: string | null;
    call_duration_seconds: number | null;
    is_connected_raw: boolean;
    is_meaningful_conversation: boolean;
    event_timestamp: string;
  }>;
};

function normalizeNumbers<T extends Record<string, unknown>>(
  rows: T[] | null,
): T[] {
  return (rows ?? []).map((row) => {
    const normalized = { ...row };

    for (const [key, value] of Object.entries(normalized)) {
      if (
        typeof value === "string" &&
        /^-?\d+(\.\d+)?$/.test(value)
      ) {
        normalized[key as keyof T] = Number(
          value,
        ) as T[keyof T];
      }
    }

    return normalized;
  });
}

export async function getOperationalCascade(
  range: DateRange,
): Promise<OperationalCascadeMetric[]> {
  const supabase = createSupabaseAdmin();
  const result = await supabase.rpc(
    "milhano_get_operational_cascade",
    {
      p_start: range.start,
      p_end: range.end,
    },
  );

  if (result.error) {
    throw new Error(
      `Unable to load the operational cascade: ${result.error.message}`,
    );
  }

  return normalizeNumbers(
    result.data,
  ) as unknown as OperationalCascadeMetric[];
}

export async function getCascadeLeads(
  metricKey: string,
  range: DateRange,
): Promise<CascadeLead[]> {
  const supabase = createSupabaseAdmin();
  const result = await supabase.rpc(
    "milhano_get_operational_cascade_leads",
    {
      p_metric_key: metricKey,
      p_start: range.start,
      p_end: range.end,
    },
  );

  if (result.error) {
    throw new Error(
      `Unable to load lead details: ${result.error.message}`,
    );
  }

  return normalizeNumbers(
    result.data,
  ) as unknown as CascadeLead[];
}

export async function getLeadDetail(
  opportunityId: string,
): Promise<LeadDetail | null> {
  const supabase = createSupabaseAdmin();

  const [
    opportunityResult,
    tourResult,
    stageResult,
    callsResult,
  ] = await Promise.all([
    supabase
      .from("milhano_opportunities")
      .select(
        "ghl_opportunity_id, ghl_contact_id, opportunity_name, contact_name, student_name, phone, email, source, current_stage, status, assigned_user, historical_advisor, grade_interest, level, priority, original_lead_date, created_at, updated_at, historical_comments",
      )
      .eq("ghl_opportunity_id", opportunityId)
      .maybeSingle(),
    supabase
      .from("vw_milhano_school_tour_details")
      .select(
        "scheduled_for, attendance_status, attended_at, has_objection, objection_summary, school_tour_notes, no_show_reason, school_tour_updated_at",
      )
      .eq("ghl_opportunity_id", opportunityId)
      .maybeSingle(),
    supabase
      .from("milhano_stage_events")
      .select(
        "event_id, from_stage, to_stage, event_timestamp, event_source, note",
      )
      .eq("ghl_opportunity_id", opportunityId)
      .eq("is_valid", true)
      .order("event_timestamp", { ascending: false })
      .limit(100),
    supabase
      .from("milhano_communication_events")
      .select(
        "event_id, direction, call_status, call_duration_seconds, is_connected_raw, is_meaningful_conversation, event_timestamp",
      )
      .eq("ghl_opportunity_id", opportunityId)
      .ilike("channel", "call")
      .order("event_timestamp", { ascending: false })
      .limit(50),
  ]);

  if (opportunityResult.error) {
    throw new Error(
      `Unable to load the opportunity: ${opportunityResult.error.message}`,
    );
  }

  if (!opportunityResult.data) {
    return null;
  }

  if (tourResult.error) {
    throw new Error(
      `Unable to load School Tour details: ${tourResult.error.message}`,
    );
  }

  if (stageResult.error) {
    throw new Error(
      `Unable to load stage history: ${stageResult.error.message}`,
    );
  }

  if (callsResult.error) {
    throw new Error(
      `Unable to load call history: ${callsResult.error.message}`,
    );
  }

  const tour = tourResult.data;

  return {
    opportunity: opportunityResult.data,
    schoolTour: {
      scheduled_for: tour?.scheduled_for ?? null,
      attendance_status:
        tour?.attendance_status ?? "unknown",
      attended_at: tour?.attended_at ?? null,
      has_objection: tour?.has_objection ?? false,
      objection_summary: tour?.objection_summary ?? null,
      school_tour_notes: tour?.school_tour_notes ?? null,
      no_show_reason: tour?.no_show_reason ?? null,
      school_tour_updated_at:
        tour?.school_tour_updated_at ?? null,
    },
    stageEvents: stageResult.data ?? [],
    calls: callsResult.data ?? [],
  };
}
