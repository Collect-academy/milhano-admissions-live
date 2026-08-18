-- ============================================================
-- MILHANO | V13 | RESPONDED + MEANINGFUL CONVERSATION MODEL
-- Date: 2026-08-14
--
-- Business model
--   Stages = current operational state / next action.
--   Interaction milestones = historical events / KPIs.
--
-- Therefore:
--   - DO NOT create a GHL stage named Responded.
--   - DO NOT create a GHL stage named Meaningful Conversation.
--   - A lead that replied but still needs more information normally remains
--     in / moves to Seguimiento until Fit vs No Fit can be decided.
--
-- Cascade V13
--   New Leads
--   -> Number of Dials
--   -> Unique Contacted Leads
--   -> Responded
--   -> Meaningful Conversations
--   -> Qualified / Fit
--   -> School Tour ...
--
-- Responded (system)
--   Distinct admissions leads with at least one observable response:
--     * inbound WhatsApp linked to an admissions opportunity, OR
--     * connected GHL call (outbound answered or inbound connected).
--
-- Unique Contacted Leads (system)
--   Distinct admissions leads with at least one human outbound attempt:
--     * outbound GHL call attempt, OR
--     * manual/countable outbound WhatsApp.
--
-- Meaningful Conversations (reported/manual-primary)
--   Distinct leads who provided admissions-relevant information, even when
--   that information is still insufficient to decide Fit vs No Fit.
--   This can happen on WhatsApp or phone. We intentionally do NOT infer it
--   from call duration or message count.
--
-- No n8n workflow changes are required. This uses the existing communication
-- event table populated by the current GHL calls + WhatsApp reconciliation.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- A. Rebuild unified system activity with clean interaction semantics.
-- ------------------------------------------------------------
create or replace view public.vw_milhano_operational_cascade_activity
with (security_invoker = true)
as

-- 1) New Leads
select
    'new_leads'::text as metric_key,
    coalesce(o.original_lead_date, o.created_at) as activity_at,
    o.ghl_opportunity_id,
    o.ghl_contact_id,
    ('lead:' || o.ghl_opportunity_id)::text as activity_id
from public.milhano_opportunities o
where coalesce(o.original_lead_date, o.created_at) is not null

union all

-- 2) Number of Dials: all outbound GHL call attempts.
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
    order by o.updated_at desc nulls last, o.created_at desc nulls last
    limit 1
) mapped on true
where lower(c.channel) = 'call'
  and c.is_call_attempt = true
  and c.direction = 'outbound'

union all

-- Support metric: connected outbound calls.
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
    order by o.updated_at desc nulls last, o.created_at desc nulls last
    limit 1
) mapped on true
where lower(c.channel) = 'call'
  and c.is_call_attempt = true
  and c.direction = 'outbound'
  and c.is_connected_raw = true

union all

-- 3) Unique Contacted Leads: outbound GHL call attempt.
select
    'unique_contacted_leads',
    c.event_timestamp,
    coalesce(c.ghl_opportunity_id, mapped.ghl_opportunity_id),
    c.ghl_contact_id,
    ('contact-call:' || c.event_id)::text
from public.milhano_communication_events c
left join lateral (
    select o.ghl_opportunity_id
    from public.milhano_opportunities o
    where o.ghl_contact_id = c.ghl_contact_id
    order by o.updated_at desc nulls last, o.created_at desc nulls last
    limit 1
) mapped on true
where lower(c.channel) = 'call'
  and c.is_call_attempt = true
  and c.direction = 'outbound'
  and coalesce(c.ghl_opportunity_id, mapped.ghl_opportunity_id) is not null

union all

-- 3) Unique Contacted Leads: manual/countable outbound WhatsApp.
select
    'unique_contacted_leads',
    c.event_timestamp,
    coalesce(c.ghl_opportunity_id, mapped.ghl_opportunity_id),
    c.ghl_contact_id,
    ('contact-wa:' || c.event_id)::text
