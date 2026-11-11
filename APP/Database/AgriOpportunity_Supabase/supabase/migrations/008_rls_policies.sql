-- =====================================================================
-- 008_rls_policies.sql
-- Row Level Security for every table.
--
-- Principles
--   * Students only see / change their own private rows.
--   * Companies only see their own organisation, keys metadata,
--     submissions, logs and opportunities.
--   * Admins only get what their role allows (helpers from 005).
--   * Anything not explicitly allowed is denied.
--   * Sensitive writes (API keys, notifications, logs, role changes,
--     company approval, opportunity review) go through SECURITY DEFINER
--     functions (009) or the backend service role - never direct client writes.
--   * Realtime follows these same policies.
-- =====================================================================

alter table public.profiles                  enable row level security;
alter table public.user_interests            enable row level security;
alter table public.organizations             enable row level security;
alter table public.organization_members      enable row level security;
alter table public.categories                enable row level security;
alter table public.opportunities             enable row level security;
alter table public.opportunity_views         enable row level security;
alter table public.applications              enable row level security;
alter table public.bookmarks                 enable row level security;
alter table public.notifications             enable row level security;
alter table public.admin_roles               enable row level security;
alter table public.admin_logs                enable row level security;
alter table public.system_settings           enable row level security;
alter table public.company_api_keys          enable row level security;
alter table public.api_submissions           enable row level security;
alter table public.api_logs                  enable row level security;
alter table public.api_rate_limits           enable row level security;
alter table public.organization_sync_configs enable row level security;

-- Tables with no public use: remove anonymous access entirely
revoke all on public.admin_roles, public.admin_logs, public.company_api_keys,
              public.api_submissions, public.api_logs, public.api_rate_limits,
              public.organization_sync_configs, public.applications,
              public.bookmarks, public.notifications, public.user_interests,
              public.organization_members
  from anon;

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------
drop policy if exists "profiles_select_own"   on public.profiles;
drop policy if exists "profiles_insert_own"   on public.profiles;
drop policy if exists "profiles_update_own"   on public.profiles;
drop policy if exists "profiles_select_admin" on public.profiles;
drop policy if exists "profiles_update_admin" on public.profiles;

create policy "profiles_select_own" on public.profiles
  for select to authenticated using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
-- Super Admin: manage all users (is_suspended is guarded by a trigger)
create policy "profiles_select_admin" on public.profiles
  for select to authenticated using (public.is_super_admin());
create policy "profiles_update_admin" on public.profiles
  for update to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- ---------------------------------------------------------------------
-- user_interests / bookmarks / applications : private to the student
-- ---------------------------------------------------------------------
drop policy if exists "user_interests_own" on public.user_interests;
create policy "user_interests_own" on public.user_interests
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "bookmarks_own" on public.bookmarks;
create policy "bookmarks_own" on public.bookmarks
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "applications_select_own" on public.applications;
drop policy if exists "applications_insert_own" on public.applications;
drop policy if exists "applications_update_own" on public.applications;
drop policy if exists "applications_delete_own" on public.applications;

create policy "applications_select_own" on public.applications
  for select to authenticated using (auth.uid() = user_id);
-- A student may only track opportunities they can actually see (published)
create policy "applications_insert_own" on public.applications
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.opportunities o where o.id = opportunity_id and o.status = 'published')
  );
create policy "applications_update_own" on public.applications
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "applications_delete_own" on public.applications
  for delete to authenticated using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- notifications: student reads / marks read / deletes own. No client inserts.
-- ---------------------------------------------------------------------
drop policy if exists "notifications_select_own" on public.notifications;
drop policy if exists "notifications_update_own" on public.notifications;
drop policy if exists "notifications_delete_own" on public.notifications;

create policy "notifications_select_own" on public.notifications
  for select to authenticated using (auth.uid() = user_id);
create policy "notifications_update_own" on public.notifications
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "notifications_delete_own" on public.notifications
  for delete to authenticated using (auth.uid() = user_id);

