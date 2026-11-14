import { Feather } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { FormField } from '@/components/FormField';
import { SectionHeader } from '@/components/SectionHeader';
import { StatCard } from '@/components/StatCard';
import { colors, radius, spacing, type } from '@/constants/theme';
import { errorMessage } from '@/lib/errors';
import { adminService } from '@/services/adminService';
import {
  adminDiscoveryService,
  type AdminAuditLog,
  type DiscoveredCompany,
  type DiscoveredCompanyStatus,
  type DiscoveredOpportunity,
  type DiscoveredOpportunityStatus,
  type DiscoveryRun,
  type DiscoverySource,
  type DiscoverySourceType,
  type DiscoveryStats,
} from '@/services/adminDiscoveryService';
import { useApp } from '@/state/AppProvider';
import type { Organization } from '@/types';
import { formatRelativeTime, formatShortDate } from '@/utils/date';

type Section = 'sources' | 'companies' | 'opportunities' | 'runs';

const SECTIONS: { key: Section; label: string }[] = [
  { key: 'sources', label: 'Sources' },
  { key: 'companies', label: 'Companies' },
  { key: 'opportunities', label: 'Opportunities' },
  { key: 'runs', label: 'Runs' },
];

const COMPANY_STATUSES: { key: DiscoveredCompanyStatus | 'all'; label: string }[] = [
  { key: 'new', label: 'New' },
  { key: 'matched', label: 'Matched' },
  { key: 'imported', label: 'Imported' },
  { key: 'verified', label: 'Verified' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'merged', label: 'Merged' },
  { key: 'all', label: 'All' },
];

const OPPORTUNITY_STATUSES: {
  key: DiscoveredOpportunityStatus | 'all';
  label: string;
}[] = [
  { key: 'new', label: 'New' },
  { key: 'imported', label: 'Imported' },
  { key: 'expired', label: 'Expired' },
  { key: 'duplicate', label: 'Duplicate' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
];

const RUN_TONE: Record<DiscoveryRun['status'], 'teal' | 'amber' | 'red'> = {
  succeeded: 'teal',
  running: 'amber',
  partial: 'amber',
  failed: 'red',
};

const COMPANY_TONE: Record<DiscoveredCompanyStatus, 'default' | 'teal' | 'amber' | 'red'> = {
  new: 'amber',
  matched: 'default',
  imported: 'teal',
  verified: 'teal',
  rejected: 'red',
  merged: 'default',
};

const OPPORTUNITY_TONE: Record<
  DiscoveredOpportunityStatus,
  'default' | 'teal' | 'amber' | 'red'
> = {
  new: 'amber',
  matched: 'default',
  imported: 'teal',
  verified: 'teal',
  rejected: 'red',
  expired: 'red',
  duplicate: 'default',
};

function confirmAction(title: string, message: string, action: () => void) {
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Confirm', onPress: action },
  ]);
}

function openLink(url: string | null | undefined) {
  if (!url) return;
  void Linking.openURL(url).catch(() => undefined);
}

function sourceTypeLabel(value: string): string {
  return value === 'json' ? 'JSON API' : value === 'rss' ? 'RSS feed' : 'HTML page';
}

