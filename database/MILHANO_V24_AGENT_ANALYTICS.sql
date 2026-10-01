-- V24 · Agent analytics
-- Applied directly to Supabase on 2026-10-01.
-- Adds two service-role-only RPCs used by /agentes.

create or replace function public.milhano_get_agent_activity(
  p_start date,
  p_end date,
  p_agent_id text
)
returns table (
  event_timestamp timestamptz,
  event_kind text,
  ghl_opportunity_id text,
  ghl_contact_id text,
  event_label text
)
language sql
stable
set search_path = public
as $$
with webhook_states as (
  select
    w.id,
    w.opportunity_id,
    w.contact_id,
    w.received_at,
    nullif(w.payload #>> '{opportunity,assignedTo}','') as assigned_to,
    nullif(w.payload #>> '{opportunity,pipelineId}','') as pipeline_id,
    lag(nullif(w.payload #>> '{opportunity,assignedTo}',''))
      over (partition by w.opportunity_id order by w.received_at, w.id) as previous_assigned_to
  from public.milhano_webhook_inbox w
  where nullif(w.payload #>> '{opportunity,pipelineId}','') = 'GYqHbZyWUxxc3K03efVT'
),
assignment_events as (
  select received_at, 'assignment'::text, opportunity_id, contact_id, 'Owner asignado'::text
  from webhook_states
  where assigned_to = p_agent_id
    and assigned_to is distinct from previous_assigned_to
    and (received_at at time zone 'America/Merida')::date between p_start and p_end
),
stage_events as (
  select
    e.event_timestamp,
    'crm_stage'::text,
    e.ghl_opportunity_id,
    e.ghl_contact_id,
    concat_ws(' → ', nullif(e.from_stage,''), nullif(e.to_stage,''))
  from public.milhano_stage_events e
  where e.pipeline_id = 'GYqHbZyWUxxc3K03efVT'
    and e.is_valid = true
    and coalesce(e.is_inferred,false) = false
    and e.attributed_ghl_user_id = p_agent_id
    and e.attribution_method = 'owner_at_event'
    and (e.event_timestamp at time zone 'America/Merida')::date between p_start and p_end
),
communication_events as (
  select
    c.event_timestamp,
    case
      when lower(coalesce(c.channel,'')) = 'call' or coalesce(c.is_call_attempt,false) then 'call'
      when lower(coalesce(c.channel,'')) = 'whatsapp' then 'whatsapp'
      else 'communication'
    end,
    coalesce(
      c.ghl_opportunity_id,
      (
        select o.ghl_opportunity_id
        from public.milhano_opportunities o
        where o.ghl_contact_id = c.ghl_contact_id
          and o.pipeline_id in ('GYqHbZyWUxxc3K03efVT','z1FEJfbtOHusjdwe40Ko')
        order by o.updated_at desc nulls last
        limit 1
      )
    ),
    c.ghl_contact_id,
    case
      when lower(coalesce(c.channel,'')) = 'call' or coalesce(c.is_call_attempt,false)
        then coalesce(nullif(c.call_disposition,''), nullif(c.call_status,''), 'Llamada')
      when lower(coalesce(c.channel,'')) = 'whatsapp' then 'WhatsApp manual'
      else coalesce(nullif(c.message_type,''), 'Comunicación')
    end
  from public.milhano_communication_events c
  where c.ghl_user_id = p_agent_id
    and coalesce(c.is_automated,false) = false
    and (c.event_timestamp at time zone 'America/Merida')::date between p_start and p_end
    and (coalesce(c.is_call_attempt,false) or lower(coalesce(c.channel,'')) in ('call','whatsapp'))
    and exists (
      select 1
      from public.milhano_opportunities o
      where o.ghl_contact_id = c.ghl_contact_id
        and o.pipeline_id in ('GYqHbZyWUxxc3K03efVT','z1FEJfbtOHusjdwe40Ko')
    )
)
select * from assignment_events
union all select * from stage_events
union all select * from communication_events
order by event_timestamp;
$$;

revoke all on function public.milhano_get_agent_activity(date,date,text) from public, anon, authenticated;
grant execute on function public.milhano_get_agent_activity(date,date,text) to service_role;

create or replace function public.milhano_get_agent_setter_funnel(
  p_start date,
  p_end date,
  p_agent_id text
)
returns table (
  new_leads bigint,
  contacted bigint,
  responded bigint,
  meaningful bigint,
  qualified bigint,
  tour_booked bigint,
  new_to_contacted_pct numeric,
  contacted_to_responded_pct numeric,
  responded_to_meaningful_pct numeric,
  meaningful_to_qualified_pct numeric,
  contacted_to_tour_pct numeric
)
language sql
stable
set search_path = public
as $$
with webhook_states as (
  select w.id, w.opportunity_id, w.received_at,
    nullif(w.payload #>> '{opportunity,assignedTo}','') as assigned_to
  from public.milhano_webhook_inbox w
  where nullif(w.payload #>> '{opportunity,pipelineId}','') = 'GYqHbZyWUxxc3K03efVT'
),
first_assignment as (
  select distinct on (opportunity_id) opportunity_id, assigned_to, received_at
  from webhook_states
  where assigned_to is not null
  order by opportunity_id, received_at, id
),
cohort as materialized (
  select * from public.milhano_get_stage_cascade_cohort(p_start,p_end)
),
attributed as (
  select c.*, coalesce(fa.assigned_to, o.assigned_user_id) as agent_id
  from cohort c
  join public.milhano_opportunities o on o.ghl_opportunity_id = c.ghl_opportunity_id
  left join first_assignment fa on fa.opportunity_id = c.ghl_opportunity_id
  where o.pipeline_id in ('GYqHbZyWUxxc3K03efVT','z1FEJfbtOHusjdwe40Ko')
),
agent_cohort as (
  select * from attributed where agent_id = p_agent_id
),
counts as (
  select
    count(*)::bigint as new_leads,
    count(*) filter (where reached_contacted)::bigint as contacted,
    count(*) filter (where reached_responded)::bigint as responded,
    count(*) filter (where reached_meaningful)::bigint as meaningful,
    count(*) filter (where reached_qualified)::bigint as qualified,
    count(*) filter (where exists (
      select 1 from public.vw_milhano_appointment_events_v22 a
      where a.metric_opportunity_id = agent_cohort.ghl_opportunity_id
        and a.canonical_type = 'school_tour'
    ))::bigint as tour_booked
  from agent_cohort
)
select
  new_leads, contacted, responded, meaningful, qualified, tour_booked,
  round(100.0 * contacted / nullif(new_leads,0),1),
  round(100.0 * responded / nullif(contacted,0),1),
  round(100.0 * meaningful / nullif(responded,0),1),
  round(100.0 * qualified / nullif(meaningful,0),1),
  round(100.0 * tour_booked / nullif(contacted,0),1)
from counts;
$$;

revoke all on function public.milhano_get_agent_setter_funnel(date,date,text) from public, anon, authenticated;
grant execute on function public.milhano_get_agent_setter_funnel(date,date,text) to service_role;
