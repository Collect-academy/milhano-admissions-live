import "server-only";

import { createSupabaseAdmin } from "@/lib/supabase-admin";

export const ADMISSIONS_V2_CUTOVER = "2026-09-01";

export type V2CascadeMetric = {
  metric_key: string;
  label: string;
  value: number;
};

export type V2CurrentStage = {
  stage_name: string;
  canonical_key: string;
  display_order: number;
  stage_group: string;
  opportunity_count: number;
  open_count: number;
};

export type AdmissionsV2Payload = {
  meta: {
    version: string;
    cutover_date: string;
    effective_start: string;
    effective_end: string;
    legacy_pipeline_id: string | null;
    setter_pipeline_id: string | null;
    closer_pipeline_id: string | null;
    pasadia_calendar_id: string;
  };
  inventory: {
    total_opportunities: number;
    legacy_opportunities: number;
    setter_opportunities: number;
    closer_opportunities: number;
    open_opportunities: number;
    unmapped_stage_opportunities: number;
  };
  general: V2CascadeMetric[];
  informational: {
    disqualified: number;
    no_answer: number;
  };
  booking_breakdown: {
    school_tours: { total: number; cohort: number; external: number };
    trial_days: { total: number; cohort: number; external: number };
  };
  response_breakdown: {
    total: number;
    in_period: number;
    after_period: number;
  };
  setter: {
    owner: string;
    pipeline_id: string;
    funnel: V2CascadeMetric[];
    current_stages: V2CurrentStage[];
  };
  closer: {
    owner: string;
    pipeline_id: string;
    funnel: V2CascadeMetric[];
    current_stages: V2CurrentStage[];
  };
  today: {
    school_tours_today: number;
    trial_days_today: number;
  };
  manual: {
    new_leads: number;
    contacted: number;
    responded: number;
    meaningful: number;
    qualified: number;
    tour_booked: number;
    tour_attended: number;
    trial_booked: number;
    trial_attended: number;
    closed: number;
    reported_days: number;
  };
  stage_map: {
    expected_stage_rows: number;
    resolved_stage_ids: number;
  };
  health: Array<Record<string, unknown>>;
  quality: Array<Record<string, unknown>>;
};

export type AdmissionsV2Lead = {
  metric_row_id?: string | null;
  ghl_opportunity_id: string;
  ghl_contact_id: string | null;
  lead_name: string;
  contact_name: string | null;
  student_name: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
  operational_owner: string | null;
  current_pipeline_role: string | null;
  pipeline_name: string | null;
  current_stage: string | null;
  opportunity_status: string | null;
  lost_reason: string | null;
  lead_at: string;
  metric_at?: string | null;
  metric_event_id?: string | null;
  metric_title?: string | null;
  metric_status?: string | null;
};

const ADMISSIONS_V2_EVENT_METRICS = new Set([
  "school_tours_booked",
  "school_tours_attended",
  "trial_days_booked",
  "trial_days_showed",
  "closed",
]);

export function isAdmissionsV2EventMetric(metricKey: string): boolean {
  return ADMISSIONS_V2_EVENT_METRICS.has(metricKey);
}

function normalizeNumericValues(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeNumericValues);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        normalizeNumericValues(item),
      ]),
    );
  }
  if (typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value)) {
    return Number(value);
  }
  return value;
}

export function clampV2Range(start: string, end: string) {
  if (end < ADMISSIONS_V2_CUTOVER) {
    return { start: ADMISSIONS_V2_CUTOVER, end: ADMISSIONS_V2_CUTOVER };
  }

  return {
    start: start < ADMISSIONS_V2_CUTOVER ? ADMISSIONS_V2_CUTOVER : start,
    end,
  };
}

export async function getAdmissionsV2Payload(
  start: string,
  end: string,
): Promise<AdmissionsV2Payload> {
  const effective = clampV2Range(start, end);
  const supabase = createSupabaseAdmin();
  const result = await supabase.rpc("milhano_get_admissions_v2_payload", {
    p_start: effective.start,
    p_end: effective.end,
  });

  if (result.error) {
    throw new Error(`Unable to load Admissions V2: ${result.error.message}`);
  }

  return normalizeNumericValues(result.data) as AdmissionsV2Payload;
}

export async function getAdmissionsV2MetricLeads(
  metricKey: string,
  scope: "general" | "setter" | "closer",
  start: string,
  end: string,
): Promise<AdmissionsV2Lead[]> {
  const effective = clampV2Range(start, end);
  const supabase = createSupabaseAdmin();

  if (isAdmissionsV2EventMetric(metricKey)) {
    const result = await supabase.rpc("milhano_get_v2_closer_metric_events", {
      p_metric_key: metricKey,
      p_scope: scope,
      p_start: effective.start,
      p_end: effective.end,
    });

    if (result.error) {
      throw new Error(`Unable to load V2 metric events: ${result.error.message}`);
    }

    return (result.data ?? []) as AdmissionsV2Lead[];
  }

  const result = await supabase.rpc("milhano_get_v2_metric_leads_scoped", {
    p_metric_key: metricKey,
    p_scope: scope,
    p_start: effective.start,
    p_end: effective.end,
  });

  if (result.error) {
    throw new Error(`Unable to load V2 metric leads: ${result.error.message}`);
  }

  return ((result.data ?? []) as AdmissionsV2Lead[]).map((lead) => ({
    ...lead,
    metric_row_id: `opportunity:${lead.ghl_opportunity_id}`,
  }));
}
