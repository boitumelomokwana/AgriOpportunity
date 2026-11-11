import type { Opportunity, OpportunityFilters } from '@/types';
import { daysUntil } from '@/utils/date';
import { apiRequest } from '@/services/api';

export const defaultFilters: OpportunityFilters = {
  types: [],
  provinces: [],
  closing: 'Any time',
  dateFrom: '',
  dateTo: '',
  education: 'Any level',
  modes: [],
  openOnly: true,
  hideExpired: true,
};

function matchesSearch(opportunity: Opportunity, query: string): boolean {
  if (!query.trim()) return true;
  const needle = query.trim().toLowerCase();
  return [
    opportunity.title,
    opportunity.organisation,
    opportunity.category,
    opportunity.field,
    opportunity.province,
    opportunity.location,
    opportunity.education,
  ]
    .join(' ')
    .toLowerCase()
    .includes(needle);
}

function matchesEducation(opportunity: Opportunity, level: OpportunityFilters['education']): boolean {
  if (level === 'Any level') return true;
  const text = `${opportunity.education} ${opportunity.qualifications.education}`.toLowerCase();
  switch (level) {
    case 'Grade 12':
      return text.includes('grade 12') || text.includes('age 18');
    case 'Diploma':
      return text.includes('diploma');
    case 'Degree':
      return text.includes('degree') || text.includes('undergraduate');
    case 'Postgraduate':
      return text.includes('postgraduate') || text.includes('honours') || text.includes('master');
    default:
      return true;
  }
}

function matchesClosingWindow(opportunity: Opportunity, filters: OpportunityFilters): boolean {
  if (filters.closing === 'Any time') return true;
  const remaining = daysUntil(opportunity.closingDate);
  if (filters.closing === 'Next 7 days') return remaining >= 0 && remaining <= 7;
  if (filters.closing === 'Next 30 days') return remaining >= 0 && remaining <= 30;

  const from = filters.dateFrom ? new Date(filters.dateFrom) : null;
  const to = filters.dateTo ? new Date(filters.dateTo) : null;
  const closing = new Date(opportunity.closingDate);
  if (from && !Number.isNaN(from.getTime()) && closing < from) return false;
  if (to && !Number.isNaN(to.getTime()) && closing > to) return false;
  return true;
}

export function filterOpportunities(
  opportunities: Opportunity[],
  filters: OpportunityFilters,
  query = '',
): Opportunity[] {
  return opportunities.filter((opportunity) => {
    const expired = opportunity.isExpired || daysUntil(opportunity.closingDate) < 0;
    if (filters.openOnly && expired) return false;
    if (filters.hideExpired && expired) return false;
    if (filters.types.length > 0 && !filters.types.includes(opportunity.category)) return false;
    if (
      filters.provinces.length > 0 &&
      opportunity.province !== 'National' &&
      !filters.provinces.includes(opportunity.province)
    ) {
      return false;
    }
    if (filters.modes.length > 0 && !filters.modes.includes(opportunity.mode)) return false;
    if (!matchesEducation(opportunity, filters.education)) return false;
    if (!matchesClosingWindow(opportunity, filters)) return false;
    if (!matchesSearch(opportunity, query)) return false;
    return true;
  });
}

export type SortMode = 'Best match' | 'Newest' | 'Closing soon';

export function sortOpportunities(opportunities: Opportunity[], mode: SortMode): Opportunity[] {
  const items = [...opportunities];
  items.sort((a, b) => {
    const aExpired = a.isExpired || daysUntil(a.closingDate) < 0;
    const bExpired = b.isExpired || daysUntil(b.closingDate) < 0;
    if (aExpired !== bExpired) return aExpired ? 1 : -1;
    if (mode === 'Closing soon') {
      return new Date(a.closingDate).getTime() - new Date(b.closingDate).getTime();
    }
    if (mode === 'Newest') {
      return Number(b.id) - Number(a.id);
    }
    return b.match - a.match;
  });
  return items;
}

export function getMatchingOpportunities(opportunities: Opportunity[]): Opportunity[] {
  return opportunities
    .filter((opportunity) => opportunity.match >= 70 && !opportunity.isExpired)
    .sort((a, b) => b.match - a.match);
}

export async function getOpportunities(): Promise<Opportunity[]> {
  return apiRequest<Opportunity[]>('/opportunities');
}

export async function getOpportunityById(id: string): Promise<Opportunity | undefined> {
  try {
    return await apiRequest<Opportunity>(`/opportunities/${encodeURIComponent(id)}`);
  } catch (error) {
    if (error instanceof Error && error.message === 'Opportunity not found.') return undefined;
    throw error;
  }
}

export const opportunityService = {
  getOpportunities,
  getOpportunityById,
  filterOpportunities,
  sortOpportunities,
  getMatchingOpportunities,
  defaultFilters,
};
