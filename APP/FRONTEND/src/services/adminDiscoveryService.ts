import { AppError, toAppError } from '@/lib/errors';
import { requireSupabase } from '@/lib/supabase';

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type DiscoverySourceType = 'json' | 'rss' | 'html';

export type DiscoverySource = {
  id: string;
  name: string;
  slug: string;
  source_type: DiscoverySourceType;
  base_url: string;
  terms_url: string | null;
  license_note: string | null;
  is_enabled: boolean;
  requires_credentials: boolean;
  rate_limit_seconds: number;
  config: Record<string, unknown>;
  last_run_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export type DiscoveryRunStatus = 'running' | 'succeeded' | 'partial' | 'failed';

export type DiscoveryRun = {
  id: string;
  source_id: string;
  status: DiscoveryRunStatus;
  trigger_type: 'manual' | 'schedule' | 'retry';
  requested_by: string | null;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  items_found: number;
  companies_found: number;
  opportunities_found: number;
  duplicates: number;
  companies_imported: number;
  opportunities_imported: number;
  expired_count: number;
  error_count: number;
  error_summary: string | null;
  details: Record<string, unknown>;
  discovery_sources?: { name: string; source_type: string; slug: string } | null;
};

export type DiscoveredCompanyStatus =
  | 'new'
  | 'matched'
  | 'imported'
  | 'verified'
  | 'rejected'
  | 'merged';

export type DiscoveredCompany = {
  id: string;
  source_id: string;
  external_id: string | null;
  name: string;
  trading_name: string | null;
  registration_number: string | null;
  description: string | null;
  industry: string | null;
  sector: string | null;
  website: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  province: string | null;
  city: string | null;
  careers_url: string | null;
  source_url: string;
  status: DiscoveredCompanyStatus;
  organization_id: string | null;
  first_seen_at: string;
  last_seen_at: string;
  last_checked_at: string | null;
  rejection_reason: string | null;
  discovery_sources?: { name: string; source_type: string } | null;
};

export type DiscoveredOpportunityStatus =
  | 'new'
  | 'matched'
  | 'imported'
  | 'verified'
  | 'rejected'
  | 'expired'
  | 'duplicate';

export type DiscoveredOpportunity = {
  id: string;
  source_id: string;
  discovered_company_id: string | null;
  organization_id: string | null;
  opportunity_id: string | null;
  external_id: string | null;
  title: string;
  description: string | null;
  provider: string | null;
  category: string;
  opportunity_type: string | null;
  location: string | null;
  province: string;
  qualification: string | null;
  eligibility_criteria: string | null;
  application_url: string | null;
  source_url: string;
  opening_date: string | null;
  closing_date: string | null;
  is_remote: boolean;
  tags: string[];
  status: DiscoveredOpportunityStatus;
  first_seen_at: string;
  last_seen_at: string;
  last_checked_at: string | null;
  rejection_reason: string | null;
  discovery_sources?: { name: string; source_type: string } | null;
};

export type DiscoveryStats = {
  sources_total: number;
  sources_enabled: number;
  companies_total: number;
  companies_new: number;
  companies_imported: number;
  companies_verified: number;
  opportunities_total: number;
  opportunities_new: number;
  opportunities_imported: number;
  opportunities_expired: number;
  runs_total: number;
  runs_failed_24h: number;
  last_run: DiscoveryRun | null;
};

export type AdminAuditLog = {
  id: number;
  admin_id: string | null;
  actor_type: 'admin' | 'system' | 'api';
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
};

export interface DiscoveredCompanyPatch {
  name?: string;
  trading_name?: string | null;
  registration_number?: string | null;
  description?: string | null;
  industry?: string | null;
  sector?: string | null;
  website?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  province?: string | null;
  city?: string | null;
  careers_url?: string | null;
  source_url?: string;
}

export interface DiscoveredOpportunityPatch {
  title?: string;
  description?: string | null;
  provider?: string | null;
  category?: string;
  opportunity_type?: string | null;
  location?: string | null;
  province?: string;
  qualification?: string | null;
  eligibility_criteria?: string | null;
  application_url?: string | null;
  source_url?: string;
  closing_date?: string | null;
  is_remote?: boolean;
}

export interface NewDiscoverySource {
  name: string;
  source_type: DiscoverySourceType;
  base_url: string;
  terms_url?: string | null;
  license_note?: string | null;
  is_enabled?: boolean;
  requires_credentials?: boolean;
  rate_limit_seconds?: number;
  config?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/* Reads                                                                      */
/* -------------------------------------------------------------------------- */

export async function fetchDiscoveryStats(): Promise<DiscoveryStats> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('discovery_admin_stats');
  if (error) throw toAppError(error);
  return data as DiscoveryStats;
}

export async function listDiscoverySources(): Promise<DiscoverySource[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('discovery_sources')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw toAppError(error);
  return (data ?? []) as DiscoverySource[];
}

export async function listDiscoveryRuns(limit = 50): Promise<DiscoveryRun[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('discovery_runs')
    .select('*, discovery_sources(name, source_type, slug)')
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) throw toAppError(error);
  return (data ?? []) as unknown as DiscoveryRun[];
}

