-- =====================================================================
-- 003_opportunity_management.sql
-- Group C: Opportunity management
--   * categories          (new, seeded)
--   * opportunities       (existing table is EXTENDED, never dropped)
--   * opportunity_views   (new)
--
-- New status model:  pending -> approved -> published   (or rejected)
-- The legacy columns used by the current frontend/admin API
-- (published, verification_status) are KEPT and kept in sync
-- automatically by a trigger (see 009 / 010) so nothing breaks.
-- =====================================================================

-- Safety check: the new foreign keys assume opportunities.id is a uuid.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'opportunities'
      and column_name = 'id' and data_type <> 'uuid'
  ) then
    raise exception 'opportunities.id is not uuid. Stop and review before running this migration.';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  slug        text not null unique,
  description text,
  icon        text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Seed with the categories the frontend already uses (names match the
-- existing opportunities.category values exactly).
insert into public.categories (name, slug, sort_order) values
  ('Bursary',              'bursary',              10),
  ('WIL',                  'wil',                  20),
  ('Internship',           'internship',           30),
  ('In-service Training',  'in-service-training',  40),
  ('Learnership',          'learnership',          50),
  ('Apprenticeship',       'apprenticeship',       60),
  ('Grant',                'grant',                70),
  ('Farm Job',             'farm-job',             80),
  ('Graduate Programme',   'graduate-programme',   90),
  ('Job',                  'job',                 100),
  ('Scholarship',          'scholarship',         110),
  ('Training',             'training',            120),
  ('Other',                'other',               999)
on conflict (name) do nothing;

-- ---------------------------------------------------------------------
-- opportunities (create only if the project somehow has no table yet)
-- ---------------------------------------------------------------------
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
  verification_status text not null default 'pending',
  published           boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ---- new columns -----------------------------------------------------
alter table public.opportunities add column if not exists organization_id     uuid references public.organizations (id) on delete set null;
alter table public.opportunities add column if not exists category_id         uuid references public.categories (id)    on delete set null;
alter table public.opportunities add column if not exists opportunity_type    text;
alter table public.opportunities add column if not exists location            text;
alter table public.opportunities add column if not exists is_remote           boolean not null default false;
alter table public.opportunities add column if not exists eligibility_criteria text;
alter table public.opportunities add column if not exists external_reference  text;
alter table public.opportunities add column if not exists submission_source   text not null default 'admin';
alter table public.opportunities add column if not exists content_hash        text;
alter table public.opportunities add column if not exists status              text not null default 'pending';
alter table public.opportunities add column if not exists rejection_reason    text;
alter table public.opportunities add column if not exists withdrawn_at        timestamptz;
alter table public.opportunities add column if not exists approved_by         uuid references auth.users (id) on delete set null;
alter table public.opportunities add column if not exists approved_at         timestamptz;
alter table public.opportunities add column if not exists published_at        timestamptz;

-- ---- constraints -----------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'opportunities_status_check') then
    alter table public.opportunities
      add constraint opportunities_status_check
      check (status in ('pending', 'approved', 'published', 'rejected'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'opportunities_submission_source_check') then
    alter table public.opportunities
      add constraint opportunities_submission_source_check
      check (submission_source in ('admin', 'import', 'company_api', 'webhook', 'scheduled_sync'));
  end if;
end $$;

-- Duplicate prevention for external submissions:
-- one external reference per organisation (covers every channel, so the
-- same opportunity sent by API, webhook and sync is never stored twice).
create unique index if not exists opportunities_org_external_ref_uq
  on public.opportunities (organization_id, external_reference)
  where organization_id is not null and external_reference is not null;

create index if not exists opportunities_status_idx        on public.opportunities (status);
create index if not exists opportunities_status_pub_idx    on public.opportunities (status, published_at desc);
create index if not exists opportunities_org_idx           on public.opportunities (organization_id);
create index if not exists opportunities_category_id_idx   on public.opportunities (category_id);
create index if not exists opportunities_province_idx      on public.opportunities (province);
create index if not exists opportunities_closing_date_idx  on public.opportunities (closing_date);

-- ---- back-fill from legacy columns ----------------------------------
-- published + approved/verified -> published ; approved -> approved ;
-- rejected -> rejected ; everything else -> pending
update public.opportunities
set status = case
      when published and verification_status in ('approved', 'verified') then 'published'
      when verification_status in ('approved', 'verified')               then 'approved'
      when verification_status = 'rejected'                              then 'rejected'
      else 'pending'
    end
where status = 'pending'
  and (published or verification_status <> 'pending');

-- The current frontend only loads verification_status = 'verified'.
-- Make published rows consistent so they are not hidden by the old mismatch.
update public.opportunities
set verification_status = 'verified'
where status = 'published' and verification_status <> 'verified';

update public.opportunities
set published_at = coalesce(published_at, created_at)
where status = 'published';

-- Link existing rows to the new categories table
update public.opportunities o
set category_id = c.id
from public.categories c
where o.category_id is null
  and lower(c.name) = lower(o.category);

-- ---------------------------------------------------------------------
-- opportunity_views (analytics)
-- ---------------------------------------------------------------------
create table if not exists public.opportunity_views (
  id             bigint generated always as identity primary key,
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  user_id        uuid references auth.users (id) on delete set null,
  source         text,
  viewed_at      timestamptz not null default now()
);

create index if not exists opportunity_views_opp_idx  on public.opportunity_views (opportunity_id, viewed_at desc);
create index if not exists opportunity_views_time_idx on public.opportunity_views (viewed_at desc);

comment on column public.opportunities.status              is 'Source of truth: pending | approved | published | rejected. Legacy columns published / verification_status are derived from it.';
comment on column public.opportunities.external_reference  is 'The company''s own ID for the opportunity. Unique per organisation.';
comment on column public.opportunities.content_hash        is 'Hash of externally supplied fields, used to detect real changes during sync.';
