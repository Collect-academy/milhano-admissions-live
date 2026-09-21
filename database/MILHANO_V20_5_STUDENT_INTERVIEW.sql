-- MILHANO V20.5 · Formato 5: Entrevista del Alumno
-- Open form for every active user who already has Students-module access.
-- Forms 2 and 3 remain confidential and their permissions are not changed.

alter table public.milhano_student_form_definitions
  drop constraint if exists milhano_student_form_definitions_form_code_check;
alter table public.milhano_student_form_definitions
  add constraint milhano_student_form_definitions_form_code_check
  check (form_code = any (array['form_1','form_2','form_3','form_4','form_5']::text[]));

alter table public.milhano_student_form_permissions
  drop constraint if exists milhano_student_form_permissions_form_code_check;
alter table public.milhano_student_form_permissions
  add constraint milhano_student_form_permissions_form_code_check
  check (form_code = any (array['form_1','form_2','form_3','form_4','form_5']::text[]));

alter table public.milhano_student_form_status
  drop constraint if exists milhano_student_form_status_form_code_check;
alter table public.milhano_student_form_status
  add constraint milhano_student_form_status_form_code_check
  check (form_code = any (array['form_1','form_2','form_3','form_4','form_5']::text[]));

insert into public.milhano_student_form_definitions (
  definition_code, form_code, display_name, record_kind,
  is_confidential, allows_multiple, required_fields,
  display_order, is_active, updated_at
)
values (
  'form_5_interview', 'form_5', 'Entrevista del Alumno', 'student_interview',
  false, true,
  '[
    "learning_understanding","class_pace","work_preference","attention_distractors",
    "teacher_supports","academic_feelings","school_motivators","mistake_reaction",
    "school_stressors","self_regulation","peer_integration","conflict_resolution",
    "teacher_trust","home_support","health_safety","external_professional_support"
  ]'::jsonb,
  6, true, now()
)
on conflict (definition_code) do update
set form_code=excluded.form_code,
    display_name=excluded.display_name,
    record_kind=excluded.record_kind,
    is_confidential=false,
    allows_multiple=true,
    required_fields=excluded.required_fields,
    display_order=excluded.display_order,
    is_active=true,
    updated_at=now();

-- Grant Form 5 to every existing user with Students-module access.
insert into public.milhano_student_form_permissions (
  app_user_id, form_code, can_view_content, can_edit, updated_at
)
select a.app_user_id, 'form_5', true, true, now()
from public.milhano_student_module_access a
join public.milhano_app_users u on u.id=a.app_user_id
where a.can_access=true and u.is_active=true
on conflict (app_user_id, form_code) do update
set can_view_content=true, can_edit=true, updated_at=now();

-- Keep Form 5 open automatically for future Students-module users.
create or replace function public.milhano_sync_open_form5_permission()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.milhano_student_form_permissions(
    app_user_id, form_code, can_view_content, can_edit, updated_at
  ) values (
    new.app_user_id, 'form_5', coalesce(new.can_access,false), coalesce(new.can_access,false), now()
  )
  on conflict (app_user_id,form_code) do update
  set can_view_content=excluded.can_view_content,
      can_edit=excluded.can_edit,
      updated_at=now();
  return new;
end;
$function$;

drop trigger if exists trg_milhano_sync_open_form5_permission
  on public.milhano_student_module_access;
create trigger trg_milhano_sync_open_form5_permission
after insert or update of can_access
on public.milhano_student_module_access
for each row execute function public.milhano_sync_open_form5_permission();

-- Seed status for current students.
insert into public.milhano_student_form_status(student_id,form_code,status)
select id,'form_5','none' from public.milhano_students
on conflict (student_id,form_code) do nothing;

-- Seed Form 5 status for new students too.
create or replace function public.milhano_seed_student_form_status()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.milhano_student_form_status(student_id, form_code, status)
  values
    (new.id,'form_1','none'),
    (new.id,'form_2','none'),
    (new.id,'form_3','none'),
    (new.id,'form_4','none'),
    (new.id,'form_5','none')
  on conflict do nothing;
  return new;
end;
$function$;

-- Preserve existing completion logic and add an interview title.
create or replace function public.milhano_prepare_student_form_record()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_required jsonb;
  v_key text;
  v_missing boolean := false;
  v_app_user_id uuid;
  v_kind text;
  v_subject text;
begin
  select required_fields, record_kind into v_required,v_kind
  from public.milhano_student_form_definitions
  where definition_code=new.definition_code and is_active=true;

  if v_required is null then
    raise exception 'Unknown or inactive form definition: %', new.definition_code;
  end if;

  if new.payload='{}'::jsonb then
    new.completion_status := 'empty';
  else
    for v_key in select jsonb_array_elements_text(v_required) loop
      if not public.milhano_student_value_is_filled(new.payload,v_key) then
        v_missing := true;
        exit;
      end if;
    end loop;
    new.completion_status := case when v_missing then 'incomplete' else 'complete' end;
  end if;

  select id into v_app_user_id
  from public.milhano_app_users
  where auth_user_id=auth.uid() and is_active=true limit 1;

  if tg_op='INSERT' and new.created_by is null then new.created_by := v_app_user_id; end if;
  if v_app_user_id is not null then new.updated_by := v_app_user_id; end if;
  new.updated_at := now();

  if btrim(coalesce(new.title,''))='' then
    v_subject := nullif(btrim(coalesce(new.payload->>'subject_activity','')), '');
    new.title := case
      when new.definition_code='form_1_profile' then 'Perfil del alumno'
      when new.definition_code='form_2_observation' then coalesce(v_subject,'Observación') || coalesce(' · '||new.occurred_on::text,'')
      when new.definition_code='form_3_evaluation' then
        (case when coalesce(new.payload->>'evaluation_type','') ilike '%reeval%' then 'Reevaluación' else 'Evaluación inicial' end)
        || coalesce(' · '||new.occurred_on::text,'')
      when new.definition_code='form_4_piap' then 'PIAP' || coalesce(' · '||new.occurred_on::text,'')
      when new.definition_code='form_4_review' then coalesce(new.sequence_no::text||'ª revisión','Revisión') || coalesce(' · '||new.occurred_on::text,'')
      when new.definition_code='form_5_interview' then 'Entrevista del alumno' || coalesce(' · '||new.occurred_on::text,'')
      else 'Registro'
    end;
  end if;
  return new;
end;
$function$;

create or replace view public.vw_milhano_student_directory as
select
  s.id as student_id,
  s.student_code,
  s.first_name,
  s.last_name,
  s.full_name,
  s.level,
  s.grade,
  s.group_name,
  s.tutor_name,
  s.tutor_2_name,
  s.tutor_3_name,
  concat_ws(' ',s.tutor_name,s.tutor_2_name,s.tutor_3_name) as tutor_search,
  s.photo_url,
  s.sex,
  s.curp,
  s.enrollment_status,
  s.birth_date,
  s.is_active,
  s.is_demo,
  coalesce(max(fs.status) filter(where fs.form_code='form_1'),'none') as form_1_status,
  coalesce(max(fs.status) filter(where fs.form_code='form_2'),'none') as form_2_status,
  coalesce(max(fs.status) filter(where fs.form_code='form_3'),'none') as form_3_status,
  coalesce(max(fs.status) filter(where fs.form_code='form_4'),'none') as form_4_status,
  coalesce(max(fs.status) filter(where fs.form_code='form_5'),'none') as form_5_status
from public.milhano_students s
left join public.milhano_student_form_status fs on fs.student_id=s.id
group by s.id;
