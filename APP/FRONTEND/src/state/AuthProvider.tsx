import type { Session, User } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { errorMessage } from '@/lib/errors';
import {
  isSupabaseConfigured,
  supabaseConfigError,
} from '@/lib/supabase';
import { authService, type SignUpDetails } from '@/services/authService';
import { organizationService } from '@/services/organizationService';
import { profileService, type ProfilePatch } from '@/services/profileService';
import type { AdminRole, Organization, UserProfile } from '@/types';

/** Empty, non-fake profile used before a session exists. */
export const emptyProfile: UserProfile = {
  id: '',
  name: 'Guest',
  initials: 'G',
  email: '',
  phone: '',
  status: 'Student',
  education: '',
  institution: '',
  fieldOfStudy: '',
  province: '',
  interests: [],
  preferences: {
    careerFields: [],
    preferredLocation: '',
    workArrangement: 'Flexible',
    experience: '',
  },
  notificationPreferences: {
    closingDates: true,
    newMatches: true,
    savedUpdates: true,
    opportunityTypes: [],
  },
  completion: 0,
  avatarUrl: null,
  city: '',
  bio: '',
  onboardingCompleted: false,
};

interface SignUpResult {
  needsEmailConfirmation: boolean;
}

interface AuthContextValue {
  configured: boolean;
  configError: string | null;
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  adminRole: AdminRole | null;
  adminRoleError: string | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  /** Companies the signed-in user belongs to (empty for students/admins). */
  companyOrganizations: Organization[];
  companyAccessError: string | null;
  profileSaveError: string | null;
  signIn: (email: string, password: string) => Promise<Session>;
  signUp: (
    email: string,
    password: string,
    details: SignUpDetails,
  ) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  updateProfile: (patch: Partial<UserProfile>) => void;
  flushProfile: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  /**
   * Re-reads the admin role from Supabase. Pass a user id when the session
   * state has not committed yet (e.g. immediately after sign-in). Throws when
   * the role could not be verified so the caller can fail closed.
   */
  refreshAdminRole: (userId?: string) => Promise<AdminRole | null>;
  /**
   * Re-reads the user's company memberships from Supabase. Used by the company
   * sign-in path; throws when memberships cannot be verified so callers fail
   * closed instead of treating an error as "no company".
   */
  refreshCompanyAccess: (userId?: string) => Promise<Organization[]>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STATUS_TO_DB: Record<string, string> = {
  Learner: 'learner',
  Student: 'student',
  Graduate: 'graduate',
  'Job seeker': 'job seeker',
  Other: 'other',
};

function mergePreferences(
  current: UserProfile,
  patch: Partial<UserProfile>,
): Pick<UserProfile, 'preferences' | 'notificationPreferences'> {
  return {
    preferences: patch.preferences
      ? { ...current.preferences, ...patch.preferences }
      : current.preferences,
    notificationPreferences: patch.notificationPreferences
      ? { ...current.notificationPreferences, ...patch.notificationPreferences }
      : current.notificationPreferences,
  };
}

function applyLocalPatch(
  current: UserProfile,
  patch: Partial<UserProfile>,
): UserProfile {
  const merged = mergePreferences(current, patch);
  return { ...current, ...patch, ...merged };
}

/** Convert the UI profile patch into the column names the table uses. */
function toDbPatch(patch: Partial<UserProfile>): ProfilePatch {
  const db: ProfilePatch = {};
  if (patch.name !== undefined) db.full_name = patch.name;
  if (patch.email !== undefined) db.email = patch.email;
  if (patch.phone !== undefined) db.phone = patch.phone;
  if (patch.province !== undefined) db.province = patch.province || null;
  if (patch.education !== undefined) db.qualification = patch.education || null;
  if (patch.fieldOfStudy !== undefined) db.field_of_study = patch.fieldOfStudy || null;
  if (patch.institution !== undefined) db.institution = patch.institution || null;
  if (patch.city !== undefined) db.city = patch.city || null;
  if (patch.bio !== undefined) db.bio = patch.bio || null;
  if (patch.dateOfBirth !== undefined) db.date_of_birth = patch.dateOfBirth || null;
  if (patch.avatarUrl !== undefined) db.avatar_url = patch.avatarUrl || null;
  if (patch.interests !== undefined) db.interests = patch.interests;
  if (patch.preferences !== undefined) {
    db.preferences = patch.preferences as unknown as Record<string, unknown>;
  }
  if (patch.notificationPreferences !== undefined) {
    db.notification_preferences =
      patch.notificationPreferences as unknown as Record<string, unknown>;
  }
  if (patch.onboardingCompleted !== undefined) {
    db.onboarding_completed = patch.onboardingCompleted;
  }
  if (patch.status !== undefined) {
    db.employment_status = STATUS_TO_DB[patch.status] ?? 'other';
  }
  return db;
}

function mergeDbPatch(base: ProfilePatch, next: ProfilePatch): ProfilePatch {
  return { ...base, ...next };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [adminRole, setAdminRole] = useState<AdminRole | null>(null);
  const [adminRoleError, setAdminRoleError] = useState<string | null>(null);
  const [companyOrganizations, setCompanyOrganizations] = useState<Organization[]>([]);
  const [companyAccessError, setCompanyAccessError] = useState<string | null>(null);
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);

