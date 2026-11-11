-- =====================================================================
-- demo_users.sql  -  10 FAKE student accounts, DEV ONLY
-- Run AFTER the migrations (and after demo_data.sql for the bookmarks /
-- applications / notifications, which are skipped if the demo
-- opportunities do not exist).
--
-- Logins: student01@agriopportunity.test ... student10@agriopportunity.test
-- Passwords: Student01#Demo26 ... Student10#Demo26  (see DEMO_LOGINS.md)
--
-- NEVER run on production (passwords are public). Remove with
-- supabase/seed/remove_demo_users.sql.
-- If writing to auth.users fails on your Supabase version, create the
-- users in Dashboard -> Authentication and run only the profile section.
-- =====================================================================
begin;

create temp table _demo_students (
  n int, id uuid, email text, full_name text, province text,
  qualification text, field_of_study text, interests text[]
) on commit drop;

insert into _demo_students values
  (1,  '00000000-0000-0000-0000-00000000e001', 'student01@agriopportunity.test', 'Thabo Mokoena',     'Gauteng',       'Diploma',          'Agricultural Management',   array['Internship','Learnership']),
  (2,  '00000000-0000-0000-0000-00000000e002', 'student02@agriopportunity.test', 'Lerato Dlamini',    'Mpumalanga',    'Grade 12',         'General',                   array['Bursary','Scholarship']),
  (3,  '00000000-0000-0000-0000-00000000e003', 'student03@agriopportunity.test', 'Sipho Nkosi',       'KwaZulu-Natal', 'Bachelor''s Degree','Crop Science',             array['Graduate Programme','Job']),
  (4,  '00000000-0000-0000-0000-00000000e004', 'student04@agriopportunity.test', 'Naledi Khumalo',    'Limpopo',       'National Diploma', 'Animal Husbandry',          array['Internship','Farm Job']),
  (5,  '00000000-0000-0000-0000-00000000e005', 'student05@agriopportunity.test', 'Johan van der Merwe','Western Cape', 'BTech',            'Horticulture',              array['Learnership','Training']),
  (6,  '00000000-0000-0000-0000-00000000e006', 'student06@agriopportunity.test', 'Ayanda Zulu',       'KwaZulu-Natal', 'Grade 12',         'General',                   array['Bursary','Apprenticeship']),
  (7,  '00000000-0000-0000-0000-00000000e007', 'student07@agriopportunity.test', 'Palesa Molefe',     'Free State',    'Diploma',          'Information Technology',    array['WIL','Internship','Job']),
  (8,  '00000000-0000-0000-0000-00000000e008', 'student08@agriopportunity.test', 'Kagiso Sithole',    'North West',    'Bachelor''s Degree','Agricultural Economics',    array['Graduate Programme','Grant']),
  (9,  '00000000-0000-0000-0000-00000000e009', 'student09@agriopportunity.test', 'Zanele Ndlovu',     'Eastern Cape',  'Grade 12',         'General',                   array['Farm Job','Training']),
  (10, '00000000-0000-0000-0000-00000000e010', 'student10@agriopportunity.test', 'Pieter Botha',      'Northern Cape', 'Certificate',      'Farming Practice',          array['Training','Learnership','Grant']);

-- ---- Auth users (password StudentNN#Demo26) -------------------------
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
   confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', s.id, 'authenticated', 'authenticated', s.email,
       extensions.crypt('Student' || lpad(s.n::text, 2, '0') || '#Demo26', extensions.gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}'::jsonb,
       jsonb_build_object('full_name', s.full_name),
       now(), now(), '', '', '', ''
from _demo_students s
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), s.id, s.id::text,
       jsonb_build_object('sub', s.id::text, 'email', s.email, 'email_verified', true),
       'email', now(), now(), now()
from _demo_students s
on conflict do nothing;

-- ---- Profiles (rows are created by the sign-up trigger) -------------
insert into public.profiles (id, full_name, email) select id, full_name, email from _demo_students
on conflict (id) do nothing;

update public.profiles p
set full_name = s.full_name, province = s.province, qualification = s.qualification,
    field_of_study = s.field_of_study, interests = s.interests
from _demo_students s
where p.id = s.id;

insert into public.user_interests (user_id, interest)
select s.id, i from _demo_students s, unnest(s.interests) as i
on conflict do nothing;

-- ---- Bookmarks / applications / notifications (need demo_data.sql) --
insert into public.bookmarks (user_id, opportunity_id)
select u.id, o.id
from (values ('student01@agriopportunity.test','DEMO-001'), ('student01@agriopportunity.test','DEMO-004'),
             ('student02@agriopportunity.test','DEMO-005'), ('student03@agriopportunity.test','DEMO-002'),
             ('student04@agriopportunity.test','DEMO-001'), ('student04@agriopportunity.test','DEMO-006'),
             ('student05@agriopportunity.test','DEMO-004'), ('student05@agriopportunity.test','DEMO-007'),
             ('student08@agriopportunity.test','DEMO-003'), ('student10@agriopportunity.test','DEMO-003')) as v(email, ref)
join auth.users u on u.email = v.email
join public.opportunities o on o.external_reference = v.ref and o.status = 'published'
on conflict do nothing;

insert into public.applications (user_id, opportunity_id, status, applied_at)
select u.id, o.id, v.status, case when v.status <> 'interested' then now() - interval '2 days' end
from (values ('student01@agriopportunity.test','DEMO-001','applied'),
             ('student04@agriopportunity.test','DEMO-001','shortlisted'),
             ('student02@agriopportunity.test','DEMO-005','interested'),
             ('student03@agriopportunity.test','DEMO-002','applied'),
             ('student05@agriopportunity.test','DEMO-004','interview')) as v(email, ref, status)
join auth.users u on u.email = v.email
join public.opportunities o on o.external_reference = v.ref and o.status = 'published'
on conflict do nothing;

insert into public.notifications (user_id, type, title, message, opportunity_id)
select u.id, 'new_opportunity', 'New ' || o.category || ': ' || o.title, o.provider, o.id
from (values ('student01@agriopportunity.test','DEMO-001'), ('student02@agriopportunity.test','DEMO-005'),
             ('student04@agriopportunity.test','DEMO-006'), ('student05@agriopportunity.test','DEMO-004'),
             ('student08@agriopportunity.test','DEMO-003')) as v(email, ref)
join auth.users u on u.email = v.email
join public.opportunities o on o.external_reference = v.ref and o.status = 'published'
where not exists (select 1 from public.notifications n where n.user_id = u.id and n.opportunity_id = o.id);

select count(*) as demo_students from public.profiles where email like 'student__@agriopportunity.test';
commit;
