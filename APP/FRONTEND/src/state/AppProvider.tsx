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

import { mockProfile } from '@/data/profile';
import { authService } from '@/services/authService';
import { adminService } from '@/services/adminService';
import { applicationService } from '@/services/applicationService';
import { setUnauthorizedHandler } from '@/services/api';
import { defaultFilters, opportunityService } from '@/services/opportunityService';
import { notificationService } from '@/services/notificationService';
import { profileService } from '@/services/profileService';
import { savedService } from '@/services/savedService';
import type {
  AdminListing,
  AdminSummary,
  AppNotification,
  ApplicationRecord,
  ApplicationStatus,
  AuthUser,
  Opportunity,
  OpportunityFilters,
  UserProfile,
} from '@/types';
import { daysUntil } from '@/utils/date';

interface ToastState {
  id: number;
  message: string;
}

interface AppContextValue {
  isAuthenticated: boolean;
  authReady: boolean;
  user: AuthUser | null;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  opportunities: Opportunity[];
  opportunitiesLoading: boolean;
  opportunitiesError: string | null;
  reloadOpportunities: () => Promise<void>;
  profile: UserProfile;
  updateProfile: (patch: Partial<UserProfile>) => void;
  savedIds: string[];
  savedOpportunities: Opportunity[];
  isSaved: (id: string) => boolean;
  toggleSaved: (id: string) => void;
  notifications: AppNotification[];
  unreadCount: number;
  markAllRead: () => void;
  markNotificationRead: (id: string) => void;
  applications: ApplicationRecord[];
  updateApplicationStatus: (id: string, status: ApplicationStatus) => void;
  addApplication: (opportunityId: string) => void;
  adminListings: AdminListing[];
  adminSummary: AdminSummary;
  adminAttention: AdminListing[];
  adminLoading: boolean;
  adminError: string | null;
  refreshAdmin: () => Promise<void>;
  saveAdminListing: (listing: AdminListing, mode: 'draft' | 'publish') => Promise<boolean>;
  markSourceChecked: (id: string) => Promise<void>;
  deleteAdminListing: (id: string) => Promise<boolean>;
  exploreFilters: OpportunityFilters;
  setExploreFilters: (filters: OpportunityFilters) => void;
  resetExploreFilters: () => void;
  toast: ToastState | null;
  showToast: (message: string) => void;
}

