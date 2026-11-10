import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { AppHeader } from '@/components/AppHeader';
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
  const { profile, updateProfile, showToast } = useApp();
  const prefs = profile.notificationPreferences;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
      <AppHeader
        title="Settings"
        subtitle="Local demo preferences"
        onBack={() => router.back()}
      />

      <View style={styles.brandRow}>
        <Brand />
        <Text style={styles.version}>NextStep SA · demo build</Text>
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
          body="Tell me when new illustrative matches arrive."
          value={prefs.newMatches}
          onValueChange={(newMatches) =>
            updateProfile({ notificationPreferences: { ...prefs, newMatches } })
          }
        />
        <SettingRow
          label="Saved opportunity updates"
          body="Notify me when saved demo listings change."
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
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/admin')}
          style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}
        >
          <View style={styles.linkIcon}>
            <Feather name="shield" size={17} color={colors.teal700} />
          </View>
          <View style={styles.linkCopy}>
            <Text style={styles.linkTitle}>Administrator demo</Text>
            <Text style={styles.linkBody}>Illustrative moderation area (mock data)</Text>
          </View>
          <Feather name="chevron-right" size={19} color={colors.muted} />
        </Pressable>
      </View>

      <View style={styles.noticeCard}>
        <Feather name="info" size={16} color={colors.teal700} />
        <Text style={styles.noticeText}>
          This is a frontend demonstration of NextStep SA. No backend, account
          creation or real notifications are used. Everything you change stays
          in memory until the app is closed.
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => {
          showToast('Demo mode: state resets when the app closes');
          router.replace('/');
        }}
        style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}
      >
        <Feather name="log-out" size={17} color={colors.red700} />
        <Text style={styles.signOutText}>Return to welcome screen</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.surfaceSoft,
  },
  brandRow: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.xl,
    gap: spacing.xs,
  },
  version: {
    ...type.caption,
  },
  card: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.xl,
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
    marginHorizontal: spacing.xl,
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
    marginHorizontal: spacing.xl,
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
    marginHorizontal: spacing.xl,
    marginBottom: spacing.xxxl,
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
