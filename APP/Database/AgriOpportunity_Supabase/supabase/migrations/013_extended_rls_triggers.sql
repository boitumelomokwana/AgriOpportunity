-- =====================================================================
-- 013_extended_rls_triggers.sql
-- Row Level Security, triggers and realtime for the new tables.
-- =====================================================================

alter table public.saved_searches            enable row level security;
alter table public.opportunity_reports       enable row level security;
alter table public.application_status_history enable row level security;
alter table public.deadline_reminders        enable row level security;

revoke all on public.opportunity_reports        from anon;
revoke all on public.application_status_history from anon;
revoke all on public.saved_searches             from anon;
revoke all on public.deadline_reminders         from anon;

-- ---------------------------------------------------------------------
-- saved_searches : strictly private
-- ---------------------------------------------------------------------
drop policy if exists "saved_searches_own" on public.saved_searches;
create policy "saved_searches_own" on public.saved_searches
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- deadline_reminders : private, only for open published opportunities
-- ---------------------------------------------------------------------
drop policy if exists "deadline_reminders_select_own" on public.deadline_reminders;
drop policy if exists "deadline_reminders_insert_own"  on public.deadline_reminders;
drop policy if exists "deadline_reminders_update_own"  on public.deadline_reminders;
drop policy if exists "deadline_reminders_delete_own"  on public.deadline_reminders;

create policy "deadline_reminders_select_own" on public.deadline_reminders
  for select to authenticated using (auth.uid() = user_id);
create policy "deadline_reminders_insert_own" on public.deadline_reminders
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.opportunities o
                where o.id = opportunity_id and o.status = 'published')
  );
create policy "deadline_reminders_update_own" on public.deadline_reminders
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "deadline_reminders_delete_own" on public.deadline_reminders
  for delete to authenticated using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- opportunity_reports : student writes own, admins review
-- ---------------------------------------------------------------------
drop policy if exists "opportunity_reports_insert_own" on public.opportunity_reports;
drop policy if exists "opportunity_reports_select"     on public.opportunity_reports;
drop policy if exists "opportunity_reports_review"     on public.opportunity_reports;
drop policy if exists "opportunity_reports_delete"     on public.opportunity_reports;

create policy "opportunity_reports_insert_own" on public.opportunity_reports
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and status = 'open'
    and resolved_by is null
    and exists (select 1 from public.opportunities o
                where o.id = opportunity_id and o.status = 'published')
  );
create policy "opportunity_reports_select" on public.opportunity_reports
  for select to authenticated
  using (auth.uid() = user_id or public.can_review_opportunities());
create policy "opportunity_reports_review" on public.opportunity_reports
  for update to authenticated
  using (public.can_review_opportunities())
  with check (public.can_review_opportunities());
create policy "opportunity_reports_delete" on public.opportunity_reports
  for delete to authenticated using (public.is_super_admin());

-- ---------------------------------------------------------------------
-- application_status_history : read own timeline, written by trigger only
-- ---------------------------------------------------------------------
drop policy if exists "application_history_select" on public.application_status_history;
create policy "application_history_select" on public.application_status_history
  for select to authenticated
  using (auth.uid() = user_id or public.is_admin());

revoke insert, update, delete on public.application_status_history from authenticated;

-- ---------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------
create or replace function public.opportunities_search_vector()
returns trigger
language plpgsql
as $$
begin
  new.search_vector := to_tsvector(
    'english'::regconfig,
    coalesce(new.title, '') || ' ' ||
    coalesce(new.provider, '') || ' ' ||
    coalesce(new.description, '') || ' ' ||
    coalesce(new.category, '') || ' ' ||
    coalesce(new.opportunity_type, '') || ' ' ||
    coalesce(new.province, '') || ' ' ||
    coalesce(new.location, '') || ' ' ||
    coalesce(new.qualification, '') || ' ' ||
    coalesce(new.eligibility_criteria, '')
  );
  return new;
end;
$$;

drop trigger if exists opportunities_search_vector on public.opportunities;
create trigger opportunities_search_vector
  before insert or update on public.opportunities
  for each row execute function public.opportunities_search_vector();

create or replace function public.applications_record_status()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.application_status_history
      (application_id, user_id, from_status, to_status, changed_by)
    values (new.id, new.user_id, null, new.status, auth.uid());
  elsif new.status is distinct from old.status then
    insert into public.application_status_history
      (application_id, user_id, from_status, to_status, changed_by)
    values (new.id, new.user_id, old.status, new.status, auth.uid());
  end if;
  return null;
end;
$$;

drop trigger if exists applications_history on public.applications;
create trigger applications_history
  after insert or update of status on public.applications
  for each row execute function public.applications_record_status();

create or replace function public.profiles_track_completion()
returns trigger
language plpgsql
as $$
begin
  if public.profile_completion(new) = 100
     and new.profile_completed_at is null then
    new.profile_completed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_track_completion on public.profiles;
create trigger profiles_track_completion
  before update on public.profiles
  for each row execute function public.profiles_track_completion();

drop trigger if exists saved_searches_updated_at on public.saved_searches;
create trigger saved_searches_updated_at
  before update on public.saved_searches
  for each row execute function public.set_updated_at();

drop trigger if exists opportunity_reports_updated_at on public.opportunity_reports;
create trigger opportunity_reports_updated_at
  before update on public.opportunity_reports
  for each row execute function public.set_updated_at();

-- Keep the search index useful when an existing row is edited through SQL
-- that bypasses the generated column? (generated columns always update.)

-- ---------------------------------------------------------------------
-- Realtime: new tables that the UI subscribes to
-- ---------------------------------------------------------------------
do $$
declare
  t text;
  tables text[] := array['opportunity_reports'];
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'Publication supabase_realtime not found. Skipping realtime additions.';
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
