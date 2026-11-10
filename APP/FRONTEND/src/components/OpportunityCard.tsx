import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, shadows, spacing, type } from '@/constants/theme';
import type { Opportunity } from '@/types';
import { closingLabel, closingTone } from '@/utils/format';

interface OpportunityCardProps {
  opportunity: Opportunity;
  saved: boolean;
  onSave: () => void;
  onOpen: () => void;
}

export function OpportunityCard({ opportunity, saved, onSave, onOpen }: OpportunityCardProps) {
  const tone = closingTone(opportunity);
  const deadline = closingLabel(opportunity);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${opportunity.title} at ${opportunity.organisation}`}
      onPress={onOpen}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.topRow}>
        <View style={styles.categoryPill}>
          <Text style={styles.categoryText}>{opportunity.category}</Text>
        </View>
        <View style={styles.actions}>
          <View style={styles.matchPill}>
            <Text style={styles.matchText}>{opportunity.match}% match</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={saved ? 'Remove from saved' : 'Save opportunity'}
            onPress={(event) => {
              event.stopPropagation();
              onSave();
            }}
            hitSlop={8}
            style={[styles.saveButton, saved && styles.saveButtonActive]}
          >
            <Feather
              name="bookmark"
              size={17}
              color={saved ? colors.teal700 : colors.muted}
            />
          </Pressable>
        </View>
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {opportunity.title}
      </Text>
      <Text style={styles.organisation} numberOfLines={1}>
        {opportunity.organisation}
      </Text>

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Feather name="map-pin" size={13} color={colors.muted} />
          <Text style={styles.metaText} numberOfLines={1}>
            {opportunity.location}
          </Text>
        </View>
        <View style={styles.metaItem}>
          <Feather name="book-open" size={13} color={colors.muted} />
          <Text style={styles.metaText} numberOfLines={1}>
            {opportunity.education}
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.metaItem}>
          <Feather name="clock" size={13} color={colors.muted} />
          <Text style={styles.deadline}>{deadline}</Text>
        </View>
        {tone !== 'normal' && !opportunity.isExpired ? (
          <View style={[styles.urgency, tone === 'urgent' && styles.urgencyStrong]}>
            <Text
              style={[
                styles.urgencyText,
                tone === 'urgent' ? styles.urgencyTextStrong : null,
              ]}
            >
              {tone === 'urgent' ? 'Closing soon' : 'Apply soon'}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.card,
  },
  pressed: {
    opacity: 0.92,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  categoryPill: {
    backgroundColor: colors.teal50,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  categoryText: {
    ...type.label,
    fontSize: 10,
    color: colors.teal700,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  matchPill: {
    backgroundColor: colors.blue50,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  matchText: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    fontWeight: '700',
    color: colors.navy800,
  },
  saveButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonActive: {
    backgroundColor: colors.teal50,
  },
  title: {
    ...type.h3,
    fontSize: 17,
    lineHeight: 22,
  },
  organisation: {
    ...type.small,
    color: colors.muted,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: 2,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: '100%',
  },
  metaText: {
    ...type.small,
    color: colors.muted,
    flexShrink: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  deadline: {
    ...type.small,
    color: colors.navy900,
    fontWeight: '600',
  },
  urgency: {
    backgroundColor: colors.amber100,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  urgencyStrong: {
    backgroundColor: colors.red50,
  },
  urgencyText: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    fontWeight: '700',
    color: colors.amber700,
  },
  urgencyTextStrong: {
    color: colors.red700,
  },
});
