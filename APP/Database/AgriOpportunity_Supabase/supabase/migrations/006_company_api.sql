-- =====================================================================
-- 006_company_api.sql
-- Group B (part 2): company API integration
--   * company_api_keys          hashed credentials (plaintext never stored)
--   * api_submissions           every create / update / withdraw received
--   * api_logs                  every API request (monitoring)
--   * api_rate_limits           per-key request counters
--   * organization_sync_configs scheduled-sync settings per company
--
-- Key format handed to a company ONCE:  agri_<8 hex>_<48 hex>
-- Stored: key_prefix (agri_<8 hex>, for display) and key_hash
-- (SHA-256 of the full key). The keys are long random strings, so a fast
-- hash is appropriate. Keys are created / revoked / verified only by the
-- functions in 009.
-- =====================================================================

create table if not exists public.company_api_keys (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name            text not null default 'Default key',
  key_prefix      text not null unique,
  key_hash        text not null unique,
  scopes          text[] not null default array['opportunities:read', 'opportunities:write'],
  status          text not null default 'active' check (status in ('active', 'revoked')),
  last_used_at    timestamptz,
  expires_at      timestamptz,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  revoked_by      uuid references auth.users (id) on delete set null,
  revoked_at      timestamptz
);

create index if not exists company_api_keys_org_idx on public.company_api_keys (organization_id, status);

create table if not exists public.api_submissions (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations (id) on delete cascade,
  api_key_id         uuid references public.company_api_keys (id) on delete set null,
  opportunity_id     uuid references public.opportunities (id) on delete set null,
  event_type         text not null check (event_type in ('created', 'updated', 'withdrawn')),
  submission_source  text not null check (submission_source in ('company_api', 'webhook', 'scheduled_sync')),
  external_reference text,
  payload            jsonb,
  payload_hash       text,
  status             text not null check (status in ('accepted', 'duplicate', 'rejected', 'error')),
  error_message      text,
  created_at         timestamptz not null default now()
);

create index if not exists api_submissions_org_idx    on public.api_submissions (organization_id, created_at desc);
create index if not exists api_submissions_opp_idx    on public.api_submissions (opportunity_id);
create index if not exists api_submissions_status_idx on public.api_submissions (status, created_at desc);

create table if not exists public.api_logs (
  id              bigint generated always as identity primary key,
  organization_id uuid references public.organizations (id) on delete cascade,
  api_key_id      uuid references public.company_api_keys (id) on delete set null,
  request_id      text,
  method          text not null,
  endpoint        text not null,
  status_code     integer,
  duration_ms     integer,
  ip_address      text,
  user_agent      text,
  error_message   text,
  created_at      timestamptz not null default now()
);

create index if not exists api_logs_org_idx  on public.api_logs (organization_id, created_at desc);
create index if not exists api_logs_time_idx on public.api_logs (created_at desc);

create table if not exists public.api_rate_limits (
  api_key_id    uuid not null references public.company_api_keys (id) on delete cascade,
  window_start  timestamptz not null,
  request_count integer not null default 0,
  primary key (api_key_id, window_start)
);

-- Scheduled synchronisation for companies without webhooks.
-- The company's credential for OUR calls to THEIR system is NOT stored here:
-- keep it in Supabase Vault and put only the secret's id in vault_secret_id.
create table if not exists public.organization_sync_configs (
  organization_id  uuid primary key references public.organizations (id) on delete cascade,
  enabled          boolean not null default false,
  sync_url         text not null,
  auth_header_name text not null default 'Authorization',
  vault_secret_id  uuid,
  interval_minutes integer not null default 60 check (interval_minutes >= 5),
  last_synced_at   timestamptz,
  last_status      text,
  last_error       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.company_api_keys is 'Hashed company credentials. Plaintext is shown once at creation and never stored.';
comment on table public.api_submissions  is 'Every opportunity create/update/withdraw received from a company, with outcome.';
comment on table public.api_logs         is 'API request log for monitoring and rate-limit investigation.';
