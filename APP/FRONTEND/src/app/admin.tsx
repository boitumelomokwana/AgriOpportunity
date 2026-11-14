import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { FormField } from '@/components/FormField';
import { SectionHeader } from '@/components/SectionHeader';
import { StatCard } from '@/components/StatCard';
import {
  AuditLogPanel,
  DiscoveryAdmin,
} from '@/components/admin/DiscoveryAdmin';
import { colors, radius, spacing, type } from '@/constants/theme';
import { errorMessage } from '@/lib/errors';
import {
  adminDiscoveryService,
  type DiscoveryStats,
} from '@/services/adminDiscoveryService';
import { adminService, type AdminUserRow } from '@/services/adminService';
import { organizationService } from '@/services/organizationService';
import { useApp } from '@/state/AppProvider';
import { useAuth } from '@/state/AuthProvider';
import type {
  AdminAnalytics,
  AdminListing,
  AdminRole,
  AdminStats,
  CompanyApiKey,
  OpportunityReport,
  Organization,
  OrganizationStatus,
} from '@/types';
import { formatRelativeTime, formatShortDate } from '@/utils/date';

type Tab =
  | 'overview'
  | 'queue'
  | 'organizations'
  | 'reports'
  | 'users'
  | 'discovery'
  | 'audit';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'queue', label: 'Review' },
  { key: 'organizations', label: 'Companies' },
  { key: 'reports', label: 'Reports' },
  { key: 'users', label: 'Users' },
  { key: 'discovery', label: 'Discovery' },
  { key: 'audit', label: 'Audit log' },
];

const ROLE_LABEL: Record<AdminRole, string> = {
  super_admin: 'Super Admin',
  opportunity_admin: 'Opportunity Admin',
  content_admin: 'Content Admin',
};

const ORG_TONE: Record<OrganizationStatus, 'teal' | 'amber' | 'red'> = {
  pending: 'amber',
  approved: 'teal',
  suspended: 'red',
  rejected: 'red',
};

const REASON_LABEL: Record<string, string> = {
  expired: 'Expired',
  incorrect_information: 'Incorrect information',
  broken_link: 'Broken link',
  scam: 'Possible scam',
  other: 'Other',
};

function listingTone(status: AdminListing['status']): 'teal' | 'amber' | 'red' | 'default' {
  if (status === 'Published') return 'teal';
  if (status === 'Approved') return 'default';
  if (status === 'Pending' || status === 'Closing soon') return 'amber';
  return 'red';
}

function dateOrDash(value: string | null | undefined): string {
  return value ? formatShortDate(value) : '—';
}

