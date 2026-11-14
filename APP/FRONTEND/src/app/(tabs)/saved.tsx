import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/AppHeader';
import { EmptyState } from '@/components/EmptyState';
import { OpportunityCard } from '@/components/OpportunityCard';
import { colors, spacing, } from '@/constants/theme';
import { useApp } from '@/state/AppProvider';

export default function SavedScreen() {
  const router = useRouter();
  const { savedOpportunities, isSaved, toggleSaved } = useApp();

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
      <AppHeader
        title="Saved"
        subtitle={`${savedOpportunities.length} kept for later · synced to your account`}
      />
      {savedOpportunities.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="bookmark"
            title="Nothing saved yet"
            message="Tap the bookmark on any opportunity to keep it here for later."
            actionLabel="Browse opportunities"
            onAction={() => router.push('/explore')}
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