export async function listDiscoveredCompanies(
  status?: DiscoveredCompanyStatus | 'all',
  query = '',
): Promise<DiscoveredCompany[]> {
  const client = requireSupabase();
  let request = client
    .from('discovered_companies')
    .select('*, discovery_sources(name, source_type)')
    .order('last_seen_at', { ascending: false })
    .limit(200);
  if (status && status !== 'all') request = request.eq('status', status);
  if (query.trim()) {
    const term = query.trim().replace(/[%_,()]/g, ' ').trim();
    if (term) request = request.ilike('name', `%${term}%`);
  }
  const { data, error } = await request;
  if (error) throw toAppError(error);
  return (data ?? []) as unknown as DiscoveredCompany[];
}

export async function listDiscoveredOpportunities(
  status?: DiscoveredOpportunityStatus | 'all',
  query = '',
): Promise<DiscoveredOpportunity[]> {
  const client = requireSupabase();
  let request = client
    .from('discovered_opportunities')
    .select('*, discovery_sources(name, source_type)')
    .order('last_seen_at', { ascending: false })
    .limit(200);
  if (status && status !== 'all') request = request.eq('status', status);
  if (query.trim()) {
    const term = query.trim().replace(/[%_,()]/g, ' ').trim();
    if (term) request = request.ilike('title', `%${term}%`);
  }
  const { data, error } = await request;
  if (error) throw toAppError(error);
  return (data ?? []) as unknown as DiscoveredOpportunity[];
}

export async function listAuditLogs(limit = 100): Promise<AdminAuditLog[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('admin_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw toAppError(error);
  return (data ?? []) as AdminAuditLog[];
}

/* -------------------------------------------------------------------------- */
/* Mutations (audited SECURITY DEFINER RPCs)                                  */
/* -------------------------------------------------------------------------- */

export async function setDiscoverySourceEnabled(
  id: string,
  enabled: boolean,
): Promise<DiscoverySource> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('set_discovery_source_enabled', {
    p_id: id,
    p_enabled: enabled,
  });
  if (error) throw toAppError(error);
  return data as DiscoverySource;
}

export async function createDiscoverySource(
  source: NewDiscoverySource,
): Promise<DiscoverySource> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('upsert_discovery_source', {
    p_id: null,
    p_name: source.name,
    p_source_type: source.source_type,
    p_base_url: source.base_url,
    p_terms_url: source.terms_url ?? null,
    p_license_note: source.license_note ?? null,
    p_is_enabled: source.is_enabled ?? false,
    p_requires_credentials: source.requires_credentials ?? false,
    p_rate_limit_seconds: source.rate_limit_seconds ?? 3600,
    p_config: source.config ?? {},
  });
  if (error) throw toAppError(error);
  return data as DiscoverySource;
}

