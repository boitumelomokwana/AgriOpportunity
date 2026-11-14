import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { categoryChips } from '@/constants/categories';
import { colors, radius, spacing, type } from '@/constants/theme';
import { errorMessage } from '@/lib/errors';
import { notificationService } from '@/services/notificationService';
import {
  organizationService,
  type CompanyOpportunityDraft,
} from '@/services/organizationService';
import { useApp } from '@/state/AppProvider';
import { useAuth } from '@/state/AuthProvider';
import {
  EDUCATION_LEVELS,
  PROVINCES,
  type AppNotification,
  type ApplicationStatus,
  type CompanyApplication,
  type Opportunity,
  type Organization,
} from '@/types';
import { formatShortDate } from '@/utils/date';

const COMPANY_CATEGORIES = [
  ...categoryChips.map((chip) => chip.category),
  'Other',
] as const;

const APPLICATION_ACTIONS: { label: string; status: ApplicationStatus; tone: 'teal' | 'red' }[] = [
  { label: 'Shortlist', status: 'Shortlisted', tone: 'teal' },
  { label: 'Interview', status: 'Interview', tone: 'teal' },
  { label: 'Offer', status: 'Offered', tone: 'teal' },
  { label: 'Reject', status: 'Rejected', tone: 'red' },
];

const STATUS_TONE = {
  pending: 'amber',
  approved: 'teal',
  published: 'teal',
  rejected: 'red',
} as const;

function emptyDraft(organization: Organization): CompanyOpportunityDraft {
  return {
    title: '',
    description: '',
    category: 'Internship',
    opportunityType: '',
    province: organization.province ?? '',
    location: '',
    closingDate: '',
    qualification: 'Any level',
    requirements: '',
    applicationUrl: '',
    isRemote: false,
  };
}

function draftFromListing(listing: Opportunity): CompanyOpportunityDraft {
  return {
    title: listing.title,
    description: listing.summary,
    category: listing.category,
    opportunityType: listing.field,
    province: listing.province === 'National' ? 'Nationwide' : listing.province,
    location: listing.location,
    closingDate: listing.closingDate,
    qualification: listing.education,
    requirements: listing.eligibilityCriteria ?? '',
    applicationUrl: listing.applicationUrl ?? '',
    isRemote: listing.isRemote,
  };
}

