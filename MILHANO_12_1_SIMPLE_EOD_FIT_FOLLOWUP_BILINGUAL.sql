-- ============================================================
-- MILHANO | V12.1 | SIMPLE EOD + FIT/QUALIFIED ALIAS + FOLLOW-UP SPLIT
-- Date: 2026-08-13
--
-- Goals
-- 1) Keep Qualified and Fit as ONE milestone. GHL stage remains Fit.
-- 2) Display the milestone as Qualified / Fit in the dashboard/EOD.
-- 3) Split current follow-up semantics into No responde vs Seguimiento,
--    while preserving the legacy combined stage for historical data.
-- 4) Keep the advisor EOD simple and non-blocking.
-- 5) Keep Ads/Organic as reported attribution instead of inferring
--    them from ambiguous raw Source values such as Facebook/Instagram.
-- 6) Preserve bilingual dashboard support and MonaCashflow in English.
-- 7) Preserve V11 reconciliation and manual-extra auditability.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 0. Keep V11.1 Mona username support self-contained
-- ------------------------------------------------------------
alter table public.milhano_app_users
    add column if not exists username text;

create unique index if not exists uq_milhano_app_users_username
on public.milhano_app_users (username)
where username is not null;

insert into public.milhano_app_users (
    id, display_name, email, username, role, is_active
)
select
    gen_random_uuid(),
    'Mona Al Idrissi',
    'mona@coldem.edu.mx',
    'MonaCashflow',
    'admin',
    true
where not exists (
    select 1 from public.milhano_app_users
    where lower(coalesce(email, '')) = 'mona@coldem.edu.mx'
       or lower(coalesce(username, '')) = 'monacashflow'
);

update public.milhano_app_users
set username = 'MonaCashflow',
    role = 'admin',
    is_active = true,
    updated_at = now()
where lower(coalesce(email, '')) = 'mona@coldem.edu.mx'
   or lower(coalesce(username, '')) = 'monacashflow';

update public.milhano_app_users app
set auth_user_id = auth_user.id,
    updated_at = now()
from auth.users auth_user
where lower(auth_user.email) = lower(app.email)
  and lower(coalesce(app.email, '')) = 'mona@coldem.edu.mx'
  and app.auth_user_id is distinct from auth_user.id;

-- ------------------------------------------------------------
-- A. Pipeline stage model
-- ------------------------------------------------------------
-- IMPORTANT:
-- Qualified and Fit are the SAME business milestone.
-- Do NOT create a separate Qualified stage in GHL.
--
-- Preferred current GHL flow around early-stage handling:
-- Cliente potencial
-- -> No responde       (attempted, no reply yet; still active)
-- -> Seguimiento       (known future contact/callback action; still active)
-- -> No fit / Lost     (only when the outcome is actually decided)
-- -> Fit               (shown in dashboard as Qualified / Fit)
-- -> School Tour agendado ...
--
-- The old 'No responde / Seguimiento' row remains recognized as legacy
-- so history is not destroyed while current cards are reclassified.
insert into public.milhano_pipeline_stage_rules (
    stage_name,
    positive_order,
    stage_type,
    eod_metric_key,
    is_active
)
values
    ('Cliente potencial',          1,    'entry',    'new_leads_received', true),
    ('No responde',                null, 'followup', null, true),
    ('Seguimiento',                null, 'followup', null, true),
    ('No responde / Seguimiento',  null, 'followup', null, true),
    ('No fit',                     null, 'exit',     'no_fit', true),
    ('Lost / Sin continuidad',     null, 'exit',     'lost', true),
    ('Fit',                        2,    'positive', 'qualified_leads', true),
    ('School Tour agendado',       3,    'positive', 'school_tours_scheduled', true),
    ('School Tour atendido',       4,    'positive', 'school_tours_attended', true),
    ('Pasadía agendada',           5,    'positive', 'passdays_scheduled', true),
    ('Pasadía asistida',           6,    'positive', 'passdays_attended', true),
    ('Retroalimentación',          7,    'positive', 'feedback', true),
    ('En evaluación',              8,    'positive', 'evaluation', true),
    ('Inscripción en proceso',     9,    'positive', 'enrollment_process', true),
    ('Inscrito',                  10,    'result',   'enrolled', true)
on conflict (stage_name)
do update set
    positive_order = excluded.positive_order,
    stage_type = excluded.stage_type,
    eod_metric_key = excluded.eod_metric_key,
    is_active = excluded.is_active;

