-- ============================================================
-- MILHANO | V13 | PATHI EOD STATUS CHECK | AUG 10-13, 2026
-- READ ONLY. Does not create, submit, or modify any EOD.
-- ============================================================

with advisor as (
    select id
    from public.milhano_app_users
    where is_active = true
      and lower(display_name) in (
          'pathi carrillo', 'paty carrillo', 'pathi', 'paty'
      )
    order by case when lower(display_name) = 'pathi carrillo' then 0 else 1 end,
             created_at
    limit 1
),
expected (
    eod_date,
    total_leads,
    ads_leads,
    organic_leads,
    contacted,
    responses,
    qualified_fit,
    st_booked,
    st_attended
) as (
    values
        (date '2026-08-10', 13, 13, 0, 33, 9, 3, 1, 1),
        (date '2026-08-11', 14, 14, 0, 26, 7, 6, 2, 2),
        (date '2026-08-12', 19, 18, 1, 19, 7, 3, 1, 1),
        (date '2026-08-13', 23, 22, 1, 23, 4, 3, 1, 1)
),
actual as (
    select
        e.*,
        s.id as submission_id,
        s.status as submission_status,
        s.submitted_at,
        s.updated_at,
        s.comments,
        max(mv.declared_value) filter (
            where mv.metric_key = 'new_leads_received'
        ) as actual_total_leads,
        max(mv.declared_value) filter (
            where mv.metric_key = 'ads_leads_reported'
        ) as actual_ads_leads,
        max(mv.declared_value) filter (
            where mv.metric_key = 'organic_leads_reported'
        ) as actual_organic_leads,
        max(mv.declared_value) filter (
            where mv.metric_key = 'contacted_reported'
        ) as actual_contacted,
        max(mv.declared_value) filter (
            where mv.metric_key = 'responses_reported'
        ) as actual_responses,
        max(mv.declared_value) filter (
            where mv.metric_key = 'qualified_leads'
        ) as actual_qualified_fit,
        max(mv.declared_value) filter (
            where mv.metric_key = 'school_tours_scheduled'
        ) as actual_st_booked,
        max(mv.declared_value) filter (
            where mv.metric_key = 'school_tours_attended'
        ) as actual_st_attended,
        count(mv.declared_value) filter (
            where mv.metric_key in (
                'new_leads_received',
                'ads_leads_reported',
                'organic_leads_reported',
                'contacted_reported',
                'responses_reported',
                'qualified_leads',
                'school_tours_scheduled',
                'school_tours_attended'
            )
              and mv.declared_value is not null
        ) as declared_fields
    from expected e
    cross join advisor a
    left join public.milhano_eod_submissions s
      on s.app_user_id = a.id
     and s.eod_date = e.eod_date
    left join public.milhano_eod_metric_values mv
      on mv.submission_id = s.id
    group by
        e.eod_date,
        e.total_leads,
        e.ads_leads,
        e.organic_leads,
        e.contacted,
        e.responses,
        e.qualified_fit,
        e.st_booked,
        e.st_attended,
        s.id,
        s.status,
        s.submitted_at,
        s.updated_at,
        s.comments
)
select
    eod_date,
    case
        when submission_id is null then 'MISSING'
        when submission_status in ('submitted', 'validated')
             and actual_total_leads is not distinct from total_leads
             and actual_ads_leads is not distinct from ads_leads
             and actual_organic_leads is not distinct from organic_leads
             and actual_contacted is not distinct from contacted
             and actual_responses is not distinct from responses
             and actual_qualified_fit is not distinct from qualified_fit
             and actual_st_booked is not distinct from st_booked
             and actual_st_attended is not distinct from st_attended
            then 'ALREADY_SUBMITTED_EXACT'
        when submission_status = 'draft'
             and actual_total_leads is not distinct from total_leads
             and actual_ads_leads is not distinct from ads_leads
             and actual_organic_leads is not distinct from organic_leads
             and actual_contacted is not distinct from contacted
             and actual_responses is not distinct from responses
             and actual_qualified_fit is not distinct from qualified_fit
             and actual_st_booked is not distinct from st_booked
             and actual_st_attended is not distinct from st_attended
            then 'DRAFT_EXACT_NOT_SUBMITTED'
        when coalesce(declared_fields, 0) = 0
            then 'EMPTY_SNAPSHOT_CAN_BACKFILL'
        else 'REVIEW_VALUES_BEFORE_TOUCHING'
    end as verification,
    coalesce(submission_status, 'none') as db_status,
    submitted_at,
    updated_at,
    declared_fields,
    total_leads as expected_total,
    actual_total_leads,
    ads_leads as expected_ads,
    actual_ads_leads,
    organic_leads as expected_organic,
    actual_organic_leads,
    contacted as expected_contacted,
    actual_contacted,
    responses as expected_responses,
    actual_responses,
    qualified_fit as expected_qualified_fit,
    actual_qualified_fit,
    st_booked as expected_st_booked,
    actual_st_booked,
    st_attended as expected_st_attended,
    actual_st_attended,
    comments
from actual
order by eod_date;
