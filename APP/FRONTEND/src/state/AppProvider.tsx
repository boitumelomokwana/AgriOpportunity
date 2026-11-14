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
import { AppState } from 'react-native';

import { errorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { applicationService } from '@/services/applicationService';
import { bookmarkService } from '@/services/bookmarkService';
import { discoveryService } from '@/services/discoveryService';
import { notificationService } from '@/services/notificationService';
import {
  defaultFilters,
  opportunityService,
  withMatches,
} from '@/services/opportunityService';
import { emptyProfile, useAuth } from '@/state/AuthProvider';
import type {
  AppNotification,
  ApplicationRecord,
  ApplicationStatus,
  DeadlineReminderRecord,
  Opportunity,
  OpportunityFilters,
  SavedSearch,
  UserProfile,
} from '@/types';

interface ToastState {
  id: number;
  message: string;
}

interface AppContextValue {
  opportunities: Opportunity[];
  opportunitiesLoading: boolean;
  opportunitiesError: string | null;
  reloadOpportunities: () => Promise<void>;
  profile: UserProfile;
  isSignedIn: boolean;
  updateProfile: (patch: Partial<UserProfile>) => void;
  savedIds: string[];
  savedOpportunities: Opportunity[];
  isSaved: (id: string) => boolean;
  toggleSaved: (id: string) => Promise<void>;
  notifications: AppNotification[];
  unreadCount: number;
  markAllRead: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  applications: ApplicationRecord[];
  updateApplicationStatus: (
    id: string,
    status: ApplicationStatus,
  ) => Promise<void>;
  addApplication: (opportunityId: string) => Promise<void>;
  savedSearches: SavedSearch[];
  createSavedSearch: (name: string, query: string) => Promise<void>;
  deleteSavedSearch: (id: string) => Promise<void>;
  reminders: DeadlineReminderRecord[];
  setReminder: (opportunityId: string, daysBefore?: number) => Promise<void>;
  removeReminder: (opportunityId: string) => Promise<void>;
  refreshUserData: () => Promise<void>;
  exploreFilters: OpportunityFilters;
  setExploreFilters: (filters: OpportunityFilters) => void;
  resetExploreFilters: () => void;
  toast: ToastState | null;
  showToast: (message: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const {
    user,
    profile: authProfile,
    updateProfile: persistProfile,
    profileSaveError,
  } = useAuth();

  const [rawOpportunities, setRawOpportunities] = useState<Opportunity[]>([]);
  const [opportunitiesLoading, setOpportunitiesLoading] = useState(true);
  const [opportunitiesError, setOpportunitiesError] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [reminders, setReminders] = useState<DeadlineReminderRecord[]>([]);
  const [exploreFilters, setExploreFiltersState] =
    useState<OpportunityFilters>(defaultFilters);
  const [toast, setToast] = useState<ToastState | null>(null);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const realtimeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshUserTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastProfileError = useRef<string | null>(null);
  const userId = user?.id ?? null;

  const profile = authProfile ?? emptyProfile;
  const isSignedIn = Boolean(user);

  const showToast = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), message });
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (realtimeTimer.current) clearTimeout(realtimeTimer.current);
      if (refreshUserTimer.current) clearTimeout(refreshUserTimer.current);
    },
    [],
  );

  // Surface a failed profile save without reverting the optimistic edit.
  useEffect(() => {
    if (profileSaveError && profileSaveError !== lastProfileError.current) {
      lastProfileError.current = profileSaveError;
      showToast(profileSaveError);
    }
    if (!profileSaveError) lastProfileError.current = null;
  }, [profileSaveError, showToast]);

  /* --------------------------- opportunities --------------------------- */

  const loadOpportunities = useCallback(async (silent = false) => {
    if (!silent) setOpportunitiesLoading(true);
    setOpportunitiesError(null);
    try {
      const data = await opportunityService.fetchPublishedOpportunities();
      setRawOpportunities(data);
    } catch (error) {
      setOpportunitiesError(errorMessage(error));
    } finally {
      setOpportunitiesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOpportunities();
  }, [loadOpportunities]);

  const opportunities = useMemo(
    () => withMatches(rawOpportunities, authProfile),
    [rawOpportunities, authProfile],
  );

  /* --------------------------- user data ------------------------------- */

  const loadSavedIds = useCallback(async (id: string) => {
    const ids = await bookmarkService.listBookmarkIds(id);
    setSavedIds(ids);
  }, []);

  const loadNotifications = useCallback(async (id: string) => {
    const items = await notificationService.listNotifications(id);
    setNotifications(items);
  }, []);

  const loadApplications = useCallback(async (id: string) => {
    const items = await applicationService.listApplications(id);
    setApplications(items);
  }, []);

  const loadSavedSearches = useCallback(async (id: string) => {
    const items = await discoveryService.listSavedSearches(id);
    setSavedSearches(items);
  }, []);

  const loadReminders = useCallback(async (id: string) => {
    const items = await discoveryService.listReminders(id);
    setReminders(items);
  }, []);

  const refreshUserData = useCallback(async () => {
    if (!userId) {
      setSavedIds([]);
      setNotifications([]);
      setApplications([]);
      setSavedSearches([]);
      setReminders([]);
      return;
    }
    const results = await Promise.allSettled([
      loadSavedIds(userId),
      loadNotifications(userId),
      loadApplications(userId),
      loadSavedSearches(userId),
      loadReminders(userId),
    ]);
    const failure = results.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    if (failure) console.warn('Could not refresh account data:', failure.reason);
  }, [
    userId,
    loadSavedIds,
    loadNotifications,
    loadApplications,
    loadSavedSearches,
    loadReminders,
  ]);

  useEffect(() => {
    void refreshUserData();
  }, [refreshUserData]);

  /* ----------------------------- realtime ------------------------------ */

  useEffect(() => {
    if (!supabase) return;

    const scheduleOpportunities = () => {
      if (realtimeTimer.current) clearTimeout(realtimeTimer.current);
      realtimeTimer.current = setTimeout(() => void loadOpportunities(true), 500);
    };
    const scheduleUserData = () => {
      if (!userId) return;
      if (refreshUserTimer.current) clearTimeout(refreshUserTimer.current);
      refreshUserTimer.current = setTimeout(() => void refreshUserData(), 500);
    };

    const channel = supabase
      .channel('nextstep-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'opportunities' },
        scheduleOpportunities,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        scheduleUserData,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'applications' },
        scheduleUserData,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'organizations' },
        scheduleOpportunities,
      )
      .subscribe((status) => {
        // Realtime is an enhancement: a blocked WebSocket (offline, corporate
        // proxy) must not surface as an unhandled rejection. Pull-to-refresh
        // and the AppState listener still keep data current.
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('Realtime connection unavailable:', status);
        }
      });

    return () => {
      if (realtimeTimer.current) clearTimeout(realtimeTimer.current);
      if (refreshUserTimer.current) clearTimeout(refreshUserTimer.current);
      void supabase?.removeChannel(channel);
    };
  }, [userId, loadOpportunities, refreshUserData]);

  // Refresh when the app comes back to the foreground.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void loadOpportunities(true);
      void refreshUserData();
    });
    return () => subscription.remove();
  }, [loadOpportunities, refreshUserData]);

  /* ----------------------------- actions ------------------------------- */

  const updateProfile = useCallback(
    (patch: Partial<UserProfile>) => {
      if (!isSignedIn) {
        showToast('Sign in to save profile changes.');
        return;
      }
      persistProfile(patch);
    },
    [isSignedIn, persistProfile, showToast],
  );

  const isSaved = useCallback((id: string) => savedIds.includes(id), [savedIds]);

  const toggleSaved = useCallback(
    async (id: string) => {
      if (!userId) {
        showToast('Sign in to save opportunities.');
        return;
      }
      const exists = savedIds.includes(id);
      setSavedIds((current) =>
        exists ? current.filter((item) => item !== id) : [...current, id],
      );
      try {
        if (exists) await bookmarkService.removeBookmark(userId, id);
        else await bookmarkService.addBookmark(userId, id);
        showToast(exists ? 'Removed from saved' : 'Saved for later');
      } catch (error) {
        setSavedIds((current) =>
          exists ? [...current, id] : current.filter((item) => item !== id),
        );
        showToast(errorMessage(error));
      }
    },
    [savedIds, showToast, userId],
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
    if (!userId) return;
    setNotifications((current) =>
      current.map((notification) => ({ ...notification, unread: false })),
    );
    try {
      await notificationService.markAllNotificationsRead(userId);
    } catch (error) {
      showToast(errorMessage(error));
      await loadNotifications(userId);
    }
  }, [userId, showToast, loadNotifications]);

  const markNotificationRead = useCallback(
    async (id: string) => {
      if (!userId) return;
      setNotifications((current) =>
        current.map((notification) =>
          notification.id === id ? { ...notification, unread: false } : notification,
        ),
      );
      try {
        await notificationService.markNotificationRead(userId, id);
      } catch (error) {
        showToast(errorMessage(error));
      }
    },
    [userId, showToast],
  );

  const updateApplicationStatus = useCallback(
    async (id: string, status: ApplicationStatus) => {
      if (!userId) {
        showToast('Sign in to update your applications.');
        return;
      }
      try {
        const updated = await applicationService.updateApplication(userId, id, status);
        setApplications((current) =>
          current.map((record) => (record.id === id ? updated : record)),
        );
        showToast(`Marked as ${status.toLowerCase()}`);
      } catch (error) {
        showToast(errorMessage(error));
      }
    },
    [userId, showToast],
  );

  const addApplication = useCallback(
    async (opportunityId: string) => {
      if (!userId) {
        showToast('Sign in to track applications.');
        return;
      }
      try {
        const created = await applicationService.createApplication(
          userId,
          opportunityId,
        );
        setApplications((current) => {
          const exists = current.some((record) => record.id === created.id);
          return exists
            ? current.map((record) => (record.id === created.id ? created : record))
            : [created, ...current];
        });
        showToast(
          created.status === 'Interested'
            ? 'Added to your application tracker'
            : 'Application updated',
        );
      } catch (error) {
        showToast(errorMessage(error));
      }
    },
    [userId, showToast],
  );

  const createSavedSearch = useCallback(
    async (name: string, query: string) => {
      if (!userId) {
        showToast('Sign in to save searches.');
        return;
      }
      try {
        const created = await discoveryService.createSavedSearch(
          userId,
          name,
          query,
          exploreFilters,
        );
        setSavedSearches((current) => [created, ...current]);
        showToast('Search saved');
      } catch (error) {
        showToast(errorMessage(error));
      }
    },
    [userId, exploreFilters, showToast],
  );

  const deleteSavedSearch = useCallback(
    async (id: string) => {
      if (!userId) return;
      const previous = savedSearches;
      setSavedSearches((current) => current.filter((item) => item.id !== id));
      try {
        await discoveryService.deleteSavedSearch(userId, id);
      } catch (error) {
        setSavedSearches(previous);
        showToast(errorMessage(error));
      }
    },
    [userId, savedSearches, showToast],
  );

  const setReminder = useCallback(
    async (opportunityId: string, daysBefore = 7) => {
      if (!userId) {
        showToast('Sign in to set reminders.');
        return;
      }
      try {
        const reminder = await discoveryService.setReminder(
          opportunityId,
          daysBefore,
        );
        setReminders((current) => [
          reminder,
          ...current.filter((item) => item.opportunityId !== opportunityId),
        ]);
        showToast(`Reminder set for ${daysBefore} days before closing`);
      } catch (error) {
        showToast(errorMessage(error));
      }
    },
    [userId, showToast],
  );

  const removeReminder = useCallback(
    async (opportunityId: string) => {
      if (!userId) return;
      const previous = reminders;
      setReminders((current) =>
        current.filter((item) => item.opportunityId !== opportunityId),
      );
      try {
        await discoveryService.removeReminder(userId, opportunityId);
        showToast('Reminder removed');
      } catch (error) {
        setReminders(previous);
        showToast(errorMessage(error));
      }
    },
    [userId, reminders, showToast],
  );

  const setExploreFilters = useCallback((filters: OpportunityFilters) => {
    setExploreFiltersState(filters);
  }, []);

  const resetExploreFilters = useCallback(() => {
    setExploreFiltersState(defaultFilters);
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      opportunities,
      opportunitiesLoading,
      opportunitiesError,
      reloadOpportunities: () => loadOpportunities(),
      profile,
      isSignedIn,
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
      savedSearches,
      createSavedSearch,
      deleteSavedSearch,
      reminders,
      setReminder,
      removeReminder,
      refreshUserData,
      exploreFilters,
      setExploreFilters,
      resetExploreFilters,
      toast,
      showToast,
    }),
    [
      opportunities,
      opportunitiesLoading,
      opportunitiesError,
      loadOpportunities,
      profile,
      isSignedIn,
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
      savedSearches,
      createSavedSearch,
      deleteSavedSearch,
      reminders,
      setReminder,
      removeReminder,
      refreshUserData,
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