-- A student may only flip is_read / read_at, never rewrite the message
revoke update on public.notifications from authenticated;
grant  update (is_read, read_at) on public.notifications to authenticated;

-- ---------------------------------------------------------------------
-- admin_roles / admin_logs / system_settings
-- ---------------------------------------------------------------------
drop policy if exists "admin_roles_select" on public.admin_roles;
drop policy if exists "admin_roles_manage" on public.admin_roles;
create policy "admin_roles_select" on public.admin_roles
  for select to authenticated using (user_id = auth.uid() or public.is_super_admin());
create policy "admin_roles_manage" on public.admin_roles
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists "admin_logs_select" on public.admin_logs;
drop policy if exists "admin_logs_insert" on public.admin_logs;
create policy "admin_logs_select" on public.admin_logs
  for select to authenticated using (public.is_super_admin());
create policy "admin_logs_insert" on public.admin_logs
  for insert to authenticated with check (public.is_admin() and admin_id = auth.uid());

drop policy if exists "system_settings_select" on public.system_settings;
drop policy if exists "system_settings_manage" on public.system_settings;
create policy "system_settings_select" on public.system_settings
  for select to anon, authenticated using (is_public or public.is_super_admin());
create policy "system_settings_manage" on public.system_settings
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- ---------------------------------------------------------------------
-- organizations
--   register: any signed-in user (always starts 'pending', no API)
--   read:     members, any admin
--   update:   managers (info only - status/api guarded by trigger), Super + Content Admin
--   delete:   Super Admin
-- ---------------------------------------------------------------------
drop policy if exists "organizations_select"       on public.organizations;
drop policy if exists "organizations_insert"       on public.organizations;
drop policy if exists "organizations_update_org"   on public.organizations;
drop policy if exists "organizations_update_admin" on public.organizations;
drop policy if exists "organizations_delete"       on public.organizations;

create policy "organizations_select" on public.organizations
  for select to authenticated
  using (public.is_admin() or public.is_org_member(id) or created_by = auth.uid());
create policy "organizations_insert" on public.organizations
  for insert to authenticated
  with check (created_by = auth.uid() and status = 'pending' and api_enabled = false);
create policy "organizations_update_org" on public.organizations
  for update to authenticated using (public.is_org_manager(id)) with check (public.is_org_manager(id));
create policy "organizations_update_admin" on public.organizations
  for update to authenticated using (public.can_manage_content()) with check (public.can_manage_content());
create policy "organizations_delete" on public.organizations
  for delete to authenticated using (public.is_super_admin());

-- Safe public listing (no contact details, no API flags)
create or replace view public.public_organizations as
  select id, name, slug, description, website, logo_url, province, industry
  from public.organizations
  where status = 'approved';
grant select on public.public_organizations to anon, authenticated;

drop policy if exists "organization_members_select" on public.organization_members;
drop policy if exists "organization_members_insert" on public.organization_members;
drop policy if exists "organization_members_update" on public.organization_members;
drop policy if exists "organization_members_delete" on public.organization_members;

create policy "organization_members_select" on public.organization_members
  for select to authenticated
  using (user_id = auth.uid() or public.is_org_member(organization_id) or public.is_super_admin());
create policy "organization_members_insert" on public.organization_members
  for insert to authenticated
  with check (public.is_org_owner(organization_id) or public.is_super_admin());
create policy "organization_members_update" on public.organization_members
  for update to authenticated
  using (public.is_org_owner(organization_id) or public.is_super_admin())
  with check (public.is_org_owner(organization_id) or public.is_super_admin());
create policy "organization_members_delete" on public.organization_members
  for delete to authenticated
  using (public.is_org_owner(organization_id) or public.is_super_admin());

-- ---------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------
drop policy if exists "categories_select" on public.categories;
drop policy if exists "categories_manage" on public.categories;
create policy "categories_select" on public.categories
  for select to anon, authenticated using (is_active or public.can_manage_content());
create policy "categories_manage" on public.categories
  for all to authenticated using (public.can_manage_content()) with check (public.can_manage_content());

