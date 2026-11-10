import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';

import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { SectionHeader } from '@/components/SectionHeader';
import { colors, radius, spacing, type } from '@/constants/theme';
import { useApp } from '@/state/AppProvider';
import type { IconName } from '@/types';
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

  if (!opportunity) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
        <AppHeader onBack={() => router.back()} />
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="alert-circle"
            title="Opportunity unavailable"
            message="This illustrative listing could not be found. It may have been removed from the demo data."
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
  const tone = closingTone(opportunity);
  const expired = Boolean(opportunity.isExpired);

  const openSource = async () => {
    await WebBrowser.openBrowserAsync(opportunity.sourceUrl);
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
      <AppHeader
        onBack={() => router.back()}
        action={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={saved ? 'Remove from saved' : 'Save opportunity'}
            onPress={() => toggleSaved(opportunity.id)}
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
          <Text style={styles.organisation}>{opportunity.organisation}</Text>
          {!expired ? (
            <View style={styles.matchRow}>
              <View style={styles.matchPill}>
                <Feather name="target" size={13} color={colors.navy800} />
                <Text style={styles.matchText}>{opportunity.match}% match</Text>
              </View>
              <Text style={styles.matchLabel}>{matchLabel(opportunity.match)}</Text>
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
              No documents listed for this illustrative entry.
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

        <SectionHeader title="How to apply" subtitle="Steps you can follow locally" />
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
            <Text style={styles.gridValue}>{expired ? 'Closed (demo)' : 'Open (demo)'}</Text>
          </View>
          <View style={styles.gridColumn}>
            <Text style={styles.gridLabel}>Source updated</Text>
            <Text style={styles.gridValue}>{opportunity.lastUpdated}</Text>
          </View>
        </View>

        <SectionHeader title="Where this came from" subtitle="Demo data provenance" />
        <View style={styles.sourceCard}>
          <View style={styles.sourceRow}>
            <Feather name="external-link" size={16} color={colors.teal700} />
            <Text style={styles.sourceName}>{opportunity.sourceName}</Text>
          </View>
          <Text style={styles.sourceText}>{opportunity.sourceUrl}</Text>
        </View>

        <View style={styles.actions}>
          {expired ? (
            <Button
              title="Demo: this listing has closed"
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
              onPress={() => addApplication(opportunity.id)}
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
            onPress={() => toggleSaved(opportunity.id)}
          />
          <Text style={styles.demoNote}>
            Frontend demo — no application is sent to any organisation. Tracking
            only records progress on this device.
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
