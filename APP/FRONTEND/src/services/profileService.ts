import type { UserProfile } from '@/types';
import { apiRequest } from '@/services/api';

export async function getProfile(): Promise<UserProfile> {
  return apiRequest<UserProfile>('/me/profile');
}

export async function saveProfile(profile: UserProfile): Promise<UserProfile> {
  return apiRequest<UserProfile>('/me/profile', {
    method: 'PUT',
    body: JSON.stringify(profile),
  });
}

export const profileService = { getProfile, saveProfile };