from public.milhano_communication_events c
left join lateral (
    select o.ghl_opportunity_id
    from public.milhano_opportunities o
    where o.ghl_contact_id = c.ghl_contact_id
    order by o.updated_at desc nulls last, o.created_at desc nulls last
    limit 1
) mapped on true
where lower(c.channel) = 'whatsapp'
  and c.direction = 'outbound'
  and coalesce(c.is_eod_countable, false) = true
  and coalesce(c.ghl_opportunity_id, mapped.ghl_opportunity_id) is not null

union all

-- 4) Responded: inbound WhatsApp from an admissions lead.
select
    'responded_leads',
    c.event_timestamp,
    coalesce(c.ghl_opportunity_id, mapped.ghl_opportunity_id),
    c.ghl_contact_id,
    ('response-wa:' || c.event_id)::text
from public.milhano_communication_events c
left join lateral (
    select o.ghl_opportunity_id
    from public.milhano_opportunities o
    where o.ghl_contact_id = c.ghl_contact_id
    order by o.updated_at desc nulls last, o.created_at desc nulls last
    limit 1
) mapped on true
where lower(c.channel) = 'whatsapp'
  and c.direction = 'inbound'
  and coalesce(c.ghl_opportunity_id, mapped.ghl_opportunity_id) is not null

union all

-- 4) Responded: a GHL call connected with the lead.
-- Includes outbound answered calls and inbound connected calls when available.
select
    'responded_leads',
    c.event_timestamp,
    coalesce(c.ghl_opportunity_id, mapped.ghl_opportunity_id),
    c.ghl_contact_id,
    ('response-call:' || c.event_id)::text
from public.milhano_communication_events c
left join lateral (
    select o.ghl_opportunity_id
    from public.milhano_opportunities o
    where o.ghl_contact_id = c.ghl_contact_id
    order by o.updated_at desc nulls last, o.created_at desc nulls last
    limit 1
) mapped on true
where lower(c.channel) = 'call'
  and c.is_connected_raw = true
  and c.direction in ('outbound', 'inbound')
  and coalesce(c.ghl_opportunity_id, mapped.ghl_opportunity_id) is not null

union all

-- 6) Qualified / Fit. Qualified == Fit; count first qualification evidence.
select
    'qualified_leads',
    q.qualified_at,
    q.ghl_opportunity_id,
    q.ghl_contact_id,
    q.event_id
from public.vw_milhano_qualification_events q

union all

-- 7+) Pipeline milestones.
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
    ('tour-today:' || d.ghl_opportunity_id)::text
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
    ('tour-showed:' || d.ghl_opportunity_id)::text
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


