-- =====================================================================
-- demo_data.sql  -  FAKE data for testing only
-- Run AFTER the migrations, in the SQL Editor of a DEV / STAGING project.
--   * Every record is tagged "[DEMO]" / external_reference 'DEMO-...'
--   * Safe to re-run (no duplicates)
--   * Remove it all with supabase/seed/remove_demo_data.sql
--   * Student notifications are switched off while loading, so real users
--     are not notified about fake opportunities.
-- =====================================================================
begin;

-- pause notifications, remember the previous value
create temp table _prev_setting as
  select value from public.system_settings where key = 'notifications_enabled';
update public.system_settings set value = 'false'::jsonb where key = 'notifications_enabled';

-- ---- demo companies (approved, with API enabled flag for dashboard counts) ----
insert into public.organizations (name, slug, description, industry, website, contact_email, province, status, api_enabled, integration_method)
values
  ('[DEMO] GreenField Farms',        'demo-greenfield-farms',  'Fictional commercial farm offering placements.',          'Agriculture',   'https://example.com/greenfield',  'demo1@example.com', 'Limpopo',       'approved', true,  'api'),
  ('[DEMO] AgriTech Labs SA',        'demo-agritech-labs',     'Fictional agri-technology company.',                      'Agri-technology','https://example.com/agritech',   'demo2@example.com', 'Gauteng',       'approved', true,  'webhook'),
  ('[DEMO] Harvest Skills Academy',  'demo-harvest-academy',   'Fictional training provider for farming skills.',         'Education',     'https://example.com/harvest',     'demo3@example.com', 'Western Cape',  'approved', false, 'none'),
  ('[DEMO] Rural Futures Fund',      'demo-rural-futures',     'Fictional funder of youth and rural development.',        'Funding',       'https://example.com/ruralfund',   'demo4@example.com', 'Nationwide',    'approved', false, 'none'),
  ('[DEMO] Sunrise Growers (new)',   'demo-sunrise-growers',   'Fictional company waiting for approval.',                 'Agriculture',   'https://example.com/sunrise',     'demo5@example.com', 'KwaZulu-Natal', 'pending',  false, 'none')
on conflict do nothing;

-- ---- demo opportunities (status, days until closing) ----
insert into public.opportunities
  (organization_id, external_reference, title, provider, category, category_id, province, qualification,
   closing_date, description, tags, requirements, sector, source_name, source_url, source_type,
   application_url, opportunity_type, location, is_remote, eligibility_criteria, submission_source, status)
select o.id, v.ref, v.title, o.name, v.category, c.id, v.province, v.qualification,
       current_date + v.days, v.descr, v.tags,
       jsonb_build_object('studyLevel', v.study, 'careerField', v.career, 'experience', v.exp),
       v.sector, o.name, 'https://example.com/demo/' || lower(v.ref), 'official_api',
       'https://example.com/apply/' || lower(v.ref), v.category, v.loc, v.remote, v.elig, v.src, v.status