-- If V12 was already executed, retire its accidental separate Qualified rule.
update public.milhano_pipeline_stage_rules
set is_active = false,
    eod_metric_key = null
where stage_name = 'Qualified';

-- Keep the analytical current-stage catalog aligned with the new terminology.
create or replace view public.vw_milhano_stage_catalog
with (security_invoker = true)
as
select *
from (
    values
        ('Cliente potencial',              1,  'Entrada',      true),
        ('No responde',                    2,  'Seguimiento',  false),
        ('Seguimiento',                    3,  'Seguimiento',  false),
        ('No responde / Seguimiento',      4,  'Legacy',       false),
        ('No fit',                         5,  'Salida',       false),
        ('Lost / Sin continuidad',         6,  'Salida',       false),
        ('Fit',                            7,  'Hito',         true),
        ('School Tour agendado',           8,  'Hito',         true),
        ('School Tour atendido',           9,  'Hito',         true),
        ('Pasadía agendada',              10,  'Hito',         true),
        ('Pasadía asistida',              11,  'Hito',         true),
        ('Retroalimentación',             12,  'Hito',         true),
        ('En evaluación',                 13,  'Hito',         true),
        ('Inscripción en proceso',        14,  'Hito',         true),
        ('Inscrito',                      15,  'Resultado',     true)
) as stages(stage_name, display_order, stage_group, is_positive_milestone);

-- ------------------------------------------------------------
-- A2. Compatibility views for the split follow-up stages
-- ------------------------------------------------------------
-- First human touch must recognize both canonical follow-up stages as well
-- as the historical combined label.
create or replace view public.vw_milhano_first_human_touch
with (security_invoker = true)
as
with touch_candidates as (
    select
        coalesce(c.ghl_opportunity_id, o.ghl_opportunity_id)
            as ghl_opportunity_id,
        c.ghl_contact_id,
        c.ghl_user_id as attributed_ghl_user_id,
        c.event_timestamp,
        'communication'::text as touch_source,
        c.event_id as source_event_id
    from public.milhano_communication_events c
    left join lateral (
        select mo.ghl_opportunity_id
        from public.milhano_opportunities mo
        where mo.ghl_contact_id = c.ghl_contact_id
        order by mo.created_at desc nulls last
        limit 1
    ) o on true
    where
        c.direction = 'outbound'
        and c.is_automated = false
        and c.ghl_user_id is not null
        and (
            lower(c.channel) = 'call'
            or (
                lower(c.channel) = 'whatsapp'
                and lower(coalesce(c.delivery_status, ''))
                    in ('delivered', 'read')
            )
        )

    union all

    select
        e.ghl_opportunity_id,
        e.ghl_contact_id,
        e.attributed_ghl_user_id,
        e.event_timestamp,
        'stage_advance'::text,
        e.event_id
    from public.vw_milhano_positive_stage_advances e
    where
        e.attributed_ghl_user_id is not null
        and e.from_stage in (
            'Cliente potencial',
            'No responde',
            'Seguimiento',
            'No responde / Seguimiento'
        )
),
ranked as (
    select
        tc.*,
        row_number() over (
            partition by tc.ghl_opportunity_id
            order by tc.event_timestamp, tc.source_event_id
        ) as touch_rank
    from touch_candidates tc
    where tc.ghl_opportunity_id is not null
)
select *
from ranked
where touch_rank = 1;

-- Keep call outcome analytics semantically correct after the stage split.
create or replace view public.vw_milhano_call_outcome_bridge
with (security_invoker = true)
as
select
    c.event_id,
    c.ghl_message_id,
    c.ghl_contact_id,
    c.ghl_opportunity_id,
    c.ghl_user_id,
    c.direction,
    c.call_status,
    c.call_duration_seconds,
    c.is_connected_raw,
    c.is_meaningful_conversation,
    c.call_disposition,
    c.event_timestamp as call_timestamp,
    next_stage.from_stage,
    next_stage.to_stage,
    next_stage.event_timestamp as stage_event_timestamp,
    case
        when c.call_disposition is not null
            then 'disposition:' || c.call_disposition
        when next_stage.to_stage = 'Fit'
            then 'fit'
        when next_stage.to_stage = 'No fit'
            then 'no_fit'
        when next_stage.to_stage in (
            'School Tour agendado',
            'School Tour atendido'
        )
            then 'school_tour'
        when next_stage.to_stage in (
            'Pasadía agendada',
            'Pasadía asistida'
        )
            then 'pasadia'
        when next_stage.to_stage in (
            'No responde',
            'Seguimiento',
            'No responde / Seguimiento'
        )
            then 'follow_up_or_indecision'
        when next_stage.to_stage = 'Lost / Sin continuidad'
            then 'lost'
        when next_stage.to_stage in (
            'Retroalimentación',
            'En evaluación'
        )
            then 'evaluation'
        when next_stage.to_stage in (
            'Inscripción en proceso',
            'Inscrito'
        )
            then 'enrollment'
        when next_stage.to_stage is not null
            then 'other_stage_change'
        else 'no_stage_change_within_24h'
    end as observed_outcome_24h,
    case
        when c.call_disposition is not null
            then 'ghl_disposition'
        when next_stage.to_stage is not null
            then 'pipeline_stage_after_call'
        else 'none'
    end as outcome_source
