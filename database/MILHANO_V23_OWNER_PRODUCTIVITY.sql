-- MILHANO V23 · Opportunity owner resolution + agent productivity
-- 2026-10-01

-- 1) Register Miguel as a GHL operator mapping. This does not create an Auth login.
insert into public.milhano_app_users (
  ghl_user_id,
  display_name,
  email,
  role,
  is_active
)
values (
  'CVHK8CdZzT6A7zLxr5Sg',
  'Miguel Campos',
  'primaria@coldem.edu.mx',
  'advisor',
  true
)
on conflict (ghl_user_id) do update
set display_name = excluded.display_name,
    email = excluded.email,
    is_active = true,
    updated_at = now();

-- Normalize existing opportunity display values without changing the stable GHL owner id.
update public.milhano_opportunities
set assigned_user = 'Miguel Campos'
where assigned_user_id = 'CVHK8CdZzT6A7zLxr5Sg'
  and assigned_user is distinct from 'Miguel Campos';

-- Backfill app-user attribution for already captured events/messages.
update public.milhano_stage_events se
set attributed_app_user_id = u.id
from public.milhano_app_users u
where se.attributed_app_user_id is null
  and se.attributed_ghl_user_id = u.ghl_user_id
  and u.is_active = true;

update public.milhano_communication_events ce
set attributed_app_user_id = u.id
from public.milhano_app_users u
where ce.attributed_app_user_id is null
  and ce.ghl_user_id = u.ghl_user_id
  and u.is_active = true;

-- 2) Resolve pipeline owner by GHL id first, then fall back to stored/historical labels.
create or replace view public.vw_milhano_pipeline_current
with (security_invoker = true)
as
select
  o.ghl_opportunity_id,
  o.ghl_contact_id,
  o.legacy_lead_id,
  o.pipeline_name,
  o.pipeline_stage_id,
  o.current_stage,
  o.status,
  o.opportunity_name,
  o.contact_name,
  o.phone,
  o.email,
  o.source,
  o.assigned_user,
  o.created_at,
  o.updated_at,
  o.original_lead_date,
  o.student_name,
  o.school_cycle,
  o.level,
  o.grade_interest,
  o.priority,
  o.historical_advisor,
  o.admission_route,
  o.direct_admission_reason,
  o.no_fit_reason,
  o.lost_reason,
  o.historical_call_count,
  o.historical_comments,
  o.history_scope,
  o.record_source,
  o.synced_at,
  sc.display_order as stage_display_order,
  sc.stage_group,
  o.status = 'open'::text as is_active,
  o.status = 'won'::text or o.current_stage = 'Inscrito'::text as is_won,
  o.status = 'lost'::text or o.current_stage = any(array['No fit'::text, 'Lost / Sin continuidad'::text]) as is_exit,
  o.history_scope = 'reconstructed_from_excel'::text as has_reconstructed_history,
  case
    when o.updated_at is null then null::integer
    else current_date - (o.updated_at at time zone 'America/Merida')::date
  end as days_since_update,
  case
    when o.updated_at is null then 'Sin fecha'::text
    when (current_date - (o.updated_at at time zone 'America/Merida')::date) <= 2 then '0–2 días'::text
    when (current_date - (o.updated_at at time zone 'America/Merida')::date) <= 7 then '3–7 días'::text
    when (current_date - (o.updated_at at time zone 'America/Merida')::date) <= 14 then '8–14 días'::text
    else '15+ días'::text
  end as inactivity_bucket,
  coalesce(
    nullif(u.display_name, ''::text),
    nullif(o.assigned_user, ''::text),
    nullif(o.historical_advisor, ''::text),
    'Sin asignar'::text
  ) as operational_owner
from public.vw_milhano_opportunities_current o
left join public.vw_milhano_stage_catalog sc on sc.stage_name = o.current_stage
left join public.milhano_app_users u
  on u.ghl_user_id = o.assigned_user_id
 and u.is_active = true;

