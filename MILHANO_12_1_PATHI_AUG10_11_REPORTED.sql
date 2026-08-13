-- ============================================================
-- MILHANO | V12.1 | PATHI EOD BACKFILL | AUG 10-11, 2026
-- Stores the numbers exactly as advisor-reported evidence.
-- It does NOT create Manual Extra / outside-GHL adjustments.
-- ============================================================

do $$
declare
    v_user_id uuid;
    v_actor_id uuid;
    v_sub uuid;
begin
    select id into v_user_id
    from public.milhano_app_users
    where is_active = true
      and lower(display_name) in ('pathi carrillo', 'paty carrillo', 'pathi', 'paty')
    order by case when lower(display_name) = 'pathi carrillo' then 0 else 1 end
    limit 1;

    if v_user_id is null then
        raise exception 'Pathi/Paty active app user was not found';
    end if;

    select id into v_actor_id
    from public.milhano_app_users
    where is_active = true
      and role = 'admin'
    order by case when lower(coalesce(username, '')) = 'monacashflow' then 0 else 1 end,
             created_at
    limit 1;

    if v_actor_id is null then
        v_actor_id := v_user_id;
    end if;

    -- Monday Aug 10
    v_sub := public.milhano_refresh_eod_snapshot(v_user_id, date '2026-08-10');
    perform public.milhano_save_eod_submission(
        v_sub,
        v_actor_id,
        jsonb_build_array(
            jsonb_build_object('metric_key','new_leads_received','declared_value','13'),
            jsonb_build_object('metric_key','ads_leads_reported','declared_value','13'),
            jsonb_build_object('metric_key','organic_leads_reported','declared_value','0'),
            jsonb_build_object('metric_key','contacted_reported','declared_value','33'),
            jsonb_build_object('metric_key','responses_reported','declared_value','9'),
            jsonb_build_object('metric_key','qualified_leads','declared_value','3'),
            jsonb_build_object('metric_key','school_tours_scheduled','declared_value','1'),
            jsonb_build_object('metric_key','school_tours_attended','declared_value','1')
        ),
        'Backfill from Pathi report. Contactados was reported as 21 + 12 = 33; the source message did not specify what each component represents.',
        true
    );

    -- Tuesday Aug 11
    v_sub := public.milhano_refresh_eod_snapshot(v_user_id, date '2026-08-11');
    perform public.milhano_save_eod_submission(
        v_sub,
        v_actor_id,
        jsonb_build_array(
            jsonb_build_object('metric_key','new_leads_received','declared_value','14'),
            jsonb_build_object('metric_key','ads_leads_reported','declared_value','14'),
            jsonb_build_object('metric_key','organic_leads_reported','declared_value','0'),
            jsonb_build_object('metric_key','contacted_reported','declared_value','26'),
            jsonb_build_object('metric_key','responses_reported','declared_value','7'),
            jsonb_build_object('metric_key','qualified_leads','declared_value','6'),
            jsonb_build_object('metric_key','school_tours_scheduled','declared_value','2'),
            jsonb_build_object('metric_key','school_tours_attended','declared_value','2')
        ),
        'Backfill from Pathi report supplied on 2026-08-13.',
        true
    );
end $$;

select
    eod_date,
    display_name,
    metric_key,
    label,
    system_value,
    declared_value,
    operational_difference as gap,
    reconciliation_status
from public.vw_milhano_eod_dashboard
where eod_date in (date '2026-08-10', date '2026-08-11')
  and lower(display_name) in ('pathi carrillo', 'paty carrillo', 'pathi', 'paty')
order by eod_date, display_order;
