import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { OpportunityCard } from '@/components/OpportunityCard';
import { colors, fonts, radius, spacing, type } from '@/constants/theme';
import { opportunityCategories } from '@/data/opportunities';
import {
  filterOpportunities,
  sortOpportunities,
} from '@/services/opportunityService';
import { useApp } from '@/state/AppProvider';
import { activeFilterCount, pluralise } from '@/utils/format';
import type { OpportunityCategory } from '@/types';

export default function ExploreScreen() {
  const router = useRouter();
  const {
    opportunities,
    opportunitiesError,
    reloadOpportunities,
    exploreFilters,
    setExploreFilters,
    resetExploreFilters,
    isSaved,
    toggleSaved,
  } = useApp();

  const activeCategories = exploreFilters.types;
  const results = useMemo(
    () => sortOpportunities(filterOpportunities(opportunities, exploreFilters, ''), 'Best match'),
    [opportunities, exploreFilters],
  );

  const filterCount = activeFilterCount(exploreFilters);

  const toggleCategory = (category: OpportunityCategory) => {
    const types = activeCategories.includes(category)
      ? activeCategories.filter((item) => item !== category)
      : [...activeCategories, category];
    setExploreFilters({ ...exploreFilters, types });
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.copy}>
          <Text style={styles.title}>Explore</Text>
          <Text style={styles.subtitle}>
            Bursaries, internships, learnerships, jobs and youth programmes
          </Text>
        </View>

        <Pressable
          accessibilityRole="search"
          accessibilityLabel="Search opportunities"
          onPress={() => router.push('/search')}
          style={({ pressed }) => [styles.searchBar, pressed && styles.pressed]}
        >
          <Feather name="search" size={17} color={colors.muted} />
          <Text style={styles.searchPlaceholder}>Search title or organisation…</Text>
        </Pressable>

        <View style={styles.controlRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open filters"
            onPress={() => router.push('/filters')}
            hitSlop={6}
            style={({ pressed }) => [styles.filterButton, pressed && styles.pressed]}
          >
            <Feather name="sliders" size={15} color={colors.navy900} />
            <Text style={styles.filterButtonText}>Filters</Text>
            {filterCount > 0 ? (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{filterCount}</Text>
              </View>
            ) : null}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reset filters"
            onPress={resetExploreFilters}
            hitSlop={6}
            style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}
          >
            <Feather name="rotate-ccw" size={13} color={colors.teal700} />
            <Text style={styles.clearButtonText}>Reset</Text>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
          contentContainerStyle={styles.categoryRow}
        >
          {opportunityCategories.map((category) => (
            <Chip
              key={category.category}
              label={category.label}
              icon={category.icon}
              active={activeCategories.includes(category.category)}
              onPress={() => toggleCategory(category.category)}
            />
          ))}
        </ScrollView>

        <Text style={styles.resultCount}>
          {results.length} {pluralise(results.length, 'opportunity')} open
        </Text>

        {opportunitiesError ? (
          <EmptyState
            icon="alert-triangle"
            title="Something went wrong"
            message={opportunitiesError}
            actionLabel="Try again"
            onAction={() => void reloadOpportunities()}
          />
        ) : results.length === 0 ? (
          <EmptyState
            icon="search"
            title="No opportunities found"
            message="Try removing some filters or widening your search."
            actionLabel="Reset filters"
            onAction={resetExploreFilters}
          />
        ) : (
          <View style={styles.cardList}>
            {results.map((opportunity) => (
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.surfaceSoft,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxxl,
  },
  copy: {
    gap: 2,
  },
  title: {
    ...type.h1,
  },
  subtitle: {
    ...type.small,
  },
  searchBar: {
    marginTop: spacing.lg,
    minHeight: 48,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  searchPlaceholder: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.muted,
    flex: 1,
  },
  controlRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 38,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  filterButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    fontWeight: '700',
    color: colors.navy900,
  },
  filterBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.teal700,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.white,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 38,
    paddingHorizontal: spacing.sm,
  },
  clearButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    fontWeight: '700',
    color: colors.teal700,
  },
  categoryScroll: {
    marginTop: spacing.md,
    marginHorizontal: -spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingRight: spacing.xl,
  },
  resultCount: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.muted,
  },
  cardList: {
    gap: spacing.md,
  },
  pressed: {
    opacity: 0.7,
  },
});
