import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, spacing } from '@/constants/theme';
import type { IconName } from '@/types';

type StatTone = 'green' | 'blue' | 'amber' | 'red';

const toneMap: Record<StatTone, { background: string; color: string }> = {
  green: { background: colors.teal50, color: colors.teal700 },
  blue: { background: colors.blue50, color: colors.navy800 },
  amber: { background: colors.amber100, color: colors.amber700 },
  red: { background: colors.red50, color: colors.red700 },
};

interface StatCardProps {
  label: string;
  value: string | number;
  icon: IconName;
  tone: StatTone;
}

export function StatCard({ label, value, icon, tone }: StatCardProps) {
  const palette = toneMap[tone];
  return (
    <View style={styles.card}>
      <View style={[styles.iconWrap, { backgroundColor: palette.background }]}>
        <Feather name={icon} size={17} color={palette.color} />
      </View>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '46%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    gap: 4,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  value: {
    fontFamily: fonts.bold,
    fontSize: 24,
    fontWeight: '800',
    color: colors.navy950,
    letterSpacing: -0.4,
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.muted,
  },
});