-- ------------------------------------------------------------
-- B. System cascade source.
-- Meaningful Conversations is intentionally absent here because V13 treats
-- it as a human semantic classification, not a 3-minute-call proxy.
-- ------------------------------------------------------------
create or replace function public.milhano_get_operational_cascade(
    p_start date,
    p_end date
)
returns table (
    metric_key text,
    label text,
    display_order integer,
    metric_value bigint,
    metric_scope text,
    definition text
)
language sql
stable
security definer
set search_path = public
as $$
    with bounds as (
        select
            p_start::timestamp at time zone 'America/Merida' as start_at,
            (p_end + 1)::timestamp at time zone 'America/Merida' as end_at,
            (now() at time zone 'America/Merida')::date as local_today
    ),
    catalog(metric_key, label, display_order, metric_scope, definition) as (
        values
            ('new_leads', 'New Leads', 1, 'selected_period',
             'Distinct GHL opportunities received in the selected period.'),
            ('number_of_dials', 'Number of Dials', 2, 'selected_period',
             'All outbound call attempts registered in GHL.'),
            ('unique_contacted_leads', 'Unique Contacted Leads', 3, 'selected_period',
             'Distinct admissions leads with at least one outbound GHL call attempt or manual/countable outbound WhatsApp.'),
            ('responded_leads', 'Responded', 4, 'selected_period',
             'Distinct admissions leads with an inbound WhatsApp response or a connected GHL call.'),
            ('qualified_leads', 'Qualified / Fit', 6, 'selected_period',
             'Distinct leads reaching the Fit milestone. Qualified and Fit are the same Milhano milestone.'),
            ('school_tours_booked', 'School Tours Booked', 7, 'selected_period',
             'Distinct leads entering School Tour Booked.'),
            ('school_tours_today', 'School Tours Today', 8, 'today',
             'Tours scheduled for the current date in Mérida.'),
            ('school_tours_attended', 'School Tours Attended', 9, 'selected_period',
             'Distinct leads recorded as having attended a School Tour.'),
            ('trial_days_booked', 'Trial Days Booked', 10, 'selected_period',
             'Distinct leads entering Trial Day Booked.'),
            ('trial_days_showed', 'Trial Days Showed', 11, 'selected_period',
             'Distinct leads entering Trial Day Showed.'),
            ('closed', 'Closed', 12, 'selected_period',
             'Distinct leads entering the enrolled/closed stage.')
    ),
    filtered as (
        select activity.*
        from public.vw_milhano_operational_cascade_activity activity
        cross join bounds
        where (
            activity.metric_key = 'school_tours_today'
            and (activity.activity_at at time zone 'America/Merida')::date = bounds.local_today
        )
        or (
            activity.metric_key <> 'school_tours_today'
            and activity.activity_at >= bounds.start_at
            and activity.activity_at < bounds.end_at
        )
    )
    select
        catalog.metric_key,
        catalog.label,
        catalog.display_order,
        case
            when catalog.metric_key = 'number_of_dials'
                then count(filtered.activity_id)
            else count(
                distinct coalesce(
                    filtered.ghl_opportunity_id,
                    filtered.ghl_contact_id,
                    filtered.activity_id
                )
            )
        end::bigint as metric_value,
        catalog.metric_scope,
        catalog.definition
    from catalog
    left join filtered
      on filtered.metric_key = catalog.metric_key
    group by
        catalog.metric_key,
        catalog.label,
        catalog.display_order,
        catalog.metric_scope,
        catalog.definition
    order by catalog.display_order;
$$;

revoke all on function public.milhano_get_operational_cascade(date, date)
from public;
grant execute on function public.milhano_get_operational_cascade(date, date)
to service_role;


-- ------------------------------------------------------------
-- C. Reconciliation catalog.
-- ------------------------------------------------------------
-- Contacted attempts remain a manual support dimension and are NOT compared
-- directly with Unique Contacted Leads because one is attempts and the other
-- is unique leads.
update public.milhano_reconciliation_metric_catalog
set
    label = 'Unique Contacted Leads',
    display_order = 3,
    metric_scope = 'selected_period',
    eod_metric_key = null,
    show_in_cascade = true,
    supports_manual_extra = true,
    definition = 'System = distinct admissions leads with at least one outbound GHL call attempt or manual/countable outbound WhatsApp. This is a unique-lead metric, not the advisor Contactados/attempts total.',
    is_active = true,
    updated_at = now()
where metric_key = 'unique_contacted_leads';

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
values (
    'responded_leads',
    'Responded',
    4,
    'selected_period',
    'responses_reported',
    true,
    true,
    'System = distinct admissions leads with at least one inbound WhatsApp response or connected GHL call. Reported = advisor # Responses. External/untracked replies can be reconciled as Manual Extra when verified.',
    true
)
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

update public.milhano_reconciliation_metric_catalog
set
    label = 'Meaningful Conversations',
    display_order = 5,
    metric_scope = 'manual_only',
    eod_metric_key = 'meaningful_conversations_reported',
    show_in_cascade = true,
    supports_manual_extra = false,
    definition = 'Reported unique leads who provided admissions-relevant information, even if the information is still insufficient to decide Fit vs No Fit. Can be WhatsApp or phone. Not inferred from call duration or message count.',
    is_active = true,
    updated_at = now()
