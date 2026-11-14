-- =====================================================================
-- 011_platform_extensions.sql
-- Additive schema for the integrated AgriOpportunities app.
--
-- NOTHING IS DROPPED OR REWRITTEN. Every statement is IF NOT EXISTS or
-- adds a new, nullable/defaulted column, so the existing data, users,
-- profiles, opportunities, organisations and relationships are preserved.
--
-- Adds:
--   * richer student profile fields + JSON preferences
--   * saved_searches            (persisted discovery filters)
--   * opportunity_reports       (students flag bad listings)
--   * application_status_history(student application timeline)
--   * deadline_reminders        (closing-date reminders)
--   * organisation verification fields
--   * opportunity search vector + feature flag + source-check tracking
-- =====================================================================

-- ---------------------------------------------------------------------
-- profiles: additional, optional personalisation fields
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists avatar_url             text;
alter table public.profiles add column if not exists phone                  text;
alter table public.profiles add column if not exists date_of_birth          date;
alter table public.profiles add column if not exists city                   text;
alter table public.profiles add column if not exists institution            text;
alter table public.profiles add column if not exists study_year             text;
alter table public.profiles add column if not exists employment_status      text;
alter table public.profiles add column if not exists bio                    text;
alter table public.profiles add column if not exists onboarding_completed   boolean not null default false;
alter table public.profiles add column if not exists profile_completed_at   timestamptz;
alter table public.profiles add column if not exists last_active_at         timestamptz not null default now();
alter table public.profiles add column if not exists preferences            jsonb not null default
  '{"careerFields": [], "preferredLocation": "", "workArrangement": "Flexible", "experience": ""}'::jsonb;
alter table public.profiles add column if not exists notification_preferences jsonb not null default
  '{"closingDates": true, "newMatches": true, "savedUpdates": true, "opportunityTypes": []}'::jsonb;

comment on column public.profiles.preferences is
  'Student discovery preferences (career fields, preferred location, work arrangement).';
comment on column public.profiles.notification_preferences is
  'Per-user notification switches. Interpreting them is up to the API/reminder job.';

-- ---------------------------------------------------------------------
-- notifications: allow the new reminder / moderation / organisation types
-- (existing rows keep working; the constraint is replaced, not the table)
-- ---------------------------------------------------------------------
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('new_opportunity', 'application_update', 'closing_soon',
                  'system', 'general', 'deadline_reminder',
                  'opportunity_reported', 'organization_update'));

