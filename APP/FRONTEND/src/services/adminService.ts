import type {
  AdminAnalytics,
  AdminListing,
  AdminStats,
  OpportunityReport,
  Organization,
} from '@/types';
import { toAppError } from '@/lib/errors';
import {
  mapAdminListing,
  mapOrganization,
  mapReport,
  type Row,
} from '@/lib/mappers';
import { requireSupabase } from '@/lib/supabase';

export async function fetchDashboardStats(): Promise<AdminStats> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('admin_dashboard_stats');
  if (error) throw toAppError(error);
  return data as AdminStats;
}

export async function fetchAnalytics(): Promise<AdminAnalytics> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('admin_analytics');
  if (error) throw toAppError(error);
  return data as AdminAnalytics;
}

export async function fetchQualityReport() {
  const client = requireSupabase();
  const { data, error } = await client.rpc('opportunity_quality_report');
  if (error) throw toAppError(error);
  return data as {
    published_without_application_url: { id: string; title: string }[];
    published_and_past_closing: { id: string; title: string; closing_date: string }[];
    stale_source_check: { id: string; title: string; last_verified_at: string | null }[];
    duplicate_titles: { title: string; count: number }[];
    zero_view_published: number;
  };
}

export async function listAllOpportunities(status?: string): Promise<AdminListing[]> {
  const client = requireSupabase();
  let query = client
    .from('opportunities')
    .select('*, organizations(name, is_verified)')
    .order('created_at', { ascending: false })
    .limit(200);
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw toAppError(error);
  return (data ?? []).map((row: Row) => mapAdminListing(row));
}

export async function listOrganizations(status?: string): Promise<Organization[]> {
  const client = requireSupabase();
  let query = client.from('organizations').select('*').order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw toAppError(error);
  return (data ?? []).map((row: Row) => mapOrganization(row));
}

export async function listReports(status?: string): Promise<OpportunityReport[]> {
  const client = requireSupabase();
  // opportunity_reports.user_id points at auth.users, not public.profiles, so
  // PostgREST cannot embed profiles directly. Fetch the small reporter map in
  // a second query instead. RLS decides which profiles the caller may read;
  // non-Super Admins simply get "Student" for accounts they cannot see.
  let query = client
    .from('opportunity_reports')
    .select('*, opportunities(title)')
    .order('created_at', { ascending: false })
    .limit(100);
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw toAppError(error);

  const rows = (data ?? []) as Row[];
  const userIds = [
    ...new Set(
      rows
        .map((row) => row.user_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    ),
  ];
  const names = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles, error: profileError } = await client
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds);
    if (!profileError) {
      for (const profile of profiles ?? []) {
        names.set(String(profile.id), String(profile.full_name ?? ''));
      }
    }
  }

  return rows.map((row) => {
    const name = row.user_id ? names.get(String(row.user_id)) : '';
    return mapReport({
      ...row,
      profiles: name ? { full_name: name } : null,
    });
  });
}

export async function reviewOpportunity(
  opportunityId: string,
  action: 'approve' | 'reject' | 'publish' | 'unpublish',
  reason?: string,
): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('review_opportunity', {
    p_id: opportunityId,
    p_action: action,
    p_reason: reason ?? null,
  });
  if (error) throw toAppError(error);
}

export async function setOrganizationStatus(
  organizationId: string,
  status: Organization['status'],
  reason?: string,
): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('set_organization_status', {
    p_org_id: organizationId,
    p_status: status,
    p_reason: reason ?? null,
  });
  if (error) throw toAppError(error);
}

export async function verifyOrganization(
  organizationId: string,
  verified: boolean,
): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('verify_organization', {
    p_org_id: organizationId,
    p_verified: verified,
  });
  if (error) throw toAppError(error);
}

export async function reviewReport(
  reportId: string,
  status: 'reviewing' | 'resolved' | 'dismissed',
  note?: string,
): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('review_report', {
    p_report_id: reportId,
    p_status: status,
    p_note: note ?? null,
  });
  if (error) throw toAppError(error);
}

export async function generateApiKey(
  organizationId: string,
  name: string,
): Promise<{ apiKey: string; keyPrefix: string }> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('generate_company_api_key', {
    p_org_id: organizationId,
    p_name: name,
  });
  if (error) throw toAppError(error);
  const payload = data as { api_key: string; key_prefix: string };
  return { apiKey: payload.api_key, keyPrefix: payload.key_prefix };
}

export async function revokeApiKey(keyId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('revoke_company_api_key', { p_key_id: keyId });
  if (error) throw toAppError(error);
}

export interface AdminUserRow {
  id: string;
  full_name: string;
  email: string;
  province: string;
  qualification: string;
  is_suspended: boolean;
  admin_role: string | null;
  interest_count: number;
  created_at: string;
  last_active_at: string;
}

export async function listUsers(query = ''): Promise<AdminUserRow[]> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('admin_list_users', {
    p_query: query || null,
    p_limit: 100,
  });
  if (error) throw toAppError(error);
  return (data ?? []) as AdminUserRow[];
}

export async function setUserSuspended(userId: string, suspended: boolean): Promise<void> {
  const client = requireSupabase();
  const { error } = await client
    .from('profiles')
    .update({ is_suspended: suspended })
    .eq('id', userId);
  if (error) throw toAppError(error);
}

export async function assignAdminRole(
  userId: string,
  role: 'super_admin' | 'opportunity_admin' | 'content_admin',
  active = true,
): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('assign_admin_role', {
    p_user_id: userId,
    p_role: role,
    p_is_active: active,
  });
  if (error) throw toAppError(error);
}

export const adminService = {
  fetchDashboardStats,
  fetchAnalytics,
  fetchQualityReport,
  listAllOpportunities,
  listOrganizations,
  listReports,
  reviewOpportunity,
  setOrganizationStatus,
  verifyOrganization,
  reviewReport,
  generateApiKey,
  revokeApiKey,
  listUsers,
  setUserSuspended,
  assignAdminRole,
};
