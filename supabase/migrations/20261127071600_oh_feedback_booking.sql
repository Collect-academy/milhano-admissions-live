begin;
create table if not exists openhouse.feedback_bookings (id uuid primary key default gen_random_uuid(),grade_code text not null references openhouse.trial_grades(code),visit_date date not null,child_name text not null,child_key text not null,guardian_name text not null,phone text not null,email text not null default '',family_id uuid references openhouse.families(id),trial_booking_id uuid references openhouse.trial_bookings(id),prior_declared boolean not null default false,request_id uuid not null unique,status text not null default 'booked' check(status in ('booked','cancelled')),created_at timestamptz not null default now(),cancelled_at timestamptz,cancelled_by text);
create unique index if not exists oh_feedback_one_active on openhouse.feedback_bookings(phone,child_key,grade_code) where status='booked';
create index if not exists oh_feedback_by_date on openhouse.feedback_bookings(visit_date,grade_code) where status='booked';
alter table openhouse.feedback_bookings enable row level security;
revoke all on openhouse.feedback_bookings from public,anon,authenticated;
grant select,insert,update on openhouse.feedback_bookings to service_role;
CREATE OR REPLACE FUNCTION public.milhano_oh_feedback_v1(p_action text, p_payload jsonb DEFAULT '{}'::jsonb, p_actor text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
 g openhouse.trial_grades%rowtype; t openhouse.trial_bookings%rowtype; f openhouse.families%rowtype; b openhouse.feedback_bookings%rowtype;
 localday date:=(now() at time zone 'America/Merida')::date; earliest date; d date;
 ph text:=openhouse.phone10(p_payload->>'phone'); child text:=trim(coalesce(p_payload->>'child','')); ck text:=openhouse.norm(p_payload->>'child');
 guardian text:=trim(coalesce(p_payload->>'guardian','')); em text:=lower(trim(coalesce(p_payload->>'email','')));
 mode text:=p_payload->>'mode'; fid uuid; rid uuid; n int; k text; days jsonb; admin_ok boolean;
begin
 if p_action in ('list','cancel') then
  select exists(select 1 from public.milhano_app_users u where u.id::text=p_actor and u.is_active and u.role='admin') into admin_ok;
  if not admin_ok and not exists(select 1 from public.milhano_app_users u join openhouse.staff s on s.app_user_id=u.id::text where u.id::text=p_actor and u.is_active) then return jsonb_build_object('error','Acceso no autorizado.','code','forbidden');end if;
  if p_action='list' then return jsonb_build_object('bookings',coalesce((select jsonb_agg(to_jsonb(x)||jsonb_build_object('grade_label',gg.label,'trial_date',tt.visit_date) order by x.visit_date,gg.sort_order,x.child_name) from openhouse.feedback_bookings x join openhouse.trial_grades gg on gg.code=x.grade_code left join openhouse.trial_bookings tt on tt.id=x.trial_booking_id),'[]'::jsonb),'admin',admin_ok);end if;
  if not admin_ok then return jsonb_build_object('error','Solo administración puede cancelar.','code','forbidden');end if;
  perform pg_advisory_xact_lock(hashtextextended('milhano-openhouse-trial-2026-2027',0));
  update openhouse.feedback_bookings set status='cancelled',cancelled_at=now(),cancelled_by=p_actor where id=(p_payload->>'id')::uuid and status='booked';
  return jsonb_build_object('ok',found);
 end if;
 if p_action not in ('availability','book') then return jsonb_build_object('error','Operación inválida.');end if;
 if localday>date '2027-01-31' then return jsonb_build_object('error','El periodo de retroalimentación ha finalizado.');end if;
 if coalesce(p_payload->>'bucket','') !~ '^[a-f0-9]{64}$' then return jsonb_build_object('error','Solicitud inválida.');end if;
 foreach k in array array['feedback:global','feedback:'||(p_payload->>'bucket')] loop
  insert into openhouse.rate_limits(bucket,window_start) values(k,date_bin(interval '5 minutes',now(),timestamptz '2026-01-01'))
  on conflict(bucket,window_start) do update set hits=openhouse.rate_limits.hits+1 returning hits into n;
  if n>(case when k='feedback:global' then 500 else 80 end) then return jsonb_build_object('error','Demasiadas consultas. Intenta más tarde.','code','rate');end if;
 end loop;
 select * into g from openhouse.trial_grades where code=p_payload->>'grade';
 if not found or ph='' or length(ck)<3 or length(child)>150 or mode is null or mode not in ('prior','scheduled') then return jsonb_build_object('error','Indica alumno, grado, WhatsApp y situación de pasadía.');end if;
 if p_action='book' then
  perform pg_advisory_xact_lock(hashtextextended('milhano-openhouse-trial-2026-2027',0));
  if coalesce(p_payload->>'request_id','') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' or coalesce(p_payload->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' then return jsonb_build_object('error','Fecha o solicitud inválida.');end if;
  rid:=(p_payload->>'request_id')::uuid; d:=(p_payload->>'date')::date;
  select * into b from openhouse.feedback_bookings where request_id=rid;
  if found then
   if b.status='booked' and b.phone=ph and b.child_key=ck and b.grade_code=g.code and b.visit_date=d then return jsonb_build_object('ok',true,'reference',b.id,'date',b.visit_date,'grade',g.label,'already',true);end if;
   return jsonb_build_object('error','Solicitud ya utilizada.');end if;
 end if;
 select * into t from openhouse.trial_bookings x where x.phone=ph and x.child_key=ck and x.grade_code=g.code and x.status='booked' order by x.visit_date desc limit 1;
 if mode='scheduled' and t.id is null then return jsonb_build_object('error','No encontramos una pasadía activa para ese alumno y grado. Verifica el nombre tal como lo registraste o agenda primero la pasadía.','code','trial_missing');end if;
 earliest:=greatest(localday+1,coalesce(t.visit_date+1,localday+1));
 if p_action='availability' then
  select coalesce(jsonb_agg(jsonb_build_object('date',s.d,'remaining',1) order by s.d),'[]'::jsonb) into days
  from (select date '2026-12-02'+i as d from generate_series(0,60) i) s
  where s.d>=earliest and openhouse.trial_day_allowed(s.d,g.level)
    and not exists(select 1 from openhouse.trial_days_blocked x where x.visit_date=s.d and x.grade_code=g.code);
  return jsonb_build_object('days',days);
 end if;
 if d<earliest or not openhouse.trial_day_allowed(d,g.level) or exists(select 1 from openhouse.trial_days_blocked x where x.visit_date=d and x.grade_code=g.code) then return jsonb_build_object('error','Elige una fecha habilitada posterior a la pasadía.','code','date_unavailable');end if;
 if nullif(p_payload->>'family_id','') is not null then
  if p_payload->>'family_id' !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then return jsonb_build_object('error','Familia inválida.','code','family_changed');end if;
  fid:=(p_payload->>'family_id')::uuid;
  select * into f from openhouse.families ff where ff.id=fid and ff.event_key=date '2026-11-27' and openhouse.phone10(ff.phone)=ph;
  if not found then return jsonb_build_object('error','La familia seleccionada ya no coincide.','code','family_changed');end if;
  guardian:=f.name; em:=coalesce(f.email,'');
 elsif t.id is not null then guardian:=t.guardian_name;em:=t.email;
 end if;
 if length(guardian)<3 or length(guardian)>150 or length(em)>254 or (em<>'' and em !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$') then return jsonb_build_object('error','Completa los datos del tutor.');end if;
 if exists(select 1 from openhouse.feedback_bookings x where x.phone=ph and x.child_key=ck and x.grade_code=g.code and x.status='booked') then return jsonb_build_object('error','Ya existe una retroalimentación para este alumno. Acércate al equipo para cambiarla.');end if;
 insert into openhouse.feedback_bookings(grade_code,visit_date,child_name,child_key,guardian_name,phone,email,family_id,trial_booking_id,prior_declared,request_id)
 values(g.code,d,child,ck,guardian,ph,em,fid,t.id,mode='prior' and (t.id is null or t.visit_date<localday),rid) returning * into b;
 return jsonb_build_object('ok',true,'reference',b.id,'date',d,'grade',g.label);
end $function$;
revoke all on function public.milhano_oh_feedback_v1(text,jsonb,text) from public,anon,authenticated;
grant execute on function public.milhano_oh_feedback_v1(text,jsonb,text) to service_role;
commit;
