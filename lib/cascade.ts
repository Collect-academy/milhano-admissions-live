import "server-only";

import { unstable_cache } from "next/cache";

import { createSupabaseAdmin } from "@/lib/supabase-admin";
import type { DateRange } from "@/lib/date-range";

export type OperationalCascadeMetric = {
  metric_key: string;
  label: string;
  display_order: number;
  metric_value: number;
  metric_scope: "selected_period" | "today" | "manual_only";
  system_value: number | null;
  eod_manual_extra: number;
  admin_manual_extra: number;
  manual_extra_value: number;
  operational_total: number | null;
  reported_value: number | null;
  gap: number | null;
  reconciliation_status: string;
  definition: string;
  show_in_cascade: boolean;
  supports_manual_extra: boolean;
  system_issue_flag: boolean;
  reported_source: string | null;
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
    pipeline_id: string | null;
    pipeline_name: string | null;
    pipeline_stage_id: string | null;
    current_stage: string | null;
    status: string | null;
    assigned_user: string | null;
    assigned_user_id: string | null;
    grade_interest: string | null;
    level: string | null;
    priority: string | null;
    created_at: string | null;
    updated_at: string | null;
    pipeline_updated_at: string | null;
    lost_reason: string | null;
    ghl_lost_reason_id: string | null;
    historical_comments: string | null;
    last_truth_synced_at: string | null;
  };
  appointments: Array<{
    appointment_id: string;
    appointment_type: string;
    calendar_id: string;
    calendar_name: string | null;
    title: string | null;
    appointment_status: string;
    date_added: string | null;
    date_updated: string | null;
    start_time: string | null;
    end_time: string | null;
    address: string | null;
    notes: string | null;
  }>;
  stageEvents: Array<{
    event_id: string;
    from_stage: string | null;
    to_stage: string | null;
    event_timestamp: string;
    event_source: string | null;
    note: string | null;
  }>;
  recentActivity: Array<{
    event_id: string;
    channel: string;
    direction: string;
    message_type: string | null;
    delivery_status: string | null;
    call_status: string | null;
    call_duration_seconds: number | null;
    is_connected_raw: boolean;
    is_meaningful_conversation: boolean;
    is_meaningful_whatsapp: boolean;
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

async function loadOperationalReconciliation(
  range: DateRange,
): Promise<OperationalCascadeMetric[]> {
  const supabase = createSupabaseAdmin();
  const result = await supabase.rpc(
    "milhano_get_operational_reconciliation",
    {
      p_start: range.start,
      p_end: range.end,
    },
  );

  if (result.error) {
    throw new Error(
      `Unable to load operational reconciliation: ${result.error.message}`,
    );
  }

  const rows = normalizeNumbers(
    result.data,
  ) as unknown as Array<
    Omit<OperationalCascadeMetric, "metric_value">
  >;

  return rows.map((row) => ({
    ...row,
    metric_value: Number(
      row.operational_total ??
      row.system_value ??
      (row.metric_scope === "manual_only" ? row.reported_value : null) ??
      0,
    ),
  }));
}

const cachedOperationalReconciliation = unstable_cache(
  async (start: string, end: string) => loadOperationalReconciliation({
    key: "custom",
    start,
    end,
    label: `${start} – ${end}`,
  }),
  ["milhano-operational-reconciliation-v17"],
  { revalidate: 60 },
);

export async function getOperationalReconciliation(
  range: DateRange,
): Promise<OperationalCascadeMetric[]> {
  return cachedOperationalReconciliation(range.start, range.end);
}

export async function getOperationalCascade(
  range: DateRange,
): Promise<OperationalCascadeMetric[]> {
  const rows = await getOperationalReconciliation(range);

  return rows.filter((row) => row.show_in_cascade);
}

async function loadCascadeLeads(
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

const cachedCascadeLeads = unstable_cache(
  async (metricKey: string, start: string, end: string) => loadCascadeLeads(
    metricKey,
    { key: "custom", start, end, label: `${start} – ${end}` },
  ),
  ["milhano-cascade-leads-v17"],
  { revalidate: 60 },
);

export async function getCascadeLeads(
  metricKey: string,
  range: DateRange,
): Promise<CascadeLead[]> {
  return cachedCascadeLeads(metricKey, range.start, range.end);
}

export async function getLeadDetail(
  opportunityId: string,
): Promise<LeadDetail | null> {
  const supabase = createSupabaseAdmin();
  const result = await supabase.rpc(
    "milhano_get_admissions_lead_detail_v19",
    { p_opportunity_id: opportunityId },
  );

  if (result.error) {
    throw new Error(
      `Unable to load GHL truth detail: ${result.error.message}`,
    );
  }

  if (!result.data) return null;

  const payload = result.data as Record<string, unknown>;
  return {
    opportunity: payload.opportunity as LeadDetail["opportunity"],
    appointments: (payload.appointments ?? []) as LeadDetail["appointments"],
    stageEvents: (payload.stage_events ?? []) as LeadDetail["stageEvents"],
    recentActivity: (payload.recent_activity ?? []) as LeadDetail["recentActivity"],
  };
}
