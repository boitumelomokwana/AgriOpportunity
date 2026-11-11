import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { AppHeader } from '@/components/AppHeader';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { SectionHeader } from '@/components/SectionHeader';
import { colors, radius, spacing, type } from '@/constants/theme';
import { useApp } from '@/state/AppProvider';
import type { ApplicationStatus } from '@/types';
import { APPLICATION_STATUSES } from '@/types';

const statusHints: Record<ApplicationStatus, string> = {
  Interested: 'You spotted this and want to keep an eye on it.',
  Preparing: 'You are gathering documents or drafting responses.',
  Applied: 'You marked that you applied through the official channel.',
  Interview: 'An interview or selection stage is under way.',
  Outcome: 'A decision has been recorded for this demo entry.',
};

export default function ApplicationsScreen() {
  const router = useRouter();
  const {
    isAuthenticated,
    applications,
    opportunities,
    updateApplicationStatus,
    showToast,
  } = useApp();

  if (!isAuthenticated) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
        <AppHeader
          title="Application tracker"
          subtitle="Sign in to track your progress"
          onBack={() => router.back()}
        />
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="user"
            title="Sign in to track applications"
            message="Your application tracker is attached to your account."
            actionLabel="Sign in"
            onAction={() => router.push('/auth')}
          />
        </View>
      </SafeAreaView>
    );
  }

  const records = applications
    .map((application) => ({
      application,
      opportunity: opportunities.find((item) => item.id === application.opportunityId),
    }))
    .filter((entry) => entry.opportunity);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
      <AppHeader
        title="Application tracker"
        subtitle="Track your progress; apply through each official source"
        onBack={() => router.back()}
      />

      {records.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="clipboard"
            title="Nothing tracked yet"
            message="Open any opportunity and tap “Track this application” to start following it here."
            actionLabel="Explore opportunities"
            onAction={() => router.push('/explore')}
          />
        </View>
      ) : (
        <View style={styles.list}>
          {records.map(({ application, opportunity }) => (
            <View key={application.id} style={styles.card}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open ${opportunity?.title}`}
                onPress={() => router.push(`/opportunity/${opportunity?.id}`)}
                style={({ pressed }) => [styles.summaryRow, pressed && styles.pressed]}
              >
                <View style={styles.summaryCopy}>
                  <Text style={styles.title}>{opportunity?.title}</Text>
                  <Text style={styles.organisation}>{opportunity?.organisation}</Text>
                  <Text style={styles.updated}>Updated {application.updatedAt}</Text>
                </View>
                <Feather name="chevron-right" size={19} color={colors.muted} />
              </Pressable>

              <View style={styles.statusRow}>
                {APPLICATION_STATUSES.map((status) => (
                  <Chip
                    key={status}
                    label={status}
                    active={application.status === status}
                    onPress={() => {
                      updateApplicationStatus(application.id, status);
                      // No data leaves the device in this demo.
                      showToast(`Marked as ${status.toLowerCase()} (demo)`);
                    }}
                  />
                ))}
              </View>

              <Text style={styles.statusHint}>{statusHints[application.status]}</Text>
            </View>
          ))}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.surfaceSoft,
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  list: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    gap: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  summaryCopy: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...type.h3,
    fontSize: 16,
  },
  organisation: {
    ...type.small,
  },
  updated: {
    ...type.caption,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  statusHint: {
    ...type.caption,
  },
  pressed: {
    opacity: 0.7,
  },
});
