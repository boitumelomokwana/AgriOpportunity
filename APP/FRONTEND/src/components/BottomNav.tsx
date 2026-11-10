import { Feather } from '@expo/vector-icons';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs/types';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, spacing } from '@/constants/theme';
import type { IconName } from '@/types';
import { useApp } from '@/state/AppProvider';

const tabs: { name: string; label: string; icon: IconName }[] = [
  { name: 'home', label: 'Home', icon: 'home' },
  { name: 'explore', label: 'Explore', icon: 'compass' },
  { name: 'saved', label: 'Saved', icon: 'bookmark' },
  { name: 'alerts', label: 'Alerts', icon: 'bell' },
  { name: 'profile', label: 'Profile', icon: 'user' },
];

export function BottomNav({ state, navigateToTab, insets }: BottomTabBarProps) {
  const { unreadCount } = useApp();
  const activeRoute = state.routes[state.index];

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {tabs.map((tab) => {
        const active = activeRoute?.name === tab.name;
        const route = state.routes.find((item) => item.name === tab.name);

        return (
          <Pressable
            key={tab.name}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tab.label}
            onPress={() => {
              if (route) navigateToTab(route.key);
            }}
            style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
          >
            <View style={styles.iconWrap}>
              <Feather
                name={tab.icon}
                size={21}
                color={active ? colors.teal700 : colors.muted}
              />
              {tab.name === 'alerts' && unreadCount > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.label, active && styles.labelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minHeight: 46,
  },
  pressed: {
    opacity: 0.65,
  },
  iconWrap: {
    position: 'relative',
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: 10,
    fontWeight: '600',
    color: colors.muted,
  },
  labelActive: {
    color: colors.teal700,
    fontWeight: '700',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -9,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.red700,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  badgeText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    fontWeight: '800',
    color: colors.white,
  },
});
