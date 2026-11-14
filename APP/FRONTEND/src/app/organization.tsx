import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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
import { KeyboardAwareScrollView } from '@/components/KeyboardAwareScrollView';
import { CompanyListings } from '@/components/company/CompanyListings';
import { SectionHeader } from '@/components/SectionHeader';
import { colors, radius, spacing, type } from '@/constants/theme';
import { errorMessage } from '@/lib/errors';
import {
  organizationService,
  type OrganizationDraft,
} from '@/services/organizationService';
import { useApp } from '@/state/AppProvider';
import { useAuth } from '@/state/AuthProvider';
import { PROVINCES } from '@/types';
import type {
  ApiSubmission,
  CompanyApiKey,
  Organization,
  OrganizationStatus,
} from '@/types';
import { formatRelativeTime, formatShortDate } from '@/utils/date';

const STATUS_TONE: Record<OrganizationStatus, 'teal' | 'amber' | 'red'> = {
  pending: 'amber',
  approved: 'teal',
  suspended: 'red',
  rejected: 'red',
};

const STATUS_COPY: Record<OrganizationStatus, string> = {
  pending:
    'Your company is waiting for review. You can prepare your profile now; listings can be created once a Super Admin approves the company.',
  approved:
    'Your company is approved. You can create opportunities and they will be reviewed before students see them.',
  suspended:
    'This company is suspended. Publishing is paused until a Super Admin resolves the outstanding issue.',
  rejected:
    'This registration was rejected. Review the details and contact support if you believe this is a mistake.',
};

const INTEGRATION_LABEL: Record<Organization['integrationMethod'], string> = {
  none: 'No integration',
  api: 'Company API',
  webhook: 'Webhook',
  scheduled_sync: 'Scheduled sync',
};

function emptyDraft(): OrganizationDraft {
  return {
    name: '',
    registeredBusinessName: '',
    description: '',
    industry: '',
    website: '',
    contactPerson: '',
    contactEmail: '',
    contactPhone: '',
    province: '',
    address: '',
    registrationNumber: '',
    logoUrl: '',
  };
}

function draftFromOrganization(organization: Organization): OrganizationDraft {
  return {
    name: organization.name,
    registeredBusinessName: organization.registeredBusinessName ?? '',
    description: organization.description ?? '',
    industry: organization.industry ?? '',
    website: organization.website ?? '',
    contactPerson: organization.contactPerson ?? '',
    contactEmail: organization.contactEmail ?? '',
    contactPhone: organization.contactPhone ?? '',
    province: organization.province ?? '',
    address: organization.address ?? '',
    registrationNumber: organization.registrationNumber ?? '',
    logoUrl: organization.logoUrl ?? '',
  };
}