from public.milhano_communication_events c
left join lateral (
    select
        se.from_stage,
        se.to_stage,
        se.event_timestamp
    from public.milhano_stage_events se
    where se.ghl_opportunity_id = c.ghl_opportunity_id
      and se.event_timestamp >= c.event_timestamp
      and se.event_timestamp < c.event_timestamp + interval '24 hours'
      and coalesce(se.is_valid, true)
    order by se.event_timestamp
    limit 1
) next_stage on true
where lower(c.channel) = 'call'
  and c.is_call_attempt;

-- Daily follow-up KPI now counts entry into either canonical follow-up stage,
-- while retaining historical combined-stage events.
create or replace view public.vw_milhano_daily_kpis
with (security_invoker = true)
as
with event_days as (
    select
        (e.event_timestamp at time zone 'America/Merida')::date as metric_date,
        count(distinct e.ghl_opportunity_id)
            filter (where e.to_stage = 'Cliente potencial') as new_leads,
        count(distinct e.ghl_opportunity_id)
            filter (where e.to_stage in (
                'No responde',
                'Seguimiento',
                'No responde / Seguimiento'
            )) as entered_followup,
        count(distinct e.ghl_opportunity_id)
            filter (where e.to_stage = 'Fit') as fits,
        count(distinct e.ghl_opportunity_id)
            filter (where e.to_stage = 'School Tour agendado') as tours_scheduled,
        count(distinct e.ghl_opportunity_id)
            filter (where e.to_stage = 'School Tour atendido') as tours_attended,
        count(distinct e.ghl_opportunity_id)
            filter (where e.to_stage = 'Pasadía agendada') as passdays_scheduled,
        count(distinct e.ghl_opportunity_id)
            filter (where e.to_stage = 'Pasadía asistida') as passdays_attended,
        count(distinct e.ghl_opportunity_id)
            filter (where e.to_stage = 'Retroalimentación') as feedbacks,
        count(distinct e.ghl_opportunity_id)
            filter (where e.to_stage = 'En evaluación') as evaluations,
        count(distinct e.ghl_opportunity_id)
            filter (where e.to_stage = 'Inscripción en proceso') as enrollment_process_started,
        count(distinct e.ghl_opportunity_id)
            filter (where e.to_stage = 'Inscrito') as enrolled,
        count(distinct e.ghl_opportunity_id)
            filter (where e.to_stage = 'No fit') as no_fit,
        count(distinct e.ghl_opportunity_id)
            filter (where e.to_stage = 'Lost / Sin continuidad') as lost
    from public.milhano_stage_events e
    where e.is_valid = true
    group by (e.event_timestamp at time zone 'America/Merida')::date
),
call_days as (
    select
        (c.activity_timestamp at time zone 'America/Merida')::date as metric_date,
        count(*) as calls,
        count(distinct c.ghl_opportunity_id) as opportunities_called
    from public.milhano_call_events c
    group by (c.activity_timestamp at time zone 'America/Merida')::date
),
bounds as (
    select
        least(
            coalesce((select min(metric_date) from event_days), current_date),
            coalesce((select min(metric_date) from call_days), current_date)
        ) as min_date,
        greatest(
            coalesce((select max(metric_date) from event_days), current_date),
            coalesce((select max(metric_date) from call_days), current_date),
            current_date
        ) as max_date
),
calendar as (
    select generate_series(
        (select min_date from bounds),
        (select max_date from bounds),
        interval '1 day'
    )::date as metric_date
)
select
    cal.metric_date,
    coalesce(ed.new_leads, 0) as new_leads,
    coalesce(ed.entered_followup, 0) as entered_followup,
    coalesce(ed.fits, 0) as fits,
    coalesce(ed.tours_scheduled, 0) as tours_scheduled,
    coalesce(ed.tours_attended, 0) as tours_attended,
    coalesce(ed.passdays_scheduled, 0) as passdays_scheduled,
    coalesce(ed.passdays_attended, 0) as passdays_attended,
    coalesce(ed.feedbacks, 0) as feedbacks,
    coalesce(ed.evaluations, 0) as evaluations,
    coalesce(ed.enrollment_process_started, 0) as enrollment_process_started,
    coalesce(ed.enrolled, 0) as enrolled,
    coalesce(ed.no_fit, 0) as no_fit,
    coalesce(ed.lost, 0) as lost,
    coalesce(cd.calls, 0) as calls,
    coalesce(cd.opportunities_called, 0) as opportunities_called
