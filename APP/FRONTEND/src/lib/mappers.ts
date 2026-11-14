import type {
  AdminListing,
  AdminListingStatus,
  AppNotification,
  ApplicationRecord,
  ApplicationStatus,
  CompanyApiKey,
  DeadlineReminderRecord,
  IconName,
  MatchDetail,
  NotificationGroup,
  NotificationPreferences,
  Opportunity,
  OpportunityCategory,
  OpportunityReport,
  OpportunityStatus,
  Organization,
  OrganizationStatus,
  ProfilePreferences,
  ProfileStatus,
  Province,
  SavedSearch,
  UserProfile,
} from '@/types';
import {
  APPLICATION_STATUSES,
  OPPORTUNITY_CATEGORIES,
  PROVINCES,
} from '@/types';
import { formatRelativeTime, formatShortDate } from '@/utils/date';

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Row = Record<string, any>;

const LEGACY_CATEGORY_MAP: Record<string, OpportunityCategory> = {
  'graduate programme': 'Graduate Programme',
  'graduate program': 'Graduate Programme',
  'skills training': 'Training',
  'youth programme': 'Other',
  'youth program': 'Other',
  'in service training': 'In-service Training',
  'farm job': 'Farm Job',
  scholarship: 'Scholarship',
  grant: 'Grant',
  wil: 'WIL',
};

export function normalizeCategory(value: unknown): OpportunityCategory {
  const raw = String(value ?? '').trim();
  const direct = OPPORTUNITY_CATEGORIES.find(
    (category) => category.toLowerCase() === raw.toLowerCase(),
  );
  if (direct) return direct;
  const legacy = LEGACY_CATEGORY_MAP[raw.toLowerCase()];
  return legacy ?? 'Other';
}

const PROVINCE_LOOKUP = new Map(
  PROVINCES.map((province) => [province.toLowerCase(), province]),
);

export function normalizeProvince(value: unknown): Province | 'National' {
  const raw = String(value ?? '').trim();
  if (!raw || ['nationwide', 'national', 'all'].includes(raw.toLowerCase())) {
    return 'National';
  }
  return PROVINCE_LOOKUP.get(raw.toLowerCase()) ?? 'National';
}

function normalizeMode(row: Row): Opportunity['mode'] {
  if (row.is_remote) return 'Remote';
  const haystack = `${row.location ?? ''} ${row.title ?? ''}`.toLowerCase();
  if (haystack.includes('hybrid')) return 'Hybrid';
  return 'On-site';
}

