-- =====================================================================
-- verify_setup.sql  -  smoke test for the AgriOpportunity migrations
--
-- Run in the Supabase SQL Editor (or: psql "$DB_URL" -f verify_setup.sql)
-- AFTER the migrations. Everything happens inside one transaction that is
-- ROLLED BACK at the end, so no test data is kept. If a check fails the
-- script stops with a "FAIL:" error naming the check.
-- Use a development / staging project, not production.
-- =====================================================================
begin;

-- ---- fixtures (as postgres) -----------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'super@test.local'),
  ('00000000-0000-0000-0000-0000000000a2', 'oppadmin@test.local'),
  ('00000000-0000-0000-0000-0000000000a3', 'content@test.local'),
  ('00000000-0000-0000-0000-0000000000b1', 'student@test.local'),
  ('00000000-0000-0000-0000-0000000000b2', 'student2@test.local'),
  ('00000000-0000-0000-0000-0000000000c1', 'company@test.local');

select public.bootstrap_admin('super@test.local',    'super_admin');
select public.bootstrap_admin('oppadmin@test.local', 'opportunity_admin');
select public.bootstrap_admin('content@test.local',  'content_admin');

do $$ begin
  if (select count(*) from public.profiles where id::text like '00000000-0000-0000-0000-0000000000%') <> 6 then
    raise exception 'FAIL: profiles were not auto-created for new auth users';
  end if;
end $$;

-- student 1 is interested in Internships
update public.profiles set interests = array['Internship'], province = 'Gauteng'
where id = '00000000-0000-0000-0000-0000000000b1';

-- ---- company registers (as the company user) ------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
set local role authenticated;

insert into public.organizations (name, created_by, status)
values ('Test Agri Co', '00000000-0000-0000-0000-0000000000c1', 'pending');

do $$ declare ok boolean := false; begin
  begin
    update public.organizations set status = 'approved' where name = 'Test Agri Co';
  exception when others then ok := true; end;
  if not ok then raise exception 'FAIL: company owner was able to approve own company'; end if;
end $$;

do $$ declare ok boolean := false; begin
  begin
    insert into public.organizations (name, created_by, status)
    values ('Sneaky Co', '00000000-0000-0000-0000-0000000000c1', 'approved');
  exception when others then ok := true; end;
  if not ok then raise exception 'FAIL: company could self-register as approved'; end if;
end $$;

do $$ begin
  if not exists (select 1 from public.organization_members where role = 'owner'
                 and user_id = '00000000-0000-0000-0000-0000000000c1') then
    raise exception 'FAIL: creator was not added as organisation owner';
  end if;
end $$;
reset role;
select set_config('request.jwt.claims', '', true);

-- ---- Super Admin approves the company and issues a key --------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
update public.organizations set status = 'approved' where name = 'Test Agri Co';

do $$
declare k jsonb;
begin
  k := public.generate_company_api_key((select id from public.organizations where name = 'Test Agri Co'), 'test');
  perform set_config('app.test_key', k ->> 'api_key', true);
end $$;

do $$ begin
  if (select count(*) from public.admin_logs where action = 'api_key.generated') < 1 then
    raise exception 'FAIL: key generation not audited';
  end if;
end $$;
reset role;
select set_config('request.jwt.claims', '', true);

-- ---- key verification / hashing / rate limit (backend) --------------
do $$
declare v jsonb; k text; r jsonb;
begin
  k := current_setting('app.test_key');
  v := public.verify_company_api_key(k);
  if v is null then raise exception 'FAIL: valid key was rejected'; end if;
  if public.verify_company_api_key(k || 'x') is not null then raise exception 'FAIL: bad key accepted'; end if;
  if exists (select 1 from public.company_api_keys where key_hash = k) then
    raise exception 'FAIL: plaintext key stored';
  end if;
  r := public.check_api_rate_limit((v ->> 'key_id')::uuid, 2, 60);
  r := public.check_api_rate_limit((v ->> 'key_id')::uuid, 2, 60);
  r := public.check_api_rate_limit((v ->> 'key_id')::uuid, 2, 60);
  if (r ->> 'allowed')::boolean then raise exception 'FAIL: rate limit not enforced'; end if;
