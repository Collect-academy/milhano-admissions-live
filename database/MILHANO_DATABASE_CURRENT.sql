-- =============================================================================
-- MILHANO ADMISSIONS | DATABASE CURRENT CHECKPOINT
-- Current dashboard checkpoint: V17
-- Generated: 2026-08-20
-- =============================================================================
--
-- PURPOSE
-- This file consolidates the structural/current-state SQL that was previously
-- spread across V11 -> V16.2 release files.
--
-- INCLUDED
-- - reconciliation layer
-- - username/app-user support
-- - simple bilingual EOD + Fit/Follow-up terminology
-- - Responded / Meaningful cascade support
-- - historical EOD support
-- - EOD edit logs / reconciliation export support
-- - structured School Tour detail + funnel support
--
-- EXCLUDED ON PURPOSE
-- - one-time Pathi/Paty backfills
-- - July report imports
-- - read-only audits / prechecks
-- - stage verification queries
-- - temporary historical repair scripts
-- - plaintext authentication passwords
--
-- IMPORTANT
-- This is a CURRENT CHECKPOINT for the existing Milhano database. It assumes
-- the original/base Milhano schema already exists in Supabase. It is not a
-- brand-new-from-zero database bootstrap.
--
-- Going forward, this is the single database document maintained in the repo.
-- New releases should update this file instead of adding versioned SQL clutter.
-- =============================================================================

-- ============================================================================
-- CONSOLIDATED SECTION: MILHANO_11_RECONCILIATION_LAYER.sql
-- ============================================================================

-- ============================================================
-- MILHANO | 11 | RECONCILIATION LAYER
--
-- Goal
--   1) Keep GHL/System values immutable.
--   2) Store what advisors/admins report without overwriting GHL.
--   3) Add only confirmed "outside GHL" activity to the operational total.
--   4) Keep a visible gap when Reported != System + Manual Extra.
--   5) Make the EOD non-blocking when a rep defends a different number.
--
-- Operational timezone: America/Merida
-- No n8n changes are required by this migration.
-- ============================================================

create extension if not exists pgcrypto;


-- ------------------------------------------------------------
-- 1. Add Qualified + Answered Calls to the unified activity layer
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
    e.event_timestamp,
    e.ghl_opportunity_id,
    e.ghl_contact_id,
    e.event_id
from public.milhano_stage_events e
where e.is_valid = true
  and e.to_stage = 'Fit'

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


