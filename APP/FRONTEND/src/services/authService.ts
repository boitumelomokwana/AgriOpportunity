import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

import { toAppError } from '@/lib/errors';
import { requireSupabase } from '@/lib/supabase';

export interface SignUpDetails {
  fullName: string;
  province?: string;
  phone?: string;
}

export async function getSession(): Promise<Session | null> {
  const client = requireSupabase();
  const { data, error } = await client.auth.getSession();
  if (error) throw toAppError(error);
  return data.session;
}

export async function signIn(email: string, password: string): Promise<Session> {
  const client = requireSupabase();
  const { data, error } = await client.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw toAppError(error);
  if (!data.session) throw new Error('Sign in did not return a session.');
  return data.session;
}

export async function signUp(
  email: string,
  password: string,
  details: SignUpDetails,
): Promise<{ session: Session | null; needsEmailConfirmation: boolean }> {
  const client = requireSupabase();
  const { data, error } = await client.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: {
        full_name: details.fullName.trim(),
        province: details.province ?? null,
        phone: details.phone ?? null,
      },
    },
  });
  if (error) throw toAppError(error);

  // The profile trigger fills the rest from raw_user_meta_data.
  return {
    session: data.session,
    needsEmailConfirmation: !data.session,
  };
}

export async function signOut(): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.auth.signOut();
  if (error) throw toAppError(error);
}

export async function sendPasswordReset(email: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.auth.resetPasswordForEmail(email.trim().toLowerCase());
  if (error) throw toAppError(error);
}

export async function updatePassword(password: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.auth.updateUser({ password });
  if (error) throw toAppError(error);
}

export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
): () => void {
  const client = requireSupabase();
  const { data } = client.auth.onAuthStateChange(callback);
  return () => data.subscription.unsubscribe();
}

export const authService = {
  getSession,
  signIn,
  signUp,
  signOut,
  sendPasswordReset,
  updatePassword,
  onAuthStateChange,
};