-- 3) Fast, aggregated owner/productivity payload for the dashboard.
create or replace function public.milhano_get_agent_productivity(
  p_start date,
  p_end date
)
returns table (
  ghl_user_id text,
  display_name text,
  current_assigned bigint,
  current_open bigint,
  current_new_lead bigint,
  current_no_answer bigint,
  current_callback bigint,
  stage_moves bigint,
  opportunities_worked bigint,
  qualified_moves bigint,
  tour_booked_moves bigint,
  tour_attended_moves bigint,
  trial_booked_moves bigint,
  trial_attended_moves bigint,
  closed_moves bigint,
  call_attempts bigint,
  connected_calls bigint,
  manual_whatsapp bigint,
  meaningful_conversations bigint,
  unique_contacts_worked bigint
)
language sql
stable
set search_path = public
as $$
with admissions_opps as (
  select *
  from public.milhano_opportunities
  where pipeline_id in (
    'L9nSVkwjFsHN5WFDs3Aa',
    'GYqHbZyWUxxc3K03efVT',
    'z1FEJfbtOHusjdwe40Ko'
  )
),
v2_current_opps as (
  select *
  from public.milhano_opportunities
  where pipeline_id in (
    'GYqHbZyWUxxc3K03efVT',
    'z1FEJfbtOHusjdwe40Ko'
  )
),
period_stage as (
  select se.*
  from public.milhano_stage_events se
  join admissions_opps o on o.ghl_opportunity_id = se.ghl_opportunity_id
  where se.is_valid = true
    and se.attributed_ghl_user_id is not null
    and (se.event_timestamp at time zone 'America/Merida')::date between p_start and p_end
),
period_comm as (
  select ce.*
  from public.milhano_communication_events ce
  where ce.ghl_user_id is not null
    and coalesce(ce.is_automated, false) = false
    and (ce.event_timestamp at time zone 'America/Merida')::date between p_start and p_end
    and exists (
      select 1
      from admissions_opps o
      where o.ghl_contact_id = ce.ghl_contact_id
         or (ce.ghl_opportunity_id is not null and o.ghl_opportunity_id = ce.ghl_opportunity_id)
    )
),
agent_ids as (
  select ghl_user_id from public.milhano_app_users where is_active = true and ghl_user_id is not null
  union
  select assigned_user_id from v2_current_opps where assigned_user_id is not null
  union
  select attributed_ghl_user_id from period_stage where attributed_ghl_user_id is not null
  union
  select ghl_user_id from period_comm where ghl_user_id is not null
),
agent_names as (
  select
    a.ghl_user_id,
    coalesce(
      max(u.display_name) filter (where u.display_name is not null and u.display_name <> ''),
      max(o.assigned_user) filter (
        where o.assigned_user is not null
          and o.assigned_user <> ''
          and o.assigned_user <> a.ghl_user_id
      ),
      'GHL · ' || right(a.ghl_user_id, 6)
    ) as display_name
  from agent_ids a
  left join public.milhano_app_users u
    on u.ghl_user_id = a.ghl_user_id
   and u.is_active = true
  left join v2_current_opps o on o.assigned_user_id = a.ghl_user_id
  group by a.ghl_user_id
),
current_agg as (
  select
    assigned_user_id as ghl_user_id,
    count(*) as current_assigned,
    count(*) filter (where lower(coalesce(status,'')) = 'open') as current_open,
    count(*) filter (where lower(coalesce(current_stage,'')) = 'new lead') as current_new_lead,
    count(*) filter (where lower(coalesce(current_stage,'')) like 'no answer%') as current_no_answer,
    count(*) filter (where lower(coalesce(current_stage,'')) = 'callback') as current_callback
  from v2_current_opps
  where assigned_user_id is not null
  group by assigned_user_id
),
stage_agg as (
  select
    attributed_ghl_user_id as ghl_user_id,
    count(*) as stage_moves,
    count(distinct ghl_opportunity_id) as opportunities_worked,
    count(*) filter (where lower(coalesce(to_stage,'')) in ('fit','qualified')) as qualified_moves,
    count(*) filter (where lower(coalesce(to_stage,'')) in ('school tour agendado','tour booked')) as tour_booked_moves,
    count(*) filter (where lower(coalesce(to_stage,'')) in ('school tour atendido','tour attended')) as tour_attended_moves,
    count(*) filter (where lower(coalesce(to_stage,'')) in ('pasadía agendada','pasadia booked','pasadía booked')) as trial_booked_moves,
    count(*) filter (where lower(coalesce(to_stage,'')) in ('pasadía asistida','pasadia attended','pasadía attended')) as trial_attended_moves,
    count(*) filter (where lower(coalesce(to_stage,'')) in ('inscrito','closed / enrolled')) as closed_moves
  from period_stage
  group by attributed_ghl_user_id
),
comm_agg as (
  select
    ghl_user_id,
    count(*) filter (where coalesce(is_call_attempt,false) = true) as call_attempts,
    count(*) filter (where coalesce(is_connected_raw,false) = true) as connected_calls,
    count(*) filter (where lower(coalesce(channel,'')) = 'whatsapp' and lower(coalesce(direction,'')) = 'outbound') as manual_whatsapp,
    count(*) filter (where coalesce(is_meaningful_conversation,false) = true or coalesce(is_meaningful_whatsapp,false) = true) as meaningful_conversations
  from period_comm
  group by ghl_user_id
),
worked_contacts as (
  select attributed_ghl_user_id as ghl_user_id, ghl_contact_id
  from period_stage
  where ghl_contact_id is not null
  union
  select ghl_user_id, ghl_contact_id
  from period_comm
  where ghl_contact_id is not null
),
contact_agg as (
  select ghl_user_id, count(distinct ghl_contact_id) as unique_contacts_worked
  from worked_contacts
  group by ghl_user_id
)
select
  n.ghl_user_id,
  n.display_name,
  coalesce(c.current_assigned,0),
  coalesce(c.current_open,0),
  coalesce(c.current_new_lead,0),
  coalesce(c.current_no_answer,0),
  coalesce(c.current_callback,0),
  coalesce(s.stage_moves,0),
  coalesce(s.opportunities_worked,0),
  coalesce(s.qualified_moves,0),
  coalesce(s.tour_booked_moves,0),
  coalesce(s.tour_attended_moves,0),
  coalesce(s.trial_booked_moves,0),
  coalesce(s.trial_attended_moves,0),
  coalesce(s.closed_moves,0),
  coalesce(cm.call_attempts,0),
  coalesce(cm.connected_calls,0),
  coalesce(cm.manual_whatsapp,0),
  coalesce(cm.meaningful_conversations,0),
  coalesce(ca.unique_contacts_worked,0)