-- ---------------------------------------------------------------------
-- opportunities
--   public:   published only
--   admins:   all rows
--   company:  own organisation's rows (read only - writes via the API)
-- ---------------------------------------------------------------------
drop policy if exists "opportunities_read_published"   on public.opportunities;
drop policy if exists "opportunities_public_read"      on public.opportunities;
drop policy if exists "opportunities_admin_read"       on public.opportunities;
drop policy if exists "opportunities_org_read"         on public.opportunities;
drop policy if exists "opportunities_review_insert"    on public.opportunities;
drop policy if exists "opportunities_review_update"    on public.opportunities;
drop policy if exists "opportunities_content_update"   on public.opportunities;
drop policy if exists "opportunities_delete"           on public.opportunities;

create policy "opportunities_public_read" on public.opportunities
  for select to anon, authenticated using (status = 'published');
create policy "opportunities_admin_read" on public.opportunities
  for select to authenticated using (public.is_admin());
create policy "opportunities_org_read" on public.opportunities
  for select to authenticated
  using (organization_id is not null and public.is_org_member(organization_id));

create policy "opportunities_review_insert" on public.opportunities
  for insert to authenticated with check (public.can_review_opportunities());
create policy "opportunities_review_update" on public.opportunities
  for update to authenticated
  using (public.can_review_opportunities()) with check (public.can_review_opportunities());
-- Content Admin: edit PUBLISHED opportunities only (status fields are
-- locked by the guard trigger in 009/010)
create policy "opportunities_content_update" on public.opportunities
  for update to authenticated
  using (public.can_manage_content() and status = 'published')
  with check (public.can_manage_content() and status = 'published');
create policy "opportunities_delete" on public.opportunities
  for delete to authenticated using (public.is_super_admin());

-- ---------------------------------------------------------------------
-- opportunity_views
-- ---------------------------------------------------------------------
drop policy if exists "opportunity_views_insert" on public.opportunity_views;
drop policy if exists "opportunity_views_select" on public.opportunity_views;
create policy "opportunity_views_insert" on public.opportunity_views
  for insert to anon, authenticated
  with check (
    (user_id is null or user_id = auth.uid())
    and exists (select 1 from public.opportunities o where o.id = opportunity_id and o.status = 'published')
  );
create policy "opportunity_views_select" on public.opportunity_views
  for select to authenticated using (public.is_admin() or user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Company API tables (writes only through functions / service role)
-- ---------------------------------------------------------------------
drop policy if exists "company_api_keys_select" on public.company_api_keys;
create policy "company_api_keys_select" on public.company_api_keys
  for select to authenticated
  using (public.is_super_admin() or public.is_org_manager(organization_id));

-- Hide the hash itself from every client; only safe metadata is selectable
revoke all on public.company_api_keys from authenticated;
grant select (id, organization_id, name, key_prefix, scopes, status,
              last_used_at, expires_at, created_at, revoked_at)
  on public.company_api_keys to authenticated;

drop policy if exists "api_submissions_select" on public.api_submissions;
create policy "api_submissions_select" on public.api_submissions
  for select to authenticated
  using (public.can_review_opportunities() or public.is_org_member(organization_id));
revoke insert, update, delete on public.api_submissions from authenticated;

drop policy if exists "api_logs_select" on public.api_logs;
create policy "api_logs_select" on public.api_logs
  for select to authenticated
  using (public.is_super_admin() or (organization_id is not null and public.is_org_manager(organization_id)));
revoke insert, update, delete on public.api_logs from authenticated;

-- api_rate_limits: RLS on, no policy = no client access at all.

drop policy if exists "sync_configs_select" on public.organization_sync_configs;
drop policy if exists "sync_configs_manage" on public.organization_sync_configs;
create policy "sync_configs_select" on public.organization_sync_configs
  for select to authenticated
  using (public.is_super_admin() or public.is_org_manager(organization_id));
create policy "sync_configs_manage" on public.organization_sync_configs
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