function splitCriteria(value: unknown): string[] {
  if (!value) return [];
  return String(value)
    .split(/\r?\n|;/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function buildEligibility(row: Row): string[] {
  const explicit = splitCriteria(row.eligibility_criteria);
  if (explicit.length > 0) return explicit;

  const items: string[] = [];
  const requirements = (row.requirements ?? {}) as Record<string, boolean>;
  if (row.qualification && row.qualification !== 'Not specified') {
    items.push(`Qualification: ${row.qualification}`);
  }
  if (requirements.studyLevel) items.push('Meeting the stated study level is required.');
  if (requirements.careerField) items.push('A relevant career field is required.');
  if (requirements.experience) items.push('Previous experience is required.');
  if (row.province && !['Nationwide', 'National'].includes(String(row.province))) {
    items.push(`Based in ${row.province}.`);
  }
  if (items.length === 0) {
    items.push('Open to all qualification levels.');
  }
  items.push('Always confirm the full criteria on the official listing.');
  return items;
}

function buildHowToApply(row: Row): string[] {
  const steps = [
    'Read the requirements and prepare the documents the provider asks for.',
  ];
  if (row.application_url) {
    steps.push('Open the official application page below and complete the form.');
  } else {
    steps.push('Open the official source below to find the application instructions.');
  }
  steps.push('Save this opportunity and record the closing date in your tracker.');
  return steps;
}

export function mapOpportunity(row: Row, match?: MatchDetail): Opportunity {
  const category = normalizeCategory(row.category);
  const province = normalizeProvince(row.province);
  const closingDate = row.closing_date ? String(row.closing_date) : '';
  const organisation =
    row.organizations?.name ?? row.provider ?? row.source_name ?? 'Unknown organisation';
  const qualification = row.qualification || 'Not specified';
  const field =
    row.opportunity_type ||
    row.sector ||
    (category === 'Other' ? 'General' : category);

  return {
    id: String(row.id),
    title: String(row.title ?? 'Untitled opportunity'),
    organisation,
    organizationId: row.organization_id ?? null,
    organizationVerified: Boolean(row.organizations?.is_verified),
    category,
    province,
    location: row.location || (province === 'National' ? 'Nationwide' : province),
    education: qualification,
    closes: closingDate ? formatShortDate(closingDate) : 'No closing date',
    closingDate,
    closingTone: 'normal',
    match: match?.score ?? 0,
    matchReasons: match?.reasons ?? [],
    summary: row.description || '',
    field,
    mode: normalizeMode(row),
    eligibility: buildEligibility(row),
    eligibilityCriteria: row.eligibility_criteria ?? '',
    qualifications: {
      education: qualification,
      field,
    },
    documents: [],
    howToApply: buildHowToApply(row),
    sourceName: row.source_name || organisation,
    sourceUrl: row.source_url || row.application_url || '',
    applicationUrl: row.application_url ?? null,
    lastUpdated: row.updated_at ? formatShortDate(row.updated_at) : '',
    isExpired: closingDate ? new Date(closingDate).getTime() < Date.now() : false,
    status: (row.status ?? 'published') as OpportunityStatus,
    tags: Array.isArray(row.tags) ? row.tags : [],
    isRemote: Boolean(row.is_remote),
    isFeatured: Boolean(row.is_featured),
    publishedAt: row.published_at ?? undefined,
    createdAt: row.created_at ?? undefined,
  };
}

/* ------------------------------------------------------------------ */
/* Profiles                                                            */
/* ------------------------------------------------------------------ */

const STATUS_MAP: Record<string, ProfileStatus> = {
  learner: 'Learner',
  student: 'Student',
  graduate: 'Graduate',
  'job seeker': 'Job seeker',
  jobseeker: 'Job seeker',
  employed: 'Other',
  other: 'Other',
};

export const defaultPreferences: ProfilePreferences = {
  careerFields: [],
  preferredLocation: '',
  workArrangement: 'Flexible',
  experience: '',
};

export const defaultNotificationPreferences: NotificationPreferences = {
  closingDates: true,
  newMatches: true,
  savedUpdates: true,
  opportunityTypes: [],
};

export function computeProfileCompletion(row: Row): number {
  const has = (value: unknown) => String(value ?? '').trim().length > 0;
  let score = 0;
  if (has(row.full_name)) score += 15;
  if (has(row.email)) score += 5;
  if (has(row.phone)) score += 5;
  if (has(row.province)) score += 10;
  if (has(row.qualification)) score += 10;
  if (has(row.field_of_study)) score += 10;
  if (has(row.institution)) score += 5;
  if (has(row.employment_status)) score += 5;
  if (row.date_of_birth) score += 5;
  if (Array.isArray(row.interests) && row.interests.length > 0) score += 15;
  const careerFields = row.preferences?.careerFields;
  if (Array.isArray(careerFields) && careerFields.length > 0) score += 10;
  if (has(row.avatar_url)) score += 5;
  return Math.min(100, score);
}

export function mapProfile(row: Row): UserProfile {
  const preferences = {
    ...defaultPreferences,
    ...(row.preferences ?? {}),
  } as ProfilePreferences;
  const notificationPreferences = {
    ...defaultNotificationPreferences,
    ...(row.notification_preferences ?? {}),
  } as NotificationPreferences;
  const name = String(row.full_name ?? row.email ?? 'Student');
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part: string) => part[0]?.toUpperCase() ?? '')
    .join('');

  return {
    id: String(row.id),
    name,
    initials: initials || 'S',
    email: String(row.email ?? ''),
    phone: String(row.phone ?? ''),
    status: STATUS_MAP[String(row.employment_status ?? 'student').toLowerCase()] ?? 'Student',
    education: String(row.qualification ?? ''),
    institution: String(row.institution ?? ''),
    fieldOfStudy: String(row.field_of_study ?? ''),
    province:
      normalizeProvince(row.province) === 'National'
        ? ''
        : (normalizeProvince(row.province) as Province),
    interests: Array.isArray(row.interests) ? row.interests : [],
    preferences,
    notificationPreferences,
    completion: computeProfileCompletion(row),
    avatarUrl: row.avatar_url ?? null,
    city: String(row.city ?? ''),
    bio: String(row.bio ?? ''),
    dateOfBirth: row.date_of_birth ? String(row.date_of_birth) : undefined,
    onboardingCompleted: Boolean(row.onboarding_completed),
  };
}

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

