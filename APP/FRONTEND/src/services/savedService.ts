import { apiRequest } from '@/services/api';

export async function getSavedIds(): Promise<string[]> {
  return apiRequest<string[]>('/me/saved');
}

export async function addSavedId(id: string): Promise<void> {
  await apiRequest<void>(`/me/saved/${encodeURIComponent(id)}`, { method: 'POST' });
}

export async function removeSavedId(id: string): Promise<void> {
  await apiRequest<void>(`/me/saved/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export const savedService = { getSavedIds, addSavedId, removeSavedId };
