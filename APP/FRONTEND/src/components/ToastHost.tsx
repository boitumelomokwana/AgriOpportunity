import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, radius, shadows, spacing } from '@/constants/theme';
import { useApp } from '@/state/AppProvider';

export function ToastHost() {
  const { toast } = useApp();
  const insets = useSafeAreaInsets();

  if (!toast) return null;

  return (
    <View
      pointerEvents="none"
      style={[styles.wrap, { bottom: Math.max(insets.bottom, 16) + 74 }]}
    >
      <View style={styles.toast}>
        <Feather name="check-circle" size={17} color={colors.teal100} />
        <Text style={styles.message}>{toast.message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
  },
  toast: {
    maxWidth: '88%',
    backgroundColor: colors.navy950,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    ...shadows.floating,
  },
  message: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.white,
    flexShrink: 1,
  },
});