const NOTIFICATION_META: Record<string, { icon: string; target?: AppNotification['target'] }> = {
  new_opportunity: { icon: 'zap', target: '/matches' },
  application_update: { icon: 'clipboard', target: '/applications' },
  closing_soon: { icon: 'clock', target: '/deadlines' },
  deadline_reminder: { icon: 'clock', target: '/deadlines' },
  opportunity_reported: { icon: 'flag', target: '/alerts' },
  organization_update: { icon: 'briefcase' },
  system: { icon: 'info' },
  general: { icon: 'bell' },
};

function notificationGroup(createdAt: string): NotificationGroup {
  const created = new Date(createdAt);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (created.getTime() >= startOfToday) return 'Today';
  if (created.getTime() >= startOfToday - 86_400_000) return 'Yesterday';
  return 'Earlier';
}

export function mapNotification(row: Row): AppNotification {
  const meta = NOTIFICATION_META[row.type] ?? NOTIFICATION_META.general;
  return {
    id: String(row.id),
    title: String(row.title ?? 'Notification'),
    body: String(row.message ?? ''),
    time: formatRelativeTime(row.created_at),
    group: notificationGroup(String(row.created_at)),
    unread: !row.is_read,
    icon: meta.icon as IconName,
    target: row.opportunity_id
      ? (`/opportunity/${row.opportunity_id}` as const)
      : meta.target,
    createdAt: String(row.created_at),
    type: String(row.type),
  };
}

/* ------------------------------------------------------------------ */
/* Applications                                                        */
/* ------------------------------------------------------------------ */

export function toUiApplicationStatus(value: unknown): ApplicationStatus {
  const title = String(value ?? 'interested');
  const match = APPLICATION_STATUSES.find(
    (status) => status.toLowerCase() === title.toLowerCase(),
  );
  return match ?? 'Interested';
}

export function toDbApplicationStatus(value: ApplicationStatus): string {
  return value.toLowerCase();
}

export function mapApplication(row: Row): ApplicationRecord {
  return {
    id: String(row.id),
    opportunityId: String(row.opportunity_id),
    status: toUiApplicationStatus(row.status),
    updatedAt: formatShortDate(row.updated_at ?? row.created_at),
    source: 'user',
    appliedAt: row.applied_at ?? null,
    notes: row.notes ?? null,
    opportunityTitle: row.opportunities?.title ?? undefined,
    opportunityOrganisation:
      row.opportunities?.organizations?.name ??
      row.opportunities?.provider ??
      undefined,
  };
}

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */

