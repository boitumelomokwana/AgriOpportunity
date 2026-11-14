import type {
  Opportunity,
  OpportunityCategory,
  OpportunityFilters,
} from '@/types';
import { daysUntil } from '@/utils/date';

export function pluralise(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural ?? `${singular}s`);
}

export function initialsFromName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function categoryPlural(category: OpportunityCategory): string {
  switch (category) {
    case 'Bursary':
      return 'Bursaries';
    case 'Internship':
      return 'Internships';
    case 'Learnership':
      return 'Learnerships';
    case 'Graduate Programme':
    case 'Graduate programme':
      return 'Graduate programmes';
    case 'Job':
      return 'Jobs';
    case 'Grant':
      return 'Grants';
    case 'Scholarship':
      return 'Scholarships';
    case 'Farm Job':
      return 'Farm jobs';
    case 'Apprenticeship':
      return 'Apprenticeships';
    case 'Training':
    case 'Skills training':
      return 'Training';
    case 'WIL':
      return 'Work-integrated learning';
    case 'In-service Training':
      return 'In-service training';
    case 'Youth programme':
      return 'Youth programmes';
    default:
      return category;
  }
}

export function categoryToChip(category: OpportunityCategory): string {
  switch (category) {
    case 'Bursary':
      return 'Bursaries';
    case 'Internship':
      return 'Internships';
    case 'Learnership':
      return 'Learnerships';
    case 'Job':
      return 'Jobs';
    case 'Graduate Programme':
    case 'Graduate programme':
      return 'Graduate';
    default:
      return category;
  }
}

export function chipToCategory(chip: string): OpportunityCategory | null {
  switch (chip) {
    case 'Bursaries':
      return 'Bursary';
    case 'Internships':
      return 'Internship';
    case 'Learnerships':
      return 'Learnership';
    case 'Jobs':
      return 'Job';
    case 'Graduate':
      return 'Graduate Programme';
    case 'WIL':
      return 'WIL';
    case 'Grants':
      return 'Grant';
    case 'Farm jobs':
      return 'Farm Job';
    case 'Scholarships':
      return 'Scholarship';
    case 'Training':
      return 'Training';
    case 'Apprenticeships':
      return 'Apprenticeship';
    case 'In-service':
      return 'In-service Training';
    default:
      return null;
  }
}

export function matchLabel(match: number): string {
  if (match >= 85) return 'Strong potential match';
  if (match >= 70) return 'Good potential match';
  if (match >= 40) return 'Possible match';
  return 'Add more profile details to improve this score';
}

export function closingLabel(opportunity: Opportunity): string {
  if (!opportunity.closingDate) return 'No closing date';
  if (opportunity.isExpired) return 'Expired';
  const remaining = daysUntil(opportunity.closingDate);
  if (remaining === Number.POSITIVE_INFINITY) return 'No closing date';
  if (remaining < 0) return 'Expired';
  if (remaining === 0) return 'Closes today';
  if (remaining <= 7) return `Closing in ${remaining} ${pluralise(remaining, 'day')}`;
  return `Closes ${opportunity.closes}`;
}

export function closingTone(opportunity: Opportunity): 'urgent' | 'soon' | 'normal' {
  if (opportunity.isExpired || !opportunity.closingDate) return 'normal';
  const remaining = daysUntil(opportunity.closingDate);
  if (remaining <= 7) return 'urgent';
  if (remaining <= 30) return 'soon';
  return 'normal';
}

export function activeFilterCount(filters: OpportunityFilters): number {
  let count = 0;
  if (filters.types.length > 0) count += 1;
  if (filters.provinces.length > 0) count += 1;
  if (filters.closing !== 'Any time') count += 1;
  if (filters.education !== 'Any level') count += 1;
  if (filters.modes.length > 0) count += 1;
  if (!filters.openOnly) count += 1;
  return count;
}
