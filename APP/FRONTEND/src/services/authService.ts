import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { UserProfile } from '@/types';
import { apiRequest, setAccessToken } from './api';

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
  user: { id: string; email: string; role: 'user' | 'admin' };
}

async function saveSession(response: AuthResponse) {
  await storeToken(response.token);
  setAccessToken(response.token);
  return response.profile;
}

export async function signIn(email: string, password: string): Promise<UserProfile> {
  const response = await apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return saveSession(response);
}

export async function register(
  name: string,
  email: string,
  password: string,
): Promise<UserProfile> {
  const response = await apiRequest<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
  return saveSession(response);
}

export async function restoreSession(): Promise<boolean> {
  const token = await getStoredToken();
  if (!token) return false;
  setAccessToken(token);
  try {
    await apiRequest('/me');
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Could not connect')) throw error;
    setAccessToken(null);
    await clearStoredToken();
    return false;
  }
}

export async function signOut(): Promise<void> {
  setAccessToken(null);
  await clearStoredToken();
}

export const authService = { signIn, register, restoreSession, signOut };
