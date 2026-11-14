import type {
  DeadlineReminderRecord,
  Opportunity,
  OpportunityFilters,
  OpportunityReport,
  ReportReason,
  SavedSearch,
} from '@/types';
import { toAppError } from '@/lib/errors';
import {
  mapOpportunity,
  mapReminder,
  mapReport,
  mapSavedSearch,
  type Row,
} from '@/lib/mappers';
import { requireSupabase } from '@/lib/supabase';

/* ---------------------------- saved searches --------------------------- */

export async function listSavedSearches(userId: string): Promise<SavedSearch[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('saved_searches')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw toAppError(error);
  return (data ?? []).map((row: Row) => mapSavedSearch(row));
}

export async function createSavedSearch(
  userId: string,
  name: string,
  query: string,
  filters: OpportunityFilters,
): Promise<SavedSearch> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('saved_searches')
    .insert({ user_id: userId, name: name.trim().slice(0, 80), query, filters })
    .select('*')
    .single();
  if (error) throw toAppError(error);
  return mapSavedSearch(data as Row);
}

export async function deleteSavedSearch(userId: string, id: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client
    .from('saved_searches')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw toAppError(error);
}

/* ------------------------------- reports ------------------------------ */

export async function reportOpportunity(
  userId: string,
  opportunityId: string,
  reason: ReportReason,
  details: string,
): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.from('opportunity_reports').insert({
    user_id: userId,
    opportunity_id: opportunityId,
    reason,
    details: details.trim().slice(0, 2000) || null,
  });
  if (error) throw toAppError(error);
}

export async function listMyReports(userId: string): Promise<OpportunityReport[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('opportunity_reports')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw toAppError(error);
  return (data ?? []).map((row: Row) => mapReport(row));
}

/* ------------------------------ reminders ----------------------------- */

export async function listReminders(userId: string): Promise<DeadlineReminderRecord[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('deadline_reminders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw toAppError(error);
  return (data ?? []).map((row: Row) => mapReminder(row));
}

export async function setReminder(
  opportunityId: string,
  daysBefore = 7,
): Promise<DeadlineReminderRecord> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('set_deadline_reminder', {
    p_opportunity_id: opportunityId,
    p_days_before: daysBefore,
  });
  if (error) throw toAppError(error);
  return mapReminder(data as Row);
}

export async function removeReminder(
  userId: string,
  opportunityId: string,
): Promise<void> {
  const client = requireSupabase();
  const { error } = await client
    .from('deadline_reminders')
    .delete()
    .eq('user_id', userId)
    .eq('opportunity_id', opportunityId);
  if (error) throw toAppError(error);
}

/* --------------------------- recently viewed -------------------------- */

export async function listRecentlyViewed(
  userId: string,
  limit = 12,
): Promise<Opportunity[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('opportunity_views')
    .select('viewed_at, opportunities(*, organizations(name, is_verified, logo_url))')
    .eq('user_id', userId)
    .order('viewed_at', { ascending: false })
    .limit(limit);
  if (error) throw toAppError(error);

  const seen = new Set<string>();
  const result: Opportunity[] = [];
  for (const row of data ?? []) {
    const opportunity = (row as Row).opportunities;
    if (!opportunity || opportunity.status !== 'published') continue;
    if (seen.has(String(opportunity.id))) continue;
    seen.add(String(opportunity.id));
    result.push(mapOpportunity(opportunity));
  }
  return result;
}

/* ------------------------------ deadlines ----------------------------- */

export interface UpcomingDeadline {
  opportunity: Opportunity;
  daysLeft: number;
  reminded: boolean;
}

export async function listUpcomingDeadlines(
  userId: string,
  days = 30,
): Promise<UpcomingDeadline[]> {
  const client = requireSupabase();
  const today = new Date();
  const until = new Date();
  until.setDate(until.getDate() + days);
  // closing_date is a plain date. Format in local time so users east of UTC
  // do not lose "closes today" during the first hours of the morning.
  const iso = (date: Date) =>
    `${date.getFullYear().toString().padStart(4, '0')}-${(date.getMonth() + 1)
      .toString()
      .padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;

  const [savedResult, appsResult, remindersResult] = await Promise.all([
    client
      .from('bookmarks')
      .select('opportunities(*, organizations(name, is_verified, logo_url))')
      .eq('user_id', userId),
    client
      .from('applications')
      .select('opportunities(*, organizations(name, is_verified, logo_url))')
      .eq('user_id', userId),
    client
      .from('deadline_reminders')
      .select('opportunity_id, opportunities(*, organizations(name, is_verified, logo_url))')
      .eq('user_id', userId),
  ]);

  if (savedResult.error) throw toAppError(savedResult.error);
  if (appsResult.error) throw toAppError(appsResult.error);
  if (remindersResult.error) throw toAppError(remindersResult.error);

  const remindedIds = new Set(
    (remindersResult.data ?? []).map((row) => String((row as Row).opportunity_id)),
  );

  const byId = new Map<string, Opportunity>();
  for (const result of [savedResult, appsResult, remindersResult]) {
    for (const row of result.data ?? []) {
      const opportunity = (row as Row).opportunities;
      if (!opportunity || opportunity.status !== 'published') continue;
      if (!opportunity.closing_date) continue;
      if (opportunity.closing_date < iso(today) || opportunity.closing_date > iso(until)) continue;
      byId.set(String(opportunity.id), mapOpportunity(opportunity));
    }
  }

  return [...byId.values()]
    .map((opportunity) => {
      const daysLeft = Math.round(
        (new Date(`${opportunity.closingDate}T00:00:00`).getTime() -
          new Date(today.toDateString()).getTime()) /
          86_400_000,
      );
      return {
        opportunity,
        daysLeft,
        reminded: remindedIds.has(opportunity.id),
      };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

export const discoveryService = {
  listSavedSearches,
  createSavedSearch,
  deleteSavedSearch,
  reportOpportunity,
  listMyReports,
  listReminders,
  setReminder,
  removeReminder,
  listRecentlyViewed,
  listUpcomingDeadlines,
};
