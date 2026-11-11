import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/AppHeader';
import { EmptyState } from '@/components/EmptyState';
import { OpportunityCard } from '@/components/OpportunityCard';
import { colors, spacing, } from '@/constants/theme';
import { useApp } from '@/state/AppProvider';

export default function SavedScreen() {
  const router = useRouter();
  const { isAuthenticated, savedOpportunities, isSaved, toggleSaved } = useApp();

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
      <AppHeader
        title="Saved"
        subtitle={isAuthenticated ? `${savedOpportunities.length} saved opportunities` : 'Sign in to sync your saved opportunities'}
      />
      {!isAuthenticated || savedOpportunities.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon={isAuthenticated ? 'bookmark' : 'user'}
            title={isAuthenticated ? 'Nothing saved yet' : 'Sign in to see saved items'}
            message={isAuthenticated
              ? 'Tap the bookmark on any opportunity to keep it here for later.'
              : 'Your saved opportunities are linked to your account.'}
            actionLabel={isAuthenticated ? 'Browse opportunities' : 'Sign in'}
            onAction={() => router.push(isAuthenticated ? '/explore' : '/auth')}
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        >
          {savedOpportunities.map((opportunity) => (
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

// A simple padded scroll wrapper keeps the list spacing consistent.
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surfaceSoft },
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
