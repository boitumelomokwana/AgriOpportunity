import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { AppHeader } from '@/components/AppHeader';
import { EmptyState } from '@/components/EmptyState';
import { Toggle } from '@/components/Toggle';
import { Brand } from '@/components/Brand';
import { colors, radius, spacing, type } from '@/constants/theme';
import { useApp } from '@/state/AppProvider';

function SettingRow({
  label,
  body,
  value,
  onValueChange,
}: {
  label: string;
  body: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingCopy}>
        <Text style={styles.settingTitle}>{label}</Text>
        <Text style={styles.settingBody}>{body}</Text>
      </View>
      <Toggle value={value} onValueChange={onValueChange} accessibilityLabel={label} />
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { isAuthenticated, isAdmin, profile, updateProfile, signOut, showToast } = useApp();
  const prefs = profile.notificationPreferences;

  if (!isAuthenticated) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
        <AppHeader
          title="Settings"
          subtitle="Sign in to manage your preferences"
          onBack={() => router.back()}
        />
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="settings"
            title="Sign in to change settings"
            message="Notification preferences are stored with your NextStep SA account."
            actionLabel="Sign in"
            onAction={() => router.push('/auth')}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
      <AppHeader
        title="Settings"
        subtitle="Notifications and app information"
        onBack={() => router.back()}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.brandRow}>
          <Brand />
          <Text style={styles.version}>NextStep SA · connected to the API</Text>
        </View>

        <View style={styles.card}>
          <SettingRow
            label="Closing date reminders"
            body="Alert me in the week before listed closing dates."
            value={prefs.closingDates}
            onValueChange={(closingDates) =>
              updateProfile({ notificationPreferences: { ...prefs, closingDates } })
            }
          />
          <SettingRow
            label="New matches"
            body="Tell me when new matching opportunities are added."
            value={prefs.newMatches}
            onValueChange={(newMatches) =>
              updateProfile({ notificationPreferences: { ...prefs, newMatches } })
            }
          />
          <SettingRow
            label="Saved opportunity updates"
            body="Notify me when saved listings change."
            value={prefs.savedUpdates}
            onValueChange={(savedUpdates) =>
              updateProfile({ notificationPreferences: { ...prefs, savedUpdates } })
            }
          />
        </View>

        <View style={styles.linkList}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/profile')}
            style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}
          >
            <View style={styles.linkIcon}>
              <Feather name="user" size={17} color={colors.teal700} />
            </View>
            <View style={styles.linkCopy}>
              <Text style={styles.linkTitle}>Edit profile & alert types</Text>
              <Text style={styles.linkBody}>
                Change opportunity types and personal details
              </Text>
            </View>
            <Feather name="chevron-right" size={19} color={colors.muted} />
          </Pressable>
          {isAdmin ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/admin')}
              style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}
            >
              <View style={styles.linkIcon}>
                <Feather name="shield" size={17} color={colors.teal700} />
              </View>
              <View style={styles.linkCopy}>
                <Text style={styles.linkTitle}>Admin area</Text>
                <Text style={styles.linkBody}>Create, edit and publish listings</Text>
              </View>
              <Feather name="chevron-right" size={19} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.noticeCard}>
          <Feather name="info" size={16} color={colors.teal700} />
          <Text style={styles.noticeText}>
            Your profile and notification preferences are saved to your NextStep SA
            account. Opportunity records come from the backend SQLite database;
            seeded listings are illustrative demo data, not verified vacancies.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void signOut()
              .then(() => router.replace('/'))
              .catch((error: unknown) => {
                showToast(error instanceof Error ? error.message : 'Unable to sign out.');
              });
          }}
          style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}
        >
          <Feather name="log-out" size={17} color={colors.red700} />
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.surfaceSoft,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  brandRow: {
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  version: {
    ...type.caption,
  },
  card: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  settingRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  settingCopy: {
    flex: 1,
    gap: 2,
  },
  settingTitle: {
    ...type.bodyStrong,
  },
  settingBody: {
    ...type.small,
  },
  linkList: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
  },
  linkIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.teal50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkCopy: {
    flex: 1,
    gap: 2,
  },
  linkTitle: {
    ...type.bodyStrong,
  },
  linkBody: {
    ...type.small,
  },
  noticeCard: {
    marginTop: spacing.xxl,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.teal50,
    borderWidth: 1,
    borderColor: colors.teal100,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  noticeText: {
    ...type.small,
    color: colors.teal700,
    flex: 1,
  },
  signOut: {
    marginTop: spacing.xxxl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.red50,
  },
  signOutText: {
    fontFamily: type.bodyStrong.fontFamily,
    fontSize: 14,
    fontWeight: '700',
    color: colors.red700,
  },
  pressed: {
    opacity: 0.7,
  },
});
