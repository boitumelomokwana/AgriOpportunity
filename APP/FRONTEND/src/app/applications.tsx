import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/AppHeader';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { colors, radius, spacing, type } from '@/constants/theme';
import { useApp } from '@/state/AppProvider';
import type { ApplicationStatus } from '@/types';
import { APPLICATION_STATUSES } from '@/types';

const statusHints: Record<ApplicationStatus, string> = {
  Interested: 'You spotted this and want to keep an eye on it.',
  Applied: 'Your application has been sent through the official channel.',
  Shortlisted: 'You made the shortlist — prepare for the next stage.',
  Interview: 'An interview or selection stage is under way.',
  Offered: 'An offer has been made. Congratulations!',
  Rejected: 'This one did not work out. Keep going.',
  Withdrawn: 'You withdrew from this application.',
};

export default function ApplicationsScreen() {
  const router = useRouter();
  const { applications, opportunities, updateApplicationStatus, isSignedIn } =
    useApp();

  const records = applications.map((application) => ({
    application,
    opportunity: opportunities.find(
      (item) => item.id === application.opportunityId,
    ),
  }));

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
      <AppHeader
        title="Application tracker"
        subtitle="Follow each application from interested to outcome"
        onBack={() => router.back()}
      />

      {records.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="clipboard"
            title={isSignedIn ? 'Nothing tracked yet' : 'Sign in to track applications'}
            message={
              isSignedIn
                ? 'Open any opportunity and tap “Track this application” to follow it here.'
                : 'Sign in to keep a record of every opportunity you apply for.'
            }
            actionLabel={isSignedIn ? 'Explore opportunities' : 'Sign in'}
            onAction={() => router.push(isSignedIn ? '/explore' : '/auth')}
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        >
          {records.map(({ application, opportunity }) => (
            <View key={application.id} style={styles.card}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open ${application.opportunityTitle ?? opportunity?.title ?? 'opportunity'}`}
                onPress={() => router.push(`/opportunity/${application.opportunityId}`)}
                style={({ pressed }) => [styles.summaryRow, pressed && styles.pressed]}
              >
                <View style={styles.summaryCopy}>
                  <Text style={styles.title}>
                    {application.opportunityTitle ??
                      opportunity?.title ??
                      'Opportunity'}
                  </Text>
                  <Text style={styles.organisation}>
                    {application.opportunityOrganisation ??
                      opportunity?.organisation ??
                      ''}
                  </Text>
                  <Text style={styles.updated}>Updated {application.updatedAt}</Text>
                </View>
                <Feather name="chevron-right" size={19} color={colors.muted} />
              </Pressable>

              <View style={styles.statusRow}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {APPLICATION_STATUSES.map((status) => (
                    <Chip
                      key={status}
                      label={status}
                      active={application.status === status}
                      onPress={() => void updateApplicationStatus(application.id, status)}
                    />
                  ))}
                </ScrollView>
              </View>

              <Text style={styles.statusHint}>{statusHints[application.status]}</Text>
            </View>
          ))}
        </ScrollView>
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