from calendar cal
left join event_days ed on ed.metric_date = cal.metric_date
left join call_days cd on cd.metric_date = cal.metric_date
order by cal.metric_date;

-- ------------------------------------------------------------
-- B. Canonical qualification event = Fit
-- ------------------------------------------------------------
-- Qualified == Fit in Milhano. A lead counts as qualified when a valid
-- stage event enters Fit. We intentionally DO NOT infer qualification
-- from later stages; skipping Fit is a process/data-quality gap worth seeing.
create or replace view public.vw_milhano_qualification_events
with (security_invoker = true)
as
with ranked as (
    select
        e.event_id,
        e.ghl_opportunity_id,
        e.ghl_contact_id,
        e.attributed_ghl_user_id,
        e.attributed_app_user_id,
        e.event_timestamp as qualified_at,
        e.to_stage as evidence_stage,
        'fit'::text as qualification_source,
        row_number() over (
            partition by e.ghl_opportunity_id
            order by e.event_timestamp, e.event_id
        ) as rn
    from public.milhano_stage_events e
    where e.is_valid = true
      and e.to_stage = 'Fit'
      and e.ghl_opportunity_id is not null
)
select
    event_id,
    ghl_opportunity_id,
    ghl_contact_id,
    attributed_ghl_user_id,
    attributed_app_user_id,
    qualified_at,
    evidence_stage,
    qualification_source
from ranked
where rn = 1;

-- ------------------------------------------------------------
-- C. Rebuild operational activity with Qualified / Fit
-- ------------------------------------------------------------
create or replace view public.vw_milhano_operational_cascade_activity
with (security_invoker = true)
as
select
    'new_leads'::text as metric_key,
    coalesce(o.original_lead_date, o.created_at) as activity_at,
    o.ghl_opportunity_id,
    o.ghl_contact_id,
    ('lead:' || o.ghl_opportunity_id)::text as activity_id
from public.milhano_opportunities o
where coalesce(o.original_lead_date, o.created_at) is not null

union all
select
    'number_of_dials',
    c.event_timestamp,
    coalesce(c.ghl_opportunity_id, mapped.ghl_opportunity_id),
    c.ghl_contact_id,
    c.event_id
from public.milhano_communication_events c
left join lateral (
    select o.ghl_opportunity_id
    from public.milhano_opportunities o
    where o.ghl_contact_id = c.ghl_contact_id
    order by o.updated_at desc nulls last
    limit 1
) mapped on true
where lower(c.channel) = 'call'
  and c.is_call_attempt = true
  and c.direction = 'outbound'

union all
select
    'answered_calls',
    c.event_timestamp,
    coalesce(c.ghl_opportunity_id, mapped.ghl_opportunity_id),
    c.ghl_contact_id,
    c.event_id
from public.milhano_communication_events c
left join lateral (
    select o.ghl_opportunity_id
    from public.milhano_opportunities o
    where o.ghl_contact_id = c.ghl_contact_id
    order by o.updated_at desc nulls last
    limit 1
) mapped on true
where lower(c.channel) = 'call'
  and c.is_call_attempt = true
  and c.direction = 'outbound'
  and c.is_connected_raw = true

union all
select
    'unique_contacted_leads',
    c.event_timestamp,
    coalesce(c.ghl_opportunity_id, mapped.ghl_opportunity_id),
    c.ghl_contact_id,
    c.event_id
from public.milhano_communication_events c
left join lateral (
    select o.ghl_opportunity_id
    from public.milhano_opportunities o
    where o.ghl_contact_id = c.ghl_contact_id
    order by o.updated_at desc nulls last
    limit 1
) mapped on true
where lower(c.channel) = 'call'
  and c.is_call_attempt = true
  and c.direction = 'outbound'
  and c.is_connected_raw = true