-- ---------------------------------------------------------------------
-- saved_searches: a student can store the filters they use repeatedly
-- ---------------------------------------------------------------------
create table if not exists public.saved_searches (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null default 'Saved search' check (char_length(trim(name)) between 1 and 80),
  query      text not null default '',
  filters    jsonb not null default '{}'::jsonb,
  notify_new boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists saved_searches_user_name_uq
  on public.saved_searches (user_id, lower(name));
create index if not exists saved_searches_user_idx
  on public.saved_searches (user_id, created_at desc);

-- ---------------------------------------------------------------------
-- opportunity_reports: a student flags expired / wrong / unsafe content
-- ---------------------------------------------------------------------
create table if not exists public.opportunity_reports (
  id             uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  user_id        uuid references auth.users (id) on delete set null,
  reason         text not null check (reason in
                   ('expired', 'incorrect_information', 'broken_link', 'scam', 'other')),
  details        text check (details is null or char_length(details) <= 2000),
  status         text not null default 'open'
                   check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  resolution_note text,
  resolved_by    uuid references auth.users (id) on delete set null,
  resolved_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists opportunity_reports_status_idx
  on public.opportunity_reports (status, created_at desc);
create index if not exists opportunity_reports_opp_idx
  on public.opportunity_reports (opportunity_id, created_at desc);
create unique index if not exists opportunity_reports_one_open_per_user_uq
  on public.opportunity_reports (opportunity_id, user_id)
  where status = 'open' and user_id is not null;

-- ---------------------------------------------------------------------
-- application_status_history: timeline behind each application record
-- ---------------------------------------------------------------------
create table if not exists public.application_status_history (
  id             bigint generated always as identity primary key,
  application_id uuid not null references public.applications (id) on delete cascade,
  user_id        uuid references auth.users (id) on delete set null,
  from_status    text,
  to_status      text not null,
  note           text,
  changed_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists application_status_history_app_idx
  on public.application_status_history (application_id, created_at desc);
create index if not exists application_status_history_user_idx
  on public.application_status_history (user_id, created_at desc);

-- ---------------------------------------------------------------------
-- deadline_reminders: one row per student / opportunity / offset
-- ---------------------------------------------------------------------
create table if not exists public.deadline_reminders (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  days_before    integer not null default 7 check (days_before between 1 and 60),
  sent_at        timestamptz,
  created_at     timestamptz not null default now(),
  unique (user_id, opportunity_id, days_before)
);

create index if not exists deadline_reminders_user_idx
  on public.deadline_reminders (user_id, created_at desc);
create index if not exists deadline_reminders_pending_idx
  on public.deadline_reminders (sent_at) where sent_at is null;

-- ---------------------------------------------------------------------
-- organizations: verification / presentation fields
-- ---------------------------------------------------------------------
alter table public.organizations add column if not exists logo_url        text;
alter table public.organizations add column if not exists cover_url       text;
alter table public.organizations add column if not exists employee_count  text;
alter table public.organizations add column if not exists founded_year    integer;
alter table public.organizations add column if not exists tags            text[] not null default '{}';
alter table public.organizations add column if not exists is_verified     boolean not null default false;
alter table public.organizations add column if not exists verified_at     timestamptz;
alter table public.organizations add column if not exists verified_by     uuid references auth.users (id) on delete set null;
alter table public.organizations add column if not exists last_verified_at timestamptz;

-- ---------------------------------------------------------------------
-- opportunities: search + operational fields
-- ---------------------------------------------------------------------
alter table public.opportunities add column if not exists is_featured      boolean not null default false;
alter table public.opportunities add column if not exists source_checked_at timestamptz;
alter table public.opportunities add column if not exists last_verified_at  timestamptz;
alter table public.opportunities add column if not exists quality_score     integer;

-- Full-text search over the fields students actually search.
-- A stored tsvector column (maintained by the trigger in 013) is used
-- instead of a generated column: generated columns are not compatible
-- with REPLICA IDENTITY FULL / Realtime publications on every Supabase
-- Postgres version.
alter table public.opportunities add column if not exists search_vector tsvector;
create index if not exists opportunities_search_idx
  on public.opportunities using gin (search_vector);

-- Backfill existing rows (the trigger keeps them current afterwards).
update public.opportunities o
set search_vector = to_tsvector(
      'english'::regconfig,
      coalesce(o.title, '') || ' ' ||
      coalesce(o.provider, '') || ' ' ||
      coalesce(o.description, '') || ' ' ||
      coalesce(o.category, '') || ' ' ||
      coalesce(o.opportunity_type, '') || ' ' ||
      coalesce(o.province, '') || ' ' ||
      coalesce(o.location, '') || ' ' ||
      coalesce(o.qualification, '') || ' ' ||
      coalesce(o.eligibility_criteria, '')
    )
where o.search_vector is null;

create index if not exists opportunities_featured_idx
  on public.opportunities (is_featured, published_at desc) where status = 'published';

comment on table public.saved_searches is 'Saved discovery filters, private to the student.';
comment on table public.opportunity_reports is 'Student reports about an opportunity. Reviewed by administrators.';
comment on table public.application_status_history is 'Append-only timeline for each application status change.';
comment on table public.deadline_reminders is 'Closing-date reminders requested by students. Read by the reminder job.';
comment on column public.opportunities.search_vector is 'Generated full-text index used by public.search_opportunities().';
