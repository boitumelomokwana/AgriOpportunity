export const opportunityCategories = [
  'Bursary',
  'Internship',
  'Learnership',
  'Graduate programme',
  'Job',
  'Skills training',
  'Youth programme',
] as const;

export const provinces = [
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

export const applicationStatuses = [
  'Interested',
  'Preparing',
  'Applied',
  'Interview',
  'Outcome',
] as const;

export interface Opportunity {
  id: string;
  title: string;
  organisation: string;
  category: (typeof opportunityCategories)[number];
  province: (typeof provinces)[number] | 'National';
  location: string;
  education: string;
  closes: string;
  closingDate: string;
  closingTone: 'urgent' | 'soon' | 'normal';
  match: number;
  summary: string;
  field: string;
  mode: 'On-site' | 'Hybrid' | 'Remote';
  eligibility: string[];
  qualifications: { education: string; field: string };
  documents: string[];
  howToApply: string[];
  sourceName: string;
  sourceUrl: string;
  lastUpdated: string;
  isExpired?: boolean;
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
  province: (typeof provinces)[number];
  preferences: {
    careerFields: string[];
    preferredLocation: string;
    workArrangement: 'Flexible' | 'On-site' | 'Remote';
    experience: string;
  };
  notificationPreferences: {
    closingDates: boolean;
    newMatches: boolean;
    savedUpdates: boolean;
    opportunityTypes: (typeof opportunityCategories)[number][];
  };
  completion: number;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  time: string;
  group: 'Today' | 'Yesterday';
  unread: boolean;
  icon: 'star' | 'clock' | 'bookmark';
  target?: string;
}

export interface ApplicationRecord {
  id: string;
  opportunityId: string;
  status: (typeof applicationStatuses)[number];
  updatedAt: string;
  source: 'user';
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: 'user' | 'admin';
}