-- ------------------------------------------------------------
-- 2. Keep the base GHL/System cascade as a clean source of truth
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
             'Distinct opportunities received in the selected period.'),
            ('number_of_dials', 'Number of Dials', 2, 'selected_period',
             'All outbound call attempts registered in GHL.'),
            ('unique_contacted_leads', 'Unique Contacted Leads', 3, 'selected_period',
             'Distinct leads with at least one connected outbound GHL call.'),
            ('meaningful_conversations', 'Meaningful Conversations', 4, 'selected_period',
             'GHL reference: distinct leads with an outbound call lasting at least 3 minutes.'),
            ('qualified_leads', 'Qualified Leads', 5, 'selected_period',
             'Distinct leads entering the Fit stage.'),
            ('school_tours_booked', 'School Tours Booked', 6, 'selected_period',
             'Distinct leads entering School Tour Booked.'),
            ('school_tours_today', 'School Tours Today', 7, 'today',
             'Tours scheduled for the current date in Mérida.'),
            ('school_tours_attended', 'School Tours Attended', 8, 'selected_period',
             'Distinct leads recorded as having attended a School Tour.'),
            ('trial_days_booked', 'Trial Days Booked', 9, 'selected_period',
             'Distinct leads entering Trial Day Booked.'),
            ('trial_days_showed', 'Trial Days Showed', 10, 'selected_period',
             'Distinct leads entering Trial Day Showed.'),
            ('closed', 'Closed', 11, 'selected_period',
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
            when catalog.metric_key in (
                'number_of_dials',
                'meaningful_conversations'
            ) then count(filtered.activity_id)
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
-- 3. Reconciliation metric catalog
-- ------------------------------------------------------------
create table if not exists public.milhano_reconciliation_metric_catalog (
    metric_key text primary key,
    label text not null,
    display_order integer not null,
    metric_scope text not null default 'selected_period'
        check (metric_scope in ('selected_period', 'today', 'manual_only')),
    eod_metric_key text,
    show_in_cascade boolean not null default false,
    supports_manual_extra boolean not null default true,
    definition text,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.milhano_reconciliation_metric_catalog enable row level security;

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
    ('new_leads', 'New Leads', 1, 'selected_period', 'new_leads_received', true, true,
     'System = GHL opportunities. Manual Extra = leads known to exist but not captured in GHL.' , true),
    ('number_of_dials', 'Number of Dials', 2, 'selected_period', 'calls_made', true, true,
     'System = outbound call attempts registered in GHL. Manual Extra can include WhatsApp or external phone calls not visible to GHL.', true),
    ('answered_calls', 'Answered / Connected Calls', 3, 'selected_period', 'ghl_connected_calls', false, true,
     'System = connected outbound calls registered in GHL. Manual Extra = answered WhatsApp/external calls known to be outside GHL.', true),
    ('unique_contacted_leads', 'Unique Contacted Leads', 4, 'selected_period', 'unique_leads_called', true, true,
     'System = distinct leads with a connected outbound GHL call. Manual Extra is only for distinct additional leads not represented in GHL.', true),
    ('meaningful_conversations', 'Meaningful Conversations', 5, 'selected_period', 'meaningful_conversations', true, true,
     'System is a GHL 3+ minute call reference. The reported total may include meaningful WhatsApp or external conversations.', true),
    ('qualified_leads', 'Qualified Leads', 6, 'selected_period', 'qualified_leads', true, true,
     'System = distinct leads entering Fit. Manual Extra = qualified leads not represented by a Fit event in GHL.', true),
    ('school_tours_booked', 'School Tours Booked', 7, 'selected_period', 'school_tours_scheduled', true, true,
     'System = distinct leads entering School Tour Booked. Manual Extra = tours known to be booked outside the recorded pipeline.', true),
    ('school_tours_today', 'School Tours Today', 8, 'today', null, true, false,
     'Current-date schedule in Mérida. This remains system-only because period-level manual adjustments cannot be safely allocated to a single day.', true),
    ('school_tours_attended', 'School Tours Attended', 9, 'selected_period', 'school_tours_attended', true, true,
     'System = distinct recorded attendees. Manual Extra = attended tours absent from the recorded pipeline/detail layer.', true),
    ('trial_days_booked', 'Trial Days Booked', 10, 'selected_period', 'trial_days_booked', true, true,
     'System = distinct leads entering Trial Day Booked. Manual Extra = confirmed bookings missing from GHL.', true),
    ('trial_days_showed', 'Trial Days Showed', 11, 'selected_period', 'trial_days_showed', true, true,
     'System = distinct leads entering Trial Day Showed. Manual Extra = confirmed shows missing from GHL.', true),
    ('closed', 'Closed', 12, 'selected_period', 'closed_leads', true, true,
     'System = distinct leads entering Inscrito. Manual Extra = confirmed enrollments not represented in GHL.', true),
    ('new_leads_handled', 'New Leads Handled', 20, 'selected_period', 'new_leads_attended', false, true,
     'System = distinct leads with a first attributable human touch. Kept in reconciliation because advisors declare this in EOD.', true),
    ('stage_advancements', 'Stage Advancements', 21, 'selected_period', 'leads_advanced_stage', false, true,
     'System = distinct opportunities with a positive stage movement. Kept in reconciliation because advisors declare this in EOD.', true),
    ('ads_leads', 'Ads Leads', 101, 'manual_only', null, false, false,
     'Manual reporting dimension. It is not automatically inferred from GHL source labels.', true),
    ('organic_leads', 'Organic Leads', 102, 'manual_only', null, false, false,
     'Manual reporting dimension. It is not automatically inferred from GHL source labels.', true),
    ('messages_answered', 'Messages Answered', 103, 'manual_only', null, false, false,
     'Manual reporting dimension kept separate from raw WhatsApp message volume.', true)
on conflict (metric_key)
do update set
    label = excluded.label,
    display_order = excluded.display_order,
    metric_scope = excluded.metric_scope,
    eod_metric_key = excluded.eod_metric_key,
    show_in_cascade = excluded.show_in_cascade,
    supports_manual_extra = excluded.supports_manual_extra,
    definition = excluded.definition,
    is_active = excluded.is_active,
    updated_at = now();


-- ------------------------------------------------------------
-- 4. Period reports + admin/manual adjustments
-- ------------------------------------------------------------
create table if not exists public.milhano_metric_reconciliation_entries (
    id uuid primary key default gen_random_uuid(),
    metric_key text not null
        references public.milhano_reconciliation_metric_catalog(metric_key)
        on delete restrict,
    period_start date not null,
    period_end date not null,
    advisor_app_user_id uuid
        references public.milhano_app_users(id)
        on delete set null,
    reported_value integer,
    manual_extra_value integer not null default 0,
    source_type text not null default 'admin_adjustment'
        check (source_type in ('historical_report', 'admin_adjustment')),
    note text,
    system_issue_flag boolean not null default false,
    created_by_app_user_id uuid
        references public.milhano_app_users(id)
        on delete set null,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (period_end >= period_start),
    check (reported_value is null or reported_value >= 0),
    check (manual_extra_value >= 0)
);

create index if not exists idx_milhano_recon_entries_metric_period
    on public.milhano_metric_reconciliation_entries(
        metric_key,
        period_start,
        period_end,
        is_active
    );

create index if not exists idx_milhano_recon_entries_advisor
    on public.milhano_metric_reconciliation_entries(
        advisor_app_user_id,
        period_start,
        period_end
    );

alter table public.milhano_metric_reconciliation_entries enable row level security;

-- Reconciliation is server-side only. The Next.js server uses service_role.
revoke all on table public.milhano_reconciliation_metric_catalog
from anon, authenticated;
revoke all on table public.milhano_metric_reconciliation_entries
from anon, authenticated;
grant select on table public.milhano_reconciliation_metric_catalog
to service_role;
grant select on table public.milhano_metric_reconciliation_entries
to service_role;


create or replace function public.milhano_save_reconciliation_entry(
    p_actor_app_user_id uuid,
    p_metric_key text,
    p_period_start date,
    p_period_end date,
    p_advisor_app_user_id uuid,
    p_reported_value integer,
    p_manual_extra_value integer,
    p_source_type text,
    p_note text,
    p_system_issue_flag boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_actor public.milhano_app_users%rowtype;
    v_entry_id uuid;
    v_source text := coalesce(nullif(trim(p_source_type), ''), 'admin_adjustment');
begin
    select *
    into v_actor
    from public.milhano_app_users
    where id = p_actor_app_user_id
      and is_active = true;

    if not found or v_actor.role <> 'admin' then
        raise exception 'Only an active admin can save reconciliation entries';
    end if;

    if not exists (
        select 1
        from public.milhano_reconciliation_metric_catalog
        where metric_key = p_metric_key
          and is_active = true
    ) then
        raise exception 'Unknown reconciliation metric: %', p_metric_key;
    end if;

    if p_period_start is null or p_period_end is null or p_period_end < p_period_start then
        raise exception 'Invalid reconciliation period';
    end if;

    if p_reported_value is not null and p_reported_value < 0 then
        raise exception 'Reported value cannot be negative';
    end if;

    if coalesce(p_manual_extra_value, 0) < 0 then
        raise exception 'Manual extra cannot be negative';
    end if;

    if v_source not in ('historical_report', 'admin_adjustment') then
        raise exception 'Invalid source type';
    end if;

    if p_advisor_app_user_id is not null and not exists (
        select 1
        from public.milhano_app_users
        where id = p_advisor_app_user_id
          and is_active = true
    ) then
        raise exception 'Advisor not found or inactive';
    end if;

    -- Supersede the previous active version of the same logical entry.
    update public.milhano_metric_reconciliation_entries
    set is_active = false,
        updated_at = now()
    where is_active = true
      and metric_key = p_metric_key
      and period_start = p_period_start
      and period_end = p_period_end
      and source_type = v_source
      and advisor_app_user_id is not distinct from p_advisor_app_user_id;

    insert into public.milhano_metric_reconciliation_entries (
        metric_key,
        period_start,
        period_end,
        advisor_app_user_id,
        reported_value,
        manual_extra_value,
        source_type,
        note,
        system_issue_flag,
        created_by_app_user_id
    )
    values (
        p_metric_key,
        p_period_start,
        p_period_end,
        p_advisor_app_user_id,
        p_reported_value,
        coalesce(p_manual_extra_value, 0),
        v_source,
        nullif(trim(p_note), ''),
        coalesce(p_system_issue_flag, false),
        p_actor_app_user_id
    )
    returning id into v_entry_id;

    return jsonb_build_object(
        'ok', true,
        'result', 'saved',
        'entry_id', v_entry_id,
        'processed_at', now()
    );
end;
$$;

revoke all on function public.milhano_save_reconciliation_entry(
    uuid, text, date, date, uuid, integer, integer, text, text, boolean
) from public;
grant execute on function public.milhano_save_reconciliation_entry(
    uuid, text, date, date, uuid, integer, integer, text, text, boolean
) to service_role;


-- ------------------------------------------------------------
-- 5. EOD: add explicit outside-GHL value and remove mismatch blocking
-- ------------------------------------------------------------
alter table public.milhano_eod_metric_values
    add column if not exists manual_extra_value integer not null default 0;

alter table public.milhano_eod_metric_values
    drop constraint if exists milhano_eod_metric_values_manual_extra_value_check;

alter table public.milhano_eod_metric_values
    add constraint milhano_eod_metric_values_manual_extra_value_check
    check (manual_extra_value >= 0);

-- The old 3-minute metric remains stored historically, but the new editable
-- Meaningful Conversations row is the operational reporting row.
update public.milhano_eod_metric_catalog
set is_active = false
where metric_key = 'meaningful_calls_3min';

-- Replace the broad Trial Day+ / Closed declaration with exact stages.
update public.milhano_eod_metric_catalog
set is_active = false
where metric_key = 'trial_day_plus_closed_leads';

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
    ('calls_made', 'Number of Dials',
     'System = outbound calls in GHL. Report the real total and put only calls known to be outside GHL in Manual Extra.',
     1, false, true, false, true),
    ('inbound_calls', 'Inbound Calls (GHL)',
     'Inbound calls registered in GHL and attributed to the user.',
     2, true, false, false, true),
    ('ghl_connected_calls', 'Answered / Connected Calls',
     'System = connected outbound calls in GHL. Report the real total; Manual Extra can include answered WhatsApp/external calls.',
     3, false, true, false, true),
    ('unique_leads_called', 'Unique Contacted Leads',
     'System = distinct leads with a connected outbound GHL call. Manual Extra is only for additional distinct leads outside GHL.',
     4, false, true, false, true),
    ('meaningful_conversations', 'Meaningful Conversations',
     'System is a GHL 3+ minute call reference. Report the real meaningful-conversation total, including WhatsApp/external conversations when applicable.',
     5, false, true, false, true),
    ('new_leads_received', 'New Leads',
     'System = new GHL opportunities. Report the real total; Manual Extra is only for leads known to be missing from GHL.',
     6, false, true, false, true),
    ('new_leads_attended', 'New Leads Handled',
     'System = first attributable human touches. The reported value can defend real handling not detected by the system.',
     7, false, true, false, true),
    ('qualified_leads', 'Qualified Leads',
     'System = distinct leads entering Fit during the EOD window.',
     8, false, true, false, true),
    ('leads_advanced_stage', 'Stage Advancements',
     'System = distinct opportunities with a positive stage movement.',
     9, false, true, false, true),
    ('school_tours_scheduled', 'School Tours Booked',
     'System = distinct leads entering School Tour Booked.',
     10, false, true, false, true),
    ('school_tours_attended', 'School Tours Attended',
     'System = distinct leads entering School Tour Attended.',
     11, false, true, false, true),
    ('trial_days_booked', 'Trial Days Booked',
     'System = distinct leads entering Trial Day Booked.',
     12, false, true, false, true),
    ('trial_days_showed', 'Trial Days Showed',
     'System = distinct leads entering Trial Day Showed.',
     13, false, true, false, true),
    ('closed_leads', 'Closed',
     'System = distinct leads entering Inscrito / Closed.',
     14, false, true, false, true)
on conflict (metric_key)
do update set
    label = excluded.label,
    description = excluded.description,
    display_order = excluded.display_order,
    is_system_only = excluded.is_system_only,
    requires_user_confirmation = excluded.requires_user_confirmation,
    blocks_submission_on_mismatch = false,
    is_active = excluded.is_active;

-- Belt-and-suspenders: no active manual metric may block submission.
update public.milhano_eod_metric_catalog
set blocks_submission_on_mismatch = false
where is_active = true;


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
    select 'calls_made',
        count(*) filter (where direction = 'outbound')::integer
    from calls

    union all
    select 'inbound_calls',
        count(*) filter (where direction = 'inbound')::integer
    from calls

    union all
    select 'ghl_connected_calls',
        count(*) filter (
            where direction = 'outbound'
              and is_connected_raw = true
        )::integer
    from calls

    union all
    select 'unique_leads_called',
        count(distinct coalesce(ghl_opportunity_id, ghl_contact_id)) filter (
            where direction = 'outbound'
              and is_connected_raw = true
        )::integer
    from calls

    union all
    select 'meaningful_calls_3min',
        count(*) filter (
            where direction = 'outbound'
              and is_meaningful_conversation = true
        )::integer
    from calls

    union all
    select 'meaningful_conversations',
        count(*) filter (
            where direction = 'outbound'
              and is_meaningful_conversation = true
        )::integer
    from calls

    union all
    select 'new_leads_received',
        count(distinct ghl_opportunity_id)::integer
    from new_opportunities

    union all
    select 'new_leads_attended',
        count(distinct ghl_opportunity_id)::integer
    from first_touches

    union all
    select 'qualified_leads',
        count(distinct ghl_opportunity_id)::integer
    from stage_events
    where to_stage = 'Fit'

    union all
    select 'leads_advanced_stage',
        count(distinct ghl_opportunity_id)::integer
    from positive_advances

    union all
    select 'school_tours_scheduled',
        count(distinct ghl_opportunity_id)::integer
    from stage_events
    where to_stage = 'School Tour agendado'

    union all
    select 'school_tours_attended',
        count(distinct ghl_opportunity_id)::integer
    from stage_events
    where to_stage = 'School Tour atendido'

    union all
    select 'trial_days_booked',
        count(distinct ghl_opportunity_id)::integer
    from stage_events
    where to_stage = 'Pasadía agendada'

    union all
    select 'trial_days_showed',
        count(distinct ghl_opportunity_id)::integer
    from stage_events
    where to_stage = 'Pasadía asistida'

    union all
    select 'closed_leads',
        count(distinct ghl_opportunity_id)::integer
    from stage_events
    where to_stage = 'Inscrito'

    union all
    select 'trial_day_plus_closed_leads',
        count(distinct ghl_opportunity_id)::integer
    from stage_events
    where to_stage in (
        'Pasadía agendada',
        'Pasadía asistida',
        'Retroalimentación',
        'En evaluación',
        'Inscripción en proceso',
        'Inscrito'
    );
$$;


-- Existing view columns stay in the original order. New reconciliation fields
-- are appended so CREATE OR REPLACE VIEW remains deployment-safe.
create or replace view public.vw_milhano_eod_reconciliation
with (security_invoker = true)
as
select
    s.id as submission_id,
    s.app_user_id,
    u.display_name,
    s.eod_date,
    s.window_start,
    s.window_end,
    s.status as submission_status,
    c.metric_key,
    c.label,
    c.display_order,
    c.is_system_only,
    c.requires_user_confirmation,
    c.blocks_submission_on_mismatch,
    coalesce(mv.system_value, 0) as system_value,
    mv.declared_value,
    case
        when mv.declared_value is null then null
        else mv.declared_value - coalesce(mv.system_value, 0)
    end as difference,
    coalesce(mv.user_confirmed, false) as user_confirmed,
    case
        when c.is_system_only then 'system'
        when mv.declared_value is null then 'pending'
        when mv.declared_value =
             coalesce(mv.system_value, 0) + coalesce(mv.manual_extra_value, 0)
             and coalesce(mv.manual_extra_value, 0) > 0
            then 'mixed_reconciled'
        when mv.declared_value =
             coalesce(mv.system_value, 0) + coalesce(mv.manual_extra_value, 0)
            then 'reconciled'
        when coalesce(mv.manual_extra_value, 0) > 0
            then 'mixed_gap'
        else 'reported_gap'
    end as reconciliation_status,
    s.comments as submission_comments,
    s.system_snapshot_generated_at,
    s.validated_at,
    s.submitted_at,
    s.validated_by_app_user_id,
    c.description,
    mv.discrepancy_note,

    -- V11 appended fields
    coalesce(mv.manual_extra_value, 0) as manual_extra_value,
    coalesce(mv.system_value, 0) + coalesce(mv.manual_extra_value, 0)
        as operational_total,
    case
        when mv.declared_value is null then null
        else mv.declared_value - (
            coalesce(mv.system_value, 0) + coalesce(mv.manual_extra_value, 0)
        )
    end as operational_difference
from public.milhano_eod_submissions s
join public.milhano_app_users u
    on u.id = s.app_user_id
cross join public.milhano_eod_metric_catalog c
left join public.milhano_eod_metric_values mv
    on mv.submission_id = s.id
   and mv.metric_key = c.metric_key
where c.is_active = true;


create or replace view public.vw_milhano_eod_dashboard
with (security_invoker = true)
as
select
    r.submission_id,
    r.app_user_id,
    r.display_name,
    r.eod_date,
    r.window_start,
    r.window_end,
    r.submission_status,
    r.metric_key,
    r.label,
    r.display_order,
    r.system_value,
    r.declared_value,
    r.difference,
    r.user_confirmed,
    r.reconciliation_status,
    r.submission_comments,
    r.system_snapshot_generated_at,
    r.validated_at,
    r.submitted_at,
    r.validated_by_app_user_id,
    r.description,
    r.is_system_only,
    r.requires_user_confirmation,
    r.blocks_submission_on_mismatch,
    r.discrepancy_note,

    -- V11 appended fields
    r.manual_extra_value,
    r.operational_total,
    r.operational_difference
from public.vw_milhano_eod_reconciliation r
where r.metric_key in (
    select metric_key
    from public.milhano_eod_metric_catalog
    where is_active = true
);


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
    select *
    into v_actor
    from public.milhano_app_users
    where id = p_actor_app_user_id
      and is_active = true;

    if not found then
        raise exception 'Actor no válido o inactivo';
    end if;

    select *
    into v_submission
    from public.milhano_eod_submissions
    where id = p_submission_id
    for update;

    if not found then
        raise exception 'Submission EOD no encontrada';
    end if;

    if v_actor.role <> 'admin'
       and v_actor.id <> v_submission.app_user_id then
        raise exception 'No tienes permiso para editar este cierre';
    end if;

    if v_actor.role = 'viewer' then
        raise exception 'La cuenta de dirección es de sólo lectura';
    end if;

    if v_submission.status in ('submitted', 'validated')
       and v_actor.role <> 'admin' then
        raise exception 'El cierre ya fue enviado y está bloqueado para edición';
    end if;

    if p_metrics is null or jsonb_typeof(p_metrics) <> 'array' then
        raise exception 'p_metrics debe ser un arreglo JSON';
    end if;

    v_old_status := v_submission.status;

    for v_metric in
        select value
        from jsonb_array_elements(p_metrics)
    loop
        v_metric_key := nullif(trim(v_metric ->> 'metric_key'), '');
        if v_metric_key is null then
            continue;
        end if;

        if not exists (
            select 1
            from public.milhano_eod_metric_catalog catalog
            where catalog.metric_key = v_metric_key
              and catalog.is_active = true
              and catalog.is_system_only = false
        ) then
            continue;
        end if;

        begin
            v_declared := nullif(trim(v_metric ->> 'declared_value'), '')::integer;
        exception when others then
            raise exception 'Valor reportado inválido para %', v_metric_key;
        end;

        begin
            v_manual_extra := coalesce(
                nullif(trim(v_metric ->> 'manual_extra_value'), '')::integer,
                0
            );
        exception when others then
            raise exception 'Manual Extra inválido para %', v_metric_key;
        end;

        if v_declared is not null and v_declared < 0 then
            raise exception 'El valor reportado no puede ser negativo para %', v_metric_key;
        end if;

        if v_manual_extra < 0 then
            raise exception 'Manual Extra no puede ser negativo para %', v_metric_key;
        end if;

        v_note := nullif(trim(v_metric ->> 'discrepancy_note'), '');

        insert into public.milhano_eod_metric_values (
            submission_id,
            metric_key,
            system_value,
            declared_value,
            manual_extra_value,
            user_confirmed,
            discrepancy_note,
            updated_at
        )
        select
            p_submission_id,
            v_metric_key,
            coalesce(existing.system_value, 0),
            v_declared,
            v_manual_extra,
            (v_declared is not null),
            v_note,
            now()
        from (
            select system_value
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
        count(*) filter (
            where not c.is_system_only
              and mv.declared_value is null
        ),
        count(*) filter (
            where not c.is_system_only
              and mv.declared_value is not null
              and mv.declared_value <>
                  coalesce(mv.system_value, 0) + coalesce(mv.manual_extra_value, 0)
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
    set
        status = v_new_status,
        comments = nullif(trim(p_comments), ''),
        submitted_at = case
            when v_new_status = 'submitted' then now()
            else submitted_at
        end,
        updated_at = now()
    where id = p_submission_id;

    insert into public.milhano_eod_submission_actions (
        submission_id,
        actor_app_user_id,
        action_type,
        old_status,
        new_status,
        comments,
        details
    )
    values (
        p_submission_id,
        p_actor_app_user_id,
        v_action_type,
        v_old_status,
        v_new_status,
        nullif(trim(p_comments), ''),
        jsonb_build_object(
            'submit_requested', p_submit,
            'missing_reported_values', v_missing,
            'reported_gaps', v_reported_gaps,
            'blocking_mismatches', 0,
            'policy', 'v11_non_blocking_reconciliation'
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

revoke all on function public.milhano_save_eod_submission(
    uuid, uuid, jsonb, text, boolean
) from public;
grant execute on function public.milhano_save_eod_submission(
    uuid, uuid, jsonb, text, boolean
) to service_role;


-- ------------------------------------------------------------
-- 6. Reconciled operational metrics for dashboard + audit
-- ------------------------------------------------------------
create or replace function public.milhano_get_operational_reconciliation(
    p_start date,
    p_end date
)
returns table (
    metric_key text,
    label text,
    display_order integer,
    metric_scope text,
    system_value bigint,
    eod_manual_extra bigint,
    admin_manual_extra bigint,
    manual_extra_value bigint,
    operational_total bigint,
    reported_value bigint,
    gap bigint,
    reconciliation_status text,
    definition text,
    show_in_cascade boolean,
    supports_manual_extra boolean,
    system_issue_flag boolean,
    reported_source text
)
language sql
stable
security definer
set search_path = public
as $$
    with catalog as (
        select *
        from public.milhano_reconciliation_metric_catalog
        where is_active = true
    ),
    cascade_system as (
        select
            c.metric_key,
            c.metric_value::bigint as system_value
        from public.milhano_get_operational_cascade(p_start, p_end) c
    ),
    answered_system as (
        select
            'answered_calls'::text as metric_key,
            count(a.activity_id)::bigint as system_value
        from public.vw_milhano_operational_cascade_activity a
        where a.metric_key = 'answered_calls'
          and a.activity_at >= (
              p_start::timestamp at time zone 'America/Merida'
          )
          and a.activity_at < (
              (p_end + 1)::timestamp at time zone 'America/Merida'
          )
    ),
    support_system as (
        select
            'new_leads_handled'::text as metric_key,
            count(distinct f.ghl_opportunity_id)::bigint as system_value
        from public.vw_milhano_first_human_touch f
        where f.event_timestamp >= (
            p_start::timestamp at time zone 'America/Merida'
        )
          and f.event_timestamp < (
              (p_end + 1)::timestamp at time zone 'America/Merida'
          )

        union all

        select
            'stage_advancements'::text as metric_key,
            count(distinct p.ghl_opportunity_id)::bigint as system_value
        from public.vw_milhano_positive_stage_advances p
        where p.event_timestamp >= (
            p_start::timestamp at time zone 'America/Merida'
        )
          and p.event_timestamp < (
              (p_end + 1)::timestamp at time zone 'America/Merida'
          )
    ),
    system_values as (
        select * from cascade_system
        union all
        select * from answered_system
        union all
        select * from support_system
    ),
    eod_values as (
        select
            rc.metric_key,
            coalesce(sum(mv.manual_extra_value) filter (
                where s.status <> 'missed'
            ), 0)::bigint as eod_manual_extra,
            sum(mv.declared_value) filter (
                where s.status in ('submitted', 'validated')
                  and mv.declared_value is not null
            )::bigint as eod_reported_value,
            count(mv.declared_value) filter (
                where s.status in ('submitted', 'validated')
                  and mv.declared_value is not null
            )::integer as eod_report_count
        from catalog rc
        join public.milhano_eod_metric_catalog ec
            on ec.metric_key = rc.eod_metric_key
        join public.milhano_eod_submissions s
            on s.eod_date >= p_start
           and s.eod_date <= p_end
        left join public.milhano_eod_metric_values mv
            on mv.submission_id = s.id
           and mv.metric_key = ec.metric_key
        where rc.eod_metric_key is not null
          and rc.metric_scope <> 'today'
        group by rc.metric_key
    ),
    admin_values as (
        select
            e.metric_key,
            coalesce(sum(e.manual_extra_value), 0)::bigint as admin_manual_extra,
            bool_or(e.system_issue_flag) as system_issue_flag
        from public.milhano_metric_reconciliation_entries e
        join catalog c on c.metric_key = e.metric_key
        where e.is_active = true
          and e.period_start >= p_start
          and e.period_end <= p_end
          and c.metric_scope <> 'today'
        group by e.metric_key
    ),
    exact_team_reports as (
        select distinct on (e.metric_key)
            e.metric_key,
            e.reported_value::bigint as reported_value
        from public.milhano_metric_reconciliation_entries e
        where e.is_active = true
          and e.period_start = p_start
          and e.period_end = p_end
          and e.advisor_app_user_id is null
          and e.reported_value is not null
        order by e.metric_key, e.created_at desc
    ),
    latest_advisor_reports as (
        select distinct on (e.metric_key, e.advisor_app_user_id)
            e.metric_key,
            e.advisor_app_user_id,
            e.reported_value
        from public.milhano_metric_reconciliation_entries e
        where e.is_active = true
          and e.period_start = p_start
          and e.period_end = p_end
          and e.advisor_app_user_id is not null
          and e.reported_value is not null
        order by
            e.metric_key,
            e.advisor_app_user_id,
            e.created_at desc
    ),
    exact_advisor_reports as (
        select
            metric_key,
            sum(reported_value)::bigint as reported_value
        from latest_advisor_reports
        group by metric_key
    ),
    joined as (
        select
            c.metric_key,
            c.label,
            c.display_order,
            c.metric_scope,
            sv.system_value,
            coalesce(ev.eod_manual_extra, 0)::bigint as eod_manual_extra,
            coalesce(av.admin_manual_extra, 0)::bigint as admin_manual_extra,
            (
                coalesce(ev.eod_manual_extra, 0)
                + coalesce(av.admin_manual_extra, 0)
            )::bigint as total_manual_extra,
            case
                when tr.reported_value is not null then tr.reported_value
                when ar.reported_value is not null then ar.reported_value
                when coalesce(ev.eod_report_count, 0) > 0 then ev.eod_reported_value
                else null
            end::bigint as reported_value,
            coalesce(av.system_issue_flag, false) as system_issue_flag,
            case
                when tr.reported_value is not null then 'team_period_report'
                when ar.reported_value is not null then 'advisor_period_report'
                when coalesce(ev.eod_report_count, 0) > 0 then 'submitted_eod'
                else null
            end::text as reported_source,
            c.definition,
            c.show_in_cascade,
            c.supports_manual_extra
        from catalog c
        left join system_values sv on sv.metric_key = c.metric_key
        left join eod_values ev on ev.metric_key = c.metric_key
        left join admin_values av on av.metric_key = c.metric_key
        left join exact_team_reports tr on tr.metric_key = c.metric_key
        left join exact_advisor_reports ar on ar.metric_key = c.metric_key
    )
    select
        j.metric_key,
        j.label,
        j.display_order,
        j.metric_scope,
        j.system_value,
        j.eod_manual_extra,
        j.admin_manual_extra,
        j.total_manual_extra as manual_extra_value,
        case
            when j.system_value is null then null
            else j.system_value + j.total_manual_extra
        end::bigint as operational_total,
        j.reported_value,
        case
            when j.system_value is null or j.reported_value is null then null
            else j.reported_value - (j.system_value + j.total_manual_extra)
        end::bigint as gap,
        case
            when j.system_issue_flag then 'data_issue'
            when j.system_value is null and j.reported_value is not null then 'reported_manual'
            when j.system_value is null then 'unreported'
            when j.reported_value is null and j.total_manual_extra > 0 then 'mixed'
            when j.reported_value is null then 'system'
            when j.reported_value = j.system_value + j.total_manual_extra
                 and j.total_manual_extra > 0 then 'mixed_reconciled'
            when j.reported_value = j.system_value then 'reconciled'
            else 'unreconciled'
        end::text as reconciliation_status,
        j.definition,
        j.show_in_cascade,
        j.supports_manual_extra,
        j.system_issue_flag,
        j.reported_source
    from joined j
    order by j.display_order;
$$;

revoke all on function public.milhano_get_operational_reconciliation(date, date)
from public;
grant execute on function public.milhano_get_operational_reconciliation(date, date)
to service_role;


-- ------------------------------------------------------------
-- 7. Refresh today's advisor EOD snapshots so the new rows get real system values
-- ------------------------------------------------------------
do $$
declare
    v_user record;
begin
    for v_user in
        select id
        from public.milhano_app_users
        where is_active = true
          and role = 'advisor'
    loop
        begin
            perform public.milhano_refresh_eod_snapshot(
                v_user.id,
                current_date
            );
        exception when others then
            raise notice
                'Could not refresh EOD snapshot for user %: %',
                v_user.id,
                sqlerrm;
        end;
    end loop;
exception when undefined_function then
    raise notice 'milhano_refresh_eod_snapshot not found; skip automatic refresh.';
end;
$$;


-- ------------------------------------------------------------
-- 8. Deployment sanity checks
-- ------------------------------------------------------------
select *
from public.milhano_get_operational_reconciliation(
    (date_trunc('month', now() at time zone 'America/Merida'))::date,
    (now() at time zone 'America/Merida')::date
)
order by display_order;

select
    metric_key,
    label,
    is_system_only,
    requires_user_confirmation,
    blocks_submission_on_mismatch,
    is_active
from public.milhano_eod_metric_catalog
order by display_order, metric_key;


-- ============================================================================
-- CONSOLIDATED SECTION: MILHANO_11_1_MONA_USERNAME_LOGIN.sql
-- ============================================================================

-- ============================================================
-- MILHANO | V11.1 | MONA USERNAME LOGIN
-- ============================================================
-- Purpose:
-- - Add a dashboard username without changing Supabase Auth's
--   internal email/password mechanism.
-- - Mona logs in visibly as MonaCashflow.
-- - Internally, Supabase Auth continues using mona@coldem.edu.mx.
-- - Mona is promoted to admin so she can use Reconciliation
--   adjustments introduced in V11.
--
-- IMPORTANT:
-- This SQL does NOT set the Supabase Auth password.
-- Create/confirm the Auth user in Supabase Authentication > Users
-- with:
--   internal email: mona@coldem.edu.mx
--   password: [set/reset in Supabase Authentication UI]
--   email confirmed: yes
-- ============================================================

begin;

alter table public.milhano_app_users
  add column if not exists username text;

create unique index if not exists
  uq_milhano_app_users_username
on public.milhano_app_users (username)
where username is not null;

-- Ensure Mona's app-user row exists.
insert into public.milhano_app_users (
  id,
  display_name,
  email,
  username,
  role,
  is_active
)
select
  gen_random_uuid(),
  'Mona Al Idrissi',
  'mona@coldem.edu.mx',
  'MonaCashflow',
  'admin',
  true
where not exists (
  select 1
  from public.milhano_app_users
  where lower(email) = 'mona@coldem.edu.mx'
);

-- Configure the existing Mona row.
update public.milhano_app_users
set
  display_name = 'Mona Al Idrissi',
  email = 'mona@coldem.edu.mx',
  username = 'MonaCashflow',
  role = 'admin',
  is_active = true,
  updated_at = now()
where lower(email) = 'mona@coldem.edu.mx';

-- Link automatically if the Auth user already exists.
update public.milhano_app_users app
set
  auth_user_id = auth_user.id,
  updated_at = now()
from auth.users auth_user
where lower(auth_user.email) = lower(app.email)
  and lower(app.email) = 'mona@coldem.edu.mx'
  and app.auth_user_id is distinct from auth_user.id;

commit;

select
  display_name,
  username,
  email as internal_auth_email,
  role,
  auth_user_id,
  is_active
from public.milhano_app_users
where lower(email) = 'mona@coldem.edu.mx';


-- ============================================================================
-- CONSOLIDATED SECTION: MILHANO_12_1_SIMPLE_EOD_FIT_FOLLOWUP_BILINGUAL.sql
-- ============================================================================

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


-- ============================================================================
-- CONSOLIDATED SECTION: MILHANO_13_RESPONDED_MEANINGFUL_CASCADE.sql
-- ============================================================================

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


-- ============================================================================
-- CONSOLIDATED SECTION: MILHANO_14_HISTORICAL_EOD_MEANINGFUL.sql
-- ============================================================================

-- ============================================================
-- MILHANO | V14 | HISTORICAL EOD + MANUAL MEANINGFUL
--
-- Adds a safe RPC used by the dashboard button "Subir EOD anterior".
-- It reuses the existing unique (advisor, eod_date) submission, so
-- opening the same date does NOT create a duplicate.
--
-- Meaningful Conversations remains intentionally manual.
-- No n8n workflow is added for this metric.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. Keep Meaningful Conversations as an explicit manual EOD KPI.
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
values (
    'meaningful_conversations_reported',
    'Meaningful Conversations',
    'Unique leads who provided admissions-relevant information during the EOD window, even when there is not yet enough information to decide Fit vs No Fit. Can be WhatsApp or phone. This value is manually reported.',
    6,
    false,
    true,
    false,
    true
)
on conflict (metric_key)
do update set
    label = excluded.label,
    description = excluded.description,
    display_order = excluded.display_order,
    is_system_only = false,
    requires_user_confirmation = true,
    blocks_submission_on_mismatch = false,
    is_active = true;

-- Keep the intended simple EOD order.
update public.milhano_eod_metric_catalog set display_order = 1 where metric_key = 'new_leads_received';
update public.milhano_eod_metric_catalog set display_order = 2 where metric_key = 'ads_leads_reported';
update public.milhano_eod_metric_catalog set display_order = 3 where metric_key = 'organic_leads_reported';
update public.milhano_eod_metric_catalog set display_order = 4 where metric_key = 'contacted_reported';
update public.milhano_eod_metric_catalog set display_order = 5 where metric_key = 'responses_reported';
update public.milhano_eod_metric_catalog set display_order = 6 where metric_key = 'meaningful_conversations_reported';
update public.milhano_eod_metric_catalog set display_order = 7 where metric_key = 'qualified_leads';
update public.milhano_eod_metric_catalog set display_order = 8 where metric_key = 'school_tours_scheduled';
update public.milhano_eod_metric_catalog set display_order = 9 where metric_key = 'school_tours_attended';

-- ------------------------------------------------------------
-- 2. Extend the EOD action audit vocabulary.
-- ------------------------------------------------------------
alter table public.milhano_eod_submission_actions
    drop constraint if exists milhano_eod_submission_actions_action_type_check;

alter table public.milhano_eod_submission_actions
    add constraint milhano_eod_submission_actions_action_type_check
    check (
        action_type in (
            'save_draft',
            'submit',
            'blocked',
            'validate',
            'open_historical'
        )
    );

-- ------------------------------------------------------------
-- 3. Safe historical-EOD opener.
-- ------------------------------------------------------------
create or replace function public.milhano_prepare_historical_eod(
    p_target_app_user_id uuid,
    p_eod_date date,
    p_actor_app_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_actor public.milhano_app_users%rowtype;
    v_target public.milhano_app_users%rowtype;
    v_submission_id uuid;
    v_old_status text;
    v_new_status text;
    v_existing boolean := false;
    v_today date := (now() at time zone 'America/Merida')::date;
begin
    if p_eod_date is null then
        raise exception 'EOD date is required';
    end if;

    if p_eod_date > v_today then
        raise exception 'A future EOD cannot be created';
    end if;

    select *
    into v_actor
    from public.milhano_app_users
    where id = p_actor_app_user_id
      and is_active = true;

    if not found or v_actor.role not in ('advisor', 'admin') then
        raise exception 'The current account cannot create an EOD';
    end if;

    select *
    into v_target
    from public.milhano_app_users
    where id = p_target_app_user_id
      and is_active = true
      and role = 'advisor';

    if not found then
        raise exception 'Active advisor not found';
    end if;

    if v_actor.role = 'advisor' and v_actor.id <> v_target.id then
        raise exception 'An advisor can only create or open their own EOD';
    end if;

    select s.id, s.status
    into v_submission_id, v_old_status
    from public.milhano_eod_submissions s
    where s.app_user_id = v_target.id
      and s.eod_date = p_eod_date
    limit 1;

    v_existing := found;

    -- The refresh RPC is idempotent for (advisor, date).
    -- For a missing/draft/legacy-blocked EOD, refresh the system evidence so
    -- the advisor sees the best information available for that historical day.
    -- For an already submitted/validated EOD, DO NOT refresh the system
    -- snapshot just by opening it; this preserves the submitted historical
    -- evidence and avoids silently changing a closed report.
    if not v_existing or coalesce(v_old_status, 'draft') not in ('submitted', 'validated') then
        v_submission_id := public.milhano_refresh_eod_snapshot(
            v_target.id,
            p_eod_date
        );
    end if;

    select status
    into v_new_status
    from public.milhano_eod_submissions
    where id = v_submission_id;

    insert into public.milhano_eod_submission_actions (
        submission_id,
        actor_app_user_id,
        action_type,
        old_status,
        new_status,
        comments,
        details
    )
    values (
        v_submission_id,
        v_actor.id,
        'open_historical',
        v_old_status,
        v_new_status,
        null,
        jsonb_build_object(
            'eod_date', p_eod_date,
            'target_advisor', v_target.display_name,
            'existing_submission', v_existing,
            'policy', 'v14_safe_historical_eod'
        )
    );

    return jsonb_build_object(
        'ok', true,
        'result', case when v_existing then 'opened_existing' else 'created_draft' end,
        'submission_id', v_submission_id,
        'eod_date', p_eod_date,
        'advisor_app_user_id', v_target.id,
        'advisor_name', v_target.display_name,
        'status', v_new_status,
        'existing_submission', v_existing,
        'processed_at', now()
    );
end;
$$;

revoke all on function public.milhano_prepare_historical_eod(uuid, date, uuid)
from public;
grant execute on function public.milhano_prepare_historical_eod(uuid, date, uuid)
to service_role;

commit;

-- ------------------------------------------------------------
-- Validation
-- ------------------------------------------------------------
select
    metric_key,
    label,
    display_order,
    is_system_only,
    requires_user_confirmation,
    blocks_submission_on_mismatch,
    is_active
from public.milhano_eod_metric_catalog
where metric_key = 'meaningful_conversations_reported';

select
    routine_name,
    security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'milhano_prepare_historical_eod';


-- ============================================================================
-- CONSOLIDATED SECTION: MILHANO_15_EOD_EDIT_LOGS_GHL_GAP_REPORT.sql
-- ============================================================================

-- ============================================================
-- MILHANO | V15 | EOD EDITING + CHANGE LOGS
-- Date: 2026-08-18
--
-- Goals
-- 1) EOD values are FINAL TOTALS, never deltas.
--    Example: correcting 20 -> 22 means save 22, not +2.
-- 2) Advisors may correct their own already-submitted EOD.
--    Validated EODs remain admin-only.
-- 3) Every save/update stores a compact field-level audit record.
-- 4) Existing EOD action history remains intact.
--
-- The CSV GHL-gap report is generated by the dashboard from the
-- existing reconciliation RPC; it requires no extra database table.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- A. Dedicated simple EOD change log.
-- ------------------------------------------------------------
create table if not exists public.milhano_eod_change_logs (
    id uuid primary key default gen_random_uuid(),
    submission_id uuid not null references public.milhano_eod_submissions(id) on delete cascade,
    actor_app_user_id uuid references public.milhano_app_users(id),
    target_app_user_id uuid not null references public.milhano_app_users(id),
    eod_date date not null,
    action_type text not null,
    status_before text,
    status_after text,
    changes jsonb not null default '[]'::jsonb,
    changed_fields integer not null default 0,
    comments_before text,
    comments_after text,
    created_at timestamptz not null default now(),
    constraint milhano_eod_change_logs_action_type_check
      check (action_type in ('save_draft', 'submit', 'edit_submitted', 'admin_edit')),
    constraint milhano_eod_change_logs_changes_array_check
      check (jsonb_typeof(changes) = 'array')
);

create index if not exists idx_milhano_eod_change_logs_created_at
    on public.milhano_eod_change_logs (created_at desc);

create index if not exists idx_milhano_eod_change_logs_eod_date
    on public.milhano_eod_change_logs (eod_date desc);

create index if not exists idx_milhano_eod_change_logs_actor
    on public.milhano_eod_change_logs (actor_app_user_id, created_at desc);

-- Keep the legacy action table vocabulary compatible with the new edit events.
alter table public.milhano_eod_submission_actions
    drop constraint if exists milhano_eod_submission_actions_action_type_check;

alter table public.milhano_eod_submission_actions
    add constraint milhano_eod_submission_actions_action_type_check
    check (
        action_type in (
            'save_draft',
            'submit',
            'blocked',
            'validate',
            'open_historical',
            'edit_submitted',
            'admin_edit'
        )
    );

-- Simple read view used by /logs.
create or replace view public.vw_milhano_eod_change_logs
with (security_invoker = true)
as
select
    l.id,
    l.submission_id,
    l.created_at,
    l.eod_date,
    l.action_type,
    l.status_before,
    l.status_after,
    l.changed_fields,
    l.changes,
    l.comments_before,
    l.comments_after,
    l.actor_app_user_id,
    actor.display_name as actor_name,
    l.target_app_user_id,
    target.display_name as advisor_name
from public.milhano_eod_change_logs l
left join public.milhano_app_users actor
  on actor.id = l.actor_app_user_id
join public.milhano_app_users target
  on target.id = l.target_app_user_id;

-- ------------------------------------------------------------
-- B. Rebuild EOD save function.
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
    v_target public.milhano_app_users%rowtype;
    v_metric jsonb;
    v_metric_key text;
    v_declared integer;
    v_old_declared integer;
    v_manual_extra integer;
    v_note text;
    v_old_status text;
    v_new_status text;
    v_action_type text;
    v_reported_gaps integer := 0;
    v_missing integer := 0;
    v_changes jsonb := '[]'::jsonb;
    v_changed_fields integer := 0;
    v_old_comments text;
    v_new_comments text;
    v_comments_changed boolean := false;
    v_is_closed_edit boolean := false;
begin
    select * into v_actor
    from public.milhano_app_users
    where id = p_actor_app_user_id
      and is_active = true;

    if not found then
        raise exception 'Actor no válido o inactivo';
    end if;

    select * into v_submission
    from public.milhano_eod_submissions
    where id = p_submission_id
    for update;

    if not found then
        raise exception 'Submission EOD no encontrada';
    end if;

    select * into v_target
    from public.milhano_app_users
    where id = v_submission.app_user_id;

    if not found then
        raise exception 'Asesora del EOD no encontrada';
    end if;

    if v_actor.role = 'viewer' then
        raise exception 'La cuenta de dirección es de sólo lectura';
    end if;

    if v_actor.role <> 'admin' and v_actor.id <> v_submission.app_user_id then
        raise exception 'No tienes permiso para editar este cierre';
    end if;

    -- Advisors may correct their own submitted EOD, but a validated EOD is
    -- considered formally closed and remains admin-only.
    if v_submission.status = 'validated' and v_actor.role <> 'admin' then
        raise exception 'El EOD ya fue validado. Solicita a un administrador la corrección';
    end if;

    if p_metrics is null or jsonb_typeof(p_metrics) <> 'array' then
        raise exception 'p_metrics debe ser un arreglo JSON';
    end if;

    v_old_status := v_submission.status;
    v_old_comments := v_submission.comments;
    v_new_comments := nullif(trim(p_comments), '');
    v_comments_changed := v_old_comments is distinct from v_new_comments;
    v_is_closed_edit := v_old_status in ('submitted', 'validated');

    for v_metric in
        select value from jsonb_array_elements(p_metrics)
    loop
        v_metric_key := nullif(trim(v_metric ->> 'metric_key'), '');
        if v_metric_key is null then
            continue;
        end if;

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

        select mv.declared_value, coalesce(mv.manual_extra_value, 0)
        into v_old_declared, v_manual_extra
        from public.milhano_eod_metric_values mv
        where mv.submission_id = p_submission_id
          and mv.metric_key = v_metric_key;

        if not found then
            v_old_declared := null;
            v_manual_extra := 0;
        end if;

        if v_metric ? 'manual_extra_value' then
            begin
                v_manual_extra := coalesce(
                    nullif(trim(v_metric ->> 'manual_extra_value'), '')::integer,
                    0
                );
            exception when others then
                raise exception 'Manual Extra inválido para %', v_metric_key;
            end;
        end if;

        v_note := nullif(trim(v_metric ->> 'discrepancy_note'), '');

        -- IMPORTANT: declared_value is an absolute final total. This update
        -- REPLACES the previous value; it never adds a delta.
        insert into public.milhano_eod_metric_values (
            submission_id,
            metric_key,
            system_value,
            declared_value,
            manual_extra_value,
            user_confirmed,
            discrepancy_note,
            updated_at
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

        if v_old_declared is distinct from v_declared then
            v_changes := v_changes || jsonb_build_array(
                jsonb_build_object(
                    'metric_key', v_metric_key,
                    'old_value', v_old_declared,
                    'new_value', v_declared
                )
            );
            v_changed_fields := v_changed_fields + 1;
        end if;
    end loop;

    select
        count(*) filter (
            where not c.is_system_only
              and mv.declared_value is null
        ),
        count(*) filter (
            where not c.is_system_only
              and mv.declared_value is not null
              and mv.declared_value <>
                  coalesce(mv.system_value, 0) + coalesce(mv.manual_extra_value, 0)
        )
    into v_missing, v_reported_gaps
    from public.milhano_eod_metric_catalog c
    left join public.milhano_eod_metric_values mv
      on mv.submission_id = p_submission_id
     and mv.metric_key = c.metric_key
    where c.is_active = true;

    -- Existing submitted/validated EODs remain submitted after a correction.
    -- A validated EOD edited by an admin loses validation because the data changed.
    if v_is_closed_edit then
        v_new_status := 'submitted';
        v_action_type := case
            when v_actor.role = 'admin' then 'admin_edit'
            else 'edit_submitted'
        end;
    elsif p_submit then
        v_new_status := 'submitted';
        v_action_type := 'submit';
    else
        v_new_status := 'draft';
        v_action_type := 'save_draft';
    end if;

    update public.milhano_eod_submissions
    set
        status = v_new_status,
        comments = v_new_comments,
        submitted_at = case
            when v_new_status = 'submitted' then coalesce(submitted_at, now())
            else submitted_at
        end,
        validated_at = case
            when v_old_status = 'validated'
                 and (v_changed_fields > 0 or v_comments_changed)
                then null
            else validated_at
        end,
        validated_by_app_user_id = case
            when v_old_status = 'validated'
                 and (v_changed_fields > 0 or v_comments_changed)
                then null
            else validated_by_app_user_id
        end,
        updated_at = now()
    where id = p_submission_id;

    -- Existing technical action history.
    insert into public.milhano_eod_submission_actions (
        submission_id,
        actor_app_user_id,
        action_type,
        old_status,
        new_status,
        comments,
        details
    )
    values (
        p_submission_id,
        p_actor_app_user_id,
        v_action_type,
        v_old_status,
        v_new_status,
        v_new_comments,
        jsonb_build_object(
            'submit_requested', p_submit,
            'missing_reported_values', v_missing,
            'reported_gaps', v_reported_gaps,
            'blocking_mismatches', 0,
            'changed_fields', v_changed_fields,
            'changes', v_changes,
            'comments_changed', v_comments_changed,
            'value_semantics', 'absolute_total_replace_not_delta',
            'policy', 'v15_editable_logged_eod'
        )
    );

    -- Human-readable log source used by /logs.
    insert into public.milhano_eod_change_logs (
        submission_id,
        actor_app_user_id,
        target_app_user_id,
        eod_date,
        action_type,
        status_before,
        status_after,
        changes,
        changed_fields,
        comments_before,
        comments_after
    )
    values (
        p_submission_id,
        p_actor_app_user_id,
        v_submission.app_user_id,
        v_submission.eod_date,
        v_action_type,
        v_old_status,
        v_new_status,
        v_changes,
        v_changed_fields,
        v_old_comments,
        v_new_comments
    );

    return jsonb_build_object(
        'ok', true,
        'result', case
            when v_is_closed_edit then 'updated'
            when p_submit then 'submitted'
            else 'saved'
        end,
        'submission_id', p_submission_id,
        'status', v_new_status,
        'changed_fields', v_changed_fields,
        'missing_or_unconfirmed', v_missing,
        'reported_gaps', v_reported_gaps,
        'blocking_mismatches', 0,
        'value_semantics', 'absolute_total_replace_not_delta',
        'processed_at', now()
    );
end;
$$;

revoke all on function public.milhano_save_eod_submission(uuid, uuid, jsonb, text, boolean)
from public;
grant execute on function public.milhano_save_eod_submission(uuid, uuid, jsonb, text, boolean)
to service_role;

commit;

-- ------------------------------------------------------------
-- Validation
-- ------------------------------------------------------------
select
    to_regclass('public.milhano_eod_change_logs') is not null as log_table_exists,
    to_regclass('public.vw_milhano_eod_change_logs') is not null as log_view_exists;

select
    routine_name,
    security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'milhano_save_eod_submission';


-- ============================================================================
-- CONSOLIDATED SECTION: MILHANO_16_2_ST_DETAIL_FUNNEL.sql
-- ============================================================================

-- ============================================================
-- MILHANO | V16.2 | ST DETAIL + CLOSED + FUNNEL SUPPORT
-- Date: 2026-08-19
--
-- Adds:
-- 1) Manual Closed metric in EOD.
-- 2) Structured manual School Tour booking / outcome details.
-- 3) Student level on the manual ST record (Primaria/Secundaria/Prepa).
-- 4) Atomic V16.2 EOD save wrapper: KPI totals + ST detail in one transaction.
-- 5) GHL Meaningful foundation:
--      Call >= 120 sec OR WhatsApp event explicitly classified meaningful.
--    WhatsApp classification is FALSE by default until the existing sync / future
--    orchestrator supplies the semantic flag. No extra n8n workflow is required.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- A. EOD metric: Closed is now a normal manual total.
-- ------------------------------------------------------------
update public.milhano_eod_metric_catalog
set
    label = 'Closed',
    description = 'Final total of leads reported as closed/enrolled during this EOD. In V16.2 it can be derived from School Tour outcomes marked Closed.',
    display_order = 10,
    is_system_only = false,
    requires_user_confirmation = true,
    blocks_submission_on_mismatch = false,
    is_active = true
