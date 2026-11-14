import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
const anonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();

/**
 * The app must never silently fall back to fake data. When the two public
 * Supabase values are missing we keep the UI usable (the welcome screen and
 * static content) but every data call reports a clear configuration error.
 */
export const isSupabaseConfigured =
  url.startsWith('http') && anonKey.length > 20;

export const supabaseConfigError =
  'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and ' +
  'EXPO_PUBLIC_SUPABASE_ANON_KEY in APP/FRONTEND/.env, then restart Expo.';

let client: SupabaseClient | null = null;

if (isSupabaseConfigured) {
  client = createClient(url, anonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
    realtime: {
      params: { eventsPerSecond: 5 },
    },
  });
}

export const supabase = client;

export function requireSupabase(): SupabaseClient {
  if (!client) throw new Error(supabaseConfigError);
  return client;
}

export const supabaseUrl = url;
