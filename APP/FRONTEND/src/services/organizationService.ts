import type {
  ApiSubmission,
  ApplicationStatus,
  CompanyApiKey,
  CompanyApplication,
  Opportunity,
  Organization,
} from '@/types';
import { toAppError } from '@/lib/errors';
import {
  mapApiKey,
  mapOpportunity,
  mapOrganization,
  toUiApplicationStatus,
  type Row,
} from '@/lib/mappers';
import { requireSupabase } from '@/lib/supabase';

export interface OrganizationDraft {
  name: string;
  registeredBusinessName?: string;
  description?: string;
  industry?: string;
  website?: string;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  province?: string;
  address?: string;
  registrationNumber?: string;
  logoUrl?: string;
}

export interface CompanyOpportunityDraft {
  title: string;
  description: string;
  category: string;
  opportunityType?: string;
  province?: string;
  location?: string;
  closingDate?: string;
  qualification?: string;
  requirements?: string;
  applicationUrl?: string;
  isRemote?: boolean;
}

export async function listMyOrganizations(userId: string): Promise<Organization[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('organization_members')
    .select('role, organizations(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw toAppError(error);

  const organizations: Organization[] = [];
  for (const row of data ?? []) {
    const organization = (row as Row).organizations;
    if (!organization) continue;
    organizations.push({ ...mapOrganization(organization), role: row.role });
  }
  return organizations;
}

export async function getOrganization(organizationId: string): Promise<Organization | null> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('organizations')
    .select('*')
    .eq('id', organizationId)
    .maybeSingle();
  if (error) throw toAppError(error);
  return data ? mapOrganization(data as Row) : null;
}

export async function registerOrganization(
  userId: string,
  draft: OrganizationDraft,
): Promise<Organization> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('organizations')
    .insert({
      name: draft.name.trim(),
      registered_business_name: draft.registeredBusinessName?.trim() || null,
      description: draft.description?.trim() || null,
      industry: draft.industry?.trim() || null,
      website: draft.website?.trim() || null,
      contact_person: draft.contactPerson?.trim() || null,
      contact_email: draft.contactEmail?.trim() || null,
      contact_phone: draft.contactPhone?.trim() || null,
      province: draft.province || null,
      address: draft.address?.trim() || null,
      registration_number: draft.registrationNumber?.trim() || null,
      logo_url: draft.logoUrl?.trim() || null,
      created_by: userId,
      status: 'pending',
      api_enabled: false,
    })
    .select('*')
    .single();
  if (error) throw toAppError(error);
  return { ...mapOrganization(data as Row), role: 'owner' };
}

export async function updateOrganization(
  organizationId: string,
  patch: Partial<OrganizationDraft>,
): Promise<Organization> {
  const client = requireSupabase();
  // Only send fields the caller actually supplied, so a partial edit cannot
  // silently blank unrelated company details.
  const payload: Record<string, string | null> = {};
  if (patch.name !== undefined) payload.name = patch.name.trim();
  if (patch.registeredBusinessName !== undefined) {
    payload.registered_business_name = patch.registeredBusinessName.trim() || null;
  }
  if (patch.description !== undefined) {
    payload.description = patch.description.trim() || null;
  }
  if (patch.industry !== undefined) payload.industry = patch.industry.trim() || null;
  if (patch.website !== undefined) payload.website = patch.website.trim() || null;
  if (patch.contactPerson !== undefined) {
    payload.contact_person = patch.contactPerson.trim() || null;
  }
  if (patch.contactEmail !== undefined) {
    payload.contact_email = patch.contactEmail.trim() || null;
  }
  if (patch.contactPhone !== undefined) {
    payload.contact_phone = patch.contactPhone.trim() || null;
  }
  if (patch.province !== undefined) payload.province = patch.province || null;
  if (patch.address !== undefined) payload.address = patch.address.trim() || null;
  if (patch.registrationNumber !== undefined) {
    payload.registration_number = patch.registrationNumber.trim() || null;
  }
  if (patch.logoUrl !== undefined) payload.logo_url = patch.logoUrl.trim() || null;

  const { data, error } = await client
    .from('organizations')
    .update(payload)
    .eq('id', organizationId)
    .select('*')
    .single();
  if (error) throw toAppError(error);
  return mapOrganization(data as Row);
}

export async function listOrganizationOpportunities(
  organizationId: string,
): Promise<Opportunity[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('opportunities')
    .select('*, organizations(name, is_verified, logo_url)')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });
  if (error) throw toAppError(error);
  return (data ?? []).map((row: Row) => mapOpportunity(row));
}

export async function listApiKeys(organizationId: string): Promise<CompanyApiKey[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('company_api_keys')
    .select(
      'id, organization_id, name, key_prefix, scopes, status, last_used_at, expires_at, created_at, revoked_at',
    )
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });
  if (error) throw toAppError(error);
  return (data ?? []).map((row: Row) => mapApiKey(row));
}