where metric_key = 'closed_leads';

-- If an older database somehow does not contain closed_leads, create it safely.
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
select
    'closed_leads',
    'Closed',
    'Final total of leads reported as closed/enrolled during this EOD. In V16.2 it can be derived from School Tour outcomes marked Closed.',
    10,
    false,
    true,
    false,
    true
where not exists (
    select 1
    from public.milhano_eod_metric_catalog
    where metric_key = 'closed_leads'
);

-- Keep the simple EOD order stable.
update public.milhano_eod_metric_catalog set display_order = 1 where metric_key = 'new_leads_received';
update public.milhano_eod_metric_catalog set display_order = 2 where metric_key = 'ads_leads_reported';
update public.milhano_eod_metric_catalog set display_order = 3 where metric_key = 'organic_leads_reported';
update public.milhano_eod_metric_catalog set display_order = 4 where metric_key = 'contacted_reported';
update public.milhano_eod_metric_catalog set display_order = 5 where metric_key = 'responses_reported';
update public.milhano_eod_metric_catalog set display_order = 6 where metric_key = 'meaningful_conversations_reported';
update public.milhano_eod_metric_catalog set display_order = 7 where metric_key = 'qualified_leads';
update public.milhano_eod_metric_catalog set display_order = 8 where metric_key = 'school_tours_scheduled';
update public.milhano_eod_metric_catalog set display_order = 9 where metric_key = 'school_tours_attended';
update public.milhano_eod_metric_catalog set display_order = 10 where metric_key = 'closed_leads';