from (values
  -- published (visible to students)
  ('DEMO-001', '[DEMO] GreenField Farms', '[DEMO] Farm Management Internship',       'Internship',        'Limpopo',       'Diploma in Agriculture',        45,  'Hands-on 12-month internship in crop and livestock management.', array['agriculture','internship','farming'], true,  true,  false, 'Polokwane',    false, 'South African citizen aged 18-35 with an agriculture diploma.', 'company_api', 'published'),
  ('DEMO-002', '[DEMO] AgriTech Labs SA', '[DEMO] Precision Farming Graduate Programme','Graduate Programme','Gauteng',     'BSc Agriculture / Engineering', 60,  '24-month graduate programme working with drones and soil sensors.', array['technology','graduate','drones'],   true,  true,  false, 'Pretoria',     false, 'Recent graduate, degree in a relevant field.',                  'webhook',     'published'),
  ('DEMO-003', '[DEMO] Rural Futures Fund', '[DEMO] Youth Agri-Entrepreneur Grant',  'Grant',             'Nationwide',    'Not specified',                 30,  'Start-up funding for young farmers launching a small agribusiness.', array['funding','entrepreneur','youth'], false, true,  true,      'Remote',  true,  'Youth 18-35 with a simple business plan.',                      'admin',       'published'),
  ('DEMO-004', '[DEMO] Harvest Skills Academy', '[DEMO] Learnership in Horticulture NQF 4','Learnership',   'Western Cape',  'Grade 12',                      21,  'Accredited 12-month learnership with a monthly stipend.',          array['learnership','horticulture','nqf4'], true, false, false, 'Stellenbosch', false, 'Grade 12 certificate.',                                        'admin',       'published'),
  ('DEMO-005', '[DEMO] Rural Futures Fund', '[DEMO] Agricultural Sciences Bursary',   'Bursary',           'Nationwide',    'Matric with Maths',             90,  'Full tuition and accommodation for agricultural science students.', array['bursary','tuition','science'],    true,  true,  false, 'Nationwide',  false, 'Matric with 60%+ in Mathematics and Life Sciences.',           'admin',       'published'),
  ('DEMO-006', '[DEMO] GreenField Farms', '[DEMO] Seasonal Farm Worker (Harvest)',    'Farm Job',          'Limpopo',       'Not specified',                 5,   'Seasonal harvest work, closes very soon.',                          array['seasonal','harvest','job'],         false, false, false, 'Tzaneen',      false, 'Physically fit, 18+.',                                         'company_api', 'published'),
  ('DEMO-007', '[DEMO] Harvest Skills Academy', '[DEMO] Tractor Operator Training',   'Training',          'Free State',    'Not specified',                 40,  'Two-week practical course in safe tractor operation.',             array['training','machinery'],             false, false, false, 'Bloemfontein', false, 'Valid ID, 18+.',                                               'admin',       'published'),
  -- approved (ready to publish) / pending (waiting for review) / rejected
  ('DEMO-008', '[DEMO] AgriTech Labs SA', '[DEMO] Data Analyst WIL Placement',        'WIL',               'Gauteng',       'Diploma in IT / Data',          50,  'Work-integrated learning placement analysing farm data.',          array['wil','data','placement'],           true,  true,  false, 'Johannesburg', false, 'Student needing WIL credits.',                                  'webhook',     'approved'),
  ('DEMO-009', '[DEMO] Rural Futures Fund', '[DEMO] Postgraduate Research Scholarship','Scholarship',     'Nationwide',    'Honours degree',                120, 'Scholarship for postgraduate research in sustainable farming.',    array['scholarship','research'],           true,  true,  false, 'Nationwide',   false, 'Honours degree, academic transcript required.',                'admin',       'pending'),
  ('DEMO-010', '[DEMO] GreenField Farms', '[DEMO] Irrigation Apprenticeship',        'Apprenticeship',    'Mpumalanga',    'Grade 12',                      70,  'Apprenticeship in irrigation installation and maintenance.',       array['apprenticeship','irrigation'],      true,  true,  false, 'Mbombela',     false, 'Grade 12 with Mathematics.',                                    'company_api', 'rejected')
) as v(ref, org, title, category, province, qualification, days, descr, tags, study, career, exp, loc, remote, elig, src, status)
join public.organizations o on o.name = v.org
join public.categories c on c.name = v.category
on conflict (organization_id, external_reference)
  where organization_id is not null and external_reference is not null
  do nothing;

-- a couple of rows for the admin dashboard (API activity + submissions)
insert into public.api_logs (organization_id, method, endpoint, status_code, duration_ms, ip_address)
select o.id, x.m, x.e, x.s, x.d, '203.0.113.10'
from public.organizations o
cross join (values ('POST','/api/company/opportunities',201,120),
                   ('GET', '/api/company/opportunities',200, 45),
                   ('PUT', '/api/company/opportunities/demo',200, 98),
                   ('POST','/api/company/opportunities',429,  8)) as x(m, e, s, d)
where o.name in ('[DEMO] GreenField Farms', '[DEMO] AgriTech Labs SA')
  and not exists (select 1 from public.api_logs l where l.organization_id = o.id);

-- turn notifications back to what they were
update public.system_settings set value = (select value from _prev_setting)
where key = 'notifications_enabled';

select status, count(*) as demo_opportunities
from public.opportunities where external_reference like 'DEMO-%'
group by status order by status;

commit;
