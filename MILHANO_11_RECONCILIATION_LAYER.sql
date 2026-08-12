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
