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

export const OPPORTUNITY_CATEGORIES = [
  'Bursary',
  'Internship',
  'Learnership',
  'Graduate programme',
  'Job',
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

export const APPLICATION_STATUSES = [
  'Interested',
  'Preparing',
  'Applied',
  'Interview',
  'Outcome',
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export type ClosingTone = 'urgent' | 'soon' | 'normal';

export interface Opportunity {
  id: string;
  title: string;
  organisation: string;
  category: OpportunityCategory;
  province: Province | 'National';
  location: string;
  education: string;
  closes: string;
  closingDate: string;
  closingTone: ClosingTone;
  match: number;
  summary: string;
  field: string;
  mode: WorkMode;
  eligibility: string[];
  qualifications: {
    education: string;
    field: string;
  };
  documents: string[];
  howToApply: string[];
  sourceName: string;
  sourceUrl: string;
  lastUpdated: string;
  isExpired?: boolean;
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
  hideExpired: boolean;
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

export interface UserProfile {
  name: string;
  initials: string;
  email: string;
  phone: string;
  status: 'Learner' | 'Student' | 'Graduate' | 'Job seeker' | 'Other';
  education: string;
  institution: string;
  fieldOfStudy: string;
  province: Province;
  preferences: ProfilePreferences;
  notificationPreferences: NotificationPreferences;
  completion: number;
}

export type NotificationGroup = 'Today' | 'Yesterday';

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  time: string;
  group: NotificationGroup;
  unread: boolean;
  icon: IconName;
  target?: '/matches' | '/saved' | `/opportunity/${string}` | '/applications';
}

export interface ApplicationRecord {
  id: string;
  opportunityId: string;
  status: ApplicationStatus;
  updatedAt: string;
  source: 'user';
}

export type AdminListingStatus = 'Published' | 'Draft' | 'Closing soon' | 'Expired';

export interface AuthUser {
  id: string;
  email: string;
  role: 'user' | 'admin';
}

export interface AdminListing {
  id: string;
  title: string;
  organisation: string;
  category: OpportunityCategory;
  province: Province;
  closes: string;
  closingDate: string;
  status: AdminListingStatus;
  description: string;
  education: string;
  eligibility: string;
  openingDate: string;
  applicationMethod: string;
  sourceUrl: string;
  sourceChecked: string;
  // Fields preserved from the full opportunity record so editing through the
  // admin form does not discard data the form does not expose.
  documents?: string[];
  qualificationsField?: string;
  mode?: WorkMode;
  match?: number;
  location?: string;
  sourceName?: string;
}

export interface AdminSummary {
  active: number;
  drafts: number;
  closingSoon: number;
  expired: number;
}

export interface SearchState {
  query: string;
}
