-- ============================================================
-- MILHANO | V12.1 | GHL FOLLOW-UP STAGE CHECK
-- Read-only. Run after changing the GHL pipeline and moving test cards.
-- ============================================================

-- 1) Preferred stage rules should exist in Supabase.
select
    stage_name,
    stage_type,
    positive_order,
    eod_metric_key,
    is_active
from public.milhano_pipeline_stage_rules
where stage_name in (
    'No responde',
    'Seguimiento',
    'No responde / Seguimiento',
    'Fit',
    'Qualified'
)
order by case stage_name
    when 'No responde' then 1
    when 'Seguimiento' then 2
    when 'No responde / Seguimiento' then 3
    when 'Fit' then 4
    when 'Qualified' then 5
    else 99
end;

-- 2) Recent stage events prove that GHL is sending the new names.
select
    event_timestamp,
    ghl_opportunity_id,
    from_stage,
    to_stage,
    attributed_ghl_user_id,
    is_valid
from public.milhano_stage_events
where event_timestamp >= now() - interval '7 days'
  and (
      to_stage in ('No responde', 'Seguimiento', 'Fit')
      or from_stage in ('No responde', 'Seguimiento')
  )
order by event_timestamp desc
limit 100;

-- 3) Qualified / Fit must be backed ONLY by Fit.
select
    qualified_at,
    ghl_opportunity_id,
    evidence_stage,
    qualification_source
from public.vw_milhano_qualification_events
where qualified_at >= now() - interval '30 days'
order by qualified_at desc
limit 100;
