begin;
alter table openhouse.outbox add column if not exists attempted_at timestamptz;
alter table openhouse.outbox add column if not exists attempts integer not null default 0;
CREATE OR REPLACE FUNCTION public.milhano_oh_stage_v1(p_action text, p_id uuid, p_actor text DEFAULT NULL::text, p_result text DEFAULT NULL::text, p_detail text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare f openhouse.families%rowtype; ob openhouse.outbox%rowtype; d date:=(now() at time zone 'America/Merida')::date; admin_ok boolean:=false;
begin
 perform pg_advisory_xact_lock(hashtextextended('milhano-openhouse-2026-11-27',0));
 if p_action='finish' and p_result in ('submitted','review','blocked') then
  update openhouse.outbox set status=p_result,sent_at=case when p_result='submitted' then now() else null end,last_error=left(p_detail,200) where family_id=p_id and status='dispatching';
  return jsonb_build_object('ok',found);
 end if;
 if p_action not in ('claim','retry') then return jsonb_build_object('claimed',false);end if;
 if p_action='retry' then
  select exists(select 1 from public.milhano_app_users u where u.id::text=p_actor and u.is_active and u.role='admin') into admin_ok;
  if not admin_ok then return jsonb_build_object('claimed',false,'reason','Solo administración puede reintentar.');end if;
 end if;
 select * into f from openhouse.families where id=p_id and event_key='2026-11-27' and attendance='present' for update;
 if not found then return jsonb_build_object('claimed',false,'reason','Sin asistencia registrada.');end if;
 -- Pre-event only the exact test opportunity can dispatch. On later days only an explicit admin retry can reconcile.
 if not (d=date '2026-11-27' or (d=date '2026-11-26' and f.ghl_opportunity_id='pM8JTFat5Mi02AHQPy9G') or (d>date '2026-11-27' and admin_ok)) then return jsonb_build_object('claimed',false,'reason','Fuera de la fecha operativa.');end if;
 if f.dnd or f.ghl_contact_id is null or f.ghl_opportunity_id is null then
  update openhouse.outbox set status='blocked',last_error=case when f.dnd then 'DND: verificar antes de enviar bienvenida' else 'Sin oportunidad GHL única y vinculada' end where family_id=p_id and status in ('pending','review','blocked');
  return jsonb_build_object('claimed',false,'reason','DND o falta oportunidad única.');
 end if;
 update openhouse.outbox set status='dispatching',last_error=null,attempted_at=now(),attempts=attempts+1
 where family_id=p_id and (status='pending' or (admin_ok and (status='review' or (status='dispatching' and attempted_at<now()-interval '2 minutes'))))
 returning * into ob;
 if not found then return jsonb_build_object('claimed',false,'reason','Ya sincronizado, bloqueado o en proceso.');end if;
 return jsonb_build_object('claimed',true,'contactId',f.ghl_contact_id,'opportunityId',f.ghl_opportunity_id,'attempt',ob.attempts);
end $function$;
revoke all on function public.milhano_oh_stage_v1(text,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.milhano_oh_stage_v1(text,uuid,text,text,text) to service_role;
commit;
