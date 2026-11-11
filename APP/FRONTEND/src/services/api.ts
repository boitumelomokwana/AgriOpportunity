const apiBaseUrl = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api').replace(
  /\/+$/,
  '',
);

const requestTimeoutMs = 15000;

let accessToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

/**
 * Called whenever an authenticated request is rejected with 401 so the app can
 * clear an expired session instead of leaving screens in a broken state.
 */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export function getApiBaseUrl() {
  return apiBaseUrl;
}

export interface ApiRequestOptions extends RequestInit {
  timeoutMs?: number;
  skipUnauthorizedHandler?: boolean;
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const {
    timeoutMs = requestTimeoutMs,
    skipUnauthorizedHandler = false,
    ...requestInit
  } = options;

  const headers = new Headers(requestInit.headers);
  headers.set('Accept', 'application/json');
  if (requestInit.body) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...requestInit,
      headers,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError(
        `The API did not respond within ${Math.round(timeoutMs / 1000)} seconds. Check that the backend is running and that ${apiBaseUrl} is reachable from this device.`,
        0,
      );
    }
    throw new ApiError(
      `Could not connect to the API at ${apiBaseUrl}. Check that the backend is running and EXPO_PUBLIC_API_URL is reachable from this device.`,
      0,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    if (response.status === 401 && !skipUnauthorizedHandler) {
      unauthorizedHandler?.();
    }
    throw new ApiError(
      body?.error ?? `Request failed with status ${response.status}.`,
      response.status,
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
