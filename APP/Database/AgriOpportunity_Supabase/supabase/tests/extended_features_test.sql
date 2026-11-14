-- =====================================================================
-- extended_features_test.sql
-- Functional RLS / workflow test for migrations 011-013.
-- Run against the local Supabase-like harness. Everything is rolled
-- back, so this file is safe to run repeatedly.
-- =====================================================================
\set ON_ERROR_STOP on
begin;

-- Fixed UUIDs keep the test readable.
-- A = student, B = company owner, C = super admin, D = another student
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'student.a@test.local', '{"full_name":"Student A"}'),
  ('22222222-2222-2222-2222-222222222222', 'owner.b@test.local',   '{"full_name":"Owner B"}'),
  ('33333333-3333-3333-3333-333333333333', 'admin.c@test.local',   '{"full_name":"Admin C"}'),
  ('44444444-4444-4444-4444-444444444444', 'student.d@test.local', '{"full_name":"Student D"}');

-- Profile trigger must have created one row per auth user.
do $$
begin
  if (select count(*) from public.profiles
      where id in ('11111111-1111-1111-1111-111111111111',
                   '22222222-2222-2222-2222-222222222222',
                   '33333333-3333-3333-3333-333333333333',
                   '44444444-4444-4444-4444-444444444444')) <> 4 then
    raise exception 'profile trigger did not create all profiles';
  end if;
end $$;

-- Create the first Super Admin (service-role / SQL editor only).
select public.bootstrap_admin('admin.c@test.local', 'super_admin');

-- ---------------------------------------------------------------------
-- Student A personalises their profile
-- ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
set local role authenticated;

update public.profiles
set full_name = 'Student A', province = 'Gauteng',
    qualification = 'Diploma', field_of_study = 'Solar Energy',
    institution = 'Tshwane South TVET', employment_status = 'Student',
    interests = array['Learnership', 'Internship'],
    preferences = '{"careerFields":["Agriculture"],"preferredLocation":"Gauteng","workArrangement":"Flexible","experience":"None"}'::jsonb
where id = auth.uid();

do $$
begin
  if public.my_profile_completion() < 60 then
    raise exception 'profile completion too low: %', public.my_profile_completion();
  end if;
end $$;

-- Saved search
insert into public.saved_searches (user_id, name, query, filters)
values (auth.uid(), 'Solar learnerships', 'solar', '{"types":["Learnership"]}'::jsonb)
returning id;

-- RLS: A must not see D's profile
do $$
begin
  if exists (select 1 from public.profiles where id = '44444444-4444-4444-4444-444444444444') then
    raise exception 'student A can read another profile';
  end if;
end $$;

reset role;

-- ---------------------------------------------------------------------
-- Company owner B registers an organisation (starts pending)
-- ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
set local role authenticated;

insert into public.organizations (name, description, industry, province, contact_email, created_by)
values ('Test Solar Company', 'A test company', 'Energy', 'Gauteng', 'owner.b@test.local', auth.uid())
returning id;

do $$
begin
  if (select status from public.organizations where created_by = auth.uid()) <> 'pending' then
    raise exception 'new organisation must start pending';
  end if;
  if not public.is_org_owner((select id from public.organizations where created_by = auth.uid())) then
    raise exception 'owner trigger did not add the creator as owner';
  end if;
end $$;

reset role;

-- ---------------------------------------------------------------------
-- Super admin C approves the organisation and publishes an opportunity
-- ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
set local role authenticated;

select public.set_organization_status(
  (select id from public.organizations where name = 'Test Solar Company'),
  'approved', 'verified for test');

insert into public.opportunities
  (title, provider, category, province, qualification, closing_date, description,
   tags, sector, source_name, source_url, organization_id, status)
values
  ('Solar Panel Installation Learnership', 'Test Solar Company', 'Learnership',
   'Gauteng', 'Diploma', current_date + 3,
   'Practical solar installation training for young people in Gauteng.',
   array['solar', 'energy'], 'Energy', 'Test Solar Company',
   'https://example.org/solar', (select id from public.organizations where name = 'Test Solar Company'),
   'pending')
returning id;

select public.review_opportunity(
  (select id from public.opportunities where title = 'Solar Panel Installation Learnership'),
  'approve');
select public.review_opportunity(
  (select id from public.opportunities where title = 'Solar Panel Installation Learnership'),
  'publish');

do $$
begin
  if (select status from public.opportunities
      where title = 'Solar Panel Installation Learnership') <> 'published' then
    raise exception 'opportunity did not reach published';
  end if;
  if (select verification_status from public.opportunities
      where title = 'Solar Panel Installation Learnership') <> 'verified' then
    raise exception 'legacy verification_status not synced';
  end if;
