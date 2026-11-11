import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { AppHeader } from '@/components/AppHeader';
import { EmptyState } from '@/components/EmptyState';
import { SectionHeader } from '@/components/SectionHeader';
import { colors, fonts, radius, spacing, type } from '@/constants/theme';
import { useApp } from '@/state/AppProvider';
import type { AppNotification, NotificationGroup } from '@/types';

const groups: NotificationGroup[] = ['Today', 'Yesterday'];

export default function AlertsScreen() {
  const router = useRouter();
  const { isAuthenticated, notifications, unreadCount, markAllRead, markNotificationRead } = useApp();

  const updateGroup = (group: NotificationGroup) =>
    notifications.filter((notification) => notification.group === group);

  const pressNotification = (notification: AppNotification) => {
    markNotificationRead(notification.id);
    if (notification.target) router.push(notification.target);
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
      <AppHeader
        title="Alerts"
        subtitle={
          unreadCount > 0
            ? `${unreadCount} unread update${unreadCount === 1 ? '' : 's'}`
            : 'You are all caught up'
        }
        action={
          unreadCount > 0 ? (
            <Pressable
              accessibilityRole="button"
              onPress={markAllRead}
              hitSlop={8}
              style={({ pressed }) => [styles.markAll, pressed && styles.pressed]}
            >
              <Text style={styles.markAllText}>Mark all read</Text>
            </Pressable>
          ) : undefined
        }
      />

      {!isAuthenticated || notifications.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon={isAuthenticated ? 'bell' : 'user'}
            title={isAuthenticated ? 'No notifications' : 'Sign in to view alerts'}
            message={isAuthenticated
              ? 'Alerts about closing dates and new matches will show up here.'
              : 'Your account notifications will appear here.'}
            actionLabel={isAuthenticated ? 'Explore opportunities' : 'Sign in'}
            onAction={() => router.push(isAuthenticated ? '/explore' : '/auth')}
          />
        </View>
      ) : (
        groups.map((group) => {
          const items = updateGroup(group);
          if (items.length === 0) return null;
          return (
            <View key={group}>
              <SectionHeader title={group} />
              <View style={styles.list}>
                {items.map((notification) => (
                  <Pressable
                    key={notification.id}
                    accessibilityRole="button"
                    accessibilityState={{ checked: !notification.unread }}
                    onPress={() => pressNotification(notification)}
                    style={({ pressed }) => [
                      styles.card,
                      notification.unread && styles.cardUnread,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View
                      style={[
                        styles.iconWrap,
                        notification.unread ? styles.iconWrapUnread : styles.iconWrapRead,
                      ]}
                    >
                      <Feather
                        name={notification.icon}
                        size={17}
                        color={notification.unread ? colors.teal700 : colors.muted}
                      />
                    </View>
                    <View style={styles.copy}>
                      <Text style={[styles.title, notification.unread && styles.titleUnread]}>
                        {notification.title}
                      </Text>
                      <Text style={styles.body}>{notification.body}</Text>
                    </View>
                    <Text style={styles.time}>{notification.time}</Text>
                    {notification.unread ? <View style={styles.dot} /> : null}
                  </Pressable>
                ))}
              </View>
            </View>
          );
        })
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.surfaceSoft,
  },
  markAll: {
    paddingVertical: 2,
  },
  markAllText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    fontWeight: '700',
    color: colors.teal700,
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  list: {
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
  },
  cardUnread: {
    borderColor: colors.teal100,
    backgroundColor: colors.teal50,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapUnread: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.teal100,
  },
  iconWrapRead: {
    backgroundColor: colors.surfaceSoft,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...type.bodyStrong,
    color: colors.muted,
  },
  titleUnread: {
    color: colors.navy950,
  },
  body: {
    ...type.small,
  },
  time: {
    ...type.caption,
  },
  dot: {
    position: 'absolute',
    top: spacing.lg - 2,
    right: spacing.lg - 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.teal600,
  },
  pressed: {
    opacity: 0.85,
  },
});
