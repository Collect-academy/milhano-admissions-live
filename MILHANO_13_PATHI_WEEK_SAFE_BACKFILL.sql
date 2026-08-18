-- ============================================================
-- MILHANO | V13 | PATHI WEEK SAFE BACKFILL | AUG 10-13, 2026
--
-- Safety policy:
-- - Submitted/validated EOD: NEVER touched.
-- - Draft with any advisor-entered values: NEVER touched.
-- - Exact draft remains a draft so the advisor can submit it herself.
-- - Only a truly missing EOD OR an empty system-created snapshot is filled.
-- - Re-running this file is idempotent for these dates.
-- - Meaningful Conversations is intentionally NOT invented for these days;
--   Pathi did not report that metric in the supplied EODs.
-- ============================================================

do $$
declare
    v_user_id uuid;
    v_actor_id uuid;
    v_expected record;
    v_submission_id uuid;
    v_status text;
    v_comments text;
    v_declared_count integer;
begin
    select id into v_user_id
    from public.milhano_app_users
    where is_active = true
      and lower(display_name) in (
          'pathi carrillo', 'paty carrillo', 'pathi', 'paty'
      )
    order by case when lower(display_name) = 'pathi carrillo' then 0 else 1 end,
             created_at
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

    for v_expected in
        select *
        from (
            values
                (date '2026-08-10', 13, 13, 0, 33, 9, 3, 1, 1,
                 'Backfill from Pathi report. Contactados was reported as 21 + 12 = 33; components were not specified.'::text),
                (date '2026-08-11', 14, 14, 0, 26, 7, 6, 2, 2,
                 'Backfill from Pathi report supplied for Tuesday.'::text),
                (date '2026-08-12', 19, 18, 1, 19, 7, 3, 1, 1,
                 'Backfill from Pathi handwritten Wednesday EOD supplied on 2026-08-14.'::text),
                (date '2026-08-13', 23, 22, 1, 23, 4, 3, 1, 1,
                 'Tenemos en proceso de inscripción (Hermano de Elian)'::text)
        ) as x(
            eod_date,
            total_leads,
            ads_leads,
            organic_leads,
            contacted,
            responses,
            qualified_fit,
            st_booked,
            st_attended,
            note
        )
        order by eod_date
    loop
        v_submission_id := null;
        v_status := null;
        v_comments := null;
        v_declared_count := 0;

        select s.id, s.status, s.comments
        into v_submission_id, v_status, v_comments
        from public.milhano_eod_submissions s
        where s.app_user_id = v_user_id
          and s.eod_date = v_expected.eod_date
        limit 1;

        if v_submission_id is not null then
            select count(*)
            into v_declared_count
            from public.milhano_eod_metric_values mv
            where mv.submission_id = v_submission_id
              and mv.metric_key in (
                  'new_leads_received',
                  'ads_leads_reported',
                  'organic_leads_reported',
                  'contacted_reported',
                  'responses_reported',
                  'qualified_leads',
                  'school_tours_scheduled',
                  'school_tours_attended'
              )
              and mv.declared_value is not null;
        end if;

        if v_submission_id is not null
           and v_status in ('submitted', 'validated') then
            raise notice 'SKIP %: already %', v_expected.eod_date, v_status;
            continue;
        end if;

        if v_submission_id is not null
           and v_declared_count > 0 then
            raise notice 'SKIP %: existing % has % declared fields; review/submit that EOD instead of overwriting it',
                v_expected.eod_date, coalesce(v_status, 'row'), v_declared_count;
            continue;
        end if;

        -- Missing row or empty system-created snapshot: safe to populate.
        v_submission_id := public.milhano_refresh_eod_snapshot(
            v_user_id,
            v_expected.eod_date
        );

        perform public.milhano_save_eod_submission(
            v_submission_id,
            v_actor_id,
            jsonb_build_array(
                jsonb_build_object('metric_key','new_leads_received','declared_value',v_expected.total_leads::text),
                jsonb_build_object('metric_key','ads_leads_reported','declared_value',v_expected.ads_leads::text),
                jsonb_build_object('metric_key','organic_leads_reported','declared_value',v_expected.organic_leads::text),
                jsonb_build_object('metric_key','contacted_reported','declared_value',v_expected.contacted::text),
                jsonb_build_object('metric_key','responses_reported','declared_value',v_expected.responses::text),
                jsonb_build_object('metric_key','qualified_leads','declared_value',v_expected.qualified_fit::text),
                jsonb_build_object('metric_key','school_tours_scheduled','declared_value',v_expected.st_booked::text),
                jsonb_build_object('metric_key','school_tours_attended','declared_value',v_expected.st_attended::text)
            ),
            v_expected.note,
            true
        );

        raise notice 'BACKFILLED % safely', v_expected.eod_date;
    end loop;
end $$;

-- Final audit view: shows what is currently stored after the safe pass.
select
    s.eod_date,
    s.status,
    s.submitted_at,
    s.comments,
    max(mv.declared_value) filter (where mv.metric_key = 'new_leads_received') as total_leads,
    max(mv.declared_value) filter (where mv.metric_key = 'ads_leads_reported') as ads_leads,
    max(mv.declared_value) filter (where mv.metric_key = 'organic_leads_reported') as organic_leads,
    max(mv.declared_value) filter (where mv.metric_key = 'contacted_reported') as contacted,
    max(mv.declared_value) filter (where mv.metric_key = 'responses_reported') as responses,
    max(mv.declared_value) filter (where mv.metric_key = 'qualified_leads') as qualified_fit,
    max(mv.declared_value) filter (where mv.metric_key = 'school_tours_scheduled') as st_booked,
    max(mv.declared_value) filter (where mv.metric_key = 'school_tours_attended') as st_attended
from public.milhano_eod_submissions s
join public.milhano_app_users u
  on u.id = s.app_user_id
left join public.milhano_eod_metric_values mv
  on mv.submission_id = s.id
where s.eod_date between date '2026-08-10' and date '2026-08-13'
  and lower(u.display_name) in ('pathi carrillo', 'paty carrillo', 'pathi', 'paty')
group by s.eod_date, s.status, s.submitted_at, s.comments
order by s.eod_date;
