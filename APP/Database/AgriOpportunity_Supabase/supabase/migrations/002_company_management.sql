-- =====================================================================
-- 002_company_management.sql
-- Group B (part 1): organisations and their members
--   * organizations
--   * organization_members
-- API keys, submissions and logs are in 006_company_api.sql.
-- =====================================================================

create table if not exists public.organizations (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null check (char_length(trim(name)) between 2 and 200),
  slug                text,
  description         text,
  industry            text,
  website             text,
  contact_email       text,
  contact_phone       text,
  province            text,
  address             text,
  logo_url            text,
  registration_number text,
  -- Company lifecycle. New companies are always 'pending' until a Super Admin approves them.
  status              text not null default 'pending'
                        check (status in ('pending', 'approved', 'suspended', 'rejected')),
  -- Only true once a Super Admin has generated credentials for the company.
  api_enabled         boolean not null default false,
  integration_method  text not null default 'none'
                        check (integration_method in ('none', 'api', 'webhook', 'scheduled_sync')),
  suspended_reason    text,
  created_by          uuid references auth.users (id) on delete set null,
  approved_by         uuid references auth.users (id) on delete set null,
  approved_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create unique index if not exists organizations_slug_uq   on public.organizations (slug) where slug is not null;
create unique index if not exists organizations_name_uq   on public.organizations (lower(name));
create index if not exists organizations_status_idx       on public.organizations (status);
create index if not exists organizations_created_by_idx   on public.organizations (created_by);

create table if not exists public.organization_members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  role            text not null default 'member' check (role in ('owner', 'manager', 'member')),
  created_at      timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index if not exists organization_members_user_idx on public.organization_members (user_id);

comment on table public.organizations        is 'Companies that publish opportunities. Must be approved by a Super Admin before API access.';
comment on table public.organization_members is 'Links auth users to the organisations they belong to (owner / manager / member).';
