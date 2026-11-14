import type { AdminRole, UserProfile } from '@/types';
import { toAppError } from '@/lib/errors';
import { mapProfile, type Row } from '@/lib/mappers';
import { requireSupabase } from '@/lib/supabase';

export async function fetchProfile(userId: string): Promise<UserProfile> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw toAppError(error);

  if (!data) {
    // The auth trigger normally creates this row. Self-heal if an old user
    // predates the trigger, rather than showing an empty screen.
    const { data: created, error: insertError } = await client
      .from('profiles')
      .insert({ id: userId })
      .select('*')
      .single();
    if (insertError) throw toAppError(insertError);
    return mapProfile(created as Row);
  }

  const profile = mapProfile(data as Row);
  // user_interests is the normalised table; profiles.interests is the legacy
  // array kept in sync for older code. Read the table when it has rows so a
  // half-migrated account still shows the right chips.
  try {
    const interests = await fetchInterests(userId);
    if (interests.length > 0 || profile.interests.length === 0) {
      return { ...profile, interests };
    }
  } catch {
    // Never block signing in because the optional interests read failed.
  }
  return profile;
}

export interface ProfilePatch {
  full_name?: string;
  email?: string;
  phone?: string | null;
  province?: string | null;
  qualification?: string | null;
  field_of_study?: string | null;
  institution?: string | null;
  city?: string | null;
  bio?: string | null;
  date_of_birth?: string | null;
  employment_status?: string | null;
  avatar_url?: string | null;
  interests?: string[];
  preferences?: Record<string, unknown>;
  notification_preferences?: Record<string, unknown>;
  onboarding_completed?: boolean;
}

export async function updateProfile(
  userId: string,
  patch: ProfilePatch,
): Promise<UserProfile> {
  const client = requireSupabase();

  if (patch.interests) {
    const interests = patch.interests
      .map((interest) => interest.trim())
      .filter(Boolean)
      .slice(0, 30);

    const { error: deleteError } = await client
      .from('user_interests')
      .delete()
      .eq('user_id', userId);
    if (deleteError) throw toAppError(deleteError);

    if (interests.length > 0) {
      const { error: insertError } = await client
        .from('user_interests')
        .insert(interests.map((interest) => ({ user_id: userId, interest })));
      if (insertError) throw toAppError(insertError);
    }
  }

  const { interests: requestedInterests, ...rest } = patch;
  const profilePatch: ProfilePatch = rest;
  // Keep the legacy profiles.interests array and the user_interests table in
  // step. Older matching code still reads the array.
  if (requestedInterests) {
    profilePatch.interests = requestedInterests
      .map((interest) => interest.trim())
      .filter(Boolean)
      .slice(0, 30);
  }

  const { data, error } = await client
    .from('profiles')
    .update(profilePatch)
    .eq('id', userId)
    .select('*')
    .single();

  if (error) throw toAppError(error);
  return mapProfile(data as Row);
}

const ADMIN_ROLES: readonly AdminRole[] = [
  'super_admin',
  'opportunity_admin',
  'content_admin',
];

function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === 'string' && (ADMIN_ROLES as readonly string[]).includes(value);
}

/**
 * Reads the signed-in user's role straight from `public.admin_roles`.
 *
 * The `admin_roles_select` RLS policy lets an authenticated user read their own
 * row, so this is the authoritative check (never AsyncStorage or navigation
 * params). Errors are thrown instead of swallowed: callers must fail closed and
 * be able to tell "no role" apart from "could not verify".
 */
export async function fetchAdminRole(userId: string): Promise<AdminRole | null> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('admin_roles')
    .select('role, is_active')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw toAppError(error);
  if (!data || data.is_active !== true) return null;
  return isAdminRole(data.role) ? data.role : null;
}

export async function fetchInterests(userId: string): Promise<string[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('user_interests')
    .select('interest')
    .eq('user_id', userId)
    .order('interest');
  if (error) throw toAppError(error);
  return (data ?? []).map((row) => String(row.interest));
}

export const profileService = {
  fetchProfile,
  updateProfile,
  fetchAdminRole,
  fetchInterests,
};
