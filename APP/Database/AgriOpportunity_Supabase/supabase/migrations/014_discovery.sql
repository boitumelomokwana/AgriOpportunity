-- =====================================================================
-- 014_discovery.sql
-- Additive discovery subsystem for AgriOpportunities.
--
-- Nothing existing is dropped or rewritten. Public discovery data is kept
-- separate from curated records until an administrator imports or promotes
-- it. Imported opportunities always start as pending and unpublished.
--
-- Contents:
--   * discovery_sources        approved / disabled source configuration
--   * discovery_runs           collection history and errors
--   * discovered_companies     normalised company candidates
--   * discovered_opportunities normalised opportunity candidates
--   * discovery_changes        change history for repeated collections
--   * RLS, indexes, updated_at triggers
--   * promotion / rejection / merge / edit RPCs
-- =====================================================================

-- ---------------------------------------------------------------------
-- Sources
-- ---------------------------------------------------------------------
create table if not exists public.discovery_sources (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null check (char_length(trim(name)) between 2 and 160),
  slug                text not null check (slug ~ '^[a-z0-9][a-z0-9-]{1,80}$'),
  source_type         text not null default 'json'
                        check (source_type in ('json', 'rss', 'html')),
  base_url            text not null check (base_url ~* '^https?://'),
  terms_url           text,
  license_note        text,
  is_enabled          boolean not null default false,
  requires_credentials boolean not null default false,
  rate_limit_seconds  integer not null default 3600
                        check (rate_limit_seconds between 60 and 604800),
  config              jsonb not null default '{}'::jsonb,
  last_run_at         timestamptz,
  last_success_at     timestamptz,
  last_error          text,
  created_by          uuid references auth.users (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (slug),
  unique (name)
);

create index if not exists discovery_sources_enabled_idx
  on public.discovery_sources (is_enabled, last_run_at);

comment on table public.discovery_sources is
  'Approved and disabled discovery sources. Enabling a source is a Super Admin decision; terms and licences must be reviewed first.';

-- ---------------------------------------------------------------------
-- Runs
-- ---------------------------------------------------------------------
create table if not exists public.discovery_runs (
  id                    uuid primary key default gen_random_uuid(),
  source_id             uuid not null references public.discovery_sources (id) on delete cascade,
  status                text not null default 'running'
                          check (status in ('running', 'succeeded', 'partial', 'failed')),
  trigger_type          text not null default 'manual'
                          check (trigger_type in ('manual', 'schedule', 'retry')),
  requested_by          uuid references auth.users (id) on delete set null,
  started_at            timestamptz not null default now(),
  finished_at           timestamptz,
  duration_ms           integer,
  items_found           integer not null default 0,
  companies_found       integer not null default 0,
  opportunities_found   integer not null default 0,
  duplicates            integer not null default 0,
  companies_imported    integer not null default 0,
  opportunities_imported integer not null default 0,
  expired_count         integer not null default 0,
  error_count           integer not null default 0,
  error_summary         text,
  details               jsonb not null default '{}'::jsonb
);

create index if not exists discovery_runs_source_idx
  on public.discovery_runs (source_id, started_at desc);
create index if not exists discovery_runs_time_idx
  on public.discovery_runs (started_at desc);
create index if not exists discovery_runs_status_idx
  on public.discovery_runs (status, started_at desc);

comment on table public.discovery_runs is
  'One row per collection attempt, including failures, counts and error details.';

-- ---------------------------------------------------------------------
-- Discovered companies
-- ---------------------------------------------------------------------
create table if not exists public.discovered_companies (
  id                    uuid primary key default gen_random_uuid(),
  source_id             uuid not null references public.discovery_sources (id) on delete cascade,
  external_id           text,
  name                  text not null check (char_length(trim(name)) between 1 and 300),
  trading_name          text,
  registration_number   text,
  description           text,
  industry              text,
  sector                text,
  website               text,
  contact_email         text,
  contact_phone         text,
  province              text,
  city                  text,
  careers_url           text,
  source_url            text not null,
  raw_data              jsonb not null default '{}'::jsonb,
  content_hash          text,
  status                text not null default 'new'
                          check (status in ('new', 'matched', 'imported', 'verified',
                                            'rejected', 'merged')),
  organization_id       uuid references public.organizations (id) on delete set null,
  first_seen_at         timestamptz not null default now(),
  last_seen_at          timestamptz not null default now(),
  last_checked_at       timestamptz,
  last_changed_at       timestamptz,
  imported_at           timestamptz,
  verified_at           timestamptz,
  verified_by           uuid references auth.users (id) on delete set null,
  rejection_reason      text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create unique index if not exists discovered_companies_source_external_uq
  on public.discovered_companies (source_id, external_id)
  where external_id is not null;
create unique index if not exists discovered_companies_source_url_uq
  on public.discovered_companies (source_id, source_url);
create index if not exists discovered_companies_status_idx
  on public.discovered_companies (status, last_seen_at desc);
create index if not exists discovered_companies_name_idx
  on public.discovered_companies (lower(name));
create index if not exists discovered_companies_reg_idx
  on public.discovered_companies (lower(registration_number))
  where registration_number is not null;
create index if not exists discovered_companies_org_idx
  on public.discovered_companies (organization_id);

-- ---------------------------------------------------------------------
-- Discovered opportunities
-- ---------------------------------------------------------------------
create table if not exists public.discovered_opportunities (
  id                    uuid primary key default gen_random_uuid(),
  source_id             uuid not null references public.discovery_sources (id) on delete cascade,
  discovered_company_id uuid references public.discovered_companies (id) on delete set null,
  organization_id       uuid references public.organizations (id) on delete set null,
  opportunity_id        uuid references public.opportunities (id) on delete set null,
  external_id           text,
  title                 text not null check (char_length(trim(title)) between 3 and 300),
  description           text,
  provider              text,
  category              text not null default 'Other',
  opportunity_type      text,
  location              text,
  province              text not null default 'National',
  qualification         text,
  eligibility_criteria  text,
  application_url       text,
  source_url            text not null,
  opening_date          date,
  closing_date          date,
  is_remote             boolean not null default false,
  tags                  text[] not null default '{}',
  requirements          jsonb not null default '{}'::jsonb,
  raw_data              jsonb not null default '{}'::jsonb,
  content_hash          text,
  status                text not null default 'new'
                          check (status in ('new', 'matched', 'imported', 'verified',
                                            'rejected', 'expired', 'duplicate')),
  first_seen_at         timestamptz not null default now(),
  last_seen_at          timestamptz not null default now(),
  last_checked_at       timestamptz,
  last_changed_at       timestamptz,
  imported_at           timestamptz,
  expired_at            timestamptz,
  verified_at           timestamptz,
  verified_by           uuid references auth.users (id) on delete set null,
  rejection_reason      text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create unique index if not exists discovered_opportunities_source_external_uq
  on public.discovered_opportunities (source_id, external_id)
  where external_id is not null;
create unique index if not exists discovered_opportunities_source_url_uq
  on public.discovered_opportunities (source_id, source_url);
create index if not exists discovered_opportunities_status_idx
  on public.discovered_opportunities (status, last_seen_at desc);
create index if not exists discovered_opportunities_company_idx
  on public.discovered_opportunities (discovered_company_id);
create index if not exists discovered_opportunities_org_idx
  on public.discovered_opportunities (organization_id);
create index if not exists discovered_opportunities_closing_idx
  on public.discovered_opportunities (closing_date);
create index if not exists discovered_opportunities_opportunity_idx
  on public.discovered_opportunities (opportunity_id);

-- ---------------------------------------------------------------------
-- Change history
-- ---------------------------------------------------------------------
create table if not exists public.discovery_changes (
  id            bigint generated always as identity primary key,
  entity_type   text not null check (entity_type in ('company', 'opportunity', 'source')),
  entity_id     uuid not null,
  source_id     uuid references public.discovery_sources (id) on delete cascade,
  change_type   text not null check (change_type in ('created', 'updated', 'status', 'imported')),
  changed_fields text[] not null default '{}',
  previous_data jsonb,
  new_data      jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists discovery_changes_entity_idx
  on public.discovery_changes (entity_type, entity_id, created_at desc);
create index if not exists discovery_changes_source_idx
  on public.discovery_changes (source_id, created_at desc);

-- ---------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------
drop trigger if exists discovery_sources_updated_at on public.discovery_sources;
create trigger discovery_sources_updated_at
  before update on public.discovery_sources
  for each row execute function public.set_updated_at();

drop trigger if exists discovered_companies_updated_at on public.discovered_companies;
create trigger discovered_companies_updated_at
  before update on public.discovered_companies
  for each row execute function public.set_updated_at();

drop trigger if exists discovered_opportunities_updated_at on public.discovered_opportunities;
create trigger discovered_opportunities_updated_at
  before update on public.discovered_opportunities
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Audit source configuration changes (worker timestamp updates excluded)
-- ---------------------------------------------------------------------
create or replace function public.audit_discovery_source()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.admin_logs (admin_id, action, entity_type, entity_id, details)
    values (auth.uid(), 'discovery.source_created', 'discovery_source', new.id::text,
            jsonb_build_object('name', new.name, 'source_type', new.source_type,
                               'is_enabled', new.is_enabled));
    return new;
  elsif tg_op = 'UPDATE'
        and (new.name is distinct from old.name
          or new.base_url is distinct from old.base_url
          or new.source_type is distinct from old.source_type
          or new.is_enabled is distinct from old.is_enabled
          or new.config is distinct from old.config
          or new.terms_url is distinct from old.terms_url
          or new.license_note is distinct from old.license_note) then
    insert into public.admin_logs (admin_id, action, entity_type, entity_id, details)
    values (auth.uid(), 'discovery.source_updated', 'discovery_source', new.id::text,
            jsonb_build_object('name', new.name, 'is_enabled', new.is_enabled,
                               'source_type', new.source_type));
    return new;
  end if;
  return new;
end;
$$;

drop trigger if exists discovery_sources_audit on public.discovery_sources;
create trigger discovery_sources_audit
  after insert or update on public.discovery_sources
  for each row execute function public.audit_discovery_source();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.discovery_sources         enable row level security;
alter table public.discovery_runs            enable row level security;
alter table public.discovered_companies      enable row level security;
alter table public.discovered_opportunities  enable row level security;
alter table public.discovery_changes         enable row level security;

drop policy if exists "discovery_sources_select" on public.discovery_sources;
create policy "discovery_sources_select" on public.discovery_sources
  for select to authenticated using (public.is_admin());

drop policy if exists "discovery_runs_select" on public.discovery_runs;
create policy "discovery_runs_select" on public.discovery_runs
  for select to authenticated using (public.is_admin());

drop policy if exists "discovered_companies_select" on public.discovered_companies;
create policy "discovered_companies_select" on public.discovered_companies
  for select to authenticated using (public.is_admin());

drop policy if exists "discovered_opportunities_select" on public.discovered_opportunities;
create policy "discovered_opportunities_select" on public.discovered_opportunities
  for select to authenticated using (public.is_admin());

drop policy if exists "discovery_changes_select" on public.discovery_changes;
create policy "discovery_changes_select" on public.discovery_changes
  for select to authenticated using (public.is_admin());

-- Deliberately no INSERT/UPDATE/DELETE policies for authenticated users.
-- The worker writes with the service role; administrators act through the
-- audited SECURITY DEFINER functions below.

revoke all on public.discovery_sources, public.discovery_runs,
  public.discovered_companies, public.discovered_opportunities,
  public.discovery_changes from anon;
grant select on public.discovery_sources, public.discovery_runs,
  public.discovered_companies, public.discovered_opportunities,
  public.discovery_changes to authenticated;
grant all on public.discovery_sources, public.discovery_runs,
  public.discovered_companies, public.discovered_opportunities,
  public.discovery_changes to service_role;

-- ---------------------------------------------------------------------
-- Statistics for the admin dashboard
-- ---------------------------------------------------------------------
create or replace function public.discovery_admin_stats()
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'sources_total',        (select count(*) from public.discovery_sources),
    'sources_enabled',      (select count(*) from public.discovery_sources where is_enabled),
    'companies_total',      (select count(*) from public.discovered_companies),
    'companies_new',        (select count(*) from public.discovered_companies where status = 'new'),
    'companies_imported',   (select count(*) from public.discovered_companies where status in ('imported', 'verified')),
    'companies_verified',   (select count(*) from public.discovered_companies where status = 'verified'),
    'opportunities_total',  (select count(*) from public.discovered_opportunities),
    'opportunities_new',    (select count(*) from public.discovered_opportunities where status = 'new'),
    'opportunities_imported', (select count(*) from public.discovered_opportunities where status in ('imported', 'verified')),
    'opportunities_expired', (select count(*) from public.discovered_opportunities where status = 'expired'),
    'runs_total',           (select count(*) from public.discovery_runs),
    'runs_failed_24h',      (select count(*) from public.discovery_runs
                              where status = 'failed' and started_at > now() - interval '24 hours'),
    'last_run',             (select to_jsonb(r) from public.discovery_runs r
                              order by r.started_at desc limit 1)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Source management (Super Admin only)
-- ---------------------------------------------------------------------
create or replace function public.upsert_discovery_source(
  p_id uuid,
  p_name text,
  p_source_type text,
  p_base_url text,
  p_terms_url text default null,
  p_license_note text default null,
  p_is_enabled boolean default false,
  p_requires_credentials boolean default false,
  p_rate_limit_seconds integer default 3600,
  p_config jsonb default '{}'::jsonb)
returns public.discovery_sources
language plpgsql security definer
set search_path = public
as $$
declare
  v_row public.discovery_sources;
  v_slug text;
begin
  if not public.is_super_admin() then
    raise exception 'Only a Super Admin can manage discovery sources' using errcode = '42501';
  end if;
  if p_source_type not in ('json', 'rss', 'html') then
    raise exception 'Unsupported source type: %', p_source_type;
  end if;
  if p_base_url !~* '^https?://' then
    raise exception 'base_url must start with http:// or https://';
  end if;

  v_slug := lower(regexp_replace(trim(p_name), '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);
  if char_length(v_slug) < 2 then
    raise exception 'The source name must contain letters or numbers';
  end if;

  if p_id is null then
    insert into public.discovery_sources (
      name, slug, source_type, base_url, terms_url, license_note,
      is_enabled, requires_credentials, rate_limit_seconds, config, created_by)
    values (
      trim(p_name), v_slug, p_source_type, trim(p_base_url), p_terms_url,
      p_license_note, coalesce(p_is_enabled, false),
      coalesce(p_requires_credentials, false),
      greatest(60, least(coalesce(p_rate_limit_seconds, 3600), 604800)),
      coalesce(p_config, '{}'::jsonb), auth.uid())
    returning * into v_row;
  else
    update public.discovery_sources
    set name = trim(p_name),
        slug = v_slug,
        source_type = p_source_type,
        base_url = trim(p_base_url),
        terms_url = p_terms_url,
        license_note = p_license_note,
        is_enabled = coalesce(p_is_enabled, is_enabled),
        requires_credentials = coalesce(p_requires_credentials, requires_credentials),
        rate_limit_seconds = greatest(60, least(coalesce(p_rate_limit_seconds, rate_limit_seconds), 604800)),
        config = coalesce(p_config, config),
        last_error = case when coalesce(p_is_enabled, is_enabled) then last_error else null end
    where id = p_id
    returning * into v_row;

    if not found then
      raise exception 'Discovery source not found' using errcode = 'P0002';
    end if;
  end if;

  return v_row;
end;
$$;

create or replace function public.set_discovery_source_enabled(
  p_id uuid, p_enabled boolean)
returns public.discovery_sources
language plpgsql security definer
set search_path = public
as $$
declare
  v_row public.discovery_sources;
begin
  if not public.is_super_admin() then
    raise exception 'Only a Super Admin can enable or disable discovery sources' using errcode = '42501';
  end if;

  update public.discovery_sources
  set is_enabled = p_enabled,
      last_error = case when p_enabled then last_error else null end
  where id = p_id
  returning * into v_row;

  if not found then
    raise exception 'Discovery source not found' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

-- ---------------------------------------------------------------------
-- Company candidate editing / promotion
-- ---------------------------------------------------------------------
create or replace function public.update_discovered_company(
  p_id uuid, p_patch jsonb)
returns public.discovered_companies
language plpgsql security definer
set search_path = public
as $$
declare
  v_row public.discovered_companies;
  v_before jsonb;
begin
  if not public.can_manage_content() then
    raise exception 'Super Admin or Content Admin only' using errcode = '42501';
  end if;

  select to_jsonb(d) into v_before from public.discovered_companies d where d.id = p_id for update;
  if v_before is null then raise exception 'Discovered company not found' using errcode = 'P0002'; end if;

  update public.discovered_companies
  set name = coalesce(nullif(trim(p_patch ->> 'name'), ''), name),
      trading_name = case when p_patch ? 'trading_name' then nullif(trim(p_patch ->> 'trading_name'), '') else trading_name end,
      registration_number = case when p_patch ? 'registration_number' then nullif(trim(p_patch ->> 'registration_number'), '') else registration_number end,
      description = case when p_patch ? 'description' then nullif(trim(p_patch ->> 'description'), '') else description end,
      industry = case when p_patch ? 'industry' then nullif(trim(p_patch ->> 'industry'), '') else industry end,
      sector = case when p_patch ? 'sector' then nullif(trim(p_patch ->> 'sector'), '') else sector end,
      website = case when p_patch ? 'website' then nullif(trim(p_patch ->> 'website'), '') else website end,
      contact_email = case when p_patch ? 'contact_email' then nullif(trim(p_patch ->> 'contact_email'), '') else contact_email end,
      contact_phone = case when p_patch ? 'contact_phone' then nullif(trim(p_patch ->> 'contact_phone'), '') else contact_phone end,
      province = case when p_patch ? 'province' then nullif(trim(p_patch ->> 'province'), '') else province end,
      city = case when p_patch ? 'city' then nullif(trim(p_patch ->> 'city'), '') else city end,
      careers_url = case when p_patch ? 'careers_url' then nullif(trim(p_patch ->> 'careers_url'), '') else careers_url end,
      source_url = coalesce(nullif(trim(p_patch ->> 'source_url'), ''), source_url),
      last_changed_at = now()
  where id = p_id
  returning * into v_row;

  insert into public.discovery_changes (entity_type, entity_id, source_id, change_type,
                                        changed_fields, previous_data, new_data)
  values ('company', p_id, v_row.source_id, 'updated',
          array(select jsonb_object_keys(p_patch)),
          v_before, to_jsonb(v_row));

  insert into public.admin_logs (admin_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'discovery.company_edited', 'discovered_company', p_id::text,
          jsonb_build_object('fields', array(select jsonb_object_keys(p_patch))));

  return v_row;
end;
$$;

create or replace function public.promote_discovered_company(
  p_id uuid, p_org_id uuid default null)
returns public.organizations
language plpgsql security definer
set search_path = public
as $$
declare
  v_disc public.discovered_companies;
  v_org public.organizations;
begin
  if not public.can_manage_content() then
    raise exception 'Super Admin or Content Admin only' using errcode = '42501';
  end if;

  select * into v_disc from public.discovered_companies where id = p_id for update;
  if not found then raise exception 'Discovered company not found' using errcode = 'P0002'; end if;
  if v_disc.status = 'rejected' then
    raise exception 'A rejected company cannot be promoted';
  end if;

  if v_disc.organization_id is not null then
    select * into v_org from public.organizations where id = v_disc.organization_id;
    if found then return v_org; end if;
  end if;

  if p_org_id is not null then
    select * into v_org from public.organizations where id = p_org_id;
    if not found then raise exception 'Target organisation not found' using errcode = 'P0002'; end if;
  else
    select * into v_org
    from public.organizations o
    where (v_disc.registration_number is not null
           and o.registration_number is not null
           and lower(trim(o.registration_number)) = lower(trim(v_disc.registration_number)))
       or lower(trim(o.name)) = lower(trim(v_disc.name))
       or (v_disc.website is not null and o.website is not null
           and regexp_replace(lower(o.website), '^https?://(www\.)?', '')
             = regexp_replace(lower(v_disc.website), '^https?://(www\.)?', ''))
    order by (lower(trim(o.name)) = lower(trim(v_disc.name))) desc
    limit 1;

    if not found then
      begin
        insert into public.organizations (
          name, description, industry, website, contact_email, contact_phone,
          province, address, registration_number, status, api_enabled,
          integration_method)
        values (
          trim(v_disc.name), v_disc.description, v_disc.industry, v_disc.website,
          v_disc.contact_email, v_disc.contact_phone, v_disc.province,
          v_disc.city, v_disc.registration_number, 'pending', false, 'none')
        returning * into v_org;
      exception when unique_violation then
        select * into v_org from public.organizations
        where lower(trim(name)) = lower(trim(v_disc.name)) limit 1;
      end;
    else
      -- Preserve curated values and never change approval / verification state.
      update public.organizations
      set description = coalesce(description, v_disc.description),
          industry = coalesce(industry, v_disc.industry),
          website = coalesce(website, v_disc.website),
          contact_email = coalesce(contact_email, v_disc.contact_email),
          contact_phone = coalesce(contact_phone, v_disc.contact_phone),
          province = coalesce(province, v_disc.province),
          registration_number = coalesce(registration_number, v_disc.registration_number)
      where id = v_org.id
      returning * into v_org;
    end if;
  end if;

  update public.discovered_companies
  set organization_id = v_org.id,
      status = case when status in ('new', 'matched') then 'imported' else status end,
      imported_at = coalesce(imported_at, now()),
      last_checked_at = now()
  where id = p_id;

  insert into public.admin_logs (admin_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'discovery.company_imported', 'discovered_company', p_id::text,
          jsonb_build_object('organization_id', v_org.id, 'organization_name', v_org.name));

  return v_org;
end;
$$;

create or replace function public.reject_discovered_company(
  p_id uuid, p_reason text default null)
returns public.discovered_companies
language plpgsql security definer
set search_path = public
as $$
declare
  v_row public.discovered_companies;
begin
  if not public.can_manage_content() then
    raise exception 'Super Admin or Content Admin only' using errcode = '42501';
  end if;

  update public.discovered_companies
  set status = 'rejected', rejection_reason = p_reason, last_checked_at = now()
  where id = p_id
  returning * into v_row;

  if not found then raise exception 'Discovered company not found' using errcode = 'P0002'; end if;

  insert into public.admin_logs (admin_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'discovery.company_rejected', 'discovered_company', p_id::text,
          jsonb_build_object('reason', p_reason));
  return v_row;
end;
$$;

create or replace function public.merge_discovered_company(
  p_id uuid, p_target_org_id uuid)
returns public.discovered_companies
language plpgsql security definer
set search_path = public
as $$
declare
  v_row public.discovered_companies;
  v_old_org uuid;
begin
  if not public.can_manage_content() then
    raise exception 'Super Admin or Content Admin only' using errcode = '42501';
  end if;
  if not exists (select 1 from public.organizations where id = p_target_org_id) then
    raise exception 'Target organisation not found' using errcode = 'P0002';
  end if;

  select * into v_row from public.discovered_companies where id = p_id for update;
  if not found then raise exception 'Discovered company not found' using errcode = 'P0002'; end if;
  v_old_org := v_row.organization_id;

  update public.discovered_companies
  set organization_id = p_target_org_id, status = 'merged', last_checked_at = now()
  where id = p_id returning * into v_row;

  update public.discovered_opportunities
  set organization_id = p_target_org_id
  where discovered_company_id = p_id;

  if v_old_org is not null and v_old_org <> p_target_org_id then
    update public.opportunities
    set organization_id = p_target_org_id
    where organization_id = v_old_org;
  end if;

  insert into public.admin_logs (admin_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'discovery.company_merged', 'discovered_company', p_id::text,
          jsonb_build_object('from_organization_id', v_old_org,
                             'target_organization_id', p_target_org_id));
  return v_row;
end;
$$;

-- ---------------------------------------------------------------------
-- Opportunity candidate editing / promotion
-- ---------------------------------------------------------------------
create or replace function public.update_discovered_opportunity(
  p_id uuid, p_patch jsonb)
returns public.discovered_opportunities
language plpgsql security definer
set search_path = public
as $$
declare
  v_row public.discovered_opportunities;
  v_before jsonb;
begin
  if not public.can_manage_content() and not public.can_review_opportunities() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  select to_jsonb(d) into v_before from public.discovered_opportunities d where d.id = p_id for update;
  if v_before is null then raise exception 'Discovered opportunity not found' using errcode = 'P0002'; end if;

  update public.discovered_opportunities
  set title = coalesce(nullif(trim(p_patch ->> 'title'), ''), title),
      description = case when p_patch ? 'description' then nullif(trim(p_patch ->> 'description'), '') else description end,
      provider = case when p_patch ? 'provider' then nullif(trim(p_patch ->> 'provider'), '') else provider end,
      category = coalesce(nullif(trim(p_patch ->> 'category'), ''), category),
      opportunity_type = case when p_patch ? 'opportunity_type' then nullif(trim(p_patch ->> 'opportunity_type'), '') else opportunity_type end,
      location = case when p_patch ? 'location' then nullif(trim(p_patch ->> 'location'), '') else location end,
      province = coalesce(nullif(trim(p_patch ->> 'province'), ''), province),
      qualification = case when p_patch ? 'qualification' then nullif(trim(p_patch ->> 'qualification'), '') else qualification end,
      eligibility_criteria = case when p_patch ? 'eligibility_criteria' then nullif(trim(p_patch ->> 'eligibility_criteria'), '') else eligibility_criteria end,
      application_url = case when p_patch ? 'application_url' then nullif(trim(p_patch ->> 'application_url'), '') else application_url end,
      source_url = coalesce(nullif(trim(p_patch ->> 'source_url'), ''), source_url),
      closing_date = case when p_patch ? 'closing_date' then nullif(p_patch ->> 'closing_date', '')::date else closing_date end,
      is_remote = case when p_patch ? 'is_remote' then coalesce((p_patch ->> 'is_remote')::boolean, is_remote) else is_remote end,
      last_changed_at = now()
  where id = p_id
  returning * into v_row;

  insert into public.discovery_changes (entity_type, entity_id, source_id, change_type,
                                        changed_fields, previous_data, new_data)
  values ('opportunity', p_id, v_row.source_id, 'updated',
          array(select jsonb_object_keys(p_patch)),
          v_before, to_jsonb(v_row));

  insert into public.admin_logs (admin_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'discovery.opportunity_edited', 'discovered_opportunity', p_id::text,
          jsonb_build_object('fields', array(select jsonb_object_keys(p_patch))));
  return v_row;
end;
$$;

create or replace function public.promote_discovered_opportunity(p_id uuid)
returns public.opportunities
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_disc public.discovered_opportunities;
  v_src public.discovery_sources;
  v_org uuid;
  v_provider text;
  v_opp public.opportunities;
  v_external text;
begin
  if not public.can_review_opportunities() then
    raise exception 'Super Admin or Opportunity Admin only' using errcode = '42501';
  end if;

  select * into v_disc from public.discovered_opportunities where id = p_id for update;
  if not found then raise exception 'Discovered opportunity not found' using errcode = 'P0002'; end if;
  if v_disc.status = 'rejected' then raise exception 'A rejected opportunity cannot be promoted'; end if;

  if v_disc.opportunity_id is not null then
    select * into v_opp from public.opportunities where id = v_disc.opportunity_id;
    if found then return v_opp; end if;
  end if;

  select * into v_src from public.discovery_sources where id = v_disc.source_id;
  v_org := v_disc.organization_id;
  if v_org is null and v_disc.discovered_company_id is not null then
    select organization_id into v_org from public.discovered_companies
    where id = v_disc.discovered_company_id;
  end if;
  if v_org is null then
    select id into v_org from public.organizations
    where lower(trim(name)) = lower(trim(coalesce(v_disc.provider, '')))
    limit 1;
  end if;

  select name into v_provider from public.organizations where id = v_org;
  v_provider := coalesce(v_provider, v_disc.provider, v_src.name, 'Unknown organisation');
  v_external := 'discovery:' || coalesce(v_src.slug, 'source') || ':' ||
                coalesce(v_disc.external_id, v_disc.id::text);

  insert into public.opportunities (
    title, provider, category, province, qualification, closing_date,
    description, tags, requirements, sector, source_name, source_url,
    source_type, application_url, verification_status, published,
    organization_id, opportunity_type, location, is_remote,
    eligibility_criteria, external_reference, submission_source,
    content_hash, status)
  values (
    v_disc.title, v_provider, coalesce(v_disc.category, 'Other'),
    coalesce(v_disc.province, 'National'), coalesce(v_disc.qualification, 'Not specified'),
    v_disc.closing_date, coalesce(v_disc.description, ''), v_disc.tags,
    coalesce(v_disc.requirements, '{}'::jsonb), coalesce(v_src.name, 'Discovery'),
    coalesce(v_src.name, 'Discovery source'), v_disc.source_url,
    'third_party_api', v_disc.application_url, 'pending', false,
    v_org, v_disc.opportunity_type, v_disc.location, v_disc.is_remote,
    v_disc.eligibility_criteria, v_external, 'import', v_disc.content_hash, 'pending')
  on conflict do nothing
  returning * into v_opp;

  if v_opp.id is null then
    select * into v_opp from public.opportunities
    where external_reference = v_external
      and organization_id is not distinct from v_org
    limit 1;
  end if;

  if v_opp.id is null then
    raise exception 'The opportunity could not be imported';
  end if;

  update public.discovered_opportunities
  set opportunity_id = v_opp.id,
      organization_id = v_org,
      status = case when status in ('new', 'matched') then 'imported' else status end,
      imported_at = coalesce(imported_at, now()),
      last_checked_at = now()
  where id = p_id;

  insert into public.admin_logs (admin_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'discovery.opportunity_imported', 'discovered_opportunity', p_id::text,
          jsonb_build_object('opportunity_id', v_opp.id, 'organization_id', v_org,
                             'status', v_opp.status));

  return v_opp;
end;
$$;

create or replace function public.reject_discovered_opportunity(
  p_id uuid, p_reason text default null)
returns public.discovered_opportunities
language plpgsql security definer
set search_path = public
as $$
declare
  v_row public.discovered_opportunities;
begin
  if not public.can_review_opportunities() then
    raise exception 'Super Admin or Opportunity Admin only' using errcode = '42501';
  end if;

  update public.discovered_opportunities
  set status = 'rejected', rejection_reason = p_reason, last_checked_at = now()
  where id = p_id
  returning * into v_row;

  if not found then raise exception 'Discovered opportunity not found' using errcode = 'P0002'; end if;

  -- A pending imported copy is rejected with the discovery record. Approved or
  -- published copies are left for an explicit administrator decision.
  update public.opportunities
  set status = 'rejected', rejection_reason = coalesce(p_reason, 'Rejected during discovery review')
  where id = v_row.opportunity_id and status = 'pending';

  insert into public.admin_logs (admin_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'discovery.opportunity_rejected', 'discovered_opportunity', p_id::text,
          jsonb_build_object('reason', p_reason, 'opportunity_id', v_row.opportunity_id));
  return v_row;
end;
$$;

-- ---------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------
revoke all on function public.discovery_admin_stats() from public, anon;
revoke all on function public.upsert_discovery_source(uuid, text, text, text, text, text, boolean, boolean, integer, jsonb) from public, anon;
revoke all on function public.set_discovery_source_enabled(uuid, boolean) from public, anon;
revoke all on function public.update_discovered_company(uuid, jsonb) from public, anon;
revoke all on function public.promote_discovered_company(uuid, uuid) from public, anon;
revoke all on function public.reject_discovered_company(uuid, text) from public, anon;
revoke all on function public.merge_discovered_company(uuid, uuid) from public, anon;
revoke all on function public.update_discovered_opportunity(uuid, jsonb) from public, anon;
revoke all on function public.promote_discovered_opportunity(uuid) from public, anon;
revoke all on function public.reject_discovered_opportunity(uuid, text) from public, anon;

grant execute on function public.discovery_admin_stats() to authenticated, service_role;
grant execute on function public.upsert_discovery_source(uuid, text, text, text, text, text, boolean, boolean, integer, jsonb) to authenticated, service_role;
grant execute on function public.set_discovery_source_enabled(uuid, boolean) to authenticated, service_role;
grant execute on function public.update_discovered_company(uuid, jsonb) to authenticated, service_role;
grant execute on function public.promote_discovered_company(uuid, uuid) to authenticated, service_role;
grant execute on function public.reject_discovered_company(uuid, text) to authenticated, service_role;
grant execute on function public.merge_discovered_company(uuid, uuid) to authenticated, service_role;
grant execute on function public.update_discovered_opportunity(uuid, jsonb) to authenticated, service_role;
grant execute on function public.promote_discovered_opportunity(uuid) to authenticated, service_role;
grant execute on function public.reject_discovered_opportunity(uuid, text) to authenticated, service_role;
