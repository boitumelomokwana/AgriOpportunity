-- =====================================================================
-- demo_admins.sql  -  FAKE administrator accounts + audit log, DEV ONLY
-- Run AFTER the migrations (and optionally after demo_data.sql).
--
-- Creates 3 sign-in accounts, one per admin role:
--   demo.super@agriopportunity.test     super_admin
--   demo.opps@agriopportunity.test      opportunity_admin
--   demo.content@agriopportunity.test   content_admin
-- Password for all three:  DemoAdmin#2026
--
-- NEVER run this on production: the password is public in this file.
-- Remove with supabase/seed/remove_demo_admins.sql.
-- Writing to auth.users directly is a testing shortcut; if it errors on
-- your Supabase version, create the 3 users in Dashboard -> Authentication
-- and run only the bootstrap_admin() lines at the bottom.
-- =====================================================================
begin;

with u(id, email, full_name) as (values
  ('00000000-0000-0000-0000-00000000d001'::uuid, 'demo.super@agriopportunity.test',   'Demo Super Admin'),
  ('00000000-0000-0000-0000-00000000d002'::uuid, 'demo.opps@agriopportunity.test',    'Demo Opportunity Admin'),
  ('00000000-0000-0000-0000-00000000d003'::uuid, 'demo.content@agriopportunity.test', 'Demo Content Admin')
)
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
   confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
       extensions.crypt('DemoAdmin#2026', extensions.gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}'::jsonb,
       jsonb_build_object('full_name', u.full_name),
       now(), now(), '', '', '', ''
from u
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), x.id, x.id::text,
       jsonb_build_object('sub', x.id::text, 'email', x.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users x
where x.email like 'demo.%@agriopportunity.test'
on conflict do nothing;

-- profiles are created by the sign-up trigger; make sure the names are set
update public.profiles p set full_name = coalesce(nullif(p.full_name, ''), split_part(p.email, '@', 1))
where p.email like 'demo.%@agriopportunity.test';

select public.bootstrap_admin('demo.super@agriopportunity.test',   'super_admin');
select public.bootstrap_admin('demo.opps@agriopportunity.test',    'opportunity_admin');
select public.bootstrap_admin('demo.content@agriopportunity.test', 'content_admin');

-- sample audit trail so the admin "system logs" screen has content
insert into public.admin_logs (admin_id, actor_type, action, entity_type, entity_id, details, created_at)
select a.id, 'admin', l.action, l.entity_type, l.entity_id, l.details || '{"demo": true}'::jsonb, now() - l.ago
from (values
  ('demo.opps@agriopportunity.test',    'opportunity.status_changed', 'opportunity', 'DEMO-001', '{"title":"[DEMO] Farm Management Internship","from":"approved","to":"published"}'::jsonb, interval '6 days'),
  ('demo.opps@agriopportunity.test',    'opportunity.status_changed', 'opportunity', 'DEMO-010', '{"title":"[DEMO] Irrigation Apprenticeship","from":"pending","to":"rejected"}'::jsonb,            interval '5 days'),
  ('demo.super@agriopportunity.test',   'api_key.generated',          'organization','DEMO-ORG-1','{"company":"[DEMO] GreenField Farms"}'::jsonb,                                              interval '4 days'),
  ('demo.super@agriopportunity.test',   'admin.role_assigned',        'admin_role',  'DEMO-ADMIN','{"role":"content_admin"}'::jsonb,                                                           interval '3 days'),
  ('demo.content@agriopportunity.test', 'category.updated',           'category',    'DEMO-CAT',  '{"name":"Internship"}'::jsonb,                                                              interval '2 days'),
  ('demo.super@agriopportunity.test',   'company.approved',           'organization','DEMO-ORG-2','{"company":"[DEMO] AgriTech Labs SA"}'::jsonb,                                             interval '1 day')
) as l(email, action, entity_type, entity_id, details, ago)
join auth.users a on a.email = l.email
where not exists (select 1 from public.admin_logs x where x.details ->> 'demo' = 'true');

select u.email, r.role, r.is_active
from public.admin_roles r join auth.users u on u.id = r.user_id
where u.email like 'demo.%@agriopportunity.test'
order by r.role;

commit;
