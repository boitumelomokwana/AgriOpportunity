import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';

import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { FormField } from '@/components/FormField';
import { SectionHeader } from '@/components/SectionHeader';
import { colors, radius, spacing, type } from '@/constants/theme';
import { errorMessage } from '@/lib/errors';
import {
  computeMatch,
  opportunityService,
} from '@/services/opportunityService';
import { discoveryService } from '@/services/discoveryService';
import { useAuth } from '@/state/AuthProvider';
import { useApp } from '@/state/AppProvider';
import type { IconName, Opportunity, ReportReason } from '@/types';
import { closingLabel, closingTone, matchLabel } from '@/utils/format';

const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'expired', label: 'Expired' },
  { value: 'incorrect_information', label: 'Incorrect info' },
  { value: 'broken_link', label: 'Broken link' },
  { value: 'scam', label: 'Looks like a scam' },
  { value: 'other', label: 'Other' },
];

function MetaItem({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={styles.metaItem}>
      <Feather name={icon} size={15} color={colors.muted} />
      <Text style={styles.metaText}>{text}</Text>
    </View>
  );
}

export default function OpportunityDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const {
    opportunities,
    profile,
    isSignedIn,
    isSaved,
    toggleSaved,
    applications,
    addApplication,
    reminders,
    setReminder,
    removeReminder,
    showToast,
  } = useApp();

  const fromList = useMemo(
    () => opportunities.find((item) => item.id === id),
    [opportunities, id],
  );
  const [fetched, setFetched] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(!fromList);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason>('incorrect_information');
  const [reportDetails, setReportDetails] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const viewRecorded = useRef(false);

  useEffect(() => {
    if (fromList) {
      setFetched(null);
      setLoading(false);
      setLoadError(null);
      return;
    }
    if (!id) return;
    let active = true;
    setLoading(true);
    setLoadError(null);
    void opportunityService
      .fetchOpportunityById(id)
      .then((result) => {
        if (!active) return;
        setFetched(result);
        if (!result) setLoadError('This opportunity could not be found.');
      })
      .catch((error) => {
        if (active) setLoadError(errorMessage(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, fromList]);

  const opportunity = fromList ?? fetched;
  const match = useMemo(
    () => (opportunity ? computeMatch(opportunity, profile) : null),
    [opportunity, profile],
  );

  useEffect(() => {
    if (!opportunity || viewRecorded.current) return;
    viewRecorded.current = true;
    void opportunityService.recordOpportunityView(opportunity.id, 'app_detail');
  }, [opportunity]);

  if (loading) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
        <AppHeader onBack={() => router.back()} />
        <View style={styles.emptyWrap}>
          <Text style={styles.loadingText}>Loading opportunity…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!opportunity) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
        <AppHeader onBack={() => router.back()} />
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="alert-circle"
            title="Opportunity unavailable"
            message={loadError ?? 'This listing may have been removed or is awaiting review.'}
            actionLabel="Back to explore"
            onAction={() => router.replace('/explore')}
          />
        </View>
      </SafeAreaView>
    );
  }

  const saved = isSaved(opportunity.id);
  const application = applications.find(
    (record) => record.opportunityId === opportunity.id,
  );
  const reminder = reminders.find(
    (record) => record.opportunityId === opportunity.id,
  );
  const tone = closingTone(opportunity);
  const expired = Boolean(opportunity.isExpired);
  const score = match?.score ?? opportunity.match;
  const reasons = match?.reasons ?? opportunity.matchReasons ?? [];
  const applyUrl = opportunity.applicationUrl || opportunity.sourceUrl;

  const openSource = async () => {
    if (!applyUrl) {
      showToast('No application link was provided for this listing.');
      return;
    }
    // Legacy listings sometimes store "www.example.co.za" without a scheme.
    const url = /^[a-z][a-z0-9+.-]*:\/\//i.test(applyUrl)
      ? applyUrl
      : `https://${applyUrl}`;
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      showToast('That link could not be opened on this device.');
    }
  };

  const submitReport = async () => {
    if (!user) {
      showToast('Sign in to report a listing.');
      return;
    }
    setSubmittingReport(true);
    try {
      await discoveryService.reportOpportunity(
        user.id,
        opportunity.id,
        reportReason,
        reportDetails,
      );
      setShowReport(false);
      setReportDetails('');
      showToast('Thanks — a moderator will review this listing.');
    } catch (error) {
      showToast(errorMessage(error));
    } finally {
      setSubmittingReport(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
      <AppHeader
        onBack={() => router.back()}
        action={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={saved ? 'Remove from saved' : 'Save opportunity'}
            onPress={() => void toggleSaved(opportunity.id)}
            hitSlop={8}
            style={({ pressed }) => [
              styles.saveButton,
              saved && styles.saveButtonActive,
              pressed && styles.pressed,
            ]}
          >
            <Feather
              name="bookmark"
              size={18}
              color={saved ? colors.teal700 : colors.muted}
            />
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.categoryPill}>
              <Text style={styles.categoryText}>{opportunity.category}</Text>
            </View>
            {expired ? (
              <View style={[styles.tonePill, styles.tonePillExpired]}>
                <Text style={[styles.toneText, styles.toneTextExpired]}>Expired</Text>
              </View>
            ) : (
              <View style={[styles.tonePill, tone === 'urgent' && styles.tonePillStrong]}>
                <Text
                  style={[styles.toneText, tone === 'urgent' ? styles.toneTextStrong : null]}
                >
                  {closingLabel(opportunity)}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.title}>{opportunity.title}</Text>
          <View style={styles.organisationRow}>
            <Text style={styles.organisation}>{opportunity.organisation}</Text>
            {opportunity.organizationVerified ? (
              <View style={styles.verifiedPill}>
                <Feather name="check-circle" size={11} color={colors.teal700} />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            ) : null}
          </View>
          {!expired ? (
            <View style={styles.matchRow}>
              <View style={styles.matchPill}>
                <Feather name="target" size={13} color={colors.navy800} />
                <Text style={styles.matchText}>{score}% match</Text>
              </View>
              <Text style={styles.matchLabel}>{matchLabel(score)}</Text>
            </View>
          ) : null}
          <View style={styles.metaGrid}>
            <MetaItem icon="map-pin" text={opportunity.location} />
            <MetaItem icon="book-open" text={opportunity.education} />
            <MetaItem icon="grid" text={opportunity.field} />
            <MetaItem icon="monitor" text={opportunity.mode} />
          </View>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryHeading}>About this opportunity</Text>
          <Text style={styles.summaryBody}>{opportunity.summary}</Text>
        </View>

        {reasons.length > 0 ? (
          <>
            <SectionHeader
              title="Why this matched"
              subtitle="Every point is explained"
            />
            <View style={styles.listCard}>
              {reasons.map((reason) => (
                <View key={reason} style={styles.listRow}>
                  <View style={styles.bullet}>
                    <Feather name="target" size={13} color={colors.teal700} />
                  </View>
                  <Text style={styles.listText}>{reason}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        <SectionHeader title="Eligibility" subtitle="Check every requirement before applying" />
        <View style={styles.listCard}>
          {opportunity.eligibility.map((item) => (
            <View key={item} style={styles.listRow}>
              <View style={styles.bullet}>
                <Feather name="check" size={13} color={colors.teal700} />
              </View>
              <Text style={styles.listText}>{item}</Text>
            </View>
          ))}
        </View>

        <SectionHeader title="Documents" subtitle="Prepare these before applying" />
        <View style={styles.listCard}>
          {opportunity.documents.length === 0 ? (
            <Text style={styles.listText}>
              The provider has not listed specific documents. Check the official
              application page for the exact requirements.
            </Text>
          ) : (
            opportunity.documents.map((document) => (
              <View key={document} style={styles.listRow}>
                <View style={[styles.bullet, styles.bulletBlue]}>
                  <Feather name="file-text" size={13} color={colors.navy800} />
                </View>
                <Text style={styles.listText}>{document}</Text>
              </View>
            ))
          )}
        </View>

        <SectionHeader title="How to apply" subtitle="Follow the official steps" />
        <View style={styles.listCard}>
          {opportunity.howToApply.map((step, index) => (
            <View key={step} style={styles.listRow}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{index + 1}</Text>
              </View>
              <Text style={styles.listText}>{step}</Text>
            </View>
          ))}
        </View>

        <SectionHeader title="Dates" />
        <View style={styles.dateCard}>
          <View style={styles.gridColumn}>
            <Text style={styles.gridLabel}>Closes</Text>
            <Text style={[styles.gridValue, expired && styles.gridValueMuted]}>
              {opportunity.closes}
            </Text>
          </View>
          <View style={styles.gridColumn}>
            <Text style={styles.gridLabel}>Applications</Text>
            <Text style={styles.gridValue}>{expired ? 'Closed' : 'Open'}</Text>
          </View>
          <View style={styles.gridColumn}>
            <Text style={styles.gridLabel}>Source updated</Text>
            <Text style={styles.gridValue}>{opportunity.lastUpdated}</Text>
          </View>
        </View>

        <SectionHeader title="Where this came from" subtitle="Listing provenance" />
        <View style={styles.sourceCard}>
          <View style={styles.sourceRow}>
            <Feather name="external-link" size={16} color={colors.teal700} />
            <Text style={styles.sourceName}>{opportunity.sourceName}</Text>
          </View>
          <Text style={styles.sourceText}>
            {opportunity.sourceUrl || 'No source link supplied'}
          </Text>
        </View>

        <View style={styles.actions}>
          {expired ? (
            <Button
              title="This listing has closed"
              variant="secondary"
              icon="clock"
              fullWidth
              disabled
            />
          ) : application ? (
            <Button
              title="View in tracker"
              icon="clipboard"
              fullWidth
              onPress={() => router.push('/applications')}
            />
          ) : (
            <Button
              title="Track this application"
              icon="clipboard"
              fullWidth
              onPress={() => void addApplication(opportunity.id)}
            />
          )}
          {!expired ? (
            <Button
              title="Open official application page"
              variant="secondary"
              icon="external-link"
              fullWidth
              onPress={() => void openSource()}
            />
          ) : null}
          {!expired ? (
            <Button
              title={
                reminder
                  ? `Reminder set (${reminder.daysBefore} days before)`
                  : 'Remind me before it closes'
              }
              variant={reminder ? 'secondary' : 'text'}
              icon="bell"
              fullWidth
              onPress={() =>
                void (reminder
                  ? removeReminder(opportunity.id)
                  : setReminder(opportunity.id, 7))
              }
            />
          ) : null}
          <Button
            title={saved ? 'Remove from saved' : 'Save for later'}
            variant={saved ? 'secondary' : 'text'}
            icon="bookmark"
            fullWidth
            onPress={() => void toggleSaved(opportunity.id)}
          />
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            if (!isSignedIn) {
              showToast('Sign in to report a listing.');
              return;
            }
            setShowReport((current) => !current);
          }}
          style={({ pressed }) => [styles.reportLink, pressed && styles.pressed]}
        >
          <Feather name="flag" size={14} color={colors.muted} />
          <Text style={styles.reportLinkText}>Report incorrect or expired listing</Text>
        </Pressable>

        {showReport ? (
          <View style={styles.reportCard}>
            <Text style={styles.reportTitle}>What is wrong?</Text>
            <View style={styles.reportChips}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {REPORT_REASONS.map((reason) => (
                  <Chip
                    key={reason.value}
                    label={reason.label}
                    active={reportReason === reason.value}
                    onPress={() => setReportReason(reason.value)}
                  />
                ))}
              </ScrollView>
            </View>
            <FormField
              label="Details (optional)"
              value={reportDetails}
              onChangeText={setReportDetails}
              placeholder="Tell us what you noticed"
              multiline
              maxLength={1000}
            />
            <Button
              title="Submit report"
              loading={submittingReport}
              onPress={() => void submitReport()}
            />
          </View>
        ) : null}

        <Text style={styles.footerNote}>
          Always confirm requirements and deadlines on the official listing.
          AgriOpportunities does not submit applications on your behalf.
        </Text>
      </ScrollView>
    </SafeAreaView>
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
  loadingText: {
    ...type.body,
    color: colors.muted,
    textAlign: 'center',
  },
  saveButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonActive: {
    backgroundColor: colors.teal50,
    borderColor: colors.teal100,
  },
  pressed: {
    opacity: 0.7,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  categoryPill: {
    backgroundColor: colors.teal50,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  categoryText: {
    ...type.label,
    fontSize: 11,
    textTransform: 'none',
    letterSpacing: 0,
  },
  tonePill: {
    backgroundColor: colors.amber100,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  tonePillStrong: {
    backgroundColor: colors.red50,
  },
  tonePillExpired: {
    backgroundColor: colors.surfaceSoft,
  },
  toneText: {
    fontFamily: type.bodyStrong.fontFamily,
    fontSize: 11,
    fontWeight: '700',
    color: colors.amber700,
  },
  toneTextStrong: {
    color: colors.red700,
  },
  toneTextExpired: {
    color: colors.muted,
  },
  title: {
    ...type.h1,
    fontSize: 25,
  },
  organisationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  organisation: {
    ...type.body,
    color: colors.muted,
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.teal50,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  verifiedText: {
    ...type.caption,
    color: colors.teal700,
    fontWeight: '700',
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  matchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.blue50,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  matchText: {
    fontFamily: type.bodyStrong.fontFamily,
    fontSize: 11,
    fontWeight: '700',
    color: colors.navy800,
  },
  matchLabel: {
    ...type.small,
  },
  metaGrid: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
  },
  metaText: {
    ...type.small,
    flexShrink: 1,
  },
  summaryCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.navy950,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  summaryHeading: {
    ...type.h3,
    color: colors.white,
  },
  summaryBody: {
    ...type.body,
    color: colors.teal100,
  },
  listCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    gap: spacing.md,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  bullet: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.teal50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  bulletBlue: {
    backgroundColor: colors.blue50,
  },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.navy950,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumberText: {
    fontFamily: type.bodyStrong.fontFamily,
    fontSize: 12,
    fontWeight: '800',
    color: colors.teal600,
  },
  listText: {
    ...type.body,
    flex: 1,
  },
  dateCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
  },
  gridColumn: {
    gap: 2,
    minWidth: '44%',
  },
  gridLabel: {
    ...type.caption,
  },
  gridValue: {
    ...type.bodyStrong,
  },
  gridValueMuted: {
    color: colors.muted,
  },
  sourceCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sourceName: {
    ...type.bodyStrong,
    color: colors.teal700,
    flex: 1,
  },
  sourceText: {
    ...type.caption,
  },
  actions: {
    marginTop: spacing.xxl,
    gap: spacing.md,
  },
  reportLink: {
    marginTop: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  reportLinkText: {
    ...type.caption,
    color: colors.muted,
    textDecorationLine: 'underline',
  },
  reportCard: {
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    gap: spacing.md,
  },
  reportTitle: {
    ...type.bodyStrong,
  },
  reportChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  footerNote: {
    ...type.caption,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