end $$;

-- ---- company submits opportunities through the integration function -
do $$
declare org uuid; kid uuid; r jsonb; opp uuid;
begin
  select id into org from public.organizations where name = 'Test Agri Co';
  select id into kid from public.company_api_keys where organization_id = org limit 1;

  r := public.submit_company_opportunity(org, kid, 'created',
        '{"external_reference":"EXT-1","title":"Farm Intern","description":"Learn farming","category":"Internship","application_url":"https://example.com/apply","closing_date":"2027-03-01"}',
        'company_api');
  if r ->> 'action' <> 'created' or r ->> 'status' <> 'pending' then
    raise exception 'FAIL: submission should be created as pending, got %', r;
  end if;
  opp := (r ->> 'opportunity_id')::uuid;

  r := public.submit_company_opportunity(org, kid, 'created',
        '{"external_reference":"EXT-1","title":"Farm Intern","description":"Learn farming","category":"Internship","application_url":"https://example.com/apply","closing_date":"2027-03-01"}',
        'webhook');
  if r ->> 'action' <> 'unchanged' then raise exception 'FAIL: duplicate not detected, got %', r; end if;
  if (select count(*) from public.opportunities where external_reference = 'EXT-1') <> 1 then
    raise exception 'FAIL: duplicate row created';
  end if;

  r := public.submit_company_opportunity(org, kid, 'created', '{"title":"x"}', 'company_api');
  if (r ->> 'ok')::boolean then raise exception 'FAIL: invalid payload accepted'; end if;
end $$;

-- ---- students cannot see pending; reviewer publishes ----------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  if exists (select 1 from public.opportunities where external_reference = 'EXT-1') then
    raise exception 'FAIL: student can see a pending opportunity';
  end if;
end $$;
reset role;
select set_config('request.jwt.claims', '', true);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
set local role authenticated;
do $$
declare opp uuid; ok boolean := false;
begin
  select id into opp from public.opportunities where external_reference = 'EXT-1';
  perform public.review_opportunity(opp, 'approve');
  perform public.review_opportunity(opp, 'publish');
  if (select status from public.opportunities where id = opp) <> 'published' then
    raise exception 'FAIL: opportunity not published';
  end if;
  if (select published from public.opportunities where id = opp) is not true
     or (select verification_status from public.opportunities where id = opp) <> 'verified' then
    raise exception 'FAIL: legacy columns not synced for the existing frontend';
  end if;
  -- Opportunity Admin must not be able to manage admins
  begin perform public.assign_admin_role('00000000-0000-0000-0000-0000000000b1', 'super_admin'); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL: opportunity admin could assign roles'; end if;
end $$;
reset role;
select set_config('request.jwt.claims', '', true);

-- ---- student sees it and was notified; privacy ----------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  if not exists (select 1 from public.opportunities where external_reference = 'EXT-1') then
    raise exception 'FAIL: student cannot see published opportunity';
  end if;
  if not exists (select 1 from public.notifications where type = 'new_opportunity') then
    raise exception 'FAIL: matching student was not notified';
  end if;
end $$;
insert into public.bookmarks (user_id, opportunity_id)
select '00000000-0000-0000-0000-0000000000b1', id from public.opportunities where external_reference = 'EXT-1';
reset role;
select set_config('request.jwt.claims', '', true);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  if exists (select 1 from public.bookmarks) then raise exception 'FAIL: student can read another student''s bookmarks'; end if;
  if exists (select 1 from public.notifications) then raise exception 'FAIL: student can read another student''s notifications'; end if;
end $$;
reset role;
select set_config('request.jwt.claims', '', true);

