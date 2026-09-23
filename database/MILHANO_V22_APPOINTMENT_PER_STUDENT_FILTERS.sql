-- Milhano Admissions V22
-- 1 appointment = 1 student process for Tour/Pasadia metrics.
-- Booked/Attended filters use the scheduled appointment date in America/Merida.
-- Multi-child historical appointment rows are attributed 1:1 to current opportunities
-- without modifying raw GHL appointment records.

begin;

do $$
begin
  if to_regprocedure('public.milhano_get_admissions_v2_payload_v21_base(date,date)') is null
     and to_regprocedure('public.milhano_get_admissions_v2_payload(date,date)') is not null then
    alter function public.milhano_get_admissions_v2_payload(date,date)
      rename to milhano_get_admissions_v2_payload_v21_base;
  end if;
end
$$;

-- Final V22.1 attribution layer: when a contact has 2+ same-day appointment
-- records and 2+ current opportunities, distribute those appointment events 1:1
-- across the contact's opportunities for audit/drilldown purposes. Raw rows stay intact.

create or replace view public.vw_milhano_appointment_events_v22
with (security_invoker = true)
as
with ranked_appointments as (
  select
    a.*,
    case
      when a.appointment_type='school_tour' then 'school_tour'
      when a.appointment_type='trial_day' or a.calendar_id='a0bvCaXgCdVwSrgPELza' then 'trial_day'
      else coalesce(a.appointment_type,'other')
    end as canonical_type,
    (a.start_time at time zone 'America/Merida')::date as scheduled_date,
    count(*) over (
      partition by
        a.ghl_contact_id,
        case
          when a.appointment_type='school_tour' then 'school_tour'
          when a.appointment_type='trial_day' or a.calendar_id='a0bvCaXgCdVwSrgPELza' then 'trial_day'
          else coalesce(a.appointment_type,'other')
        end,
        (a.start_time at time zone 'America/Merida')::date
    ) as sibling_event_count,
    row_number() over (
      partition by
        a.ghl_contact_id,
        case
          when a.appointment_type='school_tour' then 'school_tour'
          when a.appointment_type='trial_day' or a.calendar_id='a0bvCaXgCdVwSrgPELza' then 'trial_day'
          else coalesce(a.appointment_type,'other')
        end,
        (a.start_time at time zone 'America/Merida')::date
      order by a.start_time nulls last,a.appointment_id
    ) as sibling_event_rank
  from public.milhano_ghl_appointments a
),
ranked_opportunities as (
  select
    o.ghl_contact_id,
    o.ghl_opportunity_id,
    row_number() over (
      partition by o.ghl_contact_id
      order by o.created_at nulls last,o.ghl_opportunity_id
    ) as contact_opp_rank,
    count(*) over (partition by o.ghl_contact_id) as contact_opp_count
  from public.vw_milhano_opportunities_current o
  where o.ghl_contact_id is not null
),
fallback_opportunity as (
  select distinct on (o.ghl_contact_id)
    o.ghl_contact_id,
    o.ghl_opportunity_id
  from public.vw_milhano_opportunities_current o
  where o.ghl_contact_id is not null
  order by o.ghl_contact_id,o.updated_at desc nulls last,o.created_at desc nulls last
)
select
  a.appointment_id,
  a.ghl_contact_id,
  a.ghl_opportunity_id as source_opportunity_id,
  case
    when a.sibling_event_count > 1
      and ranked_o.contact_opp_count >= a.sibling_event_count
      then ranked_o.ghl_opportunity_id
    when direct_o.ghl_opportunity_id is not null
      then direct_o.ghl_opportunity_id
    else fallback_o.ghl_opportunity_id
  end as metric_opportunity_id,
  case
    when a.sibling_event_count > 1
      and ranked_o.contact_opp_count >= a.sibling_event_count
      then 'sibling_rank'
    when direct_o.ghl_opportunity_id is not null
      then 'direct'
    when fallback_o.ghl_opportunity_id is not null
      then 'contact_fallback'
    else 'unmatched'
  end as attribution_mode,
  a.sibling_event_count,
  a.sibling_event_rank,
  a.canonical_type,
  a.scheduled_date,
  a.title,
  a.appointment_status,
  a.date_added,
  a.start_time,
  a.end_time,
  a.calendar_id,
  a.calendar_name
