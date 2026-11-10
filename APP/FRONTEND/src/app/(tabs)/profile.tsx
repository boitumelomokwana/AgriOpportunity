import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { AppHeader } from '@/components/AppHeader';
import { Chip } from '@/components/Chip';
import { FormField } from '@/components/FormField';
import { SectionHeader } from '@/components/SectionHeader';
import { Toggle } from '@/components/Toggle';
import { colors, radius, spacing, type } from '@/constants/theme';
import {
  EDUCATION_LEVELS,
  IconName,
  OPPORTUNITY_CATEGORIES,
  PROVINCES,
} from '@/types';
import { useApp } from '@/state/AppProvider';
import type { EducationLevel, OpportunityCategory, Province, WorkMode } from '@/types';

const statuses = ['Learner', 'Student', 'Graduate', 'Job seeker', 'Other'] as const;

const careerFieldOptions = [
  'Technology',
  'Finance',
  'Engineering',
  'Agriculture',
  'Education',
  'Health',
  'Marketing',
  'Tourism',
] as const;

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, updateProfile, showToast } = useApp();

  const toggleCareerField = (field: string) => {
    const fields = profile.preferences.careerFields.includes(field)
      ? profile.preferences.careerFields.filter((item) => item !== field)
      : [...profile.preferences.careerFields, field];
    updateProfile({ preferences: { ...profile.preferences, careerFields: fields } });
  };

  const toggleOpportunityType = (category: OpportunityCategory) => {
    const types = profile.notificationPreferences.opportunityTypes.includes(category)
      ? profile.notificationPreferences.opportunityTypes.filter((item) => item !== category)
      : [...profile.notificationPreferences.opportunityTypes, category];
    updateProfile({
      notificationPreferences: {
        ...profile.notificationPreferences,
        opportunityTypes: types,
      },
    });
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
      <AppHeader
        title="Profile"
        subtitle="Kept locally for this demonstration"
        action={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Settings"
            onPress={() => router.push('/settings')}
            hitSlop={8}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <Feather name="settings" size={19} color={colors.navy900} />
          </Pressable>
        }
      />

      <View style={styles.identityCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{profile.initials}</Text>
        </View>
        <View style={styles.identityCopy}>
          <Text style={styles.identityName}>{profile.name}</Text>
          <Text style={styles.identityMeta}>
            {profile.status} · {profile.province}
          </Text>
        </View>
        <View style={styles.completionPill}>
          <Text style={styles.completionPillText}>{profile.completion}%</Text>
        </View>
      </View>

      <SectionHeader title="About you" subtitle="Update your personal details" />
      <View style={styles.card}>
        <FormField
          label="Full name"
          value={profile.name}
          onChangeText={(name) => {
            const initials = name
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((part) => part[0]?.toUpperCase() ?? '')
              .join('');
            updateProfile({ name, initials });
          }}
          placeholder="Your full name"
          autoCapitalize="words"
        />
        <FormField
          label="Email"
          value={profile.email}
          onChangeText={(email) => updateProfile({ email })}
          placeholder="you@example.com"
          keyboardType="email-address"
        />
        <FormField
          label="Phone"
          value={profile.phone}
          onChangeText={(phone) => updateProfile({ phone })}
          placeholder="071 234 5678"
          keyboardType="phone-pad"
        />
        <View style={styles.chipBlock}>
          <Text style={styles.chipLabel}>Current status</Text>
          <View style={styles.chipRow}>
            {statuses.map((status) => (
              <Chip
                key={status}
                label={status}
                active={profile.status === status}
                onPress={() => updateProfile({ status: status as typeof profile.status })}
              />
            ))}
          </View>
        </View>
      </View>

      <SectionHeader title="Education" subtitle="Used to match eligibility" />
      <View style={styles.card}>
        <View style={styles.chipBlock}>
          <Text style={styles.chipLabel}>Education level</Text>
          <View style={styles.chipRow}>
            {EDUCATION_LEVELS.filter((level) => level !== 'Any level').map((level) => (
              <Chip
                key={level}
                label={level}
                active={profile.education.includes(level)}
                onPress={() => updateProfile({ education: level })}
              />
            ))}
          </View>
        </View>
        <FormField
          label="Field of study"
          value={profile.fieldOfStudy}
          onChangeText={(fieldOfStudy) => updateProfile({ fieldOfStudy })}
          placeholder="e.g. BSc Information Technology"
        />
        <FormField
          label="Institution"
          value={profile.institution}
          onChangeText={(institution) => updateProfile({ institution })}
          placeholder="e.g. University of Johannesburg"
        />
        <View style={styles.chipBlock}>
          <Text style={styles.chipLabel}>Province</Text>
          <View style={styles.chipRow}>
            {PROVINCES.map((province) => (
              <Chip
                key={province}
                label={province}
                active={profile.province === province}
                onPress={() => updateProfile({ province: province as Province })}
              />
            ))}
          </View>
        </View>
      </View>

      <SectionHeader title="Preferences" subtitle="What we should surface for you" />
      <View style={styles.card}>
        <View style={styles.chipBlock}>
          <Text style={styles.chipLabel}>Career fields of interest</Text>
          <View style={styles.chipRow}>
            {careerFieldOptions.map((field) => (
              <Chip
                key={field}
                label={field}
                active={profile.preferences.careerFields.includes(field)}
                onPress={() => toggleCareerField(field)}
              />
            ))}
          </View>
        </View>
        <FormField
          label="Preferred location"
          value={profile.preferences.preferredLocation}
          onChangeText={(preferredLocation) =>
            updateProfile({
              preferences: { ...profile.preferences, preferredLocation },
            })
          }
          placeholder="e.g. Gauteng or Remote"
        />
        <View style={styles.chipBlock}>
          <Text style={styles.chipLabel}>Work arrangement</Text>
          <View style={styles.chipRow}>
            {(['Flexible', 'On-site', 'Remote'] as const).map((arrangement) => (
              <Chip
                key={arrangement}
                label={arrangement}
                active={profile.preferences.workArrangement === arrangement}
                onPress={() =>
                  updateProfile({
                    preferences: { ...profile.preferences, workArrangement: arrangement },
                  })
                }
              />
            ))}
          </View>
        </View>
      </View>

      <SectionHeader title="Notification settings" subtitle="Choose what we alert you about" />
      <View style={styles.card}>
        {(
          [
            ['closingDates', 'Closing date reminders'],
            ['newMatches', 'New matching opportunities'],
            ['savedUpdates', 'Updates on saved opportunities'],
          ] as const
        ).map(([key, label]) => (
          <View key={key} style={settingsStyles.row}>
            <Text style={settingsStyles.rowLabel}>{label}</Text>
            <Toggle
              value={profile.notificationPreferences[key]}
              onValueChange={(value) =>
                updateProfile({
                  notificationPreferences: {
                    ...profile.notificationPreferences,
                    [key]: value,
                  },
                })
              }
              accessibilityLabel={label}
            />
          </View>
        ))}
        <View style={styles.chipBlock}>
          <Text style={styles.chipLabel}>Opportunity types</Text>
          <View style={styles.chipRow}>
            {OPPORTUNITY_CATEGORIES.map((category) => (
              <Chip
                key={category}
                label={category}
                active={profile.notificationPreferences.opportunityTypes.includes(category)}
                onPress={() => toggleOpportunityType(category)}
              />
            ))}
          </View>
        </View>
      </View>

      <SectionHeader title="More" />
      <View style={styles.linkList}>
        <LinkRow
          icon="clipboard"
          title="Application tracker"
          body="Follow each application step by step"
          onPress={() => router.push('/applications')}
        />
        <LinkRow
          icon="bookmark"
          title="Saved opportunities"
          body="Your bookmarked opportunities"
          onPress={() => router.push('/saved')}
        />
        <LinkRow
          icon="settings"
          title="Settings"
          body="Notifications and app information"
          onPress={() => router.push('/settings')}
        />
        <LinkRow
          icon="shield"
          title="Administrator demo"
          body="Illustrative admin area with local mock data"
          onPress={() => router.push('/admin')}
        />
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => {
          showToast('Demo mode: sign-in state is local only');
          router.replace('/');
        }}
        style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}
      >
        <Feather name="log-out" size={17} color={colors.red700} />
        <Text style={styles.signOutText}>Back to welcome</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function LinkRow({
  icon,
  title,
  body,
  onPress,
}: {
  icon: IconName;
  title: string;
  body: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}
    >
      <View style={styles.linkIcon}>
        <Feather name={icon} size={17} color={colors.teal700} />
      </View>
      <View style={styles.linkCopy}>
        <Text style={styles.linkTitle}>{title}</Text>
        <Text style={styles.linkBody}>{body}</Text>
      </View>
      <Feather name="chevron-right" size={19} color={colors.muted} />
    </Pressable>
  );
}

const settingsStyles = StyleSheet.create({
  row: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  rowLabel: {
    ...type.bodyStrong,
    flex: 1,
  },
});

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.surfaceSoft,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.navy950,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: colors.teal700,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...type.bodyStrong,
    color: colors.white,
    fontSize: 17,
  },
  identityCopy: {
    flex: 1,
    gap: 2,
  },
  identityName: {
    ...type.h3,
    color: colors.white,
  },
  identityMeta: {
    ...type.small,
    color: colors.teal100,
  },
  completionPill: {
    backgroundColor: colors.teal700,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  completionPillText: {
    fontFamily: type.bodyStrong.fontFamily,
    fontSize: 12,
    fontWeight: '800',
    color: colors.white,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  chipBlock: {
    gap: spacing.sm,
  },
  chipLabel: {
    fontFamily: type.bodyStrong.fontFamily,
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  linkList: {
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
  signOut: {
    marginTop: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.red50,
    backgroundColor: colors.red50,
  },
  signOutText: {
    fontFamily: type.bodyStrong.fontFamily,
    fontSize: 14,
    fontWeight: '700',
    color: colors.red700,
  },
});