-- ---- content admin: edit wording yes, status no ----------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
set local role authenticated;
do $$ declare ok boolean := false; n int; begin
  update public.opportunities set description = 'Learn farming - updated' where external_reference = 'EXT-1';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: content admin cannot edit a published opportunity'; end if;
  begin update public.opportunities set status = 'rejected' where external_reference = 'EXT-1';
  exception when others then ok := true; end;
  if not ok then raise exception 'FAIL: content admin could change status'; end if;
end $$;
reset role;
select set_config('request.jwt.claims', '', true);

-- ---- a material change from the company returns it to review --------
do $$
declare org uuid; kid uuid; r jsonb;
begin
  select id into org from public.organizations where name = 'Test Agri Co';
  select id into kid from public.company_api_keys where organization_id = org limit 1;
  r := public.submit_company_opportunity(org, kid, 'updated',
        '{"external_reference":"EXT-1","description":"Completely new description"}', 'scheduled_sync');
  if r ->> 'action' <> 'returned_to_review' then raise exception 'FAIL: material change not sent to review, got %', r; end if;
  if (select published from public.opportunities where external_reference = 'EXT-1') then
    raise exception 'FAIL: opportunity still public after material change';
  end if;
  r := public.submit_company_opportunity(org, kid, 'withdrawn', '{"external_reference":"EXT-1"}', 'webhook');
  if r ->> 'action' <> 'withdrawn' then raise exception 'FAIL: withdraw failed, got %', r; end if;
end $$;

-- ---- last Super Admin cannot be removed -----------------------------
do $$ declare ok boolean := false; begin
  begin delete from public.admin_roles where user_id = '00000000-0000-0000-0000-0000000000a1';
  exception when others then ok := true; end;
  if not ok then raise exception 'FAIL: last super admin could be deleted'; end if;
end $$;

-- =====================================================================
-- Added platform features (migrations 011-013)
-- =====================================================================
-- Fixture: one fresh published opportunity with a closing date soon.
insert into public.opportunities
  (title, provider, category, province, qualification, closing_date, description,
   tags, sector, source_name, source_url, external_reference, status)
values
  ('Verification Solar Learnership', 'Test Agri Co', 'Learnership', 'Gauteng',
   'Grade 12', current_date + 5,
   'Practical solar installation training used by the verification test.',
   array['solar', 'energy'], 'Energy', 'Test Agri Co',
   'https://example.com/verify', 'VERIFY-1', 'published');

do $$ begin
  if (select search_vector from public.opportunities where external_reference = 'VERIFY-1') is null then
    raise exception 'FAIL: search_vector was not populated';
  end if;
end $$;

-- ---- student uses saved searches, matching, reports and reminders ----
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
set local role authenticated;

update public.profiles
set interests = array['Internship','Learnership'],
    field_of_study = 'Solar Energy',
    qualification = 'Grade 12'
where id = '00000000-0000-0000-0000-0000000000b1';

do $$ declare v jsonb;
begin
  v := public.match_opportunity_score((select id from public.opportunities where external_reference = 'VERIFY-1'));
  if (v ->> 'score')::int < 50 then raise exception 'FAIL: match score too low: %', v; end if;
  if jsonb_array_length(v -> 'reasons') < 2 then raise exception 'FAIL: match score is not explained'; end if;
  if not exists (select 1 from public.search_opportunities('solar')) then
    raise exception 'FAIL: search_opportunities did not find the published row';
  end if;
  if not exists (select 1 from public.recommended_opportunities(10, 0, false)) then
    raise exception 'FAIL: recommended_opportunities returned nothing';
  end if;
  if public.my_profile_completion() <= 0 then
    raise exception 'FAIL: profile completion not computed';
  end if;
end $$;

insert into public.saved_searches (user_id, name, query, filters)
values ('00000000-0000-0000-0000-0000000000b1', 'My solar search', 'solar', '{"types":["Learnership"]}'::jsonb);

insert into public.bookmarks (user_id, opportunity_id)
select '00000000-0000-0000-0000-0000000000b1', id from public.opportunities where external_reference = 'VERIFY-1';

