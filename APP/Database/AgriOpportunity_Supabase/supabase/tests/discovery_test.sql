-- =====================================================================
-- discovery_test.sql
-- End-to-end test for migration 014 (discovery subsystem).
-- Everything is rolled back, so it is safe to run repeatedly.
-- =====================================================================
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'super.discovery@test.local',   '{"full_name":"Super Discovery"}'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'content.discovery@test.local', '{"full_name":"Content Discovery"}'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'opps.discovery@test.local',    '{"full_name":"Opps Discovery"}'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'student.discovery@test.local', '{"full_name":"Student Discovery"}');

select public.bootstrap_admin('super.discovery@test.local', 'super_admin');
select public.bootstrap_admin('content.discovery@test.local', 'content_admin');
select public.bootstrap_admin('opps.discovery@test.local', 'opportunity_admin');

-- ---------------------------------------------------------------------
-- Super Admin configures a disabled-by-default source
-- ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';
set local role authenticated;

select (public.upsert_discovery_source(
  null,
  'Test Careers Feed',
  'json',
  'https://example.test/careers.json',
  'https://example.test/terms',
  'Test fixture only',
  false,
  false,
  3600,
  '{"itemPath":"items"}'::jsonb
)).id as source_id \gset

select public.set_discovery_source_enabled(:'source_id'::uuid, true);

do $$
begin
  if not exists (
    select 1 from public.discovery_sources
    where name = 'Test Careers Feed' and is_enabled
  ) then
    raise exception 'source was not created/enabled';
  end if;
end $$;

reset role;

-- ---------------------------------------------------------------------
-- Discovery worker (service role/postgres) stores candidates
-- ---------------------------------------------------------------------
insert into public.discovered_companies (
  source_id, external_id, name, registration_number, description, industry,
  website, contact_email, province, city, careers_url, source_url, raw_data)
values (
  :'source_id'::uuid, 'company-1', 'Test Agri Discovery (Pty) Ltd',
  '2026/123456/07', 'A discovered agricultural company.',
  'Agriculture', 'https://example.test', 'careers@example.test',
  'Gauteng', 'Pretoria', 'https://example.test/careers',
  'https://example.test/company', '{"fixture":true}'::jsonb)
returning id as company_id \gset

insert into public.discovered_opportunities (
  source_id, discovered_company_id, external_id, title, description, provider,
  category, opportunity_type, location, province, qualification,
  eligibility_criteria, application_url, source_url, closing_date,
  is_remote, tags, requirements, raw_data)
values (
  :'source_id'::uuid, :'company_id'::uuid, 'opportunity-1',
  'Graduate Agronomy Programme 2027',
  'A discovered graduate programme. Do not invent details.',
  'Test Agri Discovery (Pty) Ltd', 'Graduate Programme', 'Graduate Programme',
  'Pretoria', 'Gauteng', 'Degree',
  'South African citizen; agriculture degree.', 'https://example.test/apply',
  'https://example.test/opportunities/1', '2027-03-31', false,
  array['agriculture', 'graduate'], '{}'::jsonb, '{"fixture":true}'::jsonb)
returning id as opportunity_id \gset

-- ---------------------------------------------------------------------
-- Content Admin edits and promotes the company
-- ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}';
set local role authenticated;

select public.update_discovered_company(
  :'company_id'::uuid, '{"city":"Centurion"}'::jsonb);

select public.promote_discovered_company(:'company_id'::uuid);

do $$
begin
  if not exists (
    select 1 from public.organizations
    where name = 'Test Agri Discovery (Pty) Ltd' and status = 'pending'
      and not is_verified and not api_enabled
  ) then
    raise exception 'promoted company must exist as pending and unverified';
  end if;
  if (select status from public.discovered_companies
      where name = 'Test Agri Discovery (Pty) Ltd') <> 'imported' then
    raise exception 'discovered company was not marked imported';
  end if;
end $$;

reset role;

-- ---------------------------------------------------------------------
-- Opportunity Admin promotes the opportunity
-- ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}';
set local role authenticated;

select public.promote_discovered_opportunity(:'opportunity_id'::uuid);

do $$
begin
  if not exists (
    select 1 from public.opportunities
    where title = 'Graduate Agronomy Programme 2027'
      and status = 'pending' and not published
      and verification_status = 'pending'
      and submission_source = 'import'
  ) then
    raise exception 'discovered opportunity must import as pending and unpublished';
  end if;
  if (select status from public.discovered_opportunities
      where title = 'Graduate Agronomy Programme 2027') <> 'imported' then
    raise exception 'discovered opportunity was not marked imported';
  end if;
end $$;

-- Re-running promotion must be idempotent.
select public.promote_discovered_opportunity(:'opportunity_id'::uuid);

do $$
begin
  if (select count(*) from public.opportunities
      where title = 'Graduate Agronomy Programme 2027') <> 1 then
    raise exception 'promotion created a duplicate opportunity';
  end if;
end $$;

-- Statistics are real and admin-only.
do $$
begin
  if (public.discovery_admin_stats() ->> 'companies_total')::int < 1 then
    raise exception 'discovery stats did not count companies';
  end if;
end $$;

reset role;

-- ---------------------------------------------------------------------
-- Students cannot read or write discovery data
-- ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","role":"authenticated"}';
set local role authenticated;

do $$
begin
  if exists (select 1 from public.discovery_sources) then
    raise exception 'student can read discovery sources';
  end if;
  if exists (select 1 from public.discovered_opportunities) then
    raise exception 'student can read discovered opportunities';
  end if;

  begin
    insert into public.discovery_sources (name, slug, base_url)
    values ('Unauthorised', 'unauthorised', 'https://example.test');
    raise exception 'student inserted a discovery source';
  exception when insufficient_privilege then
    null;
  end;

  begin
    perform public.discovery_admin_stats();
    raise exception 'student received discovery statistics';
  exception when insufficient_privilege then
    null;
  end;
end $$;

reset role;

-- ---------------------------------------------------------------------
-- Rejection and change history
-- ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}';
set local role authenticated;

select public.reject_discovered_opportunity(:'opportunity_id'::uuid, 'Not relevant');

do $$
begin
  if (select status from public.discovered_opportunities
      where external_id = 'opportunity-1') <> 'rejected' then
    raise exception 'discovered opportunity was not rejected';
  end if;
  if (select status from public.opportunities
      where title = 'Graduate Agronomy Programme 2027') <> 'rejected' then
    raise exception 'pending imported opportunity should follow a rejection';
  end if;
  if not exists (select 1 from public.discovery_changes
                 where entity_type = 'company'
                   and change_type = 'updated') then
    raise exception 'discovery change history was not recorded';
  end if;
end $$;

reset role;

do $$
begin
  if not exists (select 1 from public.admin_logs
                 where action = 'discovery.opportunity_imported') then
    raise exception 'discovery import was not audited';
  end if;
end $$;

\echo 'ALL DISCOVERY CHECKS PASSED'
rollback;