export async function listSubmissions(
  organizationId: string,
  limit = 30,
): Promise<ApiSubmission[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('api_submissions')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw toAppError(error);
  return (data ?? []).map((row: Row) => ({
    id: String(row.id),
    eventType: row.event_type,
    submissionSource: String(row.submission_source),
    externalReference: row.external_reference ?? null,
    status: row.status,
    errorMessage: row.error_message ?? null,
    createdAt: String(row.created_at),
    opportunityId: row.opportunity_id ?? null,
  }));
}

/* -------------------------------------------------------------------------- */
/* Company portal: opportunities and applicant review                          */
/*                                                                             */
/* All writes go through SECURITY DEFINER RPCs added in migration 015. The     */
/* functions re-check org membership + approval server-side, so hiding a       */
/* button in the app is never the only protection.                             */
/* -------------------------------------------------------------------------- */

function opportunityPayload(draft: CompanyOpportunityDraft): Record<string, unknown> {
  return {
    title: draft.title.trim(),
    description: draft.description.trim(),
    category: draft.category,
    opportunity_type: draft.opportunityType?.trim() || null,
    province: draft.province?.trim() || null,
    location: draft.location?.trim() || null,
    closing_date: draft.closingDate?.trim() || null,
    qualification: draft.qualification?.trim() || null,
    eligibility_criteria: draft.requirements?.trim() || null,
    application_url: draft.applicationUrl?.trim() || null,
    is_remote: Boolean(draft.isRemote),
  };
}

export async function createCompanyOpportunity(
  organizationId: string,
  draft: CompanyOpportunityDraft,
): Promise<string> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('company_create_opportunity', {
    p_org_id: organizationId,
    p_payload: opportunityPayload(draft),
  });
  if (error) throw toAppError(error);
  return String(data);
}

export async function updateCompanyOpportunity(
  opportunityId: string,
  draft: CompanyOpportunityDraft,
): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('company_update_opportunity', {
    p_opportunity_id: opportunityId,
    p_payload: opportunityPayload(draft),
  });
  if (error) throw toAppError(error);
}

/**
 * Deletes a listing that has not been reviewed yet, or withdraws a live one
 * (status `rejected` + `withdrawn_at`), so student application history is
 * never silently destroyed.
 */
export async function deleteCompanyOpportunity(opportunityId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('company_delete_opportunity', {
    p_opportunity_id: opportunityId,
  });
  if (error) throw toAppError(error);
}

export async function listCompanyApplications(
  organizationId: string,
): Promise<CompanyApplication[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('applications')
    .select(
      'id, user_id, opportunity_id, status, applied_at, notes, updated_at, opportunities!inner(id, title, organization_id)',
    )
    .eq('opportunities.organization_id', organizationId)
    .order('updated_at', { ascending: false });
  if (error) throw toAppError(error);

  const rows = (data ?? []) as Row[];
  const userIds = [
    ...new Set(
      rows
        .map((row) => row.user_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    ),
  ];

  const profiles = new Map<string, { name: string; email: string | null; phone: string | null }>();
  if (userIds.length > 0) {
    const { data: profileRows, error: profileError } = await client
      .from('profiles')
      .select('id, full_name, email, phone')
      .in('id', userIds);
    // A company only sees applicant profiles through the RLS policy added in
    // migration 015. If that policy is not applied yet, keep the application
    // rows visible with an anonymous label rather than failing the screen.
    if (!profileError) {
      for (const profile of profileRows ?? []) {
        profiles.set(String(profile.id), {
          name: String(profile.full_name ?? '').trim(),
          email: profile.email ?? null,
          phone: profile.phone ?? null,
        });
      }
    }
  }

  return rows.map((row) => {
    const opportunity = row.opportunities as Row | null;
    const profile = profiles.get(String(row.user_id));
    return {
      id: String(row.id),
      userId: String(row.user_id),
      opportunityId: String(row.opportunity_id),
      opportunityTitle: String(opportunity?.title ?? 'Opportunity'),
      applicantName: profile?.name || 'Student applicant',
      applicantEmail: profile?.email ?? null,
      applicantPhone: profile?.phone ?? null,
      status: toUiApplicationStatus(row.status),
      appliedAt: row.applied_at ?? null,
      updatedAt: String(row.updated_at ?? row.created_at ?? ''),
      notes: row.notes ?? null,
    };
  });
}

export async function setCompanyApplicationStatus(
  applicationId: string,
  status: ApplicationStatus,
  note?: string,
): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('company_set_application_status', {
    p_application_id: applicationId,
    p_status: status.toLowerCase(),
    p_note: note?.trim() || null,
  });
  if (error) throw toAppError(error);
}

export const organizationService = {
  listMyOrganizations,
  getOrganization,
  registerOrganization,
  updateOrganization,
  listOrganizationOpportunities,
  createCompanyOpportunity,
  updateCompanyOpportunity,
  deleteCompanyOpportunity,
  listCompanyApplications,
  setCompanyApplicationStatus,
  listApiKeys,
  listSubmissions,
};
