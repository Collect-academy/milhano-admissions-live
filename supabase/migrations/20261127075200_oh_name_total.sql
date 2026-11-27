begin;
alter table openhouse.families add column if not exists actual_total integer check(actual_total between 1 and 100);
CREATE OR REPLACE FUNCTION public.milhano_oh_v1(p_action text, p_payload jsonb DEFAULT '{}'::jsonb, p_actor text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
   if localnow::date<>ev-1 and (localnow::date<>ev or localnow::time<time '07:00' or localnow::time>time '15:30') then return jsonb_build_object('error','El registro estará disponible el viernes 27 de noviembre, de 07:00 a 15:30.','code','closed'); end if;
   if coalesce(p_payload->>'bucket','') !~ '^[a-f0-9]{64}$' then return jsonb_build_object('error','Solicitud inválida.'); end if;
   delete from openhouse.rate_limits where window_start<now()-interval '1 day';
   foreach k in array array['global','ip:'||(p_payload->>'bucket')] loop
     insert into openhouse.rate_limits(bucket,window_start) values(k,date_bin(interval '5 minutes',now(),timestamptz '2026-01-01'))
     on conflict(bucket,window_start) do update set hits=openhouse.rate_limits.hits+1 returning hits into n;
     if n>(case when k='global' then 500 else 100 end) then return jsonb_build_object('error','Demasiadas solicitudes. Acércate al equipo.','code','rate'); end if;
   end loop;
   if phone='' and length(openhouse.norm(nm))<3 then return jsonb_build_object('matches','[]'::jsonb); end if;
   if p_action='lookup' then
     return jsonb_build_object('matches',coalesce((select jsonb_agg(v) from (select jsonb_build_object('id',ff.id,'label',ff.name,'email_label',case when ff.email<>'' then left(ff.email,1)||'•••@•••' else '' end,'slots',ff.reservation_slots,'present',ff.attendance='present') v from openhouse.families ff where ff.event_key=ev and ((phone<>'' and openhouse.phone10(ff.phone)=phone) or (phone='' and length(openhouse.norm(nm))>=3 and openhouse.norm(ff.name)=openhouse.norm(nm))) order by ff.name limit 5) q),'[]'::jsonb));
   end if;
 else
   if not exists(select 1 from public.milhano_app_users u where u.id::text=p_actor and u.is_active and (u.role='admin' or exists(select 1 from openhouse.staff s where s.app_user_id=u.id::text))) then return jsonb_build_object('error','Acceso no autorizado.','code','forbidden'); end if;
   if p_action='list' then
     return jsonb_build_object('families',coalesce((select jsonb_agg(to_jsonb(ff)||jsonb_build_object('notification_status',ob.status) order by ff.name) from openhouse.families ff left join openhouse.outbox ob on ob.family_id=ff.id where ff.event_key=ev),'[]'::jsonb));
   end if;
 end if;
 if not is_public and p_payload ? 'coordinator' and (p_payload->>'coordinator' is null or not((p_payload->>'coordinator')=any(coords))) then return jsonb_build_object('error','Coordinación inválida.'); end if;
 if not is_public and p_payload ? 'slot' and (p_payload->>'slot' is null or not((p_payload->>'slot')=any(slots))) then return jsonb_build_object('error','Horario inválido.'); end if;
 if p_payload ? 'actual_total' and p_payload->>'actual_total' is not null then
   if (p_payload->>'actual_total') !~ '^[0-9]{1,3}$' then return jsonb_build_object('error','Indica un número entero de asistentes.');end if;
   if (p_payload->>'actual_total')::int not between 1 and 100 then return jsonb_build_object('error','Indica entre 1 y 100 asistentes.');end if;
 end if;
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
     if not ((phone<>'' and openhouse.phone10(f.phone)=phone) or (phone='' and length(openhouse.norm(nm))>=3 and openhouse.norm(f.name)=openhouse.norm(nm))) then return jsonb_build_object('error','Selecciona un registro que coincida con tu WhatsApp o nombre completo.'); end if;
     if localnow::date=ev-1 then return jsonb_build_object('error','Prueba exitosa: tus datos coinciden. La asistencia real se habilita mañana a las 07:00. No se guardó ninguna asistencia ni se envió WhatsApp.','code','preview_verified'); end if;
     if f.attendance='present' then
       if f.actual_total is null and p_payload->>'actual_total' is not null then
         update openhouse.families set actual_total=(p_payload->>'actual_total')::int,updated_at=now() where id=fid;
         select * into f from openhouse.families where id=fid;
         insert into openhouse.audit(family_id,actor,action,before_value,after_value) values(fid,'qr','confirm',oldf,to_jsonb(f));
       end if;
       return jsonb_build_object('ok',true,'already',true);
     end if;
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
 if p_payload ? 'actual_total' then
   update openhouse.families set actual_total=(p_payload->>'actual_total')::int where id=fid;
 end if;
 select * into f from openhouse.families where id=fid;
 insert into openhouse.audit(family_id,actor,action,before_value,after_value) values(fid,case when is_public then 'qr' else p_actor end,p_action,oldf,to_jsonb(f));
 return case when is_public then jsonb_build_object('ok',true) else jsonb_build_object('ok',true,'family_id',fid) end;
 end $function$;
revoke all on function public.milhano_oh_v1(text,jsonb,text) from public,anon,authenticated;
grant execute on function public.milhano_oh_v1(text,jsonb,text) to service_role;
commit;
