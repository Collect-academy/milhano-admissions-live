-- Direct GHL sync and optional welcome webhook. No calls made by this migration.
begin;
create table if not exists openhouse.sync_state (event_key date primary key,last_synced_at timestamptz not null,source_count int not null);
alter table openhouse.sync_state enable row level security;
revoke all on openhouse.sync_state from public,anon,authenticated;
grant select,insert,update on openhouse.sync_state to service_role;
do $$ begin if to_regclass('openhouse_import.source_snapshots') is not null then insert into openhouse.sync_state select '2026-11-27',min(fetched_at),(select count(*) from openhouse.families where event_key='2026-11-27') from openhouse_import.source_snapshots where event_key='2026-11-27' having count(*)=4 on conflict do nothing; end if; end $$;
create or replace function public.milhano_oh_merge_v1(p_rows jsonb,p_actor text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r jsonb; cid text; n int; conflicts int:=0; linked uuid; ev constant date:='2026-11-27';
begin
 if not exists(select 1 from public.milhano_app_users where id::text=p_actor and is_active and role='admin') then return jsonb_build_object('error','Solo administración puede sincronizar.'); end if;
 if jsonb_typeof(p_rows) is distinct from 'array' then return jsonb_build_object('error','Respuesta inválida.'); end if;
 n:=jsonb_array_length(p_rows);
 if n<1 or n>5000 or n<>(select count(distinct x->>'ghl_contact_id') from jsonb_array_elements(p_rows) x) then return jsonb_build_object('error','Fuente incompleta o duplicada.'); end if;
 if exists(select 1 from jsonb_array_elements(p_rows) x where coalesce(x->>'name','')='' or coalesce(x->>'ghl_contact_id','')='' or jsonb_typeof(x->'reservation_slots') is distinct from 'array' or jsonb_typeof(x->'appointment_ids') is distinct from 'array' or jsonb_typeof(x->'fields') is distinct from 'object') then return jsonb_build_object('error','Fuente inválida.'); end if;
 perform pg_advisory_xact_lock(hashtextextended('milhano-openhouse-2026-11-27',0));
 if n < (select count(*) from openhouse.families where event_key=ev and origin='ghl')*0.8 then return jsonb_build_object('error','La fuente perdió más de 20% de contactos. Revisión requerida.'); end if;
 for r in select value from jsonb_array_elements(p_rows) loop
   cid:=r->>'ghl_contact_id'; linked:=null;
   if not exists(select 1 from openhouse.families where event_key=ev and ghl_contact_id=cid) then
     select count(*) into n from openhouse.families f where f.event_key=ev and f.ghl_contact_id is null and ((openhouse.phone10(r->>'phone')<>'' and openhouse.phone10(f.phone)=openhouse.phone10(r->>'phone')) or (coalesce(r->>'email','')<>'' and lower(f.email)=lower(r->>'email')));
     if n>0 then conflicts:=conflicts+1; continue; end if;
   end if;
   insert into openhouse.families(event_key,ghl_contact_id,ghl_opportunity_id,name,phone,email,fields,reservation_slots,appointment_ids,dnd)
   values(ev,cid,nullif(r->>'ghl_opportunity_id',''),r->>'name',coalesce(r->>'phone',''),coalesce(r->>'email',''),r->'fields',array(select jsonb_array_elements_text(r->'reservation_slots')),array(select jsonb_array_elements_text(r->'appointment_ids')),coalesce((r->>'dnd')::boolean,false))
   on conflict(event_key,ghl_contact_id) do update set
     ghl_opportunity_id=excluded.ghl_opportunity_id,
     name=case when openhouse.families.corrected then openhouse.families.name else excluded.name end,
     phone=case when openhouse.families.corrected then openhouse.families.phone else excluded.phone end,
     email=case when openhouse.families.corrected then openhouse.families.email else excluded.email end,
     fields=excluded.fields,reservation_slots=excluded.reservation_slots,appointment_ids=excluded.appointment_ids,dnd=excluded.dnd,updated_at=now();
 end loop;
 -- Records that disappeared are retained for audit; do not erase any recorded attendance.
 update openhouse.families f set reservation_slots='{}',appointment_ids='{}',updated_at=now() where f.event_key=ev and f.ghl_contact_id is not null and f.attendance='pending' and not exists(select 1 from jsonb_array_elements(p_rows) x where x->>'ghl_contact_id'=f.ghl_contact_id);
 insert into openhouse.sync_state(event_key,last_synced_at,source_count) values(ev,now(),jsonb_array_length(p_rows)) on conflict(event_key) do update set last_synced_at=excluded.last_synced_at,source_count=excluded.source_count;
 return jsonb_build_object('ok',true,'contacts',jsonb_array_length(p_rows),'manual_conflicts',conflicts,'reserved',(select count(*) from openhouse.families where event_key=ev and cardinality(reservation_slots)>0));
end $$;
revoke all on function public.milhano_oh_merge_v1(jsonb,text) from public,anon,authenticated;
grant execute on function public.milhano_oh_merge_v1(jsonb,text) to service_role;
alter table openhouse.outbox drop constraint if exists outbox_status_check;
alter table openhouse.outbox add constraint outbox_status_check check(status in ('pending','sent','failed','blocked','cancelled','dispatching','submitted','review'));
create or replace function public.milhano_oh_notification_v1(p_action text,p_id uuid,p_result text default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare f openhouse.families%rowtype;
begin
 perform pg_advisory_xact_lock(hashtextextended('milhano-openhouse-2026-11-27',0));
 if p_action='claim' then
   select * into f from openhouse.families where id=p_id and event_key='2026-11-27' and attendance='present' and not dnd and ghl_contact_id is not null;
   if not found then return jsonb_build_object('claimed',false); end if;
   update openhouse.outbox set status='dispatching',last_error=null where family_id=p_id and status='pending';
   if not found then return jsonb_build_object('claimed',false); end if;
   return jsonb_build_object('claimed',true,'contactId',f.ghl_contact_id,'phone',f.phone,'email',f.email,'event_key',f.event_key,'family_id',f.id);
 elsif p_action='finish' and p_result in ('submitted','review') then
   update openhouse.outbox set status=p_result,sent_at=case when p_result='submitted' then now() else null end,last_error=case when p_result='review' then 'Entrega incierta: verificar GHL antes de reintentar.' else null end where family_id=p_id and status='dispatching';
   return jsonb_build_object('ok',found);
 end if;
 return jsonb_build_object('ok',false);
end $$;
revoke all on function public.milhano_oh_notification_v1(text,uuid,text) from public,anon,authenticated;
grant execute on function public.milhano_oh_notification_v1(text,uuid,text) to service_role;
create or replace function public.milhano_oh_v1(p_action text,p_payload jsonb default '{}'::jsonb,p_actor text default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare
 ev constant date := '2026-11-27';
 slots constant text[] := array['07:30','09:00','11:00','12:30','14:00'];
 coords constant text[] := array['José Lugo','Miguel','Aurora'];
 is_public boolean := p_action in ('lookup','confirm');
 phone text := openhouse.phone10(p_payload->>'phone');
 email text := lower(trim(coalesce(p_payload->>'email','')));
 nm text := trim(coalesce(p_payload->>'name',''));
 fid uuid; f openhouse.families%rowtype; oldf jsonb; slot text; coord text; st text; n int; k text;
 localnow timestamp := now() at time zone 'America/Merida';
 begin
 if is_public then
   if localnow::date<>ev or localnow::time<time '07:00' or localnow::time>time '15:30' then return jsonb_build_object('error','El registro estará disponible el viernes 27 de noviembre, de 07:00 a 15:30.','code','closed'); end if;
   if coalesce(p_payload->>'bucket','') !~ '^[a-f0-9]{64}$' then return jsonb_build_object('error','Solicitud inválida.'); end if;
   delete from openhouse.rate_limits where window_start<now()-interval '1 day';
   foreach k in array array['global','ip:'||(p_payload->>'bucket')] loop
     insert into openhouse.rate_limits(bucket,window_start) values(k,date_bin(interval '5 minutes',now(),timestamptz '2026-01-01'))
     on conflict(bucket,window_start) do update set hits=openhouse.rate_limits.hits+1 returning hits into n;
     if n>(case when k='global' then 500 else 100 end) then return jsonb_build_object('error','Demasiadas solicitudes. Acércate al equipo.','code','rate'); end if;
   end loop;
   if phone='' and (length(email)>254 or email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then return jsonb_build_object('matches','[]'::jsonb); end if;
   if p_action='lookup' then
     return jsonb_build_object('matches',coalesce((select jsonb_agg(v) from (select jsonb_build_object('id',ff.id,'label',left(split_part(ff.name,' ',1),1)||'••• '||left(split_part(ff.name,' ',2),1)||'•••','slots',ff.reservation_slots,'present',ff.attendance='present') v from openhouse.families ff where ff.event_key=ev and ((phone<>'' and openhouse.phone10(ff.phone)=phone) or (email<>'' and lower(ff.email)=email)) and (length(nm)<3 or position(openhouse.norm(nm) in openhouse.norm(ff.name))>0) order by ff.name limit 5) q),'[]'::jsonb));
   end if;
 else
   if not exists(select 1 from public.milhano_app_users u where u.id::text=p_actor and u.is_active and (u.role='admin' or exists(select 1 from openhouse.staff s where s.app_user_id=u.id::text))) then return jsonb_build_object('error','Acceso no autorizado.','code','forbidden'); end if;
   if p_action='list' then
     return jsonb_build_object('families',coalesce((select jsonb_agg(to_jsonb(ff)||jsonb_build_object('notification_status',ob.status) order by ff.name) from openhouse.families ff left join openhouse.outbox ob on ob.family_id=ff.id where ff.event_key=ev),'[]'::jsonb));
   end if;
 end if;
 if not is_public and p_payload ? 'coordinator' and (p_payload->>'coordinator' is null or not((p_payload->>'coordinator')=any(coords))) then return jsonb_build_object('error','Coordinación inválida.'); end if;
 if not is_public and p_payload ? 'slot' and (p_payload->>'slot' is null or not((p_payload->>'slot')=any(slots))) then return jsonb_build_object('error','Horario inválido.'); end if;
 -- Serialize all event writes: duplicate clicks and concurrent allocations share one transaction lock.
 perform pg_advisory_xact_lock(hashtextextended('milhano-openhouse-2026-11-27',0));
 if p_action='create' then
   slot:=p_payload->>'slot';
   if length(nm)<3 or length(nm)>150 or phone='' or length(email)>254 or (email<>'' and email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') or slot is null or not(slot=any(slots)) then return jsonb_build_object('error','Nombre, WhatsApp y horario válidos requeridos.'); end if;
   if exists(select 1 from openhouse.families ff where ff.event_key=ev and (openhouse.phone10(ff.phone)=phone or (email<>'' and lower(ff.email)=email))) then return jsonb_build_object('error','Ya existe un registro con ese teléfono o correo. Busca y corrige el existente.'); end if;
   insert into openhouse.families(event_key,name,phone,email,origin,corrected) values(ev,nm,'+52'||phone,email,'walkin',true) returning * into f;
   fid:=f.id; oldf:=null; st:='present';
 elsif p_action in ('confirm','update') then
   if coalesce(p_payload->>'id','') !~ '^[0-9a-fA-F-]{36}$' then return jsonb_build_object('error','Registro inválido.'); end if;
   fid:=(p_payload->>'id')::uuid;
   select * into f from openhouse.families where id=fid and event_key=ev for update;
   if not found then return jsonb_build_object('error','Registro no encontrado.'); end if;
   oldf:=to_jsonb(f);
   if is_public then
     if not ((phone<>'' and openhouse.phone10(f.phone)=phone) or (email<>'' and lower(f.email)=email)) or not ((length(openhouse.norm(nm))>=3 and openhouse.norm(nm)=openhouse.norm(f.name)) or (phone<>'' and openhouse.phone10(f.phone)=phone and email<>'' and lower(f.email)=email)) then return jsonb_build_object('error','Verifica tu nombre completo o correo y WhatsApp. Si no coincide, acércate al equipo.'); end if;
     if f.attendance='present' then return jsonb_build_object('ok',true,'already',true); end if;
     select z into slot from unnest(slots) z order by abs(extract(epoch from (localnow::time-z::time))) limit 1;
     st:='present';
   else
     st:=coalesce(p_payload->>'attendance',f.attendance);
     slot:=coalesce(p_payload->>'slot',f.actual_slot,f.reservation_slots[1]);
     if st not in ('pending','present','absent') or (st='present' and (slot is null or not(slot=any(slots)))) then return jsonb_build_object('error','Selecciona un horario válido.'); end if;
     if p_payload ? 'name' or p_payload ? 'phone' or p_payload ? 'email' then
       nm:=coalesce(p_payload->>'name',f.name); phone:=openhouse.phone10(coalesce(p_payload->>'phone',f.phone)); email:=lower(trim(coalesce(p_payload->>'email',f.email)));
       if length(trim(nm))<3 or length(nm)>150 or (p_payload ? 'phone' and phone='') or length(email)>254 or (email<>'' and email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then return jsonb_build_object('error','Datos de contacto inválidos.'); end if;
       if exists(select 1 from openhouse.families ff where ff.event_key=ev and ff.id<>fid and ((phone<>'' and openhouse.phone10(ff.phone)=phone) or (email<>'' and lower(ff.email)=email))) then return jsonb_build_object('error','Otro registro ya tiene ese teléfono o correo.'); end if;
       update openhouse.families set name=nm,phone=case when phone<>'' then '+52'||phone else f.phone end,email=email,corrected=true where id=fid;
     end if;
   end if;
 else return jsonb_build_object('error','Operación inválida.');
 end if;
 if st='present' then
   if not is_public and p_payload ? 'coordinator' then
     coord:=p_payload->>'coordinator';
     if coord is null or not(coord=any(coords)) then return jsonb_build_object('error','Coordinación inválida.'); end if;
   elsif f.attendance='present' and f.actual_slot=slot and f.coordinator is not null then coord:=f.coordinator;
   else
     select z into coord from unnest(coords) with ordinality a(z,ord) order by (select count(*) from openhouse.families ff where ff.event_key=ev and ff.attendance='present' and ff.actual_slot=slot and ff.coordinator=z and ff.id<>fid), (select count(*) from openhouse.families ff where ff.event_key=ev and ff.attendance='present' and ff.coordinator=z and ff.id<>fid),ord limit 1;
   end if;
   update openhouse.families ff set attendance='present',actual_slot=slot,coordinator=coord,checked_at=coalesce(ff.checked_at,now()),method=coalesce(ff.method,case when is_public then 'qr' else 'staff' end),updated_at=now() where ff.id=fid;
   insert into openhouse.outbox(family_id,status,last_error) values(fid,case when f.dnd or f.ghl_contact_id is null then 'blocked' else 'pending' end,case when f.dnd then 'DND' when f.ghl_contact_id is null then 'Sin contacto GHL' end) on conflict(family_id) do update set status=case when openhouse.outbox.status='cancelled' then excluded.status else openhouse.outbox.status end;
 else
   update openhouse.families set attendance=st,actual_slot=null,coordinator=null,checked_at=null,method=null,updated_at=now() where id=fid;
   update openhouse.outbox set status='cancelled' where family_id=fid and status in ('pending','failed');
 end if;
 if not is_public and (p_payload ? 'actual_adults' or p_payload ? 'actual_children') then
   update openhouse.families ff set actual_adults=case when p_payload ? 'actual_adults' then (p_payload->>'actual_adults')::int else ff.actual_adults end,actual_children=case when p_payload ? 'actual_children' then (p_payload->>'actual_children')::int else ff.actual_children end where ff.id=fid;
 end if;
 select * into f from openhouse.families where id=fid;
 insert into openhouse.audit(family_id,actor,action,before_value,after_value) values(fid,case when is_public then 'qr' else p_actor end,p_action,oldf,to_jsonb(f));
 return case when is_public then jsonb_build_object('ok',true) else jsonb_build_object('ok',true,'family_id',fid) end;
 end $$;

revoke all on function public.milhano_oh_v1(text,jsonb,text) from public,anon,authenticated;
grant execute on function public.milhano_oh_v1(text,jsonb,text) to service_role;
commit;
