-- MILHANO V21 · Operational opportunity day (14:30 Mérida) + latest GHL snapshot truth
--
-- Opportunity/cohort reporting rule:
--   Mon-Thu >= 14:30 -> next reporting day
--   Fri >= 14:30 + Sat + Sun -> Monday
--   Weekday < 14:30 -> same reporting day
--
-- Appointment / School Tour / Pasadía / Closed event dates remain calendar dates.
-- Historical opportunities are retained in milhano_opportunities, but operational
-- views ignore rows not seen by the latest successful full reconciliation.

begin;

create or replace function public.milhano_operational_date(p_timestamp timestamptz)
returns date
language sql
immutable
strict
parallel safe
set search_path=public
as $$
with local_value as (
  select p_timestamp at time zone 'America/Merida' as local_ts
), parts as (
  select
    local_ts::date as local_date,
    local_ts::time as local_time,
    extract(isodow from local_ts)::integer as iso_dow
  from local_value
)
select case
  when iso_dow = 6 then local_date + 2                    -- Saturday -> Monday
  when iso_dow = 7 then local_date + 1                    -- Sunday -> Monday
  when local_time >= time '14:30' and iso_dow = 5 then local_date + 3 -- Friday -> Monday
  when local_time >= time '14:30' then local_date + 1      -- Mon-Thu -> next day
  else local_date
end
from parts;
$$;

revoke all on function public.milhano_operational_date(timestamptz) from public,anon,authenticated;
grant execute on function public.milhano_operational_date(timestamptz) to service_role;

create or replace view public.vw_milhano_opportunities_current
with (security_invoker=true)
as
with latest_full as (
  select coalesce(
    (
      select r.started_at
      from public.milhano_sync_runs r
      where r.sync_type='full_reconciliation'
        and r.status='success'
        and r.records_failed=0
      order by r.started_at desc
      limit 1
    ),
    '-infinity'::timestamptz
  ) as snapshot_started_at
)
select
  o.*,
  f.snapshot_started_at,
  public.milhano_operational_date(o.created_at) as operational_date
from public.milhano_opportunities o
cross join latest_full f
where f.snapshot_started_at='-infinity'::timestamptz
   or coalesce(o.last_synced_at,o.synced_at) >= f.snapshot_started_at;

revoke all on public.vw_milhano_opportunities_current from public,anon,authenticated;
grant select on public.vw_milhano_opportunities_current to service_role;

-- Pipeline Detail now represents the latest full GHL snapshot (+ newer live updates),
-- while the raw table keeps historical/stale rows for auditability.
create or replace view public.vw_milhano_pipeline_current
with (security_invoker=true)
as
select
  o.ghl_opportunity_id,
  o.ghl_contact_id,
  o.legacy_lead_id,
  o.pipeline_name,
  o.pipeline_stage_id,
  o.current_stage,
  o.status,
  o.opportunity_name,
  o.contact_name,
  o.phone,
  o.email,
  o.source,
  o.assigned_user,
  o.created_at,
  o.updated_at,
  o.original_lead_date,
  o.student_name,
  o.school_cycle,
  o.level,
  o.grade_interest,
  o.priority,
  o.historical_advisor,
  o.admission_route,
  o.direct_admission_reason,
  o.no_fit_reason,
  o.lost_reason,
  o.historical_call_count,
  o.historical_comments,
  o.history_scope,
  o.record_source,
  o.synced_at,
  sc.display_order as stage_display_order,
  sc.stage_group,
  o.status='open' as is_active,
  o.status='won' or o.current_stage='Inscrito' as is_won,
  o.status='lost' or o.current_stage in ('No fit','Lost / Sin continuidad') as is_exit,
  o.history_scope='reconstructed_from_excel' as has_reconstructed_history,
  case
    when o.updated_at is null then null::integer
    else current_date-(o.updated_at at time zone 'America/Merida')::date
  end as days_since_update,
  case
    when o.updated_at is null then 'Sin fecha'::text
    when current_date-(o.updated_at at time zone 'America/Merida')::date <= 2 then '0–2 días'::text
    when current_date-(o.updated_at at time zone 'America/Merida')::date <= 7 then '3–7 días'::text
    when current_date-(o.updated_at at time zone 'America/Merida')::date <= 14 then '8–14 días'::text
    else '15+ días'::text
  end as inactivity_bucket,
  coalesce(nullif(o.assigned_user,''),nullif(o.historical_advisor,''),'Sin asignar') as operational_owner
