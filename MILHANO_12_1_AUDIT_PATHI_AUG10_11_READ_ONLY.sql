-- ============================================================
-- MILHANO | V12.1 | READ-ONLY AUDIT | PATHI AUG 10-11, 2026
-- Run after the V12.1 migration. No data is modified.
-- ============================================================

-- 1) Exact EOD windows. Monday intentionally starts Friday 14:50.
select
    d.eod_date,
    w.window_start,
    w.window_end
from (values (date '2026-08-10'), (date '2026-08-11')) d(eod_date)
cross join lateral public.milhano_get_eod_window(d.eod_date) w
order by d.eod_date;

-- 2) Pathi's system-calculated values for each EOD date.
with pathi as (
    select id, display_name, ghl_user_id
    from public.milhano_app_users
    where is_active = true
      and lower(display_name) in ('pathi carrillo', 'paty carrillo', 'pathi', 'paty')
    order by case when lower(display_name) = 'pathi carrillo' then 0 else 1 end
    limit 1
)
select
    d.eod_date,
    p.display_name,
    m.metric_key,
    m.system_value
from pathi p
cross join (values (date '2026-08-10'), (date '2026-08-11')) d(eod_date)
cross join lateral public.milhano_calculate_eod_metrics(p.id, d.eod_date) m
where m.metric_key in (
    'new_leads_received',
    'calls_made',
    'ghl_connected_calls',
    'unique_leads_called',
    'new_leads_attended',
    'qualified_leads',
    'school_tours_scheduled',
    'school_tours_attended'
)
order by d.eod_date, m.metric_key;

-- 3) Current EOD reported-vs-system rows if the backfill was loaded.
select
    eod_date,
    display_name,
    metric_key,
    system_value,
    declared_value,
    operational_difference as gap,
    submission_status
from public.vw_milhano_eod_dashboard
where eod_date in (date '2026-08-10', date '2026-08-11')
  and lower(display_name) in ('pathi carrillo', 'paty carrillo', 'pathi', 'paty')
order by eod_date, display_order;

-- 4) Qualified / Fit evidence. Qualified and Fit are the same milestone;
--    every system row below must be backed by a real Fit stage event.
with pathi as (
    select ghl_user_id
    from public.milhano_app_users
    where is_active = true
      and lower(display_name) in ('pathi carrillo', 'paty carrillo', 'pathi', 'paty')
    limit 1
), bounds as (
    select min(window_start) as start_at, max(window_end) as end_at
    from (values (date '2026-08-10'), (date '2026-08-11')) d(eod_date)
    cross join lateral public.milhano_get_eod_window(d.eod_date)
)
select
    q.ghl_opportunity_id,
    q.qualified_at,
    q.evidence_stage,
    q.qualification_source,
    q.attributed_ghl_user_id
from public.vw_milhano_qualification_events q
cross join pathi p
cross join bounds b
where q.attributed_ghl_user_id = p.ghl_user_id
  and q.qualified_at >= b.start_at
  and q.qualified_at < b.end_at
order by q.qualified_at;

-- 5) New opportunities assigned to Pathi inside each system EOD window,
--    grouped by raw Source. Facebook/Instagram remains intentionally raw.
with pathi as (
    select ghl_user_id
    from public.milhano_app_users
    where is_active = true
      and lower(display_name) in ('pathi carrillo', 'paty carrillo', 'pathi', 'paty')
    limit 1
)
select
    d.eod_date,
    coalesce(nullif(trim(o.source), ''), 'NO SOURCE') as raw_source,
    count(distinct o.ghl_opportunity_id) as opportunities
from pathi p
cross join (values (date '2026-08-10'), (date '2026-08-11')) d(eod_date)
cross join lateral public.milhano_get_eod_window(d.eod_date) w
join public.milhano_opportunities o
  on o.assigned_user_id = p.ghl_user_id
 and o.created_at >= w.window_start
 and o.created_at < w.window_end
group by d.eod_date, coalesce(nullif(trim(o.source), ''), 'NO SOURCE')
order by d.eod_date, opportunities desc, raw_source;

-- 6) Communication coverage by channel/direction for Pathi.
with pathi as (
    select ghl_user_id
    from public.milhano_app_users
    where is_active = true
      and lower(display_name) in ('pathi carrillo', 'paty carrillo', 'pathi', 'paty')
    limit 1
)
select
    d.eod_date,
    lower(c.channel) as channel,
    c.direction,
    count(*) as events,
    count(distinct coalesce(c.ghl_opportunity_id, c.ghl_contact_id)) as unique_leads
from pathi p
cross join (values (date '2026-08-10'), (date '2026-08-11')) d(eod_date)
cross join lateral public.milhano_get_eod_window(d.eod_date) w
join public.milhano_communication_events c
  on c.ghl_user_id = p.ghl_user_id
 and c.event_timestamp >= w.window_start
 and c.event_timestamp < w.window_end
group by d.eod_date, lower(c.channel), c.direction
order by d.eod_date, channel, direction;
