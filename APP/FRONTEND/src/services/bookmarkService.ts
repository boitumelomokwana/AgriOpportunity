import { toAppError } from '@/lib/errors';
import { requireSupabase } from '@/lib/supabase';

export async function listBookmarkIds(userId: string): Promise<string[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('bookmarks')
    .select('opportunity_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw toAppError(error);
  return (data ?? []).map((row) => String(row.opportunity_id));
}

export async function addBookmark(userId: string, opportunityId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client
    .from('bookmarks')
    .upsert(
      { user_id: userId, opportunity_id: opportunityId },
      { onConflict: 'user_id,opportunity_id', ignoreDuplicates: true },
    );
  if (error) throw toAppError(error);
}

export async function removeBookmark(userId: string, opportunityId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client
    .from('bookmarks')
    .delete()
    .eq('user_id', userId)
    .eq('opportunity_id', opportunityId);
  if (error) throw toAppError(error);
}

export const bookmarkService = { listBookmarkIds, addBookmark, removeBookmark };