export function mapAdminListing(row: Row): AdminListing {
  const rawStatus = (row.status ?? 'pending') as OpportunityStatus;
  const closingDate = row.closing_date ? String(row.closing_date) : '';
  const daysLeft = closingDate
    ? Math.round(
        (new Date(`${closingDate}T00:00:00`).getTime() -
          new Date(new Date().toDateString()).getTime()) /
          86_400_000,
      )
    : null;

  let status: AdminListingStatus;
  if (rawStatus === 'published' && daysLeft !== null && daysLeft < 0) status = 'Expired';
  else if (rawStatus === 'published' && daysLeft !== null && daysLeft <= 7) status = 'Closing soon';
  else if (rawStatus === 'published') status = 'Published';
  else if (rawStatus === 'approved') status = 'Approved';
  else if (rawStatus === 'rejected') status = 'Rejected';
  else status = 'Pending';

  return {
    id: String(row.id),
    title: String(row.title ?? ''),
    organisation: row.organizations?.name ?? row.provider ?? '',
    category: normalizeCategory(row.category),
    province: normalizeProvince(row.province),
    closes: closingDate ? formatShortDate(closingDate) : '',
    closingDate,
    status,
    rawStatus,
    description: String(row.description ?? ''),
    education: String(row.qualification ?? ''),
    eligibility: String(row.eligibility_criteria ?? ''),
    applicationUrl: String(row.application_url ?? ''),
    sourceUrl: String(row.source_url ?? ''),
    sourceChecked: row.last_verified_at ?? row.updated_at ?? row.created_at,
    organizationId: row.organization_id ?? null,
    rejectionReason: row.rejection_reason ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Discovery extras                                                    */
/* ------------------------------------------------------------------ */

export function mapSavedSearch(row: Row): SavedSearch {
  return {
    id: String(row.id),
    name: String(row.name ?? 'Saved search'),
    query: String(row.query ?? ''),
    filters: row.filters ?? {},
    notifyNew: Boolean(row.notify_new),
    createdAt: String(row.created_at),
  };
}

export function mapReport(row: Row): OpportunityReport {
  return {
    id: String(row.id),
    opportunityId: String(row.opportunity_id),
    reason: row.reason,
    details: String(row.details ?? ''),
    status: row.status,
    createdAt: String(row.created_at),
    reporterName: row.profiles?.full_name ?? undefined,
    opportunityTitle: row.opportunities?.title ?? undefined,
  };
}

export function mapReminder(row: Row): DeadlineReminderRecord {
  return {
    id: String(row.id),
    opportunityId: String(row.opportunity_id),
    daysBefore: Number(row.days_before ?? 7),
    sentAt: row.sent_at ?? null,
    createdAt: String(row.created_at),
  };
}

export function mapOrganization(row: Row): Organization {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    registeredBusinessName: row.registered_business_name ?? null,
    slug: row.slug ?? null,
    description: row.description ?? null,
    industry: row.industry ?? null,
    website: row.website ?? null,
    contactPerson: row.contact_person ?? null,
    contactEmail: row.contact_email ?? null,
    contactPhone: row.contact_phone ?? null,
    province: row.province ?? null,
    address: row.address ?? null,
    registrationNumber: row.registration_number ?? null,
    logoUrl: row.logo_url ?? null,
    status: (row.status ?? 'pending') as OrganizationStatus,
    apiEnabled: Boolean(row.api_enabled),
    integrationMethod: row.integration_method ?? 'none',
    isVerified: Boolean(row.is_verified),
    role: row.role ?? undefined,
    createdAt: String(row.created_at),
  };
}

export function mapApiKey(row: Row): CompanyApiKey {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    name: String(row.name ?? 'API key'),
    keyPrefix: String(row.key_prefix ?? ''),
    scopes: Array.isArray(row.scopes) ? row.scopes : [],
    status: row.status === 'revoked' ? 'revoked' : 'active',
    lastUsedAt: row.last_used_at ?? null,
    expiresAt: row.expires_at ?? null,
    createdAt: String(row.created_at),
  };
}