insert into public.applications (user_id, opportunity_id, status, applied_at)
select '00000000-0000-0000-0000-0000000000b1', id, 'applied', now()
from public.opportunities where external_reference = 'VERIFY-1';

update public.applications set status = 'interview'
where user_id = '00000000-0000-0000-0000-0000000000b1';

do $$ begin
  if (select count(*) from public.application_status_history
      where user_id = '00000000-0000-0000-0000-0000000000b1') <> 2 then
    raise exception 'FAIL: application status history was not recorded';
  end if;
end $$;

insert into public.opportunity_reports (opportunity_id, user_id, reason, details)
select id, '00000000-0000-0000-0000-0000000000b1', 'incorrect_information', 'verify_setup report'
from public.opportunities where external_reference = 'VERIFY-1';

select public.set_deadline_reminder(
  (select id from public.opportunities where external_reference = 'VERIFY-1'), 7);
select public.record_opportunity_view(
  (select id from public.opportunities where external_reference = 'VERIFY-1'), 'verify_setup');

reset role;
select set_config('request.jwt.claims', '', true);

-- ---- another student cannot read any of it ---------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  if exists (select 1 from public.saved_searches) then
    raise exception 'FAIL: student can read another student''s saved searches';
  end if;
  if exists (select 1 from public.application_status_history) then
    raise exception 'FAIL: student can read another student''s application history';
  end if;
  if exists (select 1 from public.opportunity_reports) then
    raise exception 'FAIL: student can read another student''s reports';
  end if;
  if exists (select 1 from public.deadline_reminders) then
    raise exception 'FAIL: student can read another student''s reminders';
  end if;
end $$;
reset role;
select set_config('request.jwt.claims', '', true);

-- ---- reminder job creates a deadline notification --------------------
do $$ declare n int;
begin
  n := public.dispatch_deadline_reminders(100);
  if n < 1 then raise exception 'FAIL: reminder job created no notifications'; end if;
  if not exists (select 1 from public.notifications
                 where user_id = '00000000-0000-0000-0000-0000000000b1'
                   and type = 'deadline_reminder') then
    raise exception 'FAIL: deadline notification missing';
  end if;
end $$;

-- ---- admins resolve reports, verify companies and read analytics -----
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
set local role authenticated;
do $$ declare v jsonb;
begin
  perform public.review_report(
    (select id from public.opportunity_reports where details = 'verify_setup report'),
    'resolved', 'verified');
  v := public.admin_analytics();
  if (v ->> 'opportunities_published')::int < 1 then
    raise exception 'FAIL: admin analytics did not count published opportunities';
  end if;
  perform public.opportunity_quality_report();
end $$;
reset role;
select set_config('request.jwt.claims', '', true);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  perform public.verify_organization(
    (select id from public.organizations where name = 'Test Agri Co'), true);
  if not (select is_verified from public.organizations where name = 'Test Agri Co') then
    raise exception 'FAIL: content admin could not verify an organisation';
  end if;
end $$;
reset role;
select set_config('request.jwt.claims', '', true);

-- ---- new tables have RLS enabled -------------------------------------
do $$ declare missing text; begin
  select string_agg(t, ', ') into missing
  from unnest(array['saved_searches','opportunity_reports',
                    'application_status_history','deadline_reminders']) t
  where not exists (select 1 from pg_class c
                    join pg_namespace n on n.oid = c.relnamespace
                    where n.nspname = 'public' and c.relname = t and c.relrowsecurity);
  if missing is not null then raise exception 'FAIL: RLS not enabled on: %', missing; end if;
end $$;

-- ---- realtime publication -------------------------------------------
do $$ declare missing text; begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    select string_agg(t, ', ') into missing
    from unnest(array['opportunities','notifications','applications','organizations']) t
    where not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t);
    if missing is not null then raise exception 'FAIL: not in realtime publication: %', missing; end if;
  end if;
end $$;

select 'ALL CHECKS PASSED' as result;
rollback;
