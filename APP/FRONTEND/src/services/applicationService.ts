import type { ApplicationRecord, ApplicationStatus } from '@/types';
import { toAppError } from '@/lib/errors';
import { mapApplication, toDbApplicationStatus, type Row } from '@/lib/mappers';
import { requireSupabase } from '@/lib/supabase';

export async function listApplications(userId: string): Promise<ApplicationRecord[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('applications')
    .select('*, opportunities(title, provider, organizations(name))')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) throw toAppError(error);
  return (data ?? []).map((row: Row) => mapApplication(row));
}

export async function createApplication(
  userId: string,
  opportunityId: string,
): Promise<ApplicationRecord> {
  const client = requireSupabase();

  const { data: existing, error: findError } = await client
    .from('applications')
    .select('*')
    .eq('user_id', userId)
    .eq('opportunity_id', opportunityId)
    .maybeSingle();
  if (findError) throw toAppError(findError);
  if (existing) return mapApplication(existing as Row);

  const { data, error } = await client
    .from('applications')
    .insert({ user_id: userId, opportunity_id: opportunityId, status: 'interested' })
    .select('*')
    .single();
  if (error) throw toAppError(error);
  return mapApplication(data as Row);
}

export async function updateApplication(
  userId: string,
  applicationId: string,
  status: ApplicationStatus,
  notes?: string,
): Promise<ApplicationRecord> {
  const client = requireSupabase();
  const dbStatus = toDbApplicationStatus(status);
  const patch: Record<string, unknown> = { status: dbStatus };
  if (notes !== undefined) patch.notes = notes;
  if (dbStatus === 'applied') patch.applied_at = new Date().toISOString();

  const { data, error } = await client
    .from('applications')
    .update(patch)
    .eq('id', applicationId)
    .eq('user_id', userId)
    .select('*')
    .single();
  if (error) throw toAppError(error);
  return mapApplication(data as Row);
}

export async function deleteApplication(
  userId: string,
  applicationId: string,
): Promise<void> {
  const client = requireSupabase();
  const { error } = await client
    .from('applications')
    .delete()
    .eq('id', applicationId)
    .eq('user_id', userId);
  if (error) throw toAppError(error);
}

export async function listApplicationHistory(applicationId: string) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('application_status_history')
    .select('*')
    .eq('application_id', applicationId)
    .order('created_at', { ascending: true });
  if (error) throw toAppError(error);
  return data ?? [];
}

export const applicationService = {
  listApplications,
  createApplication,
  updateApplication,
  deleteApplication,
  listApplicationHistory,
};
