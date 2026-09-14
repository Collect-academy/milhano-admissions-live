-- MILHANO AS26 V20
-- One $50 pass = one workshop for one participant.
-- Maximum registrations per workshop = 20.
-- Safe to run after the V19 migration.

create extension if not exists pgcrypto;

-- 1) Canonical workshop catalog used by the current landing.
alter table public.as26_workshops
  add column if not exists capacity smallint not null default 20 check (capacity between 1 and 60);

update public.as26_workshops set active=false where code='RUNNING' or name='Running Club';
update public.as26_workshops set name='Artes', code='ARTES', sort_order=10, active=true, capacity=20
  where code='ARTE' or name='Arte';
update public.as26_workshops set name='English Club', code='ENGLISH', sort_order=60, active=true, capacity=20
  where code='INGLES' or name='Club de Inglés';

insert into public.as26_workshops(code,name,active,sort_order,capacity) values
('ARTES','Artes',true,10,20),
('ESPANOL','Club de Español',true,20,20),
('CANTO','Canto y Expresión Vocal',true,30,20),
('DANZA','Danza',true,40,20),
('MATE','Club de Matemáticas',true,50,20),
('ENGLISH','English Club',true,60,20),
('BOX','Box',true,70,20),
('VOLEIBOL','Voleibol',true,80,20)
on conflict(code) do update set
  name=excluded.name,
  active=true,
  sort_order=excluded.sort_order,
  capacity=20;

-- 2) Grade catalog. This is configuration for the form, not an inference from the source docs.
create table if not exists public.as26_grade_catalog (
  id smallserial primary key,
  label text unique not null,
  sort_order smallint not null,
  active boolean not null default true
);

insert into public.as26_grade_catalog(label,sort_order) values
('1° Primaria',10),('2° Primaria',20),('3° Primaria',30),('4° Primaria',40),('5° Primaria',50),('6° Primaria',60),
('1° Secundaria',70),('2° Secundaria',80),('3° Secundaria',90),
('1° Preparatoria',100),('2° Preparatoria',110),('3° Preparatoria',120),
('Otro / equivalente',130)
on conflict(label) do update set sort_order=excluded.sort_order, active=true;

-- 3) Participant now has exactly one selected workshop for this $50 pass.
alter table public.as26_participants
  add column if not exists selected_workshop_id uuid references public.as26_workshops(id);

create index if not exists idx_as26_part_selected_workshop
  on public.as26_participants(selected_workshop_id);

-- Normalize legacy labels in the compatibility array.
update public.as26_participants
set requested_workshops = array(
  select case x
    when 'Arte' then 'Artes'
    when 'Club de Inglés' then 'English Club'
    else x end
  from unnest(requested_workshops) x
)
where requested_workshops is not null;

-- Backfill selected workshop for test/legacy participants that already had exactly one known workshop.
update public.as26_participants p
set selected_workshop_id=w.id
from public.as26_workshops w
where p.selected_workshop_id is null
  and cardinality(p.requested_workshops)=1
  and w.name=p.requested_workshops[1];

-- 4) Public availability. Full workshops disappear from the form, but the server still re-checks capacity.
create or replace view public.as26_workshop_availability as
select
  w.id,
  w.code,
  w.name,
  w.sort_order,
  w.capacity,
  count(p.id) filter (
    where r.payment_status not in ('failed','refunded')
  )::int as registered,
  greatest(
    w.capacity - count(p.id) filter (where r.payment_status not in ('failed','refunded')),
    0
  )::int as remaining,
  (
    count(p.id) filter (where r.payment_status not in ('failed','refunded')) >= w.capacity
  ) as is_full
from public.as26_workshops w
left join public.as26_participants p on p.selected_workshop_id=w.id
left join public.as26_registrations r on r.id=p.registration_id
where w.active=true
group by w.id;

create or replace function public.as26_public_form_options()
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
select jsonb_build_object(
  'price_per_student_mxn',50,
  'max_students',4,
  'grades',coalesce((
    select jsonb_agg(jsonb_build_object('label',g.label,'sort_order',g.sort_order) order by g.sort_order)
    from public.as26_grade_catalog g where g.active=true
  ),'[]'::jsonb),
  'workshops',coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',a.id,
      'name',a.name,
      'capacity',a.capacity,
      'registered',a.registered,
      'remaining',a.remaining
    ) order by a.sort_order)
    from public.as26_workshop_availability a
    where a.is_full=false
  ),'[]'::jsonb)
);
$$;

