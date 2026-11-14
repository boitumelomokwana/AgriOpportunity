import type {
  MatchDetail,
  Opportunity,
  OpportunityFilters,
  UserProfile,
} from '@/types';
import { daysUntil } from '@/utils/date';
import { toAppError } from '@/lib/errors';
import { mapOpportunity, type Row } from '@/lib/mappers';
import { requireSupabase } from '@/lib/supabase';

export const defaultFilters: OpportunityFilters = {
  types: [],
  provinces: [],
  closing: 'Any time',
  dateFrom: '',
  dateTo: '',
  education: 'Any level',
  modes: [],
  openOnly: true,
};

const OPPORTUNITY_SELECT =
  '*, organizations(name, is_verified, logo_url)';

/* ------------------------------------------------------------------ */
/* Transparent matching                                                */
/* ------------------------------------------------------------------ */

/**
 * Same weights as public.match_opportunity_score() in the database:
 *   35 interest/category, 25 field-of-study keyword, 20 province,
 *   10 qualification, 10 still open.
 * Every point comes with a plain-language reason.
 */
export function computeMatch(
  opportunity: Opportunity,
  profile: UserProfile | null,
): MatchDetail {
  if (!profile) {
    return {
      score: 0,
      reasons: ['Sign in to see how well this fits your profile.'],
    };
  }
  if (opportunity.isExpired) {
    return { score: 0, reasons: ['This opportunity has closed.'] };
  }

  let score = 0;
  const reasons: string[] = [];
  const category = opportunity.category;

  const declaredInterests = [
    ...profile.interests,
    ...profile.preferences.careerFields,
  ].map((value) => value.toLowerCase());

  if (declaredInterests.includes(category.toLowerCase())) {
    score += 35;
    reasons.push(`Matches your interest in ${category}`);
  }

  const text = [
    opportunity.title,
    opportunity.summary,
    opportunity.field,
    opportunity.category,
    ...(opportunity.tags ?? []),
  ]
    .join(' ')
    .toLowerCase();

  const tokens = profile.fieldOfStudy
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(
      (token) =>
        token.length >= 4 &&
        ![
          'with',
          'and',
          'the',
          'for',
          'from',
          'this',
          'that',
          'your',
          'bachelor',
          'degree',
          'diploma',
        ].includes(token),
    );

  if (tokens.some((token) => text.includes(token))) {
    score += 25;
    reasons.push('Related to your field of study');
  }

  if (
    opportunity.mode === 'Remote' ||
    opportunity.province === 'National' ||
    (profile.province && opportunity.province === profile.province)
  ) {
    score += 20;
    if (opportunity.province === 'National') reasons.push('Open nationwide');
    else if (opportunity.mode === 'Remote') reasons.push('Can be done remotely');
    else reasons.push(`Located in ${opportunity.province}`);
  }

  const qualification = opportunity.qualifications.education.toLowerCase();
  if (
    !profile.education ||
    qualification.includes('not specified') ||
    qualification.includes('any') ||
    qualification.includes(profile.education.toLowerCase()) ||
    profile.education.toLowerCase().includes(qualification)
  ) {
    score += 10;
    reasons.push('Education requirements look compatible');
  }

  if (daysUntil(opportunity.closingDate) >= 0) {
    score += 10;
    if (opportunity.closingDate) reasons.push(`Closes ${opportunity.closes}`);
  }

  if (score === 0) reasons.push('Add your interests and province to improve this score');
  return { score: Math.min(score, 100), reasons };
}

export function withMatches(
  opportunities: Opportunity[],
  profile: UserProfile | null,
): Opportunity[] {
  return opportunities.map((opportunity) => {
    const match = computeMatch(opportunity, profile);
    return { ...opportunity, match: match.score, matchReasons: match.reasons };
  });
}

/* ------------------------------------------------------------------ */
/* Client-side filter / sort (kept from the original UI)               */
/* ------------------------------------------------------------------ */

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
    opportunity.summary,
    ...(opportunity.tags ?? []),
  ]
    .join(' ')
    .toLowerCase()
    .includes(needle);
}

function matchesEducation(
  opportunity: Opportunity,
  level: OpportunityFilters['education'],
): boolean {
  if (level === 'Any level') return true;
  const text = `${opportunity.education} ${opportunity.qualifications.education}`.toLowerCase();
  switch (level) {
    case 'Grade 12':
      return text.includes('grade 12') || text.includes('age 18') || text.includes('matric');
    case 'Diploma':
      return text.includes('diploma');
    case 'Degree':
      return text.includes('degree') || text.includes('undergraduate') || text.includes('bachelor');
    case 'Postgraduate':
      return (
        text.includes('postgraduate') ||
        text.includes('honours') ||
        text.includes('master') ||
        text.includes('phd')
      );
    default:
      return true;
  }
}

function matchesClosingWindow(
  opportunity: Opportunity,
  filters: OpportunityFilters,
): boolean {
  if (filters.closing === 'Any time') return true;
  if (!opportunity.closingDate) return false;
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
    const expired = Boolean(opportunity.isExpired);
    if (filters.openOnly && expired) return false;
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

export function sortOpportunities(
  opportunities: Opportunity[],
  mode: SortMode,
): Opportunity[] {
  const items = [...opportunities];
  items.sort((a, b) => {
    if (a.isExpired !== b.isExpired) return a.isExpired ? 1 : -1;
    if (mode === 'Closing soon') {
      return daysUntil(a.closingDate) - daysUntil(b.closingDate);
    }
    if (mode === 'Newest') {
      return (
        new Date(b.publishedAt ?? b.createdAt ?? 0).getTime() -
        new Date(a.publishedAt ?? a.createdAt ?? 0).getTime()
      );
    }
    return b.match - a.match;
  });
  return items;
}

export function getMatchingOpportunities(
  opportunities: Opportunity[],
  minimum = 40,
): Opportunity[] {
  return opportunities
    .filter((opportunity) => opportunity.match >= minimum && !opportunity.isExpired)
    .sort((a, b) => b.match - a.match);
}

/* ------------------------------------------------------------------ */
/* Database access                                                     */
/* ------------------------------------------------------------------ */

export async function fetchPublishedOpportunities(): Promise<Opportunity[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('opportunities')
    .select(OPPORTUNITY_SELECT)
    .eq('status', 'published')
    .order('is_featured', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(500);

  if (error) throw toAppError(error);
  return (data ?? []).map((row: Row) => mapOpportunity(row));
}

export async function fetchOpportunityById(id: string): Promise<Opportunity | null> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('opportunities')
    .select(OPPORTUNITY_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error) throw toAppError(error);
  return data ? mapOpportunity(data as Row) : null;
}

export async function recordOpportunityView(
  opportunityId: string,
  source = 'app',
): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('record_opportunity_view', {
    p_opportunity_id: opportunityId,
    p_source: source,
  });
  // View analytics must never block reading an opportunity.
  if (error) console.warn('Could not record opportunity view:', error.message);
}

export async function searchOpportunitiesInDb(query: string): Promise<Opportunity[]> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('search_opportunities', {
    p_query: query,
    p_limit: 50,
  });
  if (error) throw toAppError(error);
  return (data ?? []).map((row: Row) => mapOpportunity(row));
}

export const opportunityService = {
  fetchPublishedOpportunities,
  fetchOpportunityById,
  recordOpportunityView,
  searchOpportunitiesInDb,
  filterOpportunities,
  sortOpportunities,
  getMatchingOpportunities,
  computeMatch,
  withMatches,
  defaultFilters,
};
