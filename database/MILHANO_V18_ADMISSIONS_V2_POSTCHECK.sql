-- READ ONLY post-deployment checks for Admissions V2.

select
  pipeline_id,
  pipeline_name,
  pipeline_role,
  count(*) as stages,
  count(stage_id) as resolved_stage_ids
from public.milhano_v2_stage_map
group by pipeline_id,pipeline_name,pipeline_role
order by pipeline_role;

select
  pipeline_id,
  pipeline_name,
  current_stage,
  count(*) as opportunities
from public.milhano_opportunities
where pipeline_id in ('GYqHbZyWUxxc3K03efVT','z1FEJfbtOHusjdwe40Ko')
group by pipeline_id,pipeline_name,current_stage
order by pipeline_name,current_stage;

select
  calendar_id,
  calendar_name,
  appointment_type,
  count(*) as appointments,
  min(start_time) as first_start,
  max(start_time) as last_start
from public.milhano_ghl_appointments
where calendar_id='a0bvCaXgCdVwSrgPELza'
   or appointment_type='trial_day'
group by calendar_id,calendar_name,appointment_type
order by appointments desc;

select public.milhano_get_admissions_v2_payload(
  date '2026-09-08',
  (now() at time zone 'America/Merida')::date
) as admissions_v2_payload;

select
  event_source,
  pipeline_id,
  to_stage,
  count(*) as events
from public.milhano_stage_events
where event_timestamp >= timestamptz '2026-09-08 00:00:00-06'
  and pipeline_id in ('GYqHbZyWUxxc3K03efVT','z1FEJfbtOHusjdwe40Ko')
group by event_source,pipeline_id,to_stage
order by pipeline_id,to_stage,event_source;
