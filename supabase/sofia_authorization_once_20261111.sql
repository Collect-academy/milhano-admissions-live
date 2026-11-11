-- Sofía authorization-once: purely internal; never moves GHL stages.
-- Only a provider-confirmed outbound conversation counts as 'sent'.
CREATE VIEW public.milhano_ai_contact_authorization_status
WITH (security_invoker=true) AS
WITH
  sent_events AS (
    SELECT ghl_contact_id, dispatched_at AS event_at, conversation_id
    FROM public.milhano_ai_dispatch_attempts
    WHERE status IN ('dispatched','finished') AND conversation_id IS NOT NULL
    UNION ALL
    SELECT ghl_contact_id, created_at AS event_at, conversation_id
    FROM public.milhano_ai_setter_dispatches
    WHERE status='dispatched' AND conversation_id IS NOT NULL
    UNION ALL
    SELECT ghl_contact_id, requested_at AS event_at, conversation_id
    FROM public.milhano_ai_manual_dispatches
    WHERE status='permission_requested' AND conversation_id IS NOT NULL
  ),
  sent AS (
    SELECT ghl_contact_id, MIN(event_at) AS first_sent_at,
           COUNT(DISTINCT conversation_id) AS provider_conversations
    FROM sent_events GROUP BY ghl_contact_id
  ),
  reserved AS (
    SELECT m.ghl_contact_id, MIN(m.created_at) AS first_reserved_at
    FROM public.milhano_ai_campaign_members m
    JOIN public.milhano_ai_campaigns c ON c.id=m.campaign_id
    WHERE m.status IN ('queued','claimed','dispatched')
      AND c.status IN ('draft','scheduled','running','paused')
    GROUP BY m.ghl_contact_id
  ),
  uncertain AS (
    SELECT ghl_contact_id FROM public.milhano_ai_campaign_members
    WHERE status='review' AND dispatched_at IS NULL
    UNION
    SELECT ghl_contact_id FROM public.milhano_ai_manual_dispatches
    WHERE status IN ('claimed','needs_review')
  ),
  contacts AS (
    SELECT DISTINCT ghl_contact_id FROM public.milhano_opportunities WHERE ghl_contact_id IS NOT NULL
    UNION SELECT ghl_contact_id FROM sent
    UNION SELECT ghl_contact_id FROM reserved
    UNION SELECT ghl_contact_id FROM uncertain
  )
SELECT contacts.ghl_contact_id,
  CASE WHEN sent.ghl_contact_id IS NOT NULL THEN 'sent'
       WHEN uncertain.ghl_contact_id IS NOT NULL THEN 'needs_review'
       WHEN reserved.ghl_contact_id IS NOT NULL THEN 'reserved'
       ELSE 'not_sent' END AS authorization_status,
  sent.first_sent_at,
  COALESCE(sent.provider_conversations,0)::integer AS provider_conversations,
  reserved.first_reserved_at
FROM contacts
LEFT JOIN sent ON sent.ghl_contact_id=contacts.ghl_contact_id
LEFT JOIN reserved ON reserved.ghl_contact_id=contacts.ghl_contact_id
LEFT JOIN uncertain ON uncertain.ghl_contact_id=contacts.ghl_contact_id;

REVOKE ALL ON public.milhano_ai_contact_authorization_status FROM anon,authenticated;
GRANT SELECT ON public.milhano_ai_contact_authorization_status TO service_role;