-- ------------------------------------------------------------
-- B. Structured manual School Tour record.
-- One record represents one reported booking. Attendance/outcome can be attached
-- later from another EOD without losing the original booking date.
-- ------------------------------------------------------------
create table if not exists public.milhano_eod_school_tour_records (
    id uuid primary key default gen_random_uuid(),
    client_key text not null,

    booking_submission_id uuid not null
      references public.milhano_eod_submissions(id) on delete cascade,
    booking_eod_date date not null,
    advisor_app_user_id uuid not null
      references public.milhano_app_users(id),

    ghl_opportunity_id text not null,
    ghl_contact_id text,
    contact_name text,
    student_name text,
    phone text,

    school_level text not null default 'unknown',
    scheduled_for timestamptz not null,

    attendance_submission_id uuid
      references public.milhano_eod_submissions(id) on delete set null,
    attendance_eod_date date,
    attendance_status text not null default 'pending',
    close_outcome text not null default 'pending',
    outcome_note text,

    is_active boolean not null default true,
    created_by_app_user_id uuid references public.milhano_app_users(id),
    updated_by_app_user_id uuid references public.milhano_app_users(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint milhano_eod_school_tour_level_check
      check (school_level in ('primaria', 'secundaria', 'prepa', 'unknown')),
    constraint milhano_eod_school_tour_attendance_check
      check (attendance_status in ('pending', 'show', 'no_show')),
    constraint milhano_eod_school_tour_close_check
      check (close_outcome in ('pending', 'closed', 'not_closed')),
    constraint milhano_eod_school_tour_client_key_unique
      unique (booking_submission_id, client_key)
);

create index if not exists idx_milhano_eod_tour_booking_date
  on public.milhano_eod_school_tour_records (booking_eod_date desc, advisor_app_user_id);

create index if not exists idx_milhano_eod_tour_attendance_date
  on public.milhano_eod_school_tour_records (attendance_eod_date desc, advisor_app_user_id);

create index if not exists idx_milhano_eod_tour_opportunity
  on public.milhano_eod_school_tour_records (ghl_opportunity_id, scheduled_for desc);

-- ------------------------------------------------------------
-- C. Simple detail log for ST changes. This complements the KPI-level V15 log.
-- ------------------------------------------------------------
create table if not exists public.milhano_eod_school_tour_change_logs (
    id uuid primary key default gen_random_uuid(),
    submission_id uuid not null references public.milhano_eod_submissions(id) on delete cascade,
    actor_app_user_id uuid references public.milhano_app_users(id),
    target_app_user_id uuid not null references public.milhano_app_users(id),
    eod_date date not null,
    before_state jsonb not null default '[]'::jsonb,
    after_state jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists idx_milhano_eod_tour_change_logs_date
  on public.milhano_eod_school_tour_change_logs (eod_date desc, created_at desc);

create or replace view public.vw_milhano_eod_school_tour_change_logs
with (security_invoker = true)
as
select
    l.id,
    l.submission_id,
    l.created_at,
    l.eod_date,
    l.before_state,
    l.after_state,
    l.actor_app_user_id,
    actor.display_name as actor_name,
    l.target_app_user_id,
    target.display_name as advisor_name
from public.milhano_eod_school_tour_change_logs l
left join public.milhano_app_users actor
  on actor.id = l.actor_app_user_id
join public.milhano_app_users target
  on target.id = l.target_app_user_id;

-- ------------------------------------------------------------
-- D. Meaningful foundation for GHL/System.
-- Calls can be determined now. WhatsApp requires semantic classification in
-- the existing reconciliation layer; the column is ready but defaults false.
-- ------------------------------------------------------------
alter table public.milhano_communication_events
  add column if not exists is_meaningful_whatsapp boolean not null default false;

alter table public.milhano_communication_events
  add column if not exists meaningful_classification_reason text;

update public.milhano_reconciliation_metric_catalog
set
    label = 'Meaningful Conversations',
    display_order = 5,
    metric_scope = 'selected_period',
    eod_metric_key = 'meaningful_conversations_reported',
    show_in_cascade = true,
    supports_manual_extra = true,
    definition = 'System = distinct leads with a GHL call lasting at least 120 seconds OR a WhatsApp event explicitly classified as school-information provided. Reported = advisor manual Meaningful total. WhatsApp semantic classification remains conservative until the existing sync/orchestrator supplies the flag.',
    is_active = true,
    updated_at = now()
where metric_key = 'meaningful_conversations';

-- Rebuild cascade with system Meaningful support.
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
            ('meaningful_conversations', 'Meaningful Conversations', 5, 'selected_period',
             'Distinct leads with a GHL call >=120 seconds or WhatsApp explicitly classified as school-information provided.'),
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
    standard_activity as (
        select
            activity.metric_key,
            activity.activity_at,
            activity.ghl_opportunity_id,
            activity.ghl_contact_id,
            activity.activity_id
        from public.vw_milhano_operational_cascade_activity activity
        cross join bounds
        where activity.metric_key <> 'meaningful_conversations'
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
    meaningful_activity as (
        select
            'meaningful_conversations'::text as metric_key,
            c.event_timestamp as activity_at,
            coalesce(c.ghl_opportunity_id, mapped.ghl_opportunity_id) as ghl_opportunity_id,
            c.ghl_contact_id,
            ('meaningful:' || c.event_id)::text as activity_id
        from public.milhano_communication_events c
        left join lateral (
            select o.ghl_opportunity_id
            from public.milhano_opportunities o
            where o.ghl_contact_id = c.ghl_contact_id
            order by o.updated_at desc nulls last, o.created_at desc nulls last
            limit 1
        ) mapped on true
        cross join bounds
        where c.event_timestamp >= bounds.start_at
          and c.event_timestamp < bounds.end_at
          and coalesce(c.ghl_opportunity_id, mapped.ghl_opportunity_id) is not null
          and (
              (
                lower(c.channel) = 'call'
                and coalesce(c.call_duration_seconds, 0) >= 120
                and coalesce(c.is_connected_raw, false) = true
              )
              or (
                lower(c.channel) = 'whatsapp'
                and coalesce(c.is_meaningful_whatsapp, false) = true
              )
          )
    ),
    filtered as (
        select * from standard_activity
        union all
        select * from meaningful_activity
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

revoke all on function public.milhano_get_operational_cascade(date, date) from public;
grant execute on function public.milhano_get_operational_cascade(date, date) to service_role;



-- Meaningful drill-down must use the same V16.2 criteria as the scorecard.
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
    standard_filtered as (
        select
            activity.metric_key,
            activity.activity_at,
            activity.ghl_opportunity_id,
            activity.ghl_contact_id
        from public.vw_milhano_operational_cascade_activity activity
        cross join bounds
        where p_metric_key <> 'meaningful_conversations'
          and activity.metric_key = p_metric_key
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
    meaningful_filtered as (
        select
            'meaningful_conversations'::text as metric_key,
            c.event_timestamp as activity_at,
            coalesce(c.ghl_opportunity_id, mapped.ghl_opportunity_id) as ghl_opportunity_id,
            c.ghl_contact_id
        from public.milhano_communication_events c
        left join lateral (
            select o.ghl_opportunity_id
            from public.milhano_opportunities o
            where o.ghl_contact_id = c.ghl_contact_id
            order by o.updated_at desc nulls last, o.created_at desc nulls last
            limit 1
        ) mapped on true
        cross join bounds
        where p_metric_key = 'meaningful_conversations'
          and c.event_timestamp >= bounds.start_at
          and c.event_timestamp < bounds.end_at
          and coalesce(c.ghl_opportunity_id, mapped.ghl_opportunity_id) is not null
          and (
              (
                lower(c.channel) = 'call'
                and coalesce(c.call_duration_seconds, 0) >= 120
                and coalesce(c.is_connected_raw, false) = true
              )
              or (
                lower(c.channel) = 'whatsapp'
                and coalesce(c.is_meaningful_whatsapp, false) = true
              )
          )
    ),
    filtered as (
        select * from standard_filtered
        union all
        select * from meaningful_filtered
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


-- ------------------------------------------------------------
-- E. Atomic V16.2 save wrapper.
-- Existing KPI save remains the source of truth and logging for totals.
-- This function adds/replaces ST detail in the same transaction.
-- ------------------------------------------------------------
create or replace function public.milhano_save_eod_v162(
    p_submission_id uuid,
    p_actor_app_user_id uuid,
    p_metrics jsonb,
    p_comments text default null,
    p_submit boolean default false,
    p_bookings jsonb default '[]'::jsonb,
    p_attendance jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_result jsonb;
    v_submission public.milhano_eod_submissions%rowtype;
    v_item jsonb;
    v_id uuid;
    v_client_key text;
    v_opportunity_id text;
    v_contact_id text;
    v_contact_name text;
    v_student_name text;
    v_phone text;
    v_level text;
    v_scheduled_for timestamptz;
    v_booking_id uuid;
    v_attendance_status text;
    v_close_outcome text;
    v_note text;
    v_keep_booking_ids uuid[] := array[]::uuid[];
    v_keep_attendance_ids uuid[] := array[]::uuid[];
    v_before jsonb;
    v_after jsonb;
begin
    if p_bookings is null or jsonb_typeof(p_bookings) <> 'array' then
        raise exception 'p_bookings must be a JSON array';
    end if;
    if p_attendance is null or jsonb_typeof(p_attendance) <> 'array' then
        raise exception 'p_attendance must be a JSON array';
    end if;

    select * into v_submission
    from public.milhano_eod_submissions
    where id = p_submission_id;

    if not found then
        raise exception 'EOD submission not found';
    end if;

    select coalesce(jsonb_agg(to_jsonb(t) order by t.scheduled_for, t.id), '[]'::jsonb)
    into v_before
    from public.milhano_eod_school_tour_records t
    where t.is_active = true
      and (
        t.booking_submission_id = p_submission_id
        or t.attendance_submission_id = p_submission_id
      );

    -- Existing save function validates permissions and saves KPI totals.
    -- If anything below fails, PostgreSQL rolls back the whole RPC transaction.
    v_result := public.milhano_save_eod_submission(
        p_submission_id,
        p_actor_app_user_id,
        p_metrics,
        p_comments,
        p_submit
    );

    -- Full replacement of booking details belonging to this EOD.
    for v_item in select value from jsonb_array_elements(p_bookings)
    loop
        v_client_key := nullif(trim(v_item ->> 'client_key'), '');
        v_opportunity_id := nullif(trim(v_item ->> 'ghl_opportunity_id'), '');

        -- Blank legacy slot: preserve the KPI count but do not invent a contact row.
        if v_client_key is null or v_opportunity_id is null then
            continue;
        end if;

        select
            o.ghl_contact_id,
            o.contact_name,
            o.student_name,
            o.phone
        into
            v_contact_id,
            v_contact_name,
            v_student_name,
            v_phone
        from public.milhano_opportunities o
        where o.ghl_opportunity_id = v_opportunity_id
        limit 1;

        if not found then
            raise exception 'Opportunity % not found', v_opportunity_id;
        end if;

        v_level := lower(coalesce(nullif(trim(v_item ->> 'school_level'), ''), 'unknown'));
        if v_level not in ('primaria', 'secundaria', 'prepa', 'unknown') then
            raise exception 'Invalid school level for %', v_opportunity_id;
        end if;

        begin
            v_scheduled_for := nullif(trim(v_item ->> 'scheduled_local'), '')::timestamp
                               at time zone 'America/Merida';
        exception when others then
            raise exception 'Invalid School Tour date/time for %', v_opportunity_id;
        end;

        if v_scheduled_for is null then
            raise exception 'School Tour date/time is required for %', v_opportunity_id;
        end if;

        begin
            v_id := nullif(trim(v_item ->> 'id'), '')::uuid;
        exception when others then
            v_id := null;
        end;

        if v_id is not null and exists (
            select 1
            from public.milhano_eod_school_tour_records
            where id = v_id
              and booking_submission_id = p_submission_id
        ) then
            update public.milhano_eod_school_tour_records
            set
                client_key = v_client_key,
                ghl_opportunity_id = v_opportunity_id,
                ghl_contact_id = v_contact_id,
                contact_name = v_contact_name,
                student_name = v_student_name,
                phone = v_phone,
                school_level = v_level,
                scheduled_for = v_scheduled_for,
                is_active = true,
                updated_by_app_user_id = p_actor_app_user_id,
                updated_at = now()
            where id = v_id
            returning id into v_booking_id;
        else
            insert into public.milhano_eod_school_tour_records (
                client_key,
                booking_submission_id,
                booking_eod_date,
                advisor_app_user_id,
                ghl_opportunity_id,
                ghl_contact_id,
                contact_name,
                student_name,
                phone,
                school_level,
                scheduled_for,
                created_by_app_user_id,
                updated_by_app_user_id
            ) values (
                v_client_key,
                p_submission_id,
                v_submission.eod_date,
                v_submission.app_user_id,
                v_opportunity_id,
                v_contact_id,
                v_contact_name,
                v_student_name,
                v_phone,
                v_level,
                v_scheduled_for,
                p_actor_app_user_id,
                p_actor_app_user_id
            )
            on conflict (booking_submission_id, client_key)
            do update set
                ghl_opportunity_id = excluded.ghl_opportunity_id,
                ghl_contact_id = excluded.ghl_contact_id,
                contact_name = excluded.contact_name,
                student_name = excluded.student_name,
                phone = excluded.phone,
                school_level = excluded.school_level,
                scheduled_for = excluded.scheduled_for,
                is_active = true,
                updated_by_app_user_id = excluded.updated_by_app_user_id,
                updated_at = now()
            returning id into v_booking_id;
        end if;

        v_keep_booking_ids := array_append(v_keep_booking_ids, v_booking_id);
    end loop;

    update public.milhano_eod_school_tour_records
    set
        is_active = false,
        updated_by_app_user_id = p_actor_app_user_id,
        updated_at = now()
    where booking_submission_id = p_submission_id
      and is_active = true
      and not (id = any(v_keep_booking_ids));

    -- Remove attendance rows previously reported by THIS EOD unless they are
    -- sent again below. This does not affect attendance reported by another EOD.
    for v_item in select value from jsonb_array_elements(p_attendance)
    loop
        begin
            v_booking_id := nullif(trim(v_item ->> 'booking_id'), '')::uuid;
        exception when others then
            v_booking_id := null;
        end;

        if v_booking_id is null then
            v_client_key := nullif(trim(v_item ->> 'booking_client_key'), '');
            if v_client_key is not null then
                select id into v_booking_id
                from public.milhano_eod_school_tour_records
                where booking_submission_id = p_submission_id
                  and client_key = v_client_key
                  and is_active = true
                limit 1;
            end if;
        end if;

        -- Blank legacy slot: preserve the KPI total; do not invent an outcome.
        if v_booking_id is null then
            continue;
        end if;

        if not exists (
            select 1
            from public.milhano_eod_school_tour_records t
            where t.id = v_booking_id
              and t.is_active = true
              and t.booking_eod_date <= v_submission.eod_date
              and (
                t.attendance_submission_id is null
                or t.attendance_submission_id = p_submission_id
              )
        ) then
            raise exception 'School Tour booking % cannot be reported in this EOD', v_booking_id;
        end if;

        v_attendance_status := lower(coalesce(nullif(trim(v_item ->> 'attendance_status'), ''), 'show'));
        if v_attendance_status not in ('show', 'no_show') then
            raise exception 'Invalid attendance status';
        end if;

        v_close_outcome := lower(coalesce(nullif(trim(v_item ->> 'close_outcome'), ''), 'not_closed'));
        if v_attendance_status = 'no_show' then
            v_close_outcome := 'not_closed';
        elsif v_close_outcome not in ('closed', 'not_closed') then
            raise exception 'Invalid close outcome';
        end if;

        v_note := nullif(trim(v_item ->> 'outcome_note'), '');

        update public.milhano_eod_school_tour_records
        set
            attendance_submission_id = p_submission_id,
            attendance_eod_date = v_submission.eod_date,
            attendance_status = v_attendance_status,
            close_outcome = v_close_outcome,
            outcome_note = v_note,
            updated_by_app_user_id = p_actor_app_user_id,
            updated_at = now()
        where id = v_booking_id;

        v_keep_attendance_ids := array_append(v_keep_attendance_ids, v_booking_id);
    end loop;

    update public.milhano_eod_school_tour_records
    set
        attendance_submission_id = null,
        attendance_eod_date = null,
        attendance_status = 'pending',
        close_outcome = 'pending',
        outcome_note = null,
        updated_by_app_user_id = p_actor_app_user_id,
        updated_at = now()
    where attendance_submission_id = p_submission_id
      and not (id = any(v_keep_attendance_ids));

    select coalesce(jsonb_agg(to_jsonb(t) order by t.scheduled_for, t.id), '[]'::jsonb)
    into v_after
    from public.milhano_eod_school_tour_records t
    where t.is_active = true
      and (
        t.booking_submission_id = p_submission_id
        or t.attendance_submission_id = p_submission_id
      );

    if v_before is distinct from v_after then
        insert into public.milhano_eod_school_tour_change_logs (
            submission_id,
            actor_app_user_id,
            target_app_user_id,
            eod_date,
            before_state,
            after_state
        ) values (
            p_submission_id,
            p_actor_app_user_id,
            v_submission.app_user_id,
            v_submission.eod_date,
            v_before,
            v_after
        );
    end if;

    return v_result || jsonb_build_object(
        'tour_detail_saved', true,
        'tour_detail_changed', (v_before is distinct from v_after),
        'policy', 'v16_2_structured_school_tour_reporting'
    );
end;
$$;

revoke all on function public.milhano_save_eod_v162(uuid, uuid, jsonb, text, boolean, jsonb, jsonb)
from public;
grant execute on function public.milhano_save_eod_v162(uuid, uuid, jsonb, text, boolean, jsonb, jsonb)
to service_role;

commit;

-- ------------------------------------------------------------
-- Validation outputs.
-- ------------------------------------------------------------
select
    metric_key,
    label,
    display_order,
    is_system_only,
    is_active
from public.milhano_eod_metric_catalog
where metric_key in (
  'school_tours_scheduled',
  'school_tours_attended',
  'closed_leads'
)
order by display_order;

select
    to_regclass('public.milhano_eod_school_tour_records') is not null as tour_table_exists,
    to_regclass('public.vw_milhano_eod_school_tour_change_logs') is not null as tour_log_view_exists;

select
    routine_name,
    security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'milhano_save_eod_v162';


-- ============================================================================
-- CURRENT SECTION: GHL APPOINTMENT SYNC
-- ============================================================================

-- =============================================================================
-- MILHANO | 09 v2 | GHL APPOINTMENT SYNC
-- Run once in Supabase BEFORE activating the appointment-enabled orchestrator.
-- =============================================================================

begin;

create table if not exists public.milhano_ghl_appointments (
    appointment_id text primary key,
    location_id text not null,
    calendar_id text not null,
    calendar_name text,
    appointment_type text not null default 'other'
        check (appointment_type in ('school_tour', 'trial_day', 'other')),
    ghl_contact_id text,
    ghl_opportunity_id text,
    title text,
    appointment_status text not null default 'unknown',
    start_time timestamptz,
    end_time timestamptz,
    assigned_user_id text,
    address text,
    notes text,
    date_added timestamptz,
    date_updated timestamptz,
    raw_payload jsonb not null default '{}'::jsonb,
    first_synced_at timestamptz not null default now(),
    last_synced_at timestamptz not null default now()
);

create index if not exists idx_milhano_ghl_appointments_contact
    on public.milhano_ghl_appointments (ghl_contact_id, start_time desc);

create index if not exists idx_milhano_ghl_appointments_opportunity
    on public.milhano_ghl_appointments (ghl_opportunity_id, start_time desc);

create index if not exists idx_milhano_ghl_appointments_calendar
    on public.milhano_ghl_appointments (calendar_id, start_time desc);

create index if not exists idx_milhano_ghl_appointments_type_status
    on public.milhano_ghl_appointments (
        appointment_type,
        appointment_status,
        start_time desc
    );

alter table public.milhano_ghl_appointments enable row level security;


create or replace function public.milhano_reconcile_appointments(
    p_location_id text,
    p_events jsonb,
    p_reconciled_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_item jsonb;
    v_appointment_id text;
    v_calendar_id text;
    v_calendar_name text;
    v_type text;
    v_contact_id text;
    v_opportunity_id text;
    v_status text;
    v_tour_status text;
    v_start timestamptz;
    v_end timestamptz;
    v_date_added timestamptz;
    v_date_updated timestamptz;

    v_processed integer := 0;
    v_school_tours integer := 0;
    v_trial_days integer := 0;
    v_mapped integer := 0;
    v_unmapped integer := 0;
    v_showed integer := 0;
    v_no_show integer := 0;
    v_cancelled integer := 0;
begin
    if nullif(trim(p_location_id), '') is null then
        raise exception 'location_id is required';
    end if;

    if p_events is null or jsonb_typeof(p_events) <> 'array' then
        raise exception 'p_events must be a JSON array';
    end if;

    for v_item in
        select value from jsonb_array_elements(p_events)
    loop
        v_appointment_id := nullif(trim(v_item ->> 'appointment_id'), '');
        v_calendar_id := nullif(trim(v_item ->> 'calendar_id'), '');
        v_calendar_name := nullif(trim(v_item ->> 'calendar_name'), '');
        v_type := lower(coalesce(nullif(trim(v_item ->> 'appointment_type'), ''), 'other'));
        v_contact_id := nullif(trim(v_item ->> 'contact_id'), '');
        v_status := lower(coalesce(nullif(trim(v_item ->> 'appointment_status'), ''), 'unknown'));

        if v_appointment_id is null or v_calendar_id is null then
            continue;
        end if;

        if v_type not in ('school_tour', 'trial_day', 'other') then
            v_type := 'other';
        end if;

        begin
            v_start := nullif(trim(v_item ->> 'start_time'), '')::timestamptz;
        exception when others then
            v_start := null;
        end;

        begin
            v_end := nullif(trim(v_item ->> 'end_time'), '')::timestamptz;
        exception when others then
            v_end := null;
        end;

        begin
            v_date_added := nullif(trim(v_item ->> 'date_added'), '')::timestamptz;
        exception when others then
            v_date_added := null;
        end;

        begin
            v_date_updated := nullif(trim(v_item ->> 'date_updated'), '')::timestamptz;
        exception when others then
            v_date_updated := null;
        end;

        v_opportunity_id := null;

        if v_contact_id is not null then
            select o.ghl_opportunity_id
            into v_opportunity_id
            from public.milhano_opportunities o
            where o.ghl_contact_id = v_contact_id
            order by
                o.updated_at desc nulls last,
                o.created_at desc nulls last
            limit 1;
        end if;

        insert into public.milhano_ghl_appointments (
            appointment_id,
            location_id,
            calendar_id,
            calendar_name,
            appointment_type,
            ghl_contact_id,
            ghl_opportunity_id,
            title,
            appointment_status,
            start_time,
            end_time,
            assigned_user_id,
            address,
            notes,
            date_added,
            date_updated,
            raw_payload,
            first_synced_at,
            last_synced_at
        )
        values (
            v_appointment_id,
            p_location_id,
            v_calendar_id,
            v_calendar_name,
            v_type,
            v_contact_id,
            v_opportunity_id,
            nullif(trim(v_item ->> 'title'), ''),
            v_status,
            v_start,
            v_end,
            nullif(trim(v_item ->> 'assigned_user_id'), ''),
            nullif(trim(v_item ->> 'address'), ''),
            nullif(trim(v_item ->> 'notes'), ''),
            v_date_added,
            v_date_updated,
            coalesce(v_item -> 'raw_payload', '{}'::jsonb),
            coalesce(p_reconciled_at, now()),
            coalesce(p_reconciled_at, now())
        )
        on conflict (appointment_id)
        do update set
            location_id = excluded.location_id,
            calendar_id = excluded.calendar_id,
            calendar_name = excluded.calendar_name,
            appointment_type = excluded.appointment_type,
            ghl_contact_id = excluded.ghl_contact_id,
            ghl_opportunity_id = excluded.ghl_opportunity_id,
            title = excluded.title,
            appointment_status = excluded.appointment_status,
            start_time = excluded.start_time,
            end_time = excluded.end_time,
            assigned_user_id = excluded.assigned_user_id,
            address = excluded.address,
            notes = excluded.notes,
            date_added = excluded.date_added,
            date_updated = excluded.date_updated,
            raw_payload = excluded.raw_payload,
            last_synced_at = excluded.last_synced_at;

        v_processed := v_processed + 1;

        if v_opportunity_id is null then
            v_unmapped := v_unmapped + 1;
        else
            v_mapped := v_mapped + 1;
        end if;

        if v_type = 'school_tour' then
            v_school_tours := v_school_tours + 1;

            if v_status in ('showed', 'completed') then
                v_tour_status := 'showed';
                v_showed := v_showed + 1;
            elsif v_status = 'noshow' then
                v_tour_status := 'no_show';
                v_no_show := v_no_show + 1;
            elsif v_status in ('cancelled', 'invalid') then
                v_tour_status := 'cancelled';
                v_cancelled := v_cancelled + 1;
            elsif v_status in ('new', 'confirmed', 'active') then
                v_tour_status := 'scheduled';
            else
                v_tour_status := 'unknown';
            end if;

            -- This table already drives School Tours Today and the fallback
            -- School Tours Attended logic in the current dashboard.
            if v_opportunity_id is not null then
                insert into public.milhano_school_tour_details (
                    ghl_opportunity_id,
                    scheduled_for,
                    attendance_status,
                    attended_at,
                    updated_at
                )
                values (
                    v_opportunity_id,
                    v_start,
                    v_tour_status,
                    case
                        when v_tour_status = 'showed' then v_start
                        else null
                    end,
                    coalesce(p_reconciled_at, now())
                )
                on conflict (ghl_opportunity_id)
                do update set
                    scheduled_for = excluded.scheduled_for,
                    attendance_status = excluded.attendance_status,
                    attended_at = excluded.attended_at,
                    updated_at = excluded.updated_at;
            end if;

        elsif v_type = 'trial_day' then
            v_trial_days := v_trial_days + 1;
        end if;
    end loop;

    return jsonb_build_object(
        'ok', true,
        'processed', v_processed,
        'school_tours', v_school_tours,
        'trial_days', v_trial_days,
        'mapped_to_opportunity', v_mapped,
        'unmapped_contact', v_unmapped,
        'school_tour_showed', v_showed,
        'school_tour_no_show', v_no_show,
        'school_tour_cancelled', v_cancelled,
        'reconciled_at', coalesce(p_reconciled_at, now())
    );
end;
$$;

revoke all on function public.milhano_reconcile_appointments(
    text, jsonb, timestamptz
) from public;

grant execute on function public.milhano_reconcile_appointments(
    text, jsonb, timestamptz
) to service_role;


-- Convenience audit view.
create or replace view public.vw_milhano_ghl_appointments
with (security_invoker = true)
as
select
    a.appointment_id,
    a.appointment_type,
    a.calendar_id,
    a.calendar_name,
    a.ghl_contact_id,
    a.ghl_opportunity_id,
    coalesce(
        nullif(trim(o.student_name), ''),
        nullif(trim(o.contact_name), ''),
        nullif(trim(o.opportunity_name), ''),
        a.ghl_contact_id,
        'Unmapped appointment'
    ) as lead_name,
    o.phone,
    o.current_stage,
    a.appointment_status,
    a.start_time,
    a.end_time,
    a.date_added,
    a.date_updated,
    a.last_synced_at
from public.milhano_ghl_appointments a
left join public.milhano_opportunities o
    on o.ghl_opportunity_id = a.ghl_opportunity_id;


commit;

-- Verification
select
    to_regclass('public.milhano_ghl_appointments') is not null
        as appointment_table_exists,
    to_regprocedure(
        'public.milhano_reconcile_appointments(text,jsonb,timestamptz)'
    ) is not null as appointment_rpc_exists,
    to_regclass('public.vw_milhano_ghl_appointments') is not null
        as appointment_view_exists;


-- ============================================================================
-- CURRENT SECTION: V17 STABILIZATION & PERFORMANCE
-- ============================================================================

-- =============================================================================
-- MILHANO ADMISSIONS | V17 STABILIZATION & PERFORMANCE
-- Generated: 2026-08-20
--
-- Goals
--   * Make GHL funnel metrics use one canonical activity layer.
--   * Responded = real response after human outreach OR connected call.
--   * Meaningful call threshold = 120 seconds.
--   * School Tour / Trial Day system metrics = synchronized GHL appointments.
--   * Exclude future-dated legacy stage events from operational KPIs.
--   * Add missing indexes responsible for excessive sequential scans.
--   * Provide true same-lead GHL transition percentages.
--   * Provide a single home-page payload RPC to reduce round trips.
--
-- Safe to run on the existing Milhano Supabase project after the appointment
-- sync migration. It does not delete historical records.
-- =============================================================================

begin;

do $$
begin
  if to_regclass('public.milhano_ghl_appointments') is null then
    raise exception 'V17 requires the GHL appointment sync migration first';
  end if;
  if to_regclass('public.milhano_eod_school_tour_records') is null then
    raise exception 'V17 requires the V16.2 structured EOD migration first';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 1. Performance indexes
-- -----------------------------------------------------------------------------
create index if not exists idx_milhano_opportunities_contact_updated
  on public.milhano_opportunities (ghl_contact_id, updated_at desc, created_at desc)
  where ghl_contact_id is not null;

create index if not exists idx_milhano_communication_contact_time
  on public.milhano_communication_events (ghl_contact_id, event_timestamp desc)
  where ghl_contact_id is not null;

create index if not exists idx_milhano_communication_opportunity_time
  on public.milhano_communication_events (ghl_opportunity_id, event_timestamp desc)
  where ghl_opportunity_id is not null;

create index if not exists idx_milhano_communication_channel_direction_time
  on public.milhano_communication_events (lower(channel), direction, event_timestamp desc);

create index if not exists idx_milhano_stage_events_opportunity_stage_time
  on public.milhano_stage_events (ghl_opportunity_id, to_stage, event_timestamp desc)
  where is_valid = true;

-- -----------------------------------------------------------------------------
-- 2. Resolve communication events to the current admissions opportunity once.
--    This replaces repeated lateral scans throughout downstream views.
-- -----------------------------------------------------------------------------
create or replace view public.vw_milhano_mapped_communication_events
with (security_invoker = true)
as
select
  c.*,
  coalesce(c.ghl_opportunity_id, mapped.ghl_opportunity_id) as resolved_ghl_opportunity_id
from public.milhano_communication_events c
left join lateral (
  select o.ghl_opportunity_id
  from public.milhano_opportunities o
  where c.ghl_opportunity_id is null
    and c.ghl_contact_id is not null
    and o.ghl_contact_id = c.ghl_contact_id
  order by o.updated_at desc nulls last, o.created_at desc nulls last
  limit 1
) mapped on true;

create or replace view public.vw_milhano_first_human_outbound
with (security_invoker = true)
as
select
  resolved_ghl_opportunity_id as ghl_opportunity_id,
  ghl_contact_id,
  min(event_timestamp) as first_human_outbound_at
from public.vw_milhano_mapped_communication_events
where resolved_ghl_opportunity_id is not null
  and (
    (
      lower(channel) = 'call'
      and direction = 'outbound'
      and coalesce(is_call_attempt, false) = true
    )
    or
    (
      lower(channel) = 'whatsapp'
      and direction = 'outbound'
      and coalesce(is_eod_countable, false) = true
    )
  )
group by resolved_ghl_opportunity_id, ghl_contact_id;

-- -----------------------------------------------------------------------------
-- 3. Qualified / Fit canonical event.
--    Future-dated legacy rows are retained for audit but excluded operationally.
-- -----------------------------------------------------------------------------
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
    and e.event_timestamp <= now() + interval '5 minutes'
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

-- -----------------------------------------------------------------------------
-- 4. Canonical automated funnel activity.
-- -----------------------------------------------------------------------------
create or replace view public.vw_milhano_operational_cascade_activity
with (security_invoker = true)
as

-- New Lead
select
  'new_leads'::text as metric_key,
  coalesce(o.original_lead_date, o.created_at) as activity_at,
  o.ghl_opportunity_id,
  o.ghl_contact_id,
  ('lead:' || o.ghl_opportunity_id)::text as activity_id
from public.milhano_opportunities o
where coalesce(o.original_lead_date, o.created_at) is not null

union all

-- Number of Dials = actions, not unique leads.
select
  'number_of_dials',
  c.event_timestamp,
  c.resolved_ghl_opportunity_id,
  c.ghl_contact_id,
  c.event_id
from public.vw_milhano_mapped_communication_events c
where lower(c.channel) = 'call'
  and c.direction = 'outbound'
  and coalesce(c.is_call_attempt, false) = true

union all

-- Connected outbound calls (support metric).
select
  'answered_calls',
  c.event_timestamp,
  c.resolved_ghl_opportunity_id,
  c.ghl_contact_id,
  c.event_id
from public.vw_milhano_mapped_communication_events c
where lower(c.channel) = 'call'
  and c.direction = 'outbound'
  and coalesce(c.is_call_attempt, false) = true
  and coalesce(c.is_connected_raw, false) = true

union all

-- Unique Contacted = at least one human/countable outbound call or WhatsApp.
select
  'unique_contacted_leads',
  c.event_timestamp,
  c.resolved_ghl_opportunity_id,
  c.ghl_contact_id,
  ('contact:' || c.event_id)::text
from public.vw_milhano_mapped_communication_events c
where c.resolved_ghl_opportunity_id is not null
  and (
    (
      lower(c.channel) = 'call'
      and c.direction = 'outbound'
      and coalesce(c.is_call_attempt, false) = true
    )
    or
    (
      lower(c.channel) = 'whatsapp'
      and c.direction = 'outbound'
      and coalesce(c.is_eod_countable, false) = true
    )
  )

union all

-- Responded via WhatsApp only when the inbound message happened AFTER human
-- outreach. This excludes the initial Click-to-WhatsApp inquiry message.
select
  'responded_leads',
  c.event_timestamp,
  c.resolved_ghl_opportunity_id,
  c.ghl_contact_id,
  ('response-wa:' || c.event_id)::text
from public.vw_milhano_mapped_communication_events c
join public.vw_milhano_first_human_outbound first_out
  on first_out.ghl_opportunity_id = c.resolved_ghl_opportunity_id
where lower(c.channel) = 'whatsapp'
  and c.direction = 'inbound'
  and c.event_timestamp > first_out.first_human_outbound_at

union all

-- A connected call is also a response regardless of call direction.
select
  'responded_leads',
  c.event_timestamp,
  c.resolved_ghl_opportunity_id,
  c.ghl_contact_id,
  ('response-call:' || c.event_id)::text
from public.vw_milhano_mapped_communication_events c
where lower(c.channel) = 'call'
  and c.direction in ('outbound', 'inbound')
  and coalesce(c.is_connected_raw, false) = true
  and c.resolved_ghl_opportunity_id is not null

union all

-- Meaningful = connected 2+ minute call OR WhatsApp explicitly classified as
-- school-information-provided. WhatsApp semantic classification can be populated
-- by the orchestrator later without changing dashboard SQL.
select
  'meaningful_conversations',
  c.event_timestamp,
  c.resolved_ghl_opportunity_id,
  c.ghl_contact_id,
  ('meaningful:' || c.event_id)::text
from public.vw_milhano_mapped_communication_events c
where c.resolved_ghl_opportunity_id is not null
  and (
    (
      lower(c.channel) = 'call'
      and coalesce(c.is_connected_raw, false) = true
      and coalesce(c.call_duration_seconds, 0) >= 120
    )
    or
    (
      lower(c.channel) = 'whatsapp'
      and coalesce(c.is_meaningful_whatsapp, false) = true
    )
  )

union all

-- Qualified / Fit.
select
  'qualified_leads',
  q.qualified_at,
  q.ghl_opportunity_id,
  q.ghl_contact_id,
  q.event_id
from public.vw_milhano_qualification_events q

union all

-- School Tour Booked = unique lead with a non-cancelled GHL appointment.
select
  'school_tours_booked',
  a.start_time,
  a.ghl_opportunity_id,
  a.ghl_contact_id,
  ('appt-st-booked:' || a.appointment_id)::text
from public.milhano_ghl_appointments a
where a.appointment_type = 'school_tour'
  and a.start_time is not null
  and lower(coalesce(a.appointment_status, 'unknown')) not in (
    'cancelled', 'canceled', 'invalid'
  )

union all

-- Current-day schedule indicator.
select
  'school_tours_today',
  a.start_time,
  a.ghl_opportunity_id,
  a.ghl_contact_id,
  ('appt-st-today:' || a.appointment_id)::text
from public.milhano_ghl_appointments a
where a.appointment_type = 'school_tour'
  and a.start_time is not null
  and lower(coalesce(a.appointment_status, 'unknown')) not in (
    'cancelled', 'canceled', 'invalid'
  )

union all

-- School Tour Attended = appointment itself says the visit happened.
select
  'school_tours_attended',
  a.start_time,
  a.ghl_opportunity_id,
  a.ghl_contact_id,
  ('appt-st-show:' || a.appointment_id)::text
from public.milhano_ghl_appointments a
where a.appointment_type = 'school_tour'
  and a.start_time is not null
  and lower(coalesce(a.appointment_status, '')) in (
    'showed', 'completed', 'show', 'attended'
  )

union all

select
  'trial_days_booked',
  a.start_time,
  a.ghl_opportunity_id,
  a.ghl_contact_id,
  ('appt-trial-booked:' || a.appointment_id)::text
from public.milhano_ghl_appointments a
where a.appointment_type = 'trial_day'
  and a.start_time is not null
  and lower(coalesce(a.appointment_status, 'unknown')) not in (
    'cancelled', 'canceled', 'invalid'
  )

union all

select
  'trial_days_showed',
  a.start_time,
  a.ghl_opportunity_id,
  a.ghl_contact_id,
  ('appt-trial-show:' || a.appointment_id)::text
from public.milhano_ghl_appointments a
where a.appointment_type = 'trial_day'
  and a.start_time is not null
  and lower(coalesce(a.appointment_status, '')) in (
    'showed', 'completed', 'show', 'attended'
  )

union all

-- Closed / enrolled. Future-dated Excel legacy events are audit data only.
select
  'closed',
  e.event_timestamp,
  e.ghl_opportunity_id,
  e.ghl_contact_id,
  e.event_id
from public.milhano_stage_events e
where e.is_valid = true
  and e.to_stage = 'Inscrito'
  and e.event_timestamp <= now() + interval '5 minutes';

-- -----------------------------------------------------------------------------
-- 5. Daily KPI view uses the same canonical sources as the GHL funnel.
-- -----------------------------------------------------------------------------
create or replace view public.vw_milhano_daily_kpis
with (security_invoker = true)
as
with
lead_days as (
  select
    (coalesce(o.original_lead_date, o.created_at) at time zone 'America/Merida')::date as metric_date,
    count(distinct o.ghl_opportunity_id)::bigint as new_leads
  from public.milhano_opportunities o
  where coalesce(o.original_lead_date, o.created_at) is not null
  group by 1
),
stage_days as (
  select
    (e.event_timestamp at time zone 'America/Merida')::date as metric_date,
    count(distinct e.ghl_opportunity_id) filter (
      where e.to_stage in ('No responde','Seguimiento','No responde / Seguimiento')
    )::bigint as entered_followup,
    count(distinct e.ghl_opportunity_id) filter (where e.to_stage = 'Retroalimentación')::bigint as feedbacks,
    count(distinct e.ghl_opportunity_id) filter (where e.to_stage = 'En evaluación')::bigint as evaluations,
    count(distinct e.ghl_opportunity_id) filter (where e.to_stage = 'Inscripción en proceso')::bigint as enrollment_process_started,
    count(distinct e.ghl_opportunity_id) filter (where e.to_stage = 'Inscrito')::bigint as enrolled,
    count(distinct e.ghl_opportunity_id) filter (where e.to_stage = 'No fit')::bigint as no_fit,
    count(distinct e.ghl_opportunity_id) filter (where e.to_stage = 'Lost / Sin continuidad')::bigint as lost
  from public.milhano_stage_events e
  where e.is_valid = true
    and e.event_timestamp <= now() + interval '5 minutes'
  group by 1
),
fit_days as (
  select
    (q.qualified_at at time zone 'America/Merida')::date as metric_date,
    count(distinct q.ghl_opportunity_id)::bigint as fits
  from public.vw_milhano_qualification_events q
  group by 1
),
appointment_days as (
  select
    (a.start_time at time zone 'America/Merida')::date as metric_date,
    count(distinct coalesce(a.ghl_opportunity_id,a.ghl_contact_id,a.appointment_id)) filter (
      where a.appointment_type='school_tour'
        and lower(coalesce(a.appointment_status,'unknown')) not in ('cancelled','canceled','invalid')
    )::bigint as tours_scheduled,
    count(distinct coalesce(a.ghl_opportunity_id,a.ghl_contact_id,a.appointment_id)) filter (
      where a.appointment_type='school_tour'
        and lower(coalesce(a.appointment_status,'')) in ('showed','completed','show','attended')
    )::bigint as tours_attended,
    count(distinct coalesce(a.ghl_opportunity_id,a.ghl_contact_id,a.appointment_id)) filter (
      where a.appointment_type='trial_day'
        and lower(coalesce(a.appointment_status,'unknown')) not in ('cancelled','canceled','invalid')
    )::bigint as passdays_scheduled,
    count(distinct coalesce(a.ghl_opportunity_id,a.ghl_contact_id,a.appointment_id)) filter (
      where a.appointment_type='trial_day'
        and lower(coalesce(a.appointment_status,'')) in ('showed','completed','show','attended')
    )::bigint as passdays_attended
  from public.milhano_ghl_appointments a
  where a.start_time is not null
  group by 1
),
call_days as (
  select
    (c.activity_timestamp at time zone 'America/Merida')::date as metric_date,
    count(*)::bigint as calls,
    count(distinct c.ghl_opportunity_id)::bigint as opportunities_called
  from public.milhano_call_events c
  group by 1
),
bounds as (
  select
    least(
      coalesce((select min(metric_date) from lead_days), current_date),
      coalesce((select min(metric_date) from stage_days), current_date),
      coalesce((select min(metric_date) from appointment_days), current_date),
      coalesce((select min(metric_date) from call_days), current_date)
    ) as min_date,
    greatest(
      coalesce((select max(metric_date) from lead_days), current_date),
      coalesce((select max(metric_date) from stage_days), current_date),
      coalesce((select max(metric_date) from appointment_days), current_date),
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
  coalesce(ld.new_leads,0) as new_leads,
  coalesce(sd.entered_followup,0) as entered_followup,
  coalesce(fd.fits,0) as fits,
  coalesce(ad.tours_scheduled,0) as tours_scheduled,
  coalesce(ad.tours_attended,0) as tours_attended,
  coalesce(ad.passdays_scheduled,0) as passdays_scheduled,
  coalesce(ad.passdays_attended,0) as passdays_attended,
  coalesce(sd.feedbacks,0) as feedbacks,
  coalesce(sd.evaluations,0) as evaluations,
  coalesce(sd.enrollment_process_started,0) as enrollment_process_started,
  coalesce(sd.enrolled,0) as enrolled,
  coalesce(sd.no_fit,0) as no_fit,
  coalesce(sd.lost,0) as lost,
  coalesce(cd.calls,0) as calls,
  coalesce(cd.opportunities_called,0) as opportunities_called
from calendar cal
left join lead_days ld on ld.metric_date=cal.metric_date
left join stage_days sd on sd.metric_date=cal.metric_date
left join fit_days fd on fd.metric_date=cal.metric_date
left join appointment_days ad on ad.metric_date=cal.metric_date
left join call_days cd on cd.metric_date=cal.metric_date
order by cal.metric_date;

-- -----------------------------------------------------------------------------
-- 6. Canonical scorecard function.
-- -----------------------------------------------------------------------------
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
  catalog as (
    select metric_key, label, display_order, metric_scope, definition
    from public.milhano_reconciliation_metric_catalog
    where is_active = true
      and show_in_cascade = true
  ),
  filtered as (
    select a.*
    from public.vw_milhano_operational_cascade_activity a
    cross join bounds b
    where (
      a.metric_key = 'school_tours_today'
      and (a.activity_at at time zone 'America/Merida')::date = b.local_today
    )
    or (
      a.metric_key <> 'school_tours_today'
      and a.activity_at >= b.start_at
      and a.activity_at < b.end_at
    )
  )
  select
    c.metric_key,
    c.label,
    c.display_order,
    case
      when c.metric_key = 'number_of_dials'
        then count(f.activity_id)
      else count(distinct coalesce(f.ghl_opportunity_id, f.ghl_contact_id, f.activity_id))
    end::bigint as metric_value,
    c.metric_scope,
    c.definition
  from catalog c
  left join filtered f on f.metric_key = c.metric_key
  group by c.metric_key, c.label, c.display_order, c.metric_scope, c.definition
  order by c.display_order;
$$;

revoke all on function public.milhano_get_operational_cascade(date, date) from public;
grant execute on function public.milhano_get_operational_cascade(date, date) to service_role;

-- -----------------------------------------------------------------------------
-- 7. Drill-down uses the exact same activity layer as scorecards.
-- -----------------------------------------------------------------------------
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
    select a.*
    from public.vw_milhano_operational_cascade_activity a
    cross join bounds b
    where a.metric_key = p_metric_key
      and (
        (
          a.metric_key = 'school_tours_today'
          and (a.activity_at at time zone 'America/Merida')::date = b.local_today
        )
        or (
          a.metric_key <> 'school_tours_today'
          and a.activity_at >= b.start_at
          and a.activity_at < b.end_at
        )
      )
  ),
  grouped as (
    select
      f.metric_key,
      coalesce(f.ghl_opportunity_id, mapped.ghl_opportunity_id) as resolved_opportunity_id,
      f.ghl_contact_id,
      max(f.activity_at) as activity_at,
      count(*)::bigint as activity_count
    from filtered f
    left join lateral (
      select o.ghl_opportunity_id
      from public.milhano_opportunities o
      where f.ghl_opportunity_id is null
        and f.ghl_contact_id is not null
        and o.ghl_contact_id = f.ghl_contact_id
      order by o.updated_at desc nulls last, o.created_at desc nulls last
      limit 1
    ) mapped on true
    group by f.metric_key, coalesce(f.ghl_opportunity_id, mapped.ghl_opportunity_id), f.ghl_contact_id
  )
  select
    g.metric_key,
    coalesce(g.resolved_opportunity_id, o.ghl_opportunity_id),
    coalesce(g.ghl_contact_id, o.ghl_contact_id),
    coalesce(
      nullif(trim(o.student_name), ''),
      nullif(trim(o.contact_name), ''),
      nullif(trim(o.opportunity_name), ''),
      g.ghl_contact_id,
      'Unidentified lead'
    ) as lead_name,
    o.contact_name,
    o.student_name,
    o.phone,
    o.email,
    o.source,
    o.current_stage,
    o.status,
    coalesce(nullif(trim(o.assigned_user), ''), nullif(trim(o.historical_advisor), ''), 'Unassigned'),
    o.grade_interest,
    g.activity_at,
    g.activity_count,
    case
      when g.metric_key in ('school_tours_booked','school_tours_attended','school_tours_today','trial_days_booked','trial_days_showed')
        then appt.start_time
      else detail.scheduled_for
    end as scheduled_for,
    case
      when appt.appointment_id is not null then
        case
          when lower(coalesce(appt.appointment_status,'')) in ('showed','completed','show','attended') then 'showed'
          when lower(coalesce(appt.appointment_status,'')) in ('noshow','no_show','no show') then 'no_show'
          when lower(coalesce(appt.appointment_status,'')) in ('cancelled','canceled','invalid') then 'cancelled'
          else 'scheduled'
        end
      else coalesce(detail.attendance_status, 'unknown')
    end as attendance_status,
    case
      when appt.appointment_id is not null
        and lower(coalesce(appt.appointment_status,'')) in ('showed','completed','show','attended')
        then appt.start_time
      else detail.attended_at
    end as attended_at,
    coalesce(detail.has_objection, false),
    detail.objection_summary,
    detail.school_tour_notes,
    detail.no_show_reason,
    o.historical_comments
  from grouped g
  left join lateral (
    select candidate.*
    from public.milhano_opportunities candidate
    where candidate.ghl_opportunity_id = g.resolved_opportunity_id
       or (
         g.resolved_opportunity_id is null
         and g.ghl_contact_id is not null
         and candidate.ghl_contact_id = g.ghl_contact_id
       )
    order by candidate.updated_at desc nulls last, candidate.created_at desc nulls last
    limit 1
  ) o on true
  left join lateral (
    select a.*
    from public.milhano_ghl_appointments a
    where (
      a.ghl_opportunity_id = coalesce(g.resolved_opportunity_id, o.ghl_opportunity_id)
      or (
        a.ghl_opportunity_id is null
        and a.ghl_contact_id = coalesce(g.ghl_contact_id, o.ghl_contact_id)
      )
    )
      and (
        (g.metric_key like 'school_tours_%' and a.appointment_type = 'school_tour')
        or (g.metric_key like 'trial_days_%' and a.appointment_type = 'trial_day')
      )
      and a.start_time >= (select start_at from bounds)
      and a.start_time < (select end_at from bounds)
      and (
        g.metric_key not in ('school_tours_attended','trial_days_showed')
        or lower(coalesce(a.appointment_status,'')) in ('showed','completed','show','attended')
      )
    order by a.start_time desc
    limit 1
  ) appt on true
  left join public.milhano_school_tour_details detail
    on detail.ghl_opportunity_id = o.ghl_opportunity_id
  order by g.activity_at desc nulls last;
$$;

revoke all on function public.milhano_get_operational_cascade_leads(text, date, date) from public;
grant execute on function public.milhano_get_operational_cascade_leads(text, date, date) to service_role;

-- -----------------------------------------------------------------------------
-- 8. Catalog order / definitions. Both cascades now use the same sequence.
-- -----------------------------------------------------------------------------
update public.milhano_reconciliation_metric_catalog
set display_order = case metric_key
  when 'new_leads' then 1
  when 'unique_contacted_leads' then 2
  when 'responded_leads' then 3
  when 'meaningful_conversations' then 4
  when 'qualified_leads' then 5
  when 'school_tours_booked' then 6
  when 'school_tours_attended' then 7
  when 'trial_days_booked' then 8
  when 'trial_days_showed' then 9
  when 'closed' then 10
  else display_order
end,
updated_at = now()
where metric_key in (
  'new_leads','unique_contacted_leads','responded_leads','meaningful_conversations',
  'qualified_leads','school_tours_booked','school_tours_attended',
  'trial_days_booked','trial_days_showed','closed'
);

update public.milhano_reconciliation_metric_catalog
set definition = 'Distinct admissions leads with at least one human/countable outbound call or WhatsApp during the selected period.', updated_at = now()
where metric_key = 'unique_contacted_leads';

update public.milhano_reconciliation_metric_catalog
set definition = 'Distinct leads that responded after human outreach: an inbound WhatsApp after a human/countable outbound touch, or a connected GHL call. The initial Click-to-WhatsApp inquiry does not count as Responded.', updated_at = now()
where metric_key = 'responded_leads';

update public.milhano_reconciliation_metric_catalog
set definition = 'Distinct leads with a connected call lasting at least 2 minutes, or a WhatsApp conversation explicitly classified as school-information-provided.', updated_at = now()
where metric_key = 'meaningful_conversations';

update public.milhano_reconciliation_metric_catalog
set definition = 'Distinct leads with a non-cancelled School Tour appointment scheduled inside the selected period. GHL appointments are the automated source of truth.', updated_at = now()
where metric_key = 'school_tours_booked';

update public.milhano_reconciliation_metric_catalog
set definition = 'Distinct leads whose School Tour appointment inside the selected period is marked Showed/Completed in GHL.', updated_at = now()
where metric_key = 'school_tours_attended';

update public.milhano_reconciliation_metric_catalog
set definition = 'Distinct leads with a non-cancelled Trial Day appointment scheduled inside the selected period. GHL appointments are the automated source of truth.', updated_at = now()
where metric_key = 'trial_days_booked';

update public.milhano_reconciliation_metric_catalog
set definition = 'Distinct leads whose Trial Day appointment inside the selected period is marked Showed/Completed in GHL.', updated_at = now()
where metric_key = 'trial_days_showed';

-- -----------------------------------------------------------------------------
-- 9. Same-lead conversion rates for the GHL cascade.
--    Cohort = leads created during the selected date range.
-- -----------------------------------------------------------------------------
create or replace function public.milhano_get_funnel_transition_rates_v17(
  p_start date,
  p_end date
)
returns table (
  from_metric_key text,
  to_metric_key text,
  cohort_leads bigint,
  from_reached bigint,
  to_reached bigint,
  conversion_pct numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select
      p_start::timestamp at time zone 'America/Merida' as start_at,
      (p_end + 1)::timestamp at time zone 'America/Merida' as end_at
  ),
  cohort as (
    select o.ghl_opportunity_id
    from public.milhano_opportunities o
    cross join bounds b
    where coalesce(o.original_lead_date, o.created_at) >= b.start_at
      and coalesce(o.original_lead_date, o.created_at) < b.end_at
  ),
  milestone as (
    select
      c.ghl_opportunity_id,
      v.metric_key,
      min(a.activity_at) as reached_at
    from cohort c
    cross join (values
      ('new_leads', 1),
      ('unique_contacted_leads', 2),
      ('responded_leads', 3),
      ('meaningful_conversations', 4),
      ('qualified_leads', 5),
      ('school_tours_booked', 6),
      ('school_tours_attended', 7),
      ('trial_days_booked', 8),
      ('trial_days_showed', 9),
      ('closed', 10)
    ) v(metric_key, stage_order)
    left join public.vw_milhano_operational_cascade_activity a
      on a.ghl_opportunity_id = c.ghl_opportunity_id
     and a.metric_key = v.metric_key
     and a.activity_at < (select end_at from bounds)
    group by c.ghl_opportunity_id, v.metric_key
  ),
  transitions as (
    select * from (values
      ('new_leads','unique_contacted_leads',1),
      ('unique_contacted_leads','responded_leads',2),
      ('responded_leads','meaningful_conversations',3),
      ('meaningful_conversations','qualified_leads',4),
      ('qualified_leads','school_tours_booked',5),
      ('school_tours_booked','school_tours_attended',6),
      ('school_tours_attended','trial_days_booked',7),
      ('trial_days_booked','trial_days_showed',8),
      ('trial_days_showed','closed',9)
    ) x(from_key,to_key,transition_order)
  ),
  evaluated as (
    select
      t.from_key,
      t.to_key,
      t.transition_order,
      c.ghl_opportunity_id,
      f.reached_at as from_at,
      n.reached_at as to_at
    from transitions t
    cross join cohort c
    left join milestone f
      on f.ghl_opportunity_id = c.ghl_opportunity_id
     and f.metric_key = t.from_key
    left join milestone n
      on n.ghl_opportunity_id = c.ghl_opportunity_id
     and n.metric_key = t.to_key
  )
  select
    e.from_key,
    e.to_key,
    (select count(*) from cohort)::bigint,
    count(*) filter (where e.from_at is not null)::bigint,
    count(*) filter (
      where e.from_at is not null
        and e.to_at is not null
        and e.to_at >= e.from_at
    )::bigint,
    case
      when count(*) filter (where e.from_at is not null) = 0 then null
      else round(
        100.0 * count(*) filter (
          where e.from_at is not null
            and e.to_at is not null
            and e.to_at >= e.from_at
        ) / count(*) filter (where e.from_at is not null),
        1
      )
    end as conversion_pct
  from evaluated e
  group by e.from_key, e.to_key, e.transition_order
  order by e.transition_order;
$$;

revoke all on function public.milhano_get_funnel_transition_rates_v17(date, date) from public;
grant execute on function public.milhano_get_funnel_transition_rates_v17(date, date) to service_role;

-- -----------------------------------------------------------------------------
-- 10. One RPC for the Home page. The previous page made ~11 Supabase requests
--    and downloaded raw Opportunities/Stage Events to aggregate in Next.js.
-- -----------------------------------------------------------------------------
create or replace function public.milhano_get_home_payload_v17(
  p_start date,
  p_end date
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with
bounds as (
  select
    p_start::timestamp at time zone 'America/Merida' as start_at,
    (p_end + 1)::timestamp at time zone 'America/Merida' as end_at,
    least((p_end + 1)::timestamp at time zone 'America/Merida', now() + interval '5 minutes') as operational_end
),
stage_catalog(stage_name, display_order, stage_group) as (
  values
    ('Cliente potencial',1,'Entrada'),
    ('No responde',2,'Seguimiento'),
    ('Seguimiento',3,'Seguimiento'),
    ('No responde / Seguimiento',4,'Legacy'),
    ('No fit',5,'Salida'),
    ('Lost / Sin continuidad',6,'Salida'),
    ('Fit',7,'Hito'),
    ('School Tour agendado',8,'Hito'),
    ('School Tour atendido',9,'Hito'),
    ('Pasadía agendada',10,'Hito'),
    ('Pasadía asistida',11,'Hito'),
    ('Retroalimentación',12,'Hito'),
    ('En evaluación',13,'Hito'),
    ('Inscripción en proceso',14,'Hito'),
    ('Inscrito',15,'Resultado')
),
cohort_base as (
  select
    o.*,
    coalesce(
      (
        select min(e.event_timestamp)
        from public.milhano_stage_events e
        where e.ghl_opportunity_id = o.ghl_opportunity_id
          and e.is_valid = true
          and e.to_stage = 'Cliente potencial'
          and e.event_timestamp <= now() + interval '5 minutes'
      ),
      o.original_lead_date,
      o.created_at
    ) as lead_date,
    case
      when lower(trim(coalesce(o.assigned_user, o.historical_advisor, ''))) in ('cinthia','cinthia esquivel')
        then 'Cinthia Esquivel'
      else coalesce(nullif(trim(o.assigned_user),''), nullif(trim(o.historical_advisor),''), 'Sin asignar')
    end as operational_owner
  from public.milhano_opportunities o
),
cohort as (
  select c.*
  from cohort_base c
  cross join bounds b
  where c.lead_date >= b.start_at
    and c.lead_date < b.end_at
),
cohort_flags as (
  select
    c.*,
    exists (
      select 1 from public.vw_milhano_qualification_events q
      cross join bounds b
      where q.ghl_opportunity_id = c.ghl_opportunity_id
        and q.qualified_at < b.end_at
    ) as reached_fit,
    exists (
      select 1 from public.milhano_ghl_appointments a
      cross join bounds b
      where (
        a.ghl_opportunity_id = c.ghl_opportunity_id
        or (a.ghl_opportunity_id is null and a.ghl_contact_id = c.ghl_contact_id)
      )
        and a.appointment_type = 'school_tour'
        and a.start_time < b.end_at
        and lower(coalesce(a.appointment_status,'unknown')) not in ('cancelled','canceled','invalid')
    ) as reached_st_booked,
    exists (
      select 1 from public.milhano_ghl_appointments a
      cross join bounds b
      where (
        a.ghl_opportunity_id = c.ghl_opportunity_id
        or (a.ghl_opportunity_id is null and a.ghl_contact_id = c.ghl_contact_id)
      )
        and a.appointment_type = 'school_tour'
        and a.start_time < b.end_at
        and lower(coalesce(a.appointment_status,'')) in ('showed','completed','show','attended')
    ) as reached_st_attended,
    exists (
      select 1 from public.milhano_ghl_appointments a
      cross join bounds b
      where (
        a.ghl_opportunity_id = c.ghl_opportunity_id
        or (a.ghl_opportunity_id is null and a.ghl_contact_id = c.ghl_contact_id)
      )
        and a.appointment_type = 'trial_day'
        and a.start_time < b.end_at
        and lower(coalesce(a.appointment_status,'unknown')) not in ('cancelled','canceled','invalid')
    ) as reached_trial_booked,
    exists (
      select 1 from public.milhano_ghl_appointments a
      cross join bounds b
      where (
        a.ghl_opportunity_id = c.ghl_opportunity_id
        or (a.ghl_opportunity_id is null and a.ghl_contact_id = c.ghl_contact_id)
      )
        and a.appointment_type = 'trial_day'
        and a.start_time < b.end_at
        and lower(coalesce(a.appointment_status,'')) in ('showed','completed','show','attended')
    ) as reached_trial_attended,
    exists (
      select 1 from public.milhano_stage_events e
      cross join bounds b
      where e.ghl_opportunity_id = c.ghl_opportunity_id
        and e.is_valid = true
        and e.to_stage = 'Inscrito'
        and e.event_timestamp < b.operational_end
    ) as reached_closed
  from cohort c
),
pipeline as (
  select
    s.display_order,
    s.stage_name,
    s.stage_group,
    count(c.ghl_opportunity_id)::bigint as opportunity_count,
    count(c.ghl_opportunity_id) filter (where lower(coalesce(c.status,'')) = 'open')::bigint as open_count,
    count(c.ghl_opportunity_id) filter (where lower(coalesce(c.status,'')) = 'won')::bigint as won_count,
    count(c.ghl_opportunity_id) filter (where lower(coalesce(c.status,'')) = 'lost')::bigint as lost_count,
    count(c.ghl_opportunity_id) filter (
      where lower(coalesce(c.status,'')) = 'open'
        and c.updated_at <= now() - interval '8 days'
    )::bigint as open_8_plus_days
  from stage_catalog s
  left join cohort c on c.current_stage = s.stage_name
  group by s.display_order, s.stage_name, s.stage_group
  order by s.display_order
),
source_perf as (
  select
    coalesce(nullif(trim(source),''),'Sin fuente') as source,
    count(*)::bigint as leads,
    count(*) filter (where reached_fit)::bigint as fits,
    count(*) filter (where reached_st_booked)::bigint as tours_scheduled,
    count(*) filter (where reached_st_attended)::bigint as tours_attended,
    count(*) filter (where reached_trial_booked)::bigint as passdays_scheduled,
    count(*) filter (where reached_trial_attended)::bigint as passdays_attended,
    count(*) filter (where reached_closed)::bigint as enrollment_process_started,
    count(*) filter (where reached_closed)::bigint as enrolled,
    case when count(*) = 0 then null else 100.0 * count(*) filter (where reached_fit) / count(*) end as lead_to_fit_pct,
    case when count(*) = 0 then null else 100.0 * count(*) filter (where reached_closed) / count(*) end as lead_to_enrolled_pct
  from cohort_flags
  where coalesce(admission_route,'') <> 'Ingreso directo'
  group by coalesce(nullif(trim(source),''),'Sin fuente')
  order by leads desc
),
owner_perf as (
  select
    operational_owner,
    count(*)::bigint as leads,
    count(*) filter (where reached_fit)::bigint as fits,
    count(*) filter (where reached_st_booked)::bigint as tours_scheduled,
    count(*) filter (where reached_st_attended)::bigint as tours_attended,
    count(*) filter (where reached_trial_booked)::bigint as passdays_scheduled,
    count(*) filter (where reached_trial_attended)::bigint as passdays_attended,
    count(*) filter (where reached_closed)::bigint as enrollment_process_started,
    count(*) filter (where reached_closed)::bigint as enrolled,
    case when count(*) = 0 then null else 100.0 * count(*) filter (where reached_fit) / count(*) end as lead_to_fit_pct,
    case when count(*) = 0 then null else 100.0 * count(*) filter (where reached_closed) / count(*) end as lead_to_enrolled_pct
  from cohort_flags
  where coalesce(admission_route,'') <> 'Ingreso directo'
  group by operational_owner
  order by leads desc
),
exit_rows as (
  select
    e.to_stage as exit_type,
    coalesce(e.from_stage,'Stage Not Reconstructed') as exit_from_stage,
    coalesce(
      nullif(trim(case when e.to_stage = 'No fit' then o.no_fit_reason else o.lost_reason end),''),
      'No Reason Specified'
    ) as exit_reason,
    count(*)::bigint as opportunity_count
  from public.milhano_stage_events e
  join public.milhano_opportunities o on o.ghl_opportunity_id = e.ghl_opportunity_id
  cross join bounds b
  where e.is_valid = true
    and e.to_stage in ('No fit','Lost / Sin continuidad')
    and e.event_timestamp >= b.start_at
    and e.event_timestamp < b.operational_end
  group by e.to_stage, coalesce(e.from_stage,'Stage Not Reconstructed'),
    coalesce(nullif(trim(case when e.to_stage = 'No fit' then o.no_fit_reason else o.lost_reason end),''),'No Reason Specified')
  order by opportunity_count desc
),
stale as (
  select
    c.ghl_opportunity_id,
    c.opportunity_name,
    c.student_name,
    c.current_stage,
    c.operational_owner,
    greatest(0, floor(extract(epoch from (now() - c.updated_at)) / 86400))::integer as days_since_update,
    c.source
  from cohort c
  where lower(coalesce(c.status,'')) = 'open'
  order by c.updated_at asc nulls first
  limit 15
),
daily as (
  select *
  from public.vw_milhano_daily_kpis d
  where d.metric_date >= p_start and d.metric_date <= p_end
  order by d.metric_date
),
period_daily as (
  select
    coalesce(sum(new_leads),0)::bigint as new_leads,
    coalesce(sum(fits),0)::bigint as fits,
    coalesce(sum(tours_scheduled),0)::bigint as tours_scheduled,
    coalesce(sum(tours_attended),0)::bigint as tours_attended,
    coalesce(sum(enrolled),0)::bigint as enrolled
  from daily
),
period_whatsapp as (
  select
    coalesce(sum(total_messages),0)::bigint as whatsapp_messages,
    coalesce(sum(active_conversations),0)::bigint as whatsapp_conversations_daily_sum
  from public.vw_milhano_whatsapp_daily w
  where w.activity_date >= p_start and w.activity_date <= p_end
),
period_calls as (
  select
    coalesce(sum(total_call_attempts),0)::bigint as call_attempts,
    coalesce(sum(outbound_attempts),0)::bigint as outbound_call_attempts
  from public.vw_milhano_calls_daily c
  where c.activity_date >= p_start and c.activity_date <= p_end
),
reconciliation as (
  select
    r.*,
    coalesce(
      r.operational_total,
      r.system_value,
      case when r.metric_scope = 'manual_only' then r.reported_value else null end,
      0
    )::bigint as metric_value
  from public.milhano_get_operational_reconciliation(p_start,p_end) r
),
manual_totals as (
  select
    coalesce(sum(mv.declared_value) filter (where mv.metric_key='new_leads_received'),0)::bigint as new_leads_received,
    coalesce(sum(mv.declared_value) filter (where mv.metric_key='ads_leads_reported'),0)::bigint as ads_leads_reported,
    coalesce(sum(mv.declared_value) filter (where mv.metric_key='organic_leads_reported'),0)::bigint as organic_leads_reported,
    coalesce(sum(mv.declared_value) filter (where mv.metric_key='contacted_reported'),0)::bigint as contacted_reported,
    coalesce(sum(mv.declared_value) filter (where mv.metric_key='responses_reported'),0)::bigint as responses_reported,
    coalesce(sum(mv.declared_value) filter (where mv.metric_key='meaningful_conversations_reported'),0)::bigint as meaningful_conversations_reported,
    coalesce(sum(mv.declared_value) filter (where mv.metric_key='qualified_leads'),0)::bigint as qualified_leads,
    coalesce(sum(mv.declared_value) filter (where mv.metric_key='school_tours_scheduled'),0)::bigint as school_tours_scheduled,
    coalesce(sum(mv.declared_value) filter (where mv.metric_key='school_tours_attended'),0)::bigint as school_tours_attended,
    coalesce(sum(mv.declared_value) filter (where mv.metric_key='trial_days_booked'),0)::bigint as trial_days_booked,
    coalesce(sum(mv.declared_value) filter (where mv.metric_key='trial_days_showed'),0)::bigint as trial_days_showed,
    coalesce(sum(mv.declared_value) filter (where mv.metric_key='closed_leads'),0)::bigint as closed_leads,
    count(distinct s.id)::bigint as "eodCount",
    count(distinct s.eod_date)::bigint as "reportedDays"
  from public.milhano_eod_submissions s
  left join public.milhano_eod_metric_values mv on mv.submission_id = s.id
  where s.status in ('submitted','validated')
    and s.eod_date between p_start and p_end
),
level_totals as (
  select
    count(*) filter (where school_level='primaria')::bigint as primaria,
    count(*) filter (where school_level='secundaria')::bigint as secundaria,
    count(*) filter (where school_level='prepa')::bigint as prepa,
    count(*) filter (where school_level not in ('primaria','secundaria','prepa') or school_level is null)::bigint as unknown
  from public.milhano_eod_school_tour_records
  where is_active = true
    and booking_eod_date between p_start and p_end
),
transition_rates as (
  select * from public.milhano_get_funnel_transition_rates_v17(p_start,p_end)
),
health as (
  select * from public.vw_milhano_system_health
),
quality as (
  select * from public.vw_milhano_data_quality
)
select jsonb_build_object(
  'dashboard', jsonb_build_object(
    'pipeline', coalesce((select jsonb_agg(to_jsonb(x) order by x.display_order) from pipeline x),'[]'::jsonb),
    'daily', coalesce((select jsonb_agg(to_jsonb(x) order by x.metric_date) from daily x),'[]'::jsonb),
    'sources', coalesce((select jsonb_agg(to_jsonb(x)) from source_perf x),'[]'::jsonb),
    'owners', coalesce((select jsonb_agg(to_jsonb(x)) from owner_perf x),'[]'::jsonb),
    'exits', coalesce((select jsonb_agg(to_jsonb(x)) from exit_rows x),'[]'::jsonb),
    'stale', coalesce((select jsonb_agg(to_jsonb(x)) from stale x),'[]'::jsonb),
    'period', (
      select to_jsonb(d) || to_jsonb(w) || to_jsonb(c)
      from period_daily d cross join period_whatsapp w cross join period_calls c
    )
  ),
  'reconciliation', coalesce((select jsonb_agg(to_jsonb(x) order by x.display_order) from reconciliation x),'[]'::jsonb),
  'manualTotals', (select to_jsonb(x) from manual_totals x),
  'manualLevelTotals', (select to_jsonb(x) from level_totals x),
  'transitionRates', coalesce((select jsonb_agg(to_jsonb(x)) from transition_rates x),'[]'::jsonb),
  'health', coalesce((select jsonb_agg(to_jsonb(x)) from health x),'[]'::jsonb),
  'quality', coalesce((select jsonb_agg(to_jsonb(x)) from quality x),'[]'::jsonb)
);
$$;

revoke all on function public.milhano_get_home_payload_v17(date, date) from public;
grant execute on function public.milhano_get_home_payload_v17(date, date) to service_role;

commit;

-- =============================================================================
-- Verification — expected highlights after deployment
-- * has_contact_updated_index = true
-- * school_tours_booked full month = 9 for Aug 2026 at current data state
-- * school_tours_attended full month = 3
-- * Responded should be far below the old 139 because initial inquiries are excluded
-- =============================================================================
select
  to_regprocedure('public.milhano_get_home_payload_v17(date,date)') is not null as home_payload_exists,
  to_regprocedure('public.milhano_get_funnel_transition_rates_v17(date,date)') is not null as transition_rates_exists,
  exists (
    select 1 from pg_indexes
    where schemaname='public'
      and tablename='milhano_opportunities'
      and indexname='idx_milhano_opportunities_contact_updated'
  ) as has_contact_updated_index;

with bounds as (
  select date '2026-08-01' as start_date, date '2026-08-31' as end_date
)
select metric_key, metric_value
from bounds
cross join lateral public.milhano_get_operational_cascade(start_date,end_date)
where metric_key in (
  'new_leads','unique_contacted_leads','responded_leads','meaningful_conversations',
  'qualified_leads','school_tours_booked','school_tours_attended',
  'trial_days_booked','trial_days_showed','closed'
)
order by display_order;
