import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { AppHeader } from '@/components/AppHeader';
import { EmptyState } from '@/components/EmptyState';
import { OpportunityCard } from '@/components/OpportunityCard';
import { colors, radius, spacing, type } from '@/constants/theme';
import { getMatchingOpportunities } from '@/services/opportunityService';
import { useApp } from '@/state/AppProvider';

export default function MatchesScreen() {
  const router = useRouter();
  const { opportunities, profile, isSaved, toggleSaved, isSignedIn } = useApp();

  const matches = useMemo(() => getMatchingOpportunities(opportunities), [opportunities]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
      <AppHeader
        title="Matches"
        subtitle={
          isSignedIn
            ? `Scored against ${profile.name.split(' ')[0]}'s interests, field and province`
            : 'Sign in to see your personal matches'
        }
        onBack={() => router.back()}
      />

      <View style={styles.explainerCard}>
        <Feather name="target" size={17} color={colors.teal700} />
        <Text style={styles.explainerText}>
          Match scores are transparent: 35 points for an interest match, 25 for
          your field of study, 20 for your province or remote work, 10 for
          education level and 10 for still being open. Every score explains
          itself on the opportunity page.
        </Text>
      </View>

      {matches.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="target"
            title={isSignedIn ? 'No matches yet' : 'Sign in to see matches'}
            message={
              isSignedIn
                ? 'Add more interests, your field of study and province, or browse all open opportunities.'
                : 'Your profile drives the score. Create an account, add your interests, and matches will appear here.'
            }
            actionLabel={isSignedIn ? 'Explore opportunities' : 'Sign in'}
            onAction={() =>
              router.push(isSignedIn ? '/explore' : '/auth')
            }
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        >
          {matches.map((opportunity) => (
            <OpportunityCard
              key={opportunity.id}
              opportunity={opportunity}
              saved={isSaved(opportunity.id)}
              onSave={() => toggleSaved(opportunity.id)}
              onOpen={() => router.push(`/opportunity/${opportunity.id}`)}
            />
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
  explainerCard: {
    marginTop: spacing.md,
    marginHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: colors.teal50,
    borderWidth: 1,
    borderColor: colors.teal100,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  explainerText: {
    fontFamily: type.body.fontFamily,
    fontSize: 13,
    lineHeight: 19,
    color: colors.teal700,
    flex: 1,
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
});
