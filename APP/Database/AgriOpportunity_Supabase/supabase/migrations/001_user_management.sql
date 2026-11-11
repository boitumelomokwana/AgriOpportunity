-- =====================================================================
-- 001_user_management.sql
-- Group A: User management
--   * profiles        (improved - existing table is preserved)
--   * user_interests  (new)
-- Non-destructive: uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS only.
-- Triggers, RLS policies and functions live in 008 / 009 / 010.
-- =====================================================================

-- pgcrypto is used for API-key hashing (see 006 / 009).
-- On Supabase the "extensions" schema already exists.
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- profiles: one row per Supabase Auth user
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  full_name      text,
  email          text,
  province       text,
  qualification  text,
  field_of_study text,
  interests      text[] not null default '{}',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Columns that may be missing on an older version of the table
alter table public.profiles add column if not exists full_name      text;
alter table public.profiles add column if not exists email          text;
alter table public.profiles add column if not exists province       text;
alter table public.profiles add column if not exists qualification  text;
alter table public.profiles add column if not exists field_of_study text;
alter table public.profiles add column if not exists interests      text[] not null default '{}';
alter table public.profiles add column if not exists created_at     timestamptz not null default now();
alter table public.profiles add column if not exists updated_at     timestamptz not null default now();

-- New: lets a Super Admin suspend a user (enforced by guard trigger, see 009/010)
alter table public.profiles add column if not exists is_suspended   boolean not null default false;

create index if not exists profiles_province_idx on public.profiles (province);

-- Back-fill a profile for every existing auth user that has none
insert into public.profiles (id, full_name, email)
select u.id,
       coalesce(u.raw_user_meta_data ->> 'full_name', ''),
       u.email
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- ---------------------------------------------------------------------
-- user_interests: opportunity interests selected by a student
-- (profiles.interests is kept for the current frontend; both are used
--  when matching students to new opportunities)
-- ---------------------------------------------------------------------
create table if not exists public.user_interests (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  interest   text not null check (char_length(trim(interest)) between 1 and 100),
  created_at timestamptz not null default now()
);

create unique index if not exists user_interests_user_interest_uq
  on public.user_interests (user_id, lower(interest));
create index if not exists user_interests_user_idx
  on public.user_interests (user_id);

-- Copy existing profiles.interests into user_interests
insert into public.user_interests (user_id, interest)
select p.id, trim(i)
from public.profiles p, unnest(p.interests) as i
where trim(i) <> ''
on conflict do nothing;

comment on table public.profiles       is 'One row per auth user. Students use this for matching; roles for admins are in admin_roles, company roles in organization_members.';
comment on table public.user_interests is 'Opportunity interests chosen by a student.';
