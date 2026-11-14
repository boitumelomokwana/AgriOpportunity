import type { AppNotification } from '@/types';
import { toAppError } from '@/lib/errors';
import { mapNotification, type Row } from '@/lib/mappers';
import { requireSupabase } from '@/lib/supabase';

export async function listNotifications(userId: string): Promise<AppNotification[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw toAppError(error);
  return (data ?? []).map((row: Row) => mapNotification(row));
}

export async function markNotificationRead(
  userId: string,
  notificationId: string,
): Promise<void> {
  const client = requireSupabase();
  const { error } = await client
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('user_id', userId);
  if (error) throw toAppError(error);
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('is_read', false);
  if (error) throw toAppError(error);
}

export async function deleteNotification(
  userId: string,
  notificationId: string,
): Promise<void> {
  const client = requireSupabase();
  const { error } = await client
    .from('notifications')
    .delete()
    .eq('id', notificationId)
    .eq('user_id', userId);
  if (error) throw toAppError(error);
}

export const notificationService = {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
};
