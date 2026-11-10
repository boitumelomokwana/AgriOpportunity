import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, spacing, type } from '@/constants/theme';

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  subtitle?: string;
}

export function SectionHeader({ title, actionLabel, onAction, subtitle }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          hitSlop={8}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...type.h3,
    fontSize: 17,
  },
  subtitle: {
    ...type.small,
  },
  action: {
    paddingVertical: 2,
  },
  actionText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    fontWeight: '700',
    color: colors.teal700,
  },
  pressed: {
    opacity: 0.65,
  },
});