export async function updateDiscoveredCompany(
  id: string,
  patch: DiscoveredCompanyPatch,
): Promise<DiscoveredCompany> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('update_discovered_company', {
    p_id: id,
    p_patch: patch,
  });
  if (error) throw toAppError(error);
  return data as DiscoveredCompany;
}

export async function promoteDiscoveredCompany(
  id: string,
  organizationId?: string | null,
): Promise<{ id: string; name: string; status: string }> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('promote_discovered_company', {
    p_id: id,
    p_org_id: organizationId ?? null,
  });
  if (error) throw toAppError(error);
  return data as { id: string; name: string; status: string };
}

export async function rejectDiscoveredCompany(id: string, reason: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('reject_discovered_company', {
    p_id: id,
    p_reason: reason,
  });
  if (error) throw toAppError(error);
}

export async function mergeDiscoveredCompany(
  id: string,
  targetOrganizationId: string,
): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('merge_discovered_company', {
    p_id: id,
    p_target_org_id: targetOrganizationId,
  });
  if (error) throw toAppError(error);
}

export async function updateDiscoveredOpportunity(
  id: string,
  patch: DiscoveredOpportunityPatch,
): Promise<DiscoveredOpportunity> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('update_discovered_opportunity', {
    p_id: id,
    p_patch: patch,
  });
  if (error) throw toAppError(error);
  return data as DiscoveredOpportunity;
}

export async function promoteDiscoveredOpportunity(
  id: string,
): Promise<{ id: string; title: string; status: string }> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('promote_discovered_opportunity', { p_id: id });
  if (error) throw toAppError(error);
  return data as { id: string; title: string; status: string };
}

export async function rejectDiscoveredOpportunity(
  id: string,
  reason: string,
): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('reject_discovered_opportunity', {
    p_id: id,
    p_reason: reason,
  });
  if (error) throw toAppError(error);
}

/* -------------------------------------------------------------------------- */
/* Backend worker                                                             */
/* -------------------------------------------------------------------------- */

function apiBaseUrl(): string {
  const configured = (process.env.EXPO_PUBLIC_API_URL ?? '').trim();
  return (configured || 'http://localhost:3000').replace(/\/+$/, '');
}

export async function runDiscoverySource(
  sourceId: string,
): Promise<{ run: DiscoveryRun; stats: Record<string, unknown> }> {
  const client = requireSupabase();
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw toAppError(sessionError);
  const token = sessionData.session?.access_token;
  if (!token) {
    throw new AppError('Your administrator session has expired. Sign in again.', 'PGRST301');
  }

  let response: Response;
  try {
    response = await fetch(
      `${apiBaseUrl()}/api/admin/discovery/sources/${encodeURIComponent(sourceId)}/run`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: '{}',
      },
    );
  } catch {
    throw new AppError(
      'Could not reach the discovery worker. Check EXPO_PUBLIC_API_URL and that the backend is running.',
      'network_error',
    );
  }

  const payload = (await response.json().catch(() => null)) as
    | { data?: { run: DiscoveryRun; stats: Record<string, unknown> }; error?: { message?: string; code?: string } }
    | null;

  if (!response.ok) {
    throw new AppError(
      payload?.error?.message || `The discovery worker returned HTTP ${response.status}.`,
      payload?.error?.code,
    );
  }
  if (!payload?.data) {
    throw new AppError('The discovery worker returned an unexpected response.', 'invalid_response');
  }
  return payload.data;
}

export const adminDiscoveryService = {
  fetchDiscoveryStats,
  listDiscoverySources,
  listDiscoveryRuns,
  listDiscoveredCompanies,
  listDiscoveredOpportunities,
  listAuditLogs,
  setDiscoverySourceEnabled,
  createDiscoverySource,
  updateDiscoveredCompany,
  promoteDiscoveredCompany,
  rejectDiscoveredCompany,
  mergeDiscoveredCompany,
  updateDiscoveredOpportunity,
  promoteDiscoveredOpportunity,
  rejectDiscoveredOpportunity,
  runDiscoverySource,
};