export default function OrganizationScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isSignedIn, showToast } = useApp();
  const userId = user?.id;

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRegister, setShowRegister] = useState(false);

  const [mode, setMode] = useState<'overview' | 'edit'>('overview');
  const [registerDraft, setRegisterDraft] = useState<OrganizationDraft>(emptyDraft);
  const [editDraft, setEditDraft] = useState<OrganizationDraft>(emptyDraft);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [apiKeys, setApiKeys] = useState<CompanyApiKey[]>([]);
  const [submissions, setSubmissions] = useState<ApiSubmission[]>([]);

  const selected =
    organizations.find((organization) => organization.id === selectedId) ?? null;
  const canManage =
    selected?.role === 'owner' || selected?.role === 'manager' || false;

  const loadOrganizations = useCallback(async () => {
    if (!userId) {
      setOrganizations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await organizationService.listMyOrganizations(userId);
      setOrganizations(data);
      setSelectedId((current) =>
        current && data.some((organization) => organization.id === current)
          ? current
          : (data[0]?.id ?? null),
      );
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadOrganizations();
  }, [loadOrganizations]);

  useEffect(() => {
    setMode('overview');
    setFormError(null);
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setApiKeys([]);
      setSubmissions([]);
      return;
    }

    let active = true;
    void (async () => {
      const [keyResult, submissionResult] = await Promise.allSettled([
        canManage
          ? organizationService.listApiKeys(selectedId)
          : Promise.resolve<CompanyApiKey[]>([]),
        organizationService.listSubmissions(selectedId),
      ]);
      if (!active) return;
      setApiKeys(keyResult.status === 'fulfilled' ? keyResult.value : []);
      setSubmissions(
        submissionResult.status === 'fulfilled' ? submissionResult.value : [],
      );
    })();

    return () => {
      active = false;
    };
  }, [selectedId, canManage]);

  const patchRegister = (patch: Partial<OrganizationDraft>) =>
    setRegisterDraft((current) => ({ ...current, ...patch }));

  const patchEdit = (patch: Partial<OrganizationDraft>) =>
    setEditDraft((current) => ({ ...current, ...patch }));

  const register = async () => {
    if (!userId) return;
    if (registerDraft.name.trim().length < 2) {
      setFormError('Enter the organisation name (at least 2 characters).');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const created = await organizationService.registerOrganization(
        userId,
        registerDraft,
      );
      setOrganizations((current) => [...current, created]);
      setSelectedId(created.id);
      setRegisterDraft(emptyDraft());
      setShowRegister(false);
      showToast('Organisation submitted for review');
    } catch (caught) {
      setFormError(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = () => {
    if (!selected) return;
    setEditDraft(draftFromOrganization(selected));
    setFormError(null);
    setMode('edit');
  };

  const saveDetails = async () => {
    if (!selected) return;
    if (editDraft.name.trim().length < 2) {
      setFormError('Enter the organisation name (at least 2 characters).');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const updated = await organizationService.updateOrganization(
        selected.id,
        editDraft,
      );
      setOrganizations((current) =>
        current.map((organization) =>
          organization.id === updated.id
            ? { ...organization, ...updated, role: organization.role }
            : organization,
        ),
      );
      setMode('overview');
      showToast('Organisation details updated');
    } catch (caught) {
      setFormError(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };

  const headerAction =
    isSignedIn && organizations.length > 0 && !showRegister ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Register another organisation"
        onPress={() => {
          setRegisterDraft(emptyDraft());
          setFormError(null);
          setShowRegister(true);
        }}
        hitSlop={8}
        style={({ pressed }) => [styles.newButton, pressed && styles.pressed]}
      >
        <Feather name="plus" size={16} color={colors.teal700} />
        <Text style={styles.newButtonText}>New</Text>
      </Pressable>
    ) : undefined;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
      <AppHeader
        title="Organisations"
        subtitle="Register a company and manage its opportunities"
        onBack={() => router.back()}
        action={headerAction}
      />

      {!isSignedIn ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="briefcase"
            title="Sign in to register an organisation"
            message="Company accounts can submit opportunities for review and track what is published."
            actionLabel="Sign in"
            onAction={() => router.push('/auth')}
          />
        </View>
      ) : loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.teal700} />
          <Text style={styles.loadingText}>Loading your organisations…</Text>
        </View>
      ) : error ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="alert-triangle"
            title="Could not load organisations"
            message={error}
            actionLabel="Try again"
            onAction={() => void loadOrganizations()}
          />
        </View>
      ) : (
        <KeyboardAwareScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {showRegister || organizations.length === 0 ? (
            <OrganizationForm
              title={organizations.length === 0 ? 'Register your organisation' : 'Register another organisation'}
              subtitle="New organisations start as pending and are reviewed by a Super Admin."
              draft={registerDraft}
              onChange={patchRegister}
              error={formError}
              submitting={submitting}
              submitLabel="Submit for review"
              onSubmit={() => void register()}
              onCancel={
                organizations.length > 0
                  ? () => {
                      setShowRegister(false);
                      setFormError(null);
                    }
                  : undefined
              }
            />
          ) : (
            <>
              {organizations.length > 1 ? (
                <View style={styles.selector}>
                  <Text style={styles.selectorLabel}>Your organisations</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                    {organizations.map((organization) => (
                      <Chip
                        key={organization.id}
                        label={organization.name}
                        active={organization.id === selectedId}
                        onPress={() => setSelectedId(organization.id)}
                      />
                    ))}
                  </ScrollView>
                </View>
              ) : null}

              {selected ? (
                <>
                  <OrganizationSummary
                    organization={selected}
                    onEdit={canManage ? startEdit : undefined}
                  />

                  {selected.status !== 'approved' ? (
                    <View style={styles.noticeCard}>
                      <Feather name="info" size={16} color={colors.amber700} />
                      <Text style={styles.noticeText}>
                        {STATUS_COPY[selected.status]}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.noticeCard}>
                      <Feather name="check-circle" size={16} color={colors.teal700} />
                      <Text style={styles.noticeText}>
                        {STATUS_COPY.approved}
                      </Text>
                    </View>
                  )}

                  {mode === 'edit' ? (
                    <OrganizationDetailsEditor
                      draft={editDraft}
                      onChange={patchEdit}
                      error={formError}
                      submitting={submitting}
                      onSave={() => void saveDetails()}
                      onCancel={() => {
                        setMode('overview');
                        setFormError(null);
                      }}
                    />
                  ) : (
                    <>
                      <CompanyListings organization={selected} canManage={canManage} />

                      <SectionHeader
                        title="Company API"
                        subtitle="Credentials and submission history"
                      />
                      <View style={styles.card}>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Integration</Text>
                          <Text style={styles.detailValue}>
                            {INTEGRATION_LABEL[selected.integrationMethod]}
                          </Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>API access</Text>
                          <Text style={styles.detailValue}>
                            {selected.apiEnabled ? 'Enabled' : 'Not enabled'}
                          </Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Active keys</Text>
                          <Text style={styles.detailValue}>
                            {apiKeys.filter((key) => key.status === 'active').length}
                          </Text>
                        </View>
                        <Text style={styles.apiHint}>
                          {selected.status === 'approved'
                            ? 'A Super Admin issues API keys from the administrator area. Keys are shown once when created and only a hash is stored.'
                            : 'API access becomes available after a Super Admin approves your organisation.'}
                        </Text>
                      </View>

                      {canManage ? (
                        apiKeys.length === 0 ? (
                          <View style={styles.infoCard}>
                            <Text style={styles.infoTitle}>No API keys yet</Text>
                            <Text style={styles.infoBody}>
                              Ask a Super Admin to generate a key once your
                              organisation is approved. The key is displayed once,
                              and only its SHA-256 hash is stored.
                            </Text>
                          </View>
                        ) : (
                          <View style={styles.list}>
                            {apiKeys.map((key) => (
                              <View key={key.id} style={styles.keyCard}>
                                <View style={styles.keyTop}>
                                  <View style={styles.keyIcon}>
                                    <Feather
                                      name="key"
                                      size={15}
                                      color={colors.teal700}
                                    />
                                  </View>
                                  <View style={styles.listingCopy}>
                                    <Text style={styles.keyName}>{key.name}</Text>
                                    <Text style={styles.keyPrefix}>
                                      {key.keyPrefix}…
                                    </Text>
                                  </View>
                                  <Chip
                                    label={key.status}
                                    tone={key.status === 'active' ? 'teal' : 'red'}
                                  />
                                </View>
                                <Text style={styles.keyMeta}>
                                  Created {formatShortDate(key.createdAt)}
                                  {key.lastUsedAt
                                    ? ` · last used ${formatRelativeTime(key.lastUsedAt)}`
                                    : ' · never used'}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )
                      ) : null}

                      {submissions.length > 0 ? (
                        <>
                          <Text style={styles.subheading}>Recent submissions</Text>
                          <View style={styles.list}>
                            {submissions.map((submission) => (
                              <View key={submission.id} style={styles.submissionRow}>
                                <Feather
                                  name={
                                    submission.status === 'accepted'
                                      ? 'check-circle'
                                      : submission.status === 'duplicate'
                                        ? 'copy'
                                        : 'alert-circle'
                                  }
                                  size={16}
                                  color={
                                    submission.status === 'accepted'
                                      ? colors.teal700
                                      : submission.status === 'duplicate'
                                        ? colors.amber700
                                        : colors.red700
                                  }
                                />
                                <View style={styles.submissionCopy}>
                                  <Text style={styles.submissionTitle}>
                                    {submission.eventType} · {submission.status}
                                  </Text>
                                  <Text style={styles.submissionMeta}>
                                    {formatRelativeTime(submission.createdAt)}
                                    {submission.errorMessage
                                      ? ` · ${submission.errorMessage}`
                                      : ''}
                                  </Text>
                                </View>
                              </View>
                            ))}
                          </View>
                        </>
                      ) : null}
                    </>
                  )}
                </>
              ) : null}
            </>
          )}
        </KeyboardAwareScrollView>
      )}
    </SafeAreaView>
  );
}

