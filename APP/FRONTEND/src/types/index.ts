import { Feather } from '@expo/vector-icons';

export type IconName = keyof typeof Feather.glyphMap;

export const PROVINCES = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'Northern Cape',
  'North West',
  'Western Cape',
] as const;

export type Province = (typeof PROVINCES)[number];

/**
 * Canonical names used by the database `categories` table. The legacy
 * labels at the end are kept so the old demo data files still type-check
 * (they are no longer imported at runtime).
 */
export const OPPORTUNITY_CATEGORIES = [
  'Bursary',
  'WIL',
  'Internship',
  'In-service Training',
  'Learnership',
  'Apprenticeship',
  'Grant',
  'Farm Job',
  'Graduate Programme',
  'Job',
  'Scholarship',
  'Training',
  'Other',
  // legacy labels (superset, safe for old fixtures)
  'Graduate programme',
  'Skills training',
  'Youth programme',
] as const;

export type OpportunityCategory = (typeof OPPORTUNITY_CATEGORIES)[number];

export const WORK_MODES = ['On-site', 'Hybrid', 'Remote'] as const;
export type WorkMode = (typeof WORK_MODES)[number];

export const EDUCATION_LEVELS = [
  'Any level',
  'Grade 12',
  'Diploma',
  'Degree',
  'Postgraduate',
] as const;
export type EducationLevel = (typeof EDUCATION_LEVELS)[number];

export const CLOSING_WINDOWS = [
  'Any time',
  'Next 7 days',
  'Next 30 days',
  'Choose dates',
] as const;
export type ClosingWindow = (typeof CLOSING_WINDOWS)[number];

/** Mirrors the database `applications.status` values, title-cased for UI. */
export const APPLICATION_STATUSES = [
  'Interested',
  'Applied',
  'Shortlisted',
  'Interview',
  'Offered',
  'Rejected',
  'Withdrawn',
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export type ClosingTone = 'urgent' | 'soon' | 'normal';

export type OpportunityStatus = 'pending' | 'approved' | 'published' | 'rejected';

export interface MatchDetail {
  score: number;
  reasons: string[];
}

export interface Opportunity {
  id: string;
  title: string;
  organisation: string;
  organizationId?: string | null;
  organizationVerified?: boolean;
  category: OpportunityCategory;
  province: Province | 'National';
  location: string;
  education: string;
  closes: string;
  closingDate: string;
  closingTone: ClosingTone;
  match: number;
  matchReasons?: string[];
  summary: string;
  field: string;
  mode: WorkMode;
  eligibility: string[];
  eligibilityCriteria?: string;
  qualifications: {
    education: string;
    field: string;
  };
  documents: string[];
  howToApply: string[];
  sourceName: string;
  sourceUrl: string;
  applicationUrl?: string | null;
  lastUpdated: string;
  isExpired?: boolean;
  status?: OpportunityStatus;
  tags?: string[];
  isRemote?: boolean;
  isFeatured?: boolean;
  publishedAt?: string;
  createdAt?: string;
}

export interface OpportunityFilters {
  types: OpportunityCategory[];
  provinces: Province[];
  closing: ClosingWindow;
  dateFrom: string;
  dateTo: string;
  education: EducationLevel;
  modes: WorkMode[];
  openOnly: boolean;
}

export interface ProfilePreferences {
  careerFields: string[];
  preferredLocation: string;
  workArrangement: 'Flexible' | 'On-site' | 'Remote';
  experience: string;
}

export interface NotificationPreferences {
  closingDates: boolean;
  newMatches: boolean;
  savedUpdates: boolean;
  opportunityTypes: OpportunityCategory[];
}

export type ProfileStatus = 'Learner' | 'Student' | 'Graduate' | 'Job seeker' | 'Other';

/** Mirrors public.admin_roles.role. */
export type AdminRole = 'super_admin' | 'opportunity_admin' | 'content_admin';

export interface UserProfile {
  id: string;
  name: string;
  initials: string;
  email: string;
  phone: string;
  status: ProfileStatus;
  education: string;
  institution: string;
  fieldOfStudy: string;
  province: Province | '';
  interests: string[];
  preferences: ProfilePreferences;
  notificationPreferences: NotificationPreferences;
  completion: number;
  avatarUrl?: string | null;
  city?: string;
  bio?: string;
  dateOfBirth?: string;
  onboardingCompleted?: boolean;
}

export type NotificationGroup = 'Today' | 'Yesterday' | 'Earlier';

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  time: string;
  group: NotificationGroup;
  unread: boolean;
  icon: IconName;
  target?: '/matches' | '/saved' | `/opportunity/${string}` | '/applications' | '/deadlines' | '/alerts';
  createdAt: string;
  type: string;
}