union all
select
    'meaningful_conversations',
    c.event_timestamp,
    coalesce(c.ghl_opportunity_id, mapped.ghl_opportunity_id),
    c.ghl_contact_id,
    c.event_id
from public.milhano_communication_events c
left join lateral (
    select o.ghl_opportunity_id
    from public.milhano_opportunities o
    where o.ghl_contact_id = c.ghl_contact_id
    order by o.updated_at desc nulls last
    limit 1
) mapped on true
where lower(c.channel) = 'call'
  and c.is_call_attempt = true
  and c.direction = 'outbound'
  and c.is_meaningful_conversation = true

union all
select
    'qualified_leads',
    q.qualified_at,
    q.ghl_opportunity_id,
    q.ghl_contact_id,
    q.event_id
from public.vw_milhano_qualification_events q

union all
select
    'school_tours_booked',
    e.event_timestamp,
    e.ghl_opportunity_id,
    e.ghl_contact_id,
    e.event_id
from public.milhano_stage_events e
where e.is_valid = true
  and e.to_stage = 'School Tour agendado'

union all
select
    'school_tours_today',
    d.scheduled_for,
    d.ghl_opportunity_id,
    o.ghl_contact_id,
    ('tour-today:' || d.ghl_opportunity_id)
from public.milhano_school_tour_details d
join public.milhano_opportunities o
    on o.ghl_opportunity_id = d.ghl_opportunity_id
where d.scheduled_for is not null
  and d.attendance_status <> 'cancelled'

union all
select
    'school_tours_attended',
    e.event_timestamp,
    e.ghl_opportunity_id,
    e.ghl_contact_id,
    e.event_id
from public.milhano_stage_events e
where e.is_valid = true
  and e.to_stage = 'School Tour atendido'

union all
select
    'school_tours_attended',
    d.attended_at,
    d.ghl_opportunity_id,
    o.ghl_contact_id,
    ('tour-showed:' || d.ghl_opportunity_id)
from public.milhano_school_tour_details d
join public.milhano_opportunities o
    on o.ghl_opportunity_id = d.ghl_opportunity_id
where d.attendance_status = 'showed'
  and d.attended_at is not null
  and not exists (
      select 1
      from public.milhano_stage_events e
      where e.is_valid = true
        and e.ghl_opportunity_id = d.ghl_opportunity_id
        and e.to_stage = 'School Tour atendido'
  )

union all
select
    'trial_days_booked',
    e.event_timestamp,
    e.ghl_opportunity_id,
    e.ghl_contact_id,
    e.event_id
from public.milhano_stage_events e
where e.is_valid = true
  and e.to_stage = 'Pasadía agendada'

union all
select
    'trial_days_showed',
    e.event_timestamp,
    e.ghl_opportunity_id,
    e.ghl_contact_id,
    e.event_id
from public.milhano_stage_events e
where e.is_valid = true
  and e.to_stage = 'Pasadía asistida'

union all
select
    'closed',
    e.event_timestamp,
    e.ghl_opportunity_id,
    e.ghl_contact_id,
    e.event_id
from public.milhano_stage_events e
where e.is_valid = true
  and e.to_stage = 'Inscrito';

-- Update reconciliation definitions/mappings.
update public.milhano_reconciliation_metric_catalog
set
    definition = 'System = first valid entry into GHL stage Fit. Qualified and Fit are the same Milhano milestone; there is no separate Qualified stage.',
    updated_at = now()
where metric_key = 'qualified_leads';

update public.milhano_reconciliation_metric_catalog
set
    eod_metric_key = 'ads_leads_reported',
    definition = 'Reported paid-ad leads. Raw Facebook/Instagram Source values are not automatically classified as Ads.',
    updated_at = now()
where metric_key = 'ads_leads';

update public.milhano_reconciliation_metric_catalog
set
    eod_metric_key = 'organic_leads_reported',
    definition = 'Reported organic leads. Kept separate from raw GHL Source values.',
    updated_at = now()
where metric_key = 'organic_leads';

insert into public.milhano_reconciliation_metric_catalog (
    metric_key,
    label,
    display_order,
    metric_scope,
    eod_metric_key,
    show_in_cascade,
    supports_manual_extra,
    definition,
    is_active
)
values
    ('contacted_reported', 'Contact Attempts', 104, 'manual_only', 'contacted_reported', false, false,
     'Advisor-reported outbound contact attempts across channels. This is not a unique-lead system metric.', true),
    ('responses_reported', 'Responses', 105, 'manual_only', 'responses_reported', false, false,
     'Advisor-reported unique leads who replied or answered at least once, regardless of channel.', true)