function OrganizationSummary({
  organization,
  onEdit,
}: {
  organization: Organization;
  onEdit?: () => void;
}) {
  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryTop}>
        <View style={styles.orgAvatar}>
          <Feather name="briefcase" size={20} color={colors.white} />
        </View>
        <View style={styles.summaryCopy}>
          <Text style={styles.orgName}>{organization.name}</Text>
          <Text style={styles.orgMeta}>
            {[organization.industry, organization.province]
              .filter(Boolean)
              .join(' · ') || 'No industry or province set'}
          </Text>
        </View>
        <Chip
          label={organization.status}
          tone={STATUS_TONE[organization.status]}
        />
      </View>

      {organization.description ? (
        <Text style={styles.orgDescription}>{organization.description}</Text>
      ) : null}

      <View style={styles.summaryBadges}>
        {organization.isVerified ? (
          <Chip label="Verified" icon="check-circle" tone="teal" />
        ) : (
          <Chip label="Not yet verified" icon="shield" />
        )}
        {organization.role ? (
          <Chip label={`Your role: ${organization.role}`} icon="user" />
        ) : null}
      </View>

      <View style={styles.detailList}>
        {organization.website ? (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Website</Text>
            <Text style={styles.detailValue} numberOfLines={1}>
              {organization.website}
            </Text>
          </View>
        ) : null}
        {organization.contactEmail ? (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Contact</Text>
            <Text style={styles.detailValue} numberOfLines={1}>
              {organization.contactEmail}
            </Text>
          </View>
        ) : null}
      </View>

      {onEdit ? (
        <Button
          title="Edit organisation details"
          variant="secondary"
          icon="edit-2"
          onPress={onEdit}
        />
      ) : null}
    </View>
  );
}

