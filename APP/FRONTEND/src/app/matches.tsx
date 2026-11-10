import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
  const { opportunities, profile, isSaved, toggleSaved } = useApp();

  const matches = useMemo(() => getMatchingOpportunities(opportunities), [opportunities]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
      <AppHeader
        title="Matches"
        subtitle={`Illustrative match scores for ${profile.name.split(' ')[0]}`}
        onBack={() => router.back()}
      />

      <View style={styles.explainerCard}>
        <Feather name="target" size={17} color={colors.teal700} />
        <Text style={styles.explainerText}>
          Match scores are generated illustratively for the demo and compare
          the listing field, education level and province with your profile.
          Scores are not real predictions — always read the official
          requirements before applying.
        </Text>
      </View>

      {matches.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="target"
            title="No matches yet"
            message="Fill in more of your profile, or browse all open opportunities."
            actionLabel="Explore opportunities"
            onAction={() => router.push('/explore')}
          />
        </View>
      ) : (
        <View style={styles.list}>
          {matches.map((opportunity) => (
            <OpportunityCard
              key={opportunity.id}
              opportunity={opportunity}
              saved={isSaved(opportunity.id)}
              onSave={() => toggleSaved(opportunity.id)}
              onOpen={() => router.push(`/opportunity/${opportunity.id}`)}
            />
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
