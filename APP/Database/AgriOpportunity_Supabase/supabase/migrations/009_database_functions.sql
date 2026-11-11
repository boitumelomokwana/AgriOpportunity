-- =====================================================================
-- 009_database_functions.sql
-- All business logic and trigger functions. Triggers are attached in 010.
--
-- Execution rules (set at the bottom of this file):
--   * backend-only functions  -> service_role only
--   * admin RPCs              -> authenticated (each one checks the role itself)
-- =====================================================================

-- ---------------------------------------------------------------------
-- Generic
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Create a profile row when someone registers
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Guard triggers (defence in depth on top of RLS)
-- ---------------------------------------------------------------------

-- Only a Super Admin / the backend may suspend a user
create or replace function public.guard_profile_changes()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.is_suspended is distinct from old.is_suspended
     and not (public.is_backend() or public.is_super_admin()) then
    raise exception 'Only a Super Admin can suspend or reactivate users'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Company owners can edit their own details but never their approval / API status
create or replace function public.guard_organization_changes()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if not (public.is_backend() or public.is_super_admin()) then
    if new.status            is distinct from old.status
       or new.api_enabled    is distinct from old.api_enabled
       or new.integration_method is distinct from old.integration_method
       or new.suspended_reason is distinct from old.suspended_reason
       or new.approved_by    is distinct from old.approved_by
       or new.approved_at    is distinct from old.approved_at
       or new.created_by     is distinct from old.created_by then
      raise exception 'Only a Super Admin can change company approval or API settings'
        using errcode = '42501';
    end if;
  end if;

  -- stamp approval details
  if new.status = 'approved' and old.status is distinct from 'approved' then
    new.approved_at := now();
    new.approved_by := coalesce(auth.uid(), new.approved_by);
  end if;
  return new;
end;
$$;