from public.vw_milhano_opportunities_current o
left join public.vw_milhano_stage_catalog sc on sc.stage_name=o.current_stage;

revoke all on public.vw_milhano_pipeline_current from public,anon,authenticated;
grant select on public.vw_milhano_pipeline_current to service_role;

-- Preserve the existing V20.2 cascade mechanics, but widen the source window
-- enough to capture Fri->Mon and then filter by the canonical operational date.
create or replace function public.milhano_get_stage_cascade_cohort(p_start date,p_end date)
returns table(
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
  reached_contacted boolean,
  reached_responded boolean,
  reached_meaningful boolean,
  reached_qualified boolean
)
language sql
stable
security definer
set search_path=public
as $$
select
  b.ghl_opportunity_id,
  b.ghl_contact_id,
  b.lead_name,
  b.contact_name,
  b.student_name,
  b.phone,
  b.email,
  b.source,
  b.operational_owner,
  b.current_pipeline_role,
  b.pipeline_name,
  b.current_stage,
  b.opportunity_status,
  b.lost_reason,
  b.lead_at,
  b.reached_contacted,
  b.reached_responded,
  (b.reached_responded and b.reached_meaningful) as reached_meaningful,
  (b.reached_responded and b.reached_meaningful and b.reached_qualified) as reached_qualified
from public.milhano_get_stage_cascade_cohort_v20_2_base(p_start-3,p_end) b
join public.vw_milhano_opportunities_current current_o
  on current_o.ghl_opportunity_id=b.ghl_opportunity_id
where public.milhano_operational_date(b.lead_at)
      between greatest(p_start,date '2026-09-01') and p_end;
$$;

revoke all on function public.milhano_get_stage_cascade_cohort(date,date) from public,anon,authenticated;
grant execute on function public.milhano_get_stage_cascade_cohort(date,date) to service_role;

-- Keep the previous scoped-lead implementation intact as an internal base and
-- add a current-snapshot guard around all metric drilldowns.
do $$
begin
  if to_regprocedure('public.milhano_get_v2_metric_leads_scoped_v20_2_base(text,text,date,date)') is null then
    alter function public.milhano_get_v2_metric_leads_scoped(text,text,date,date)
      rename to milhano_get_v2_metric_leads_scoped_v20_2_base;
  end if;
end;
$$;

create or replace function public.milhano_get_v2_metric_leads_scoped(
  p_metric_key text,
  p_scope text,
  p_start date,
  p_end date
)
returns table(
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
  lead_at timestamptz
)
language sql
stable
security definer
set search_path=public
as $$
select
  b.ghl_opportunity_id,
  b.ghl_contact_id,
  b.lead_name,
  b.contact_name,
  b.student_name,
  b.phone,
  b.email,
  b.source,
  b.operational_owner,
  b.current_pipeline_role,
  b.pipeline_name,
  b.current_stage,
  b.opportunity_status,
  b.lost_reason,
  b.lead_at
from public.milhano_get_v2_metric_leads_scoped_v20_2_base(
  p_metric_key,p_scope,p_start,p_end
) b
join public.vw_milhano_opportunities_current current_o
  on current_o.ghl_opportunity_id=b.ghl_opportunity_id
order by b.lead_at desc,b.lead_name;
$$;

revoke all on function public.milhano_get_v2_metric_leads_scoped_v20_2_base(text,text,date,date) from public,anon,authenticated;
revoke all on function public.milhano_get_v2_metric_leads_scoped(text,text,date,date) from public,anon,authenticated;
grant execute on function public.milhano_get_v2_metric_leads_scoped_v20_2_base(text,text,date,date) to service_role;
grant execute on function public.milhano_get_v2_metric_leads_scoped(text,text,date,date) to service_role;

-- Final V21 payload. Cohort metrics use the operational opportunity day;
-- appointment and outcome-event metrics keep their real calendar date.
create or replace function public.milhano_get_admissions_v2_payload(p_start date,p_end date)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_payload jsonb;
  v_override jsonb;
  v_start date := greatest(p_start,date '2026-09-01');
  v_latest_full timestamptz;
  v_stale_count bigint := 0;
