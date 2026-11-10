import { Feather } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, fonts, radius, spacing } from '@/constants/theme';
import type { IconName } from '@/types';

type ButtonVariant = 'primary' | 'secondary' | 'text' | 'danger';

interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

const backgrounds: Record<ButtonVariant, string> = {
  primary: colors.teal700,
  secondary: colors.surface,
  text: colors.transparent,
  danger: colors.red700,
};

const textColors: Record<ButtonVariant, string> = {
  primary: colors.white,
  secondary: colors.navy900,
  text: colors.teal700,
  danger: colors.white,
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  fullWidth,
  disabled,
  loading,
  style,
}: ButtonProps) {
  const contentColor = textColors[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled || loading) }}
      disabled={disabled || loading}
      onPress={onPress}
      android_ripple={{ color: 'rgba(255,255,255,0.18)' }}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: backgrounds[variant] },
        variant === 'secondary' && styles.secondary,
        fullWidth && styles.fullWidth,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={contentColor} />
      ) : (
        <>
          {icon ? <Feather name={icon} size={17} color={contentColor} /> : null}
          <Text style={[styles.label, { color: contentColor }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: spacing.xl,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  secondary: {
    borderWidth: 1,
    borderColor: colors.line,
  },
  fullWidth: {
    width: '100%',
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    transform: [{ scale: 0.99 }],
  },
});
