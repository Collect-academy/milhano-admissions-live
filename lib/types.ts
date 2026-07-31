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

export type WhatsAppDaily = {
  activity_date: string;
  total_messages: number;
  inbound_messages: number;
  outbound_messages: number;
  manual_outbound_messages: number;
  automated_outbound_messages: number;
  failed_outbound_messages: number;
  active_conversations: number;
  manually_attended_conversations: number;
  unique_contacts: number;
  admissions_related_messages: number;
  general_or_unclassified_messages: number;
  messages_per_active_conversation: number | null;
  manual_messages_per_attended_conversation: number | null;
};

export type WhatsAppSummary = {
  total_messages: number;
  inbound_messages: number;
  outbound_messages: number;
  manual_outbound_messages: number;
  automated_outbound_messages: number;
  active_conversations: number;
  unique_contacts: number;
  admissions_related_messages: number;
  general_or_unclassified_messages: number;
  first_message_at: string | null;
  last_message_at: string | null;
};

export type CallDaily = {
  activity_date: string;
  total_call_attempts: number;
  outbound_attempts: number;
  inbound_calls: number;
  probable_return_calls: number;
  ghl_connected_calls: number;
  meaningful_3min_plus_calls: number;
  no_answer_calls: number;
  voicemail_calls: number;
  busy_calls: number;
  failed_or_canceled_calls: number;
  unique_contacts_called: number;
  total_duration_seconds: number;
  average_duration_seconds: number | null;
  ghl_pickup_rate_pct: number | null;
  meaningful_3min_pickup_rate_pct: number | null;
};

export type CallDailyUser = {
  activity_date: string;
  ghl_user_id: string | null;
  app_user_id: string | null;
  advisor_name: string;
  total_call_attempts: number;
  outbound_attempts: number;
  inbound_calls: number;
  ghl_connected_calls: number;
  meaningful_3min_plus_calls: number;
  unique_contacts: number;
  total_duration_seconds: number;
  meaningful_3min_pickup_rate_pct: number | null;
};

export type CallOutcome = {
  event_id: string;
  ghl_message_id: string | null;
  ghl_contact_id: string | null;
  ghl_opportunity_id: string | null;
  ghl_user_id: string | null;
  direction: string;
  call_status: string | null;
  call_duration_seconds: number;
  is_connected_raw: boolean;
  is_meaningful_conversation: boolean;
  call_disposition: string | null;
  call_timestamp: string;
  from_stage: string | null;
  to_stage: string | null;
  stage_event_timestamp: string | null;
  observed_outcome_24h: string;
  outcome_source: string;
};

export type EodDashboardRow = {
  submission_id: string;
  app_user_id: string;
  display_name: string;
  eod_date: string;
  window_start: string;
  window_end: string;
  submission_status: string;
  submission_comments: string | null;
  system_snapshot_generated_at: string | null;
  validated_at: string | null;
  submitted_at: string | null;
  validated_by_app_user_id: string | null;
  metric_key: string;
  label: string;
  description: string | null;
  display_order: number;
  is_system_only: boolean;
  requires_user_confirmation: boolean;
  blocks_submission_on_mismatch: boolean;
  system_value: number;
  declared_value: number | null;
  difference: number | null;
  user_confirmed: boolean;
  discrepancy_note: string | null;
  reconciliation_status: string;
};

export type EodTeamSnapshot = {
  eod_date: string;
  window_start: string;
  window_end: string;
  metrics: Record<string, number>;
  generated_at: string;
  updated_at: string;
};

export type SyncRun = {
  id: string;
  sync_type: string;
  status: string;
  records_read: number;
  records_inserted: number;
  records_updated: number;
  records_failed: number;
  started_at: string;
  finished_at: string | null;
  details: Record<string, unknown> | null;
};

export type DashboardPeriodSummary = {
  new_leads: number;
  fits: number;
  tours_scheduled: number;
  tours_attended: number;
  enrolled: number;
  whatsapp_messages: number;
  whatsapp_conversations_daily_sum: number;
  call_attempts: number;
  outbound_call_attempts: number;
};

export type DashboardData = {
  pipeline: PipelineSummary[];
  funnel: FunnelSummary[];
  daily: DailyKpi[];
  sources: PerformanceRow[];
  owners: PerformanceRow[];
  exits: ExitSummary[];
  stale: StaleOpportunity[];
  latestWhatsapp: WhatsAppDaily | null;
  latestCalls: CallDaily | null;
  latestEod: EodTeamSnapshot | null;
  period: DashboardPeriodSummary;
};

export type WhatsAppDashboardData = {
  daily: WhatsAppDaily[];
  summary: WhatsAppSummary | null;
  latestEod: EodTeamSnapshot | null;
  backfill: WhatsAppBackfillStatus | null;
};

export type CallsDashboardData = {
  daily: CallDaily[];
  byUser: CallDailyUser[];
  outcomes: CallOutcome[];
};

export type EodData = {
  rows: EodDashboardRow[];
  snapshots: EodTeamSnapshot[];
  syncRuns: SyncRun[];
};


export type PipelineOpportunity = {
  ghl_opportunity_id: string;
  opportunity_name: string;
  contact_name: string | null;
  student_name: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
  current_stage: string;
  status: string;
  operational_owner: string;
  created_at: string | null;
  original_lead_date: string | null;
  updated_at: string | null;
  days_since_update: number | null;
  inactivity_bucket: string | null;
  grade_interest: string | null;
  level: string | null;
  school_cycle: string | null;
  priority: string | null;
};

export type PipelineFilters = {
  q?: string;
  stage?: string;
  owner?: string;
  source?: string;
  status?: string;
  inactivity?: string;
  range?: string;
  from?: string;
  to?: string;
  page?: number;
};

export type PipelineOperationalData = {
  rows: PipelineOpportunity[];
  totalFiltered: number;
  totalRows: number;
  page: number;
  pageSize: number;
  totalPages: number;
  stages: string[];
  owners: string[];
  sources: string[];
  statuses: string[];
  inactivityBuckets: string[];
};

export type WhatsAppBackfillStatus = {
  status: string;
  pages_processed: number;
  records_seen: number;
  records_processed: number;
  total_reported: number | null;
  progress_pct: number | null;
  started_at: string | null;
  last_page_at: string | null;
  completed_at: string | null;
};