on conflict (metric_key)
do update set
    label = excluded.label,
    display_order = excluded.display_order,
    metric_scope = excluded.metric_scope,
    eod_metric_key = excluded.eod_metric_key,
    show_in_cascade = excluded.show_in_cascade,
    supports_manual_extra = excluded.supports_manual_extra,
    definition = excluded.definition,
    is_active = true,
    updated_at = now();

-- ------------------------------------------------------------
-- D. Simple advisor EOD catalog
-- ------------------------------------------------------------
-- Keep historical catalog rows, but only these eight are active in
-- the advisor-facing EOD form.
update public.milhano_eod_metric_catalog
set is_active = false;

insert into public.milhano_eod_metric_catalog (
    metric_key,
    label,
    description,
    display_order,
    is_system_only,
    requires_user_confirmation,
    blocks_submission_on_mismatch,
    is_active
)
values
    ('new_leads_received', 'Total Leads',
     'Total new leads received in the EOD window. System reference = new GHL opportunities assigned to the advisor.',
     1, false, true, false, true),
    ('ads_leads_reported', 'Ads Leads',
     'Advisor-reported paid-ad leads. Do not infer Ads solely from Facebook/Instagram Source.',
     2, false, true, false, true),
    ('organic_leads_reported', 'Organic Leads',
     'Advisor-reported organic/non-paid leads.',
     3, false, true, false, true),
    ('contacted_reported', 'Contacted',
     'Outbound contact attempts across channels. A call plus a WhatsApp to the same lead can count as two attempts.',
     4, false, true, false, true),
    ('responses_reported', 'Responses',
     'Unique leads who replied or answered at least once during the EOD window, regardless of channel.',
     5, false, true, false, true),
    ('qualified_leads', 'Qualified / Fit',
     'Unique leads entering GHL stage Fit during the EOD window. Qualified and Fit are the same Milhano milestone.',
     6, false, true, false, true),
    ('school_tours_scheduled', 'ST Booked',
     'Unique leads entering School Tour agendado during the EOD window.',
     7, false, true, false, true),
    ('school_tours_attended', 'ST Attended',
     'Unique leads entering School Tour atendido during the EOD window.',
     8, false, true, false, true)
on conflict (metric_key)
do update set
    label = excluded.label,
    description = excluded.description,
    display_order = excluded.display_order,
    is_system_only = excluded.is_system_only,
    requires_user_confirmation = excluded.requires_user_confirmation,
    blocks_submission_on_mismatch = false,
    is_active = true;