from ranked_appointments a
left join public.vw_milhano_opportunities_current direct_o
  on direct_o.ghl_opportunity_id=a.ghl_opportunity_id
left join ranked_opportunities ranked_o
  on ranked_o.ghl_contact_id=a.ghl_contact_id
 and ranked_o.contact_opp_rank=a.sibling_event_rank
left join fallback_opportunity fallback_o
  on fallback_o.ghl_contact_id=a.ghl_contact_id;

revoke all on public.vw_milhano_appointment_events_v22 from public;
revoke all on public.vw_milhano_appointment_events_v22 from anon;
revoke all on public.vw_milhano_appointment_events_v22 from authenticated;
grant select on public.vw_milhano_appointment_events_v22 to service_role;

create or replace function public.milhano_get_v2_closer_metric_events(
  p_metric_key text,
  p_scope text,
  p_start date,
  p_end date
)
returns table(
  metric_row_id text,
  ghl_opportunity_id text,
  ghl_contact_id text,
  lead_name text,
  contact_name text,
  student_name text,
  phone text,
  email text,
  source text,
  operational_owner text,
  current_pipeline_role text,
  pipeline_name text,
  current_stage text,
  opportunity_status text,
  lost_reason text,
  lead_at timestamptz,
  metric_at timestamptz,
  metric_event_id text,
  metric_title text,
  metric_status text
)
language sql
stable
security definer
set search_path to 'public'
as $$
with bounds as (
  select greatest(p_start,date '2026-09-01') as effective_start,
         p_end as effective_end
),
appointment_events as (
  select
    'appointment:' || a.appointment_id as metric_row_id,
    o.ghl_opportunity_id,
    o.ghl_contact_id,
    coalesce(
      nullif(trim(o.student_name),''),
      nullif(trim(o.opportunity_name),''),
      nullif(trim(o.contact_name),''),
      o.ghl_contact_id,
      'Lead sin identificar'
    ) as lead_name,
    o.contact_name,
    o.student_name,
    o.phone,
    o.email,
    o.source,
    coalesce(
      nullif(trim(o.assigned_user),''),
      nullif(trim(o.historical_advisor),''),
      'Sin asignar'
    ) as operational_owner,
    case
      when o.pipeline_id='L9nSVkwjFsHN5WFDs3Aa' then 'legacy'
      when o.pipeline_id='GYqHbZyWUxxc3K03efVT' then 'setter'
      when o.pipeline_id='z1FEJfbtOHusjdwe40Ko' then 'closer'
      else null
    end as current_pipeline_role,
    o.pipeline_name,
    o.current_stage,
    o.status as opportunity_status,
    o.lost_reason,
    o.created_at as lead_at,
    a.start_time as metric_at,
    a.appointment_id as metric_event_id,
    a.title as metric_title,
    a.appointment_status as metric_status
  from public.vw_milhano_appointment_events_v22 a
  cross join bounds b
  join public.vw_milhano_opportunities_current o
    on o.ghl_opportunity_id=a.metric_opportunity_id
  where p_scope in ('general','closer')
    and p_metric_key in (
      'school_tours_booked',
      'school_tours_attended',
      'trial_days_booked',
      'trial_days_showed'
    )
    and a.start_time is not null
    and a.scheduled_date between b.effective_start and b.effective_end
    and (
      (p_metric_key='school_tours_booked' and a.canonical_type='school_tour')
      or
      (
        p_metric_key='school_tours_attended'
        and a.canonical_type='school_tour'
        and lower(coalesce(a.appointment_status,'')) in ('showed','completed','show','attended')
      )
      or
      (p_metric_key='trial_days_booked' and a.canonical_type='trial_day')
      or
      (
        p_metric_key='trial_days_showed'
        and a.canonical_type='trial_day'
        and lower(coalesce(a.appointment_status,'')) in ('showed','completed','show','attended')
      )
    )
),
closed_events as (
  select distinct on (o.ghl_opportunity_id)
    'closed:' || o.ghl_opportunity_id as metric_row_id,
    o.ghl_opportunity_id,
    o.ghl_contact_id,
    coalesce(
      nullif(trim(o.student_name),''),
      nullif(trim(o.opportunity_name),''),
      nullif(trim(o.contact_name),''),
      o.ghl_contact_id,
      'Lead sin identificar'
    ) as lead_name,
    o.contact_name,
    o.student_name,
    o.phone,
    o.email,
    o.source,
    coalesce(
      nullif(trim(o.assigned_user),''),
      nullif(trim(o.historical_advisor),''),
      'Sin asignar'
    ) as operational_owner,
    case
      when o.pipeline_id='L9nSVkwjFsHN5WFDs3Aa' then 'legacy'
      when o.pipeline_id='GYqHbZyWUxxc3K03efVT' then 'setter'
      when o.pipeline_id='z1FEJfbtOHusjdwe40Ko' then 'closer'
      else null
    end as current_pipeline_role,
    o.pipeline_name,
    o.current_stage,
    o.status as opportunity_status,
    o.lost_reason,
    o.created_at as lead_at,
    e.event_timestamp as metric_at,
    null::text as metric_event_id,
    'Closed / Enrolled'::text as metric_title,
    o.status::text as metric_status
  from public.milhano_stage_events e
  cross join bounds b
  join public.vw_milhano_opportunities_current o
    on o.ghl_opportunity_id=e.ghl_opportunity_id
  where p_scope in ('general','closer')
    and p_metric_key='closed'
    and e.is_valid=true
    and lower(trim(coalesce(e.to_stage,''))) in ('closed/enrolled','closed / enrolled','inscrito')
    and (e.event_timestamp at time zone 'America/Merida')::date
        between b.effective_start and b.effective_end
  order by o.ghl_opportunity_id,e.event_timestamp desc
)
select * from appointment_events
union all
select * from closed_events
order by metric_at desc nulls last, lead_name, metric_row_id;
$$;

