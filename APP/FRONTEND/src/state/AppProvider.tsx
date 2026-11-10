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

import { mockApplications } from '@/data/applications';
import { adminAttentionThresholdDays, mockAdminListings, mockAdminSummary } from '@/data/admin';
import { mockNotifications } from '@/data/notifications';
import { mockProfile } from '@/data/profile';
import { applicationService } from '@/services/applicationService';
import { defaultFilters, opportunityService } from '@/services/opportunityService';
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
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [opportunitiesLoading, setOpportunitiesLoading] = useState(true);
  const [opportunitiesError, setOpportunitiesError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile>(mockProfile);
  const [savedIds, setSavedIds] = useState<string[]>(['1', '3', '4']);
  const [notifications, setNotifications] = useState<AppNotification[]>(mockNotifications);
  const [applications, setApplications] = useState<ApplicationRecord[]>(mockApplications);
  const [adminListings, setAdminListings] = useState<AdminListing[]>(mockAdminListings);
  const [adminSummary, setAdminSummary] = useState<AdminSummary>(mockAdminSummary);
  const [exploreFilters, setExploreFiltersState] =
    useState<OpportunityFilters>(defaultFilters);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const isSaved = useCallback((id: string) => savedIds.includes(id), [savedIds]);

  const toggleSaved = useCallback(
    (id: string) => {
      const exists = savedIds.includes(id);
      setSavedIds((current) =>
        exists ? current.filter((item) => item !== id) : [...current, id],
      );
      showToast(exists ? 'Removed from saved' : 'Saved for later');
    },
    [savedIds, showToast],
  );

  const savedOpportunities = useMemo(
    () => opportunities.filter((opportunity) => savedIds.includes(opportunity.id)),
    [opportunities, savedIds],
  );

  const unreadCount = useMemo(
    () => notifications.filter((notification) => notification.unread).length,
    [notifications],
  );

  const markAllRead = useCallback(() => {
    setNotifications((current) =>
      current.map((notification) => ({ ...notification, unread: false })),
    );
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id ? { ...notification, unread: false } : notification,
      ),
    );
  }, []);

  const updateProfile = useCallback((patch: Partial<UserProfile>) => {
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
  }, []);

  const updateApplicationStatus = useCallback(
    (id: string, status: ApplicationStatus) => {
      setApplications((current) =>
        applicationService.updateApplicationStatus(current, id, status),
      );
    },
    [],
  );

  const addApplication = useCallback(
    (opportunityId: string) => {
      setApplications((current) =>
        applicationService.addApplicationRecord(current, opportunityId),
      );
      showToast('Added to your application tracker');
    },
    [showToast],
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
