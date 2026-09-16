
-- ============================================================
-- MILHANO Admissions V19 · GHL Truth Layer · September cohort
-- Source of truth: GoHighLevel.
--
-- Goals
-- 1) Cohort starts 2026-09-01 and uses GHL opportunity created_at.
-- 2) Accept Legacy + Setter + Closer as one admissions cohort.
-- 3) Appointments, appointment statuses, stages and communications
--    are evidence. No manual EOD values are injected into AUTO.
-- 4) Add a compact one-RPC lead detail for fast interactive views.
-- 5) Prepare current GHL snapshot fields without deleting history.
-- ============================================================

create table if not exists public.milhano_admissions_pipeline_registry (
  pipeline_id text primary key,
  pipeline_name text not null,
  pipeline_role text not null check (pipeline_role in ('legacy','setter','closer')),
  is_active boolean not null default true,
  synced_at timestamptz not null default now()
);

create unique index if not exists idx_milhano_admissions_pipeline_registry_role
  on public.milhano_admissions_pipeline_registry(pipeline_role)
  where is_active = true;

insert into public.milhano_admissions_pipeline_registry
  (pipeline_id,pipeline_name,pipeline_role,is_active,synced_at)
values
  ('GYqHbZyWUxxc3K03efVT','Leads Milhano (Setter Pipeline)','setter',true,now()),
  ('z1FEJfbtOHusjdwe40Ko','Leads Milhano (Closer Pipeline)','closer',true,now())
on conflict(pipeline_id) do update set
  pipeline_name=excluded.pipeline_name,
  pipeline_role=excluded.pipeline_role,
  is_active=true,
  synced_at=now();

-- V18 only allowed setter/closer. V19 also registers the current Legacy stages.
alter table public.milhano_v2_stage_map
  drop constraint if exists milhano_v2_stage_map_pipeline_role_check;

alter table public.milhano_v2_stage_map
  add constraint milhano_v2_stage_map_pipeline_role_check
  check (pipeline_role in ('legacy','setter','closer'));

alter table public.milhano_opportunities
  add column if not exists ghl_lost_reason_id text,
  add column if not exists ghl_custom_fields jsonb not null default '[]'::jsonb,
  add column if not exists ghl_calendar_events jsonb not null default '[]'::jsonb,
  add column if not exists last_truth_synced_at timestamptz;

create index if not exists idx_milhano_opportunities_created_truth
  on public.milhano_opportunities(created_at desc);

create index if not exists idx_milhano_opportunities_pipeline_created_truth
  on public.milhano_opportunities(pipeline_id,created_at desc);

create index if not exists idx_milhano_appointments_opportunity_type_start
  on public.milhano_ghl_appointments(ghl_opportunity_id,appointment_type,start_time desc);

create index if not exists idx_milhano_appointments_contact_type_start
  on public.milhano_ghl_appointments(ghl_contact_id,appointment_type,start_time desc);

