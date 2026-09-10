-- MILHANO Admissions V2
-- Cutover: 2026-09-08 America/Merida
-- Setter pipeline: GYqHbZyWUxxc3K03efVT
-- Closer pipeline: z1FEJfbtOHusjdwe40Ko
-- Pasadia calendar: a0bvCaXgCdVwSrgPELza
--
-- This migration adds V2 structures without deleting or rewriting V1 history.

begin;

alter table public.milhano_opportunities
  add column if not exists pipeline_id text;

create index if not exists idx_milhano_opportunities_pipeline_stage_v2
  on public.milhano_opportunities (pipeline_id, pipeline_stage_id, updated_at desc);

create index if not exists idx_milhano_opportunities_pipeline_created_v2
  on public.milhano_opportunities (pipeline_id, created_at desc);

create table if not exists public.milhano_v2_stage_map (
  pipeline_id text not null,
  pipeline_name text not null,
  pipeline_role text not null check (pipeline_role in ('setter','closer')),
  stage_id text,
  stage_name text not null,
  canonical_key text not null,
  display_order integer not null,
  stage_group text not null,
  is_positive_milestone boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (pipeline_id, stage_name)
);

create unique index if not exists uq_milhano_v2_stage_map_stage_id
  on public.milhano_v2_stage_map (stage_id)
  where stage_id is not null;

alter table public.milhano_v2_stage_map enable row level security;
revoke all on table public.milhano_v2_stage_map from anon, authenticated;
grant select, insert, update, delete on table public.milhano_v2_stage_map to service_role;

insert into public.milhano_v2_stage_map
  (pipeline_id, pipeline_name, pipeline_role, stage_name, canonical_key, display_order, stage_group, is_positive_milestone)
values
  ('GYqHbZyWUxxc3K03efVT','Leads Milhano (Setter Pipeline)','setter','New Lead','setter_new_lead',10,'entrada',true),
  ('GYqHbZyWUxxc3K03efVT','Leads Milhano (Setter Pipeline)','setter','No answer - Day 1','setter_no_answer_d1',20,'seguimiento',false),
  ('GYqHbZyWUxxc3K03efVT','Leads Milhano (Setter Pipeline)','setter','No answer - Day 2','setter_no_answer_d2',30,'seguimiento',false),
  ('GYqHbZyWUxxc3K03efVT','Leads Milhano (Setter Pipeline)','setter','No answer - Day 3','setter_no_answer_d3',40,'seguimiento',false),
  ('GYqHbZyWUxxc3K03efVT','Leads Milhano (Setter Pipeline)','setter','Never Answered / Nurturing A','setter_nurturing_a',50,'nurturing',false),
  ('GYqHbZyWUxxc3K03efVT','Leads Milhano (Setter Pipeline)','setter','Meaningful Conversation','setter_meaningful',60,'hito',true),
  ('GYqHbZyWUxxc3K03efVT','Leads Milhano (Setter Pipeline)','setter','Callback','setter_callback',70,'seguimiento',false),
  ('GYqHbZyWUxxc3K03efVT','Leads Milhano (Setter Pipeline)','setter','Qualified','setter_qualified',80,'hito',true),
  ('GYqHbZyWUxxc3K03efVT','Leads Milhano (Setter Pipeline)','setter','Disqualified','setter_disqualified',90,'salida',false),
  ('z1FEJfbtOHusjdwe40Ko','Leads Milhano (Closer Pipeline)','closer','Tour Booked','closer_tour_booked',10,'hito',true),
  ('z1FEJfbtOHusjdwe40Ko','Leads Milhano (Closer Pipeline)','closer','Tour Cancelled / No show - Nurturing B','closer_tour_nurturing_b',20,'nurturing',false),
  ('z1FEJfbtOHusjdwe40Ko','Leads Milhano (Closer Pipeline)','closer','Tour Attended','closer_tour_attended',30,'hito',true),
  ('z1FEJfbtOHusjdwe40Ko','Leads Milhano (Closer Pipeline)','closer','Pasadia Booked','closer_trial_booked',40,'hito',true),
  ('z1FEJfbtOHusjdwe40Ko','Leads Milhano (Closer Pipeline)','closer','Pasadia Cancelled / No Show - Nurturing B','closer_trial_nurturing_b',50,'nurturing',false),
  ('z1FEJfbtOHusjdwe40Ko','Leads Milhano (Closer Pipeline)','closer','Pasadia Attended','closer_trial_attended',60,'hito',true),
  ('z1FEJfbtOHusjdwe40Ko','Leads Milhano (Closer Pipeline)','closer','Closed/Enrolled','closer_closed',70,'resultado',true)
