-- =====================================================================
-- 007_realtime.sql
-- Supabase Realtime
--
-- WHY THE SITE DID NOT UPDATE: a table only streams changes if it is a
-- member of the "supabase_realtime" publication. Without this the
-- frontend subscription connects successfully but never receives an event.
--
-- REPLICA IDENTITY FULL makes UPDATE/DELETE events carry the complete old
-- row, which Realtime needs to evaluate RLS and to deliver deletes.
-- Realtime applies each subscriber's RLS policies, so users only receive
-- rows they are allowed to read.
-- =====================================================================

do $$
declare
  t text;
  tables text[] := array['opportunities', 'notifications', 'applications', 'organizations', 'categories'];
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'Publication supabase_realtime not found (not running on Supabase?). Skipping realtime setup.';
    return;
  end if;

  foreach t in array tables loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;

    execute format('alter table public.%I replica identity full', t);
  end loop;
end $$;
