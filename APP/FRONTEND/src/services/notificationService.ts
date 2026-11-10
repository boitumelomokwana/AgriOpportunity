import { mockNotifications } from '@/data/notifications';
import type { AppNotification } from '@/types';
import { delay } from '@/services/simulate';

export async function getNotifications(): Promise<AppNotification[]> {
  await delay(250);
  return mockNotifications;
}

export async function markAllRead(
  notifications: AppNotification[],
): Promise<AppNotification[]> {
  await delay(150);
  return notifications.map((notification) => ({ ...notification, unread: false }));
}

export const notificationService = { getNotifications, markAllRead };
