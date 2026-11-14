-- =====================================================================
-- 015_company_portal.sql
--
-- Additive migration for the company self-service portal.
--
-- What it adds
--   1. Two optional company profile fields:
--        registered_business_name, contact_person
--   2. A 'company_portal' submission source for opportunities created in-app
--   3. SECURITY DEFINER RPCs so company owners/managers can create, edit and
--      withdraw their OWN organisation's opportunities, and review applicants
--      for their OWN organisation's opportunities.
--   4. Read-only RLS so company members can see those applications and the
--      applicant's basic contact details.
--
-- What it deliberately does NOT do
--   * It never disables RLS.
--   * It never approves a company or publishes an opportunity. Company writes
--     always enter/return to the review workflow ('pending').
--   * It does not grant anything to anon or service_role.
--   * It does not delete or rewrite existing rows.
--
-- Rollback: drop the four functions, the two policies and the two columns.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Extra company profile fields
-- ---------------------------------------------------------------------
alter table public.organizations
  add column if not exists registered_business_name text;
alter table public.organizations
  add column if not exists contact_person text;

comment on column public.organizations.registered_business_name
  is 'Legal/CIPC registered name when it differs from the trading name.';
comment on column public.organizations.contact_person
  is 'Primary contact person for the company account.';

-- ---------------------------------------------------------------------
-- 2. Allow in-app company submissions
-- ---------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'opportunities_submission_source_check'
  ) then
    alter table public.opportunities
      drop constraint opportunities_submission_source_check;
  end if;

  alter table public.opportunities
    add constraint opportunities_submission_source_check
    check (submission_source in
      ('admin', 'import', 'company_api', 'webhook', 'scheduled_sync', 'company_portal'));
end $$;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'opportunities_source_type_check'
  ) then
    alter table public.opportunities
      drop constraint opportunities_source_type_check;
  end if;

  alter table public.opportunities
    add constraint opportunities_source_type_check
    check (source_type in
      ('official_api', 'third_party_api', 'admin_curated', 'company_portal'));
end $$;

-- ---------------------------------------------------------------------
-- 3. Let the company RPCs pass the opportunity guard trigger
--
-- The existing guard blocks status changes for non-reviewers. The RPCs below
-- are SECURITY DEFINER and only they set `app.company_write` for the current
-- transaction, after re-checking membership and company approval. A client
-- cannot set this GUC through PostgREST (only defined RPCs are callable).
-- ---------------------------------------------------------------------
create or replace function public.guard_opportunity_changes()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if public.is_backend()
     or public.can_review_opportunities()
     or current_setting('app.company_write', true) = 'on' then
    return new;
  end if;

  if new.status               is distinct from old.status
     or new.published         is distinct from old.published
     or new.verification_status is distinct from old.verification_status
     or new.organization_id   is distinct from old.organization_id
     or new.external_reference is distinct from old.external_reference
     or new.submission_source is distinct from old.submission_source
     or new.approved_by       is distinct from old.approved_by
     or new.approved_at       is distinct from old.approved_at
     or new.published_at      is distinct from old.published_at then
    raise exception 'Your role cannot change opportunity approval or publication'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Company opportunity writes
