import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';

import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { SectionHeader } from '@/components/SectionHeader';
import { colors, radius, spacing, type } from '@/constants/theme';
import { opportunityService } from '@/services/opportunityService';
import { useApp } from '@/state/AppProvider';
import type { IconName, Opportunity } from '@/types';
import { closingLabel, closingTone, matchLabel } from '@/utils/format';

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
  const { opportunities, isSaved, toggleSaved, applications, addApplication, showToast } =
    useApp();

  const opportunity = useMemo(
    () => opportunities.find((item) => item.id === id),
    [opportunities, id],
  );
  const [fetched, setFetched] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (opportunity || !id) return;
    let active = true;
    setLoading(true);
    setLoadError(null);
    void opportunityService
      .getOpportunityById(id)
      .then((record) => {
        if (!active) return;
        if (record) setFetched(record);
        else setLoadError('not-found');
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load this opportunity.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, opportunity]);

  const record = opportunity ?? fetched;

  if (!record && loading) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
        <AppHeader onBack={() => router.back()} />
        <View style={styles.emptyWrap}>
          <ActivityIndicator size="large" color={colors.teal700} />
          <Text style={styles.loadingText}>Loading opportunity…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!record) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
        <AppHeader onBack={() => router.back()} />
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="alert-circle"
            title="Opportunity unavailable"
            message={
              loadError === 'not-found'
                ? 'This opportunity could not be found. It may have been removed or is no longer published.'
                : loadError ?? 'Unable to load this opportunity.'
            }
            actionLabel="Back to explore"
            onAction={() => router.replace('/explore')}
          />
        </View>
      </SafeAreaView>
    );
  }

  const saved = isSaved(record.id);
  const application = applications.find(
    (item) => item.opportunityId === record.id,
  );
  const tone = closingTone(record);
  const expired = Boolean(record.isExpired);

  const openSource = async () => {
    await WebBrowser.openBrowserAsync(record.sourceUrl);
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
      <AppHeader
        onBack={() => router.back()}
        action={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={saved ? 'Remove from saved' : 'Save opportunity'}
            onPress={() => toggleSaved(record.id)}
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
              <Text style={styles.categoryText}>{record.category}</Text>
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
                  {closingLabel(record)}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.title}>{record.title}</Text>
          <Text style={styles.organisation}>{record.organisation}</Text>
          {!expired ? (
            <View style={styles.matchRow}>
              <View style={styles.matchPill}>
                <Feather name="target" size={13} color={colors.navy800} />
                <Text style={styles.matchText}>{record.match}% match</Text>
              </View>
              <Text style={styles.matchLabel}>{matchLabel(record.match)}</Text>
            </View>
          ) : null}
          <View style={styles.metaGrid}>
            <MetaItem icon="map-pin" text={record.location} />
            <MetaItem icon="book-open" text={record.education} />
            <MetaItem icon="grid" text={record.field} />
            <MetaItem icon="monitor" text={record.mode} />
          </View>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryHeading}>About this opportunity</Text>
          <Text style={styles.summaryBody}>{record.summary}</Text>
        </View>

        <SectionHeader title="Eligibility" subtitle="Check every requirement before applying" />
        <View style={styles.listCard}>
          {record.eligibility.map((item) => (
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
          {record.documents.length === 0 ? (
            <Text style={styles.listText}>
              No documents listed for this opportunity.
            </Text>
          ) : (
            record.documents.map((document) => (
              <View key={document} style={styles.listRow}>
                <View style={[styles.bullet, styles.bulletBlue]}>
                  <Feather name="file-text" size={13} color={colors.navy800} />
                </View>
                <Text style={styles.listText}>{document}</Text>
              </View>
            ))
          )}
        </View>

        <SectionHeader title="How to apply" subtitle="Follow the official application process" />
        <View style={styles.listCard}>
          {record.howToApply.map((step, index) => (
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
              {record.closes}
            </Text>
          </View>
          <View style={styles.gridColumn}>
            <Text style={styles.gridLabel}>Applications</Text>
            <Text style={styles.gridValue}>{expired ? 'Closed' : 'Open'}</Text>
          </View>
          <View style={styles.gridColumn}>
            <Text style={styles.gridLabel}>Source updated</Text>
            <Text style={styles.gridValue}>{record.lastUpdated}</Text>
          </View>
        </View>

        <SectionHeader title="Where this came from" subtitle="Always confirm on the official source" />
        <View style={styles.sourceCard}>
          <View style={styles.sourceRow}>
            <Feather name="external-link" size={16} color={colors.teal700} />
            <Text style={styles.sourceName}>{record.sourceName}</Text>
          </View>
          <Text style={styles.sourceText}>{record.sourceUrl}</Text>
          <Text style={styles.sourceNote}>
            Seeded listings are illustrative demo data, not verified vacancies.
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
              onPress={() => addApplication(record.id)}
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
          <Button
            title={saved ? 'Remove from saved' : 'Save for later'}
            variant={saved ? 'secondary' : 'text'}
            icon="bookmark"
            fullWidth
            onPress={() => toggleSaved(record.id)}
          />
          <Text style={styles.demoNote}>
            Applications are completed on the official source. This tracker records
            your own progress and does not submit anything to the organisation.
          </Text>
        </View>
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
    gap: spacing.md,
  },
  loadingText: {
    ...type.small,
    textAlign: 'center',
    color: colors.muted,
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
  organisation: {
    ...type.body,
    color: colors.muted,
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
  sourceNote: {
    ...type.caption,
    color: colors.amber700,
  },
  actions: {
    marginTop: spacing.xxl,
    gap: spacing.md,
  },
  demoNote: {
    ...type.caption,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