export default function AdminScreen() {
  const router = useRouter();
  const {
    user,
    isAdmin,
    isSuperAdmin,
    adminRole,
    adminRoleError,
    refreshAdminRole,
    loading: authLoading,
  } = useAuth();
  const { showToast } = useApp();

  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [discoveryStats, setDiscoveryStats] = useState<DiscoveryStats | null>(null);
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [quality, setQuality] = useState<Awaited<
    ReturnType<typeof adminService.fetchQualityReport>
  > | null>(null);
  const [queue, setQueue] = useState<AdminListing[]>([]);
  const [queueFilter, setQueueFilter] = useState<'pending' | 'all'>('pending');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [reports, setReports] = useState<OpportunityReport[]>([]);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [userQuery, setUserQuery] = useState('');
  const [userSearch, setUserSearch] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [reportNote, setReportNote] = useState<Record<string, string>>({});

  const [expandedOrg, setExpandedOrg] = useState<string | null>(null);
  const [orgKeys, setOrgKeys] = useState<CompanyApiKey[]>([]);
  const [keyName, setKeyName] = useState('');
  const [newKey, setNewKey] = useState<{ organizationId: string; key: string } | null>(
    null,
  );

  const userId = user?.id ?? null;
  const [verifyingAccess, setVerifyingAccess] = useState(true);

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/home');
  }, [router]);

  const retryAccess = useCallback(() => {
    if (!userId) {
      router.push('/auth');
      return;
    }
    setVerifyingAccess(true);
    void refreshAdminRole(userId)
      .catch(() => undefined)
      .finally(() => setVerifyingAccess(false));
  }, [refreshAdminRole, router, userId]);

  // The dashboard can be reached by deep link or a typed URL (especially on
  // web), so re-check the role against Supabase every time it opens instead of
  // trusting whatever state performed the navigation.
  useEffect(() => {
    let active = true;
    if (!userId) {
      setVerifyingAccess(false);
      return () => {
        active = false;
      };
    }
    setVerifyingAccess(true);
    void refreshAdminRole(userId)
      .catch(() => undefined)
      .finally(() => {
        if (active) setVerifyingAccess(false);
      });
    return () => {
      active = false;
    };
  }, [userId, refreshAdminRole]);

  const canReview = adminRole === 'super_admin' || adminRole === 'opportunity_admin';
  const canManageContent =
    adminRole === 'super_admin' || adminRole === 'content_admin';
  const visibleTabs = useMemo(
    () =>
      TABS.filter((item) => {
        if (item.key === 'queue' || item.key === 'reports') return canReview;
        if (item.key === 'users' || item.key === 'audit') return isSuperAdmin;
        return true;
      }),
    [canReview, isSuperAdmin],
  );

  // If the role changes while a tab is open, never leave an unauthorised tab
  // visible. The database still enforces every action.
  useEffect(() => {
    if (!visibleTabs.some((item) => item.key === tab)) setTab('overview');
  }, [tab, visibleTabs]);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    if ((tab === 'queue' || tab === 'reports') && !canReview) return;
    if (tab === 'users' && !isSuperAdmin) return;
    setLoading(true);
    setError(null);
    try {
      if (tab === 'overview') {
        const [statsResult, analyticsResult, qualityResult, discoveryStatsResult] = await Promise.allSettled([
          adminService.fetchDashboardStats(),
          adminService.fetchAnalytics(),
          adminService.fetchQualityReport(),
          adminDiscoveryService.fetchDiscoveryStats(),
        ]);
        if (statsResult.status === 'fulfilled') setStats(statsResult.value);
        if (analyticsResult.status === 'fulfilled') setAnalytics(analyticsResult.value);
        if (qualityResult.status === 'fulfilled') setQuality(qualityResult.value);
        if (discoveryStatsResult.status === 'fulfilled') setDiscoveryStats(discoveryStatsResult.value);
        if (
          statsResult.status === 'rejected' &&
          analyticsResult.status === 'rejected' &&
          qualityResult.status === 'rejected' &&
          discoveryStatsResult.status === 'rejected'
        ) {
          throw statsResult.reason;
        }
      } else if (tab === 'queue') {
        setQueue(
          await adminService.listAllOpportunities(
            queueFilter === 'pending' ? 'pending' : undefined,
          ),
        );
      } else if (tab === 'organizations') {
        setOrganizations(await adminService.listOrganizations());
      } else if (tab === 'reports') {
        setReports(await adminService.listReports());
      } else {
        setUsers(await adminService.listUsers(userSearch));
      }
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [canReview, isAdmin, isSuperAdmin, tab, queueFilter, userSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (id: string, action: () => Promise<void>, message: string) => {
    setBusyId(id);
    try {
      await action();
      showToast(message);
      await load();
    } catch (caught) {
      showToast(errorMessage(caught));
    } finally {
      setBusyId(null);
    }
  };

  const review = (
    listing: AdminListing,
    action: 'approve' | 'reject' | 'publish' | 'unpublish',
    reason?: string,
  ) => {
    const label = {
      approve: 'Opportunity approved',
      reject: 'Opportunity rejected',
      publish: 'Opportunity published',
      unpublish: 'Opportunity unpublished',
    }[action];
    void run(
      listing.id,
      () => adminService.reviewOpportunity(listing.id, action, reason),
      label,
    );
  };

  const confirmReject = (listing: AdminListing) => {
    if (rejectReason.trim().length < 3) {
      showToast('Add a short reason so the provider knows what to fix.');
      return;
    }
    review(listing, 'reject', rejectReason.trim());
    setRejectingId(null);
    setRejectReason('');
  };

  const toggleOrgKeys = async (organization: Organization) => {
    if (expandedOrg === organization.id) {
      setExpandedOrg(null);
      setOrgKeys([]);
      return;
    }
    setExpandedOrg(organization.id);
    if (newKey?.organizationId !== organization.id) setNewKey(null);
    setKeyName('');
    try {
      setOrgKeys(await organizationService.listApiKeys(organization.id));
    } catch (caught) {
      showToast(errorMessage(caught));
      setOrgKeys([]);
    }
  };

  const revokeKey = (organization: Organization, key: CompanyApiKey) => {
    setBusyId(key.id);
    void (async () => {
      try {
        await adminService.revokeApiKey(key.id);
        showToast('API key revoked');
        setOrgKeys(await organizationService.listApiKeys(organization.id));
      } catch (caught) {
        showToast(errorMessage(caught));
      } finally {
        setBusyId(null);
      }
    })();
  };

  const generateKey = (organization: Organization) => {
    void run(
      `key-${organization.id}`,
      async () => {
        const generated = await adminService.generateApiKey(
          organization.id,
          keyName.trim() || 'Company API key',
        );
        setNewKey({ organizationId: organization.id, key: generated.apiKey });
        setKeyName('');
        setOrgKeys(await organizationService.listApiKeys(organization.id));
      },
      'API key generated — copy it now',
    );
  };

  if (authLoading || verifyingAccess) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
        <AppHeader title="Admin area" onBack={goBack} />
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.teal700} />
          <Text style={styles.loadingText}>Verifying administrator access…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAdmin) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
        <AppHeader title="Admin area" onBack={goBack} />
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="shield"
            title="Administrator access required"
            message={
              adminRoleError
                ? `We could not verify administrator access. ${adminRoleError}`
                : user
                  ? 'Your account does not have an active administrator role. Ask a Super Admin to assign one.'
                  : 'Sign in with an administrator account to review listings, companies and reports.'
            }
            actionLabel={!user ? 'Sign in' : adminRoleError ? 'Try again' : undefined}
            onAction={!user ? () => router.push('/auth') : adminRoleError ? retryAccess : undefined}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
      <AppHeader
        title="Admin area"
        subtitle={adminRole ? ROLE_LABEL[adminRole] : 'Administrator'}
        onBack={goBack}
        action={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh"
            onPress={() => void load()}
            hitSlop={8}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <Feather name="refresh-cw" size={17} color={colors.navy900} />
          </Pressable>
        }
      />

      <View style={styles.tabRow}>
        {visibleTabs.map((item) => (
          <Chip
            key={item.key}
            label={item.label}
            active={tab === item.key}
            onPress={() => setTab(item.key)}
          />
        ))}
      </View>

      {error ? (
        <View style={styles.errorCard}>
          <Feather name="alert-triangle" size={16} color={colors.red700} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {loading && !stats && tab === 'overview' ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator color={colors.teal700} />
            <Text style={styles.loadingText}>Loading administrator data…</Text>
          </View>
        ) : null}

        {tab === 'overview' ? (
          <OverviewTab stats={stats} analytics={analytics} quality={quality} discoveryStats={discoveryStats} />
        ) : null}

        {tab === 'queue' ? (
          <QueueTab
            listings={queue}
            filter={queueFilter}
            onFilter={setQueueFilter}
            loading={loading}
            busyId={busyId}
            rejectingId={rejectingId}
            rejectReason={rejectReason}
            onRejectReason={setRejectReason}
            onStartReject={(listing) => {
              setRejectingId(listing.id);
              setRejectReason('');
            }}
            onCancelReject={() => {
              setRejectingId(null);
              setRejectReason('');
            }}
            onConfirmReject={confirmReject}
            onApprove={(listing) => review(listing, 'approve')}
            onPublish={(listing) => review(listing, 'publish')}
            onUnpublish={(listing) => review(listing, 'unpublish')}
            onOpen={(listing) => router.push(`/opportunity/${listing.id}`)}
          />
        ) : null}

        {tab === 'organizations' ? (
          <OrganizationsTab
            organizations={organizations}
            loading={loading}
            busyId={busyId}
            isSuperAdmin={isSuperAdmin}
            canManageStatus={isSuperAdmin}
            canVerify={canManageContent}
            expandedOrg={expandedOrg}
            orgKeys={orgKeys}
            keyName={keyName}
            newKey={newKey}
            onKeyName={setKeyName}
            onToggleKeys={(organization) => void toggleOrgKeys(organization)}
            onGenerateKey={generateKey}
            onRevokeKey={revokeKey}
            onApprove={(organization) =>
              void run(
                organization.id,
                () =>
                  adminService.setOrganizationStatus(organization.id, 'approved'),
                'Organisation approved',
              )
            }
            onSuspend={(organization) =>
              void run(
                organization.id,
                () =>
                  adminService.setOrganizationStatus(organization.id, 'suspended'),
                'Organisation suspended',
              )
            }
            onReject={(organization) =>
              void run(
                organization.id,
                () => adminService.setOrganizationStatus(organization.id, 'rejected'),
                'Organisation rejected',
              )
            }
            onVerify={(organization) =>
              void run(
                organization.id,
                () => adminService.verifyOrganization(organization.id, true),
                'Organisation verified',
              )
            }
            onUnverify={(organization) =>
              void run(
                organization.id,
                () => adminService.verifyOrganization(organization.id, false),
                'Verification removed',
              )
            }
          />
        ) : null}

        {tab === 'reports' ? (
          <ReportsTab
            reports={reports}
            loading={loading}
            busyId={busyId}
            notes={reportNote}
            onNote={(id, value) =>
              setReportNote((current) => ({ ...current, [id]: value }))
            }
            onReview={(report, status) =>
              void run(
                report.id,
                () =>
                  adminService.reviewReport(
                    report.id,
                    status,
                    reportNote[report.id]?.trim() || undefined,
                  ),
                status === 'resolved'
                  ? 'Report resolved'
                  : status === 'dismissed'
                    ? 'Report dismissed'
                    : 'Report marked as reviewing',
              )
            }
          />
        ) : null}

        {tab === 'users' ? (
          <UsersTab
            users={users}
            loading={loading}
            busyId={busyId}
            query={userQuery}
            isSuperAdmin={isSuperAdmin}
            onQuery={setUserQuery}
            onSearch={() => setUserSearch(userQuery.trim())}
            onSuspend={(row) =>
              void run(
                row.id,
                () => adminService.setUserSuspended(row.id, !row.is_suspended),
                row.is_suspended ? 'Account restored' : 'Account suspended',
              )
            }
            onAssignRole={(row, role, active) =>
              void run(
                row.id,
                () => adminService.assignAdminRole(row.id, role, active),
                active ? `Granted ${ROLE_LABEL[role]}` : 'Administrator role removed',
              )
            }
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

/* -------------------------------------------------------------------------- */
/* Overview                                                                    */
/* -------------------------------------------------------------------------- */

function OverviewTab({
  stats,
  analytics,
  quality,
  discoveryStats,
}: {
  stats: AdminStats | null;
  analytics: AdminAnalytics | null;
  quality: Awaited<ReturnType<typeof adminService.fetchQualityReport>> | null;
  discoveryStats: DiscoveryStats | null;
}) {
  if (!stats && !analytics) {
    return (
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>No dashboard data yet</Text>
        <Text style={styles.infoBody}>
          Sign in with an active administrator role and pull to refresh.
        </Text>
      </View>
    );
  }

  return (
    <>
      {stats ? (
        <View style={styles.statRow}>
          <StatCard
            label="Pending review"
            value={stats.pending_opportunities}
            icon="clock"
            tone="amber"
          />
          <StatCard
            label="Published"
            value={stats.published_opportunities}
            icon="check-circle"
            tone="green"
          />
          <StatCard
            label="Students"
            value={stats.registered_students}
            icon="users"
            tone="blue"
          />
          <StatCard
            label="Companies"
            value={stats.registered_companies}
            icon="briefcase"
            tone="blue"
          />
          <StatCard
            label="API calls (24h)"
            value={stats.api_requests_24h}
            icon="zap"
            tone="green"
          />
          <StatCard
            label="Views (7d)"
            value={stats.views_7d}
            icon="eye"
            tone="green"
          />
        </View>
      ) : null}

      {discoveryStats ? (
        <>
          <SectionHeader
            title="Discovery service"
            subtitle="Automated company and opportunity collection"
          />
          <View style={styles.statRow}>
            <StatCard
              label="Sources"
              value={`${discoveryStats.sources_enabled}/${discoveryStats.sources_total}`}
              icon="rss"
              tone={discoveryStats.sources_enabled > 0 ? 'green' : 'amber'}
            />
            <StatCard
              label="Companies found"
              value={discoveryStats.companies_total}
              icon="briefcase"
              tone="blue"
            />
            <StatCard
              label="Opportunities found"
              value={discoveryStats.opportunities_total}
              icon="compass"
              tone="blue"
            />
            <StatCard
              label="Companies imported"
              value={discoveryStats.companies_imported}
              icon="download"
              tone="green"
            />
            <StatCard
              label="Opportunities imported"
              value={discoveryStats.opportunities_imported}
              icon="download"
              tone="green"
            />
            <StatCard
              label="Failed runs (24h)"
              value={discoveryStats.runs_failed_24h}
              icon="alert-triangle"
              tone={discoveryStats.runs_failed_24h > 0 ? 'red' : 'green'}
            />
          </View>
        </>
      ) : null}

      {analytics ? (
        <>
          <SectionHeader
            title="Platform health"
            subtitle={`Snapshot generated ${formatRelativeTime(analytics.generated_at)}`}
          />
          <View style={styles.card}>
            <MetricRow label="Total users" value={analytics.users_total} />
            <MetricRow label="New users (30 days)" value={analytics.users_new_30d} />
            <MetricRow label="Suspended accounts" value={analytics.suspended_users} />
            <MetricRow
              label="Organisations pending"
              value={analytics.organizations_pending}
            />
            <MetricRow
              label="Organisations verified"
              value={analytics.organizations_verified}
            />
            <MetricRow
              label="Applications (30 days)"
              value={analytics.applications_30d}
            />
            <MetricRow label="Bookmarks" value={analytics.bookmarks_total} />
            <MetricRow label="Views (30 days)" value={analytics.views_30d} />
            <MetricRow label="API requests (30 days)" value={analytics.api_requests_30d} />
            <MetricRow label="Open reports" value={analytics.open_reports} />
          </View>

          {analytics.top_categories.length > 0 ? (
            <>
              <Text style={styles.subheading}>Top categories</Text>
              <View style={styles.chipRow}>
                {analytics.top_categories.map((item) => (
                  <Chip key={item.name} label={`${item.name} · ${item.count}`} />
                ))}
              </View>
            </>
          ) : null}

          {analytics.top_provinces.length > 0 ? (
            <>
              <Text style={styles.subheading}>Top provinces</Text>
              <View style={styles.chipRow}>
                {analytics.top_provinces.map((item) => (
                  <Chip key={item.name} label={`${item.name} · ${item.count}`} />
                ))}
              </View>
            </>
          ) : null}

          {analytics.top_opportunities.length > 0 ? (
            <>
              <Text style={styles.subheading}>Most viewed published opportunities</Text>
              <View style={styles.list}>
                {analytics.top_opportunities.map((item) => (
                  <View key={item.id} style={styles.simpleRow}>
                    <Text style={styles.simpleRowMain} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.simpleRowMeta}>
                      {item.provider} · {item.views} views
                    </Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}
        </>
      ) : null}

      {quality ? (
        <>
          <SectionHeader
            title="Listing quality"
            subtitle="Problems worth fixing before students see them"
          />
          <View style={styles.card}>
            <MetricRow
              label="Published without application URL"
              value={quality.published_without_application_url.length}
            />
            <MetricRow
              label="Published but past closing date"
              value={quality.published_and_past_closing.length}
            />
            <MetricRow
              label="Sources not checked in 30 days"
              value={quality.stale_source_check.length}
            />
            <MetricRow
              label="Published with zero views"
              value={quality.zero_view_published}
            />
            {quality.duplicate_titles.length > 0 ? (
              <View style={styles.qualityBlock}>
                <Text style={styles.qualityLabel}>Possible duplicates</Text>
                {quality.duplicate_titles.slice(0, 8).map((item) => (
                  <Text key={item.title} style={styles.qualityItem}>
                    {item.title} · {item.count} copies
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        </>
      ) : null}
    </>
  );
}

function MetricRow({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Review queue                                                                */
/* -------------------------------------------------------------------------- */

function QueueTab({
  listings,
  filter,
  onFilter,
  loading,
  busyId,
  rejectingId,
  rejectReason,
  onRejectReason,
  onStartReject,
  onCancelReject,
  onConfirmReject,
  onApprove,
  onPublish,
  onUnpublish,
  onOpen,
}: {
  listings: AdminListing[];
  filter: 'pending' | 'all';
  onFilter: (filter: 'pending' | 'all') => void;
  loading: boolean;
  busyId: string | null;
  rejectingId: string | null;
  rejectReason: string;
  onRejectReason: (value: string) => void;
  onStartReject: (listing: AdminListing) => void;
  onCancelReject: () => void;
  onConfirmReject: (listing: AdminListing) => void;
  onApprove: (listing: AdminListing) => void;
  onPublish: (listing: AdminListing) => void;
  onUnpublish: (listing: AdminListing) => void;
  onOpen: (listing: AdminListing) => void;
}) {
  return (
    <>
      <View style={styles.chipRow}>
        <Chip
          label="Pending"
          active={filter === 'pending'}
          onPress={() => onFilter('pending')}
        />
        <Chip label="All statuses" active={filter === 'all'} onPress={() => onFilter('all')} />
      </View>

      {loading ? (
        <View style={styles.loadingBlock}>
          <ActivityIndicator color={colors.teal700} />
        </View>
      ) : listings.length === 0 ? (
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>
            {filter === 'pending' ? 'Nothing waiting for review' : 'No opportunities found'}
          </Text>
          <Text style={styles.infoBody}>
            {filter === 'pending'
              ? 'New company submissions and student-visible updates will appear here.'
              : 'Try the pending filter to focus on items that need a decision.'}
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {listings.map((listing) => {
            const busy = busyId === listing.id;
            const rejecting = rejectingId === listing.id;
            return (
              <View key={listing.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.cardCopy}>
                    <Text style={styles.cardTitle}>{listing.title}</Text>
                    <Text style={styles.cardMeta}>
                      {listing.organisation || 'Unknown organisation'} ·{' '}
                      {listing.province}
                    </Text>
                    <Text style={styles.cardMeta}>
                      {listing.category} · closes {dateOrDash(listing.closingDate)}
                    </Text>
                  </View>
                  <Chip
                    label={listing.status}
                    tone={listingTone(listing.status)}
                  />
                </View>

                {listing.description ? (
                  <Text style={styles.cardBody} numberOfLines={3}>
                    {listing.description}
                  </Text>
                ) : null}

                {listing.rejectionReason ? (
                  <Text style={styles.rejectionNote}>
                    Rejected: {listing.rejectionReason}
                  </Text>
                ) : null}

                <View style={styles.actionRow}>
                  {listing.status === 'Published' ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => onOpen(listing)}
                      style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
                    >
                      <Feather name="external-link" size={14} color={colors.navy800} />
                      <Text style={styles.linkButtonText}>View</Text>
                    </Pressable>
                  ) : null}

                  {listing.rawStatus === 'pending' || listing.rawStatus === 'rejected' ? (
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={() => onApprove(listing)}
                      style={({ pressed }) => [
                        styles.approveButton,
                        pressed && styles.pressed,
                        busy && styles.disabled,
                      ]}
                    >
                      {busy ? (
                        <ActivityIndicator size="small" color={colors.teal700} />
                      ) : (
                        <>
                          <Feather name="check" size={14} color={colors.teal700} />
                          <Text style={styles.approveText}>Approve</Text>
                        </>
                      )}
                    </Pressable>
                  ) : null}

                  {listing.rawStatus === 'approved' ? (
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={() => onPublish(listing)}
                      style={({ pressed }) => [
                        styles.approveButton,
                        pressed && styles.pressed,
                        busy && styles.disabled,
                      ]}
                    >
                      {busy ? (
                        <ActivityIndicator size="small" color={colors.teal700} />
                      ) : (
                        <>
                          <Feather name="upload" size={14} color={colors.teal700} />
                          <Text style={styles.approveText}>Publish</Text>
                        </>
                      )}
                    </Pressable>
                  ) : null}

                  {listing.rawStatus === 'published' ? (
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={() => onUnpublish(listing)}
                      style={({ pressed }) => [
                        styles.secondaryButton,
                        pressed && styles.pressed,
                        busy && styles.disabled,
                      ]}
                    >
                      <Feather name="eye-off" size={14} color={colors.navy800} />
                      <Text style={styles.secondaryText}>Unpublish</Text>
                    </Pressable>
                  ) : null}

                  {listing.rawStatus !== 'rejected' ? (
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={() => onStartReject(listing)}
                      style={({ pressed }) => [
                        styles.rejectButton,
                        pressed && styles.pressed,
                        busy && styles.disabled,
                      ]}
                    >
                      <Feather name="x" size={14} color={colors.red700} />
                      <Text style={styles.rejectText}>Reject</Text>
                    </Pressable>
                  ) : null}
                </View>

                {rejecting ? (
                  <View style={styles.rejectForm}>
                    <FormField
                      label="Reason for rejection"
                      value={rejectReason}
                      onChangeText={onRejectReason}
                      placeholder="Tell the provider what must change"
                      multiline
                      maxLength={400}
                    />
                    <View style={styles.actionRow}>
                      <Button
                        title="Cancel"
                        variant="secondary"
                        onPress={onCancelReject}
                      />
                      <Button
                        title="Confirm rejection"
                        variant="danger"
                        onPress={() => onConfirmReject(listing)}
                      />
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Organisations                                                               */
/* -------------------------------------------------------------------------- */

function OrganizationsTab({
  organizations,
  loading,
  busyId,
  isSuperAdmin,
  canManageStatus,
  canVerify,
  expandedOrg,
  orgKeys,
  keyName,
  newKey,
  onKeyName,
  onToggleKeys,
  onGenerateKey,
  onRevokeKey,
  onApprove,
  onSuspend,
  onReject,
  onVerify,
  onUnverify,
}: {
  organizations: Organization[];
  loading: boolean;
  busyId: string | null;
  isSuperAdmin: boolean;
  canManageStatus: boolean;
  canVerify: boolean;
  expandedOrg: string | null;
  orgKeys: CompanyApiKey[];
  keyName: string;
  newKey: { organizationId: string; key: string } | null;
  onKeyName: (value: string) => void;
  onToggleKeys: (organization: Organization) => void;
  onGenerateKey: (organization: Organization) => void;
  onRevokeKey: (organization: Organization, key: CompanyApiKey) => void;
  onApprove: (organization: Organization) => void;
  onSuspend: (organization: Organization) => void;
  onReject: (organization: Organization) => void;
  onVerify: (organization: Organization) => void;
  onUnverify: (organization: Organization) => void;
}) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  if (loading) {
    return (
      <View style={styles.loadingBlock}>
        <ActivityIndicator color={colors.teal700} />
      </View>
    );
  }

  if (organizations.length === 0) {
    return (
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>No organisations yet</Text>
        <Text style={styles.infoBody}>
          Company registrations will appear here for approval and verification.
        </Text>
      </View>
    );
  }

  const counts = {
    all: organizations.length,
    pending: organizations.filter((organization) => organization.status === 'pending').length,
    approved: organizations.filter((organization) => organization.status === 'approved').length,
    rejected: organizations.filter((organization) => organization.status === 'rejected').length,
  };
  const filtered =
    filter === 'all'
      ? organizations
      : organizations.filter((organization) => organization.status === filter);

  return (
    <View style={styles.list}>
      <View style={styles.filterRow}>
        {(['all', 'pending', 'approved', 'rejected'] as const).map((value) => (
          <Chip
            key={value}
            label={`${value === 'all' ? 'All' : value[0].toUpperCase() + value.slice(1)} (${counts[value]})`}
            active={filter === value}
            onPress={() => setFilter(value)}
          />
        ))}
      </View>

      {filtered.length === 0 ? (
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>No {filter} companies</Text>
          <Text style={styles.infoBody}>
            {filter === 'pending'
              ? 'There are no company registrations waiting for review.'
              : `No companies are currently ${filter}.`}
          </Text>
        </View>
      ) : null}

      {filtered.map((organization) => {
        const busy = busyId === organization.id;
        const expanded = expandedOrg === organization.id;
        return (
          <View key={organization.id} style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.cardCopy}>
                <Text style={styles.cardTitle}>{organization.name}</Text>
                {organization.registeredBusinessName &&
                organization.registeredBusinessName !== organization.name ? (
                  <Text style={styles.cardMeta}>
                    Registered as {organization.registeredBusinessName}
                  </Text>
                ) : null}
                <Text style={styles.cardMeta}>
                  {[organization.industry, organization.province]
                    .filter(Boolean)
                    .join(' · ') || 'No industry or province'}
                </Text>
                <Text style={styles.cardMeta}>
                  {organization.registrationNumber
                    ? `Reg. no. ${organization.registrationNumber}`
                    : 'No registration number'}
                </Text>
                <Text style={styles.cardMeta}>
                  {organization.contactPerson ?? 'No contact person'}
                  {organization.contactEmail ? ` · ${organization.contactEmail}` : ''}
                </Text>
                <Text style={styles.cardMeta}>
                  {organization.contactPhone ?? 'No contact phone'}
                </Text>
              </View>
              <View style={styles.pillColumn}>
                <Chip
                  label={organization.status}
                  tone={ORG_TONE[organization.status]}
                />
                {organization.isVerified ? (
                  <Chip label="Verified" icon="check-circle" tone="teal" />
                ) : null}
                {organization.apiEnabled ? (
                  <Chip label="API on" icon="zap" tone="teal" />
                ) : null}
              </View>
            </View>

            {organization.description ? (
              <Text style={styles.cardBody} numberOfLines={3}>
                {organization.description}
              </Text>
            ) : null}

            <View style={styles.actionRow}>
              {canManageStatus ? (
                organization.status !== 'approved' ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => onApprove(organization)}
                    style={({ pressed }) => [
                      styles.approveButton,
                      pressed && styles.pressed,
                      busy && styles.disabled,
                    ]}
                  >
                    {busy ? (
                      <ActivityIndicator size="small" color={colors.teal700} />
                    ) : (
                      <>
                        <Feather name="check" size={14} color={colors.teal700} />
                        <Text style={styles.approveText}>Approve</Text>
                      </>
                    )}
                  </Pressable>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => onSuspend(organization)}
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      pressed && styles.pressed,
                      busy && styles.disabled,
                    ]}
                  >
                    <Feather name="pause-circle" size={14} color={colors.navy800} />
                    <Text style={styles.secondaryText}>Suspend</Text>
                  </Pressable>
                )
              ) : null}

              {canManageStatus && organization.status === 'pending' ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => onReject(organization)}
                  style={({ pressed }) => [
                    styles.rejectButton,
                    pressed && styles.pressed,
                    busy && styles.disabled,
                  ]}
                >
                  <Feather name="x" size={14} color={colors.red700} />
                  <Text style={styles.rejectText}>Reject</Text>
                </Pressable>
              ) : null}

              {canVerify ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() =>
                    organization.isVerified
                      ? onUnverify(organization)
                      : onVerify(organization)
                  }
                  style={({ pressed }) => [
                    styles.verifyButton,
                    pressed && styles.pressed,
                    busy && styles.disabled,
                  ]}
                >
                  <Feather
                    name={organization.isVerified ? 'shield-off' : 'shield'}
                    size={14}
                    color={colors.teal700}
                  />
                  <Text style={styles.approveText}>
                    {organization.isVerified ? 'Unverify' : 'Verify'}
                  </Text>
                </Pressable>
              ) : null}

              {canManageStatus ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => onToggleKeys(organization)}
                  style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
                >
                  <Feather name="key" size={14} color={colors.navy800} />
                  <Text style={styles.linkButtonText}>
                    {expanded ? 'Hide keys' : 'API keys'}
                  </Text>
                </Pressable>
              ) : null}

              {!canManageStatus && !canVerify ? (
                <Text style={styles.infoBody}>
                  Your role can view companies but not change their status.
                </Text>
              ) : null}
            </View>

            {expanded ? (
              <View style={styles.keysPanel}>
                {newKey?.organizationId === organization.id ? (
                  <View style={styles.keyReveal}>
                    <Text style={styles.keyRevealLabel}>New API key (shown once)</Text>
                    <Text selectable style={styles.keyRevealValue}>
                      {newKey.key}
                    </Text>
                    <Text style={styles.keyRevealHint}>
                      Copy this now. Only a SHA-256 hash is stored and it cannot be
                      shown again.
                    </Text>
                  </View>
                ) : null}

                {orgKeys.length === 0 ? (
                  <Text style={styles.infoBody}>No API keys for this organisation.</Text>
                ) : (
                  orgKeys.map((key) => (
                    <View key={key.id} style={styles.keyRow}>
                      <View style={styles.cardCopy}>
                        <Text style={styles.keyName}>{key.name}</Text>
                        <Text style={styles.keyMeta}>
                          {key.keyPrefix}… · {key.status} ·{' '}
                          {key.lastUsedAt
                            ? `last used ${formatRelativeTime(key.lastUsedAt)}`
                            : 'never used'}
                        </Text>
                      </View>
                      {key.status === 'active' ? (
                        <Pressable
                          accessibilityRole="button"
                          disabled={busyId === key.id}
                          onPress={() => onRevokeKey(organization, key)}
                          style={({ pressed }) => [
                            styles.rejectButton,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text style={styles.rejectText}>Revoke</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ))
                )}

                {isSuperAdmin ? (
                  organization.status === 'approved' ? (
                    <View style={styles.keyForm}>
                      <FormField
                        label="Key name"
                        value={keyName}
                        onChangeText={onKeyName}
                        placeholder="e.g. HR integration"
                      />
                      <Button
                        title="Generate API key"
                        icon="key"
                        onPress={() => onGenerateKey(organization)}
                        loading={busyId === `key-${organization.id}`}
                        disabled={busyId === `key-${organization.id}`}
                      />
                    </View>
                  ) : (
                    <Text style={styles.infoBody}>
                      Approve the organisation before generating API credentials.
                    </Text>
                  )
                ) : (
                  <Text style={styles.infoBody}>
                    Only a Super Admin can issue or revoke company API credentials.
                  </Text>
                )}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Reports                                                                     */
/* -------------------------------------------------------------------------- */

function ReportsTab({
  reports,
  loading,
  busyId,
  notes,
  onNote,
  onReview,
}: {
  reports: OpportunityReport[];
  loading: boolean;
  busyId: string | null;
  notes: Record<string, string>;
  onNote: (id: string, value: string) => void;
  onReview: (
    report: OpportunityReport,
    status: 'reviewing' | 'resolved' | 'dismissed',
  ) => void;
}) {
  if (loading) {
    return (
      <View style={styles.loadingBlock}>
        <ActivityIndicator color={colors.teal700} />
      </View>
    );
  }

  if (reports.length === 0) {
    return (
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>No reports</Text>
        <Text style={styles.infoBody}>
          Student reports about expired, incorrect or suspicious opportunities
          appear here.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {reports.map((report) => {
        const busy = busyId === report.id;
        const open = report.status === 'open' || report.status === 'reviewing';
        return (
          <View key={report.id} style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.cardCopy}>
                <Text style={styles.cardTitle}>
                  {REASON_LABEL[report.reason] ?? report.reason}
                </Text>
                <Text style={styles.cardMeta}>
                  {report.opportunityTitle ?? 'Opportunity'} ·{' '}
                  {report.reporterName ?? 'Student'} ·{' '}
                  {formatRelativeTime(report.createdAt)}
                </Text>
              </View>
              <Chip
                label={report.status}
                tone={
                  report.status === 'open'
                    ? 'amber'
                    : report.status === 'resolved'
                      ? 'teal'
                      : 'default'
                }
              />
            </View>

            {report.details ? (
              <Text style={styles.cardBody}>{report.details}</Text>
            ) : null}

            {open ? (
              <>
                <FormField
                  label="Review note (optional)"
                  value={notes[report.id] ?? ''}
                  onChangeText={(value) => onNote(report.id, value)}
                  placeholder="What action did you take?"
                />
                <View style={styles.actionRow}>
                  {report.status === 'open' ? (
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={() => onReview(report, 'reviewing')}
                      style={({ pressed }) => [
                        styles.secondaryButton,
                        pressed && styles.pressed,
                        busy && styles.disabled,
                      ]}
                    >
                      <Text style={styles.secondaryText}>Start review</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => onReview(report, 'resolved')}
                    style={({ pressed }) => [
                      styles.approveButton,
                      pressed && styles.pressed,
                      busy && styles.disabled,
                    ]}
                  >
                    <Feather name="check" size={14} color={colors.teal700} />
                    <Text style={styles.approveText}>Resolve</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => onReview(report, 'dismissed')}
                    style={({ pressed }) => [
                      styles.rejectButton,
                      pressed && styles.pressed,
                      busy && styles.disabled,
                    ]}
                  >
                    <Text style={styles.rejectText}>Dismiss</Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Users                                                                       */
/* -------------------------------------------------------------------------- */

function UsersTab({
  users,
  loading,
  busyId,
  query,
  isSuperAdmin,
  onQuery,
  onSearch,
  onSuspend,
  onAssignRole,
}: {
  users: AdminUserRow[];
  loading: boolean;
  busyId: string | null;
  query: string;
  isSuperAdmin: boolean;
  onQuery: (value: string) => void;
  onSearch: () => void;
  onSuspend: (row: AdminUserRow) => void;
  onAssignRole: (row: AdminUserRow, role: AdminRole, active: boolean) => void;
}) {
  return (
    <>
      <View style={styles.searchRow}>
        <FormField
          label="Find a user"
          value={query}
          onChangeText={onQuery}
          placeholder="Name, email or province"
          style={styles.searchField}
        />
        <Button title="Search" variant="secondary" onPress={onSearch} />
      </View>

      {!isSuperAdmin ? (
        <View style={styles.infoCard}>
          <Text style={styles.infoBody}>
            Only a Super Admin can suspend accounts or change administrator roles.
            You can still search and review the directory.
          </Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingBlock}>
          <ActivityIndicator color={colors.teal700} />
        </View>
      ) : users.length === 0 ? (
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>No users found</Text>
          <Text style={styles.infoBody}>Try a different name or email.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {users.map((row) => {
            const busy = busyId === row.id;
            return (
              <View key={row.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.cardCopy}>
                    <Text style={styles.cardTitle}>{row.full_name || 'Student'}</Text>
                    <Text style={styles.cardMeta}>{row.email}</Text>
                    <Text style={styles.cardMeta}>
                      {[row.province, row.qualification].filter(Boolean).join(' · ') ||
                        'No profile details'}
                    </Text>
                    <Text style={styles.cardMeta}>
                      Joined {dateOrDash(row.created_at)} · {row.interest_count}{' '}
                      interests
                    </Text>
                  </View>
                  <View style={styles.pillColumn}>
                    {row.admin_role ? (
                      <Chip label={row.admin_role} tone="teal" icon="shield" />
                    ) : (
                      <Chip label="Student" />
                    )}
                    {row.is_suspended ? (
                      <Chip label="Suspended" tone="red" />
                    ) : null}
                  </View>
                </View>

                {isSuperAdmin ? (
                  <>
                    <View style={styles.actionRow}>
                      <Pressable
                        accessibilityRole="button"
                        disabled={busy}
                        onPress={() => onSuspend(row)}
                        style={({ pressed }) => [
                          row.is_suspended ? styles.approveButton : styles.rejectButton,
                          pressed && styles.pressed,
                          busy && styles.disabled,
                        ]}
                      >
                        <Feather
                          name={row.is_suspended ? 'user-check' : 'user-x'}
                          size={14}
                          color={row.is_suspended ? colors.teal700 : colors.red700}
                        />
                        <Text
                          style={
                            row.is_suspended ? styles.approveText : styles.rejectText
                          }
                        >
                          {row.is_suspended ? 'Restore' : 'Suspend'}
                        </Text>
                      </Pressable>
                    </View>

                    <View style={styles.roleRow}>
                      <Text style={styles.roleLabel}>Grant role</Text>
                      {(
                        ['super_admin', 'opportunity_admin', 'content_admin'] as AdminRole[]
                      ).map((role) => (
                        <Pressable
                          key={role}
                          accessibilityRole="button"
                          disabled={busy}
                          onPress={() => onAssignRole(row, role, true)}
                          style={({ pressed }) => [
                            styles.roleChip,
                            row.admin_role === role && styles.roleChipActive,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text
                            style={[
                              styles.roleChipText,
                              row.admin_role === role && styles.roleChipTextActive,
                            ]}
                          >
                            {ROLE_LABEL[role]}
                          </Text>
                        </Pressable>
                      ))}
                      {row.admin_role ? (
                        <Pressable
                          accessibilityRole="button"
                          disabled={busy}
                          onPress={() =>
                            onAssignRole(row, row.admin_role as AdminRole, false)
                          }
                          style={({ pressed }) => [
                            styles.roleChip,
                            styles.roleChipDanger,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text style={styles.roleChipDangerText}>Remove role</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.surfaceSoft,
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loadingBlock: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    ...type.small,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  errorCard: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.red50,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: {
    ...type.small,
    color: colors.red700,
    flex: 1,
  },
  statRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  cardCopy: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    ...type.h3,
    fontSize: 15,
  },
  cardMeta: {
    ...type.small,
  },
  cardBody: {
    ...type.body,
    color: colors.ink,
  },
  pillColumn: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  approveButton: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.teal100,
    backgroundColor: colors.teal50,
    paddingHorizontal: spacing.md,
  },
  approveText: {
    fontFamily: type.bodyStrong.fontFamily,
    fontSize: 12,
    fontWeight: '700',
    color: colors.teal700,
  },
  secondaryButton: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  secondaryText: {
    fontFamily: type.bodyStrong.fontFamily,
    fontSize: 12,
    fontWeight: '700',
    color: colors.navy800,
  },
  rejectButton: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.red50,
    backgroundColor: colors.red50,
    paddingHorizontal: spacing.md,
  },
  rejectText: {
    fontFamily: type.bodyStrong.fontFamily,
    fontSize: 12,
    fontWeight: '700',
    color: colors.red700,
  },
  verifyButton: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.teal100,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  linkButton: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
  },
  linkButtonText: {
    fontFamily: type.bodyStrong.fontFamily,
    fontSize: 12,
    fontWeight: '700',
    color: colors.navy800,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.7,
  },
  rejectForm: {
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.md,
  },
  rejectionNote: {
    ...type.small,
    color: colors.red700,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  list: {
    gap: spacing.md,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 24,
  },
  detailLabel: {
    ...type.small,
    flex: 1,
  },
  detailValue: {
    ...type.bodyStrong,
    textAlign: 'right',
  },
  subheading: {
    ...type.label,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  infoTitle: {
    ...type.bodyStrong,
  },
  infoBody: {
    ...type.small,
  },
  simpleRow: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    gap: 2,
  },
  simpleRowMain: {
    ...type.bodyStrong,
    fontSize: 13,
  },
  simpleRowMeta: {
    ...type.caption,
  },
  qualityBlock: {
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.md,
  },
  qualityLabel: {
    ...type.bodyStrong,
    fontSize: 13,
  },
  qualityItem: {
    ...type.small,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  searchField: {
    flex: 1,
  },
  keysPanel: {
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.md,
  },
  keyForm: {
    gap: spacing.md,
  },
  keyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  keyName: {
    ...type.bodyStrong,
    fontSize: 13,
  },
  keyMeta: {
    ...type.caption,
  },
  keyReveal: {
    backgroundColor: colors.amber100,
    borderRadius: radius.sm,
    padding: spacing.md,
    gap: 4,
  },
  keyRevealLabel: {
    ...type.label,
    color: colors.amber700,
  },
  keyRevealValue: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: colors.navy950,
  },
  keyRevealHint: {
    ...type.caption,
    color: colors.amber700,
  },
  roleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.md,
  },
  roleLabel: {
    ...type.caption,
    marginRight: spacing.xs,
  },
  roleChip: {
    minHeight: 32,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  roleChipActive: {
    borderColor: colors.teal600,
    backgroundColor: colors.teal50,
  },
  roleChipText: {
    fontFamily: type.bodyStrong.fontFamily,
    fontSize: 11,
    fontWeight: '700',
    color: colors.ink,
  },
  roleChipTextActive: {
    color: colors.teal700,
  },
  roleChipDanger: {
    borderColor: colors.red50,
    backgroundColor: colors.red50,
  },
  roleChipDangerText: {
    fontFamily: type.bodyStrong.fontFamily,
    fontSize: 11,
    fontWeight: '700',
    color: colors.red700,
  },
});
