import type { UserProfile } from '@/types';

export const mockProfile: UserProfile = {
  id: 'demo-profile',
  name: 'Thando Nkosi',
  initials: 'TN',
  email: 'thando.nkosi@example.com',
  phone: '071 234 5678',
  status: 'Graduate',
  education: "Bachelor's degree",
  institution: 'University of Johannesburg',
  fieldOfStudy: 'BSc Information Technology',
  province: 'Gauteng',
  interests: ['Bursary', 'Internship'],
  preferences: {
    careerFields: ['Technology', 'Finance'],
    preferredLocation: 'Gauteng or Remote',
    workArrangement: 'Flexible',
    experience: 'Less than 1 year',
  },
  notificationPreferences: {
    closingDates: true,
    newMatches: true,
    savedUpdates: true,
    opportunityTypes: ['Bursary', 'Internship'],
  },
  completion: 65,
};
