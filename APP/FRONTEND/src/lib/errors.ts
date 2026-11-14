/**
 * Turns Supabase/PostgREST/Postgres errors into messages a student can act on.
 * The original code is kept as `code` so screens can branch when needed.
 */
export class AppError extends Error {
  code?: string;
  details?: string;

  constructor(message: string, code?: string, details?: string) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
  }
}

interface SupabaseLikeError {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
}

const FRIENDLY: Record<string, string> = {
  '23505': 'That already exists. Try a different value.',
  '23503': 'This item is linked to something that no longer exists.',
  '23514': 'Some of the details are not valid. Please check them.',
  '42501': 'You do not have permission to do that.',
  'P0002': 'We could not find that item.',
  'PGRST116': 'We could not find that item.',
  'PGRST301': 'Your session expired. Please sign in again.',
  '22P02': 'One of the values has the wrong format.',
};

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  const e = (error ?? {}) as SupabaseLikeError;
  const code = e.code;
  let message = e.message?.trim() || 'Something went wrong. Please try again.';

  if (code && FRIENDLY[code]) message = FRIENDLY[code];

  if (message.toLowerCase().includes('invalid login credentials')) {
    message = 'That email and password do not match an account.';
  } else if (message.toLowerCase().includes('email not confirmed')) {
    message = 'Please confirm your email address before signing in.';
  } else if (message.toLowerCase().includes('user already registered')) {
    message = 'An account with that email already exists. Try signing in.';
  } else if (message.toLowerCase().includes('password should be at least')) {
    message = 'Use a password of at least 8 characters.';
  } else if (message.toLowerCase().includes('failed to fetch')) {
    message =
      'Could not reach Supabase. Check your internet connection and the URL in .env.';
  }

  return new AppError(message, code, e.details);
}

export function errorMessage(error: unknown): string {
  return toAppError(error).message;
}