  const userIdRef = useRef<string | null>(null);
  const pendingPatchRef = useRef<ProfilePatch>({});
  const pendingLocalRef = useRef<Partial<UserProfile>>({});
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const loadedRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      mountedRef.current = false;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    },
    [],
  );

  const loadProfile = useCallback(async (user: User) => {
    const requestUserId = user.id;
    userIdRef.current = requestUserId;
    const [profileResult, roleResult, companyResult] = await Promise.allSettled([
      profileService.fetchProfile(requestUserId),
      profileService.fetchAdminRole(requestUserId),
      organizationService.listMyOrganizations(requestUserId),
    ]);
    // The account can change while these requests are in flight. Only apply a
    // result that still belongs to the account that requested it.
    if (!mountedRef.current || userIdRef.current !== requestUserId) return;

    if (profileResult.status === 'fulfilled') {
      setProfile(profileResult.value);
      setProfileSaveError(null);
    } else {
      setProfileSaveError(errorMessage(profileResult.reason));
    }

    if (roleResult.status === 'fulfilled') {
      setAdminRole(roleResult.value);
      setAdminRoleError(null);
    } else {
      // Fail closed: a failed verification is not the same as "not an admin",
      // and it must never leave a stale admin session open.
      setAdminRole(null);
      const message = errorMessage(roleResult.reason);
      setAdminRoleError(message);
      console.warn('[auth] Could not verify the administrator role:', message);
    }

    if (companyResult.status === 'fulfilled') {
      setCompanyOrganizations(companyResult.value);
      setCompanyAccessError(null);
    } else {
      // A company member must never be treated as a student because the
      // membership query failed. Surface the error and keep the list empty.
      setCompanyOrganizations([]);
      const message = errorMessage(companyResult.reason);
      setCompanyAccessError(message);
      console.warn('[auth] Could not verify company membership:', message);
    }

    if (mountedRef.current) setLoading(false);
  }, []);

  const refreshAdminRole = useCallback(
    async (explicitUserId?: string): Promise<AdminRole | null> => {
      const userId = explicitUserId ?? userIdRef.current;
      if (!userId) {
        if (mountedRef.current) {
          setAdminRole(null);
          setAdminRoleError(null);
        }
        return null;
      }

      try {
        const role = await profileService.fetchAdminRole(userId);
        if (!mountedRef.current || userIdRef.current !== userId) return role;
        setAdminRole(role);
        setAdminRoleError(null);
        return role;
      } catch (error) {
        // Swallow stale failures: they belong to an account that is no longer
        // signed in, and applying them would corrupt the current session.
        if (!mountedRef.current || userIdRef.current !== userId) return null;
        setAdminRole(null);
        const message = errorMessage(error);
        setAdminRoleError(message);
        console.warn('[auth] Could not verify the administrator role:', message);
        throw error;
      }
    },
    [],
  );

  const refreshCompanyAccess = useCallback(
    async (explicitUserId?: string): Promise<Organization[]> => {
      const userId = explicitUserId ?? userIdRef.current;
      if (!userId) {
        if (mountedRef.current) {
          setCompanyOrganizations([]);
          setCompanyAccessError(null);
        }
        return [];
      }

      try {
        const organizations = await organizationService.listMyOrganizations(userId);
        if (!mountedRef.current || userIdRef.current !== userId) return organizations;
        setCompanyOrganizations(organizations);
        setCompanyAccessError(null);
        return organizations;
      } catch (error) {
        if (!mountedRef.current || userIdRef.current !== userId) return [];
        setCompanyOrganizations([]);
        const message = errorMessage(error);
        setCompanyAccessError(message);
        console.warn('[auth] Could not verify company membership:', message);
        throw error;
      }
    },
    [],
  );

  const refreshProfile = useCallback(async () => {
    const user = session?.user;
    if (!user) return;
    const [nextProfile] = await Promise.all([
      profileService.fetchProfile(user.id),
      refreshAdminRole(user.id).catch(() => null),
    ]);
    if (!mountedRef.current || userIdRef.current !== user.id) return;
    setProfile(nextProfile);
  }, [session, refreshAdminRole]);

  const flushProfile = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const userId = userIdRef.current;
    const dbPatch = pendingPatchRef.current;
    const localPatch = pendingLocalRef.current;
    pendingPatchRef.current = {};
    pendingLocalRef.current = {};
    if (!userId || Object.keys(dbPatch).length === 0) return;

    try {
      // Interests live in their own table, which updateProfile handles.
      const saved = await profileService.updateProfile(userId, dbPatch);
      if (!mountedRef.current) return;
      // Do not clobber edits made while the request was in flight.
      if (Object.keys(pendingPatchRef.current).length === 0) {
        setProfile((current) => (current ? applyLocalPatch(saved, localPatch) : saved));
      }
      setProfileSaveError(null);
    } catch (error) {
      if (!mountedRef.current) return;
      setProfileSaveError(errorMessage(error));
    }
  }, []);

  const updateProfile = useCallback((patch: Partial<UserProfile>) => {
    setProfile((current) => (current ? applyLocalPatch(current, patch) : current));
    pendingLocalRef.current = mergeLocal(pendingLocalRef.current, patch);
    pendingPatchRef.current = mergeDbPatch(
      pendingPatchRef.current,
      toDbPatch(patch),
    );
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void flushProfile();
    }, 700);
  }, [flushProfile]);

  /* ------------------------------ auth lifecycle ----------------------- */

  const handleSession = useCallback(
    (next: Session | null, event: string) => {
      if (!mountedRef.current) return;
      setSession(next);
      const user = next?.user ?? null;

      if (!user) {
        userIdRef.current = null;
        loadedRef.current = null;
        setProfile(null);
        setAdminRole(null);
        setAdminRoleError(null);
        setCompanyOrganizations([]);
        setCompanyAccessError(null);
        setLoading(false);
        return;
      }

      // Clear anything that belonged to a previous account before the new
      // role check resolves, so an admin user can never inherit a stale role.
      if (userIdRef.current !== user.id) {
        userIdRef.current = user.id;
        loadedRef.current = null;
        setProfile(null);
        setAdminRole(null);
        setAdminRoleError(null);
        setCompanyOrganizations([]);
        setCompanyAccessError(null);
      }

      // A refresh keeps the same account; re-check the role so a role granted
      // or revoked server-side is reflected without signing out and back in.
      if (event === 'TOKEN_REFRESHED' && loadedRef.current === user.id) {
        void refreshAdminRole(user.id).catch(() => undefined);
        void refreshCompanyAccess(user.id).catch(() => undefined);
        return;
      }

      if (loadedRef.current === user.id && event !== 'USER_UPDATED') return;

      loadedRef.current = user.id;
      setLoading(true);
      // Reading from other Supabase services inside the auth callback can
      // deadlock the client, so defer one tick.
      setTimeout(() => {
        void loadProfile(user);
      }, 0);
    },
    [loadProfile, refreshAdminRole, refreshCompanyAccess],
  );

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    let active = true;
    let unsubscribe: (() => void) | undefined;

    void authService
      .getSession()
      .then((initial) => {
        if (!active) return;
        handleSession(initial, 'INITIAL_SESSION');
      })
      .catch(() => {
        if (active) setLoading(false);
      });

    try {
      unsubscribe = authService.onAuthStateChange((event, next) => {
        if (!active) return;
        // Supabase emits INITIAL_SESSION itself on some versions; the
        // loadedRef guard keeps duplicate profile loads out.
        handleSession(next, event);
      });
    } catch {
      if (active) setLoading(false);
    }

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [handleSession]);

  /* ------------------------------ actions ------------------------------ */

  const signIn = useCallback(async (email: string, password: string) => {
    const next = await authService.signIn(email, password);
    handleSession(next, 'SIGNED_IN');
    return next;
  }, [handleSession]);

  const signUp = useCallback(
    async (email: string, password: string, details: SignUpDetails) => {
      const result = await authService.signUp(email, password, details);
      if (result.session) handleSession(result.session, 'SIGNED_IN');
      return { needsEmailConfirmation: result.needsEmailConfirmation };
    },
    [handleSession],
  );

  const signOut = useCallback(async () => {
    await flushProfile();
    await authService.signOut();
    handleSession(null, 'SIGNED_OUT');
  }, [flushProfile, handleSession]);

  const resetPassword = useCallback(
    (email: string) => authService.sendPasswordReset(email),
    [],
  );

  const updatePassword = useCallback(
    (password: string) => authService.updatePassword(password),
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      configured: isSupabaseConfigured,
      configError: isSupabaseConfigured ? null : supabaseConfigError,
      loading,
      session,
      user: session?.user ?? null,
      profile,
      adminRole,
      adminRoleError,
      isAdmin: adminRole !== null,
      isSuperAdmin: adminRole === 'super_admin',
      companyOrganizations,
      companyAccessError,
      profileSaveError,
      signIn,
      signUp,
      signOut,
      resetPassword,
      updatePassword,
      updateProfile,
      flushProfile,
      refreshProfile,
      refreshAdminRole,
      refreshCompanyAccess,
    }),
    [
      loading,
      session,
      profile,
      adminRole,
      adminRoleError,
      companyOrganizations,
      companyAccessError,
      profileSaveError,
      signIn,
      signUp,
      signOut,
      resetPassword,
      updatePassword,
      updateProfile,
      flushProfile,
      refreshProfile,
      refreshAdminRole,
      refreshCompanyAccess,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function mergeLocal(
  base: Partial<UserProfile>,
  patch: Partial<UserProfile>,
): Partial<UserProfile> {
  const next: Partial<UserProfile> = { ...base, ...patch };
  if (base.preferences || patch.preferences) {
    next.preferences = {
      ...(base.preferences ?? emptyProfile.preferences),
      ...(patch.preferences ?? {}),
    } as UserProfile['preferences'];
  }
  if (base.notificationPreferences || patch.notificationPreferences) {
    next.notificationPreferences = {
      ...(base.notificationPreferences ?? emptyProfile.notificationPreferences),
      ...(patch.notificationPreferences ?? {}),
    } as UserProfile['notificationPreferences'];
  }
  return next;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
