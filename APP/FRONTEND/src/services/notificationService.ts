import type { AppNotification } from '@/types';
import { apiRequest } from '@/services/api';

export async function getNotifications(): Promise<AppNotification[]> {
  return apiRequest<AppNotification[]>('/me/notifications');
}

export async function markAllRead(): Promise<void> {
  await apiRequest<void>('/me/notifications/read-all', { method: 'PATCH' });
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiRequest<void>(`/me/notifications/${encodeURIComponent(id)}/read`, {
    method: 'PATCH',
  });
}

export const notificationService = { getNotifications, markAllRead, markNotificationRead };
