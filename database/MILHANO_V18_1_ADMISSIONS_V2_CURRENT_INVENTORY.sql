-- MILHANO Admissions V18.1
-- Current pipeline inventory + Manual/Auto dashboard support.
-- Replaces V2 read functions only; no tables or historical rows are deleted.

create or replace function public.milhano_get_v2_cohort_flags(p_start date, p_end date)
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
  current_stage text,
  lead_at timestamptz,
  reached_contacted boolean,
  reached_responded boolean,
  reached_meaningful boolean,
  reached_qualified boolean,
  reached_tour_booked boolean,
  reached_tour_attended boolean,
  reached_trial_booked boolean,
  reached_trial_attended boolean,
  reached_closed boolean
)
language sql
stable
security definer
set search_path = public
as $$
with bounds as (
  select
    greatest(p_start, date '2026-09-08')::timestamp at time zone 'America/Merida' as start_at,
    (p_end + 1)::timestamp at time zone 'America/Merida' as end_at,
    least((p_end + 1)::timestamp at time zone 'America/Merida', now() + interval '5 minutes') as evidence_end
),
cohort as (
  select
    o.*,
    coalesce(o.original_lead_date, o.created_at) as lead_at,
    case
      when o.pipeline_id = 'GYqHbZyWUxxc3K03efVT' then 'setter'
      when o.pipeline_id = 'z1FEJfbtOHusjdwe40Ko' then 'closer'
      else null
    end as current_pipeline_role,
    coalesce(nullif(trim(o.assigned_user),''), nullif(trim(o.historical_advisor),''), 'Sin asignar') as operational_owner
  from public.milhano_opportunities o
  where o.pipeline_id in ('GYqHbZyWUxxc3K03efVT','z1FEJfbtOHusjdwe40Ko')
),
raw as (
  select
    c.*,
    exists (
      select 1 from public.vw_milhano_operational_cascade_activity a
      cross join bounds b
      where a.metric_key = 'unique_contacted_leads'
        and a.ghl_opportunity_id = c.ghl_opportunity_id
        and a.activity_at >= c.lead_at
        and a.activity_at < b.evidence_end
    ) as raw_contacted,
    exists (
      select 1 from public.vw_milhano_operational_cascade_activity a
      cross join bounds b
      where a.metric_key = 'responded_leads'
        and a.ghl_opportunity_id = c.ghl_opportunity_id
        and a.activity_at >= c.lead_at
        and a.activity_at < b.evidence_end
    ) as raw_responded,
    (
      exists (
        select 1 from public.vw_milhano_operational_cascade_activity a
        cross join bounds b
        where a.metric_key = 'meaningful_conversations'
          and a.ghl_opportunity_id = c.ghl_opportunity_id
          and a.activity_at >= c.lead_at
          and a.activity_at < b.evidence_end
      )
      or exists (
        select 1 from public.milhano_stage_events e
        cross join bounds b
        where e.ghl_opportunity_id = c.ghl_opportunity_id
          and e.is_valid = true
          and e.pipeline_id = 'GYqHbZyWUxxc3K03efVT'
          and e.to_stage = 'Meaningful Conversation'
          and e.event_timestamp < b.evidence_end
      )
      or (c.pipeline_id = 'GYqHbZyWUxxc3K03efVT' and c.current_stage = 'Meaningful Conversation')
    ) as raw_meaningful,
    (
      exists (
        select 1 from public.milhano_stage_events e
        cross join bounds b
        where e.ghl_opportunity_id = c.ghl_opportunity_id
          and e.is_valid = true
          and e.pipeline_id = 'GYqHbZyWUxxc3K03efVT'
          and e.to_stage = 'Qualified'
          and e.event_timestamp < b.evidence_end
      )
      or (c.pipeline_id = 'GYqHbZyWUxxc3K03efVT' and c.current_stage = 'Qualified')
      or c.pipeline_id = 'z1FEJfbtOHusjdwe40Ko'
    ) as raw_qualified,
    (
      exists (
        select 1 from public.milhano_ghl_appointments a
        cross join bounds b
        where (a.ghl_opportunity_id = c.ghl_opportunity_id
          or (a.ghl_opportunity_id is null and a.ghl_contact_id = c.ghl_contact_id))
          and a.appointment_type = 'school_tour'
          and coalesce(a.date_added, a.start_time) < b.evidence_end
      )
      or exists (
        select 1 from public.milhano_stage_events e
        cross join bounds b
        where e.ghl_opportunity_id = c.ghl_opportunity_id
          and e.is_valid = true
          and e.pipeline_id = 'z1FEJfbtOHusjdwe40Ko'
          and e.to_stage in ('Tour Booked','Tour Cancelled / No show - Nurturing B','Tour Attended','Pasadia Booked','Pasadia Cancelled / No Show - Nurturing B','Pasadia Attended','Closed/Enrolled')
          and e.event_timestamp < b.evidence_end
      )
      or (c.pipeline_id = 'z1FEJfbtOHusjdwe40Ko')
    ) as raw_tour_booked,
    (
      exists (
        select 1 from public.milhano_ghl_appointments a
        cross join bounds b
        where (a.ghl_opportunity_id = c.ghl_opportunity_id
          or (a.ghl_opportunity_id is null and a.ghl_contact_id = c.ghl_contact_id))
          and a.appointment_type = 'school_tour'
          and a.start_time < b.evidence_end
          and lower(coalesce(a.appointment_status,'')) in ('showed','completed','show','attended')
      )
      or exists (
        select 1 from public.milhano_stage_events e
        cross join bounds b
        where e.ghl_opportunity_id = c.ghl_opportunity_id
          and e.is_valid = true
          and e.pipeline_id = 'z1FEJfbtOHusjdwe40Ko'
          and e.to_stage in ('Tour Attended','Pasadia Booked','Pasadia Cancelled / No Show - Nurturing B','Pasadia Attended','Closed/Enrolled')
          and e.event_timestamp < b.evidence_end
      )
      or (c.pipeline_id = 'z1FEJfbtOHusjdwe40Ko' and c.current_stage in ('Tour Attended','Pasadia Booked','Pasadia Cancelled / No Show - Nurturing B','Pasadia Attended','Closed/Enrolled'))
    ) as raw_tour_attended,
    (
      exists (
        select 1 from public.milhano_ghl_appointments a
        cross join bounds b
        where (a.ghl_opportunity_id = c.ghl_opportunity_id
          or (a.ghl_opportunity_id is null and a.ghl_contact_id = c.ghl_contact_id))
          and (a.appointment_type = 'trial_day' or a.calendar_id = 'a0bvCaXgCdVwSrgPELza')
          and coalesce(a.date_added, a.start_time) < b.evidence_end
      )
      or exists (
        select 1 from public.milhano_stage_events e
        cross join bounds b
        where e.ghl_opportunity_id = c.ghl_opportunity_id
          and e.is_valid = true
          and e.pipeline_id = 'z1FEJfbtOHusjdwe40Ko'
          and e.to_stage in ('Pasadia Booked','Pasadia Cancelled / No Show - Nurturing B','Pasadia Attended','Closed/Enrolled')
          and e.event_timestamp < b.evidence_end
      )
      or (c.pipeline_id = 'z1FEJfbtOHusjdwe40Ko' and c.current_stage in ('Pasadia Booked','Pasadia Cancelled / No Show - Nurturing B','Pasadia Attended','Closed/Enrolled'))
    ) as raw_trial_booked,
    (
      exists (
        select 1 from public.milhano_ghl_appointments a
        cross join bounds b
        where (a.ghl_opportunity_id = c.ghl_opportunity_id
          or (a.ghl_opportunity_id is null and a.ghl_contact_id = c.ghl_contact_id))
          and (a.appointment_type = 'trial_day' or a.calendar_id = 'a0bvCaXgCdVwSrgPELza')
          and a.start_time < b.evidence_end
          and lower(coalesce(a.appointment_status,'')) in ('showed','completed','show','attended')
      )
      or exists (
        select 1 from public.milhano_stage_events e
        cross join bounds b
        where e.ghl_opportunity_id = c.ghl_opportunity_id
          and e.is_valid = true
          and e.pipeline_id = 'z1FEJfbtOHusjdwe40Ko'
          and e.to_stage in ('Pasadia Attended','Closed/Enrolled')
          and e.event_timestamp < b.evidence_end
      )
      or (c.pipeline_id = 'z1FEJfbtOHusjdwe40Ko' and c.current_stage in ('Pasadia Attended','Closed/Enrolled'))
    ) as raw_trial_attended,
    (
      exists (
        select 1 from public.milhano_stage_events e
        cross join bounds b
        where e.ghl_opportunity_id = c.ghl_opportunity_id
          and e.is_valid = true
          and e.pipeline_id = 'z1FEJfbtOHusjdwe40Ko'
          and e.to_stage = 'Closed/Enrolled'
          and e.event_timestamp < b.evidence_end
      )
      or (c.pipeline_id = 'z1FEJfbtOHusjdwe40Ko' and c.current_stage = 'Closed/Enrolled')
      or lower(coalesce(c.status,'')) = 'won'
    ) as raw_closed
  from cohort c
)
select
  r.ghl_opportunity_id,
  r.ghl_contact_id,
  coalesce(nullif(trim(r.student_name),''), nullif(trim(r.contact_name),''), nullif(trim(r.opportunity_name),''), r.ghl_contact_id, 'Lead sin identificar') as lead_name,
  r.contact_name,
  r.student_name,
  r.phone,
  r.email,
  r.source,
  r.operational_owner,
  r.current_pipeline_role,
  r.current_stage,
  r.lead_at,
  (r.raw_contacted or r.raw_responded or r.raw_meaningful or r.raw_qualified or r.raw_tour_booked or r.raw_tour_attended or r.raw_trial_booked or r.raw_trial_attended or r.raw_closed) as reached_contacted,
  (r.raw_responded or r.raw_meaningful or r.raw_qualified or r.raw_tour_booked or r.raw_tour_attended or r.raw_trial_booked or r.raw_trial_attended or r.raw_closed) as reached_responded,
  (r.raw_meaningful or r.raw_qualified or r.raw_tour_booked or r.raw_tour_attended or r.raw_trial_booked or r.raw_trial_attended or r.raw_closed) as reached_meaningful,
  (r.raw_qualified or r.raw_tour_booked or r.raw_tour_attended or r.raw_trial_booked or r.raw_trial_attended or r.raw_closed) as reached_qualified,
  (r.raw_tour_booked or r.raw_tour_attended or r.raw_trial_booked or r.raw_trial_attended or r.raw_closed) as reached_tour_booked,
  (r.raw_tour_attended or r.raw_trial_booked or r.raw_trial_attended or r.raw_closed) as reached_tour_attended,
  (r.raw_trial_booked or r.raw_trial_attended or r.raw_closed) as reached_trial_booked,
  (r.raw_trial_attended or r.raw_closed) as reached_trial_attended,
  r.raw_closed as reached_closed