-- We change the return type to expose status/pipeline/lost reason to metric drilldowns.
drop function if exists public.milhano_get_v2_metric_leads(text,date,date);
drop function if exists public.milhano_get_admissions_v2_payload(date,date);
drop function if exists public.milhano_get_v2_cohort_flags(date,date);

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
  pipeline_name text,
  current_stage text,
  opportunity_status text,
  lost_reason text,
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
set search_path=public
as $$
with bounds as (
  select
    greatest(p_start,date '2026-09-01')::timestamp at time zone 'America/Merida' as start_at,
    (p_end + 1)::timestamp at time zone 'America/Merida' as end_at,
    least(
      (p_end + 1)::timestamp at time zone 'America/Merida',
      now() + interval '5 minutes'
    ) as evidence_end
),
cohort as (
  select
    o.*,
    o.created_at as lead_at,
    coalesce(
      (
        select r.pipeline_role
        from public.milhano_admissions_pipeline_registry r
        where r.is_active=true
          and (
            r.pipeline_id=o.pipeline_id
            or lower(trim(r.pipeline_name))=lower(trim(coalesce(o.pipeline_name,'')))
          )
        limit 1
      ),
      case
        when o.pipeline_id='GYqHbZyWUxxc3K03efVT' then 'setter'
        when o.pipeline_id='z1FEJfbtOHusjdwe40Ko' then 'closer'
        when lower(trim(coalesce(o.pipeline_name,''))) in ('leads milhano','leads coldem') then 'legacy'
        else null
      end
    ) as current_pipeline_role,
    coalesce(
      nullif(trim(o.assigned_user),''),
      nullif(trim(o.historical_advisor),''),
      'Sin asignar'
    ) as operational_owner
  from public.milhano_opportunities o
  cross join bounds b
  where o.created_at >= b.start_at
    and o.created_at < b.end_at
    and (
      exists (
        select 1
        from public.milhano_admissions_pipeline_registry r
        where r.is_active=true
          and (
            r.pipeline_id=o.pipeline_id
            or lower(trim(r.pipeline_name))=lower(trim(coalesce(o.pipeline_name,'')))
          )
      )
      or lower(trim(coalesce(o.pipeline_name,''))) in ('leads milhano','leads coldem')
      or exists (
        select 1
        from public.milhano_stage_events e
        join public.milhano_admissions_pipeline_registry r
          on r.is_active=true and r.pipeline_id=e.pipeline_id
        where e.ghl_opportunity_id=o.ghl_opportunity_id
          and e.is_valid=true
          and e.event_timestamp < b.evidence_end
      )
    )
),
raw as (
  select
    c.*,

    exists (
      select 1
      from public.vw_milhano_operational_cascade_activity a
      cross join bounds b
      where a.metric_key='unique_contacted_leads'
        and a.ghl_opportunity_id=c.ghl_opportunity_id
        and a.activity_at >= c.lead_at
        and a.activity_at < b.evidence_end
    ) as raw_contacted,

    exists (
      select 1
      from public.vw_milhano_operational_cascade_activity a
      cross join bounds b
      where a.metric_key='responded_leads'
        and a.ghl_opportunity_id=c.ghl_opportunity_id
        and a.activity_at >= c.lead_at
        and a.activity_at < b.evidence_end
    ) as raw_responded,

    (
      exists (
        select 1
        from public.vw_milhano_operational_cascade_activity a
        cross join bounds b
        where a.metric_key='meaningful_conversations'
          and a.ghl_opportunity_id=c.ghl_opportunity_id
          and a.activity_at >= c.lead_at
          and a.activity_at < b.evidence_end
      )
      or exists (
        select 1
        from public.milhano_stage_events e
        cross join bounds b
        where e.ghl_opportunity_id=c.ghl_opportunity_id
          and e.is_valid=true
          and lower(trim(coalesce(e.to_stage,''))) in (
            'meaningful conversation','qualified',
            'fit','school tour agendado','school tour atendido',
            'pasadía agendada','pasadia agendada','pasadía asistida','pasadia asistida',
            'retroalimentación','retroalimentacion','en evaluación','en evaluacion',
            'inscripción en proceso','inscripcion en proceso','inscrito'
          )
          and e.event_timestamp < b.evidence_end
      )
      or lower(trim(coalesce(c.current_stage,''))) in (
        'meaningful conversation','qualified',
        'fit','school tour agendado','school tour atendido',
        'pasadía agendada','pasadia agendada','pasadía asistida','pasadia asistida',
        'retroalimentación','retroalimentacion','en evaluación','en evaluacion',
        'inscripción en proceso','inscripcion en proceso','inscrito'
      )
    ) as raw_meaningful,

    (
      exists (
        select 1
        from public.milhano_stage_events e
        cross join bounds b
        where e.ghl_opportunity_id=c.ghl_opportunity_id
          and e.is_valid=true
          and lower(trim(coalesce(e.to_stage,''))) in (
            'qualified','fit',
            'tour booked','tour attended',
            'pasadia booked','pasadía booked',
            'pasadia cancelled / no show - nurturing b','pasadía cancelled / no show - nurturing b',
            'pasadia attended','pasadía attended','closed/enrolled',
            'school tour agendado','school tour atendido',
            'pasadía agendada','pasadia agendada','pasadía asistida','pasadia asistida',
            'retroalimentación','retroalimentacion','en evaluación','en evaluacion',
            'inscripción en proceso','inscripcion en proceso','inscrito'
          )
          and e.event_timestamp < b.evidence_end
      )
      or c.current_pipeline_role='closer'
      or lower(trim(coalesce(c.current_stage,''))) in (
        'qualified','fit',
        'tour booked','tour attended',
        'pasadia booked','pasadía booked',
        'pasadia attended','pasadía attended','closed/enrolled',
        'school tour agendado','school tour atendido',
        'pasadía agendada','pasadia agendada','pasadía asistida','pasadia asistida',
        'retroalimentación','retroalimentacion','en evaluación','en evaluacion',
        'inscripción en proceso','inscripcion en proceso','inscrito'
      )
    ) as raw_qualified,

    (
      exists (
        select 1
        from public.milhano_ghl_appointments a
        cross join bounds b
        where (
          a.ghl_opportunity_id=c.ghl_opportunity_id
          or (
            a.ghl_opportunity_id is null
            and a.ghl_contact_id=c.ghl_contact_id
            and coalesce(a.date_added,a.start_time) >= c.lead_at - interval '5 minutes'
          )
        )
          and a.appointment_type='school_tour'
          and coalesce(a.date_added,a.start_time) < b.evidence_end
      )
      or c.current_pipeline_role='closer'
      or lower(trim(coalesce(c.current_stage,''))) in (
        'tour booked','tour cancelled / no show - nurturing b','tour attended',
        'pasadia booked','pasadía booked','pasadia cancelled / no show - nurturing b',
        'pasadia attended','pasadía attended','closed/enrolled',
        'school tour agendado','school tour atendido',
        'pasadía agendada','pasadia agendada','pasadía asistida','pasadia asistida',
        'retroalimentación','retroalimentacion','en evaluación','en evaluacion',
        'inscripción en proceso','inscripcion en proceso','inscrito'
      )
      or exists (
        select 1
        from public.milhano_stage_events e
        cross join bounds b
        where e.ghl_opportunity_id=c.ghl_opportunity_id
          and e.is_valid=true
          and lower(trim(coalesce(e.to_stage,''))) in (
            'tour booked','tour cancelled / no show - nurturing b','tour attended',
            'pasadia booked','pasadía booked','pasadia cancelled / no show - nurturing b',
            'pasadia attended','pasadía attended','closed/enrolled',
            'school tour agendado','school tour atendido',
            'pasadía agendada','pasadia agendada','pasadía asistida','pasadia asistida',
            'retroalimentación','retroalimentacion','en evaluación','en evaluacion',
            'inscripción en proceso','inscripcion en proceso','inscrito'
          )
          and e.event_timestamp < b.evidence_end
      )
    ) as raw_tour_booked,

    (
      exists (
        select 1
        from public.milhano_ghl_appointments a
        cross join bounds b
        where (
          a.ghl_opportunity_id=c.ghl_opportunity_id
          or (
            a.ghl_opportunity_id is null
            and a.ghl_contact_id=c.ghl_contact_id
            and coalesce(a.date_added,a.start_time) >= c.lead_at - interval '5 minutes'
          )
        )
          and a.appointment_type='school_tour'
          and a.start_time < b.evidence_end
          and lower(coalesce(a.appointment_status,'')) in ('showed','completed','show','attended')
      )
      or lower(trim(coalesce(c.current_stage,''))) in (
        'tour attended','pasadia booked','pasadía booked',
        'pasadia cancelled / no show - nurturing b',
        'pasadia attended','pasadía attended','closed/enrolled',
        'school tour atendido','pasadía agendada','pasadia agendada',
        'pasadía asistida','pasadia asistida',
        'retroalimentación','retroalimentacion','en evaluación','en evaluacion',
        'inscripción en proceso','inscripcion en proceso','inscrito'
      )
      or exists (
        select 1
        from public.milhano_stage_events e
        cross join bounds b
        where e.ghl_opportunity_id=c.ghl_opportunity_id
          and e.is_valid=true
          and lower(trim(coalesce(e.to_stage,''))) in (
            'tour attended','pasadia booked','pasadía booked',
            'pasadia cancelled / no show - nurturing b',
            'pasadia attended','pasadía attended','closed/enrolled',
            'school tour atendido','pasadía agendada','pasadia agendada',
            'pasadía asistida','pasadia asistida',
            'retroalimentación','retroalimentacion','en evaluación','en evaluacion',
            'inscripción en proceso','inscripcion en proceso','inscrito'
          )
          and e.event_timestamp < b.evidence_end
      )
    ) as raw_tour_attended,

    (
      exists (
        select 1
        from public.milhano_ghl_appointments a
        cross join bounds b
        where (
          a.ghl_opportunity_id=c.ghl_opportunity_id
          or (
            a.ghl_opportunity_id is null
            and a.ghl_contact_id=c.ghl_contact_id
            and coalesce(a.date_added,a.start_time) >= c.lead_at - interval '5 minutes'
          )
        )
          and (a.appointment_type='trial_day' or a.calendar_id='a0bvCaXgCdVwSrgPELza')
          and coalesce(a.date_added,a.start_time) < b.evidence_end
      )
      or lower(trim(coalesce(c.current_stage,''))) in (
        'pasadia booked','pasadía booked',
        'pasadia cancelled / no show - nurturing b',
        'pasadia attended','pasadía attended','closed/enrolled',
        'pasadía agendada','pasadia agendada','pasadía asistida','pasadia asistida',
        'retroalimentación','retroalimentacion','en evaluación','en evaluacion',
        'inscripción en proceso','inscripcion en proceso','inscrito'
      )
      or exists (
        select 1
        from public.milhano_stage_events e
        cross join bounds b
        where e.ghl_opportunity_id=c.ghl_opportunity_id
          and e.is_valid=true
          and lower(trim(coalesce(e.to_stage,''))) in (
            'pasadia booked','pasadía booked',
            'pasadia cancelled / no show - nurturing b',
            'pasadia attended','pasadía attended','closed/enrolled',
            'pasadía agendada','pasadia agendada','pasadía asistida','pasadia asistida',
            'retroalimentación','retroalimentacion','en evaluación','en evaluacion',
            'inscripción en proceso','inscripcion en proceso','inscrito'
          )
          and e.event_timestamp < b.evidence_end
      )
    ) as raw_trial_booked,

    (
      exists (
        select 1
        from public.milhano_ghl_appointments a
        cross join bounds b
        where (
          a.ghl_opportunity_id=c.ghl_opportunity_id
          or (
            a.ghl_opportunity_id is null
            and a.ghl_contact_id=c.ghl_contact_id
            and coalesce(a.date_added,a.start_time) >= c.lead_at - interval '5 minutes'
          )
        )
          and (a.appointment_type='trial_day' or a.calendar_id='a0bvCaXgCdVwSrgPELza')
          and a.start_time < b.evidence_end
          and lower(coalesce(a.appointment_status,'')) in ('showed','completed','show','attended')
      )
      or lower(trim(coalesce(c.current_stage,''))) in (
        'pasadia attended','pasadía attended','closed/enrolled',
        'pasadía asistida','pasadia asistida',
        'retroalimentación','retroalimentacion','en evaluación','en evaluacion',
        'inscripción en proceso','inscripcion en proceso','inscrito'
      )
      or exists (
        select 1
        from public.milhano_stage_events e
        cross join bounds b
        where e.ghl_opportunity_id=c.ghl_opportunity_id
          and e.is_valid=true
          and lower(trim(coalesce(e.to_stage,''))) in (
            'pasadia attended','pasadía attended','closed/enrolled',
            'pasadía asistida','pasadia asistida',
            'retroalimentación','retroalimentacion','en evaluación','en evaluacion',
            'inscripción en proceso','inscripcion en proceso','inscrito'
          )
          and e.event_timestamp < b.evidence_end
      )
    ) as raw_trial_attended,

    (
      lower(coalesce(c.status,''))='won'
      or lower(trim(coalesce(c.current_stage,''))) in ('closed/enrolled','inscrito')
      or exists (
        select 1
        from public.milhano_stage_events e
        cross join bounds b
        where e.ghl_opportunity_id=c.ghl_opportunity_id
          and e.is_valid=true
          and lower(trim(coalesce(e.to_stage,''))) in ('closed/enrolled','inscrito')
          and e.event_timestamp < b.evidence_end
      )
    ) as raw_closed
  from cohort c
)
select
  r.ghl_opportunity_id,
  r.ghl_contact_id,
  coalesce(
    nullif(trim(r.student_name),''),
    nullif(trim(r.contact_name),''),
    nullif(trim(r.opportunity_name),''),
    r.ghl_contact_id,
    'Lead sin identificar'
  ) as lead_name,
  r.contact_name,
  r.student_name,
  r.phone,
  r.email,
  r.source,
  r.operational_owner,
  r.current_pipeline_role,
  r.pipeline_name,
  r.current_stage,
  r.status as opportunity_status,
  r.lost_reason,
  r.lead_at,
  (r.raw_contacted or r.raw_responded or r.raw_meaningful or r.raw_qualified or r.raw_tour_booked or r.raw_tour_attended or r.raw_trial_booked or r.raw_trial_attended or r.raw_closed),
  (r.raw_responded or r.raw_meaningful or r.raw_qualified or r.raw_tour_booked or r.raw_tour_attended or r.raw_trial_booked or r.raw_trial_attended or r.raw_closed),
  (r.raw_meaningful or r.raw_qualified or r.raw_tour_booked or r.raw_tour_attended or r.raw_trial_booked or r.raw_trial_attended or r.raw_closed),
  (r.raw_qualified or r.raw_tour_booked or r.raw_tour_attended or r.raw_trial_booked or r.raw_trial_attended or r.raw_closed),
  (r.raw_tour_booked or r.raw_tour_attended or r.raw_trial_booked or r.raw_trial_attended or r.raw_closed),
  (r.raw_tour_attended or r.raw_trial_booked or r.raw_trial_attended or r.raw_closed),
  (r.raw_trial_booked or r.raw_trial_attended or r.raw_closed),
  (r.raw_trial_attended or r.raw_closed),
  r.raw_closed