function OrganizationForm({
  title,
  subtitle,
  draft,
  onChange,
  error,
  submitting,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  title: string;
  subtitle: string;
  draft: OrganizationDraft;
  onChange: (patch: Partial<OrganizationDraft>) => void;
  error: string | null;
  submitting: boolean;
  submitLabel: string;
  onSubmit: () => void;
  onCancel?: () => void;
}) {
  return (
    <>
      <View style={styles.formIntro}>
        <Text style={styles.formTitle}>{title}</Text>
        <Text style={styles.formSubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.card}>
        <FormField
          label="Organisation name"
          value={draft.name}
          onChangeText={(name) => onChange({ name })}
          placeholder="e.g. Green Fields Agri (Pty) Ltd"
          autoCapitalize="words"
        />
        <FormField
          label="Registered business name"
          value={draft.registeredBusinessName ?? ''}
          onChangeText={(registeredBusinessName) => onChange({ registeredBusinessName })}
          placeholder="As registered with the CIPC (if different)"
          autoCapitalize="words"
        />
        <FormField
          label="Contact person"
          value={draft.contactPerson ?? ''}
          onChangeText={(contactPerson) => onChange({ contactPerson })}
          placeholder="e.g. Thando Nkosi"
          autoCapitalize="words"
        />
        <FormField
          label="What does your organisation do?"
          value={draft.description}
          onChangeText={(description) => onChange({ description })}
          placeholder="Short description shown on published opportunities"
          multiline
          maxLength={500}
        />
        <FormField
          label="Industry"
          value={draft.industry}
          onChangeText={(industry) => onChange({ industry })}
          placeholder="e.g. Agriculture, AgriTech, Food processing"
        />
        <FormField
          label="Website"
          value={draft.website}
          onChangeText={(website) => onChange({ website })}
          placeholder="https://…"
          keyboardType="url"
          autoCapitalize="none"
        />
        <FormField
          label="Logo URL"
          value={draft.logoUrl ?? ''}
          onChangeText={(logoUrl) => onChange({ logoUrl })}
          placeholder="https://…/logo.png"
          keyboardType="url"
          autoCapitalize="none"
          hint="Link to your company logo. File uploads are not enabled on this project."
        />
        <FormField
          label="Contact email"
          value={draft.contactEmail}
          onChangeText={(contactEmail) => onChange({ contactEmail })}
          placeholder="opportunities@example.co.za"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <FormField
          label="Contact phone"
          value={draft.contactPhone}
          onChangeText={(contactPhone) => onChange({ contactPhone })}
          placeholder="012 345 6789"
          keyboardType="phone-pad"
        />
        <FormField
          label="Registration number"
          value={draft.registrationNumber}
          onChangeText={(registrationNumber) => onChange({ registrationNumber })}
          placeholder="Company registration (optional)"
          autoCapitalize="characters"
        />
        <FormField
          label="Address"
          value={draft.address}
          onChangeText={(address) => onChange({ address })}
          placeholder="Street address"
        />
        <View style={styles.chipBlock}>
          <Text style={styles.chipLabel}>Province</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {PROVINCES.map((province) => (
              <Chip
                key={province}
                label={province}
                active={draft.province === province}
                onPress={() =>
                  onChange({
                    province: draft.province === province ? '' : province,
                  })
                }
              />
            ))}
          </ScrollView>
        </View>
        {error ? <Text style={styles.formError}>{error}</Text> : null}
        <View style={styles.formActions}>
          {onCancel ? (
            <Button
              title="Cancel"
              variant="secondary"
              onPress={onCancel}
              disabled={submitting}
            />
          ) : null}
          <Button
            title={submitLabel}
            onPress={onSubmit}
            loading={submitting}
            disabled={submitting}
          />
        </View>
      </View>
    </>
  );
}

