-- Removes everything created by demo_data.sql (and nothing else).
begin;

delete from public.notifications
 where opportunity_id in (select id from public.opportunities where external_reference like 'DEMO-%');

delete from public.opportunities where external_reference like 'DEMO-%';

-- cascades to the demo companies' api_logs / api_submissions / members / keys
delete from public.organizations where name like '[DEMO]%';

delete from public.admin_logs where details ->> 'title' like '[DEMO]%';

commit;