end $$;

-- Admin analytics + quality report must be callable by an admin
do $$
declare v jsonb;
begin
  v := public.admin_analytics();
  if (v ->> 'opportunities_published')::int < 1 then
    raise exception 'analytics did not count the published opportunity';
  end if;
  perform public.opportunity_quality_report();
end $$;

reset role;

-- ---------------------------------------------------------------------
-- Student A uses the published opportunity
-- ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
set local role authenticated;

do $$
begin
  if (select count(*) from public.opportunities where status = 'published') < 1 then
    raise exception 'student cannot read the published opportunity';
  end if;
  if (select count(*) from public.opportunities where status = 'pending') <> 0 then
    raise exception 'student can read pending opportunities';
  end if;
end $$;

select public.record_opportunity_view(
  (select id from public.opportunities where title = 'Solar Panel Installation Learnership'),
  'test');

insert into public.bookmarks (user_id, opportunity_id)
select auth.uid(), id from public.opportunities
where title = 'Solar Panel Installation Learnership';

insert into public.applications (user_id, opportunity_id, status, applied_at)
select auth.uid(), id, 'applied', now() from public.opportunities
where title = 'Solar Panel Installation Learnership';

update public.applications set status = 'interview'
where user_id = auth.uid();

do $$
declare v_score jsonb;
begin
  if (select count(*) from public.application_status_history where user_id = auth.uid()) <> 2 then
    raise exception 'application history was not recorded twice';
  end if;

  v_score := public.match_opportunity_score(
    (select id from public.opportunities where title = 'Solar Panel Installation Learnership'));
  if (v_score ->> 'score')::int < 60 then
    raise exception 'match score unexpectedly low: %', v_score;
  end if;
  if jsonb_array_length(v_score -> 'reasons') = 0 then
    raise exception 'match score has no explanation';
  end if;
end $$;

-- Search + recommendations
do $$
begin
  if (select count(*) from public.search_opportunities('solar')) < 1 then
    raise exception 'full-text search found nothing';
  end if;
  if not exists (select 1 from public.recommended_opportunities(10, 0, false)) then
    raise exception 'recommendations returned nothing';
  end if;
end $$;

-- Report + reminder
insert into public.opportunity_reports (opportunity_id, user_id, reason, details)
select id, auth.uid(), 'incorrect_information', 'Test report'
from public.opportunities where title = 'Solar Panel Installation Learnership';

select public.set_deadline_reminder(
  (select id from public.opportunities where title = 'Solar Panel Installation Learnership'), 7);

do $$
begin
  if (select count(*) from public.deadline_reminders where user_id = auth.uid()) <> 1 then
    raise exception 'deadline reminder not created';
  end if;
  if (select count(*) from public.opportunity_reports where user_id = auth.uid()) <> 1 then
    raise exception 'report not created';
  end if;
  -- A student may not write notifications directly.
  begin
    insert into public.notifications (user_id, type, title) values (auth.uid(), 'system', 'hack');
    raise exception 'student could insert a notification';
  exception when insufficient_privilege then
    null; -- expected
  end;
end $$;

reset role;

-- ---------------------------------------------------------------------
-- Reminder job (service role)
-- ---------------------------------------------------------------------
do $$
declare v int;
begin
  v := public.dispatch_deadline_reminders(100);
  if v < 1 then
    raise exception 'reminder dispatch created no notifications';
  end if;
  if exists (select 1 from public.deadline_reminders where sent_at is null) then
    raise exception 'reminder was not marked sent';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Admin report review
-- ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
set local role authenticated;

select public.review_report(
  (select id from public.opportunity_reports where details = 'Test report'),
  'resolved', 'test resolved');

do $$
begin
  if (select status from public.opportunity_reports where details = 'Test report') <> 'resolved' then
    raise exception 'report was not resolved';
  end if;
end $$;

reset role;

-- ---------------------------------------------------------------------
-- Company owner B cannot publish directly; only sees own opportunity
-- ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
set local role authenticated;

do $$
begin
  if (select count(*) from public.opportunities) <> 1 then
    raise exception 'company owner sees opportunities it does not own';
  end if;
  begin
    update public.opportunities set status = 'published'
    where title = 'Solar Panel Installation Learnership';
    if found and (select status from public.opportunities
                  where title = 'Solar Panel Installation Learnership') = 'published' then
      -- The guard should have raised; if it did not, the test fails below.
      raise exception 'company owner bypassed the status guard';
    end if;
  exception when insufficient_privilege then
    null; -- expected: guard trigger rejects the change
  end;
end $$;

reset role;
rollback;
