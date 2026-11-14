import type { ApplicationRecord } from '@/types';
import { daysFromNow, formatShortDate } from '@/utils/date';

export const mockApplications: ApplicationRecord[] = [
  {
    id: 'a1',
    opportunityId: '1',
    status: 'Interested',
    updatedAt: formatShortDate(daysFromNow(-3)),
    source: 'user',
  },
  {
    id: 'a2',
    opportunityId: '2',
    status: 'Applied',
    updatedAt: formatShortDate(daysFromNow(-8)),
    source: 'user',
  },
];
