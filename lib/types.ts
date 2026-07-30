export type PipelineSummary = {
  display_order: number;
  stage_name: string;
  stage_group: string;
  opportunity_count: number;
  open_count: number;
  won_count: number;
  lost_count: number;
  open_8_plus_days: number;
};

export type FunnelSummary = {
  stage_order: number;
  stage_name: string;
  reached_count: number;
  previous_stage_reached_count: number | null;
  conversion_from_previous_pct: number | null;
  conversion_from_lead_pct: number | null;
};

export type DailyKpi = {
  metric_date: string;
  new_leads: number;
  entered_followup: number;
  fits: number;
  tours_scheduled: number;
  tours_attended: number;
  passdays_scheduled: number;
  passdays_attended: number;
  feedbacks: number;
  evaluations: number;
  enrollment_process_started: number;
  enrolled: number;
  no_fit: number;
  lost: number;
  calls: number;
  opportunities_called: number;
};

export type PerformanceRow = {
  source?: string;
  operational_owner?: string;
  leads: number;
  fits: number;
  tours_scheduled: number;
  tours_attended: number;
  passdays_scheduled: number;
  passdays_attended: number;
  enrollment_process_started: number;
  enrolled: number;
  lead_to_fit_pct: number | null;
  lead_to_enrolled_pct: number | null;
};

export type ExitSummary = {
  exit_type: string;
  exit_from_stage: string;
  exit_reason: string;
  opportunity_count: number;
};

export type StaleOpportunity = {
  ghl_opportunity_id: string;
  opportunity_name: string;
  student_name: string | null;
  current_stage: string;
  operational_owner: string;
  days_since_update: number | null;
  source: string | null;
};

export type DashboardData = {
  pipeline: PipelineSummary[];
  funnel: FunnelSummary[];
  daily: DailyKpi[];
  sources: PerformanceRow[];
  owners: PerformanceRow[];
  exits: ExitSummary[];
  stale: StaleOpportunity[];
};