begin
  -- Reuse the established V20.1 payload for manual EOD, today's agenda,
  -- health/quality and stage-map metadata; overwrite GHL metrics below.
  v_payload := public.milhano_get_admissions_v2_payload_v20_1_base(p_start,p_end);

  select r.started_at
  into v_latest_full
  from public.milhano_sync_runs r
  where r.sync_type='full_reconciliation'
    and r.status='success'
    and r.records_failed=0
  order by r.started_at desc
  limit 1;

  select count(*)::bigint
  into v_stale_count
  from public.milhano_opportunities o
  where o.pipeline_id in (
    'L9nSVkwjFsHN5WFDs3Aa',
    'GYqHbZyWUxxc3K03efVT',
    'z1FEJfbtOHusjdwe40Ko'
  )
    and v_latest_full is not null
    and coalesce(o.last_synced_at,o.synced_at) < v_latest_full;

  with cohort as materialized (
    select *
    from public.milhano_get_stage_cascade_cohort(p_start,p_end)
  ),
  cohort_counts as (
    select
      count(*)::bigint as new_leads,
      count(*) filter(where reached_contacted)::bigint as contacted,
      count(*) filter(where reached_responded)::bigint as responded,
      count(*) filter(where reached_meaningful)::bigint as meaningful,
      count(*) filter(where reached_qualified)::bigint as qualified,
      count(*) filter(
        where reached_contacted
          and lower(trim(coalesce(current_stage,''))) in (
            'no answer - day 1',
            'no answer - day 2',
            'no answer - day 3',
            'never answered / nurturing a',
            'no responde / seguimiento'
          )
      )::bigint as no_answer,
      count(*) filter(where current_pipeline_role='legacy')::bigint as legacy_opportunities,
      count(*) filter(where current_pipeline_role='setter')::bigint as setter_opportunities,
      count(*) filter(where current_pipeline_role='closer')::bigint as closer_opportunities,
      count(*) filter(where lower(coalesce(opportunity_status,''))='open')::bigint as open_opportunities
    from cohort
  ),
  inventory_extra as (
    select count(*)::bigint as unmapped_stage_opportunities
    from cohort c
    join public.vw_milhano_opportunities_current o
      on o.ghl_opportunity_id=c.ghl_opportunity_id
    where not exists(
      select 1
      from public.milhano_v2_stage_map m
      where m.pipeline_id=o.pipeline_id
        and (
          (m.stage_id is not null and m.stage_id=o.pipeline_stage_id)
          or m.stage_name=o.current_stage
        )
    )
  ),
  setter_current as (
    select
      m.stage_name,
      m.canonical_key,
      m.display_order,
      m.stage_group,
      count(c.ghl_opportunity_id)::bigint as opportunity_count,
      count(c.ghl_opportunity_id) filter(where lower(coalesce(c.opportunity_status,''))='open')::bigint as open_count
    from public.milhano_v2_stage_map m
    left join cohort c
      on c.current_pipeline_role='setter'
     and c.current_stage=m.stage_name
    where m.pipeline_role='setter'
    group by m.stage_name,m.canonical_key,m.display_order,m.stage_group
  ),
  closer_current as (
    select
      m.stage_name,
      m.canonical_key,
      m.display_order,
      m.stage_group,
      count(c.ghl_opportunity_id)::bigint as opportunity_count,
      count(c.ghl_opportunity_id) filter(where lower(coalesce(c.opportunity_status,''))='open')::bigint as open_count
    from public.milhano_v2_stage_map m
    left join cohort c
      on c.current_pipeline_role='closer'
     and c.current_stage=m.stage_name
    where m.pipeline_role='closer'
    group by m.stage_name,m.canonical_key,m.display_order,m.stage_group
  ),
  appointment_rows as materialized (
    select
      a.appointment_id,
      a.appointment_type,
      a.calendar_id,
      a.appointment_status,
      a.date_added,
      a.start_time,
      o.ghl_opportunity_id,
      o.created_at as lead_at
    from public.milhano_ghl_appointments a
    join lateral (
      select o1.*
      from public.vw_milhano_opportunities_current o1
      where o1.ghl_opportunity_id=a.ghl_opportunity_id
         or (
           a.ghl_opportunity_id is null
           and a.ghl_contact_id is not null
           and o1.ghl_contact_id=a.ghl_contact_id
         )
      order by
        case when o1.ghl_opportunity_id=a.ghl_opportunity_id then 0 else 1 end,
        o1.updated_at desc nulls last,
        o1.created_at desc nulls last
      limit 1
    ) o on true
  ),
  appointment_counts as (
    select
      count(distinct ghl_opportunity_id) filter(
        where appointment_type='school_tour'
          and date_added is not null
          and (date_added at time zone 'America/Merida')::date between v_start and p_end
      )::bigint as tour_booked,
      count(distinct ghl_opportunity_id) filter(
        where appointment_type='school_tour'
          and date_added is not null
          and (date_added at time zone 'America/Merida')::date between v_start and p_end
          and public.milhano_operational_date(lead_at) between v_start and p_end
      )::bigint as tour_booked_cohort,
      count(distinct ghl_opportunity_id) filter(
        where appointment_type='school_tour'
          and start_time is not null
          and (start_time at time zone 'America/Merida')::date between v_start and p_end
          and lower(coalesce(appointment_status,'')) in ('showed','completed','show','attended')
      )::bigint as tour_attended,
      count(distinct ghl_opportunity_id) filter(
        where (appointment_type='trial_day' or calendar_id='a0bvCaXgCdVwSrgPELza')
          and date_added is not null
          and (date_added at time zone 'America/Merida')::date between v_start and p_end
      )::bigint as trial_booked,
      count(distinct ghl_opportunity_id) filter(
        where (appointment_type='trial_day' or calendar_id='a0bvCaXgCdVwSrgPELza')
          and date_added is not null
          and (date_added at time zone 'America/Merida')::date between v_start and p_end
          and public.milhano_operational_date(lead_at) between v_start and p_end
      )::bigint as trial_booked_cohort,
      count(distinct ghl_opportunity_id) filter(
        where (appointment_type='trial_day' or calendar_id='a0bvCaXgCdVwSrgPELza')
          and start_time is not null
          and (start_time at time zone 'America/Merida')::date between v_start and p_end
          and lower(coalesce(appointment_status,'')) in ('showed','completed','show','attended')
      )::bigint as trial_attended
    from appointment_rows
  ),
  stage_event_counts as (
    select
      count(distinct e.ghl_opportunity_id) filter(
        where lower(trim(coalesce(e.to_stage,''))) in ('closed/enrolled','closed / enrolled','inscrito')
      )::bigint as closed,
      count(distinct e.ghl_opportunity_id) filter(
        where lower(trim(coalesce(e.to_stage,'')))='disqualified'
      )::bigint as disqualified
    from public.milhano_stage_events e
    join public.vw_milhano_opportunities_current o
      on o.ghl_opportunity_id=e.ghl_opportunity_id
    where e.is_valid=true
      and (e.event_timestamp at time zone 'America/Merida')::date between v_start and p_end
  ),
  responded_cohort as materialized (
    select * from cohort where reached_responded
  ),
  first_response as (
    select
      c.ghl_opportunity_id,
      min(e.event_timestamp) filter(
        where lower(trim(coalesce(e.to_stage,''))) not in (
          '',
          'new lead',
          'cliente potencial',
          'no answer - day 1',
          'no answer - day 2',
          'no answer - day 3',
          'never answered / nurturing a',
          'no responde / seguimiento'
        )
      ) as first_response_at
    from responded_cohort c
    left join public.milhano_stage_events e
      on e.ghl_opportunity_id=c.ghl_opportunity_id
     and e.is_valid=true
     and e.event_timestamp >= c.lead_at - interval '5 minutes'
    group by c.ghl_opportunity_id
  ),
  response_counts as (
    select
      count(*)::bigint as total,
      count(*) filter(
        where first_response_at is not null
          and public.milhano_operational_date(first_response_at) between v_start and p_end
      )::bigint as in_period
    from first_response
  )
  select jsonb_build_object(
    'inventory',jsonb_build_object(
      'total_opportunities',cc.new_leads,
      'legacy_opportunities',cc.legacy_opportunities,
      'setter_opportunities',cc.setter_opportunities,
      'closer_opportunities',cc.closer_opportunities,
      'open_opportunities',cc.open_opportunities,
      'unmapped_stage_opportunities',ie.unmapped_stage_opportunities
    ),
    'general',jsonb_build_array(
      jsonb_build_object('metric_key','new_leads','label','New Leads','value',cc.new_leads),
      jsonb_build_object('metric_key','unique_contacted_leads','label','Contacted','value',cc.contacted),
      jsonb_build_object('metric_key','responded_leads','label','Responded','value',cc.responded),
      jsonb_build_object('metric_key','meaningful_conversations','label','Meaningful','value',cc.meaningful),
      jsonb_build_object('metric_key','qualified_leads','label','Qualified','value',cc.qualified),
      jsonb_build_object('metric_key','school_tours_booked','label','Tour Booked','value',ac.tour_booked),
      jsonb_build_object('metric_key','school_tours_attended','label','Tour Attended','value',ac.tour_attended),
      jsonb_build_object('metric_key','trial_days_booked','label','Pasadía Booked','value',ac.trial_booked),
      jsonb_build_object('metric_key','trial_days_showed','label','Pasadía Attended','value',ac.trial_attended),
      jsonb_build_object('metric_key','closed','label','Closed','value',se.closed)
    ),
    'setter',jsonb_build_object(
      'owner','Paty',
      'pipeline_id','GYqHbZyWUxxc3K03efVT',
      'funnel',jsonb_build_array(
        jsonb_build_object('metric_key','new_leads','label','New Leads','value',cc.new_leads),
        jsonb_build_object('metric_key','unique_contacted_leads','label','Contacted','value',cc.contacted),
        jsonb_build_object('metric_key','responded_leads','label','Responded','value',cc.responded),
        jsonb_build_object('metric_key','meaningful_conversations','label','Meaningful','value',cc.meaningful),
        jsonb_build_object('metric_key','qualified_leads','label','Qualified','value',cc.qualified)
      ),
      'current_stages',coalesce((select jsonb_agg(to_jsonb(s) order by s.display_order) from setter_current s),'[]'::jsonb)
    ),
    'closer',jsonb_build_object(
      'owner','Cinthia Esquivel',
      'pipeline_id','z1FEJfbtOHusjdwe40Ko',
      'funnel',jsonb_build_array(
        jsonb_build_object('metric_key','school_tours_booked','label','Tour Booked','value',ac.tour_booked),
        jsonb_build_object('metric_key','school_tours_attended','label','Tour Attended','value',ac.tour_attended),
        jsonb_build_object('metric_key','trial_days_booked','label','Pasadía Booked','value',ac.trial_booked),
        jsonb_build_object('metric_key','trial_days_showed','label','Pasadía Attended','value',ac.trial_attended),
        jsonb_build_object('metric_key','closed','label','Closed','value',se.closed)
      ),
      'current_stages',coalesce((select jsonb_agg(to_jsonb(s) order by s.display_order) from closer_current s),'[]'::jsonb)
    ),
    'informational',jsonb_build_object(
      'disqualified',se.disqualified,
      'no_answer',cc.no_answer
    ),
    'booking_breakdown',jsonb_build_object(
      'school_tours',jsonb_build_object(
        'total',ac.tour_booked,
        'cohort',ac.tour_booked_cohort,
        'external',greatest(ac.tour_booked-ac.tour_booked_cohort,0)
      ),
      'trial_days',jsonb_build_object(
        'total',ac.trial_booked,
        'cohort',ac.trial_booked_cohort,
        'external',greatest(ac.trial_booked-ac.trial_booked_cohort,0)
      )
    ),
    'response_breakdown',jsonb_build_object(
      'total',rc.total,
      'in_period',rc.in_period,
      'after_period',greatest(rc.total-rc.in_period,0)
    )
  )
  into v_override
  from cohort_counts cc
  cross join inventory_extra ie
  cross join appointment_counts ac
  cross join stage_event_counts se
  cross join response_counts rc;

  v_payload := v_payload || v_override;

  v_payload := jsonb_set(
    v_payload,
    '{meta}',
    coalesce(v_payload->'meta','{}'::jsonb) || jsonb_build_object(
      'version','Admissions V21 · 14:30 Operational Day + Current GHL Snapshot',
      'operational_timezone','America/Merida',
      'opportunity_cutoff','14:30',
      'latest_full_reconciliation_started_at',v_latest_full,
      'stale_opportunities_excluded',v_stale_count
    ),
    true
  );

  return v_payload;
end;
$$;

revoke all on function public.milhano_get_admissions_v2_payload(date,date) from public,anon,authenticated;
grant execute on function public.milhano_get_admissions_v2_payload(date,date) to service_role;

-- Safe performance cleanup: these two indexes were byte-for-byte duplicates.
-- Keep the truth-named index and remove the older V2 duplicate to reduce write overhead.
drop index if exists public.idx_milhano_opportunities_pipeline_created_v2;

commit;
