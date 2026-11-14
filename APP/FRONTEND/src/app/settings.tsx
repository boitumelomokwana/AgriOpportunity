import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/AppHeader';
import { Brand } from '@/components/Brand';
import { Button } from '@/components/Button';
import { FormField } from '@/components/FormField';
import { Toggle } from '@/components/Toggle';
import { colors, radius, spacing, type } from '@/constants/theme';
import { errorMessage } from '@/lib/errors';
import { useAuth } from '@/state/AuthProvider';
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
  const { isAdmin, signOut, updatePassword } = useAuth();
  const { profile, updateProfile, isSignedIn, showToast } = useApp();
  const prefs = profile.notificationPreferences;
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const changePassword = async () => {
    if (password.length < 8) {
      showToast('Use a password of at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      showToast('The two passwords do not match.');
      return;
    }
    setSavingPassword(true);
    try {
      await updatePassword(password);
      setPassword('');
      setConfirmPassword('');
      showToast('Password updated');
    } catch (error) {
      showToast(errorMessage(error));
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/');
    } catch {
      showToast('Could not sign out. Please try again.');
    }
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
      <AppHeader
        title="Settings"
        subtitle="Notifications, security and app information"
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandRow}>
          <Brand />
          <Text style={styles.version}>AgriOpportunities · connected to Supabase</Text>
        </View>

        {isSignedIn ? (
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
              body="Tell me when new opportunities match my profile."
              value={prefs.newMatches}
              onValueChange={(newMatches) =>
                updateProfile({ notificationPreferences: { ...prefs, newMatches } })
              }
            />
            <SettingRow
              label="Saved opportunity updates"
              body="Notify me when a saved opportunity changes or closes."
              value={prefs.savedUpdates}
              onValueChange={(savedUpdates) =>
                updateProfile({ notificationPreferences: { ...prefs, savedUpdates } })
              }
            />
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Notifications</Text>
            <Text style={styles.settingBody}>
              Sign in to choose which reminders and match alerts you receive. Your
              preferences are stored with your account, not on this device.
            </Text>
            <Button
              title="Sign in to manage alerts"
              variant="secondary"
              onPress={() => router.push('/auth')}
            />
          </View>
        )}

        {isSignedIn ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Change password</Text>
            <FormField
              label="New password"
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              secureTextEntry
              autoComplete="new-password"
            />
            <FormField
              label="Confirm new password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Repeat the password"
              secureTextEntry
              autoComplete="new-password"
            />
            <Button
              title="Update password"
              variant="secondary"
              loading={savingPassword}
              onPress={() => void changePassword()}
            />
          </View>
        ) : null}

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
            onPress={() => router.push('/organization')}
            style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}
          >
            <View style={styles.linkIcon}>
              <Feather name="briefcase" size={17} color={colors.teal700} />
            </View>
            <View style={styles.linkCopy}>
              <Text style={styles.linkTitle}>Organisations</Text>
              <Text style={styles.linkBody}>Register or manage a company profile</Text>
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
                <Text style={styles.linkTitle}>Administrator area</Text>
                <Text style={styles.linkBody}>Review listings, organisations and reports</Text>
              </View>
              <Feather name="chevron-right" size={19} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.noticeCard}>
          <Feather name="info" size={16} color={colors.teal700} />
          <Text style={styles.noticeText}>
            AgriOpportunities stores your profile, saved opportunities, applications
            and reminders in the AgriOpportunity Supabase project. Changes sync
            across your devices and are protected by row-level security.
          </Text>
        </View>

        {isSignedIn ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void handleSignOut()}
            style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}
          >
            <Feather name="log-out" size={17} color={colors.red700} />
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        ) : (
          <Button
            title="Sign in"
            fullWidth
            onPress={() => router.push('/auth')}
            style={styles.signOut}
          />
        )}
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
    paddingBottom: spacing.xxxl,
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
  cardTitle: {
    ...type.h3,
    fontSize: 16,
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