from raw r;
$$;


create or replace function public.milhano_get_admissions_v2_payload(p_start date, p_end date)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with bounds as (
  select
    greatest(p_start, date '2026-09-08') as effective_start,
    p_end as effective_end,
    (now() at time zone 'America/Merida')::date as local_today
),
flags as (
  select * from public.milhano_get_v2_cohort_flags(p_start,p_end)
),
counts as (
  select
    count(*)::bigint as new_leads,
    count(*) filter (where reached_contacted)::bigint as contacted,
    count(*) filter (where reached_responded)::bigint as responded,
    count(*) filter (where reached_meaningful)::bigint as meaningful,
    count(*) filter (where reached_qualified)::bigint as qualified,
    count(*) filter (where reached_tour_booked)::bigint as tour_booked,
    count(*) filter (where reached_tour_attended)::bigint as tour_attended,
    count(*) filter (where reached_trial_booked)::bigint as trial_booked,
    count(*) filter (where reached_trial_attended)::bigint as trial_attended,
    count(*) filter (where reached_closed)::bigint as closed
  from flags
),
setter_counts as (
  select
    count(*)::bigint as new_leads,
    count(*) filter (where reached_contacted)::bigint as contacted,
    count(*) filter (where reached_responded)::bigint as responded,
    count(*) filter (where reached_meaningful)::bigint as meaningful,
    count(*) filter (where reached_qualified)::bigint as qualified
  from flags
  where current_pipeline_role='setter'
),
closer_counts as (
  select
    count(*) filter (where reached_tour_booked)::bigint as tour_booked,
    count(*) filter (where reached_tour_attended)::bigint as tour_attended,
    count(*) filter (where reached_trial_booked)::bigint as trial_booked,
    count(*) filter (where reached_trial_attended)::bigint as trial_attended,
    count(*) filter (where reached_closed)::bigint as closed
  from flags
  where current_pipeline_role='closer'
),
inventory as (
  select
    count(*)::bigint as total_opportunities,
    count(*) filter (where o.pipeline_id='GYqHbZyWUxxc3K03efVT')::bigint as setter_opportunities,
    count(*) filter (where o.pipeline_id='z1FEJfbtOHusjdwe40Ko')::bigint as closer_opportunities,
    count(*) filter (where lower(coalesce(o.status,''))='open')::bigint as open_opportunities,
    count(*) filter (
      where not exists (
        select 1
        from public.milhano_v2_stage_map m
        where m.pipeline_id=o.pipeline_id
          and (
            (m.stage_id is not null and m.stage_id=o.pipeline_stage_id)
            or m.stage_name=o.current_stage
          )
      )
    )::bigint as unmapped_stage_opportunities
  from public.milhano_opportunities o
  where o.pipeline_id in ('GYqHbZyWUxxc3K03efVT','z1FEJfbtOHusjdwe40Ko')
),
setter_current as (
  select
    m.stage_name,
    m.canonical_key,
    m.display_order,
    m.stage_group,
    count(o.ghl_opportunity_id)::bigint as opportunity_count,
    count(o.ghl_opportunity_id) filter (where lower(coalesce(o.status,''))='open')::bigint as open_count
  from public.milhano_v2_stage_map m
  left join public.milhano_opportunities o
    on o.pipeline_id = m.pipeline_id
   and (o.pipeline_stage_id = m.stage_id or o.current_stage = m.stage_name)
  where m.pipeline_role='setter'
  group by m.stage_name,m.canonical_key,m.display_order,m.stage_group
  order by m.display_order
),
closer_current as (
  select
    m.stage_name,
    m.canonical_key,
    m.display_order,
    m.stage_group,
    count(o.ghl_opportunity_id)::bigint as opportunity_count,
    count(o.ghl_opportunity_id) filter (where lower(coalesce(o.status,''))='open')::bigint as open_count
  from public.milhano_v2_stage_map m
  left join public.milhano_opportunities o
    on o.pipeline_id = m.pipeline_id
   and (o.pipeline_stage_id = m.stage_id or o.current_stage = m.stage_name)
  where m.pipeline_role='closer'
  group by m.stage_name,m.canonical_key,m.display_order,m.stage_group
  order by m.display_order
),
today as (
  select
    count(distinct coalesce(a.ghl_opportunity_id,a.ghl_contact_id,a.appointment_id)) filter (
      where a.appointment_type='school_tour'
        and (a.start_time at time zone 'America/Merida')::date = b.local_today
        and lower(coalesce(a.appointment_status,'unknown')) not in ('cancelled','canceled','invalid')
    )::bigint as school_tours_today,
    count(distinct coalesce(a.ghl_opportunity_id,a.ghl_contact_id,a.appointment_id)) filter (
      where (a.appointment_type='trial_day' or a.calendar_id='a0bvCaXgCdVwSrgPELza')
        and (a.start_time at time zone 'America/Merida')::date = b.local_today
        and lower(coalesce(a.appointment_status,'unknown')) not in ('cancelled','canceled','invalid')
    )::bigint as trial_days_today
  from public.milhano_ghl_appointments a
  cross join bounds b
),
manual as (
  select
    coalesce(sum(mv.declared_value) filter (where mv.metric_key='new_leads_received'),0)::bigint as new_leads,
    coalesce(sum(mv.declared_value) filter (where mv.metric_key='contacted_reported'),0)::bigint as contacted,
    coalesce(sum(mv.declared_value) filter (where mv.metric_key='responses_reported'),0)::bigint as responded,
    coalesce(sum(mv.declared_value) filter (where mv.metric_key='meaningful_conversations_reported'),0)::bigint as meaningful,
    coalesce(sum(mv.declared_value) filter (where mv.metric_key='qualified_leads'),0)::bigint as qualified,
    coalesce(sum(mv.declared_value) filter (where mv.metric_key='school_tours_scheduled'),0)::bigint as tour_booked,
    coalesce(sum(mv.declared_value) filter (where mv.metric_key='school_tours_attended'),0)::bigint as tour_attended,
    coalesce(sum(mv.declared_value) filter (where mv.metric_key='trial_days_booked'),0)::bigint as trial_booked,
    coalesce(sum(mv.declared_value) filter (where mv.metric_key='trial_days_showed'),0)::bigint as trial_attended,
    coalesce(sum(mv.declared_value) filter (where mv.metric_key='closed_leads'),0)::bigint as closed,
    count(distinct s.eod_date) filter (where s.status in ('submitted','validated'))::bigint as reported_days
  from public.milhano_eod_submissions s
  left join public.milhano_eod_metric_values mv on mv.submission_id=s.id
  cross join bounds b
  where s.eod_date between b.effective_start and b.effective_end
    and s.status in ('submitted','validated')
),
stage_map_health as (
  select
    count(*)::integer as expected_stage_rows,
    count(stage_id)::integer as resolved_stage_ids
  from public.milhano_v2_stage_map
)
select jsonb_build_object(
  'meta', jsonb_build_object(
    'version','Admissions V2.1',
    'cutover_date','2026-09-08',
    'effective_start',(select effective_start from bounds),
    'effective_end',(select effective_end from bounds),
    'setter_pipeline_id','GYqHbZyWUxxc3K03efVT',
    'closer_pipeline_id','z1FEJfbtOHusjdwe40Ko',
    'pasadia_calendar_id','a0bvCaXgCdVwSrgPELza'
  ),
  'inventory',(select to_jsonb(i) from inventory i),
  'general', jsonb_build_array(
    jsonb_build_object('metric_key','new_leads','label','New Leads','value',(select new_leads from counts)),
    jsonb_build_object('metric_key','unique_contacted_leads','label','Contacted','value',(select contacted from counts)),
    jsonb_build_object('metric_key','responded_leads','label','Responded','value',(select responded from counts)),
    jsonb_build_object('metric_key','meaningful_conversations','label','Meaningful','value',(select meaningful from counts)),
    jsonb_build_object('metric_key','qualified_leads','label','Qualified','value',(select qualified from counts)),
    jsonb_build_object('metric_key','school_tours_booked','label','Tour Booked','value',(select tour_booked from counts)),
    jsonb_build_object('metric_key','school_tours_attended','label','Tour Attended','value',(select tour_attended from counts)),
    jsonb_build_object('metric_key','trial_days_booked','label','Pasadía Booked','value',(select trial_booked from counts)),
    jsonb_build_object('metric_key','trial_days_showed','label','Pasadía Attended','value',(select trial_attended from counts)),
    jsonb_build_object('metric_key','closed','label','Closed','value',(select closed from counts))
  ),
  'setter', jsonb_build_object(
    'owner','Pathi Carrillo',
    'pipeline_id','GYqHbZyWUxxc3K03efVT',
    'funnel', jsonb_build_array(
      jsonb_build_object('metric_key','new_leads','label','New Leads','value',(select new_leads from setter_counts)),
      jsonb_build_object('metric_key','unique_contacted_leads','label','Contacted','value',(select contacted from setter_counts)),
      jsonb_build_object('metric_key','responded_leads','label','Responded','value',(select responded from setter_counts)),
      jsonb_build_object('metric_key','meaningful_conversations','label','Meaningful','value',(select meaningful from setter_counts)),
      jsonb_build_object('metric_key','qualified_leads','label','Qualified','value',(select qualified from setter_counts))
    ),
    'current_stages', coalesce((select jsonb_agg(to_jsonb(s) order by s.display_order) from setter_current s),'[]'::jsonb)
  ),
  'closer', jsonb_build_object(
    'owner','Cinthia Esquivel',
    'pipeline_id','z1FEJfbtOHusjdwe40Ko',
    'funnel', jsonb_build_array(
      jsonb_build_object('metric_key','school_tours_booked','label','Tour Booked','value',(select tour_booked from closer_counts)),
      jsonb_build_object('metric_key','school_tours_attended','label','Tour Attended','value',(select tour_attended from closer_counts)),
      jsonb_build_object('metric_key','trial_days_booked','label','Pasadía Booked','value',(select trial_booked from closer_counts)),
      jsonb_build_object('metric_key','trial_days_showed','label','Pasadía Attended','value',(select trial_attended from closer_counts)),
      jsonb_build_object('metric_key','closed','label','Closed','value',(select closed from closer_counts))
    ),
    'current_stages', coalesce((select jsonb_agg(to_jsonb(s) order by s.display_order) from closer_current s),'[]'::jsonb)
  ),
  'today',(select to_jsonb(t) from today t),
  'manual',(select to_jsonb(m) from manual m),
  'stage_map',(select to_jsonb(h) from stage_map_health h),
  'health',coalesce((select jsonb_agg(to_jsonb(h)) from public.vw_milhano_system_health h),'[]'::jsonb),
  'quality',coalesce((select jsonb_agg(to_jsonb(q)) from public.vw_milhano_data_quality q),'[]'::jsonb)
);
$$;
