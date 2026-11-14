import type { IconName, OpportunityCategory } from '@/types';

export interface CategoryChip {
  category: OpportunityCategory;
  label: string;
  icon: IconName;
}

/** The chips shown on Home and Explore. Names match public.categories. */
export const categoryChips: CategoryChip[] = [
  { category: 'Bursary', label: 'Bursaries', icon: 'award' },
  { category: 'Internship', label: 'Internships', icon: 'briefcase' },
  { category: 'Learnership', label: 'Learnerships', icon: 'tool' },
  { category: 'Graduate Programme', label: 'Graduate', icon: 'trending-up' },
  { category: 'Job', label: 'Jobs', icon: 'users' },
  { category: 'WIL', label: 'WIL', icon: 'book-open' },
  { category: 'Grant', label: 'Grants', icon: 'gift' },
  { category: 'Farm Job', label: 'Farm jobs', icon: 'sun' },
  { category: 'Scholarship', label: 'Scholarships', icon: 'star' },
  { category: 'Training', label: 'Training', icon: 'activity' },
  { category: 'Apprenticeship', label: 'Apprenticeships', icon: 'settings' },
  { category: 'In-service Training', label: 'In-service', icon: 'clipboard' },
];

export const recentSearchSuggestions = [
  'bursary',
  'internship',
  'learnership',
  'solar',
  'agriculture',
  'graduate programme',
];
