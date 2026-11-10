import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, spacing } from '@/constants/theme';
import type { IconName } from '@/types';

interface ChipProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: IconName;
  tone?: 'default' | 'teal' | 'amber' | 'red';
}

export function Chip({ label, active, onPress, icon, tone = 'default' }: ChipProps) {
  const tones = {
    default: {
      backgroundColor: active ? colors.teal50 : colors.surface,
      borderColor: active ? colors.teal600 : colors.line,
      color: active ? colors.teal700 : colors.ink,
    },
    teal: {
      backgroundColor: colors.teal50,
      borderColor: colors.teal100,
      color: colors.teal700,
    },
    amber: {
      backgroundColor: colors.amber100,
      borderColor: colors.amber100,
      color: colors.amber700,
    },
    red: {
      backgroundColor: colors.red50,
      borderColor: colors.red50,
      color: colors.red700,
    },
  }[tone];

  const content = (
    <View
      style={[
        styles.chip,
        { backgroundColor: tones.backgroundColor, borderColor: tones.borderColor },
      ]}
    >
      {icon ? <Feather name={icon} size={13} color={tones.color} /> : null}
      <Text style={[styles.label, { color: tones.color }]}>{label}</Text>
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(active) }}
      onPress={onPress}
      hitSlop={4}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 34,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    fontWeight: '700',
  },
});
