-- ============================================================
-- MILHANO | 11A | JULY 2026 PATHI HISTORICAL REPORT
--
-- IMPORTANT:
--   This stores Pathi's July report as REPORTED evidence only.
--   It does NOT assume that the discrepancy is outside GHL.
--   manual_extra_value is intentionally 0 for every metric.
--
-- After investigation, use the dashboard Reconciliation page to move
-- only VERIFIED missing activity into Manual Extra.
-- ============================================================

begin;

-- Supersede a previous run of this same historical backfill.
update public.milhano_metric_reconciliation_entries e
set is_active = false,
    updated_at = now()
where e.is_active = true
  and e.source_type = 'historical_report'
  and e.period_start = date '2026-07-01'
  and e.period_end = date '2026-07-31'
  and (
      e.advisor_app_user_id is null
      or e.advisor_app_user_id in (
          select id
          from public.milhano_app_users
          where lower(display_name) in (
              'pathi carrillo',
              'paty carrillo',
              'pathi',
              'paty'
          )
      )
  )
  and e.metric_key in (
      'new_leads',
      'ads_leads',
      'organic_leads',
      'messages_answered',
      'number_of_dials',
      'answered_calls',
      'qualified_leads',
      'school_tours_booked',
      'school_tours_attended',
      'closed'
  );

with advisor as (
    select id
    from public.milhano_app_users
    where is_active = true
      and lower(display_name) in (
          'pathi carrillo',
          'paty carrillo',
          'pathi',
          'paty'
      )
    order by
        case when lower(display_name) = 'pathi carrillo' then 0 else 1 end,
        created_at
    limit 1
),
actor as (
    select id
    from public.milhano_app_users
    where is_active = true
      and role = 'admin'
    order by created_at
    limit 1
),
reported(metric_key, reported_value, note) as (
    values
        ('new_leads', 137, 'Pathi July report: 133 Ads + 4 Organic. Pending reconciliation against GHL.'),
        ('ads_leads', 133, 'Pathi July report. Reporting dimension only; not inferred from GHL source labels.'),
        ('organic_leads', 4, 'Pathi July report. Reporting dimension only; not inferred from GHL source labels.'),
        ('messages_answered', 133, 'Pathi July report. Kept separate from raw WhatsApp message volume.'),
        ('number_of_dials', 221, 'Pathi July report. Do not treat the full gap as external calls until GHL/system counting is audited.'),
        ('answered_calls', 70, 'Pathi July report: #respuestas. Stored as Answered / Connected Calls for reconciliation.'),
        ('qualified_leads', 23, 'Pathi July report: Qualified.'),
        ('school_tours_booked', 14, 'Pathi July report: ST Booked.'),
        ('school_tours_attended', 6, 'Pathi July report: ST Attended.'),
        ('closed', 4, 'Pathi July report: Closed.')
)
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
select
    r.metric_key,
    date '2026-07-01',
    date '2026-07-31',
    (select id from advisor),
    r.reported_value,
    0,
    'historical_report',
    r.note,
    (r.metric_key = 'number_of_dials'),
    (select id from actor)
from reported r;

commit;

-- Expected behavior after this backfill:
-- - Reported values become visible for July.
-- - Operational Total remains System + 0 until a verified Manual Extra is added.
-- - Gap stays visible and becomes the investigation queue.
select *
from public.milhano_get_operational_reconciliation(
    date '2026-07-01',
    date '2026-07-31'
)
order by display_order;