function OrganizationDetailsEditor({
  draft,
  onChange,
  error,
  submitting,
  onSave,
  onCancel,
}: {
  draft: OrganizationDraft;
  onChange: (patch: Partial<OrganizationDraft>) => void;
  error: string | null;
  submitting: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      <SectionHeader
        title="Edit details"
        subtitle="Status and API access are controlled by administrators"
      />
      <View style={styles.card}>
        <FormField
          label="Organisation name"
          value={draft.name}
          onChangeText={(name) => onChange({ name })}
          autoCapitalize="words"
        />
        <FormField
          label="Registered business name"
          value={draft.registeredBusinessName ?? ''}
          onChangeText={(registeredBusinessName) => onChange({ registeredBusinessName })}
          placeholder="As registered with the CIPC (if different)"
          autoCapitalize="words"
        />
        <FormField
          label="Contact person"
          value={draft.contactPerson ?? ''}
          onChangeText={(contactPerson) => onChange({ contactPerson })}
          autoCapitalize="words"
        />
        <FormField
          label="Description"
          value={draft.description}
          onChangeText={(description) => onChange({ description })}
          multiline
          maxLength={500}
        />
        <FormField
          label="Industry"
          value={draft.industry}
          onChangeText={(industry) => onChange({ industry })}
        />
        <FormField
          label="Website"
          value={draft.website}
          onChangeText={(website) => onChange({ website })}
          keyboardType="url"
          autoCapitalize="none"
        />
        <FormField
          label="Logo URL"
          value={draft.logoUrl ?? ''}
          onChangeText={(logoUrl) => onChange({ logoUrl })}
          keyboardType="url"
          autoCapitalize="none"
        />
        <FormField
          label="Contact email"
          value={draft.contactEmail}
          onChangeText={(contactEmail) => onChange({ contactEmail })}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <FormField
          label="Contact phone"
          value={draft.contactPhone}
          onChangeText={(contactPhone) => onChange({ contactPhone })}
          keyboardType="phone-pad"
        />
        <FormField
          label="Registration number"
          value={draft.registrationNumber ?? ''}
          onChangeText={(registrationNumber) => onChange({ registrationNumber })}
          placeholder="Company registration (optional)"
          autoCapitalize="characters"
        />
        <FormField
          label="Address"
          value={draft.address}
          onChangeText={(address) => onChange({ address })}
        />
        <View style={styles.chipBlock}>
          <Text style={styles.chipLabel}>Province</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {PROVINCES.map((province) => (
              <Chip
                key={province}
                label={province}
                active={draft.province === province}
                onPress={() =>
                  onChange({
                    province: draft.province === province ? '' : province,
                  })
                }
              />
            ))}
          </ScrollView>
        </View>
        {error ? <Text style={styles.formError}>{error}</Text> : null}
        <View style={styles.formActions}>
          <Button
            title="Cancel"
            variant="secondary"
            onPress={onCancel}
            disabled={submitting}
          />
          <Button
            title="Save details"
            onPress={onSave}
            loading={submitting}
            disabled={submitting}
          />
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.surfaceSoft,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
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
    gap: spacing.md,
  },
  loadingText: {
    ...type.small,
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.teal100,
    backgroundColor: colors.teal50,
    paddingHorizontal: spacing.md,
  },
  newButtonText: {
    fontFamily: type.bodyStrong.fontFamily,
    fontSize: 13,
    fontWeight: '700',
    color: colors.teal700,
  },
  selector: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  selectorLabel: {
    ...type.label,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  summaryCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    gap: spacing.md,
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  orgAvatar: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.teal700,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCopy: {
    flex: 1,
    gap: 2,
  },
  orgName: {
    ...type.h3,
    fontSize: 17,
  },
  orgMeta: {
    ...type.small,
  },
  orgDescription: {
    ...type.body,
    color: colors.ink,
  },
  summaryBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  detailList: {
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  detailLabel: {
    ...type.small,
  },
  detailValue: {
    ...type.bodyStrong,
    flexShrink: 1,
    textAlign: 'right',
  },
  noticeCard: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.blue50,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  noticeText: {
    ...type.small,
    color: colors.navy800,
    flex: 1,
  },
  card: {
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    gap: spacing.lg,
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
  list: {
    gap: spacing.md,
  },
  listingCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  listingTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  listingCopy: {
    flex: 1,
    gap: 2,
  },
  listingTitle: {
    ...type.h3,
    fontSize: 15,
  },
  listingMeta: {
    ...type.small,
  },
  listingFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.sm,
  },
  listingHint: {
    ...type.caption,
    flex: 1,
  },
  inlineLoading: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  keyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  keyTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  keyIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.teal50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyName: {
    ...type.bodyStrong,
  },
  keyPrefix: {
    ...type.small,
    fontFamily: 'monospace',
  },
  keyMeta: {
    ...type.caption,
  },
  apiHint: {
    ...type.caption,
    lineHeight: 17,
  },
  subheading: {
    ...type.label,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  submissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
  },
  submissionCopy: {
    flex: 1,
    gap: 2,
  },
  submissionTitle: {
    ...type.bodyStrong,
    fontSize: 13,
    textTransform: 'capitalize',
  },
  submissionMeta: {
    ...type.caption,
  },
  formIntro: {
    marginTop: spacing.lg,
    gap: 4,
  },
  formTitle: {
    ...type.h2,
  },
  formSubtitle: {
    ...type.small,
  },
  formError: {
    ...type.small,
    color: colors.red700,
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
  },
  chipBlock: {
    gap: spacing.sm,
  },
  chipLabel: {
    fontFamily: type.bodyStrong.fontFamily,
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
  },
  pressed: {
    opacity: 0.7,
  },
});
