-- Removes the demo administrators and their sample audit log.
begin;
delete from public.admin_logs where details ->> 'demo' = 'true';

-- the "last super admin" protection would block deleting the demo super admin
alter table public.admin_roles disable trigger admin_roles_protect_last_super;
delete from auth.users where email like 'demo.%@agriopportunity.test';   -- cascades profile + admin_roles
alter table public.admin_roles enable trigger admin_roles_protect_last_super;
commit;