-- The creator of a company automatically becomes its owner
create or replace function public.add_organization_owner()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.created_by is not null then
    insert into public.organization_members (organization_id, user_id, role)
    values (new.id, new.created_by, 'owner')
    on conflict (organization_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

-- Never leave the platform without an active Super Admin
create or replace function public.prevent_last_super_admin_removal()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if old.role = 'super_admin' and old.is_active
     and (tg_op = 'DELETE' or new.role <> 'super_admin' or not new.is_active) then
    if not exists (
      select 1 from public.admin_roles
      where role = 'super_admin' and is_active and user_id <> old.user_id
    ) then
      raise exception 'Cannot remove or suspend the last active Super Admin'
        using errcode = '23514';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Opportunities: guard, status sync, audit, notifications
-- ---------------------------------------------------------------------

-- Only Super Admin / Opportunity Admin / backend may touch workflow fields.
-- (Content Admin may edit wording of published opportunities, nothing more.)
create or replace function public.guard_opportunity_changes()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if public.is_backend() or public.can_review_opportunities() then
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

-- Keeps the new "status" column and the legacy columns (published,
-- verification_status) consistent in BOTH directions, so the current
-- frontend and admin API keep working unchanged.
create or replace function public.sync_opportunity_status()
returns trigger
language plpgsql
as $$
declare
  v_legacy text;
begin
  v_legacy := case
    when new.published and new.verification_status in ('approved', 'verified') then 'published'
    when new.verification_status in ('approved', 'verified')                   then 'approved'
    when new.verification_status = 'rejected'                                  then 'rejected'
    else 'pending'
  end;

  if tg_op = 'INSERT' then
    -- legacy-style insert (status left at default but legacy columns set)
    if new.status = 'pending' and v_legacy <> 'pending' then
      new.status := v_legacy;
    end if;
  elsif new.status is distinct from old.status then
    null; -- status was changed explicitly: it wins
  elsif new.published is distinct from old.published
        or new.verification_status is distinct from old.verification_status then
    new.status := v_legacy; -- legacy columns were changed (old admin API)
  end if;

  -- derive legacy columns from status
  new.published := (new.status = 'published');
  new.verification_status := case new.status
    when 'published' then 'verified'
    else new.status            -- pending / approved / rejected
  end;

  -- timestamps
  if new.status = 'published'
     and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    new.published_at := now();
  end if;
  if new.status in ('approved', 'published')
     and (tg_op = 'INSERT' or old.status not in ('approved', 'published')) then
    new.approved_at := coalesce(new.approved_at, now());
    new.approved_by := coalesce(new.approved_by, auth.uid());
  end if;
  return new;
end;
$$;

-- Audit trail for status changes
create or replace function public.audit_opportunity_status()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.admin_logs (admin_id, actor_type, action, entity_type, entity_id, details)
    values (
      auth.uid(),
      case when auth.uid() is null then 'system' else 'admin' end,
      'opportunity.status_changed',
      'opportunity',
      new.id::text,
      jsonb_build_object(
        'title', new.title,
        'from', case when tg_op = 'INSERT' then null else old.status end,
        'to', new.status,
        'source', new.submission_source,
        'organization_id', new.organization_id
      )
    );
  end if;
  return null;
end;
$$;

-- When an opportunity becomes published, notify matching students.
-- Match = student's interests (profile list or user_interests) equal the
-- opportunity's category or type, and province is compatible.
create or replace function public.notify_students_on_publish()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.status <> 'published' then return null; end if;
  if tg_op = 'UPDATE' and old.status = 'published' then return null; end if;

  if coalesce((select (value #>> '{}')::boolean from public.system_settings
               where key = 'notifications_enabled'), true) is not true then
    return null;
  end if;

  insert into public.notifications (user_id, type, title, message, opportunity_id)
  select p.id,
         'new_opportunity',
         'New ' || coalesce(new.category, 'opportunity') || ': ' || new.title,
         coalesce(new.provider, '') ||
           case when new.closing_date is not null
                then ' - closes ' || to_char(new.closing_date, 'DD Mon YYYY') else '' end,
         new.id
  from public.profiles p
  where not p.is_suspended
    and (
      new.province is null
      or lower(new.province) in ('nationwide', '')
      or p.province is null
      or lower(p.province) = lower(new.province)
    )
    and (
      exists (
        select 1 from unnest(p.interests) as i
        where lower(trim(i)) in (lower(coalesce(new.category, '')),
                                 lower(coalesce(new.opportunity_type, '')))
      )
      or exists (
        select 1 from public.user_interests ui
        where ui.user_id = p.id
          and lower(ui.interest) in (lower(coalesce(new.category, '')),
                                     lower(coalesce(new.opportunity_type, '')))
      )
    );
  return null;
end;
$$;

-- ---------------------------------------------------------------------
-- Admin RPCs (callable by signed-in users, each verifies the role itself)
-- ---------------------------------------------------------------------

create or replace function public.log_admin_action(
  p_action text, p_entity_type text default null,
  p_entity_id text default null, p_details jsonb default '{}'::jsonb)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrators only' using errcode = '42501';
  end if;
  insert into public.admin_logs (admin_id, actor_type, action, entity_type, entity_id, details)
  values (auth.uid(), 'admin', p_action, p_entity_type, p_entity_id, coalesce(p_details, '{}'::jsonb));
end;
$$;

-- Approve / reject / publish / unpublish with the correct transition rules
create or replace function public.review_opportunity(
  p_id uuid, p_action text, p_reason text default null)
returns public.opportunities
language plpgsql security definer
set search_path = public
as $$
declare
  v_row public.opportunities;
  v_new text;
begin
  if not public.can_review_opportunities() then
    raise exception 'Only Super Admin or Opportunity Admin can review opportunities'
      using errcode = '42501';
  end if;

  select * into v_row from public.opportunities where id = p_id for update;
  if not found then raise exception 'Opportunity not found' using errcode = 'P0002'; end if;

  if p_action = 'approve' then
    if v_row.status <> 'pending' then raise exception 'Only pending opportunities can be approved'; end if;
    v_new := 'approved';
  elsif p_action = 'reject' then
    if v_row.status = 'rejected' then raise exception 'Already rejected'; end if;
    v_new := 'rejected';
  elsif p_action = 'publish' then
    if v_row.status <> 'approved' then raise exception 'Only approved opportunities can be published'; end if;
    v_new := 'published';
  elsif p_action = 'unpublish' then
    if v_row.status <> 'published' then raise exception 'Only published opportunities can be unpublished'; end if;
    v_new := 'approved';
  else
    raise exception 'Invalid action: %', p_action;
  end if;

  update public.opportunities
  set status = v_new,
      rejection_reason = case when v_new = 'rejected' then p_reason else null end,
      approved_by = case when v_new in ('approved', 'published') then auth.uid() else approved_by end
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$$;

-- Super Admin: create or change an administrator (user must already exist in Auth)
create or replace function public.assign_admin_role(
  p_user_id uuid, p_role text, p_is_active boolean default true)
returns public.admin_roles
language plpgsql security definer
set search_path = public
as $$
declare
  v_row public.admin_roles;
begin
  if not public.is_super_admin() then
    raise exception 'Only a Super Admin can manage administrators' using errcode = '42501';
  end if;
  if p_role not in ('super_admin', 'opportunity_admin', 'content_admin') then
    raise exception 'Invalid role: %', p_role;
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'User not found';
  end if;

  insert into public.admin_roles (user_id, role, is_active, created_by)
  values (p_user_id, p_role, p_is_active, auth.uid())
  on conflict (user_id) do update
    set role = excluded.role, is_active = excluded.is_active
  returning * into v_row;

  insert into public.admin_logs (admin_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'admin.role_assigned', 'admin_role', p_user_id::text,
          jsonb_build_object('role', p_role, 'is_active', p_is_active));
  return v_row;
end;
$$;

-- Super Admin: generate credentials. The plaintext key is returned ONCE.
create or replace function public.generate_company_api_key(
  p_org_id uuid, p_name text default 'Default key',
  p_scopes text[] default array['opportunities:read', 'opportunities:write'],
  p_expires_at timestamptz default null)
returns jsonb
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_prefix text;
  v_key text;
  v_id uuid;
begin
  if not public.is_super_admin() then
    raise exception 'Only a Super Admin can generate API credentials' using errcode = '42501';
  end if;
  if not exists (select 1 from public.organizations where id = p_org_id and status = 'approved') then
    raise exception 'The company must be approved before API credentials can be issued';
  end if;

  v_prefix := 'agri_' || encode(gen_random_bytes(4), 'hex');
  v_key    := v_prefix || '_' || encode(gen_random_bytes(24), 'hex');

  insert into public.company_api_keys
    (organization_id, name, key_prefix, key_hash, scopes, expires_at, created_by)
  values
    (p_org_id, coalesce(nullif(trim(p_name), ''), 'Default key'), v_prefix,
     encode(digest(v_key, 'sha256'), 'hex'), p_scopes, p_expires_at, auth.uid())
  returning id into v_id;

  update public.organizations set api_enabled = true,
         integration_method = case when integration_method = 'none' then 'api' else integration_method end
  where id = p_org_id;

  insert into public.admin_logs (admin_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'api_key.generated', 'organization', p_org_id::text,
          jsonb_build_object('key_id', v_id, 'key_prefix', v_prefix));

  return jsonb_build_object('key_id', v_id, 'key_prefix', v_prefix, 'api_key', v_key,
                            'note', 'Store this key now. It cannot be shown again.');
end;
$$;

create or replace function public.revoke_company_api_key(p_key_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  if not public.is_super_admin() then
    raise exception 'Only a Super Admin can revoke API credentials' using errcode = '42501';
  end if;

  update public.company_api_keys
  set status = 'revoked', revoked_at = now(), revoked_by = auth.uid()
  where id = p_key_id and status = 'active'
  returning organization_id into v_org;

  if v_org is null then raise exception 'Active key not found'; end if;

  update public.organizations o set api_enabled = exists (
    select 1 from public.company_api_keys k where k.organization_id = o.id and k.status = 'active'
  ) where o.id = v_org;

  insert into public.admin_logs (admin_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'api_key.revoked', 'organization', v_org::text,
          jsonb_build_object('key_id', p_key_id));
end;
$$;

-- Dashboard counters for the admin overview
create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrators only' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'total_opportunities',     (select count(*) from public.opportunities),
    'pending_opportunities',   (select count(*) from public.opportunities where status = 'pending'),
    'approved_opportunities',  (select count(*) from public.opportunities where status = 'approved'),
    'published_opportunities', (select count(*) from public.opportunities where status = 'published'),
    'rejected_opportunities',  (select count(*) from public.opportunities where status = 'rejected'),
    'registered_students',     (select count(*) from public.profiles p
                                where not exists (select 1 from public.admin_roles a where a.user_id = p.id)),
    'registered_companies',    (select count(*) from public.organizations),
    'approved_companies',      (select count(*) from public.organizations where status = 'approved'),
    'api_connected_companies', (select count(*) from public.organizations o
                                where o.api_enabled
                                  and exists (select 1 from public.company_api_keys k
                                              where k.organization_id = o.id and k.status = 'active')),
    'api_requests_24h',        (select count(*) from public.api_logs where created_at > now() - interval '24 hours'),
    'views_7d',                (select count(*) from public.opportunity_views where viewed_at > now() - interval '7 days')
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Backend-only functions (service role / SQL editor)
-- ---------------------------------------------------------------------

-- Create the FIRST administrator(s). Run from the SQL editor after the user exists in Auth:
--   select public.bootstrap_admin('you@example.com', 'super_admin');
create or replace function public.bootstrap_admin(p_email text, p_role text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_user uuid;
begin
  if p_role not in ('super_admin', 'opportunity_admin', 'content_admin') then
    raise exception 'Invalid role: %', p_role;
  end if;
  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then
    raise exception 'No auth user with email %. Create the user in Supabase Auth first.', p_email;
  end if;

  insert into public.admin_roles (user_id, role, is_active)
  values (v_user, p_role, true)
  on conflict (user_id) do update set role = excluded.role, is_active = true;

  insert into public.admin_logs (actor_type, action, entity_type, entity_id, details)
  values ('system', 'admin.bootstrapped', 'admin_role', v_user::text, jsonb_build_object('role', p_role));
end;
$$;

-- Validate a company key presented in the Authorization header.
-- Returns {key_id, organization_id, scopes} or NULL.
create or replace function public.verify_company_api_key(p_key text)
returns jsonb
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_key public.company_api_keys;
begin
  if p_key is null or char_length(p_key) < 20 or char_length(p_key) > 200 then
    return null;
  end if;
  v_hash := encode(digest(p_key, 'sha256'), 'hex');

  select k.* into v_key
  from public.company_api_keys k
  join public.organizations o on o.id = k.organization_id
  where k.key_hash = v_hash
    and k.status = 'active'
    and (k.expires_at is null or k.expires_at > now())
    and o.status = 'approved'
    and o.api_enabled;

  if not found then return null; end if;

  update public.company_api_keys set last_used_at = now() where id = v_key.id;

  return jsonb_build_object('key_id', v_key.id, 'organization_id', v_key.organization_id,
                            'scopes', to_jsonb(v_key.scopes));
end;
$$;

-- Fixed-window rate limiter. Returns {allowed, limit, remaining, reset_at}.
create or replace function public.check_api_rate_limit(
  p_key_id uuid, p_limit integer default null, p_window_seconds integer default 60)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_limit integer;
  v_window timestamptz;
  v_count integer;
begin
  v_limit := coalesce(
    p_limit,
    (select (value #>> '{}')::integer from public.system_settings where key = 'api_rate_limit_per_minute'),
    60);
  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.api_rate_limits (api_key_id, window_start, request_count)
  values (p_key_id, v_window, 1)
  on conflict (api_key_id, window_start)
  do update set request_count = public.api_rate_limits.request_count + 1
  returning request_count into v_count;

  if random() < 0.01 then
    delete from public.api_rate_limits where window_start < now() - interval '1 hour';
  end if;

  return jsonb_build_object(
    'allowed',   v_count <= v_limit,
    'limit',     v_limit,
    'remaining', greatest(v_limit - v_count, 0),
    'reset_at',  v_window + make_interval(secs => p_window_seconds));
end;
$$;

-- internal helper: record one submission attempt
create or replace function public._record_api_submission(
  p_org uuid, p_key uuid, p_event text, p_ref text, p_source text,
  p_payload jsonb, p_status text, p_opp uuid, p_error text)
returns uuid
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
begin
  insert into public.api_submissions
    (organization_id, api_key_id, opportunity_id, event_type, submission_source,
     external_reference, payload, payload_hash, status, error_message)
  values
    (p_org, p_key, p_opp, p_event, p_source, p_ref, p_payload,
     encode(digest(coalesce(p_payload::text, ''), 'sha256'), 'hex'), p_status, p_error)
  returning id into v_id;
  return v_id;
end;
$$;

-- internal helper: hash of the externally supplied fields of an opportunity
create or replace function public._opp_content_hash(o public.opportunities)
returns text
language sql stable
as $$
  select md5(concat_ws('|',
    o.title, o.description, o.application_url, o.requirements::text,
    o.eligibility_criteria, o.closing_date::text, o.location, o.province,
    o.category, o.opportunity_type, o.is_remote::text, array_to_string(o.tags, ',')))
$$;

-- ---------------------------------------------------------------------
-- THE core integration function used by POST/PUT/DELETE company endpoints,
-- webhooks and scheduled sync. Called only by the backend (service role)
-- AFTER the API key has been verified. Never publishes automatically.
--
--   p_event   : created | updated | withdrawn
--   p_source  : company_api | webhook | scheduled_sync
--   p_opportunity_id : set for PUT/DELETE /:id (ownership is enforced here)
--
-- Returns {ok, action, opportunity_id, status} or {ok:false, error, detail}.
-- action: created | updated | returned_to_review | unchanged | withdrawn
-- ---------------------------------------------------------------------
create or replace function public.submit_company_opportunity(
  p_org_id uuid, p_key_id uuid, p_event text, p_payload jsonb,
  p_source text default 'company_api', p_opportunity_id uuid default null)
returns jsonb
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_org        public.organizations%rowtype;
  v_ex         public.opportunities%rowtype;
  v_new        public.opportunities%rowtype;
  v_found      boolean := false;
  v_payload    jsonb := coalesce(p_payload, '{}'::jsonb);
  v_ref        text;
  v_title      text;
  v_desc       text;
  v_app_url    text;
  v_closing    date;
  v_cat_text   text;
  v_cat_id     uuid;
  v_cat_name   text;
  v_tags       text[];
  v_req        jsonb;
  v_elig       text;
  v_type       text;
  v_loc        text;
  v_remote     boolean;
  v_prov       text;
  v_qual       text;
  v_sector     text;
  v_material   boolean;
  v_new_status text;
  v_opp_id     uuid;
  v_action     text;
begin
  if p_event not in ('created', 'updated', 'withdrawn') then
    return jsonb_build_object('ok', false, 'error', 'invalid_event');
  end if;
  if p_source not in ('company_api', 'webhook', 'scheduled_sync') then
    return jsonb_build_object('ok', false, 'error', 'invalid_source');
  end if;

  select * into v_org from public.organizations where id = p_org_id and status = 'approved';
  if not found then
    return jsonb_build_object('ok', false, 'error', 'organization_not_approved');
  end if;

  v_ref := nullif(trim(v_payload ->> 'external_reference'), '');

  -- ---- locate the existing opportunity (ownership enforced by organization_id)
  if p_opportunity_id is not null then
    select * into v_ex from public.opportunities
    where id = p_opportunity_id and organization_id = p_org_id;
    v_found := found;
    if not v_found then
      perform public._record_api_submission(p_org_id, p_key_id, p_event, v_ref, p_source,
                                            v_payload, 'rejected', null, 'not_found_or_not_owned');
      return jsonb_build_object('ok', false, 'error', 'not_found');
    end if;
    v_ref := coalesce(v_ref, v_ex.external_reference);
  elsif v_ref is not null then
    select * into v_ex from public.opportunities
    where organization_id = p_org_id and external_reference = v_ref;
    v_found := found;
  end if;

  -- ---- withdraw
  if p_event = 'withdrawn' then
    if not v_found then
      perform public._record_api_submission(p_org_id, p_key_id, p_event, v_ref, p_source,
                                            v_payload, 'rejected', null, 'not_found');
      return jsonb_build_object('ok', false, 'error', 'not_found');
    end if;
    if v_ex.status = 'rejected' and v_ex.withdrawn_at is not null then
      perform public._record_api_submission(p_org_id, p_key_id, p_event, v_ref, p_source,
                                            v_payload, 'duplicate', v_ex.id, null);
      return jsonb_build_object('ok', true, 'action', 'unchanged', 'opportunity_id', v_ex.id, 'status', v_ex.status);
    end if;
    update public.opportunities
    set status = 'rejected', rejection_reason = 'Withdrawn by organisation', withdrawn_at = now()
    where id = v_ex.id;
    perform public._record_api_submission(p_org_id, p_key_id, p_event, v_ref, p_source,
                                          v_payload, 'accepted', v_ex.id, null);
    return jsonb_build_object('ok', true, 'action', 'withdrawn', 'opportunity_id', v_ex.id, 'status', 'rejected');
  end if;

  -- ---- parse + validate fields (the API route validates first; this is defence in depth)
  v_title   := nullif(trim(v_payload ->> 'title'), '');
  v_desc    := nullif(trim(v_payload ->> 'description'), '');
  v_app_url := nullif(trim(v_payload ->> 'application_url'), '');

  if not v_found and (v_title is null or v_desc is null) then
    perform public._record_api_submission(p_org_id, p_key_id, p_event, v_ref, p_source,
                                          v_payload, 'rejected', null, 'title and description are required');
    return jsonb_build_object('ok', false, 'error', 'validation_failed', 'detail', 'title and description are required');
  end if;
  if v_title is not null and char_length(v_title) > 300 then
    perform public._record_api_submission(p_org_id, p_key_id, p_event, v_ref, p_source,
                                          v_payload, 'rejected', null, 'title too long');
    return jsonb_build_object('ok', false, 'error', 'validation_failed', 'detail', 'title too long (max 300)');
  end if;
  if v_desc is not null and char_length(v_desc) > 20000 then
    perform public._record_api_submission(p_org_id, p_key_id, p_event, v_ref, p_source,
                                          v_payload, 'rejected', null, 'description too long');
    return jsonb_build_object('ok', false, 'error', 'validation_failed', 'detail', 'description too long (max 20000)');
  end if;
  if v_app_url is not null and v_app_url !~* '^https?://[^\s]+$' then
    perform public._record_api_submission(p_org_id, p_key_id, p_event, v_ref, p_source,
                                          v_payload, 'rejected', null, 'invalid application_url');
    return jsonb_build_object('ok', false, 'error', 'validation_failed', 'detail', 'application_url must be http(s)');
  end if;

  begin
    v_closing := nullif(trim(v_payload ->> 'closing_date'), '')::date;
  exception when others then
    perform public._record_api_submission(p_org_id, p_key_id, p_event, v_ref, p_source,
                                          v_payload, 'rejected', null, 'invalid closing_date');
    return jsonb_build_object('ok', false, 'error', 'validation_failed', 'detail', 'closing_date must be YYYY-MM-DD');
  end;

  -- category mapping (unknown -> Other)
  v_cat_text := nullif(trim(v_payload ->> 'category'), '');
  if v_cat_text is not null then
    select id, name into v_cat_id, v_cat_name from public.categories
    where is_active and (lower(name) = lower(v_cat_text) or slug = lower(v_cat_text)) limit 1;
  end if;
  if v_cat_id is null and (not v_found or v_cat_text is not null) then
    select id, name into v_cat_id, v_cat_name from public.categories where name = 'Other';
  end if;

  if jsonb_typeof(v_payload -> 'tags') = 'array' then
    select coalesce(array_agg(t), '{}') into v_tags
    from (select left(trim(x), 50) as t from jsonb_array_elements_text(v_payload -> 'tags') x
          where trim(x) <> '' limit 20) s;
  end if;

  v_req    := case when jsonb_typeof(v_payload -> 'requirements') = 'object' then v_payload -> 'requirements' end;
  v_elig   := nullif(trim(v_payload ->> 'eligibility_criteria'), '');
  v_type   := nullif(trim(v_payload ->> 'opportunity_type'), '');
  v_loc    := nullif(trim(v_payload ->> 'location'), '');
  v_prov   := nullif(trim(v_payload ->> 'province'), '');
  v_qual   := nullif(trim(v_payload ->> 'qualification'), '');
  v_sector := nullif(trim(v_payload ->> 'sector'), '');
  v_remote := case when jsonb_typeof(v_payload -> 'is_remote') = 'boolean'
                   then (v_payload ->> 'is_remote')::boolean end;

  -- no reference supplied on create: fingerprint so identical resubmissions are caught
  if v_ref is null and not v_found then
    v_ref := 'auto-' || md5(lower(v_title) || '|' || coalesce(v_closing::text, ''));
    select * into v_ex from public.opportunities
    where organization_id = p_org_id and external_reference = v_ref;
    v_found := found;
  end if;

  -- ================= CREATE =================
  if not v_found then
    v_new.title                := v_title;
    v_new.description          := v_desc;
    v_new.application_url      := v_app_url;
    v_new.requirements         := coalesce(v_req, '{"studyLevel": false, "careerField": false, "experience": false}'::jsonb);
    v_new.eligibility_criteria := v_elig;
    v_new.closing_date         := v_closing;
    v_new.location             := v_loc;
    v_new.province             := coalesce(v_prov, 'Nationwide');
    v_new.category             := coalesce(v_cat_name, 'Other');
    v_new.opportunity_type     := v_type;
    v_new.is_remote            := coalesce(v_remote, false);
    v_new.tags                 := coalesce(v_tags, '{}');

    insert into public.opportunities (
      title, provider, category, category_id, province, qualification, closing_date,
      description, tags, requirements, sector, source_name, source_url, source_type,
      application_url, opportunity_type, location, is_remote, eligibility_criteria,
      organization_id, external_reference, submission_source, content_hash, status)
    values (
      v_new.title, v_org.name, v_new.category, v_cat_id, v_new.province,
      coalesce(v_qual, 'Not specified'), v_new.closing_date,
      v_new.description, v_new.tags, v_new.requirements,
      coalesce(v_sector, 'Other'), v_org.name,
      coalesce(v_app_url, v_org.website, ''), 'official_api',
      v_new.application_url, v_new.opportunity_type, v_new.location, v_new.is_remote,
      v_new.eligibility_criteria,
      p_org_id, v_ref, p_source, public._opp_content_hash(v_new), 'pending')
    returning id into v_opp_id;

    perform public._record_api_submission(p_org_id, p_key_id, p_event, v_ref, p_source,
                                          v_payload, 'accepted', v_opp_id, null);
    return jsonb_build_object('ok', true, 'action', 'created', 'opportunity_id', v_opp_id, 'status', 'pending');
  end if;

  -- ================= UPDATE (also: a repeated "create" for a known reference) =================
  v_new := v_ex;
  v_new.title                := coalesce(v_title,  v_ex.title);
  v_new.description          := coalesce(v_desc,   v_ex.description);
  v_new.application_url      := coalesce(v_app_url, v_ex.application_url);
  v_new.requirements         := coalesce(v_req,    v_ex.requirements);
  v_new.eligibility_criteria := coalesce(v_elig,   v_ex.eligibility_criteria);
  v_new.closing_date         := coalesce(v_closing, v_ex.closing_date);
  v_new.location             := coalesce(v_loc,    v_ex.location);
  v_new.province             := coalesce(v_prov,   v_ex.province);
  v_new.category             := coalesce(v_cat_name, v_ex.category);
  v_new.opportunity_type     := coalesce(v_type,   v_ex.opportunity_type);
  v_new.is_remote            := coalesce(v_remote, v_ex.is_remote);
  v_new.tags                 := coalesce(v_tags,   v_ex.tags);

  if public._opp_content_hash(v_new) = public._opp_content_hash(v_ex) and v_ex.status <> 'rejected' then
    perform public._record_api_submission(p_org_id, p_key_id, p_event, v_ref, p_source,
                                          v_payload, 'duplicate', v_ex.id, null);
    return jsonb_build_object('ok', true, 'action', 'unchanged', 'opportunity_id', v_ex.id, 'status', v_ex.status);
  end if;

  -- Material change (what a student relies on) sends approved/published items back to review.
  -- Closing date, location, province, tags etc. are updated in place.
  v_material :=
       v_new.title                is distinct from v_ex.title
    or v_new.description          is distinct from v_ex.description
    or v_new.application_url      is distinct from v_ex.application_url
    or v_new.requirements         is distinct from v_ex.requirements
    or v_new.eligibility_criteria is distinct from v_ex.eligibility_criteria
    or v_new.category             is distinct from v_ex.category;

  v_new_status := v_ex.status;
  v_action := 'updated';
  if v_ex.status = 'rejected' then
    v_new_status := 'pending';          -- resubmission after rejection / withdrawal
    v_action := 'returned_to_review';
  elsif v_ex.status in ('approved', 'published') and v_material
        and coalesce((select (value #>> '{}')::boolean from public.system_settings
                      where key = 'review_required_on_change'), true) then
    v_new_status := 'pending';
    v_action := 'returned_to_review';
  end if;

  update public.opportunities set
    title = v_new.title,
    description = v_new.description,
    application_url = v_new.application_url,
    closing_date = v_new.closing_date,
    category = v_new.category,
    category_id = coalesce(v_cat_id, category_id),
    tags = v_new.tags,
    requirements = v_new.requirements,
    eligibility_criteria = v_new.eligibility_criteria,
    opportunity_type = v_new.opportunity_type,
    location = v_new.location,
    province = v_new.province,
    qualification = coalesce(v_qual, qualification),
    sector = coalesce(v_sector, sector),
    is_remote = v_new.is_remote,
    provider = v_org.name,
    submission_source = p_source,
    content_hash = public._opp_content_hash(v_new),
    status = v_new_status,
    rejection_reason = case when v_new_status = 'pending' then null else rejection_reason end,
    withdrawn_at = case when v_new_status = 'pending' then null else withdrawn_at end
  where id = v_ex.id;

  perform public._record_api_submission(p_org_id, p_key_id, p_event, v_ref, p_source,
                                        v_payload, 'accepted', v_ex.id, null);
  return jsonb_build_object('ok', true, 'action', v_action, 'opportunity_id', v_ex.id, 'status', v_new_status);
end;
$$;

-- Companies due for a scheduled pull (called by the cron route / Edge Function)
create or replace function public.due_sync_organizations()
returns table (organization_id uuid, sync_url text, auth_header_name text, vault_secret_id uuid)
language sql stable security definer
set search_path = public
as $$
  select c.organization_id, c.sync_url, c.auth_header_name, c.vault_secret_id
  from public.organization_sync_configs c
  join public.organizations o on o.id = c.organization_id
  where c.enabled
    and o.status = 'approved'
    and o.api_enabled
    and (c.last_synced_at is null
         or c.last_synced_at + make_interval(mins => c.interval_minutes) <= now())
$$;

create or replace function public.mark_sync_result(p_org uuid, p_status text, p_error text default null)
returns void
language sql security definer
set search_path = public
as $$
  update public.organization_sync_configs
  set last_synced_at = now(), last_status = p_status, last_error = p_error
  where organization_id = p_org
$$;

-- ---------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------
-- Backend only
revoke all on function public.bootstrap_admin(text, text)                              from public, anon, authenticated;
revoke all on function public.verify_company_api_key(text)                             from public, anon, authenticated;
revoke all on function public.check_api_rate_limit(uuid, integer, integer)             from public, anon, authenticated;
revoke all on function public._record_api_submission(uuid, uuid, text, text, text, jsonb, text, uuid, text)
                                                                                      from public, anon, authenticated;
revoke all on function public.submit_company_opportunity(uuid, uuid, text, jsonb, text, uuid)
                                                                                      from public, anon, authenticated;
revoke all on function public._opp_content_hash(public.opportunities)                  from public, anon, authenticated;
revoke all on function public.due_sync_organizations()                                 from public, anon, authenticated;
revoke all on function public.mark_sync_result(uuid, text, text)                       from public, anon, authenticated;

grant execute on function public.bootstrap_admin(text, text)                           to service_role;
grant execute on function public.verify_company_api_key(text)                          to service_role;
grant execute on function public.check_api_rate_limit(uuid, integer, integer)          to service_role;
grant execute on function public._record_api_submission(uuid, uuid, text, text, text, jsonb, text, uuid, text)
                                                                                      to service_role;
grant execute on function public.submit_company_opportunity(uuid, uuid, text, jsonb, text, uuid)
                                                                                      to service_role;
grant execute on function public._opp_content_hash(public.opportunities)               to service_role;
grant execute on function public.due_sync_organizations()                              to service_role;
grant execute on function public.mark_sync_result(uuid, text, text)                    to service_role;

-- Admin RPCs: signed-in users only (each function checks the caller's role)
revoke all on function public.log_admin_action(text, text, text, jsonb)                from public, anon;
revoke all on function public.review_opportunity(uuid, text, text)                     from public, anon;
revoke all on function public.assign_admin_role(uuid, text, boolean)                   from public, anon;
revoke all on function public.generate_company_api_key(uuid, text, text[], timestamptz) from public, anon;
revoke all on function public.revoke_company_api_key(uuid)                             from public, anon;
revoke all on function public.admin_dashboard_stats()                                  from public, anon;

grant execute on function public.log_admin_action(text, text, text, jsonb)             to authenticated, service_role;
grant execute on function public.review_opportunity(uuid, text, text)                  to authenticated, service_role;
grant execute on function public.assign_admin_role(uuid, text, boolean)                to authenticated, service_role;
grant execute on function public.generate_company_api_key(uuid, text, text[], timestamptz) to authenticated, service_role;
grant execute on function public.revoke_company_api_key(uuid)                          to authenticated, service_role;
grant execute on function public.admin_dashboard_stats()                               to authenticated, service_role;