from raw r;
$$;

create or replace function public.milhano_get_v2_metric_leads(
  p_metric_key text,
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
  f.pipeline_name,
  f.current_stage,
  f.opportunity_status,
  f.lost_reason,
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
order by f.lead_at desc,f.lead_name;
$$;

create or replace function public.milhano_get_admissions_v2_payload(p_start date,p_end date)
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
with bounds as (
  select
    greatest(p_start,date '2026-09-01') as effective_start,
    p_end as effective_end,
    (now() at time zone 'America/Merida')::date as local_today
),
flags as (
  select * from public.milhano_get_v2_cohort_flags(p_start,p_end)
),
counts as (
  select
    count(*)::bigint as new_leads,
    count(*) filter(where reached_contacted)::bigint as contacted,
    count(*) filter(where reached_responded)::bigint as responded,
    count(*) filter(where reached_meaningful)::bigint as meaningful,
    count(*) filter(where reached_qualified)::bigint as qualified,
    count(*) filter(where reached_tour_booked)::bigint as tour_booked,
    count(*) filter(where reached_tour_attended)::bigint as tour_attended,
    count(*) filter(where reached_trial_booked)::bigint as trial_booked,
    count(*) filter(where reached_trial_attended)::bigint as trial_attended,
    count(*) filter(where reached_closed)::bigint as closed
  from flags
),
setter_counts as (
  select
    count(*)::bigint as new_leads,
    count(*) filter(where reached_contacted)::bigint as contacted,
    count(*) filter(where reached_responded)::bigint as responded,
    count(*) filter(where reached_meaningful)::bigint as meaningful,
    count(*) filter(where reached_qualified)::bigint as qualified
  from flags
  where current_pipeline_role='setter'
),
closer_counts as (
  select
    count(*) filter(where reached_tour_booked)::bigint as tour_booked,
    count(*) filter(where reached_tour_attended)::bigint as tour_attended,
    count(*) filter(where reached_trial_booked)::bigint as trial_booked,
    count(*) filter(where reached_trial_attended)::bigint as trial_attended,
    count(*) filter(where reached_closed)::bigint as closed
  from flags
  where current_pipeline_role='closer'
),
inventory as (
  select
    count(*)::bigint as total_opportunities,
    count(*) filter(where f.current_pipeline_role='legacy')::bigint as legacy_opportunities,
    count(*) filter(where f.current_pipeline_role='setter')::bigint as setter_opportunities,
    count(*) filter(where f.current_pipeline_role='closer')::bigint as closer_opportunities,
    count(*) filter(where lower(coalesce(f.opportunity_status,''))='open')::bigint as open_opportunities,
    count(*) filter(
      where not exists(
        select 1
        from public.milhano_v2_stage_map m
        join public.milhano_opportunities o
          on o.ghl_opportunity_id=f.ghl_opportunity_id
        where m.pipeline_id=o.pipeline_id
          and (
            (m.stage_id is not null and m.stage_id=o.pipeline_stage_id)
            or m.stage_name=o.current_stage
          )
      )
    )::bigint as unmapped_stage_opportunities
  from flags f
),
setter_current as (
  select
    m.stage_name,m.canonical_key,m.display_order,m.stage_group,
    count(f.ghl_opportunity_id)::bigint as opportunity_count,
    count(f.ghl_opportunity_id) filter(where lower(coalesce(f.opportunity_status,''))='open')::bigint as open_count
  from public.milhano_v2_stage_map m
  left join public.milhano_opportunities o
    on o.pipeline_id=m.pipeline_id
   and (o.pipeline_stage_id=m.stage_id or o.current_stage=m.stage_name)
  left join flags f on f.ghl_opportunity_id=o.ghl_opportunity_id
  where m.pipeline_role='setter'
  group by m.stage_name,m.canonical_key,m.display_order,m.stage_group
  order by m.display_order
),
closer_current as (
  select
    m.stage_name,m.canonical_key,m.display_order,m.stage_group,
    count(f.ghl_opportunity_id)::bigint as opportunity_count,
    count(f.ghl_opportunity_id) filter(where lower(coalesce(f.opportunity_status,''))='open')::bigint as open_count
  from public.milhano_v2_stage_map m
  left join public.milhano_opportunities o
    on o.pipeline_id=m.pipeline_id
   and (o.pipeline_stage_id=m.stage_id or o.current_stage=m.stage_name)
  left join flags f on f.ghl_opportunity_id=o.ghl_opportunity_id
  where m.pipeline_role='closer'
  group by m.stage_name,m.canonical_key,m.display_order,m.stage_group
  order by m.display_order
),
today as (
  select
    count(distinct coalesce(a.ghl_opportunity_id,a.ghl_contact_id,a.appointment_id)) filter(
      where a.appointment_type='school_tour'
        and (a.start_time at time zone 'America/Merida')::date=b.local_today
        and lower(coalesce(a.appointment_status,'unknown')) not in ('cancelled','canceled','invalid')
    )::bigint as school_tours_today,
    count(distinct coalesce(a.ghl_opportunity_id,a.ghl_contact_id,a.appointment_id)) filter(
      where (a.appointment_type='trial_day' or a.calendar_id='a0bvCaXgCdVwSrgPELza')
        and (a.start_time at time zone 'America/Merida')::date=b.local_today
        and lower(coalesce(a.appointment_status,'unknown')) not in ('cancelled','canceled','invalid')
    )::bigint as trial_days_today
  from public.milhano_ghl_appointments a
  cross join bounds b
),
manual as (
  select
    coalesce(sum(mv.declared_value) filter(where mv.metric_key='new_leads_received'),0)::bigint as new_leads,
    coalesce(sum(mv.declared_value) filter(where mv.metric_key='contacted_reported'),0)::bigint as contacted,
    coalesce(sum(mv.declared_value) filter(where mv.metric_key='responses_reported'),0)::bigint as responded,
    coalesce(sum(mv.declared_value) filter(where mv.metric_key='meaningful_conversations_reported'),0)::bigint as meaningful,
    coalesce(sum(mv.declared_value) filter(where mv.metric_key='qualified_leads'),0)::bigint as qualified,
    coalesce(sum(mv.declared_value) filter(where mv.metric_key='school_tours_scheduled'),0)::bigint as tour_booked,
    coalesce(sum(mv.declared_value) filter(where mv.metric_key='school_tours_attended'),0)::bigint as tour_attended,
    coalesce(sum(mv.declared_value) filter(where mv.metric_key='trial_days_booked'),0)::bigint as trial_booked,
    coalesce(sum(mv.declared_value) filter(where mv.metric_key='trial_days_showed'),0)::bigint as trial_attended,
    coalesce(sum(mv.declared_value) filter(where mv.metric_key='closed_leads'),0)::bigint as closed,
    count(distinct s.eod_date) filter(where s.status in ('submitted','validated'))::bigint as reported_days
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
  where pipeline_role in ('legacy','setter','closer')
),
pipeline_meta as (
  select
    max(pipeline_id) filter(where pipeline_role='legacy' and is_active) as legacy_pipeline_id,
    max(pipeline_id) filter(where pipeline_role='setter' and is_active) as setter_pipeline_id,
    max(pipeline_id) filter(where pipeline_role='closer' and is_active) as closer_pipeline_id
  from public.milhano_admissions_pipeline_registry
)
select jsonb_build_object(
  'meta',jsonb_build_object(
    'version','Admissions V19 · GHL Truth',
    'cutover_date','2026-09-01',
    'effective_start',(select effective_start from bounds),
    'effective_end',(select effective_end from bounds),
    'legacy_pipeline_id',(select legacy_pipeline_id from pipeline_meta),
    'setter_pipeline_id',(select setter_pipeline_id from pipeline_meta),
    'closer_pipeline_id',(select closer_pipeline_id from pipeline_meta),
    'pasadia_calendar_id','a0bvCaXgCdVwSrgPELza'
  ),
  'inventory',(select to_jsonb(i) from inventory i),
  'general',jsonb_build_array(
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
  'setter',jsonb_build_object(
    'owner','Paty',
    'pipeline_id',(select setter_pipeline_id from pipeline_meta),
    'funnel',jsonb_build_array(
      jsonb_build_object('metric_key','new_leads','label','New Leads','value',(select new_leads from setter_counts)),
      jsonb_build_object('metric_key','unique_contacted_leads','label','Contacted','value',(select contacted from setter_counts)),
      jsonb_build_object('metric_key','responded_leads','label','Responded','value',(select responded from setter_counts)),
      jsonb_build_object('metric_key','meaningful_conversations','label','Meaningful','value',(select meaningful from setter_counts)),
      jsonb_build_object('metric_key','qualified_leads','label','Qualified','value',(select qualified from setter_counts))
    ),
    'current_stages',coalesce((select jsonb_agg(to_jsonb(s) order by s.display_order) from setter_current s),'[]'::jsonb)
  ),
  'closer',jsonb_build_object(
    'owner','Cinthia Esquivel',
    'pipeline_id',(select closer_pipeline_id from pipeline_meta),
    'funnel',jsonb_build_array(
      jsonb_build_object('metric_key','school_tours_booked','label','Tour Booked','value',(select tour_booked from closer_counts)),
      jsonb_build_object('metric_key','school_tours_attended','label','Tour Attended','value',(select tour_attended from closer_counts)),
      jsonb_build_object('metric_key','trial_days_booked','label','Pasadía Booked','value',(select trial_booked from closer_counts)),
      jsonb_build_object('metric_key','trial_days_showed','label','Pasadía Attended','value',(select trial_attended from closer_counts)),
      jsonb_build_object('metric_key','closed','label','Closed','value',(select closed from closer_counts))
    ),
    'current_stages',coalesce((select jsonb_agg(to_jsonb(s) order by s.display_order) from closer_current s),'[]'::jsonb)
  ),
  'today',(select to_jsonb(t) from today t),
  'manual',(select to_jsonb(m) from manual m),
  'stage_map',(select to_jsonb(h) from stage_map_health h),
  'health',coalesce((select jsonb_agg(to_jsonb(h)) from public.vw_milhano_system_health h),'[]'::jsonb),
  'quality',coalesce((select jsonb_agg(to_jsonb(q)) from public.vw_milhano_data_quality q),'[]'::jsonb)
);
$$;

-- Fast lead detail: one DB round-trip for the interactive page.
create or replace function public.milhano_get_admissions_lead_detail_v19(p_opportunity_id text)
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
with opp as (
  select
    o.ghl_opportunity_id,o.ghl_contact_id,o.opportunity_name,o.contact_name,
    o.student_name,o.phone,o.email,o.source,o.pipeline_id,o.pipeline_name,
    o.pipeline_stage_id,o.current_stage,o.status,o.assigned_user,o.assigned_user_id,
    o.grade_interest,o.level,o.priority,o.created_at,o.updated_at,o.pipeline_updated_at,
    o.lost_reason,o.ghl_lost_reason_id,o.historical_comments,o.last_truth_synced_at
  from public.milhano_opportunities o
  where o.ghl_opportunity_id=p_opportunity_id
),
appointments as (
  select coalesce(jsonb_agg(to_jsonb(x) order by x.start_time desc nulls last),'[]'::jsonb) as rows
  from (
    select
      a.appointment_id,a.appointment_type,a.calendar_id,a.calendar_name,
      a.title,a.appointment_status,a.date_added,a.date_updated,
      a.start_time,a.end_time,a.address,a.notes
    from public.milhano_ghl_appointments a
    join opp o on (
      a.ghl_opportunity_id=o.ghl_opportunity_id
      or (
        a.ghl_opportunity_id is null
        and a.ghl_contact_id=o.ghl_contact_id
        and coalesce(a.date_added,a.start_time) >= o.created_at - interval '5 minutes'
      )
    )
    order by a.start_time desc nulls last
    limit 24
  ) x
),
stages as (
  select coalesce(jsonb_agg(to_jsonb(x) order by x.event_timestamp desc),'[]'::jsonb) as rows
  from (
    select
      e.event_id,e.from_stage,e.to_stage,e.event_timestamp,e.event_source,e.note
    from public.milhano_stage_events e
    where e.ghl_opportunity_id=p_opportunity_id
      and e.is_valid=true
    order by e.event_timestamp desc
    limit 60
  ) x
),
activity as (
  select coalesce(jsonb_agg(to_jsonb(x) order by x.event_timestamp desc),'[]'::jsonb) as rows
  from (
    select
      c.event_id,c.channel,c.direction,c.message_type,c.delivery_status,
      c.call_status,c.call_duration_seconds,c.is_connected_raw,
      c.is_meaningful_conversation,c.is_meaningful_whatsapp,
      c.event_timestamp
    from public.milhano_communication_events c
    join opp o on (
      c.ghl_opportunity_id=o.ghl_opportunity_id
      or (
        c.ghl_opportunity_id is null
        and c.ghl_contact_id=o.ghl_contact_id
        and c.event_timestamp >= o.created_at - interval '5 minutes'
      )
    )
    order by c.event_timestamp desc
    limit 60
  ) x
)
select case when exists(select 1 from opp) then jsonb_build_object(
  'opportunity',(select to_jsonb(o) from opp o),
  'appointments',(select rows from appointments),
  'stage_events',(select rows from stages),
  'recent_activity',(select rows from activity)
) else null end;
$$;

revoke all on function public.milhano_get_v2_cohort_flags(date,date) from public,anon,authenticated;
revoke all on function public.milhano_get_v2_metric_leads(text,date,date) from public,anon,authenticated;
revoke all on function public.milhano_get_admissions_v2_payload(date,date) from public,anon,authenticated;
revoke all on function public.milhano_get_admissions_lead_detail_v19(text) from public,anon,authenticated;

grant execute on function public.milhano_get_v2_cohort_flags(date,date) to service_role;
grant execute on function public.milhano_get_v2_metric_leads(text,date,date) to service_role;
grant execute on function public.milhano_get_admissions_v2_payload(date,date) to service_role;
grant execute on function public.milhano_get_admissions_lead_detail_v19(text) to service_role;
