-- =====================================================================
-- 010_database_triggers.sql
-- Attaches the functions from 009.
--
-- Trigger order on opportunities matters (PostgreSQL fires BEFORE triggers
-- alphabetically): 01 guard -> 02 status sync -> 03 updated_at,
-- then AFTER triggers: audit, notify students.
-- =====================================================================

-- ---- auth.users -> profiles ---------------------------------------
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---- profiles -----------------------------------------------------
drop trigger if exists profiles_set_updated_at on public.profiles;
drop trigger if exists profiles_guard          on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger profiles_guard
  before update on public.profiles
  for each row execute function public.guard_profile_changes();

-- ---- organizations ------------------------------------------------
drop trigger if exists organizations_01_guard       on public.organizations;
drop trigger if exists organizations_02_updated_at  on public.organizations;
drop trigger if exists organizations_add_owner      on public.organizations;
create trigger organizations_01_guard
  before update on public.organizations
  for each row execute function public.guard_organization_changes();
create trigger organizations_02_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();
create trigger organizations_add_owner
  after insert on public.organizations
  for each row execute function public.add_organization_owner();

-- ---- opportunities ------------------------------------------------
drop trigger if exists opportunities_set_updated_at on public.opportunities;  -- from the earlier schema.sql
drop trigger if exists opportunities_01_guard       on public.opportunities;
drop trigger if exists opportunities_02_sync_status on public.opportunities;
drop trigger if exists opportunities_03_updated_at  on public.opportunities;
drop trigger if exists opportunities_audit          on public.opportunities;
drop trigger if exists opportunities_notify         on public.opportunities;

create trigger opportunities_01_guard
  before update on public.opportunities
  for each row execute function public.guard_opportunity_changes();
create trigger opportunities_02_sync_status
  before insert or update on public.opportunities
  for each row execute function public.sync_opportunity_status();
create trigger opportunities_03_updated_at
  before update on public.opportunities
  for each row execute function public.set_updated_at();
create trigger opportunities_audit
  after insert or update on public.opportunities
  for each row execute function public.audit_opportunity_status();
create trigger opportunities_notify
  after insert or update on public.opportunities
  for each row execute function public.notify_students_on_publish();

-- ---- admin_roles --------------------------------------------------
drop trigger if exists admin_roles_protect_last_super on public.admin_roles;
drop trigger if exists admin_roles_updated_at         on public.admin_roles;
create trigger admin_roles_protect_last_super
  before update or delete on public.admin_roles
  for each row execute function public.prevent_last_super_admin_removal();
create trigger admin_roles_updated_at
  before update on public.admin_roles
  for each row execute function public.set_updated_at();

-- ---- plain updated_at triggers -----------------------------------
drop trigger if exists categories_updated_at     on public.categories;
drop trigger if exists applications_updated_at   on public.applications;
drop trigger if exists system_settings_updated_at on public.system_settings;
drop trigger if exists sync_configs_updated_at   on public.organization_sync_configs;

create trigger categories_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();
create trigger applications_updated_at
  before update on public.applications
  for each row execute function public.set_updated_at();
create trigger system_settings_updated_at
  before update on public.system_settings
  for each row execute function public.set_updated_at();
create trigger sync_configs_updated_at
  before update on public.organization_sync_configs
  for each row execute function public.set_updated_at();