where metric_key = 'meaningful_conversations';

update public.milhano_reconciliation_metric_catalog
set label = 'Qualified / Fit', display_order = 6, updated_at = now()
where metric_key = 'qualified_leads';

update public.milhano_reconciliation_metric_catalog
set display_order = 7, updated_at = now()
where metric_key = 'school_tours_booked';

update public.milhano_reconciliation_metric_catalog
set display_order = 8, updated_at = now()
where metric_key = 'school_tours_today';

update public.milhano_reconciliation_metric_catalog
set display_order = 9, updated_at = now()
where metric_key = 'school_tours_attended';

update public.milhano_reconciliation_metric_catalog
set display_order = 10, updated_at = now()
where metric_key = 'trial_days_booked';

update public.milhano_reconciliation_metric_catalog
set display_order = 11, updated_at = now()
where metric_key = 'trial_days_showed';

update public.milhano_reconciliation_metric_catalog
set display_order = 12, updated_at = now()
where metric_key = 'closed';

-- Avoid showing the old support row as a second copy of the same manual
-- Responses report. The EOD metric remains active; only this reconciliation
-- support row is retired.
update public.milhano_reconciliation_metric_catalog
set is_active = false,
    updated_at = now()
where metric_key = 'responses_reported';


-- ------------------------------------------------------------
-- D. Simple EOD: add Meaningful Conversations between Responses and Fit.
-- ------------------------------------------------------------
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
    ('meaningful_conversations_reported', 'Meaningful Conversations',
     'Unique leads who provided admissions-relevant information during the EOD window, even when there is not yet enough information to decide Fit vs No Fit. Can be WhatsApp or phone.',
     6, false, true, false, true)
on conflict (metric_key)
do update set
    label = excluded.label,
    description = excluded.description,
    display_order = excluded.display_order,
    is_system_only = false,
    requires_user_confirmation = true,
    blocks_submission_on_mismatch = false,
    is_active = true;

-- Keep the simple EOD order clean.
update public.milhano_eod_metric_catalog set display_order = 1, is_active = true where metric_key = 'new_leads_received';
update public.milhano_eod_metric_catalog set display_order = 2, is_active = true where metric_key = 'ads_leads_reported';
update public.milhano_eod_metric_catalog set display_order = 3, is_active = true where metric_key = 'organic_leads_reported';
update public.milhano_eod_metric_catalog set display_order = 4, is_active = true where metric_key = 'contacted_reported';
update public.milhano_eod_metric_catalog set display_order = 5, is_active = true where metric_key = 'responses_reported';
update public.milhano_eod_metric_catalog set display_order = 7, is_active = true where metric_key = 'qualified_leads';
update public.milhano_eod_metric_catalog set display_order = 8, is_active = true where metric_key = 'school_tours_scheduled';
update public.milhano_eod_metric_catalog set display_order = 9, is_active = true where metric_key = 'school_tours_attended';

