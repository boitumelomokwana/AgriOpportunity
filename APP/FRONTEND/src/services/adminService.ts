import type {
  AdminListing,
  AdminSummary,
  Opportunity,
  Province,
  WorkMode,
} from '@/types';
import { daysUntil, formatShortDate } from '@/utils/date';
import { apiRequest } from '@/services/api';

interface AdminOpportunity extends Opportunity {
  published: boolean;
}

const closingSoonDays = 14;

function splitList(value: string): string[] {
  return value
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean);
}

function clampMatch(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function closingToneFor(closingDate: string): Opportunity['closingTone'] {
  const remaining = daysUntil(closingDate);
  if (remaining <= 7) return 'urgent';
  if (remaining <= 30) return 'soon';
  return 'normal';
}

function toAdminListing(opportunity: AdminOpportunity): AdminListing {
  const remaining = daysUntil(opportunity.closingDate);
  const status: AdminListing['status'] = !opportunity.published
    ? 'Draft'
    : remaining < 0
      ? 'Expired'
      : remaining <= closingSoonDays
        ? 'Closing soon'
        : 'Published';

  return {
    id: opportunity.id,
    title: opportunity.title,
    organisation: opportunity.organisation,
    category: opportunity.category,
    province: opportunity.province === 'National' ? 'Gauteng' : opportunity.province,
    closes: opportunity.closes,
    closingDate: opportunity.closingDate,
    status,
    description: opportunity.summary,
    education: opportunity.education,
    eligibility: opportunity.eligibility.join('; '),
    openingDate: opportunity.lastUpdated,
    applicationMethod: opportunity.howToApply[0] ?? 'External official website',
    sourceUrl: opportunity.sourceUrl,
    sourceChecked: opportunity.lastUpdated,
    documents: opportunity.documents,
    qualificationsField: opportunity.qualifications.field,
    mode: opportunity.mode,
    match: opportunity.match,
    location: opportunity.location,
    sourceName: opportunity.sourceName,
  };
}

function toOpportunity(listing: AdminListing, published: boolean): Opportunity {
  const parsed = new Date(listing.closingDate);
  const closingDate = Number.isNaN(parsed.getTime())
    ? new Date().toISOString()
    : parsed.toISOString();
  const province: Province | 'National' = listing.province;
  const field = listing.qualificationsField ?? 'General';

  return {
    id: listing.id,
    title: listing.title.trim(),
    organisation: listing.organisation.trim(),
    category: listing.category,
    province,
    location: listing.location ?? listing.province,
    education: listing.education,
    closes: formatShortDate(new Date(closingDate)),
    closingDate,
    closingTone: closingToneFor(closingDate),
    match: clampMatch(listing.match ?? 50),
    summary: listing.description,
    field,
    mode: (listing.mode ?? 'On-site') as WorkMode,
    eligibility: splitList(listing.eligibility),
    qualifications: { education: listing.education, field },
    documents: listing.documents ?? [],
    howToApply: listing.applicationMethod ? [listing.applicationMethod] : [],
    sourceName: listing.sourceName ?? 'Administrator entry',
    sourceUrl: listing.sourceUrl.trim(),
    lastUpdated: new Date().toISOString(),
    isExpired: daysUntil(closingDate) < 0,
    published,
  } as Opportunity & { published: boolean };
}

export async function getAdminListings(): Promise<AdminListing[]> {
  const records = await apiRequest<AdminOpportunity[]>('/admin/opportunities');
  return records.map(toAdminListing);
}

export async function saveAdminListing(
  listing: AdminListing,
  mode: 'draft' | 'publish',
): Promise<AdminListing> {
  const published = mode === 'publish';
  const saved = await apiRequest<AdminOpportunity>(
    `/admin/opportunities/${encodeURIComponent(listing.id)}`,
    {
      method: 'PUT',
      body: JSON.stringify(toOpportunity(listing, published)),
    },
  );
  return toAdminListing(saved);
}

export async function markSourceChecked(listing: AdminListing): Promise<AdminListing> {
  const published = listing.status !== 'Draft';
  const saved = await apiRequest<AdminOpportunity>(
    `/admin/opportunities/${encodeURIComponent(listing.id)}`,
    {
      method: 'PUT',
      body: JSON.stringify({
        ...toOpportunity(listing, published),
        lastUpdated: new Date().toISOString(),
      }),
    },
  );
  return toAdminListing(saved);
}

export async function deleteAdminListing(id: string): Promise<void> {
  await apiRequest<void>(`/admin/opportunities/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export function summariseListings(listings: AdminListing[]): AdminSummary {
  return listings.reduce<AdminSummary>(
    (summary, listing) => {
      if (listing.status === 'Draft') summary.drafts += 1;
      if (listing.status === 'Expired') summary.expired += 1;
      if (listing.status === 'Closing soon') summary.closingSoon += 1;
      if (listing.status === 'Published' || listing.status === 'Closing soon') {
        summary.active += 1;
      }
      return summary;
    },
    { active: 0, drafts: 0, closingSoon: 0, expired: 0 },
  );
}

export const adminService = {
  getAdminListings,
  saveAdminListing,
  markSourceChecked,
  deleteAdminListing,
  summariseListings,
};
