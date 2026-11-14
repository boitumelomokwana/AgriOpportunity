-- =====================================================================
-- 005_admin_roles.sql
-- Group E + role system
--   * admin_roles       (the three administrator roles)
--   * admin_logs        (audit trail)
--   * system_settings
--   * role / ownership helper functions used by every RLS policy
--
-- Roles:
--   super_admin       full access
--   opportunity_admin review, approve, reject, publish, edit opportunities
--   content_admin     categories, organisation info, edit published opportunities
--
-- Admins are created with  public.bootstrap_admin()  (first admin) or
-- public.assign_admin_role() (Super Admin only) - see 009.
-- =====================================================================

create table if not exists public.admin_roles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  role       text not null check (role in ('super_admin', 'opportunity_admin', 'content_admin')),
  is_active  boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists admin_roles_role_idx on public.admin_roles (role) where is_active;

create table if not exists public.admin_logs (
  id          bigint generated always as identity primary key,
  admin_id    uuid references auth.users (id) on delete set null,
  actor_type  text not null default 'admin' check (actor_type in ('admin', 'system', 'api')),
  action      text not null,
  entity_type text,
  entity_id   text,
  details     jsonb not null default '{}'::jsonb,
  ip_address  text,
  created_at  timestamptz not null default now()
);

create index if not exists admin_logs_time_idx   on public.admin_logs (created_at desc);
create index if not exists admin_logs_admin_idx  on public.admin_logs (admin_id, created_at desc);
create index if not exists admin_logs_entity_idx on public.admin_logs (entity_type, entity_id);

create table if not exists public.system_settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  is_public   boolean not null default false,
  updated_by  uuid references auth.users (id) on delete set null,
  updated_at  timestamptz not null default now()
);

insert into public.system_settings (key, value, description, is_public) values
  ('platform_name',                  '"AgriOpportunities"'::jsonb, 'Display name of the platform', true),
  ('api_rate_limit_per_minute',      '60'::jsonb,   'Default requests per minute for each company API key', false),
  ('api_max_payload_kb',             '256'::jsonb,  'Maximum request body size accepted by the company API', false),
  ('review_required_on_change',      'true'::jsonb, 'Return approved/published external opportunities to review when material fields change', false),
  ('notifications_enabled',          'true'::jsonb, 'Create student notifications when opportunities are published', false)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER so they can read admin_roles /
-- organization_members without recursive RLS). They only ever look at
-- the CALLING user (auth.uid()).
-- ---------------------------------------------------------------------

-- true when running as the backend (service role, SQL editor, migrations):
-- there is no end-user JWT. End users can never reach this state because
-- RLS blocks anonymous writes first.
create or replace function public.is_backend()
returns boolean
language sql stable
as $$ select auth.uid() is null $$;

create or replace function public.current_admin_role()
returns text
language sql stable security definer
set search_path = public
as $$
  select role from public.admin_roles
  where user_id = auth.uid() and is_active
  limit 1
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$ select exists (select 1 from public.admin_roles where user_id = auth.uid() and is_active) $$;

create or replace function public.is_super_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$ select exists (select 1 from public.admin_roles where user_id = auth.uid() and is_active and role = 'super_admin') $$;

-- Super Admin or Opportunity Admin: may review / approve / reject / publish
create or replace function public.can_review_opportunities()
returns boolean
language sql stable security definer
set search_path = public
as $$ select exists (select 1 from public.admin_roles where user_id = auth.uid() and is_active and role in ('super_admin', 'opportunity_admin')) $$;

-- Super Admin or Content Admin: may manage categories / organisation info / content
create or replace function public.can_manage_content()
returns boolean
language sql stable security definer
set search_path = public
as $$ select exists (select 1 from public.admin_roles where user_id = auth.uid() and is_active and role in ('super_admin', 'content_admin')) $$;

create or replace function public.is_org_member(p_org uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$ select exists (select 1 from public.organization_members where organization_id = p_org and user_id = auth.uid()) $$;

create or replace function public.is_org_manager(p_org uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$ select exists (select 1 from public.organization_members where organization_id = p_org and user_id = auth.uid() and role in ('owner', 'manager')) $$;

create or replace function public.is_org_owner(p_org uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$ select exists (select 1 from public.organization_members where organization_id = p_org and user_id = auth.uid() and role = 'owner') $$;

comment on table public.admin_roles     is 'Who is an administrator and which of the three roles they hold.';
comment on table public.admin_logs      is 'Audit trail of administrative actions and system events.';
comment on table public.system_settings is 'Platform configuration. Only Super Admin may change; is_public rows are readable by everyone.';
