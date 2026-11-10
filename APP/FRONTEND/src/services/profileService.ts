import { mockProfile } from '@/data/profile';
import type { UserProfile } from '@/types';
import { delay } from '@/services/simulate';

export async function getProfile(): Promise<UserProfile> {
  await delay(200);
  return mockProfile;
}

export async function saveProfile(profile: UserProfile): Promise<UserProfile> {
  await delay(350);
  return profile;
}

export const profileService = { getProfile, saveProfile };
