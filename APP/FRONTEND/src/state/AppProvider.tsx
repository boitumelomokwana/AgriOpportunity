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

import { adminAttentionThresholdDays, mockAdminListings, mockAdminSummary } from '@/data/admin';
import { mockProfile } from '@/data/profile';
import { authService } from '@/services/authService';
import { applicationService } from '@/services/applicationService';
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
  saveAdminListing: (listing: AdminListing, mode: 'draft' | 'publish') => void;
  markSourceChecked: (id: string) => void;
  exploreFilters: OpportunityFilters;
  setExploreFilters: (filters: OpportunityFilters) => void;
  resetExploreFilters: () => void;
  toast: ToastState | null;
  showToast: (message: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [opportunitiesLoading, setOpportunitiesLoading] = useState(true);
  const [opportunitiesError, setOpportunitiesError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile>(mockProfile);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [adminListings, setAdminListings] = useState<AdminListing[]>(mockAdminListings);
  const [adminSummary, setAdminSummary] = useState<AdminSummary>(mockAdminSummary);
  const [exploreFilters, setExploreFiltersState] =
    useState<OpportunityFilters>(defaultFilters);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistedProfile = useRef<UserProfile>(mockProfile);
  const profileRef = useRef(profile);
  const profileSyncQueue = useRef<Promise<unknown>>(Promise.resolve());
  profileRef.current = profile;

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

  const loadAccountData = useCallback(async () => {
    const [nextProfile, nextSavedIds, nextNotifications, nextApplications] =
      await Promise.all([
        profileService.getProfile(),
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

  useEffect(() => {
    let active = true;
    void authService.restoreSession()
      .then(async (restored) => {
        if (!active) return;
        if (restored) {
          setIsAuthenticated(true);
          await loadAccountData();
        }
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
    const nextProfile = await authService.signIn(email, password);
    persistedProfile.current = nextProfile;
    setProfile(nextProfile);
    setIsAuthenticated(true);
    await loadAccountData();
  }, [loadAccountData]);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const nextProfile = await authService.register(name, email, password);
    persistedProfile.current = nextProfile;
    setProfile(nextProfile);
    setIsAuthenticated(true);
    await loadAccountData();
  }, [loadAccountData]);

  const signOut = useCallback(async () => {
    await authService.signOut();
    persistedProfile.current = mockProfile;
    setIsAuthenticated(false);
    setProfile(mockProfile);
    setSavedIds([]);
    setNotifications([]);
    setApplications([]);
  }, []);

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

  const adminAttention = useMemo(
    () =>
      adminListings.filter((listing) => {
        const daysAgo = -daysUntil(listing.sourceChecked);
        return daysAgo > adminAttentionThresholdDays;
      }),
    [adminListings],
  );

  const saveAdminListing = useCallback(
    (listing: AdminListing, mode: 'draft' | 'publish') => {
      const existing = adminListings.find((item) => item.id === listing.id);
      const publish = mode === 'publish';
      const nextStatus = publish ? 'Published' : 'Draft';

      setAdminListings((current) => {
        const found = current.find((item) => item.id === listing.id);
        if (found) {
          return current.map((item) =>
            item.id === listing.id ? { ...listing, status: nextStatus } : item,
          );
        }
        return [{ ...listing, status: nextStatus }, ...current];
      });

      setAdminSummary((current) => {
        if (!existing) {
          return {
            ...current,
            active: publish ? current.active + 1 : current.active,
            drafts: publish ? current.drafts : current.drafts + 1,
          };
        }
        if (existing.status === 'Draft' && publish) {
          return {
            ...current,
            active: current.active + 1,
            drafts: Math.max(0, current.drafts - 1),
          };
        }
        if (existing.status !== 'Draft' && !publish) {
          return {
            ...current,
            active: Math.max(0, current.active - 1),
            drafts: current.drafts + 1,
          };
        }
        return current;
      });

      showToast(publish ? 'Published (demo)' : 'Draft saved (demo)');
    },
    [adminListings, showToast],
  );

  const markSourceChecked = useCallback(
    (id: string) => {
      setAdminListings((current) =>
        current.map((listing) =>
          listing.id === id
            ? { ...listing, sourceChecked: new Date().toISOString() }
            : listing,
        ),
      );
      showToast('Source marked as checked');
    },
    [showToast],
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
      saveAdminListing,
      markSourceChecked,
      exploreFilters,
      setExploreFilters,
      resetExploreFilters,
      toast,
      showToast,
    }),
    [
      isAuthenticated,
      authReady,
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
      saveAdminListing,
      markSourceChecked,
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
