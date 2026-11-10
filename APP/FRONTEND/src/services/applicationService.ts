import { mockApplications } from '@/data/applications';
import type { ApplicationRecord, ApplicationStatus } from '@/types';
import { formatShortDate } from '@/utils/date';
import { delay } from '@/services/simulate';

export async function getApplications(): Promise<ApplicationRecord[]> {
  await delay(220);
  return mockApplications;
}

export function updateApplicationStatus(
  applications: ApplicationRecord[],
  id: string,
  status: ApplicationStatus,
): ApplicationRecord[] {
  return applications.map((application) =>
    application.id === id
      ? { ...application, status, updatedAt: formatShortDate(new Date()) }
      : application,
  );
}

export function addApplicationRecord(
  applications: ApplicationRecord[],
  opportunityId: string,
): ApplicationRecord[] {
  if (applications.some((application) => application.opportunityId === opportunityId)) {
    return applications;
  }
  return [
    ...applications,
    {
      id: `a-${Date.now()}`,
      opportunityId,
      status: 'Interested',
      updatedAt: formatShortDate(new Date()),
      source: 'user',
    },
  ];
}

export const applicationService = {
  getApplications,
  updateApplicationStatus,
  addApplicationRecord,
};
