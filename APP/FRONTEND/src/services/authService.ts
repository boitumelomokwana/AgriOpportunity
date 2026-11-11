import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { AuthUser, UserProfile } from '@/types';
import { ApiError, apiRequest, setAccessToken } from './api';

const tokenStorageKey = 'agri-opportunity-access-token';

async function getStoredToken() {
  if (Platform.OS === 'web') {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(tokenStorageKey);
  }
  return SecureStore.getItemAsync(tokenStorageKey);
}

async function storeToken(token: string) {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.setItem(tokenStorageKey, token);
    return;
  }
  await SecureStore.setItemAsync(tokenStorageKey, token);
}

async function clearStoredToken() {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(tokenStorageKey);
    return;
  }
  await SecureStore.deleteItemAsync(tokenStorageKey);
}

interface AuthResponse {
  token: string;
  profile: UserProfile;
  user: AuthUser;
}

interface MeResponse {
  user: AuthUser;
  profile: UserProfile;
}

export interface AuthResult {
  user: AuthUser;
  profile: UserProfile;
}

async function saveSession(response: AuthResponse): Promise<AuthResult> {
  await storeToken(response.token);
  setAccessToken(response.token);
  return { user: response.user, profile: response.profile };
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const response = await apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    skipUnauthorizedHandler: true,
  });
  return saveSession(response);
}

export async function register(
  name: string,
  email: string,
  password: string,
): Promise<AuthResult> {
  const response = await apiRequest<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
    skipUnauthorizedHandler: true,
  });
  return saveSession(response);
}

/**
 * Restores a stored bearer token. Returns the authenticated account when the
 * token is still valid, or null after clearing invalid credentials.
 */
export async function restoreSession(): Promise<AuthResult | null> {
  const token = await getStoredToken();
  if (!token) return null;
  setAccessToken(token);
  try {
    const response = await apiRequest<MeResponse>('/me', { skipUnauthorizedHandler: true });
    return { user: response.user, profile: response.profile };
  } catch (error) {
    // Keep the token when the API is simply unreachable so the user can retry.
    if (error instanceof ApiError && error.status === 0) throw error;
    setAccessToken(null);
    await clearStoredToken();
    return null;
  }
}

export async function signOut(): Promise<void> {
  setAccessToken(null);
  await clearStoredToken();
}

export const authService = { signIn, register, restoreSession, signOut };
