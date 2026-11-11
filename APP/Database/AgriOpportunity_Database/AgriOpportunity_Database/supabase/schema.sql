-- AgriOpportunity database schema (Supabase / PostgreSQL)
-- Reconstructed from how the app reads and writes data.
-- Run the whole file in: Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Safe to re-run.

-- ---------------------------------------------------------------
-- Shared helper: keep updated_at current
-- ---------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------
-- profiles  (one row per Supabase Auth user)
-- ---------------------------------------------------------------
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

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Auto-create an empty profile when someone registers
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------
-- opportunities
-- ---------------------------------------------------------------
create table if not exists public.opportunities (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null,
  provider            text not null,
  category            text not null,
  province            text not null default 'Nationwide',
  qualification       text not null default 'Not specified',
  closing_date        date,
  description         text not null,
  tags                text[] not null default '{}',
  requirements        jsonb not null default
                        '{"studyLevel": false, "careerField": false, "experience": false}'::jsonb,
  sector              text not null default 'Other',
  source_name         text not null,
  source_url          text not null,
  source_type         text not null default 'admin_curated'
                        check (source_type in ('official_api', 'third_party_api', 'admin_curated')),
  application_url     text,
  verification_status text not null default 'pending'
                        check (verification_status in ('pending', 'approved', 'verified', 'rejected')),
  published           boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists opportunities_public_idx
  on public.opportunities (published, verification_status, created_at desc);
create index if not exists opportunities_category_idx
  on public.opportunities (category);
create index if not exists opportunities_closing_date_idx
  on public.opportunities (closing_date);

drop trigger if exists opportunities_set_updated_at on public.opportunities;
create trigger opportunities_set_updated_at
before update on public.opportunities
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.opportunities enable row level security;

-- profiles: each user can only see and change their own row
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- opportunities: the public app may only read published + checked rows.
-- Inserts/updates are done by the backend with the service-role key,
-- which bypasses RLS, so no write policies are needed.
drop policy if exists "opportunities_read_published" on public.opportunities;
create policy "opportunities_read_published" on public.opportunities
  for select to anon, authenticated
  using (published = true and verification_status in ('approved', 'verified'));