on conflict (pipeline_id, stage_name) do update set
  pipeline_name = excluded.pipeline_name,
  pipeline_role = excluded.pipeline_role,
  canonical_key = excluded.canonical_key,
  display_order = excluded.display_order,
  stage_group = excluded.stage_group,
  is_positive_milestone = excluded.is_positive_milestone,
  updated_at = now();

create or replace view public.vw_milhano_v2_pipeline_current
with (security_invoker = true)
as
select
  o.ghl_opportunity_id,
  o.ghl_contact_id,
  o.pipeline_id,
  o.pipeline_name,
  o.pipeline_stage_id,
  o.current_stage,
  o.status,
  o.opportunity_name,
  o.contact_name,
  o.student_name,
  o.phone,
  o.email,
  o.source,
  o.assigned_user,
  o.assigned_user_id,
  o.created_at,
  o.updated_at,
  o.pipeline_updated_at,
  o.original_lead_date,
  o.grade_interest,
  m.pipeline_role,
  m.canonical_key,
  m.display_order,
  m.stage_group,
  m.is_positive_milestone
from public.milhano_opportunities o
left join public.milhano_v2_stage_map m
  on m.pipeline_id = o.pipeline_id
 and (
   (m.stage_id is not null and m.stage_id = o.pipeline_stage_id)
   or m.stage_name = o.current_stage
 )
where o.pipeline_id in ('GYqHbZyWUxxc3K03efVT','z1FEJfbtOHusjdwe40Ko');

revoke all on table public.vw_milhano_v2_pipeline_current from anon, authenticated;
grant select on table public.vw_milhano_v2_pipeline_current to service_role;

