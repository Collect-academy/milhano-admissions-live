-- ============================================================
-- MILHANO | V11.1 | MONA USERNAME LOGIN
-- ============================================================
-- Purpose:
-- - Add a dashboard username without changing Supabase Auth's
--   internal email/password mechanism.
-- - Mona logs in visibly as MonaCashflow.
-- - Internally, Supabase Auth continues using mona@coldem.edu.mx.
-- - Mona is promoted to admin so she can use Reconciliation
--   adjustments introduced in V11.
--
-- IMPORTANT:
-- This SQL does NOT set the Supabase Auth password.
-- Create/confirm the Auth user in Supabase Authentication > Users
-- with:
--   internal email: mona@coldem.edu.mx
--   password: Collect123$
--   email confirmed: yes
-- ============================================================

begin;

alter table public.milhano_app_users
  add column if not exists username text;

create unique index if not exists
  uq_milhano_app_users_username
on public.milhano_app_users (username)
where username is not null;

-- Ensure Mona's app-user row exists.
insert into public.milhano_app_users (
  id,
  display_name,
  email,
  username,
  role,
  is_active
)
select
  gen_random_uuid(),
  'Mona Al Idrissi',
  'mona@coldem.edu.mx',
  'MonaCashflow',
  'admin',
  true
where not exists (
  select 1
  from public.milhano_app_users
  where lower(email) = 'mona@coldem.edu.mx'
);

-- Configure the existing Mona row.
update public.milhano_app_users
set
  display_name = 'Mona Al Idrissi',
  email = 'mona@coldem.edu.mx',
  username = 'MonaCashflow',
  role = 'admin',
  is_active = true,
  updated_at = now()
where lower(email) = 'mona@coldem.edu.mx';

-- Link automatically if the Auth user already exists.
update public.milhano_app_users app
set
  auth_user_id = auth_user.id,
  updated_at = now()
from auth.users auth_user
where lower(auth_user.email) = lower(app.email)
  and lower(app.email) = 'mona@coldem.edu.mx'
  and app.auth_user_id is distinct from auth_user.id;

commit;

select
  display_name,
  username,
  email as internal_auth_email,
  role,
  auth_user_id,
  is_active
from public.milhano_app_users
where lower(email) = 'mona@coldem.edu.mx';