-- 5) Replace V19 family registration with atomic workshop-capacity validation.
create or replace function public.as26_register_family(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_registration_id uuid := gen_random_uuid();
  v_students jsonb := coalesce(p_payload->'students','[]'::jsonb);
  v_student_count int := jsonb_array_length(v_students);
  v_price numeric := 50;
  v_total numeric;
  s jsonb;
  i int := 0;
  v_workshop_id uuid;
  v_workshop_name text;
  v_capacity int;
  v_existing int;
  v_requested int;
  rec record;
begin
  if v_student_count < 1 or v_student_count > 4 then
    raise exception 'STUDENT_COUNT_INVALID';
  end if;

  if nullif(trim(p_payload#>>'{tutor,name}'),'') is null
    or nullif(trim(p_payload#>>'{tutor,email}'),'') is null
    or nullif(trim(p_payload#>>'{tutor,phone}'),'') is null then
    raise exception 'TUTOR_INCOMPLETE';
  end if;

  -- Validate every student before reserving anything.
  for s in select * from jsonb_array_elements(v_students)
  loop
    i := i + 1;
    if nullif(trim(s->>'name'),'') is null
      or nullif(trim(s->>'grade_raw'),'') is null
      or nullif(trim(s->>'school'),'') is null
      or nullif(trim(s->>'workshop_id'),'') is null then
      raise exception 'STUDENT_%_INCOMPLETE', i;
    end if;

    if (s->>'age')::int < 6 or (s->>'age')::int > 16 then
      raise exception 'STUDENT_%_AGE_INVALID', i;
    end if;

    if not exists (
      select 1 from public.as26_grade_catalog g
      where g.active=true and g.label=trim(s->>'grade_raw')
    ) then
      raise exception 'STUDENT_%_GRADE_INVALID', i;
    end if;

    begin
      v_workshop_id := (s->>'workshop_id')::uuid;
    exception when others then
      raise exception 'STUDENT_%_WORKSHOP_INVALID', i;
    end;

    if not exists (
      select 1 from public.as26_workshops w
      where w.id=v_workshop_id and w.active=true
    ) then
      raise exception 'STUDENT_%_WORKSHOP_UNAVAILABLE', i;
    end if;
  end loop;

  -- Lock each requested workshop in a deterministic order and verify the whole family fits.
  for rec in
    select (x->>'workshop_id')::uuid as workshop_id, count(*)::int as qty
    from jsonb_array_elements(v_students) x
    group by (x->>'workshop_id')::uuid
    order by (x->>'workshop_id')::uuid
  loop
    perform pg_advisory_xact_lock(hashtext(rec.workshop_id::text));

    select capacity into v_capacity
    from public.as26_workshops
    where id=rec.workshop_id and active=true
    for update;

    select count(*)::int into v_existing
    from public.as26_participants p
    join public.as26_registrations r on r.id=p.registration_id
    where p.selected_workshop_id=rec.workshop_id
      and r.payment_status not in ('failed','refunded');

    v_requested := rec.qty;
    if v_existing + v_requested > v_capacity then
      raise exception 'WORKSHOP_FULL:%', rec.workshop_id;
    end if;
  end loop;

  v_total := v_student_count * v_price;

  insert into public.as26_registrations(
    id,tutor_name,tutor_phone,tutor_email,student_count,
    price_per_student_mxn,expected_total_mxn,payment_status,
    utm_source,utm_medium,utm_campaign,utm_content,utm_term,fbclid,consent
  ) values (
    v_registration_id,
    trim(p_payload#>>'{tutor,name}'),
    trim(p_payload#>>'{tutor,phone}'),
    lower(trim(p_payload#>>'{tutor,email}')),
    v_student_count,v_price,v_total,'stripe_pending_config',
    nullif(p_payload#>>'{attribution,utm_source}',''),
    nullif(p_payload#>>'{attribution,utm_medium}',''),
    nullif(p_payload#>>'{attribution,utm_campaign}',''),
    nullif(p_payload#>>'{attribution,utm_content}',''),
    nullif(p_payload#>>'{attribution,utm_term}',''),
    nullif(p_payload#>>'{attribution,fbclid}',''),
    coalesce((p_payload->>'consent')::boolean,false)
  );

  i := 0;
  for s in select * from jsonb_array_elements(v_students)
  loop
    i := i + 1;
    v_workshop_id := (s->>'workshop_id')::uuid;
    select name into v_workshop_name from public.as26_workshops where id=v_workshop_id;

    insert into public.as26_participants(
      registration_id,student_index,full_name,age,grade_raw,current_school,
      requested_workshops,all_compatible,selected_workshop_id
    ) values (
      v_registration_id,i,trim(s->>'name'),(s->>'age')::int,
      trim(s->>'grade_raw'),trim(s->>'school'),
      array[v_workshop_name],false,v_workshop_id
    );
  end loop;

  return jsonb_build_object(
    'ok',true,
    'registration_id',v_registration_id,
    'student_count',v_student_count,
    'expected_total_mxn',v_total,
    'payment_status','stripe_pending_config',
    'next_url','/after-school/gracias?status=pending&registration_id='||v_registration_id::text
  );
end $$;

alter table public.as26_grade_catalog enable row level security;