revoke all on function public.milhano_get_v2_closer_metric_events(text,text,date,date) from public;
revoke all on function public.milhano_get_v2_closer_metric_events(text,text,date,date) from anon;
revoke all on function public.milhano_get_v2_closer_metric_events(text,text,date,date) from authenticated;
grant execute on function public.milhano_get_v2_closer_metric_events(text,text,date,date) to service_role;

create or replace function public.milhano_get_admissions_v2_payload(
  p_start date,
  p_end date
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_payload jsonb;
  v_start date := greatest(p_start,date '2026-09-01');
  v_tour_booked bigint := 0;
  v_tour_attended bigint := 0;
  v_trial_booked bigint := 0;
  v_trial_attended bigint := 0;
  v_tour_booked_cohort bigint := 0;
  v_trial_booked_cohort bigint := 0;
  v_tour_today bigint := 0;
  v_trial_today bigint := 0;
  v_today date := (now() at time zone 'America/Merida')::date;
begin
  v_payload := public.milhano_get_admissions_v2_payload_v21_base(p_start,p_end);

  with appointment_rows as materialized (
    select
      a.appointment_id,
      a.canonical_type,
      a.appointment_status,
      a.start_time,
      a.scheduled_date,
      o.ghl_opportunity_id,
      o.created_at as lead_at
    from public.vw_milhano_appointment_events_v22 a
    join public.vw_milhano_opportunities_current o
      on o.ghl_opportunity_id=a.metric_opportunity_id
  )
  select
    count(*) filter(where canonical_type='school_tour' and scheduled_date between v_start and p_end)::bigint,
    count(*) filter(where canonical_type='school_tour' and scheduled_date between v_start and p_end and lower(coalesce(appointment_status,'')) in ('showed','completed','show','attended'))::bigint,
    count(*) filter(where canonical_type='trial_day' and scheduled_date between v_start and p_end)::bigint,
    count(*) filter(where canonical_type='trial_day' and scheduled_date between v_start and p_end and lower(coalesce(appointment_status,'')) in ('showed','completed','show','attended'))::bigint,
    count(*) filter(where canonical_type='school_tour' and scheduled_date between v_start and p_end and public.milhano_operational_date(lead_at) between v_start and p_end)::bigint,
    count(*) filter(where canonical_type='trial_day' and scheduled_date between v_start and p_end and public.milhano_operational_date(lead_at) between v_start and p_end)::bigint,
    count(*) filter(where canonical_type='school_tour' and scheduled_date=v_today)::bigint,
    count(*) filter(where canonical_type='trial_day' and scheduled_date=v_today)::bigint
  into
    v_tour_booked,
    v_tour_attended,
    v_trial_booked,
    v_trial_attended,
    v_tour_booked_cohort,
    v_trial_booked_cohort,
    v_tour_today,
    v_trial_today
  from appointment_rows;

  v_payload := jsonb_set(v_payload,'{general,5,value}',to_jsonb(v_tour_booked),true);
  v_payload := jsonb_set(v_payload,'{general,6,value}',to_jsonb(v_tour_attended),true);
  v_payload := jsonb_set(v_payload,'{general,7,value}',to_jsonb(v_trial_booked),true);
  v_payload := jsonb_set(v_payload,'{general,8,value}',to_jsonb(v_trial_attended),true);
  v_payload := jsonb_set(v_payload,'{closer,funnel,0,value}',to_jsonb(v_tour_booked),true);
  v_payload := jsonb_set(v_payload,'{closer,funnel,1,value}',to_jsonb(v_tour_attended),true);
  v_payload := jsonb_set(v_payload,'{closer,funnel,2,value}',to_jsonb(v_trial_booked),true);
  v_payload := jsonb_set(v_payload,'{closer,funnel,3,value}',to_jsonb(v_trial_attended),true);

  v_payload := jsonb_set(
    v_payload,
    '{booking_breakdown}',
    jsonb_build_object(
      'school_tours',jsonb_build_object(
        'total',v_tour_booked,
        'cohort',v_tour_booked_cohort,
        'external',greatest(v_tour_booked-v_tour_booked_cohort,0)
      ),
      'trial_days',jsonb_build_object(
        'total',v_trial_booked,
        'cohort',v_trial_booked_cohort,
        'external',greatest(v_trial_booked-v_trial_booked_cohort,0)
      )
    ),
    true
  );

  v_payload := jsonb_set(v_payload,'{today,school_tours_today}',to_jsonb(v_tour_today),true);
  v_payload := jsonb_set(v_payload,'{today,trial_days_today}',to_jsonb(v_trial_today),true);
  v_payload := jsonb_set(
    v_payload,
    '{meta}',
    coalesce(v_payload->'meta','{}'::jsonb) || jsonb_build_object(
      'version','Admissions V22 · Appointment-per-student + exact range filtering',
      'appointment_filter_basis','scheduled start_time in America/Merida',
      'appointment_count_unit','appointment_id',
      'multi_child_attribution','contact/date/type sibling rank without mutating raw appointments'
    ),
    true
  );

  return v_payload;
end;
$$;

revoke all on function public.milhano_get_admissions_v2_payload(date,date) from public;
revoke all on function public.milhano_get_admissions_v2_payload(date,date) from anon;
revoke all on function public.milhano_get_admissions_v2_payload(date,date) from authenticated;
grant execute on function public.milhano_get_admissions_v2_payload(date,date) to service_role;

commit;