export function CompanyListings({
  organization,
  canManage,
}: {
  organization: Organization;
  canManage: boolean;
}) {
  const { user } = useAuth();
  const { showToast } = useApp();
  const router = useRouter();

  const [listings, setListings] = useState<Opportunity[]>([]);
  const [applications, setApplications] = useState<CompanyApplication[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CompanyOpportunityDraft>(() => emptyDraft(organization));
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyApplication, setBusyApplication] = useState<string | null>(null);

  const isApproved = organization.status === 'approved';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [listingResult, applicationResult, notificationResult] = await Promise.allSettled([
      organizationService.listOrganizationOpportunities(organization.id),
      organizationService.listCompanyApplications(organization.id),
      user ? notificationService.listNotifications(user.id) : Promise.resolve([]),
    ]);

    if (listingResult.status === 'fulfilled') setListings(listingResult.value);
    else setError(errorMessage(listingResult.reason));

    if (applicationResult.status === 'fulfilled') setApplications(applicationResult.value);
    else setError(errorMessage(applicationResult.reason));

    if (notificationResult.status === 'fulfilled') {
      setNotifications(notificationResult.value.slice(0, 5));
    } else {
      setNotifications([]);
    }

    setLoading(false);
  }, [organization.id, user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setFormOpen(false);
    setEditingId(null);
    setDraft(emptyDraft(organization));
    setFormError(null);
  }, [organization]);

  const publishedCount = useMemo(
    () => listings.filter((listing) => listing.status === 'published').length,
    [listings],
  );
  const pendingCount = useMemo(
    () => listings.filter((listing) => listing.status === 'pending').length,
    [listings],
  );

  const patchDraft = (patch: Partial<CompanyOpportunityDraft>) =>
    setDraft((current) => ({ ...current, ...patch }));

  const startCreate = () => {
    setEditingId(null);
    setDraft(emptyDraft(organization));
    setFormError(null);
    setFormOpen(true);
  };

  const startEdit = (listing: Opportunity) => {
    setEditingId(listing.id);
    setDraft(draftFromListing(listing));
    setFormError(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setFormError(null);
  };

  const save = async () => {
    if (!canManage) return;
    if (draft.title.trim().length < 3) {
      setFormError('Enter a title of at least 3 characters.');
      return;
    }
    if (draft.description.trim().length < 20) {
      setFormError('Add a description of at least 20 characters so students know what to expect.');
      return;
    }
    if (draft.closingDate && !/^\d{4}-\d{2}-\d{2}$/.test(draft.closingDate.trim())) {
      setFormError('Use the closing date format YYYY-MM-DD.');
      return;
    }
    if (
      draft.applicationUrl &&
      !/^https?:\/\/\S+$/i.test(draft.applicationUrl.trim())
    ) {
      setFormError('The application link must start with http:// or https://.');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      if (editingId) {
        await organizationService.updateCompanyOpportunity(editingId, draft);
        showToast('Listing updated and sent for review');
      } else {
        await organizationService.createCompanyOpportunity(organization.id, draft);
        showToast('Listing submitted for review');
      }
      closeForm();
      await load();
    } catch (caught) {
      setFormError(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (listing: Opportunity) => {
    setSubmitting(true);
    try {
      await organizationService.deleteCompanyOpportunity(listing.id);
      showToast(
        listing.status === 'approved' || listing.status === 'published'
          ? 'Listing withdrawn'
          : 'Listing deleted',
      );
      await load();
    } catch (caught) {
      showToast(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmRemove = (listing: Opportunity) => {
    const live = listing.status === 'approved' || listing.status === 'published';
    Alert.alert(
      live ? 'Withdraw this listing?' : 'Delete this listing?',
      live
        ? 'Students will no longer see it. Existing applications stay in your records.'
        : 'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: live ? 'Withdraw' : 'Delete',
          style: 'destructive',
          onPress: () => void remove(listing),
        },
      ],
    );
  };

  const changeApplicationStatus = async (
    application: CompanyApplication,
    status: ApplicationStatus,
  ) => {
    setBusyApplication(application.id);
    try {
      await organizationService.setCompanyApplicationStatus(application.id, status);
      showToast(`Applicant marked as ${status.toLowerCase()}`);
      await load();
    } catch (caught) {
      showToast(errorMessage(caught));
    } finally {
      setBusyApplication(null);
    }
  };

  return (
    <>
      <SectionHeader
        title="Company dashboard"
        subtitle="Your listings, applicants and verification at a glance"
      />
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{listings.length}</Text>
          <Text style={styles.statLabel}>Listings</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{publishedCount}</Text>
          <Text style={styles.statLabel}>Published</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{pendingCount}</Text>
          <Text style={styles.statLabel}>In review</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{applications.length}</Text>
          <Text style={styles.statLabel}>Applicants</Text>
        </View>
      </View>

      {!isApproved ? (
        <View style={styles.noticeCard}>
          <Feather name="shield" size={16} color={colors.amber700} />
          <Text style={styles.noticeText}>
            {organization.status === 'pending'
              ? 'Your company is waiting for approval. You can prepare your profile now; publishing opens once an administrator approves it.'
              : organization.status === 'suspended'
                ? 'Your company is suspended, so publishing is paused. Contact an administrator to resolve the outstanding issue.'
                : 'This registration was rejected. Update your details and contact an administrator if you believe this is a mistake.'}
          </Text>
        </View>
      ) : null}

      <SectionHeader
        title={`Listings (${listings.length})`}
        subtitle="Opportunities published under your company"
        actionLabel={
          canManage && isApproved && !formOpen
            ? editingId
              ? undefined
              : 'New listing'
            : undefined
        }
        onAction={canManage && isApproved && !formOpen ? startCreate : undefined}
      />

      {formOpen ? (
        <View style={styles.card}>
          <Text style={styles.formTitle}>
            {editingId ? 'Edit listing' : 'Create an opportunity'}
          </Text>
          <Text style={styles.formSubtitle}>
            New and edited listings are reviewed by an administrator before they go live.
          </Text>

          <FormField
            label="Title"
            value={draft.title}
            onChangeText={(title) => patchDraft({ title })}
            placeholder="e.g. 2027 Graduate Agronomy Programme"
            autoCapitalize="sentences"
            maxLength={300}
          />
          <FormField
            label="Description"
            value={draft.description}
            onChangeText={(description) => patchDraft({ description })}
            placeholder="What the opportunity involves, who it suits and how to apply"
            multiline
            maxLength={5000}
          />

          <View style={styles.chipBlock}>
            <Text style={styles.chipLabel}>Category</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              {COMPANY_CATEGORIES.map((category) => (
                <Chip
                  key={category}
                  label={category}
                  active={draft.category === category}
                  onPress={() => patchDraft({ category })}
                />
              ))}
            </ScrollView>
          </View>

          <FormField
            label="Opportunity type"
            value={draft.opportunityType}
            onChangeText={(opportunityType) => patchDraft({ opportunityType })}
            placeholder="e.g. Agronomy, Livestock, AgriTech"
          />
          <FormField
            label="Location"
            value={draft.location}
            onChangeText={(location) => patchDraft({ location })}
            placeholder="Town or farm"
          />

          <View style={styles.chipBlock}>
            <Text style={styles.chipLabel}>Province</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              {PROVINCES.map((province) => (
                <Chip
                  key={province}
                  label={province}
                  active={draft.province === province}
                  onPress={() =>
                    patchDraft({ province: draft.province === province ? '' : province })
                  }
                />
              ))}
            </ScrollView>
          </View>

          <FormField
            label="Closing date"
            value={draft.closingDate}
            onChangeText={(closingDate) => patchDraft({ closingDate })}
            placeholder="YYYY-MM-DD"
            keyboardType="numbers-and-punctuation"
            hint="Leave blank if there is no closing date."
          />

          <View style={styles.chipBlock}>
            <Text style={styles.chipLabel}>Minimum qualification</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              {EDUCATION_LEVELS.map((level) => (
                <Chip
                  key={level}
                  label={level}
                  active={draft.qualification === level}
                  onPress={() => patchDraft({ qualification: level })}
                />
              ))}
            </ScrollView>
          </View>

          <FormField
            label="Requirements"
            value={draft.requirements}
            onChangeText={(requirements) => patchDraft({ requirements })}
            placeholder="One requirement per line"
            multiline
            maxLength={3000}
          />
          <FormField
            label="Application link"
            value={draft.applicationUrl}
            onChangeText={(applicationUrl) => patchDraft({ applicationUrl })}
            placeholder="https://…"
            keyboardType="url"
            autoCapitalize="none"
            hint="Students use this link to apply. Add any extra instructions to the description."
          />

          {formError ? <Text style={styles.formError}>{formError}</Text> : null}

          <View style={styles.formActions}>
            <Button
              title="Cancel"
              variant="secondary"
              onPress={closeForm}
              disabled={submitting}
            />
            <Button
              title={editingId ? 'Save changes' : 'Submit for review'}
              onPress={() => void save()}
              loading={submitting}
              disabled={submitting}
            />
          </View>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.inlineLoading}>
          <ActivityIndicator color={colors.teal700} size="small" />
        </View>
      ) : error ? (
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Could not load company activity</Text>
          <Text style={styles.infoBody}>{error}</Text>
          <Button title="Try again" variant="secondary" onPress={() => void load()} />
        </View>
      ) : listings.length === 0 ? (
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>No listings yet</Text>
          <Text style={styles.infoBody}>
            {isApproved
              ? 'Create your first opportunity. It will be reviewed by an administrator before students can see it.'
              : 'Once an administrator approves your company, you can create internships, learnerships, bursaries and other opportunities here.'}
          </Text>
          {canManage && isApproved ? (
            <Button
              title="Create your first listing"
              icon="plus"
              onPress={startCreate}
            />
          ) : null}
        </View>
      ) : (
        <View style={styles.list}>
          {listings.map((listing) => {
            const live = listing.status === 'published';
            return (
              <View key={listing.id} style={styles.listingCard}>
                <View style={styles.listingTop}>
                  <View style={styles.listingCopy}>
                    <Text style={styles.listingTitle}>{listing.title}</Text>
                    <Text style={styles.listingMeta}>
                      {listing.category}
                      {listing.closingDate
                        ? ` · closes ${formatShortDate(listing.closingDate)}`
                        : ' · no closing date'}
                    </Text>
                  </View>
                  <Chip
                    label={listing.status ?? 'pending'}
                    tone={STATUS_TONE[listing.status ?? 'pending']}
                  />
                </View>

                {listing.status === 'rejected' ? (
                  <Text style={styles.listingHint}>
                    This listing was not approved. Edit it and resubmit for review.
                  </Text>
                ) : live ? (
                  <Text style={styles.listingHint}>
                    Published and visible to students. Editing sends it back for review.
                  </Text>
                ) : (
                  <Text style={styles.listingHint}>
                    Visible to your company and reviewers until it is published.
                  </Text>
                )}

                {canManage ? (
                  <View style={styles.actionRow}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${listing.title}`}
                      onPress={() => startEdit(listing)}
                      style={({ pressed }) => [styles.inlineAction, pressed && styles.pressed]}
                    >
                      <Feather name="edit-2" size={14} color={colors.teal700} />
                      <Text style={styles.inlineActionText}>Edit</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={
                        listing.status === 'approved' || listing.status === 'published'
                          ? `Withdraw ${listing.title}`
                          : `Delete ${listing.title}`
                      }
                      onPress={() => confirmRemove(listing)}
                      style={({ pressed }) => [styles.inlineAction, pressed && styles.pressed]}
                    >
                      <Feather
                        name={
                          listing.status === 'approved' || listing.status === 'published'
                            ? 'slash'
                            : 'trash-2'
                        }
                        size={14}
                        color={colors.red700}
                      />
                      <Text style={[styles.inlineActionText, styles.dangerText]}>
                        {listing.status === 'approved' || listing.status === 'published'
                          ? 'Withdraw'
                          : 'Delete'}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}

      <SectionHeader
        title={`Applicants (${applications.length})`}
        subtitle="Students who saved or applied to your opportunities"
      />
      {loading ? (
        <View style={styles.inlineLoading}>
          <ActivityIndicator color={colors.teal700} size="small" />
        </View>
      ) : applications.length === 0 ? (
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>No applications yet</Text>
          <Text style={styles.infoBody}>
            When students apply to your published listings they appear here. You can then
            shortlist, invite to interview, make an offer or reject them.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {applications.map((application) => {
            const busy = busyApplication === application.id;
            return (
              <View key={application.id} style={styles.applicationCard}>
                <View style={styles.listingTop}>
                  <View style={styles.listingCopy}>
                    <Text style={styles.applicantName}>{application.applicantName}</Text>
                    <Text style={styles.listingMeta}>{application.opportunityTitle}</Text>
                  </View>
                  <Chip
                    label={application.status}
                    tone={
                      application.status === 'Rejected'
                        ? 'red'
                        : application.status === 'Offered'
                          ? 'teal'
                          : 'amber'
                    }
                  />
                </View>
                <Text style={styles.applicationMeta}>
                  {[application.applicantEmail, application.applicantPhone]
                    .filter(Boolean)
                    .join(' · ') || 'No contact details shared'}
                </Text>
                {application.notes ? (
                  <Text style={styles.applicationNotes}>{application.notes}</Text>
                ) : null}

                {canManage && isApproved ? (
                  <View style={styles.applicationActions}>
                    {APPLICATION_ACTIONS.filter(
                      (action) => action.status !== application.status,
                    ).map((action) => (
                      <Pressable
                        key={action.status}
                        accessibilityRole="button"
                        disabled={busy}
                        onPress={() => void changeApplicationStatus(application, action.status)}
                        style={({ pressed }) => [
                          styles.statusButton,
                          action.tone === 'red' && styles.statusButtonDanger,
                          pressed && styles.pressed,
                          busy && styles.disabled,
                        ]}
                      >
                        {busy ? (
                          <ActivityIndicator size="small" color={colors.teal700} />
                        ) : (
                          <Text
                            style={[
                              styles.statusButtonText,
                              action.tone === 'red' && styles.dangerText,
                            ]}
                          >
                            {action.label}
                          </Text>
                        )}
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}

      <SectionHeader
        title="Notifications"
        subtitle="Updates for the person managing this company account"
      />
      {notifications.length === 0 ? (
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>No notifications</Text>
          <Text style={styles.infoBody}>
            Review results and platform updates for your account will appear here.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {notifications.map((notification) => (
            <View key={notification.id} style={styles.notificationRow}>
              <View style={styles.notificationIcon}>
                <Feather
                  name={notification.unread ? 'bell' : 'check'}
                  size={14}
                  color={colors.teal700}
                />
              </View>
              <View style={styles.listingCopy}>
                <Text style={styles.notificationTitle}>{notification.title}</Text>
                <Text style={styles.notificationBody}>{notification.body}</Text>
                <Text style={styles.listingMeta}>{notification.time}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <SectionHeader
        title="Account"
        subtitle="Contact details, notifications and app preferences"
      />
      <Button
        title="Open account settings"
        icon="settings"
        variant="secondary"
        onPress={() => router.push('/settings')}
      />
    </>
  );
}

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statCard: {
    flexGrow: 1,
    minWidth: 72,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    ...type.h2,
    fontSize: 20,
    color: colors.teal700,
  },
  statLabel: {
    ...type.caption,
    color: colors.muted,
  },
  noticeCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    marginTop: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.amber100,
  },
  noticeText: {
    flex: 1,
    ...type.small,
    color: colors.amber700,
    lineHeight: 18,
  },
  card: {
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    gap: spacing.md,
  },
  formTitle: {
    ...type.h3,
    color: colors.navy900,
  },
  formSubtitle: {
    ...type.small,
    color: colors.muted,
    marginTop: -spacing.sm,
  },
  chipBlock: {
    gap: spacing.xs,
  },
  chipLabel: {
    ...type.caption,
    color: colors.muted,
    fontWeight: '700',
  },
  chipRow: {
    gap: spacing.xs,
    paddingRight: spacing.sm,
  },
  formError: {
    ...type.small,
    color: colors.red700,
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  inlineLoading: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  infoCard: {
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  infoTitle: {
    ...type.bodyStrong,
    color: colors.navy900,
  },
  infoBody: {
    ...type.small,
    color: colors.muted,
    lineHeight: 18,
  },
  list: {
    gap: spacing.sm,
  },
  listingCard: {
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  listingTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  listingCopy: {
    flex: 1,
    gap: 2,
  },
  listingTitle: {
    ...type.bodyStrong,
    color: colors.navy900,
  },
  listingMeta: {
    ...type.caption,
    color: colors.muted,
  },
  listingHint: {
    ...type.caption,
    color: colors.muted,
    lineHeight: 16,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  inlineAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.xs,
  },
  inlineActionText: {
    ...type.small,
    color: colors.teal700,
    fontWeight: '700',
  },
  dangerText: {
    color: colors.red700,
  },
  applicationCard: {
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  applicantName: {
    ...type.bodyStrong,
    color: colors.navy900,
  },
  applicationMeta: {
    ...type.small,
    color: colors.muted,
  },
  applicationNotes: {
    ...type.small,
    color: colors.ink,
    lineHeight: 18,
  },
  applicationActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  statusButton: {
    minHeight: 34,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.teal100,
    backgroundColor: colors.teal50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusButtonDanger: {
    borderColor: colors.red50,
    backgroundColor: colors.red50,
  },
  statusButtonText: {
    ...type.small,
    color: colors.teal700,
    fontWeight: '700',
  },
  notificationRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  notificationIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.teal50,
  },
  notificationTitle: {
    ...type.bodyStrong,
    color: colors.navy900,
  },
  notificationBody: {
    ...type.small,
    color: colors.muted,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.65,
  },
  disabled: {
    opacity: 0.5,
  },
});