export function DiscoveryAdmin({
  canManageSources,
  canEditContent,
  canReview,
}: {
  canManageSources: boolean;
  canEditContent: boolean;
  canReview: boolean;
}) {
  const { showToast } = useApp();

  const [section, setSection] = useState<Section>('sources');
  const [stats, setStats] = useState<DiscoveryStats | null>(null);
  const [sources, setSources] = useState<DiscoverySource[]>([]);
  const [runs, setRuns] = useState<DiscoveryRun[]>([]);
  const [companies, setCompanies] = useState<DiscoveredCompany[]>([]);
  const [opportunities, setOpportunities] = useState<DiscoveredOpportunity[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);

  const [companyStatus, setCompanyStatus] = useState<DiscoveredCompanyStatus | 'all'>('new');
  const [opportunityStatus, setOpportunityStatus] = useState<
    DiscoveredOpportunityStatus | 'all'
  >('new');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [rejectTarget, setRejectTarget] = useState<{
    kind: 'company' | 'opportunity';
    id: string;
  } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [companyDraft, setCompanyDraft] = useState<Record<string, string>>({});
  const [editingOpportunityId, setEditingOpportunityId] = useState<string | null>(null);
  const [opportunityDraft, setOpportunityDraft] = useState<Record<string, string>>({});

  const [mergeCompanyId, setMergeCompanyId] = useState<string | null>(null);
  const [mergeQuery, setMergeQuery] = useState('');

  const [showSourceForm, setShowSourceForm] = useState(false);
  const [sourceDraft, setSourceDraft] = useState({
    name: '',
    source_type: 'json' as DiscoverySourceType,
    base_url: '',
    terms_url: '',
    license_note: '',
    config: '{\n  "type": "opportunity",\n  "itemPath": "items"\n}',
  });
  const [sourceFormError, setSourceFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsResult, sourcesResult, runsResult] = await Promise.all([
        adminDiscoveryService.fetchDiscoveryStats(),
        adminDiscoveryService.listDiscoverySources(),
        adminDiscoveryService.listDiscoveryRuns(40),
      ]);
      setStats(statsResult);
      setSources(sourcesResult);
      setRuns(runsResult);

      if (section === 'companies') {
        setCompanies(
          await adminDiscoveryService.listDiscoveredCompanies(companyStatus, search),
        );
        setOrganizations(await adminService.listOrganizations());
      } else if (section === 'opportunities') {
        setOpportunities(
          await adminDiscoveryService.listDiscoveredOpportunities(opportunityStatus, search),
        );
        setOrganizations(await adminService.listOrganizations());
      }
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [companyStatus, opportunityStatus, search, section]);

  useEffect(() => {
    void load();
  }, [load]);

  const perform = async (
    id: string,
    action: () => Promise<string | void>,
    fallbackMessage: string,
  ) => {
    setBusyId(id);
    try {
      const outcome = await action();
      showToast(outcome || fallbackMessage);
      setRejectTarget(null);
      setRejectReason('');
      setEditingCompanyId(null);
      setEditingOpportunityId(null);
      setMergeCompanyId(null);
      await load();
    } catch (caught) {
      showToast(errorMessage(caught));
    } finally {
      setBusyId(null);
    }
  };

  const sourceName = useMemo(() => {
    const map = new Map(sources.map((source) => [source.id, source.name]));
    return (id: string) => map.get(id) ?? 'Unknown source';
  }, [sources]);

  const mergeOptions = useMemo(() => {
    const term = mergeQuery.trim().toLowerCase();
    return organizations
      .filter((organization) => !term || organization.name.toLowerCase().includes(term))
      .slice(0, 8);
  }, [mergeQuery, organizations]);

  const submitReject = () => {
    if (!rejectTarget) return;
    if (rejectReason.trim().length < 3) {
      showToast('Add a short reason for the rejection.');
      return;
    }
    const reason = rejectReason.trim();
    if (rejectTarget.kind === 'company') {
      void perform(
        rejectTarget.id,
        () =>
          adminDiscoveryService
            .rejectDiscoveredCompany(rejectTarget.id, reason)
            .then(() => 'Discovered company rejected'),
        'Discovered company rejected',
      );
    } else {
      void perform(
        rejectTarget.id,
        () =>
          adminDiscoveryService
            .rejectDiscoveredOpportunity(rejectTarget.id, reason)
            .then(() => 'Discovered opportunity rejected'),
        'Discovered opportunity rejected',
      );
    }
  };

  const saveCompany = (company: DiscoveredCompany) => {
    const patch = {
      name: companyDraft.name?.trim() || company.name,
      registration_number: companyDraft.registration_number?.trim() || null,
      description: companyDraft.description?.trim() || null,
      industry: companyDraft.industry?.trim() || null,
      website: companyDraft.website?.trim() || null,
      province: companyDraft.province?.trim() || null,
      city: companyDraft.city?.trim() || null,
    };
    void perform(
      company.id,
      () =>
        adminDiscoveryService
          .updateDiscoveredCompany(company.id, patch)
          .then(() => 'Company details saved'),
      'Company details saved',
    );
  };

  const saveOpportunity = (opportunity: DiscoveredOpportunity) => {
    const patch = {
      title: opportunityDraft.title?.trim() || opportunity.title,
      provider: opportunityDraft.provider?.trim() || null,
      description: opportunityDraft.description?.trim() || null,
      province: opportunityDraft.province?.trim() || opportunity.province,
      qualification: opportunityDraft.qualification?.trim() || null,
      application_url: opportunityDraft.application_url?.trim() || null,
      closing_date: opportunityDraft.closing_date?.trim() || null,
    };
    void perform(
      opportunity.id,
      () =>
        adminDiscoveryService
          .updateDiscoveredOpportunity(opportunity.id, patch)
          .then(() => 'Opportunity details saved'),
      'Opportunity details saved',
    );
  };

  const submitSource = () => {
    setSourceFormError(null);
    let config: Record<string, unknown>;
    try {
      config = JSON.parse(sourceDraft.config || '{}') as Record<string, unknown>;
      if (!config || typeof config !== 'object' || Array.isArray(config)) {
        throw new Error('Config must be a JSON object.');
      }
    } catch (caught) {
      setSourceFormError(errorMessage(caught));
      return;
    }

    setBusyId('new-source');
    void (async () => {
      try {
        await adminDiscoveryService.createDiscoverySource({
          name: sourceDraft.name,
          source_type: sourceDraft.source_type,
          base_url: sourceDraft.base_url,
          terms_url: sourceDraft.terms_url.trim() || null,
          license_note: sourceDraft.license_note.trim() || null,
          is_enabled: false,
          config,
        });
        showToast('Source added. It stays disabled until you enable it.');
        setShowSourceForm(false);
        setSourceDraft({
          name: '',
          source_type: 'json',
          base_url: '',
          terms_url: '',
          license_note: '',
          config: '{\n  "type": "opportunity",\n  "itemPath": "items"\n}',
        });
        await load();
      } catch (caught) {
        setSourceFormError(errorMessage(caught));
      } finally {
        setBusyId(null);
      }
    })();
  };

  return (
    <>
      <SectionHeader
        title="Discovery management"
        subtitle="Approved sources, collected records and run history. Imported records always stay pending and unpublished."
      />

      {stats ? (
        <View style={styles.statRow}>
          <StatCard
            label="Enabled sources"
            value={`${stats.sources_enabled}/${stats.sources_total}`}
            icon="rss"
            tone="green"
          />
          <StatCard
            label="Companies found"
            value={stats.companies_total}
            icon="briefcase"
            tone="blue"
          />
          <StatCard
            label="Opportunities found"
            value={stats.opportunities_total}
            icon="compass"
            tone="blue"
          />
          <StatCard
            label="Failed runs (24h)"
            value={stats.runs_failed_24h}
            icon="alert-triangle"
            tone={stats.runs_failed_24h > 0 ? 'red' : 'green'}
          />
        </View>
      ) : null}

      {stats?.last_run ? (
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>
            Last collection: {stats.last_run.status} ·{' '}
            {formatRelativeTime(stats.last_run.started_at)}
          </Text>
          <Text style={styles.infoBody} numberOfLines={2}>
            {stats.last_run.error_summary ||
              `${stats.last_run.items_found} item(s), ${stats.last_run.companies_imported} compan${
                stats.last_run.companies_imported === 1 ? 'y' : 'ies'
              } and ${stats.last_run.opportunities_imported} opportunit${
                stats.last_run.opportunities_imported === 1 ? 'y' : 'ies'
              } imported.`}
          </Text>
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sectionRow}
      >
        {SECTIONS.map((item) => (
          <Chip
            key={item.key}
            label={item.label}
            active={section === item.key}
            onPress={() => {
              setSection(item.key);
              setError(null);
            }}
          />
        ))}
      </ScrollView>

      {error ? (
        <View style={styles.errorCard}>
          <Feather name="alert-triangle" size={16} color={colors.red700} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingBlock}>
          <ActivityIndicator color={colors.teal700} />
          <Text style={styles.loadingText}>Loading discovery data…</Text>
        </View>
      ) : null}

      {/* Sources ---------------------------------------------------------- */}
      {section === 'sources' ? (
        <>
          {canManageSources ? (
            <View style={styles.headerRow}>
              <Text style={styles.subheading}>Approved sources</Text>
              <Button
                title={showSourceForm ? 'Close form' : 'Add source'}
                variant="secondary"
                icon={showSourceForm ? 'x' : 'plus'}
                onPress={() => {
                  setShowSourceForm((current) => !current);
                  setSourceFormError(null);
                }}
              />
            </View>
          ) : (
            <Text style={styles.subheading}>Approved sources</Text>
          )}

          {showSourceForm && canManageSources ? (
            <View style={styles.card}>
              <FormField
                label="Source name"
                value={sourceDraft.name}
                onChangeText={(value) => setSourceDraft((draft) => ({ ...draft, name: value }))}
                placeholder="e.g. Department of Agriculture careers"
                maxLength={160}
              />
              <Text style={styles.fieldLabel}>Source type</Text>
              <View style={styles.chipRow}>
                {(['json', 'rss', 'html'] as const).map((option) => (
                  <Chip
                    key={option}
                    label={sourceTypeLabel(option)}
                    active={sourceDraft.source_type === option}
                    onPress={() =>
                      setSourceDraft((draft) => ({ ...draft, source_type: option }))
                    }
                  />
                ))}
              </View>
              <FormField
                label="Base URL"
                value={sourceDraft.base_url}
                onChangeText={(value) =>
                  setSourceDraft((draft) => ({ ...draft, base_url: value }))
                }
                placeholder="https://example.co.za/careers.json"
                keyboardType="url"
                autoCapitalize="none"
              />
              <FormField
                label="Terms or permission URL"
                value={sourceDraft.terms_url}
                onChangeText={(value) =>
                  setSourceDraft((draft) => ({ ...draft, terms_url: value }))
                }
                placeholder="https://example.co.za/terms"
                keyboardType="url"
                autoCapitalize="none"
                hint="Record the terms, licence or written permission that allows collection."
              />
              <FormField
                label="Licence note"
                value={sourceDraft.license_note}
                onChangeText={(value) =>
                  setSourceDraft((draft) => ({ ...draft, license_note: value }))
                }
                placeholder="e.g. Permission confirmed by the data owner on 1 March 2026"
                multiline
                maxLength={500}
              />
              <FormField
                label="Adapter config (JSON)"
                value={sourceDraft.config}
                onChangeText={(value) =>
                  setSourceDraft((draft) => ({ ...draft, config: value }))
                }
                multiline
                maxLength={4000}
                hint="JSON: itemPath, type, fields, itemSelector. Never place secrets here."
              />
              {sourceFormError ? (
                <Text style={styles.formError}>{sourceFormError}</Text>
              ) : null}
              <Text style={styles.hint}>
                New sources are always created disabled. Enable one only after checking its
                terms, robots.txt and rate limits.
              </Text>
              <View style={styles.actionRow}>
                <Button
                  title="Add disabled source"
                  loading={busyId === 'new-source'}
                  onPress={submitSource}
                />
              </View>
            </View>
          ) : null}

          {sources.length === 0 && !loading ? (
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>No discovery sources</Text>
              <Text style={styles.infoBody}>
                {canManageSources
                  ? 'Add an approved JSON, RSS or HTML source. It will stay disabled until reviewed.'
                  : 'A Super Admin must add and enable a source before collection can run.'}
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {sources.map((source) => {
                const busy = busyId === source.id;
                return (
                  <View key={source.id} style={styles.card}>
                    <View style={styles.cardTop}>
                      <View style={styles.cardCopy}>
                        <Text style={styles.cardTitle}>{source.name}</Text>
                        <Text style={styles.cardMeta}>
                          {sourceTypeLabel(source.source_type)} ·{' '}
                          {source.rate_limit_seconds >= 3600
                            ? `${Math.round(source.rate_limit_seconds / 3600)}h minimum interval`
                            : `${source.rate_limit_seconds}s minimum interval`}
                        </Text>
                        <Text style={styles.cardMeta} numberOfLines={1}>
                          {source.base_url}
                        </Text>
                      </View>
                      <View style={styles.pillColumn}>
                        <Chip
                          label={source.is_enabled ? 'Enabled' : 'Disabled'}
                          tone={source.is_enabled ? 'teal' : 'default'}
                        />
                        {source.requires_credentials ? (
                          <Chip label="Credentials" icon="key" tone="amber" />
                        ) : null}
                      </View>
                    </View>

                    <Text style={styles.cardMeta}>
                      Last run:{' '}
                      {source.last_run_at ? formatRelativeTime(source.last_run_at) : 'never'}
                      {source.terms_url ? ' · Terms recorded' : ' · Terms not recorded'}
                    </Text>
                    {source.last_error ? (
                      <Text style={styles.rejectionNote} numberOfLines={3}>
                        Last error: {source.last_error}
                      </Text>
                    ) : null}

                    <View style={styles.actionRow}>
                      <Pressable
                        accessibilityRole="button"
                        disabled={busy || !source.is_enabled}
                        onPress={() =>
                          confirmAction(
                            'Run discovery now',
                            `Collect from ${source.name}? The minimum interval is still respected for scheduled runs; this manual run starts immediately.`,
                            () =>
                              void perform(
                                source.id,
                                async () => {
                                  const result =
                                    await adminDiscoveryService.runDiscoverySource(source.id);
                                  return `Run ${result.run.status}: ${result.run.items_found} item(s), ${result.run.opportunities_imported} opportunit${
                                    result.run.opportunities_imported === 1 ? 'y' : 'ies'
                                  } imported`;
                                },
                                'Discovery run finished',
                              ),
                          )
                        }
                        style={({ pressed }) => [
                          styles.primaryButton,
                          pressed && styles.pressed,
                          (busy || !source.is_enabled) && styles.disabled,
                        ]}
                      >
                        {busy ? (
                          <ActivityIndicator size="small" color={colors.teal700} />
                        ) : (
                          <>
                            <Feather name="play" size={14} color={colors.teal700} />
                            <Text style={styles.primaryText}>Run now</Text>
                          </>
                        )}
                      </Pressable>

                      {source.terms_url ? (
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => openLink(source.terms_url)}
                          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                        >
                          <Feather name="external-link" size={14} color={colors.navy800} />
                          <Text style={styles.secondaryText}>Terms</Text>
                        </Pressable>
                      ) : null}

                      {canManageSources ? (
                        <Pressable
                          accessibilityRole="button"
                          disabled={busy}
                          onPress={() =>
                            confirmAction(
                              source.is_enabled ? 'Disable source' : 'Enable source',
                              source.is_enabled
                                ? 'Collection will stop until the source is enabled again.'
                                : 'Confirm that the terms, robots.txt and rate limits allow collection before enabling this source.',
                              () =>
                                void perform(
                                  source.id,
                                  () =>
                                    adminDiscoveryService
                                      .setDiscoverySourceEnabled(source.id, !source.is_enabled)
                                      .then(() =>
                                        source.is_enabled ? 'Source disabled' : 'Source enabled',
                                      ),
                                  'Source updated',
                                ),
                            )
                          }
                          style={({ pressed }) => [
                            styles.secondaryButton,
                            pressed && styles.pressed,
                            busy && styles.disabled,
                          ]}
                        >
                          <Feather
                            name={source.is_enabled ? 'pause-circle' : 'check-circle'}
                            size={14}
                            color={colors.navy800}
                          />
                          <Text style={styles.secondaryText}>
                            {source.is_enabled ? 'Disable' : 'Enable'}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </>
      ) : null}

      {/* Companies -------------------------------------------------------- */}
      {section === 'companies' ? (
        <>
          <View style={styles.searchRow}>
            <View style={styles.searchField}>
              <FormField
                label="Search companies"
                value={query}
                onChangeText={setQuery}
                placeholder="Name, registration number or website"
                autoCapitalize="none"
                maxLength={80}
              />
            </View>
            <Button title="Search" variant="secondary" onPress={() => setSearch(query.trim())} />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.sectionRow}
          >
            {COMPANY_STATUSES.map((item) => (
              <Chip
                key={item.key}
                label={item.label}
                active={companyStatus === item.key}
                onPress={() => setCompanyStatus(item.key)}
              />
            ))}
          </ScrollView>

          {companies.length === 0 && !loading ? (
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>No discovered companies</Text>
              <Text style={styles.infoBody}>
                Run an enabled source, or change the status filter. Imported companies remain
                pending until a Super Admin approves them.
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {companies.map((company) => {
                const busy = busyId === company.id;
                const editing = editingCompanyId === company.id;
                const merging = mergeCompanyId === company.id;
                const rejecting =
                  rejectTarget?.kind === 'company' && rejectTarget.id === company.id;
                const source = company.discovery_sources?.name ?? sourceName(company.source_id);
                return (
                  <View key={company.id} style={styles.card}>
                    <View style={styles.cardTop}>
                      <View style={styles.cardCopy}>
                        <Text style={styles.cardTitle}>{company.name}</Text>
                        <Text style={styles.cardMeta}>
                          {[company.registration_number, company.industry, company.province]
                            .filter(Boolean)
                            .join(' · ') || 'No registration or location'}
                        </Text>
                        <Text style={styles.cardMeta} numberOfLines={1}>
                          {source} · last seen {formatRelativeTime(company.last_seen_at)}
                        </Text>
                      </View>
                      <Chip label={company.status} tone={COMPANY_TONE[company.status]} />
                    </View>

                    {company.description ? (
                      <Text style={styles.cardBody} numberOfLines={3}>
                        {company.description}
                      </Text>
                    ) : null}
                    {company.rejection_reason ? (
                      <Text style={styles.rejectionNote}>
                        Rejected: {company.rejection_reason}
                      </Text>
                    ) : null}

                    {editing ? (
                      <View style={styles.editForm}>
                        <FormField
                          label="Name"
                          value={companyDraft.name}
                          onChangeText={(value) =>
                            setCompanyDraft((draft) => ({ ...draft, name: value }))
                          }
                          maxLength={300}
                        />
                        <FormField
                          label="Registration number"
                          value={companyDraft.registration_number}
                          onChangeText={(value) =>
                            setCompanyDraft((draft) => ({ ...draft, registration_number: value }))
                          }
                          maxLength={60}
                        />
                        <FormField
                          label="Description"
                          value={companyDraft.description}
                          onChangeText={(value) =>
                            setCompanyDraft((draft) => ({ ...draft, description: value }))
                          }
                          multiline
                          maxLength={2000}
                        />
                        <FormField
                          label="Industry"
                          value={companyDraft.industry}
                          onChangeText={(value) =>
                            setCompanyDraft((draft) => ({ ...draft, industry: value }))
                          }
                          maxLength={120}
                        />
                        <FormField
                          label="Website"
                          value={companyDraft.website}
                          onChangeText={(value) =>
                            setCompanyDraft((draft) => ({ ...draft, website: value }))
                          }
                          keyboardType="url"
                          autoCapitalize="none"
                        />
                        <FormField
                          label="Province"
                          value={companyDraft.province}
                          onChangeText={(value) =>
                            setCompanyDraft((draft) => ({ ...draft, province: value }))
                          }
                          maxLength={80}
                        />
                        <FormField
                          label="City or town"
                          value={companyDraft.city}
                          onChangeText={(value) =>
                            setCompanyDraft((draft) => ({ ...draft, city: value }))
                          }
                          maxLength={120}
                        />
                        <View style={styles.actionRow}>
                          <Button
                            title="Cancel"
                            variant="secondary"
                            onPress={() => setEditingCompanyId(null)}
                          />
                          <Button
                            title="Save changes"
                            loading={busy}
                            onPress={() => saveCompany(company)}
                          />
                        </View>
                      </View>
                    ) : null}

                    {rejecting ? (
                      <View style={styles.editForm}>
                        <FormField
                          label="Reason for rejection"
                          value={rejectReason}
                          onChangeText={setRejectReason}
                          placeholder="Why should this company not be imported?"
                          multiline
                          maxLength={400}
                        />
                        <View style={styles.actionRow}>
                          <Button
                            title="Cancel"
                            variant="secondary"
                            onPress={() => {
                              setRejectTarget(null);
                              setRejectReason('');
                            }}
                          />
                          <Button title="Confirm rejection" variant="danger" onPress={submitReject} />
                        </View>
                      </View>
                    ) : null}

                    {merging ? (
                      <View style={styles.editForm}>
                        <FormField
                          label="Merge into an existing organisation"
                          value={mergeQuery}
                          onChangeText={setMergeQuery}
                          placeholder="Search organisation name"
                          autoCapitalize="none"
                          hint="Merging moves linked opportunities to the target organisation."
                        />
                        {mergeOptions.map((organization) => (
                          <Pressable
                            key={organization.id}
                            accessibilityRole="button"
                            onPress={() =>
                              confirmAction(
                                'Merge company',
                                `Merge ${company.name} into ${organization.name}? This cannot be undone from the admin screen.`,
                                () =>
                                  void perform(
                                    company.id,
                                    () =>
                                      adminDiscoveryService
                                        .mergeDiscoveredCompany(company.id, organization.id)
                                        .then(() => `Merged into ${organization.name}`),
                                    'Company merged',
                                  ),
                              )
                            }
                            style={({ pressed }) => [
                              styles.optionRow,
                              pressed && styles.pressed,
                            ]}
                          >
                            <Text style={styles.optionTitle}>{organization.name}</Text>
                            <Text style={styles.optionMeta}>
                              {organization.status} · {organization.province ?? 'No province'}
                            </Text>
                          </Pressable>
                        ))}
                        {mergeOptions.length === 0 ? (
                          <Text style={styles.hint}>No organisations match that search.</Text>
                        ) : null}
                        <Button
                          title="Cancel merge"
                          variant="secondary"
                          onPress={() => setMergeCompanyId(null)}
                        />
                      </View>
                    ) : null}

                    <View style={styles.actionRow}>
                      {company.status !== 'rejected' && company.status !== 'merged' ? (
                        <>
                          {canEditContent ? (
                            <>
                              <Pressable
                                accessibilityRole="button"
                                onPress={() => {
                                  setEditingCompanyId(editing ? null : company.id);
                                  setCompanyDraft({
                                    name: company.name,
                                    registration_number: company.registration_number ?? '',
                                    description: company.description ?? '',
                                    industry: company.industry ?? '',
                                    website: company.website ?? '',
                                    province: company.province ?? '',
                                    city: company.city ?? '',
                                  });
                                }}
                                style={({ pressed }) => [
                                  styles.secondaryButton,
                                  pressed && styles.pressed,
                                ]}
                              >
                                <Feather name="edit-3" size={14} color={colors.navy800} />
                                <Text style={styles.secondaryText}>{editing ? 'Close' : 'Edit'}</Text>
                              </Pressable>
                              <Pressable
                                accessibilityRole="button"
                                onPress={() => {
                                  setMergeCompanyId(merging ? null : company.id);
                                  setMergeQuery('');
                                }}
                                style={({ pressed }) => [
                                  styles.secondaryButton,
                                  pressed && styles.pressed,
                                ]}
                              >
                                <Feather name="git-merge" size={14} color={colors.navy800} />
                                <Text style={styles.secondaryText}>
                                  {merging ? 'Close' : 'Merge'}
                                </Text>
                              </Pressable>
                            </>
                          ) : null}

                          <Pressable
                            accessibilityRole="button"
                            disabled={busy || company.status === 'verified'}
                            onPress={() =>
                              confirmAction(
                                'Import company',
                                'Create or match an organisation in the main directory? It will stay pending and unverified until a Super Admin approves it.',
                                () =>
                                  void perform(
                                    company.id,
                                    () =>
                                      adminDiscoveryService
                                        .promoteDiscoveredCompany(company.id)
                                        .then(() => 'Company imported as pending'),
                                    'Company imported',
                                  ),
                              )
                            }
                            style={({ pressed }) => [
                              styles.primaryButton,
                              pressed && styles.pressed,
                              (busy || company.status === 'verified') && styles.disabled,
                            ]}
                          >
                            <Feather name="download" size={14} color={colors.teal700} />
                            <Text style={styles.primaryText}>Import</Text>
                          </Pressable>

                          {canEditContent ? (
                            <Pressable
                              accessibilityRole="button"
                              onPress={() => {
                                setRejectTarget({ kind: 'company', id: company.id });
                                setRejectReason('');
                              }}
                              style={({ pressed }) => [
                                styles.rejectButton,
                                pressed && styles.pressed,
                              ]}
                            >
                              <Feather name="x" size={14} color={colors.red700} />
                              <Text style={styles.rejectText}>Reject</Text>
                            </Pressable>
                          ) : null}
                        </>
                      ) : null}

                      <Pressable
                        accessibilityRole="button"
                        onPress={() => openLink(company.source_url)}
                        style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
                      >
                        <Feather name="external-link" size={14} color={colors.navy800} />
                        <Text style={styles.linkButtonText}>Source</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </>
      ) : null}

      {/* Opportunities ---------------------------------------------------- */}
      {section === 'opportunities' ? (
        <>
          <View style={styles.searchRow}>
            <View style={styles.searchField}>
              <FormField
                label="Search opportunities"
                value={query}
                onChangeText={setQuery}
                placeholder="Title or organisation"
                autoCapitalize="none"
                maxLength={80}
              />
            </View>
            <Button title="Search" variant="secondary" onPress={() => setSearch(query.trim())} />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.sectionRow}
          >
            {OPPORTUNITY_STATUSES.map((item) => (
              <Chip
                key={item.key}
                label={item.label}
                active={opportunityStatus === item.key}
                onPress={() => setOpportunityStatus(item.key)}
              />
            ))}
          </ScrollView>

          {opportunities.length === 0 && !loading ? (
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>No discovered opportunities</Text>
              <Text style={styles.infoBody}>
                Run an enabled source, or change the status filter. Imported opportunities stay
                pending and unpublished until an authorised reviewer approves them.
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {opportunities.map((opportunity) => {
                const busy = busyId === opportunity.id;
                const editing = editingOpportunityId === opportunity.id;
                const rejecting =
                  rejectTarget?.kind === 'opportunity' && rejectTarget.id === opportunity.id;
                const source =
                  opportunity.discovery_sources?.name ?? sourceName(opportunity.source_id);
                return (
                  <View key={opportunity.id} style={styles.card}>
                    <View style={styles.cardTop}>
                      <View style={styles.cardCopy}>
                        <Text style={styles.cardTitle}>{opportunity.title}</Text>
                        <Text style={styles.cardMeta}>
                          {[opportunity.provider, opportunity.province, opportunity.category]
                            .filter(Boolean)
                            .join(' · ')}
                        </Text>
                        <Text style={styles.cardMeta} numberOfLines={1}>
                          {source} · closes{' '}
                          {opportunity.closing_date
                            ? formatShortDate(opportunity.closing_date)
                            : 'not stated'}
                        </Text>
                      </View>
                      <Chip
                        label={opportunity.status}
                        tone={OPPORTUNITY_TONE[opportunity.status]}
                      />
                    </View>

                    {opportunity.description ? (
                      <Text style={styles.cardBody} numberOfLines={3}>
                        {opportunity.description}
                      </Text>
                    ) : null}
                    {opportunity.rejection_reason ? (
                      <Text style={styles.rejectionNote}>
                        Rejected: {opportunity.rejection_reason}
                      </Text>
                    ) : null}

                    {editing ? (
                      <View style={styles.editForm}>
                        <FormField
                          label="Title"
                          value={opportunityDraft.title}
                          onChangeText={(value) =>
                            setOpportunityDraft((draft) => ({ ...draft, title: value }))
                          }
                          maxLength={300}
                        />
                        <FormField
                          label="Organisation"
                          value={opportunityDraft.provider}
                          onChangeText={(value) =>
                            setOpportunityDraft((draft) => ({ ...draft, provider: value }))
                          }
                          maxLength={200}
                        />
                        <FormField
                          label="Description"
                          value={opportunityDraft.description}
                          onChangeText={(value) =>
                            setOpportunityDraft((draft) => ({ ...draft, description: value }))
                          }
                          multiline
                          maxLength={4000}
                        />
                        <FormField
                          label="Province"
                          value={opportunityDraft.province}
                          onChangeText={(value) =>
                            setOpportunityDraft((draft) => ({ ...draft, province: value }))
                          }
                          maxLength={80}
                        />
                        <FormField
                          label="Qualification"
                          value={opportunityDraft.qualification}
                          onChangeText={(value) =>
                            setOpportunityDraft((draft) => ({ ...draft, qualification: value }))
                          }
                          maxLength={500}
                        />
                        <FormField
                          label="Closing date (YYYY-MM-DD)"
                          value={opportunityDraft.closing_date}
                          onChangeText={(value) =>
                            setOpportunityDraft((draft) => ({ ...draft, closing_date: value }))
                          }
                          placeholder="2027-03-31"
                          autoCapitalize="none"
                          maxLength={10}
                          hint="Leave blank only when the source states no closing date."
                        />
                        <FormField
                          label="Application URL"
                          value={opportunityDraft.application_url}
                          onChangeText={(value) =>
                            setOpportunityDraft((draft) => ({ ...draft, application_url: value }))
                          }
                          keyboardType="url"
                          autoCapitalize="none"
                        />
                        <View style={styles.actionRow}>
                          <Button
                            title="Cancel"
                            variant="secondary"
                            onPress={() => setEditingOpportunityId(null)}
                          />
                          <Button
                            title="Save changes"
                            loading={busy}
                            onPress={() => saveOpportunity(opportunity)}
                          />
                        </View>
                      </View>
                    ) : null}

                    {rejecting ? (
                      <View style={styles.editForm}>
                        <FormField
                          label="Reason for rejection"
                          value={rejectReason}
                          onChangeText={setRejectReason}
                          placeholder="Why should this opportunity not be published?"
                          multiline
                          maxLength={400}
                        />
                        <View style={styles.actionRow}>
                          <Button
                            title="Cancel"
                            variant="secondary"
                            onPress={() => {
                              setRejectTarget(null);
                              setRejectReason('');
                            }}
                          />
                          <Button title="Confirm rejection" variant="danger" onPress={submitReject} />
                        </View>
                      </View>
                    ) : null}

                    <View style={styles.actionRow}>
                      {canEditContent || canReview ? (
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => {
                            setEditingOpportunityId(editing ? null : opportunity.id);
                            setOpportunityDraft({
                              title: opportunity.title,
                              provider: opportunity.provider ?? '',
                              description: opportunity.description ?? '',
                              province: opportunity.province,
                              qualification: opportunity.qualification ?? '',
                              closing_date: opportunity.closing_date ?? '',
                              application_url: opportunity.application_url ?? '',
                            });
                          }}
                          style={({ pressed }) => [
                            styles.secondaryButton,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Feather name="edit-3" size={14} color={colors.navy800} />
                          <Text style={styles.secondaryText}>{editing ? 'Close' : 'Edit'}</Text>
                        </Pressable>
                      ) : null}

                      {canReview &&
                      !['rejected', 'expired', 'imported', 'verified'].includes(
                        opportunity.status,
                      ) ? (
                        <Pressable
                          accessibilityRole="button"
                          disabled={busy}
                          onPress={() =>
                            confirmAction(
                              'Import opportunity',
                              'Create a pending, unpublished opportunity in the main review queue? Nothing is published automatically.',
                              () =>
                                void perform(
                                  opportunity.id,
                                  () =>
                                    adminDiscoveryService
                                      .promoteDiscoveredOpportunity(opportunity.id)
                                      .then(() => 'Opportunity imported as pending'),
                                  'Opportunity imported',
                                ),
                            )
                          }
                          style={({ pressed }) => [
                            styles.primaryButton,
                            pressed && styles.pressed,
                            busy && styles.disabled,
                          ]}
                        >
                          <Feather name="download" size={14} color={colors.teal700} />
                          <Text style={styles.primaryText}>Import</Text>
                        </Pressable>
                      ) : null}

                      {canReview ? (
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => {
                            setRejectTarget({ kind: 'opportunity', id: opportunity.id });
                            setRejectReason('');
                          }}
                          style={({ pressed }) => [
                            styles.rejectButton,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Feather name="x" size={14} color={colors.red700} />
                          <Text style={styles.rejectText}>Reject</Text>
                        </Pressable>
                      ) : null}

                      <Pressable
                        accessibilityRole="button"
                        onPress={() => openLink(opportunity.source_url)}
                        style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
                      >
                        <Feather name="external-link" size={14} color={colors.navy800} />
                        <Text style={styles.linkButtonText}>Source</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </>
      ) : null}

      {/* Runs ------------------------------------------------------------- */}
      {section === 'runs' ? (
        <>
          <Text style={styles.subheading}>Recent collection runs</Text>
          {runs.length === 0 && !loading ? (
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>No collection runs yet</Text>
              <Text style={styles.infoBody}>
                Enable an approved source and use Run now, or start the scheduled worker.
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {runs.map((run) => (
                <View key={run.id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={styles.cardCopy}>
                      <Text style={styles.cardTitle}>
                        {run.discovery_sources?.name ?? sourceName(run.source_id)}
                      </Text>
                      <Text style={styles.cardMeta}>
                        {formatRelativeTime(run.started_at)} · {run.trigger_type}
                        {run.duration_ms !== null ? ` · ${run.duration_ms}ms` : ''}
                      </Text>
                    </View>
                    <Chip label={run.status} tone={RUN_TONE[run.status]} />
                  </View>
                  <Text style={styles.cardMeta}>
                    {run.items_found} found · {run.companies_imported} compan
                    {run.companies_imported === 1 ? 'y' : 'ies'} imported ·{' '}
                    {run.opportunities_imported} opportunit
                    {run.opportunities_imported === 1 ? 'y' : 'ies'} imported ·{' '}
                    {run.duplicates} duplicate(s) · {run.error_count} error(s)
                  </Text>
                  {run.error_summary ? (
                    <Text style={styles.rejectionNote} numberOfLines={4}>
                      {run.error_summary}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          )}
        </>
      ) : null}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Audit log                                                                  */
/* -------------------------------------------------------------------------- */

export function AuditLogPanel() {
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setLogs(await adminDiscoveryService.listAuditLogs(150));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <SectionHeader
        title="Audit logs"
        subtitle="Administrative and system actions recorded by the database."
        actionLabel="Refresh"
        onAction={() => void load()}
      />
      {error ? (
        <View style={styles.errorCard}>
          <Feather name="alert-triangle" size={16} color={colors.red700} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
      {loading ? (
        <View style={styles.loadingBlock}>
          <ActivityIndicator color={colors.teal700} />
        </View>
      ) : logs.length === 0 ? (
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>No audit entries</Text>
          <Text style={styles.infoBody}>
            Administrator actions and discovery imports will be recorded here.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {logs.map((log) => (
            <View key={log.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.cardCopy}>
                  <Text style={styles.cardTitle}>{log.action}</Text>
                  <Text style={styles.cardMeta}>
                    {formatRelativeTime(log.created_at)} · {log.actor_type}
                    {log.entity_type ? ` · ${log.entity_type}` : ''}
                  </Text>
                </View>
                {log.entity_id ? (
                  <Chip label={log.entity_id.slice(0, 8)} tone="default" />
                ) : null}
              </View>
              {Object.keys(log.details ?? {}).length > 0 ? (
                <Text style={styles.auditDetails} numberOfLines={4}>
                  {JSON.stringify(log.details)}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  statRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  sectionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingRight: spacing.md,
    paddingVertical: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  subheading: {
    ...type.h3,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  fieldLabel: {
    fontFamily: 'System',
    fontSize: 13,
    fontWeight: '700',
    color: colors.navy900,
    marginTop: spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  searchField: {
    flex: 1,
  },
  list: {
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    gap: spacing.sm,
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
    ...type.bodyStrong,
    fontSize: 15,
  },
  cardMeta: {
    ...type.small,
    flexShrink: 1,
  },
  cardBody: {
    ...type.small,
    color: colors.ink,
  },
  pillColumn: {
    alignItems: 'flex-end',
    gap: spacing.xs,
    flexShrink: 0,
  },
  rejectionNote: {
    ...type.small,
    color: colors.red700,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  primaryButton: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.teal50,
    borderWidth: 1,
    borderColor: colors.teal100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  primaryText: {
    ...type.small,
    color: colors.teal700,
    fontWeight: '700',
  },
  secondaryButton: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  secondaryText: {
    ...type.small,
    color: colors.navy800,
    fontWeight: '700',
  },
  rejectButton: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.red50,
    borderWidth: 1,
    borderColor: colors.red50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  rejectText: {
    ...type.small,
    color: colors.red700,
    fontWeight: '700',
  },
  linkButton: {
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  linkButtonText: {
    ...type.small,
    color: colors.navy800,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.45,
  },
  editForm: {
    gap: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  optionRow: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    gap: 2,
  },
  optionTitle: {
    ...type.bodyStrong,
  },
  optionMeta: {
    ...type.small,
  },
  infoCard: {
    backgroundColor: colors.blue50,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: 4,
    marginTop: spacing.md,
  },
  infoTitle: {
    ...type.bodyStrong,
  },
  infoBody: {
    ...type.small,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.red50,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  errorText: {
    ...type.small,
    color: colors.red700,
    flex: 1,
  },
  loadingBlock: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    ...type.small,
  },
  hint: {
    ...type.small,
    color: colors.muted,
  },
  formError: {
    ...type.small,
    color: colors.red700,
  },
  auditDetails: {
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 16,
    color: colors.muted,
    backgroundColor: colors.surfaceSoft,
    borderRadius: 8,
    padding: spacing.sm,
  },
});
