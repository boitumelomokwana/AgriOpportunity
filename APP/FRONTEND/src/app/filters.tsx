import { useRouter } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { FormField } from '@/components/FormField';
import { KeyboardAwareScrollView } from '@/components/KeyboardAwareScrollView';
import { Toggle } from '@/components/Toggle';
import { colors, radius, spacing, type } from '@/constants/theme';
import { defaultFilters, filterOpportunities } from '@/services/opportunityService';
import { useApp } from '@/state/AppProvider';
import {
  CLOSING_WINDOWS,
  EDUCATION_LEVELS,
  OPPORTUNITY_CATEGORIES,
  PROVINCES,
  WORK_MODES,
  type OpportunityFilters,
} from '@/types';

export default function FiltersScreen() {
  const router = useRouter();
  const { opportunities, exploreFilters, setExploreFilters } = useApp();
  const [draft, setDraft] = useState<OpportunityFilters>({ ...exploreFilters });

  const patch = (part: Partial<OpportunityFilters>) =>
    setDraft((current) => ({ ...current, ...part }));

  const previewCount = useMemo(
    () => filterOpportunities(opportunities, draft, '').length,
    [opportunities, draft],
  );

  const toggleIn =
    <T,>(key: 'types' | 'provinces' | 'modes', value: T) =>
    () => {
      const current = draft[key] as T[];
      patch({
        [key]: current.includes(value)
          ? current.filter((item) => item !== value)
          : [...current, value],
      } as Partial<OpportunityFilters>);
    };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
      <AppHeader
        title="Filters"
        subtitle="Narrow opportunities to what fits you"
        onBack={() => router.back()}
      />

      <KeyboardAwareScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <FilterSection label="Opportunity type" multi>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {OPPORTUNITY_CATEGORIES.map((category) => (
              <Chip
                key={category}
                label={category}
                active={draft.types.includes(category)}
                onPress={toggleIn('types', category)}
              />
            ))}
          </ScrollView>
        </FilterSection>

        <FilterSection label="Province">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {PROVINCES.map((province) => (
              <Chip
                key={province}
                label={province}
                active={draft.provinces.includes(province)}
                onPress={toggleIn('provinces', province)}
              />
            ))}
            <Chip
              label="National listings"
              icon="globe"
              active={draft.provinces.length === 0}
              onPress={() => patch({ provinces: [] })}
            />
          </ScrollView>
          <Text style={styles.hint}>
            National opportunities appear whenever no province is selected. Tap the globe
            chip to clear your province choices.
          </Text>
        </FilterSection>

        <FilterSection label="Education level">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {EDUCATION_LEVELS.map((level) => (
              <Chip
                key={level}
                label={level}
                active={draft.education === level}
                onPress={() => patch({ education: level })}
              />
            ))}
          </ScrollView>
        </FilterSection>

        <FilterSection label="Closing window">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {CLOSING_WINDOWS.map((window) => (
              <Chip
                key={window}
                label={window}
                active={draft.closing === window}
                onPress={() => patch({ closing: window })}
              />
            ))}
          </ScrollView>
          {draft.closing === 'Choose dates' ? (
            <View style={styles.dateRow}>
              <FormField
                label="From (YYYY-MM-DD)"
                value={draft.dateFrom}
                onChangeText={(dateFrom) => patch({ dateFrom })}
                placeholder="2026-01-01"
                keyboardType="numbers-and-punctuation"
                style={styles.dateField}
              />
              <FormField
                label="To (YYYY-MM-DD)"
                value={draft.dateTo}
                onChangeText={(dateTo) => patch({ dateTo })}
                placeholder="2026-12-31"
                keyboardType="numbers-and-punctuation"
                style={styles.dateField}
              />
            </View>
          ) : null}
        </FilterSection>

        <FilterSection label="Work mode">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {WORK_MODES.map((mode) => (
              <Chip
                key={mode}
                label={mode}
                active={draft.modes.includes(mode)}
                onPress={toggleIn('modes', mode)}
              />
            ))}
          </ScrollView>
        </FilterSection>

        <View style={styles.switchCard}>
          <View style={styles.switchRow}>
            <View style={styles.switchCopy}>
              <Text style={styles.switchTitle}>Open opportunities only</Text>
              <Text style={styles.switchBody}>
                Hide listings whose closing date has passed
              </Text>
            </View>
            <Toggle
              value={draft.openOnly}
              onValueChange={(openOnly) => patch({ openOnly })}
              accessibilityLabel="Open opportunities only"
            />
          </View>
        </View>
        </KeyboardAwareScrollView>

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setDraft({ ...defaultFilters })}
          hitSlop={6}
          style={({ pressed }) => [styles.reset, pressed && styles.pressed]}
        >
          <Feather name="rotate-ccw" size={14} color={colors.teal700} />
          <Text style={styles.resetText}>Reset all</Text>
        </Pressable>
        <Button
          title={`Show ${previewCount} ${previewCount === 1 ? 'result' : 'results'}`}
          onPress={() => {
            setExploreFilters(draft);
            router.back();
          }}
          style={styles.applyButton}
        />
      </View>
    </SafeAreaView>
  );
}

function FilterSection({
  label,
  multi,
  children,
}: {
  label: string;
  multi?: boolean;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.surfaceSoft,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.huge,
  },
  section: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitle: {
    ...type.bodyStrong,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  hint: {
    ...type.caption,
  },
  dateRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  dateField: {
    flex: 1,
  },
  switchCard: {
    marginTop: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  switchCopy: {
    flex: 1,
    gap: 2,
  },
  switchTitle: {
    ...type.bodyStrong,
  },
  switchBody: {
    ...type.small,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.surfaceSoft,
  },
  reset: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  resetText: {
    ...type.bodyStrong,
    color: colors.teal700,
    fontSize: 14,
  },
  applyButton: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
});