-- ------------------------------------------------------------
-- E. EOD system calculation: Qualified / Fit = Fit
-- ------------------------------------------------------------
create or replace function public.milhano_calculate_eod_metrics(
    p_app_user_id uuid,
    p_eod_date date
)
returns table (
    metric_key text,
    system_value integer
)
language sql
stable
as $$
    with selected_user as (
        select ghl_user_id
        from public.milhano_app_users
        where id = p_app_user_id
          and is_active = true
    ),
    eod_window as (
        select *
        from public.milhano_get_eod_window(p_eod_date)
    ),
    calls as (
        select c.*
        from public.milhano_communication_events c
        cross join selected_user u
        cross join eod_window w
        where lower(c.channel) = 'call'
          and c.is_call_attempt = true
          and c.ghl_user_id = u.ghl_user_id
          and c.event_timestamp >= w.window_start
          and c.event_timestamp < w.window_end
    ),
    stage_events as (
        select e.*
        from public.milhano_stage_events e
        cross join selected_user u
        cross join eod_window w
        where e.attributed_ghl_user_id = u.ghl_user_id
          and e.event_timestamp >= w.window_start
          and e.event_timestamp < w.window_end
          and e.is_valid = true
    ),
    qualification_events as (
        select q.*
        from public.vw_milhano_qualification_events q
        cross join selected_user u
        cross join eod_window w
        where q.attributed_ghl_user_id = u.ghl_user_id
          and q.qualified_at >= w.window_start
          and q.qualified_at < w.window_end
    ),
    positive_advances as (
        select p.*
        from public.vw_milhano_positive_stage_advances p
        cross join selected_user u
        cross join eod_window w
        where p.attributed_ghl_user_id = u.ghl_user_id
          and p.event_timestamp >= w.window_start
          and p.event_timestamp < w.window_end
    ),
    first_touches as (
        select f.*
        from public.vw_milhano_first_human_touch f
        cross join selected_user u
        cross join eod_window w
        where f.attributed_ghl_user_id = u.ghl_user_id
          and f.event_timestamp >= w.window_start
          and f.event_timestamp < w.window_end
    ),
    new_opportunities as (
        select o.*
        from public.milhano_opportunities o
        cross join selected_user u
        cross join eod_window w
        where o.assigned_user_id = u.ghl_user_id
          and o.created_at >= w.window_start
          and o.created_at < w.window_end
    )
    select 'calls_made', count(*) filter (where direction = 'outbound')::integer from calls
    union all
    select 'inbound_calls', count(*) filter (where direction = 'inbound')::integer from calls
    union all
    select 'ghl_connected_calls', count(*) filter (where direction = 'outbound' and is_connected_raw = true)::integer from calls
    union all
    select 'unique_leads_called', count(distinct coalesce(ghl_opportunity_id, ghl_contact_id)) filter (where direction = 'outbound' and is_connected_raw = true)::integer from calls
    union all
    select 'meaningful_calls_3min', count(*) filter (where direction = 'outbound' and is_meaningful_conversation = true)::integer from calls
    union all
    select 'meaningful_conversations', count(*) filter (where direction = 'outbound' and is_meaningful_conversation = true)::integer from calls
    union all
    select 'new_leads_received', count(distinct ghl_opportunity_id)::integer from new_opportunities
    union all
    select 'new_leads_attended', count(distinct ghl_opportunity_id)::integer from first_touches
    union all
    select 'qualified_leads', count(distinct ghl_opportunity_id)::integer from qualification_events
    union all
    select 'leads_advanced_stage', count(distinct ghl_opportunity_id)::integer from positive_advances
    union all
    select 'school_tours_scheduled', count(distinct ghl_opportunity_id)::integer from stage_events where to_stage = 'School Tour agendado'
    union all
    select 'school_tours_attended', count(distinct ghl_opportunity_id)::integer from stage_events where to_stage = 'School Tour atendido'
    union all
    select 'trial_days_booked', count(distinct ghl_opportunity_id)::integer from stage_events where to_stage = 'Pasadía agendada'
    union all
    select 'trial_days_showed', count(distinct ghl_opportunity_id)::integer from stage_events where to_stage = 'Pasadía asistida'
    union all
    select 'closed_leads', count(distinct ghl_opportunity_id)::integer from stage_events where to_stage = 'Inscrito';
$$;

