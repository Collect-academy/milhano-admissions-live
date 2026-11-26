begin;
create table if not exists openhouse.trial_grades (code text primary key,label text not null,level text not null check(level in ('primary','secondary','high')),capacity int not null check(capacity between 1 and 2),sort_order int not null);
insert into openhouse.trial_grades values ('p1','1° de Primaria','primary',2,1),('p2','2° de Primaria','primary',2,2),('p3','3° de Primaria','primary',2,3),('p4','4° de Primaria','primary',2,4),('p5','5° de Primaria','primary',2,5),('p6','6° de Primaria','primary',2,6),('s1','1° de Secundaria','secondary',2,7),('s2','2° de Secundaria','secondary',1,8),('s3','3° de Secundaria','secondary',2,9),('h1','1er semestre de Preparatoria','high',2,10),('h2','2° semestre de Preparatoria','high',2,11) on conflict(code) do nothing;
create table if not exists openhouse.trial_days_blocked (visit_date date not null,grade_code text not null references openhouse.trial_grades(code),reason text not null,primary key(visit_date,grade_code));
create table if not exists openhouse.trial_bookings (id uuid primary key default gen_random_uuid(),grade_code text not null references openhouse.trial_grades(code),visit_date date not null,child_name text not null,child_key text not null,guardian_name text not null,phone text not null,email text not null default '',status text not null default 'booked' check(status in ('booked','cancelled')),request_id uuid not null unique,created_at timestamptz not null default now(),cancelled_at timestamptz,cancelled_by text,source text not null default 'openhouse');
create unique index if not exists oh_trial_active_child on openhouse.trial_bookings(phone,child_key,grade_code) where status='booked';
create index if not exists oh_trial_slot on openhouse.trial_bookings(visit_date,grade_code) where status='booked';
alter table openhouse.trial_grades enable row level security;
alter table openhouse.trial_days_blocked enable row level security;
alter table openhouse.trial_bookings enable row level security;
revoke all on openhouse.trial_grades,openhouse.trial_days_blocked,openhouse.trial_bookings from public,anon,authenticated;
grant select on openhouse.trial_grades to service_role;
grant select,insert,update,delete on openhouse.trial_days_blocked to service_role;
grant select,insert,update on openhouse.trial_bookings to service_role;
CREATE OR REPLACE FUNCTION openhouse.trial_day_allowed(d date, lev text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
 select (d between date '2026-12-02' and date '2026-12-17' or d between date '2027-01-07' and date '2027-01-31')
 and extract(isodow from d) between 1 and 5
 and d not in (date '2026-12-07',date '2026-12-11')
 and not (lev='secondary' and d=date '2026-12-09')
 and not (lev='primary' and d=date '2026-12-10')
$function$;
CREATE OR REPLACE FUNCTION public.milhano_oh_trial_v1(p_action text, p_payload jsonb DEFAULT '{}'::jsonb, p_actor text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
 g openhouse.trial_grades%rowtype; b openhouse.trial_bookings%rowtype; d date; localnow timestamp:=now() at time zone 'America/Merida'; n int; k text; phone10 text:=openhouse.phone10(p_payload->>'phone'); child text:=trim(coalesce(p_payload->>'child','')); guardian text:=trim(coalesce(p_payload->>'guardian','')); em text:=lower(trim(coalesce(p_payload->>'email',''))); rid uuid; is_admin boolean:=false; days jsonb;
begin
 if p_action in ('availability','book') then
   if localnow::date>date '2027-01-31' then return jsonb_build_object('error','El periodo de pasadías ha finalizado.');end if;
   if coalesce(p_payload->>'bucket','') !~ '^[a-f0-9]{64}$' then return jsonb_build_object('error','Solicitud inválida.');end if;
   foreach k in array array['trial:global','trial:'||(p_payload->>'bucket')] loop
     insert into openhouse.rate_limits(bucket,window_start) values(k,date_bin(interval '5 minutes',now(),timestamptz '2026-01-01'))
     on conflict(bucket,window_start) do update set hits=openhouse.rate_limits.hits+1 returning hits into n;
     if n>(case when k='trial:global' then 500 else 80 end) then return jsonb_build_object('error','Demasiadas solicitudes. Intenta más tarde.','code','rate');end if;
   end loop;
   select * into g from openhouse.trial_grades where code=p_payload->>'grade';
   if not found then return jsonb_build_object('error','Selecciona un grado válido.');end if;
   if p_action='availability' then
     select coalesce(jsonb_agg(jsonb_build_object('date',s.d,'remaining',greatest(0,g.capacity-coalesce(q.used,0))) order by s.d),'[]'::jsonb) into days
     from (select (date '2026-12-02'+i)::date d from generate_series(0,60) i) s
     left join lateral(select count(*)::int used from openhouse.trial_bookings t where t.grade_code=g.code and t.visit_date=s.d and t.status='booked') q on true
     where openhouse.trial_day_allowed(s.d,g.level) and s.d>localnow::date
       and not exists(select 1 from openhouse.trial_days_blocked x where x.visit_date=s.d and x.grade_code=g.code)
       and not exists(select 1 from public.milhano_ghl_appointments a where a.calendar_id='a0bvCaXgCdVwSrgPELza' and a.start_time>=s.d::timestamp at time zone 'America/Merida' and a.start_time<(s.d+1)::timestamp at time zone 'America/Merida' and lower(coalesce(a.appointment_status,'')) not in ('cancelled','canceled','noshow','no_show','no show'));
     return jsonb_build_object('days',days,'capacity',g.capacity);
   end if;
 else
   select exists(select 1 from public.milhano_app_users u where u.id::text=p_actor and u.is_active and u.role='admin') into is_admin;
   if not is_admin and not exists(select 1 from public.milhano_app_users u join openhouse.staff s on s.app_user_id=u.id::text where u.id::text=p_actor and u.is_active) then return jsonb_build_object('error','Acceso no autorizado.','code','forbidden');end if;
   if p_action='list' then
     return jsonb_build_object('bookings',coalesce((select jsonb_agg(to_jsonb(t)||jsonb_build_object('grade_label',gg.label) order by t.visit_date,gg.sort_order,t.child_name) from openhouse.trial_bookings t join openhouse.trial_grades gg on gg.code=t.grade_code),'[]'::jsonb),'blocks',coalesce((select jsonb_agg(to_jsonb(t) order by visit_date,grade_code) from openhouse.trial_days_blocked t),'[]'::jsonb),'admin',is_admin);
   end if;
   if not is_admin then return jsonb_build_object('error','Solo administración puede cancelar o bloquear.','code','forbidden');end if;
 end if;
 -- All capacity-changing actions serialized; no stale availability can overbook.
 perform pg_advisory_xact_lock(hashtextextended('milhano-openhouse-trial-2026-2027',0));
 if p_action='book' then
   if coalesce(p_payload->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' or coalesce(p_payload->>'request_id','') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' or length(child)<3 or length(child)>150 or length(guardian)<3 or length(guardian)>150 or phone10='' or length(em)>254 or (em<>'' and em !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$') then return jsonb_build_object('error','Completa los datos requeridos correctamente.');end if;
   d:=(p_payload->>'date')::date; rid:=(p_payload->>'request_id')::uuid;
   select * into b from openhouse.trial_bookings where request_id=rid;
   if found then
     if b.status='booked' and b.phone=phone10 and b.child_key=openhouse.norm(child) and b.grade_code=g.code and b.visit_date=d then return jsonb_build_object('ok',true,'reference',b.id,'date',d,'grade',g.label,'already',true);end if;
     return jsonb_build_object('error','Solicitud ya utilizada. Actualiza el formulario.');
   end if;
   if d<=localnow::date or not openhouse.trial_day_allowed(d,g.level) or exists(select 1 from openhouse.trial_days_blocked x where x.visit_date=d and x.grade_code=g.code) or exists(select 1 from public.milhano_ghl_appointments a where a.calendar_id='a0bvCaXgCdVwSrgPELza' and a.start_time>=d::timestamp at time zone 'America/Merida' and a.start_time<(d+1)::timestamp at time zone 'America/Merida' and lower(coalesce(a.appointment_status,'')) not in ('cancelled','canceled','noshow','no_show','no show')) then return jsonb_build_object('error','La fecha no está disponible. Elige otra.');end if;
   if exists(select 1 from openhouse.trial_bookings where phone=phone10 and child_key=openhouse.norm(child) and grade_code=g.code and status='booked') then return jsonb_build_object('error','Ya existe una pasadía activa para este alumno. Acércate al equipo si necesitas cambiarla.');end if;
   select count(*) into n from openhouse.trial_bookings where grade_code=g.code and visit_date=d and status='booked';
   if n>=g.capacity then return jsonb_build_object('error','El último lugar ya fue reservado. Elige otra fecha.','code','full');end if;
   insert into openhouse.trial_bookings(grade_code,visit_date,child_name,child_key,guardian_name,phone,email,request_id) values(g.code,d,child,openhouse.norm(child),guardian,phone10,em,rid) returning * into b;
   return jsonb_build_object('ok',true,'reference',b.id,'date',d,'grade',g.label);
 elsif p_action='cancel' then
   update openhouse.trial_bookings set status='cancelled',cancelled_at=now(),cancelled_by=p_actor where id=(p_payload->>'id')::uuid and status='booked';
   return jsonb_build_object('ok',found);
 elsif p_action in ('block','unblock') then
   d:=(p_payload->>'date')::date;
   select * into g from openhouse.trial_grades where code=p_payload->>'grade';
   if not found or not openhouse.trial_day_allowed(d,g.level) then return jsonb_build_object('error','Fecha o grado inválido.');end if;
   if p_action='block' then
     if exists(select 1 from openhouse.trial_bookings where visit_date=d and grade_code=g.code and status='booked') then return jsonb_build_object('error','Hay reservas activas. Revisa esas familias primero.');end if;
     insert into openhouse.trial_days_blocked values(d,g.code,left(coalesce(nullif(p_payload->>'reason',''),'Bloqueo administrativo'),200)) on conflict do nothing;
   else delete from openhouse.trial_days_blocked where visit_date=d and grade_code=g.code;
   end if;
   return jsonb_build_object('ok',true);
 end if;
 return jsonb_build_object('error','Operación inválida.');
end $function$;
revoke all on function openhouse.trial_day_allowed(date,text),public.milhano_oh_trial_v1(text,jsonb,text) from public,anon,authenticated;
grant execute on function openhouse.trial_day_allowed(date,text),public.milhano_oh_trial_v1(text,jsonb,text) to service_role;
commit;
