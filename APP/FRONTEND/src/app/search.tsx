import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { AppHeader } from '@/components/AppHeader';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { OpportunityCard } from '@/components/OpportunityCard';
import { SectionHeader } from '@/components/SectionHeader';
import { recentSearchSuggestions } from '@/constants/categories';
import { colors, radius, spacing, type } from '@/constants/theme';
import { filterOpportunities, sortOpportunities, defaultFilters } from '@/services/opportunityService';
import { useApp } from '@/state/AppProvider';
import { pluralise } from '@/utils/format';

export default function SearchScreen() {
  const router = useRouter();
  const {
    opportunities,
    opportunitiesError,
    reloadOpportunities,
    exploreFilters,
    setExploreFilters,
    isSaved,
    toggleSaved,
    isSignedIn,
    createSavedSearch,
  } = useApp();

  const [query, setQuery] = useState('');

  useFocusEffect(
    useCallback(() => {
      setExploreFilters({ ...defaultFilters });
    }, [setExploreFilters]),
  );

  const results = useMemo(
    () =>
      sortOpportunities(
        filterOpportunities(opportunities, { ...exploreFilters, openOnly: false }, query),
        'Best match',
      ),
    [opportunities, exploreFilters, query],
  );

  const suggestions = recentSearchSuggestions;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
      <AppHeader onBack={() => router.back()} />

      <View style={styles.searchWrap}>
        <Feather name="search" size={17} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search title, organisation or keyword…"
          placeholderTextColor={colors.muted}
          accessibilityLabel="Search opportunities"
          autoFocus
          style={styles.input}
        />
        {query.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            onPress={() => setQuery('')}
            hitSlop={8}
            style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}
          >
            <Feather name="x" size={17} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>

      {query.trim().length === 0 ? (
        <SectionHeader title="Try searching for" subtitle="Popular searches" />
      ) : (
        <View style={styles.resultRow}>
          <Text style={styles.resultCount}>
            {results.length} {pluralise(results.length, 'result')} for “{query.trim()}”
          </Text>
          {isSignedIn ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => void createSavedSearch(query.trim(), query.trim())}
              hitSlop={6}
              style={({ pressed }) => [styles.saveSearch, pressed && styles.pressed]}
            >
              <Feather name="bookmark" size={13} color={colors.teal700} />
              <Text style={styles.saveSearchText}>Save search</Text>
            </Pressable>
          ) : null}
        </View>
      )}

      {query.trim().length === 0 ? (
        <View style={styles.suggestionRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {suggestions.map((suggestion) => (
              <Chip key={suggestion} label={suggestion} icon="search" onPress={() => setQuery(suggestion)} />
            ))}
          </ScrollView>
        </View>
      ) : opportunitiesError ? (
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
          title="No matches"
          message="Check your spelling or try a broader keyword, like “internship”."
          actionLabel="Clear search"
          onAction={() => setQuery('')}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.surfaceSoft,
  },
  searchWrap: {
    marginTop: spacing.sm,
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
  input: {
    flex: 1,
    fontFamily: type.body.fontFamily,
    fontSize: 14,
    color: colors.ink,
    paddingVertical: 0,
  },
  clearButton: {
    padding: 4,
  },
  resultCount: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    ...type.small,
    fontFamily: type.bodyStrong.fontFamily,
    color: colors.ink,
    flex: 1,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  saveSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: spacing.sm,
  },
  saveSearchText: {
    ...type.small,
    color: colors.teal700,
    fontWeight: '700',
  },
  suggestionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  cardList: {
    gap: spacing.md,
    marginTop: spacing.sm,
    paddingBottom: spacing.xxxl,
  },
  pressed: {
    opacity: 0.7,
  },
});
