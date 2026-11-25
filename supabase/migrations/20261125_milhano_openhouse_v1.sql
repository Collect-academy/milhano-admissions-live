-- Open House 27 Nov 2026. Additive; no CRM, Sofía, n8n or pg_net mutations.
begin;
create schema if not exists openhouse;
revoke all on schema openhouse from public, anon, authenticated;
grant usage on schema openhouse to service_role;
create table if not exists openhouse.families (
 id uuid primary key default gen_random_uuid(), event_key date not null default '2026-11-27',
 ghl_contact_id text, ghl_opportunity_id text, name text not null, phone text not null default '', email text not null default '',
 fields jsonb not null default '{}'::jsonb, reservation_slots text[] not null default '{}', appointment_ids text[] not null default '{}',
 origin text not null default 'ghl' check(origin in ('ghl','walkin')), dnd boolean not null default false,
 attendance text not null default 'pending' check(attendance in ('pending','present','absent')),
 actual_slot text check(actual_slot in ('07:30','09:00','11:00','12:30','14:00')),
 coordinator text check(coordinator in ('José Lugo','Miguel','Aurora')),
 checked_at timestamptz, method text check(method in ('qr','staff')),
 actual_adults int check(actual_adults>=0 and actual_adults<=30), actual_children int check(actual_children>=0 and actual_children<=30),
 corrected boolean not null default false, updated_at timestamptz not null default now(),
 unique(event_key,ghl_contact_id)
);
create table if not exists openhouse.staff (app_user_id text primary key);
create table if not exists openhouse.audit (id bigint generated always as identity primary key, family_id uuid not null references openhouse.families(id), actor text not null, action text not null, before_value jsonb, after_value jsonb, created_at timestamptz not null default now());
create table if not exists openhouse.outbox (family_id uuid primary key references openhouse.families(id), status text not null default 'pending' check(status in ('pending','sent','failed','blocked','cancelled')), created_at timestamptz not null default now(), sent_at timestamptz, last_error text);
create table if not exists openhouse.rate_limits (bucket text not null, window_start timestamptz not null, hits int not null default 1, primary key(bucket,window_start));
do $$ declare t text; begin
 foreach t in array array['families','staff','audit','outbox','rate_limits'] loop
 execute format('alter table openhouse.%I enable row level security',t);
 execute format('revoke all on openhouse.%I from public, anon, authenticated',t);
 execute format('grant select,insert,update,delete on openhouse.%I to service_role',t);
 end loop;
end $$;
grant usage,select on all sequences in schema openhouse to service_role;
create index if not exists oh_families_event_status on openhouse.families(event_key,attendance,actual_slot);
insert into openhouse.staff(app_user_id)
select id::text from public.milhano_app_users where is_active and lower(trim(display_name)) in ('psic. ricardo soxme','ricardo soxme','yasser jair ramirez magos','yasser ramirez','manuel','nayeli')
on conflict do nothing;
create or replace function openhouse.phone10(p text) returns text language sql immutable security invoker set search_path='' as $$ select case when length(regexp_replace(coalesce(p,''),'[^0-9]','','g'))=10 then regexp_replace(p,'[^0-9]','','g') when regexp_replace(coalesce(p,''),'[^0-9]','','g') ~ '^52[0-9]{10}$|^521[0-9]{10}$' then right(regexp_replace(p,'[^0-9]','','g'),10) else '' end $$;
create or replace function openhouse.norm(p text) returns text language sql immutable security invoker set search_path='' as $$ select trim(regexp_replace(translate(lower(coalesce(p,'')),'áéíóúüñ','aeiouun'),'[^a-z0-9]+',' ','g')) $$;
-- Seed from the four private snapshots; never overwrite an attendance or a manual correction.
do $$ begin
 if to_regclass('openhouse_import.source_snapshots') is not null then
 insert into openhouse.families(ghl_contact_id,ghl_opportunity_id,name,phone,email,fields,reservation_slots,appointment_ids,dnd)
 select c->>'id',o.id,coalesce(nullif(c->>'name',''),nullif(concat_ws(' ',c->>'firstName',c->>'lastName'),''),'Sin nombre'),
 coalesce(c->>'phone',''),coalesce(c->>'email',''),
 coalesce((select jsonb_object_agg(case f->>'id' when 'cXp0hmItyV6aSLINivKr' then 'adultos' when 'KuG94CiTwzCpF9ja3i6v' then 'personas' when '7FNdnUHVmQu7wkyWdrgk' then 'nivel' when '35CijgbpUYQ5POh86flP' then 'observaciones' end,f->'value') from jsonb_array_elements(c->'customFields') f where f->>'id' in ('cXp0hmItyV6aSLINivKr','KuG94CiTwzCpF9ja3i6v','7FNdnUHVmQu7wkyWdrgk','35CijgbpUYQ5POh86flP')),'{}'::jsonb),
 coalesce(a.slots,'{}'),coalesce(a.ids,'{}'),coalesce(c->>'dnd','false')='true'
 from openhouse_import.source_snapshots s cross join lateral jsonb_array_elements(s.payload->'contacts') c
 left join lateral (select x->>'id' id from openhouse_import.source_snapshots q cross join lateral jsonb_array_elements(q.payload->'opportunities') x where q.event_key=s.event_key and q.resource='opportunities' and x->>'contactId'=c->>'id' order by x->>'updatedAt' desc limit 1) o on true
 left join lateral (select array_agg(distinct to_char((x->>'startTime')::timestamptz at time zone 'America/Merida','HH24:MI') order by to_char((x->>'startTime')::timestamptz at time zone 'America/Merida','HH24:MI')) slots,array_agg(distinct x->>'id') ids from openhouse_import.source_snapshots q cross join lateral jsonb_array_elements(q.payload->'events') x where q.event_key=s.event_key and q.resource='appointments' and x->>'contactId'=c->>'id' and x->>'appointmentStatus'='confirmed' and coalesce(x->>'deleted','false')<>'true' and x->>'calendarId'='zUokihdMDh6ywYQ8IZ2k' and ((x->>'startTime')::timestamptz at time zone 'America/Merida')::date='2026-11-27') a on true
 where s.event_key='2026-11-27' and s.resource='contacts'
 on conflict(event_key,ghl_contact_id) do nothing;
 end if;
end $$;
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
 return jsonb_build_object('ok',true);
 end $$;
revoke all on function public.milhano_oh_v1(text,jsonb,text) from public,anon,authenticated;
grant execute on function public.milhano_oh_v1(text,jsonb,text) to service_role;
revoke all on function openhouse.phone10(text),openhouse.norm(text) from public,anon,authenticated;
grant execute on function openhouse.phone10(text),openhouse.norm(text) to service_role;
commit;