export interface ApplicationRecord {
  id: string;
  opportunityId: string;
  status: ApplicationStatus;
  updatedAt: string;
  source: 'user';
  appliedAt?: string | null;
  notes?: string | null;
  opportunityTitle?: string;
  opportunityOrganisation?: string;
}

export type AdminListingStatus = 'Published' | 'Approved' | 'Pending' | 'Rejected' | 'Closing soon' | 'Expired';

export interface AdminListing {
  id: string;
  title: string;
  organisation: string;
  category: OpportunityCategory;
  province: Province | 'National';
  closes: string;
  closingDate: string;
  status: AdminListingStatus;
  rawStatus: OpportunityStatus;
  description: string;
  education: string;
  eligibility: string;
  applicationUrl: string;
  sourceUrl: string;
  sourceChecked: string;
  organizationId?: string | null;
  rejectionReason?: string | null;
}

export interface AdminSummary {
  active: number;
  drafts: number;
  closingSoon: number;
  expired: number;
}

export interface AdminStats {
  total_opportunities: number;
  pending_opportunities: number;
  approved_opportunities: number;
  published_opportunities: number;
  rejected_opportunities: number;
  registered_students: number;
  registered_companies: number;
  approved_companies: number;
  api_connected_companies: number;
  api_requests_24h: number;
  views_7d: number;
}

export interface AdminAnalytics {
  generated_at: string;
  users_total: number;
  users_new_30d: number;
  students_total: number;
  suspended_users: number;
  organizations_total: number;
  organizations_pending: number;
  organizations_verified: number;
  opportunities_total: number;
  opportunities_pending: number;
  opportunities_pending_7d: number;
  opportunities_published: number;
  opportunities_closing_7d: number;
  applications_total: number;
  applications_30d: number;
  bookmarks_total: number;
  views_30d: number;
  api_requests_30d: number;
  open_reports: number;
  top_categories: { name: string; count: number }[];
  top_provinces: { name: string; count: number }[];
  application_funnel: Record<string, number>;
  top_opportunities: { id: string; title: string; provider: string; views: number }[];
}

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: OpportunityFilters;
  notifyNew: boolean;
  createdAt: string;
}

export type ReportReason =
  | 'expired'
  | 'incorrect_information'
  | 'broken_link'
  | 'scam'
  | 'other';

export interface OpportunityReport {
  id: string;
  opportunityId: string;
  reason: ReportReason;
  details: string;
  status: 'open' | 'reviewing' | 'resolved' | 'dismissed';
  createdAt: string;
  reporterName?: string;
  opportunityTitle?: string;
}

export interface DeadlineReminderRecord {
  id: string;
  opportunityId: string;
  daysBefore: number;
  sentAt: string | null;
  createdAt: string;
}

export type OrganizationStatus = 'pending' | 'approved' | 'suspended' | 'rejected';

export interface Organization {
  id: string;
  name: string;
  registeredBusinessName: string | null;
  slug: string | null;
  description: string | null;
  industry: string | null;
  website: string | null;
  contactPerson: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  province: string | null;
  address: string | null;
  registrationNumber: string | null;
  logoUrl: string | null;
  status: OrganizationStatus;
  apiEnabled: boolean;
  integrationMethod: 'none' | 'api' | 'webhook' | 'scheduled_sync';
  isVerified: boolean;
  role?: 'owner' | 'manager' | 'member';
  createdAt: string;
}

/** A student application as seen by the company that owns the opportunity. */
export interface CompanyApplication {
  id: string;
  userId: string;
  opportunityId: string;
  opportunityTitle: string;
  applicantName: string;
  applicantEmail: string | null;
  applicantPhone: string | null;
  status: ApplicationStatus;
  appliedAt: string | null;
  updatedAt: string;
  notes: string | null;
}

export interface CompanyApiKey {
  id: string;
  organizationId: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  status: 'active' | 'revoked';
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface ApiSubmission {
  id: string;
  eventType: 'created' | 'updated' | 'withdrawn';
  submissionSource: string;
  externalReference: string | null;
  status: 'accepted' | 'duplicate' | 'rejected' | 'error';
  errorMessage: string | null;
  createdAt: string;
  opportunityId: string | null;
}

export interface SearchState {
  query: string;
}