-- Wrapper around the proven V1 live processor. It keeps V1 behavior, adds the
-- current pipeline_id to the opportunity row, and seeds an initial stage event
-- for brand-new V2 opportunities so New Lead is attributable to the setter.
create or replace function public.milhano_process_opportunity_live_event_v2(
  p_event_fingerprint text,
  p_event_type text,
  p_received_at timestamptz,
  p_location_id text,
  p_opportunity_id text,
  p_contact_id text,
  p_pipeline_id text,
  p_pipeline_name text,
  p_pipeline_stage_id text,
  p_stage_name text,
  p_status text,
  p_assigned_user_id text,
  p_opportunity_name text,
  p_contact_name text,
  p_phone text,
  p_email text,
  p_source text,
  p_created_at timestamptz,
  p_updated_at timestamptz,
  p_pipeline_updated_at timestamptz,
  p_raw_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_is_new boolean := false;
  v_actor_app_user_id uuid;
  v_seeded_count integer := 0;
begin
  v_result := public.milhano_process_opportunity_live_event(
    p_event_fingerprint,
    p_event_type,
    p_received_at,
    p_location_id,
    p_opportunity_id,
    p_contact_id,
    p_pipeline_id,
    p_pipeline_name,
    p_pipeline_stage_id,
    p_stage_name,
    p_status,
    p_assigned_user_id,
    p_opportunity_name,
    p_contact_name,
    p_phone,
    p_email,
    p_source,
    p_created_at,
    p_updated_at,
    p_pipeline_updated_at,
    p_raw_payload
  );

  update public.milhano_opportunities
  set pipeline_id = coalesce(nullif(trim(p_pipeline_id), ''), pipeline_id)
  where ghl_opportunity_id = p_opportunity_id;

  v_is_new := coalesce((v_result ->> 'is_new_opportunity')::boolean, false);

  if v_is_new
     and p_pipeline_id in ('GYqHbZyWUxxc3K03efVT','z1FEJfbtOHusjdwe40Ko')
     and nullif(trim(p_stage_name), '') is not null then

    select id into v_actor_app_user_id
    from public.milhano_app_users
    where ghl_user_id = p_assigned_user_id
      and is_active = true
    limit 1;

    insert into public.milhano_stage_events (
      event_id,
      ghl_opportunity_id,
      ghl_contact_id,
      from_stage,
      to_stage,
      event_timestamp,
      event_type,
      event_source,
      is_inferred,
      is_valid,
      note,
      received_at,
      location_id,
      pipeline_id,
      from_stage_id,
      to_stage_id,
      assigned_user_id_at_event,
      attributed_ghl_user_id,
      attributed_app_user_id,
      attribution_method,
      raw_payload
    ) values (
      p_event_fingerprint || ':v2-initial-stage',
      p_opportunity_id,
      p_contact_id,
      null,
      p_stage_name,
      coalesce(p_created_at, p_pipeline_updated_at, p_updated_at, p_received_at, now()),
      'stage_entry',
      'ghl_live_sync_v2',
      false,
      true,
      'Initial V2 stage captured when the opportunity was first seen live.',
      coalesce(p_received_at, now()),
      p_location_id,
      p_pipeline_id,
      null,
      p_pipeline_stage_id,
      p_assigned_user_id,
      p_assigned_user_id,
      v_actor_app_user_id,
      case when p_assigned_user_id is null then 'unattributed' else 'owner_at_event' end,
      p_raw_payload
    )
    on conflict (event_id) do nothing;

    get diagnostics v_seeded_count = row_count;
  end if;

  return v_result || jsonb_build_object(
    'v2_pipeline_id', p_pipeline_id,
    'v2_initial_stage_seeded', (v_seeded_count > 0)
  );
end;
$$;

-- Full reconciliation cannot reconstruct every historical stage movement from
-- the GHL snapshot. This seeds the minimum safe baseline for V2 only:
-- New Lead at created_at (Pathi) plus the current V2 stage if no event exists.
create or replace function public.milhano_seed_v2_baseline_events()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_leads integer := 0;
  v_current_stages integer := 0;
  v_pathi_app_id uuid;
  v_owner_app_id uuid;
begin
  select id into v_pathi_app_id
  from public.milhano_app_users
  where ghl_user_id = 'LTJEPAdClnxPxUd2mRXp'
    and is_active = true
  limit 1;

  insert into public.milhano_stage_events (
    event_id, ghl_opportunity_id, ghl_contact_id,
    from_stage, to_stage, event_timestamp,
    event_type, event_source, is_inferred, is_valid,
    note, received_at, location_id, pipeline_id,
    from_stage_id, to_stage_id, assigned_user_id_at_event,
    attributed_ghl_user_id, attributed_app_user_id, attribution_method
  )
  select
    'v2-baseline:new:' || o.ghl_opportunity_id,
    o.ghl_opportunity_id,
    o.ghl_contact_id,
    null,
    'New Lead',
    coalesce(o.created_at, o.original_lead_date, now()),
    'stage_entry',
    'v2_baseline_reconciliation',
    true,
    true,
    'Inferred V2 New Lead baseline. All V2 admissions opportunities originate with the setter before School Tour handoff.',
    now(),
    o.location_id,
    'GYqHbZyWUxxc3K03efVT',
    null,
    (select stage_id from public.milhano_v2_stage_map where pipeline_id='GYqHbZyWUxxc3K03efVT' and stage_name='New Lead' limit 1),
    'LTJEPAdClnxPxUd2mRXp',
    'LTJEPAdClnxPxUd2mRXp',
    v_pathi_app_id,
    'v2_baseline_inferred'
  from public.milhano_opportunities o
  where o.pipeline_id in ('GYqHbZyWUxxc3K03efVT','z1FEJfbtOHusjdwe40Ko')
    and coalesce(o.created_at, o.original_lead_date) >= timestamptz '2026-09-08 00:00:00-06'
    and not exists (
      select 1 from public.milhano_stage_events e
      where e.ghl_opportunity_id = o.ghl_opportunity_id
        and e.is_valid = true
        and e.pipeline_id = 'GYqHbZyWUxxc3K03efVT'
        and e.to_stage = 'New Lead'
    )
  on conflict (event_id) do nothing;

  get diagnostics v_new_leads = row_count;

  insert into public.milhano_stage_events (
    event_id, ghl_opportunity_id, ghl_contact_id,
    from_stage, to_stage, event_timestamp,
    event_type, event_source, is_inferred, is_valid,
    note, received_at, location_id, pipeline_id,
    from_stage_id, to_stage_id, assigned_user_id_at_event,
    attributed_ghl_user_id, attributed_app_user_id, attribution_method
  )
  select
    'v2-baseline:current:' || o.ghl_opportunity_id || ':' || coalesce(o.pipeline_stage_id, md5(coalesce(o.current_stage,''))),
    o.ghl_opportunity_id,
    o.ghl_contact_id,
    null,
    o.current_stage,
    coalesce(o.pipeline_updated_at, o.updated_at, o.created_at, now()),
    'stage_entry',
    'v2_baseline_reconciliation',
    true,
    true,
    'Inferred current V2 stage from the first dual-pipeline reconciliation snapshot.',
    now(),
    o.location_id,
    o.pipeline_id,
    null,
    o.pipeline_stage_id,
    o.assigned_user_id,
    o.assigned_user_id,
    u.id,
    'v2_baseline_inferred'
  from public.milhano_opportunities o
  left join public.milhano_app_users u
    on u.ghl_user_id = o.assigned_user_id
   and u.is_active = true
  where o.pipeline_id in ('GYqHbZyWUxxc3K03efVT','z1FEJfbtOHusjdwe40Ko')
    and nullif(trim(o.current_stage),'') is not null
    and not exists (
      select 1 from public.milhano_stage_events e
      where e.ghl_opportunity_id = o.ghl_opportunity_id
        and e.is_valid = true
        and e.pipeline_id = o.pipeline_id
        and e.to_stage = o.current_stage
    )
  on conflict (event_id) do nothing;

  get diagnostics v_current_stages = row_count;

  return jsonb_build_object(
    'ok', true,
    'new_lead_events_seeded', v_new_leads,
    'current_stage_events_seeded', v_current_stages,
    'cutover', '2026-09-08'
  );
end;
$$;

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
  cross join bounds b
  where coalesce(o.original_lead_date, o.created_at) >= b.start_at
    and coalesce(o.original_lead_date, o.created_at) < b.end_at
    and (
      o.pipeline_id in ('GYqHbZyWUxxc3K03efVT','z1FEJfbtOHusjdwe40Ko')
      or exists (
        select 1 from public.milhano_stage_events e
        where e.ghl_opportunity_id = o.ghl_opportunity_id
          and e.is_valid = true
          and e.pipeline_id in ('GYqHbZyWUxxc3K03efVT','z1FEJfbtOHusjdwe40Ko')
          and e.event_timestamp >= b.start_at
          and e.event_timestamp < b.evidence_end
      )
    )
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

create or replace function public.milhano_get_v2_metric_leads(p_metric_key text, p_start date, p_end date)
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
  lead_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
select
  f.ghl_opportunity_id,
  f.ghl_contact_id,
  f.lead_name,
  f.contact_name,
  f.student_name,
  f.phone,
  f.email,
  f.source,
  f.operational_owner,
  f.current_pipeline_role,
  f.current_stage,
  f.lead_at
from public.milhano_get_v2_cohort_flags(p_start,p_end) f
where case p_metric_key
  when 'new_leads' then true
  when 'unique_contacted_leads' then f.reached_contacted
  when 'responded_leads' then f.reached_responded
  when 'meaningful_conversations' then f.reached_meaningful
  when 'qualified_leads' then f.reached_qualified
  when 'school_tours_booked' then f.reached_tour_booked
  when 'school_tours_attended' then f.reached_tour_attended
  when 'trial_days_booked' then f.reached_trial_booked
  when 'trial_days_showed' then f.reached_trial_attended
  when 'closed' then f.reached_closed
  else false
end
order by f.lead_at desc, f.lead_name;
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
    'version','Admissions V2',
    'cutover_date','2026-09-08',
    'effective_start',(select effective_start from bounds),
    'effective_end',(select effective_end from bounds),
    'setter_pipeline_id','GYqHbZyWUxxc3K03efVT',
    'closer_pipeline_id','z1FEJfbtOHusjdwe40Ko',
    'pasadia_calendar_id','a0bvCaXgCdVwSrgPELza'
  ),
  'general', jsonb_build_array(
    jsonb_build_object('metric_key','new_leads','label','New Leads','value',(select new_leads from counts)),
    jsonb_build_object('metric_key','unique_contacted_leads','label','Contacted','value',(select contacted from counts)),
    jsonb_build_object('metric_key','responded_leads','label','Responded','value',(select responded from counts)),
    jsonb_build_object('metric_key','meaningful_conversations','label','Meaningful Conversation','value',(select meaningful from counts)),
    jsonb_build_object('metric_key','qualified_leads','label','Qualified','value',(select qualified from counts)),
    jsonb_build_object('metric_key','school_tours_booked','label','Tour Booked','value',(select tour_booked from counts)),
    jsonb_build_object('metric_key','school_tours_attended','label','Tour Attended','value',(select tour_attended from counts)),
    jsonb_build_object('metric_key','trial_days_booked','label','Pasadía Booked','value',(select trial_booked from counts)),
    jsonb_build_object('metric_key','trial_days_showed','label','Pasadía Attended','value',(select trial_attended from counts)),
    jsonb_build_object('metric_key','closed','label','Closed / Enrolled','value',(select closed from counts))
  ),
  'setter', jsonb_build_object(
    'owner','Pathi Carrillo',
    'pipeline_id','GYqHbZyWUxxc3K03efVT',
    'funnel', jsonb_build_array(
      jsonb_build_object('metric_key','new_leads','label','New Leads','value',(select new_leads from counts)),
      jsonb_build_object('metric_key','unique_contacted_leads','label','Contacted','value',(select contacted from counts)),
      jsonb_build_object('metric_key','responded_leads','label','Responded','value',(select responded from counts)),
      jsonb_build_object('metric_key','meaningful_conversations','label','Meaningful Conversation','value',(select meaningful from counts)),
      jsonb_build_object('metric_key','qualified_leads','label','Qualified','value',(select qualified from counts))
    ),
    'current_stages', coalesce((select jsonb_agg(to_jsonb(s) order by s.display_order) from setter_current s),'[]'::jsonb)
  ),
  'closer', jsonb_build_object(
    'owner','Cinthia Esquivel',
    'pipeline_id','z1FEJfbtOHusjdwe40Ko',
    'funnel', jsonb_build_array(
      jsonb_build_object('metric_key','school_tours_booked','label','Tour Booked','value',(select tour_booked from counts)),
      jsonb_build_object('metric_key','school_tours_attended','label','Tour Attended','value',(select tour_attended from counts)),
      jsonb_build_object('metric_key','trial_days_booked','label','Pasadía Booked','value',(select trial_booked from counts)),
      jsonb_build_object('metric_key','trial_days_showed','label','Pasadía Attended','value',(select trial_attended from counts)),
      jsonb_build_object('metric_key','closed','label','Closed / Enrolled','value',(select closed from counts))
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

-- EOD system snapshot: understand both the legacy stages and the V2 stage names.
-- This preserves historical compatibility while making Sep-08+ system values useful.
create or replace function public.milhano_calculate_eod_metrics(p_app_user_id uuid, p_eod_date date)
returns table(metric_key text, system_value integer)
language sql
stable
set search_path = public
as $$
with selected_user as (
  select ghl_user_id
  from public.milhano_app_users
  where id=p_app_user_id and is_active=true
),
eod_window as (
  select * from public.milhano_get_eod_window(p_eod_date)
),
calls as (
  select c.*
  from public.milhano_communication_events c
  cross join selected_user u
  cross join eod_window w
  where lower(c.channel)='call'
    and c.is_call_attempt=true
    and c.ghl_user_id=u.ghl_user_id
    and c.event_timestamp>=w.window_start
    and c.event_timestamp<w.window_end
),
stage_events as (
  select e.*
  from public.milhano_stage_events e
  cross join selected_user u
  cross join eod_window w
  where e.attributed_ghl_user_id=u.ghl_user_id
    and e.event_timestamp>=w.window_start
    and e.event_timestamp<w.window_end
    and e.is_valid=true
),
qualification_events as (
  select q.ghl_opportunity_id
  from public.vw_milhano_qualification_events q
  cross join selected_user u
  cross join eod_window w
  where q.attributed_ghl_user_id=u.ghl_user_id
    and q.qualified_at>=w.window_start
    and q.qualified_at<w.window_end
  union
  select e.ghl_opportunity_id from stage_events e where e.to_stage='Qualified'
),
positive_advances as (
  select p.ghl_opportunity_id
  from public.vw_milhano_positive_stage_advances p
  cross join selected_user u
  cross join eod_window w
  where p.attributed_ghl_user_id=u.ghl_user_id
    and p.event_timestamp>=w.window_start
    and p.event_timestamp<w.window_end
  union
  select e.ghl_opportunity_id from stage_events e
  where e.to_stage in ('Meaningful Conversation','Qualified','Tour Booked','Tour Attended','Pasadia Booked','Pasadia Attended','Closed/Enrolled')
),
first_touches as (
  select f.*
  from public.vw_milhano_first_human_touch f
  cross join selected_user u
  cross join eod_window w
  where f.attributed_ghl_user_id=u.ghl_user_id
    and f.event_timestamp>=w.window_start
    and f.event_timestamp<w.window_end
),
new_lead_ids as (
  select o.ghl_opportunity_id
  from public.milhano_opportunities o
  cross join selected_user u
  cross join eod_window w
  where o.assigned_user_id=u.ghl_user_id
    and o.created_at>=w.window_start and o.created_at<w.window_end
  union
  select e.ghl_opportunity_id from stage_events e where e.to_stage in ('Cliente potencial','New Lead')
)
select 'calls_made', count(*) filter(where direction='outbound')::integer from calls
union all select 'inbound_calls', count(*) filter(where direction='inbound')::integer from calls
union all select 'ghl_connected_calls', count(*) filter(where direction='outbound' and is_connected_raw=true)::integer from calls
union all select 'unique_leads_called', count(distinct coalesce(ghl_opportunity_id,ghl_contact_id)) filter(where direction='outbound' and is_connected_raw=true)::integer from calls
union all select 'meaningful_calls_3min', count(*) filter(where direction='outbound' and is_meaningful_conversation=true)::integer from calls
union all select 'meaningful_conversations', (
  select count(distinct x.id)::integer from (
    select coalesce(ghl_opportunity_id,ghl_contact_id) as id from calls where direction='outbound' and is_meaningful_conversation=true
    union select ghl_opportunity_id from stage_events where to_stage='Meaningful Conversation'
  ) x
)
union all select 'new_leads_received', count(distinct ghl_opportunity_id)::integer from new_lead_ids
union all select 'new_leads_attended', count(distinct ghl_opportunity_id)::integer from first_touches
union all select 'qualified_leads', count(distinct ghl_opportunity_id)::integer from qualification_events
union all select 'leads_advanced_stage', count(distinct ghl_opportunity_id)::integer from positive_advances
union all select 'school_tours_scheduled', count(distinct ghl_opportunity_id)::integer from stage_events where to_stage in ('School Tour agendado','Tour Booked')
union all select 'school_tours_attended', count(distinct ghl_opportunity_id)::integer from stage_events where to_stage in ('School Tour atendido','Tour Attended')
union all select 'trial_days_booked', count(distinct ghl_opportunity_id)::integer from stage_events where to_stage in ('Pasadía agendada','Pasadia Booked')
union all select 'trial_days_showed', count(distinct ghl_opportunity_id)::integer from stage_events where to_stage in ('Pasadía asistida','Pasadia Attended')
union all select 'closed_leads', count(distinct ghl_opportunity_id)::integer from stage_events where to_stage in ('Inscrito','Closed/Enrolled');
$$;

create or replace function public.milhano_calculate_team_eod_metrics(p_eod_date date)
returns table(metric_key text, metric_value integer)
language sql
stable
set search_path = public
as $$
with eod_window as (
  select * from public.milhano_get_eod_window(p_eod_date)
),
whatsapp as (
  select c.* from public.milhano_communication_events c cross join eod_window w
  where lower(c.channel)='whatsapp' and c.event_timestamp>=w.window_start and c.event_timestamp<w.window_end
),
calls as (
  select c.* from public.milhano_communication_events c cross join eod_window w
  where lower(c.channel)='call' and c.is_call_attempt=true and c.event_timestamp>=w.window_start and c.event_timestamp<w.window_end
),
stage_events as (
  select e.* from public.milhano_stage_events e cross join eod_window w
  where e.is_valid=true and e.event_timestamp>=w.window_start and e.event_timestamp<w.window_end
)
select 'whatsapp_total_messages',count(*)::integer from whatsapp
union all select 'whatsapp_inbound_messages',count(*) filter(where direction='inbound')::integer from whatsapp
union all select 'whatsapp_outbound_messages',count(*) filter(where direction='outbound')::integer from whatsapp
union all select 'whatsapp_manual_outbound_messages',count(*) filter(where is_eod_countable=true)::integer from whatsapp
union all select 'whatsapp_automated_outbound_messages',count(*) filter(where direction='outbound' and is_automated=true)::integer from whatsapp
union all select 'whatsapp_active_conversations',count(distinct conversation_id) filter(where conversation_id is not null)::integer from whatsapp
union all select 'whatsapp_manually_attended_conversations',count(distinct conversation_id) filter(where conversation_id is not null and is_eod_countable=true)::integer from whatsapp
union all select 'whatsapp_unique_contacts',count(distinct ghl_contact_id) filter(where ghl_contact_id is not null)::integer from whatsapp
union all select 'whatsapp_admissions_related_messages',count(*) filter(where is_admissions_related=true)::integer from whatsapp
union all select 'whatsapp_general_or_unclassified_messages',count(*) filter(where not coalesce(is_admissions_related,false))::integer from whatsapp
union all select 'team_outbound_call_attempts',count(*) filter(where direction='outbound')::integer from calls
union all select 'team_inbound_calls',count(*) filter(where direction='inbound')::integer from calls
union all select 'team_meaningful_calls_3min',count(*) filter(where is_meaningful_conversation=true)::integer from calls
union all select 'trial_day_plus_closed_leads',count(distinct ghl_opportunity_id)::integer from stage_events
where to_stage in (
  'Pasadía agendada','Pasadía asistida','Retroalimentación','En evaluación','Inscripción en proceso','Inscrito',
  'Pasadia Booked','Pasadia Attended','Closed/Enrolled'
);
$$;

-- Internal functions are service-side only. Dashboard reads them through the
-- server service client; browser users never need direct RPC execution.
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname in (
        'milhano_process_opportunity_live_event_v2',
        'milhano_seed_v2_baseline_events',
        'milhano_get_v2_cohort_flags',
        'milhano_get_v2_metric_leads',
        'milhano_get_admissions_v2_payload'
      )
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.signature);
    execute format('grant execute on function %s to service_role', r.signature);
  end loop;
end $$;

commit;
