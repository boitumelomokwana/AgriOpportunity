import type { ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, layout, spacing } from '@/constants/theme';

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  bottomInset?: boolean;
}

export function Screen({
  children,
  scroll = true,
  contentStyle,
  style,
  bottomInset = true,
}: ScreenProps) {
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.safe, style]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            bottomInset && styles.bottomInset,
            contentStyle,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.flex, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.surfaceSoft,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.sm,
  },
  bottomInset: {
    paddingBottom: spacing.xxxl,
  },
});