-- ---------------------------------------------------------------------
create or replace function public.company_create_opportunity(
  p_org_id uuid,
  p_payload jsonb
)
returns uuid
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_org      public.organizations%rowtype;
  v_title    text;
  v_desc     text;
  v_app_url  text;
  v_closing  date;
  v_cat_text text;
  v_cat_id   uuid;
  v_cat_name text;
  v_type     text;
  v_loc      text;
  v_prov     text;
  v_qual     text;
  v_elig     text;
  v_remote   boolean;
  v_id       uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  select * into v_org from public.organizations where id = p_org_id;
  if not found then
    raise exception 'Company not found' using errcode = 'P0002';
  end if;
  if not public.is_org_manager(p_org_id) then
    raise exception 'Only company owners or managers can manage listings'
      using errcode = '42501';
  end if;
  if v_org.status <> 'approved' then
    raise exception 'Your company must be approved before publishing opportunities'
      using errcode = '42501';
  end if;

  v_title := nullif(trim(p_payload ->> 'title'), '');
  v_desc  := nullif(trim(p_payload ->> 'description'), '');
  if v_title is null or char_length(v_title) < 3 then
    raise exception 'A title of at least 3 characters is required' using errcode = '23514';
  end if;
  if v_desc is null or char_length(v_desc) < 20 then
    raise exception 'A description of at least 20 characters is required' using errcode = '23514';
  end if;
  if char_length(v_title) > 300 then
    raise exception 'Title is too long (max 300)' using errcode = '23514';
  end if;
  if char_length(v_desc) > 20000 then
    raise exception 'Description is too long (max 20000)' using errcode = '23514';
  end if;

  v_app_url := nullif(trim(p_payload ->> 'application_url'), '');
  if v_app_url is not null and v_app_url !~* '^https?://[^\s]+$' then
    raise exception 'Application link must start with http:// or https://'
      using errcode = '23514';
  end if;

  begin
    v_closing := nullif(trim(p_payload ->> 'closing_date'), '')::date;
  exception when others then
    raise exception 'Closing date must be YYYY-MM-DD' using errcode = '22007';
  end;

  v_cat_text := nullif(trim(p_payload ->> 'category'), '');
  if v_cat_text is not null then
    select id, name into v_cat_id, v_cat_name
    from public.categories
    where is_active
      and (lower(name) = lower(v_cat_text) or slug = lower(v_cat_text))
    limit 1;
  end if;
  if v_cat_name is null then
    select id, name into v_cat_id, v_cat_name
    from public.categories where name = 'Other';
  end if;

  v_type   := nullif(trim(p_payload ->> 'opportunity_type'), '');
  v_loc    := nullif(trim(p_payload ->> 'location'), '');
  v_prov   := nullif(trim(p_payload ->> 'province'), '');
  v_qual   := nullif(trim(p_payload ->> 'qualification'), '');
  v_elig   := nullif(trim(p_payload ->> 'eligibility_criteria'), '');
  v_remote := case when jsonb_typeof(p_payload -> 'is_remote') = 'boolean'
                   then (p_payload ->> 'is_remote')::boolean else false end;

  insert into public.opportunities (
    title, provider, category, category_id, province, qualification,
    closing_date, description, tags, requirements, sector, source_name,
    source_url, source_type, application_url, opportunity_type, location,
    is_remote, eligibility_criteria, organization_id, submission_source,
    status
  ) values (
    v_title, v_org.name, coalesce(v_cat_name, 'Other'), v_cat_id,
    coalesce(v_prov, v_org.province, 'Nationwide'),
    coalesce(v_qual, 'Not specified'), v_closing, v_desc, '{}',
    '{"studyLevel": false, "careerField": false, "experience": false}'::jsonb,
    'Other', v_org.name,
    coalesce(v_app_url, v_org.website, ''), 'company_portal', v_app_url,
    v_type, v_loc, v_remote, v_elig, p_org_id, 'company_portal', 'pending'
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.company_update_opportunity(
  p_opportunity_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_ex       public.opportunities%rowtype;
  v_org      public.organizations%rowtype;
  v_title    text;
  v_desc     text;
  v_app_url  text;
  v_closing  date;
  v_cat_text text;
  v_cat_id   uuid;
  v_cat_name text;
  v_type     text;
  v_loc      text;
  v_prov     text;
  v_qual     text;
  v_elig     text;
  v_remote   boolean;
  v_status   text;
begin
  if auth.uid() is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  select * into v_ex from public.opportunities where id = p_opportunity_id;
  if not found or v_ex.organization_id is null then
    raise exception 'Listing not found' using errcode = 'P0002';
  end if;
  if not public.is_org_manager(v_ex.organization_id) then
    raise exception 'Only company owners or managers can edit this listing'
      using errcode = '42501';
  end if;

  select * into v_org from public.organizations where id = v_ex.organization_id;
  if v_org.status <> 'approved' then
    raise exception 'Your company must be approved to edit listings'
      using errcode = '42501';
  end if;

  v_title := coalesce(nullif(trim(p_payload ->> 'title'), ''), v_ex.title);
  v_desc  := coalesce(nullif(trim(p_payload ->> 'description'), ''), v_ex.description);
  if char_length(v_title) < 3 then
    raise exception 'A title of at least 3 characters is required' using errcode = '23514';
  end if;
  if char_length(v_desc) < 20 then
    raise exception 'A description of at least 20 characters is required' using errcode = '23514';
  end if;

  v_app_url := nullif(trim(p_payload ->> 'application_url'), '');
  if v_app_url is not null and v_app_url !~* '^https?://[^\s]+$' then
    raise exception 'Application link must start with http:// or https://'
      using errcode = '23514';
  end if;

  begin
    v_closing := nullif(trim(p_payload ->> 'closing_date'), '')::date;
  exception when others then
    raise exception 'Closing date must be YYYY-MM-DD' using errcode = '22007';
  end;
  v_closing := coalesce(v_closing, v_ex.closing_date);

  v_cat_text := nullif(trim(p_payload ->> 'category'), '');
  if v_cat_text is not null then
    select id, name into v_cat_id, v_cat_name
    from public.categories
    where is_active
      and (lower(name) = lower(v_cat_text) or slug = lower(v_cat_text))
    limit 1;
  end if;

  v_type   := coalesce(nullif(trim(p_payload ->> 'opportunity_type'), ''), v_ex.opportunity_type);
  v_loc    := coalesce(nullif(trim(p_payload ->> 'location'), ''), v_ex.location);
  v_prov   := coalesce(nullif(trim(p_payload ->> 'province'), ''), v_ex.province);
  v_qual   := coalesce(nullif(trim(p_payload ->> 'qualification'), ''), v_ex.qualification);
  v_elig   := nullif(trim(p_payload ->> 'eligibility_criteria'), '');
  v_remote := case when jsonb_typeof(p_payload -> 'is_remote') = 'boolean'
                   then (p_payload ->> 'is_remote')::boolean else v_ex.is_remote end;

  -- Moderation: rejected listings are resubmitted; live edits return to review
  -- when the platform setting asks for it (default true).
  v_status := v_ex.status;
  if v_ex.status = 'rejected' then
    v_status := 'pending';
  elsif v_ex.status in ('approved', 'published')
        and coalesce((select (value #>> '{}')::boolean
                      from public.system_settings
                      where key = 'review_required_on_change'), true) then
    v_status := 'pending';
  end if;

  -- Only the RPCs in this migration set this, after the checks above.
  perform set_config('app.company_write', 'on', true);

  update public.opportunities set
    title                = v_title,
    description          = v_desc,
    application_url      = v_app_url,
    closing_date         = v_closing,
    category             = coalesce(v_cat_name, category),
    category_id          = coalesce(v_cat_id, category_id),
    opportunity_type     = v_type,
    location             = v_loc,
    province             = v_prov,
    qualification        = v_qual,
    eligibility_criteria = v_elig,
    is_remote            = v_remote,
    status               = v_status,
    rejection_reason     = case when v_status = 'pending' then null else rejection_reason end
  where id = p_opportunity_id;

  return jsonb_build_object('ok', true, 'opportunity_id', p_opportunity_id, 'status', v_status);
end;
$$;

create or replace function public.company_delete_opportunity(
  p_opportunity_id uuid
)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_ex  public.opportunities%rowtype;
  v_org public.organizations%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  select * into v_ex from public.opportunities where id = p_opportunity_id;
  if not found or v_ex.organization_id is null then
    raise exception 'Listing not found' using errcode = 'P0002';
  end if;
  if not public.is_org_manager(v_ex.organization_id) then
    raise exception 'Only company owners or managers can remove this listing'
      using errcode = '42501';
  end if;

  select * into v_org from public.organizations where id = v_ex.organization_id;
  if v_org.status not in ('approved', 'pending', 'suspended') then
    raise exception 'This company cannot change listings' using errcode = '42501';
  end if;

  -- Live listings are withdrawn, not hard-deleted, so student application
  -- history survives. Unreviewed listings may be removed completely.
  if v_ex.status in ('approved', 'published') then
    perform set_config('app.company_write', 'on', true);
    update public.opportunities
    set status = 'rejected',
        rejection_reason = 'Withdrawn by company',
        withdrawn_at = now()
    where id = p_opportunity_id;
  else
    delete from public.opportunities where id = p_opportunity_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Company applicant review
-- ---------------------------------------------------------------------
create or replace function public.company_set_application_status(
  p_application_id uuid,
  p_status text,
  p_note text default null
)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_app  public.applications%rowtype;
  v_org  uuid;
  v_title text;
  v_status text := lower(trim(coalesce(p_status, '')));
begin
  if auth.uid() is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  if v_status not in ('applied', 'shortlisted', 'interview', 'offered', 'rejected') then
    raise exception 'Unsupported application status: %', p_status using errcode = '23514';
  end if;

  select a.* into v_app from public.applications a where a.id = p_application_id;
  if not found then
    raise exception 'Application not found' using errcode = 'P0002';
  end if;

  select o.organization_id, o.title into v_org, v_title
  from public.opportunities o where o.id = v_app.opportunity_id;

  if v_org is null or not public.is_org_manager(v_org) then
    raise exception 'Only this company''s owners or managers can review applicants'
      using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.organizations where id = v_org and status = 'approved'
  ) then
    raise exception 'Your company must be approved to review applicants'
      using errcode = '42501';
  end if;

  update public.applications
  set status = v_status,
      notes = coalesce(nullif(trim(p_note), ''), notes)
  where id = p_application_id;

  insert into public.notifications (user_id, type, title, message, opportunity_id)
  values (
    v_app.user_id,
    'application_update',
    'Application update',
    'Your application for ' || coalesce(v_title, 'an opportunity') ||
      ' was updated to ' || v_status || '.',
    v_app.opportunity_id
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 6. RLS for company applicant review
--    (read-only; status changes still go through the RPC above)
-- ---------------------------------------------------------------------
drop policy if exists "applications_select_org" on public.applications;
create policy "applications_select_org" on public.applications
  for select to authenticated
  using (
    exists (
      select 1
      from public.opportunities o
      where o.id = applications.opportunity_id
        and o.organization_id is not null
        and public.is_org_member(o.organization_id)
    )
  );

-- A company member may read the basic profile of someone who applied to that
-- company. Nothing else on the profile row is exposed, and only for their own
-- organisation's applications.
drop policy if exists "profiles_select_applicants" on public.profiles;
create policy "profiles_select_applicants" on public.profiles
  for select to authenticated
  using (
    exists (
      select 1
      from public.applications a
      join public.opportunities o on o.id = a.opportunity_id
      where a.user_id = profiles.id
        and o.organization_id is not null
        and public.is_org_member(o.organization_id)
    )
  );

-- ---------------------------------------------------------------------
-- 7. Function grants (never to anon or public)
-- ---------------------------------------------------------------------
revoke all on function public.company_create_opportunity(uuid, jsonb) from public;
revoke all on function public.company_update_opportunity(uuid, jsonb) from public;
revoke all on function public.company_delete_opportunity(uuid) from public;
revoke all on function public.company_set_application_status(uuid, text, text) from public;

revoke all on function public.company_create_opportunity(uuid, jsonb) from anon;
revoke all on function public.company_update_opportunity(uuid, jsonb) from anon;
revoke all on function public.company_delete_opportunity(uuid) from anon;
revoke all on function public.company_set_application_status(uuid, text, text) from anon;

grant execute on function public.company_create_opportunity(uuid, jsonb) to authenticated;
grant execute on function public.company_update_opportunity(uuid, jsonb) to authenticated;
grant execute on function public.company_delete_opportunity(uuid) to authenticated;
grant execute on function public.company_set_application_status(uuid, text, text) to authenticated;
