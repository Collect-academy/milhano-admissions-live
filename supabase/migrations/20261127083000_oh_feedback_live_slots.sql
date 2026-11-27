begin;
alter table openhouse.feedback_bookings add column if not exists start_at timestamptz, add column if not exists end_at timestamptz, add column if not exists ghl_appointment_id text, add column if not exists sync_state text not null default 'legacy' check(sync_state in ('legacy','sending','confirmed','review','rejected')), add column if not exists sync_detail text;
create unique index if not exists oh_feedback_ghl_unique on openhouse.feedback_bookings(ghl_appointment_id) where ghl_appointment_id is not null;
CREATE OR REPLACE FUNCTION public.milhano_oh_feedback_slot_v1(p_action text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
 b openhouse.feedback_bookings%rowtype; f openhouse.families%rowtype;
 result jsonb; rid uuid; s timestamptz; e timestamptz; ph text; state text; aid text;
begin
 if p_action='claim' then
  if coalesce(p_payload->>'request_id','') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' or coalesce(p_payload->>'start_at','') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[-+]\d{2}:\d{2})$' then return jsonb_build_object('error','Selecciona un horario válido.');end if;
  rid:=(p_payload->>'request_id')::uuid;s:=(p_payload->>'start_at')::timestamptz;e:=s+interval '1 hour';ph:=openhouse.phone10(p_payload->>'phone');
  if s<=now() or (s at time zone 'America/Merida')::date::text is distinct from p_payload->>'date' then return jsonb_build_object('error','Horario no disponible.','code','date_unavailable');end if;
  perform pg_advisory_xact_lock(hashtextextended('milhano-openhouse-trial-2026-2027',0));
  select * into b from openhouse.feedback_bookings where request_id=rid;
  if found then
   if b.phone<>ph or b.child_key is distinct from openhouse.norm(p_payload->>'child') or b.grade_code is distinct from p_payload->>'grade' or b.start_at is distinct from s then return jsonb_build_object('error','Solicitud ya utilizada.');end if;
   if b.sync_state='confirmed' and b.status='booked' then return jsonb_build_object('ok',true,'already',true,'reference',b.id,'date',b.visit_date,'start_at',b.start_at);end if;
   return jsonb_build_object('error','La solicitud anterior requiere revisión o ya fue procesada. Contacta a admisiones.','code','review');
  end if;
  if exists(select 1 from openhouse.feedback_bookings x where x.status='booked' and x.sync_state in ('sending','review','confirmed') and x.start_at<e and x.end_at>s) then return jsonb_build_object('error','Ese horario ya no está disponible. Elige otro.','code','full');end if;
  result:=public.milhano_oh_feedback_v1('book',p_payload,null);
  if result->>'ok' is distinct from 'true' then return result;end if;
  update openhouse.feedback_bookings set start_at=s,end_at=e,sync_state='sending' where id=(result->>'reference')::uuid returning * into b;
  if b.family_id is not null then select * into f from openhouse.families where id=b.family_id;end if;
  return result||jsonb_build_object('claimed',true,'start_at',s,'end_at',e,'contact_id',f.ghl_contact_id,'child',b.child_name,'guardian',b.guardian_name,'phone',b.phone,'email',b.email,'dnd',coalesce(f.dnd,false));
 elsif p_action='finish' then
  rid:=(p_payload->>'reference')::uuid;state:=p_payload->>'state';aid:=nullif(p_payload->>'appointment_id','');
  if state not in ('confirmed','review','rejected') or (state='confirmed' and aid is null) then return jsonb_build_object('error','Resultado inválido.');end if;
  update openhouse.feedback_bookings set sync_state=state,sync_detail=left(coalesce(p_payload->>'detail',''),200),ghl_appointment_id=aid,status=case when state='rejected' then 'cancelled' else status end,cancelled_at=case when state='rejected' then now() else cancelled_at end where id=rid and sync_state='sending' returning * into b;
  return jsonb_build_object('ok',found);
 end if;
 return jsonb_build_object('error','Operación inválida.');
end $function$;
revoke all on function public.milhano_oh_feedback_slot_v1(text,jsonb) from public,anon,authenticated;
grant execute on function public.milhano_oh_feedback_slot_v1(text,jsonb) to service_role;
commit;