-- Campaign creation rejects any contact with an existing request/active reservation.
CREATE OR REPLACE FUNCTION public.milhano_ai_create_campaign_draft(p_name text, p_creator uuid, p_windows jsonb, p_members jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
 v_id uuid;
 v_win uuid;
 v_window_ids uuid[]:=array[]::uuid[];
 v_w record;
 v_m record;
 v_op record;
 v_count integer:=0;
 v_created_count integer:=0;
 v_contact_ids text[]:=array[]::text[];
 v_member_ids text[]:=array[]::text[];
 v_contact text;
 v_opp text;
 v_stage text;
 v_window_index integer;
 v_at timestamptz;
 v_win_start timestamptz;
 v_win_end timestamptz;
begin
 if p_name is null or length(btrim(p_name))<3 or length(p_name)>90 then raise exception 'INVALID_CAMPAIGN_NAME'; end if;
 if jsonb_typeof(p_windows)<>'array' or jsonb_array_length(p_windows) not between 1 and 8 then raise exception 'INVALID_WINDOWS'; end if;
 if jsonb_typeof(p_members)<>'array' or jsonb_array_length(p_members) not between 1 and 500 then raise exception 'INVALID_MEMBERS'; end if;

 perform pg_advisory_xact_lock(hashtext('milhano_ai_campaign_planner_v1'));

 insert into public.milhano_ai_campaigns(name,status,dry_run,concurrency_limit,min_gap_seconds,max_attempts_per_stage,daily_limit,created_by,notes,settings)
 values(btrim(p_name),'draft',true,20,0,2,500,p_creator,'Borrador creado desde dashboard; sin lanzamiento automático.',
 jsonb_build_object('source','dashboard','timezone','America/Merida','fixed_delay_seconds',0,'dispatch_intent','whatsapp_permission_requests','permission_mode','elevenlabs_asynchronous'))
 returning id into v_id;

 for v_w in select value,ordinality from jsonb_array_elements(p_windows) with ordinality
 loop
  v_win_start := (v_w.value->>'start_at')::timestamptz;
  v_win_end := (v_w.value->>'end_at')::timestamptz;
  if v_win_start is null or v_win_end is null or v_win_end <= v_win_start
   or (v_win_start < now() and (
      (v_win_start at time zone 'America/Merida')::date <> (now() at time zone 'America/Merida')::date
      or v_win_end <= now()+interval '1 hour'))
   or v_win_end > now()+interval '90 days'
   then raise exception 'INVALID_WINDOW_DATES'; end if;
  if exists(
   select 1 from public.milhano_ai_campaign_windows w
   where w.campaign_id=v_id and w.start_at < v_win_end and w.end_at > v_win_start
  ) then raise exception 'WINDOW_OVERLAP'; end if;

  insert into public.milhano_ai_campaign_windows(campaign_id,start_at,end_at,max_calls,priority)
  values(v_id,v_win_start,v_win_end,null,v_w.ordinality::integer)
  returning id into v_win;
  v_window_ids:=array_append(v_window_ids,v_win);
 end loop;

 for v_m in select value,ordinality from jsonb_array_elements(p_members) with ordinality
 loop
  v_contact:=nullif(btrim(v_m.value->>'ghl_contact_id'),'');
  v_opp:=nullif(btrim(v_m.value->>'ghl_opportunity_id'),'');
  v_window_index:=(v_m.value->>'window_index')::integer;
  v_at:=(v_m.value->>'scheduled_at')::timestamptz;
  if v_contact is null or v_opp is null or v_window_index not between 0 and array_length(v_window_ids,1)-1
  then raise exception 'INVALID_MEMBER'; end if;
  if v_contact=any(v_contact_ids) or v_opp=any(v_member_ids) then raise exception 'DUPLICATED_CONTACT_OR_OPPORTUNITY_IN_PLAN';end if;
  v_contact_ids:=array_append(v_contact_ids,v_contact);
  v_member_ids:=array_append(v_member_ids,v_opp);

  select o.ghl_opportunity_id,o.ghl_contact_id,o.pipeline_id,o.pipeline_stage_id,
  o.current_stage,o.status,o.phone,o.created_at
  into v_op from public.milhano_opportunities o where o.ghl_opportunity_id=v_opp for update;
  if not found or v_op.ghl_contact_id<>v_contact or v_op.pipeline_id<>'GYqHbZyWUxxc3K03efVT'
   or v_op.status<>'open'
   or nullif(btrim(coalesce(v_op.phone,'')),'') is null
  then raise exception 'OPPORTUNITY_NOT_ELIGIBLE_%',v_opp;end if;
  -- Setter determines enrollment. Other pipelines do not veto a Setter lead.
  if exists(
   select 1 from public.milhano_ai_campaign_members m
   join public.milhano_ai_campaigns c on c.id=m.campaign_id
   where m.ghl_contact_id=v_contact and m.status in ('queued','claimed','dispatched')
   and c.status in ('draft','scheduled','running','paused')
  ) then raise exception 'CONTACT_ALREADY_IN_CAMPAIGN_%',v_opp;end if;
  -- One authorization per GHL contact, across all campaigns/opportunities.
  -- Review/uncertain requests are held to avoid accidental resends.
  if exists (
    select 1 from public.milhano_ai_contact_authorization_status a
    where a.ghl_contact_id=v_contact and a.authorization_status<>'not_sent'
  ) then raise exception 'AUTHORIZATION_ALREADY_TRACKED_FOR_CONTACT_%',v_contact; end if;
  select w.start_at,w.end_at into v_win_start,v_win_end
  from public.milhano_ai_campaign_windows w where w.id=v_window_ids[v_window_index+1];
  -- Una ventana ya iniciada hoy se despacha desde el presente, nunca retroactivamente.
  if v_win_start<now() and v_at<now()+interval '3 seconds' then
    v_at:=now()+interval '3 seconds';
  end if;
  if v_at<v_win_start or v_at>=v_win_end or v_at<now() then raise exception 'SLOT_OUTSIDE_WINDOW'; end if;

  insert into public.milhano_ai_campaign_members(
   campaign_id,window_id,ghl_contact_id,ghl_opportunity_id,
   original_stage_id,original_pipeline_id,original_opportunity_created_at,
   selection_order,scheduled_at,status,snapshot
  ) values(
   v_id,v_window_ids[v_window_index+1],v_contact,v_opp,
   v_op.pipeline_stage_id,v_op.pipeline_id,v_op.created_at,
   v_m.ordinality::integer,v_at,'queued',
   jsonb_build_object('original_stage',v_op.current_stage,'planned_at',now())
  );
  v_created_count:=v_created_count+1;
 end loop;
 return jsonb_build_object('campaign_id',v_id,'selected',v_created_count,'status','draft','dry_run',true);
end
$function$

-- Before dispatch, recheck history even if a stale campaign draft predated this change.
CREATE OR REPLACE FUNCTION public.milhano_ai_claim_one_due()
 RETURNS TABLE(member_id uuid, campaign_id uuid, contact_id text, opportunity_id text, dispatch_key text, expected_stage_id text, expected_pipeline_id text, lease_token uuid)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_member public.milhano_ai_campaign_members%rowtype;
declare v_token uuid;
declare v_global_inflight integer;
declare v_limit integer;
declare v_day_limit integer;
declare v_gap integer;
declare v_today_count integer;
declare v_window_limit integer;
declare v_window_count integer;
declare v_last_dispatch timestamptz;
BEGIN
 -- Business-hour guarantee for all campaign dispatches, including retries.
 if (now() at time zone 'America/Merida')::time < time '08:00'
    or (now() at time zone 'America/Merida')::time >= time '20:00'
 then return;end if;
 perform pg_advisory_xact_lock(hashtext('milhano_ai_global_dispatch_v1'));
 select m.* into v_member
 from public.milhano_ai_campaign_members m
 join public.milhano_ai_campaigns c on c.id=m.campaign_id
 join public.milhano_ai_campaign_windows w on w.id=m.window_id and w.campaign_id=m.campaign_id
 where m.status='queued' and m.scheduled_at <= now()
 and c.status='running' and c.dry_run=false
 and m.attempts_total<2
 -- First-time authorization only; retries of a previously authorized CALL remain unchanged.
 and (m.attempts_total>0 or (
   not exists (
     select 1 from public.milhano_ai_contact_authorization_status a
     where a.ghl_contact_id=m.ghl_contact_id
       and a.authorization_status in ('sent','needs_review')
   )
   and not exists (
     select 1 from public.milhano_ai_campaign_members older
     join public.milhano_ai_campaigns older_c on older_c.id=older.campaign_id
     where older.ghl_contact_id=m.ghl_contact_id and older.id<>m.id
       and older.status in ('queued','claimed','dispatched')
       and older_c.status in ('draft','scheduled','running','paused')
       and (older.created_at<m.created_at or
            (older.created_at=m.created_at and older.id<m.id))
   )
 ))
 and exists(select 1 from public.milhano_ai_runtime_control k where k.singleton=true and k.live_dispatch_enabled)
 and (m.attempts_total>0 or (select count(distinct a.campaign_member_id) from public.milhano_ai_dispatch_attempts a
      where a.campaign_id=c.id)<coalesce((c.settings->>'release_limit')::integer,0))
 and (m.attempts_total>0 or (now() between w.start_at and w.end_at and m.scheduled_at between w.start_at and w.end_at))
 order by m.scheduled_at,m.selection_order
 for update of m skip locked limit 1;
 if not found then return; end if;
 select c.concurrency_limit,c.daily_limit,c.min_gap_seconds
 into v_limit,v_day_limit,v_gap
 from public.milhano_ai_campaigns c where c.id=v_member.campaign_id for update;
 -- Pending WhatsApp approvals do not occupy a live call slot.
 -- Requests to other contacts can be submitted without waiting.
 select count(*) into v_today_count from public.milhano_ai_dispatch_attempts a
 where a.campaign_id=v_member.campaign_id
 and (a.dispatched_at at time zone 'America/Merida')::date=(now() at time zone 'America/Merida')::date;
 if v_today_count>=v_day_limit then return; end if;
 select max(a.dispatched_at) into v_last_dispatch
 from public.milhano_ai_dispatch_attempts a where a.campaign_id=v_member.campaign_id;
 -- No artificial gap between permission requests.
 select w.max_calls into v_window_limit from public.milhano_ai_campaign_windows w where w.id=v_member.window_id;
 if v_window_limit is not null and v_member.attempts_total=0 then
  select count(*) into v_window_count from public.milhano_ai_dispatch_attempts a
  where a.window_id=v_member.window_id and a.dispatched_at is not null;
  if v_window_count>=v_window_limit then return; end if;
 end if;
 v_token:=gen_random_uuid();
 update public.milhano_ai_campaign_members m
 set status='claimed',lease_token=v_token,lease_expires_at=now()+interval '10 minutes',
 last_dispatch_key='campaign:'||m.campaign_id::text||':member:'||m.id::text||':attempt:'||(m.attempts_total+1)::text,
 attempts_total=m.attempts_total+1,attempts_in_stage=m.attempts_in_stage+1,updated_at=now()
 where m.id=v_member.id
 returning m.* into v_member;
 insert into public.milhano_ai_dispatch_attempts(
 campaign_id,campaign_member_id,window_id,dispatch_key,ghl_contact_id,ghl_opportunity_id,stage_at_claim,attempt_number)
 values(v_member.campaign_id,v_member.id,v_member.window_id,v_member.last_dispatch_key,
 v_member.ghl_contact_id,v_member.ghl_opportunity_id,v_member.original_stage_id,v_member.attempts_total);
 return query select v_member.id,v_member.campaign_id,v_member.ghl_contact_id,
 v_member.ghl_opportunity_id,v_member.last_dispatch_key,v_member.original_stage_id,
 v_member.original_pipeline_id,v_token;
end $function$


-- A manual send cannot bypass the contact-level authorization history.
CREATE UNIQUE INDEX IF NOT EXISTS milhano_ai_manual_dispatches_one_contact
  ON public.milhano_ai_manual_dispatches (ghl_contact_id);
CREATE OR REPLACE FUNCTION sofia_internal.milhano_ai_guard_manual_authorization_once()
RETURNS trigger LANGUAGE plpgsql
SET search_path=public,sofia_internal
AS $guard$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('milhano_ai_campaign_planner_v1'));
  IF EXISTS (
    SELECT 1 FROM public.milhano_ai_contact_authorization_status a
    WHERE a.ghl_contact_id=NEW.ghl_contact_id AND a.authorization_status<>'not_sent'
  ) THEN
    RAISE EXCEPTION 'AUTHORIZATION_ALREADY_TRACKED_FOR_CONTACT';
  END IF;
  RETURN NEW;
END
$guard$;
DROP TRIGGER IF EXISTS milhano_ai_manual_authorization_once ON public.milhano_ai_manual_dispatches;
CREATE TRIGGER milhano_ai_manual_authorization_once
  BEFORE INSERT ON public.milhano_ai_manual_dispatches
  FOR EACH ROW EXECUTE FUNCTION sofia_internal.milhano_ai_guard_manual_authorization_once();
REVOKE ALL ON FUNCTION sofia_internal.milhano_ai_guard_manual_authorization_once() FROM PUBLIC,anon,authenticated;