-- ------------------------------------------------------------
-- E. Click-through GHL/System lead details for the new Responded metric.
-- ------------------------------------------------------------
create or replace function public.milhano_get_operational_cascade_leads(
    p_metric_key text,
    p_start date,
    p_end date
)
returns table (
    metric_key text,
    ghl_opportunity_id text,
    ghl_contact_id text,
    lead_name text,
    contact_name text,
    student_name text,
    phone text,
    email text,
    source text,
    current_stage text,
    opportunity_status text,
    operational_owner text,
    grade_interest text,
    activity_at timestamptz,
    activity_count bigint,
    scheduled_for timestamptz,
    attendance_status text,
    attended_at timestamptz,
    has_objection boolean,
    objection_summary text,
    school_tour_notes text,
    no_show_reason text,
    historical_comments text
)
language sql
stable
security definer
set search_path = public
as $$
    with bounds as (
        select
            p_start::timestamp at time zone 'America/Merida' as start_at,
            (p_end + 1)::timestamp at time zone 'America/Merida' as end_at,
            (now() at time zone 'America/Merida')::date as local_today
    ),
    filtered as (
        select activity.*
        from public.vw_milhano_operational_cascade_activity activity
        cross join bounds
        where activity.metric_key = p_metric_key
          and (
              (
                  activity.metric_key = 'school_tours_today'
                  and (activity.activity_at at time zone 'America/Merida')::date = bounds.local_today
              )
              or (
                  activity.metric_key <> 'school_tours_today'
                  and activity.activity_at >= bounds.start_at
                  and activity.activity_at < bounds.end_at
              )
          )
    ),
    grouped as (
        select
            filtered.metric_key,
            filtered.ghl_opportunity_id,
            filtered.ghl_contact_id,
            max(filtered.activity_at) as activity_at,
            count(*)::bigint as activity_count
        from filtered
        group by
            filtered.metric_key,
            filtered.ghl_opportunity_id,
            filtered.ghl_contact_id
    )
    select
        grouped.metric_key,
        coalesce(grouped.ghl_opportunity_id, opportunity.ghl_opportunity_id) as ghl_opportunity_id,
        coalesce(grouped.ghl_contact_id, opportunity.ghl_contact_id) as ghl_contact_id,
        coalesce(
            nullif(trim(opportunity.student_name), ''),
            nullif(trim(opportunity.contact_name), ''),
            nullif(trim(opportunity.opportunity_name), ''),
            grouped.ghl_contact_id,
            'Unidentified lead'
        ) as lead_name,
        opportunity.contact_name,
        opportunity.student_name,
        opportunity.phone,
        opportunity.email,
        opportunity.source,
        opportunity.current_stage,
        opportunity.status as opportunity_status,
        coalesce(
            nullif(trim(opportunity.assigned_user), ''),
            nullif(trim(opportunity.historical_advisor), ''),
            'Unassigned'
        ) as operational_owner,
        opportunity.grade_interest,
        grouped.activity_at,
        grouped.activity_count,
        tour.scheduled_for,
        coalesce(tour.attendance_status, 'unknown') as attendance_status,
        tour.attended_at,
        coalesce(tour.has_objection, false) as has_objection,
        tour.objection_summary,
        tour.school_tour_notes,
        tour.no_show_reason,
        opportunity.historical_comments
    from grouped
    left join lateral (
        select o.*
        from public.milhano_opportunities o
        where (
            grouped.ghl_opportunity_id is not null
            and o.ghl_opportunity_id = grouped.ghl_opportunity_id
        )
        or (
            grouped.ghl_opportunity_id is null
            and grouped.ghl_contact_id is not null
            and o.ghl_contact_id = grouped.ghl_contact_id
        )
        order by o.updated_at desc nulls last
        limit 1
    ) opportunity on true
    left join public.milhano_school_tour_details tour
      on tour.ghl_opportunity_id = opportunity.ghl_opportunity_id
    order by grouped.activity_at desc nulls last;
$$;

revoke all on function public.milhano_get_operational_cascade_leads(text, date, date)
from public;
grant execute on function public.milhano_get_operational_cascade_leads(text, date, date)
to service_role;

commit;

-- ------------------------------------------------------------
-- F. Validation outputs.
-- ------------------------------------------------------------
select
    metric_key,
    label,
    display_order,
    metric_scope,
    eod_metric_key,
    show_in_cascade,
    supports_manual_extra,
    definition,
    is_active
from public.milhano_reconciliation_metric_catalog
where metric_key in (
    'unique_contacted_leads',
    'responded_leads',
    'meaningful_conversations',
    'qualified_leads'
)
order by display_order;

select
    metric_key,
    label,
    display_order,
    is_active
from public.milhano_eod_metric_catalog
where is_active = true
order by display_order;

select *
from public.milhano_get_operational_reconciliation(
    date '2026-08-10',
    date '2026-08-13'
)
where show_in_cascade = true
order by display_order;
