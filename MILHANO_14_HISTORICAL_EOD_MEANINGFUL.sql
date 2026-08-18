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
