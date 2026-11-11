import type { ApplicationRecord, ApplicationStatus } from '@/types';
import { formatShortDate } from '@/utils/date';
import { apiRequest } from '@/services/api';

export async function getApplications(): Promise<ApplicationRecord[]> {
  const records = await apiRequest<ApplicationRecord[]>('/me/applications');
  return records.map((record) => ({
    ...record,
    updatedAt: formatShortDate(record.updatedAt),
  }));
}

export async function updateApplicationStatus(
  id: string,
  status: ApplicationStatus,
): Promise<void> {
  await apiRequest(`/me/applications/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function addApplicationRecord(
  opportunityId: string,
): Promise<ApplicationRecord> {
  const record = await apiRequest<ApplicationRecord>(
    `/me/applications/${encodeURIComponent(opportunityId)}`,
    { method: 'POST' },
  );
  return { ...record, updatedAt: formatShortDate(record.updatedAt) };
}

export const applicationService = {
  getApplications,
  updateApplicationStatus,
  addApplicationRecord,
};