from agent_names n
left join current_agg c using (ghl_user_id)
left join stage_agg s using (ghl_user_id)
left join comm_agg cm using (ghl_user_id)
left join contact_agg ca using (ghl_user_id)
order by n.display_name;
$$;

revoke all on function public.milhano_get_agent_productivity(date,date) from public, anon, authenticated;
grant execute on function public.milhano_get_agent_productivity(date,date) to service_role;

-- 4) Current unassigned queue helper.
create or replace function public.milhano_get_unassigned_admissions_count()
returns bigint
language sql
stable
set search_path = public
as $$
  select count(*)
  from public.milhano_opportunities
  where pipeline_id in (
    'GYqHbZyWUxxc3K03efVT',
    'z1FEJfbtOHusjdwe40Ko'
  )
    and assigned_user_id is null
    and lower(coalesce(status,'')) = 'open';
$$;

revoke all on function public.milhano_get_unassigned_admissions_count() from public, anon, authenticated;
grant execute on function public.milhano_get_unassigned_admissions_count() to service_role;

-- 5) Live sync edge case: GHL sends assignedTo:null when an opportunity is unassigned.
-- The previous RPC kept the old owner via COALESCE. Patch only those two assignments
-- while preserving the rest of the production function exactly as deployed.
do $$
declare
  v_oid oid;
  v_ddl text;
  v_new text;
begin
  select oid into v_oid
  from pg_proc
  where pronamespace = 'public'::regnamespace
    and proname = 'milhano_process_opportunity_live_event'
  limit 1;

  if v_oid is null then
    raise exception 'milhano_process_opportunity_live_event no existe';
  end if;

  select pg_get_functiondef(v_oid) into v_ddl;

  v_new := replace(
    v_ddl,
    E'assigned_user = coalesce(\r\n                nullif(trim(v_actor_name), ''''),\r\n                nullif(trim(p_assigned_user_id), ''''),\r\n                assigned_user\r\n            ),',
    E'assigned_user = case\r\n                when nullif(trim(p_assigned_user_id), '''') is null then null\r\n                else coalesce(\r\n                    nullif(trim(v_actor_name), ''''),\r\n                    nullif(trim(p_assigned_user_id), '''')\r\n                )\r\n            end,'
  );

  v_new := replace(
    v_new,
    E'assigned_user_id = coalesce(\r\n                nullif(trim(p_assigned_user_id), ''''),\r\n                assigned_user_id\r\n            ),',
    E'assigned_user_id = nullif(trim(p_assigned_user_id), ''''),'
  );

  -- If production is already patched, leave it untouched and succeed idempotently.
  if v_new = v_ddl then
    if strpos(v_ddl, 'assigned_user_id = nullif(trim(p_assigned_user_id)') > 0 then
      return;
    end if;
    raise exception 'No se encontró el bloque esperado del owner en el RPC live';
  end if;

  execute v_new;
end $$;
