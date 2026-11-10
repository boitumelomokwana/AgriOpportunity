import { useRouter, useFocusEffect } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback } from 'react';
import { Feather } from '@expo/vector-icons';

import { AppHeader } from '@/components/AppHeader';
import { Brand } from '@/components/Brand';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { OpportunityCard } from '@/components/OpportunityCard';
import { SectionHeader } from '@/components/SectionHeader';
import { StatCard } from '@/components/StatCard';
import { colors, fonts, radius, shadows, spacing, type } from '@/constants/theme';
import { opportunityCategories } from '@/data/opportunities';
import {
  defaultFilters,
  getMatchingOpportunities,
  sortOpportunities,
} from '@/services/opportunityService';
import { useApp } from '@/state/AppProvider';
import { formatLongDate } from '@/utils/date';
import { chipToCategory } from '@/utils/format';

export default function HomeScreen() {
  const router = useRouter();
  const {
    profile,
    opportunities,
    opportunitiesLoading,
    opportunitiesError,
    reloadOpportunities,
    savedIds,
    applications,
    isSaved,
    toggleSaved,
    setExploreFilters,
  } = useApp();

  useFocusEffect(
    useCallback(() => {
      if (opportunities.length === 0 && !opportunitiesLoading && !opportunitiesError) {
        void reloadOpportunities();
      }
    }, [opportunities.length, opportunitiesLoading, opportunitiesError, reloadOpportunities]),
  );

  const matches = getMatchingOpportunities(opportunities).slice(0, 2);
  const closingSoon = sortOpportunities(opportunities, 'Closing soon')
    .filter((opportunity) => !opportunity.isExpired)
    .slice(0, 2);

  const firstName = profile.name.split(' ')[0];
  const activeApplications = applications.filter(
    (application) => application.status !== 'Outcome',
  ).length;

  const openExplore = (label: string) => {
    const category = chipToCategory(label);
    if (!category) return;
    setExploreFilters({ ...defaultFilters, types: [category] });
    router.push('/explore');
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AppHeader
          title={`Hi, ${firstName}`}
          subtitle={formatLongDate()}
          action={
            <View style={styles.headerActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Notifications"
                onPress={() => router.push('/alerts')}
                hitSlop={8}
                style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
              >
                <Feather name="bell" size={19} color={colors.navy900} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Profile"
                onPress={() => router.push('/profile')}
                hitSlop={8}
                style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}
              >
                <Text style={styles.avatarText}>{profile.initials}</Text>
              </Pressable>
            </View>
          }
        >
          <Brand compact />
        </AppHeader>

        <View style={styles.completionCard}>
          <View style={styles.completionHeader}>
            <View style={styles.completionIcon}>
              <Feather name="user-check" size={17} color={colors.white} />
            </View>
            <View style={styles.completionCopy}>
              <Text style={styles.completionTitle}>Profile {profile.completion}% complete</Text>
              <Text style={styles.completionBody}>
                Add your interests so we can suggest better matches.
              </Text>
            </View>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${profile.completion}%` }]} />
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/profile')}
            hitSlop={6}
            style={({ pressed }) => [styles.completionAction, pressed && styles.pressed]}
          >
            <Text style={styles.completionActionText}>Update profile</Text>
            <Feather name="arrow-right" size={14} color={colors.teal700} />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
          style={styles.categoryScroll}
        >
          {opportunityCategories.map((category) => (
            <Chip
              key={category.category}
              label={category.label}
              icon={category.icon}
              onPress={() => openExplore(category.label)}
            />
          ))}
        </ScrollView>

        <View style={styles.statRow}>
          <StatCard label="Open now" value={opportunities.length} icon="zap" tone="green" />
          <StatCard label="Saved" value={savedIds.length} icon="bookmark" tone="blue" />
          <StatCard label="Tracking" value={activeApplications} icon="clipboard" tone="amber" />
        </View>

        <SectionHeader
          title="Best matches for you"
          subtitle="Based on your study field and province"
          actionLabel="See all"
          onAction={() => router.push('/matches')}
        />
        {matches.length === 0 ? (
          <EmptyState
            icon="search"
            title="No matches yet"
            message="Once opportunities load and your profile is filled in, your best matches will appear here."
            actionLabel="Go to explore"
            onAction={() => router.push('/explore')}
          />
        ) : (
          <View style={styles.cardList}>
            {matches.map((opportunity) => (
              <OpportunityCard
                key={opportunity.id}
                opportunity={opportunity}
                saved={isSaved(opportunity.id)}
                onSave={() => toggleSaved(opportunity.id)}
                onOpen={() => router.push(`/opportunity/${opportunity.id}`)}
              />
            ))}
          </View>
        )}

        <SectionHeader
          title="Closing soon"
          subtitle="Apply before these close"
        />
        {closingSoon.length === 0 ? (
          <EmptyState
            icon="clock"
            title="Nothing closing soon"
            message="No opportunities are closing in the next few days. Check explore for what's open."
            actionLabel="Go to explore"
            onAction={() => router.push('/explore')}
          />
        ) : (
          <View style={styles.cardList}>
            {closingSoon.map((opportunity) => (
              <OpportunityCard
                key={opportunity.id}
                opportunity={opportunity}
                saved={isSaved(opportunity.id)}
                onSave={() => toggleSaved(opportunity.id)}
                onOpen={() => router.push(`/opportunity/${opportunity.id}`)}
              />
            ))}
          </View>
        )}

        <SectionHeader
          title="Your progress"
          subtitle="Kept on this device for the demo"
        />
        <View style={styles.linkList}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/applications')}
            style={({ pressed }) => [styles.linkCard, pressed && styles.pressed]}
          >
            <View style={[styles.linkIcon, styles.linkIconTeal]}>
              <Feather name="clipboard" size={17} color={colors.teal700} />
            </View>
            <View style={styles.linkCopy}>
              <Text style={styles.linkTitle}>Application tracker</Text>
              <Text style={styles.linkBody}>
                {applications.length} application{applications.length === 1 ? '' : 's'} being tracked
              </Text>
            </View>
            <Feather name="chevron-right" size={19} color={colors.muted} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/saved')}
            style={({ pressed }) => [styles.linkCard, pressed && styles.pressed]}
          >
            <View style={[styles.linkIcon, styles.linkIconBlue]}>
              <Feather name="bookmark" size={17} color={colors.navy800} />
            </View>
            <View style={styles.linkCopy}>
              <Text style={styles.linkTitle}>Saved opportunities</Text>
              <Text style={styles.linkBody}>
                {savedIds.length} saved for later
              </Text>
            </View>
            <Feather name="chevron-right" size={19} color={colors.muted} />
          </Pressable>
        </View>

        {opportunitiesError ? (
          <Pressable onPress={() => void reloadOpportunities()} style={styles.errorCard}>
            <Feather name="alert-triangle" size={15} color={colors.red700} />
            <Text style={styles.errorText}>Load failed. Tap to retry.</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({  safe: {
    flex: 1,
    backgroundColor: colors.surfaceSoft,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxxl,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
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
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.navy950,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...type.bodyStrong,
    color: colors.white,
    fontSize: 12,
  },
  pressed: {
    opacity: 0.7,
  },
  completionCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.navy950,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.floating,
  },
  completionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  completionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.teal700,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completionCopy: {
    flex: 1,
    gap: 2,
  },
  completionTitle: {
    ...type.h3,
    color: colors.white,
  },
  completionBody: {
    ...type.small,
    color: colors.teal100,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.navy800,
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.teal600,
  },
  completionAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  completionActionText: {
    ...type.bodyStrong,
    color: colors.teal600,
    fontSize: 13,
  },
  categoryScroll: {
    marginTop: spacing.xl,
    marginHorizontal: -spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingRight: spacing.xl,
  },
  statRow: {
    marginTop: spacing.xl,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  cardList: {
    gap: spacing.md,
  },
  linkList: {
    gap: spacing.md,
  },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
  },
  linkIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkIconTeal: {
    backgroundColor: colors.teal50,
  },
  linkIconBlue: {
    backgroundColor: colors.blue50,
  },
  linkCopy: {
    flex: 1,
    gap: 2,
  },
  linkTitle: {
    ...type.bodyStrong,
  },
  linkBody: {
    ...type.small,
  },
  errorCard: {
    marginTop: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.red50,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    fontWeight: '600',
    color: colors.red700,
  },
});
