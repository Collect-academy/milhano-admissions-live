-- ============================================================
-- MILHANO | 11 | OPTIONAL PRECHECK (READ ONLY)
-- Run before MILHANO_11_RECONCILIATION_LAYER.sql if you want a
-- quick compatibility check against the current Supabase schema.
-- This script does not modify data.
-- ============================================================

with required_relations(relation_name) as (
    values
        ('milhano_opportunities'),
        ('milhano_stage_events'),
        ('milhano_communication_events'),
        ('milhano_school_tour_details'),
        ('milhano_eod_metric_catalog'),
        ('milhano_eod_metric_values'),
        ('milhano_eod_submissions'),
        ('milhano_eod_submission_actions'),
        ('milhano_app_users'),
        ('vw_milhano_first_human_touch'),
        ('vw_milhano_positive_stage_advances')
),
required_columns(relation_name, column_name) as (
    values
        ('milhano_opportunities', 'ghl_opportunity_id'),
        ('milhano_opportunities', 'ghl_contact_id'),
        ('milhano_opportunities', 'original_lead_date'),
        ('milhano_opportunities', 'created_at'),
        ('milhano_opportunities', 'assigned_user_id'),
        ('milhano_stage_events', 'event_id'),
        ('milhano_stage_events', 'event_timestamp'),
        ('milhano_stage_events', 'ghl_opportunity_id'),
        ('milhano_stage_events', 'ghl_contact_id'),
        ('milhano_stage_events', 'to_stage'),
        ('milhano_stage_events', 'is_valid'),
        ('milhano_stage_events', 'attributed_ghl_user_id'),
        ('milhano_communication_events', 'event_id'),
        ('milhano_communication_events', 'event_timestamp'),
        ('milhano_communication_events', 'ghl_user_id'),
        ('milhano_communication_events', 'ghl_opportunity_id'),
        ('milhano_communication_events', 'ghl_contact_id'),
        ('milhano_communication_events', 'channel'),
        ('milhano_communication_events', 'direction'),
        ('milhano_communication_events', 'is_call_attempt'),
        ('milhano_communication_events', 'is_connected_raw'),
        ('milhano_communication_events', 'is_meaningful_conversation'),
        ('milhano_eod_metric_values', 'system_value'),
        ('milhano_eod_metric_values', 'declared_value'),
        ('milhano_eod_metric_values', 'user_confirmed'),
        ('milhano_eod_metric_values', 'discrepancy_note'),
        ('milhano_eod_submissions', 'status'),
        ('milhano_eod_submissions', 'eod_date'),
        ('milhano_school_tour_details', 'scheduled_for'),
        ('milhano_school_tour_details', 'attendance_status'),
        ('milhano_school_tour_details', 'attended_at')
),
missing_relations as (
    select r.relation_name
    from required_relations r
    where to_regclass('public.' || r.relation_name) is null
),
missing_columns as (
    select rc.relation_name, rc.column_name
    from required_columns rc
    where not exists (
        select 1
        from information_schema.columns c
        where c.table_schema = 'public'
          and c.table_name = rc.relation_name
          and c.column_name = rc.column_name
    )
),
checks as (
    select jsonb_build_object(
        'generated_at', now(),
        'compatible',
            not exists (select 1 from missing_relations)
            and not exists (select 1 from missing_columns)
            and to_regprocedure('public.milhano_get_eod_window(date)') is not null
            and to_regprocedure('public.milhano_refresh_eod_snapshot(uuid,date)') is not null,
        'missing_relations', coalesce((
            select jsonb_agg(relation_name order by relation_name)
            from missing_relations
        ), '[]'::jsonb),
        'missing_columns', coalesce((
            select jsonb_agg(
                jsonb_build_object(
                    'relation', relation_name,
                    'column', column_name
                )
                order by relation_name, column_name
            )
            from missing_columns
        ), '[]'::jsonb),
        'get_eod_window_exists',
            to_regprocedure('public.milhano_get_eod_window(date)') is not null,
        'refresh_eod_snapshot_exists',
            to_regprocedure('public.milhano_refresh_eod_snapshot(uuid,date)') is not null
    ) as result
)
select jsonb_pretty(result)
from checks;
