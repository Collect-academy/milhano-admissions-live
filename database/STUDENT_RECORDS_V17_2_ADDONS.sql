-- Reference schema for V17.2 student photo upload + cycle notes.
-- Already applied to production Supabase on 2026-08-26.
-- Keep this file for repository traceability; do not re-run manually unless restoring another environment.

alter table public.milhano_students add column if not exists photo_path text;

create table if not exists public.milhano_student_notes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.milhano_students(id) on delete cascade,
  occurred_on date not null default current_date,
  category text not null check (category in ('convivencia','clase','personal','academico','otro')),
  title text,
  note text not null,
  author_label text not null,
  created_by uuid references public.milhano_app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (length(btrim(note)) > 0)
);

create index if not exists idx_milhano_student_notes_student_date
  on public.milhano_student_notes(student_id, occurred_on desc, created_at desc);
create index if not exists idx_milhano_student_notes_created_by
  on public.milhano_student_notes(created_by) where created_by is not null;

-- Storage bucket in production: student-photos (private), 512 KiB, image/webp only.
-- RLS policies are applied to storage.objects for authenticated module users.