-- ------------------------------------------------------------
-- F. Preserve any existing EOD manual-extra values when the new
--    simple form does not send that advanced field.
-- ------------------------------------------------------------
create or replace function public.milhano_save_eod_submission(
    p_submission_id uuid,
    p_actor_app_user_id uuid,
    p_metrics jsonb,
    p_comments text default null,
    p_submit boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_submission public.milhano_eod_submissions%rowtype;
    v_actor public.milhano_app_users%rowtype;
    v_metric jsonb;
    v_metric_key text;
    v_declared integer;
    v_manual_extra integer;
    v_note text;
    v_old_status text;
    v_new_status text;
    v_action_type text;
    v_reported_gaps integer := 0;
    v_missing integer := 0;
begin
    select * into v_actor
    from public.milhano_app_users
    where id = p_actor_app_user_id and is_active = true;

    if not found then raise exception 'Actor no válido o inactivo'; end if;

    select * into v_submission
    from public.milhano_eod_submissions
    where id = p_submission_id
    for update;

    if not found then raise exception 'Submission EOD no encontrada'; end if;

    if v_actor.role <> 'admin' and v_actor.id <> v_submission.app_user_id then
        raise exception 'No tienes permiso para editar este cierre';
    end if;
    if v_actor.role = 'viewer' then
        raise exception 'La cuenta de dirección es de sólo lectura';
    end if;
    if v_submission.status in ('submitted', 'validated') and v_actor.role <> 'admin' then
        raise exception 'El cierre ya fue enviado y está bloqueado para edición';
    end if;
    if p_metrics is null or jsonb_typeof(p_metrics) <> 'array' then
        raise exception 'p_metrics debe ser un arreglo JSON';
    end if;

    v_old_status := v_submission.status;

    for v_metric in select value from jsonb_array_elements(p_metrics)
    loop
        v_metric_key := nullif(trim(v_metric ->> 'metric_key'), '');
        if v_metric_key is null then continue; end if;

        if not exists (
            select 1
            from public.milhano_eod_metric_catalog c
            where c.metric_key = v_metric_key
              and c.is_active = true
              and c.is_system_only = false
        ) then
            continue;
        end if;

        begin
            v_declared := nullif(trim(v_metric ->> 'declared_value'), '')::integer;
        exception when others then
            raise exception 'Valor reportado inválido para %', v_metric_key;
        end;

        if v_declared is not null and v_declared < 0 then
            raise exception 'El valor reportado no puede ser negativo para %', v_metric_key;
        end if;

        if v_metric ? 'manual_extra_value' then
            begin
                v_manual_extra := coalesce(nullif(trim(v_metric ->> 'manual_extra_value'), '')::integer, 0);
            exception when others then
                raise exception 'Manual Extra inválido para %', v_metric_key;
            end;
        else
            select coalesce(mv.manual_extra_value, 0)
            into v_manual_extra
            from public.milhano_eod_metric_values mv
            where mv.submission_id = p_submission_id
              and mv.metric_key = v_metric_key;
            v_manual_extra := coalesce(v_manual_extra, 0);
        end if;

        v_note := nullif(trim(v_metric ->> 'discrepancy_note'), '');

        insert into public.milhano_eod_metric_values (
            submission_id, metric_key, system_value, declared_value,
            manual_extra_value, user_confirmed, discrepancy_note, updated_at
        )
        select
            p_submission_id,
            v_metric_key,
            coalesce(existing.system_value, 0),
            v_declared,
            v_manual_extra,
            (v_declared is not null),
            coalesce(v_note, existing.discrepancy_note),
            now()
        from (
            select system_value, discrepancy_note
            from public.milhano_eod_metric_values
            where submission_id = p_submission_id
              and metric_key = v_metric_key
        ) existing
        right join (select 1) seed on true
        on conflict (submission_id, metric_key)
        do update set
            declared_value = excluded.declared_value,
            manual_extra_value = excluded.manual_extra_value,
            user_confirmed = excluded.user_confirmed,
            discrepancy_note = excluded.discrepancy_note,
            updated_at = now();
    end loop;

    select
        count(*) filter (where not c.is_system_only and mv.declared_value is null),
        count(*) filter (
            where not c.is_system_only
              and mv.declared_value is not null
              and mv.declared_value <> coalesce(mv.system_value, 0) + coalesce(mv.manual_extra_value, 0)
        )
    into v_missing, v_reported_gaps
    from public.milhano_eod_metric_catalog c
    left join public.milhano_eod_metric_values mv
      on mv.submission_id = p_submission_id
     and mv.metric_key = c.metric_key
    where c.is_active = true;

    if p_submit then
        v_new_status := 'submitted';
        v_action_type := 'submit';
    else
        v_new_status := 'draft';
        v_action_type := 'save_draft';
    end if;

    update public.milhano_eod_submissions
    set status = v_new_status,
        comments = nullif(trim(p_comments), ''),
        submitted_at = case when v_new_status = 'submitted' then now() else submitted_at end,
        updated_at = now()
    where id = p_submission_id;

    insert into public.milhano_eod_submission_actions (
        submission_id, actor_app_user_id, action_type, old_status,
        new_status, comments, details
    )
    values (
        p_submission_id, p_actor_app_user_id, v_action_type, v_old_status,
        v_new_status, nullif(trim(p_comments), ''),
        jsonb_build_object(
            'submit_requested', p_submit,
            'missing_reported_values', v_missing,
            'reported_gaps', v_reported_gaps,
            'blocking_mismatches', 0,
            'policy', 'v12_simple_non_blocking_eod'
        )
    );

    return jsonb_build_object(
        'ok', true,
        'result', case when p_submit then 'submitted' else 'saved' end,
        'submission_id', p_submission_id,
        'status', v_new_status,
        'missing_or_unconfirmed', v_missing,
        'reported_gaps', v_reported_gaps,
        'blocking_mismatches', 0,
        'processed_at', now()
    );
end;
$$;

revoke all on function public.milhano_save_eod_submission(uuid, uuid, jsonb, text, boolean) from public;
grant execute on function public.milhano_save_eod_submission(uuid, uuid, jsonb, text, boolean) to service_role;

commit;

-- ------------------------------------------------------------
-- Validation output
-- ------------------------------------------------------------
select
    stage_name,
    positive_order,
    stage_type,
    eod_metric_key
from public.milhano_pipeline_stage_rules
where is_active = true
order by positive_order nulls last, stage_name;

select
    metric_key,
    label,
    display_order,
    is_active
from public.milhano_eod_metric_catalog
where is_active = true
order by display_order;