const adminAttentionThresholdDays = 30;

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [opportunitiesLoading, setOpportunitiesLoading] = useState(true);
  const [opportunitiesError, setOpportunitiesError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile>(mockProfile);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [adminListings, setAdminListings] = useState<AdminListing[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [exploreFilters, setExploreFiltersState] =
    useState<OpportunityFilters>(defaultFilters);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistedProfile = useRef<UserProfile>(mockProfile);
  const profileRef = useRef(profile);
  const profileSyncQueue = useRef<Promise<unknown>>(Promise.resolve());
  profileRef.current = profile;

  const isAdmin = user?.role === 'admin';

  const loadOpportunities = useCallback(async () => {
    setOpportunitiesLoading(true);
    setOpportunitiesError(null);
    try {
      const data = await opportunityService.getOpportunities();
      setOpportunities(data);
    } catch (error) {
      setOpportunitiesError(
        error instanceof Error ? error.message : 'Unable to load opportunities.',
      );
    } finally {
      setOpportunitiesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOpportunities();
  }, [loadOpportunities]);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const showToast = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), message });
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }, []);

  const loadAccountData = useCallback(async (profileOverride?: UserProfile) => {
    const [nextProfile, nextSavedIds, nextNotifications, nextApplications] =
      await Promise.all([
        profileOverride ? Promise.resolve(profileOverride) : profileService.getProfile(),
        savedService.getSavedIds(),
        notificationService.getNotifications(),
        applicationService.getApplications(),
      ]);
    persistedProfile.current = nextProfile;
    setProfile(nextProfile);
    setSavedIds(nextSavedIds);
    setNotifications(nextNotifications);
    setApplications(nextApplications);
  }, []);

  const resetAccountState = useCallback(() => {
    persistedProfile.current = mockProfile;
    setIsAuthenticated(false);
    setUser(null);
    setProfile(mockProfile);
    setSavedIds([]);
    setNotifications([]);
    setApplications([]);
    setAdminListings([]);
    setAdminError(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void authService.signOut();
      resetAccountState();
      showToast('Your session expired. Please sign in again.');
    });
    return () => setUnauthorizedHandler(null);
  }, [resetAccountState, showToast]);

  useEffect(() => {
    let active = true;
    void authService.restoreSession()
      .then(async (session) => {
        if (!active || !session) return;
        setUser(session.user);
        setIsAuthenticated(true);
        persistedProfile.current = session.profile;
        setProfile(session.profile);
        await loadAccountData(session.profile);
      })
      .catch((error: unknown) => {
        if (active) {
          showToast(error instanceof Error ? error.message : 'Unable to restore your session.');
        }
      })
      .finally(() => {
        if (active) setAuthReady(true);
      });
    return () => {
      active = false;
    };
  }, [loadAccountData, showToast]);

  const signIn = useCallback(async (email: string, password: string) => {
    const session = await authService.signIn(email, password);
    setUser(session.user);
    persistedProfile.current = session.profile;
    setProfile(session.profile);
    setIsAuthenticated(true);
    await loadAccountData(session.profile);
  }, [loadAccountData]);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const session = await authService.register(name, email, password);
    setUser(session.user);
    persistedProfile.current = session.profile;
    setProfile(session.profile);
    setIsAuthenticated(true);
    await loadAccountData(session.profile);
  }, [loadAccountData]);

  const signOut = useCallback(async () => {
    await authService.signOut();
    resetAccountState();
  }, [resetAccountState]);

  const isSaved = useCallback((id: string) => savedIds.includes(id), [savedIds]);

  const toggleSaved = useCallback(
    async (id: string) => {
      if (!isAuthenticated) {
        showToast('Sign in to save opportunities.');
        return;
      }
      const exists = savedIds.includes(id);
      try {
        if (exists) {
          await savedService.removeSavedId(id);
          setSavedIds((current) => current.filter((item) => item !== id));
        } else {
          await savedService.addSavedId(id);
          setSavedIds((current) => current.includes(id) ? current : [...current, id]);
        }
        showToast(exists ? 'Removed from saved' : 'Saved for later');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to update saved opportunities.');
      }
    },
    [isAuthenticated, savedIds, showToast],
  );

  const savedOpportunities = useMemo(
    () => opportunities.filter((opportunity) => savedIds.includes(opportunity.id)),
    [opportunities, savedIds],
  );

  const unreadCount = useMemo(
    () => notifications.filter((notification) => notification.unread).length,
    [notifications],
  );

  const markAllRead = useCallback(async () => {
    try {
      await notificationService.markAllRead();
      setNotifications((current) =>
        current.map((notification) => ({ ...notification, unread: false })),
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to update notifications.');
    }
  }, [showToast]);

  const markNotificationRead = useCallback(async (id: string) => {
    try {
      await notificationService.markNotificationRead(id);
      setNotifications((current) =>
        current.map((notification) =>
          notification.id === id ? { ...notification, unread: false } : notification,
        ),
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to update notification.');
    }
  }, [showToast]);

  const updateProfile = useCallback((patch: Partial<UserProfile>) => {
    if (!isAuthenticated) {
      showToast('Sign in to save profile changes.');
      return;
    }
    setProfile((current) => ({
      ...current,
      ...patch,
      preferences: patch.preferences
        ? { ...current.preferences, ...patch.preferences }
        : current.preferences,
      notificationPreferences: patch.notificationPreferences
        ? { ...current.notificationPreferences, ...patch.notificationPreferences }
        : current.notificationPreferences,
    }));
  }, [isAuthenticated, showToast]);

  useEffect(() => {
    if (!isAuthenticated || profile === persistedProfile.current) return;
    const timer = setTimeout(() => {
      profileSyncQueue.current = profileSyncQueue.current
        .then(() => profileService.saveProfile(profile))
        .then(() => {
          if (profileRef.current === profile) persistedProfile.current = profile;
        })
        .catch((error: unknown) => {
          showToast(error instanceof Error ? error.message : 'Unable to save profile changes.');
        });
    }, 500);
    return () => clearTimeout(timer);
  }, [isAuthenticated, profile, showToast]);

  const updateApplicationStatus = useCallback(
    async (id: string, status: ApplicationStatus) => {
      try {
        await applicationService.updateApplicationStatus(id, status);
        const updatedAt = new Intl.DateTimeFormat('en-ZA', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }).format(new Date());
        setApplications((current) => current.map((application) =>
          application.id === id ? { ...application, status, updatedAt } : application,
        ));
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to update application status.');
      }
    },
    [showToast],
  );

  const addApplication = useCallback(
    async (opportunityId: string) => {
      if (!isAuthenticated) {
        showToast('Sign in to track opportunities.');
        return;
      }
      try {
        const record = await applicationService.addApplicationRecord(opportunityId);
        setApplications((current) => [
          ...current.filter((application) => application.id !== record.id),
          record,
        ]);
        showToast('Added to your application tracker');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to track this opportunity.');
      }
    },
    [isAuthenticated, showToast],
  );

  const refreshAdmin = useCallback(async () => {
    if (!isAuthenticated) return;
    setAdminLoading(true);
    setAdminError(null);
    try {
      setAdminListings(await adminService.getAdminListings());
    } catch (error) {
      setAdminError(
        error instanceof Error ? error.message : 'Unable to load administrator listings.',
      );
    } finally {
      setAdminLoading(false);
    }
  }, [isAuthenticated]);

  const adminSummary = useMemo(
    () => adminService.summariseListings(adminListings),
    [adminListings],
  );

  const adminAttention = useMemo(
    () =>
      adminListings.filter((listing) => {
        const daysAgo = -daysUntil(listing.sourceChecked);
        return daysAgo > adminAttentionThresholdDays;
      }),
    [adminListings],
  );

  const saveAdminListing = useCallback(
    async (listing: AdminListing, mode: 'draft' | 'publish') => {
      try {
        const saved = await adminService.saveAdminListing(listing, mode);
        setAdminListings((current) =>
          current.some((item) => item.id === saved.id)
            ? current.map((item) => (item.id === saved.id ? saved : item))
            : [...current, saved],
        );
        showToast(mode === 'publish' ? 'Listing published' : 'Draft saved');
        if (mode === 'publish') void loadOpportunities();
        return true;
      } catch (error) {
        showToast(
          error instanceof Error ? error.message : 'Unable to save this listing.',
        );
        return false;
      }
    },
    [loadOpportunities, showToast],
  );

  const markSourceChecked = useCallback(
    async (id: string) => {
      const listing = adminListings.find((item) => item.id === id);
      if (!listing) return;
      try {
        const saved = await adminService.markSourceChecked(listing);
        setAdminListings((current) =>
          current.map((item) => (item.id === saved.id ? saved : item)),
        );
        showToast('Source marked as checked');
      } catch (error) {
        showToast(
          error instanceof Error ? error.message : 'Unable to update the source check.',
        );
      }
    },
    [adminListings, showToast],
  );

  const deleteAdminListing = useCallback(
    async (id: string) => {
      try {
        await adminService.deleteAdminListing(id);
        setAdminListings((current) => current.filter((item) => item.id !== id));
        showToast('Listing deleted');
        void loadOpportunities();
        return true;
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to delete this listing.');
        return false;
      }
    },
    [loadOpportunities, showToast],
  );

  const setExploreFilters = useCallback((filters: OpportunityFilters) => {
    setExploreFiltersState(filters);
  }, []);

  const resetExploreFilters = useCallback(() => {
    setExploreFiltersState(defaultFilters);
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      isAuthenticated,
      authReady,
      user,
      isAdmin,
      signIn,
      register,
      signOut,
      opportunities,
      opportunitiesLoading,
      opportunitiesError,
      reloadOpportunities: loadOpportunities,
      profile,
      updateProfile,
      savedIds,
      savedOpportunities,
      isSaved,
      toggleSaved,
      notifications,
      unreadCount,
      markAllRead,
      markNotificationRead,
      applications,
      updateApplicationStatus,
      addApplication,
      adminListings,
      adminSummary,
      adminAttention,
      adminLoading,
      adminError,
      refreshAdmin,
      saveAdminListing,
      markSourceChecked,
      deleteAdminListing,
      exploreFilters,
      setExploreFilters,
      resetExploreFilters,
      toast,
      showToast,
    }),
    [
      isAuthenticated,
      authReady,
      user,
      isAdmin,
      signIn,
      register,
      signOut,
      opportunities,
      opportunitiesLoading,
      opportunitiesError,
      loadOpportunities,
      profile,
      updateProfile,
      savedIds,
      savedOpportunities,
      isSaved,
      toggleSaved,
      notifications,
      unreadCount,
      markAllRead,
      markNotificationRead,
      applications,
      updateApplicationStatus,
      addApplication,
      adminListings,
      adminSummary,
      adminAttention,
      adminLoading,
      adminError,
      refreshAdmin,
      saveAdminListing,
      markSourceChecked,
      deleteAdminListing,
      exploreFilters,
      setExploreFilters,
      resetExploreFilters,
      toast,
      showToast,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside AppProvider');
  return context;
}
