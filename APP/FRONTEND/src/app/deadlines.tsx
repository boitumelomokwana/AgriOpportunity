import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/AppHeader';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { SectionHeader } from '@/components/SectionHeader';
import { colors, radius, spacing, type } from '@/constants/theme';
import { errorMessage } from '@/lib/errors';
import {
  discoveryService,
  type UpcomingDeadline,
} from '@/services/discoveryService';
import { useApp } from '@/state/AppProvider';
import { useAuth } from '@/state/AuthProvider';
import { formatShortDate } from '@/utils/date';

export default function DeadlinesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    applications,
    isSignedIn,
    reminders,
    removeReminder,
    savedIds,
    setReminder,
  } = useApp();

  const userId = user?.id;
  const [items, setItems] = useState<UpcomingDeadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const trackedKey = useMemo(
    () =>
      [
        savedIds.join(','),
        applications.map((application) => application.opportunityId).join(','),
        reminders.map((reminder) => reminder.opportunityId).join(','),
      ].join('|'),
    [savedIds, applications, reminders],
  );

  const load = useCallback(async () => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await discoveryService.listUpcomingDeadlines(userId, 45);
      setItems(data);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
    // The key intentionally changes when bookmarks, applications or reminders
    // change so the list stays in step with the rest of the app.
  }, [load, trackedKey]);

  const remindedIds = useMemo(
    () => new Set(reminders.map((reminder) => reminder.opportunityId)),
    [reminders],
  );

  const records = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        reminded: remindedIds.has(item.opportunity.id),
      })),
    [items, remindedIds],
  );

  const thisWeek = records.filter((record) => record.daysLeft <= 7);
  const later = records.filter((record) => record.daysLeft > 7);

  const toggleReminder = (opportunityId: string, reminded: boolean) => {
    if (reminded) {
      void removeReminder(opportunityId);
    } else {
      void setReminder(opportunityId, 7);
    }
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
      <AppHeader
        title="Upcoming deadlines"
        subtitle="Saved, tracked and reminded opportunities"
        onBack={() => router.back()}
      />

      {!isSignedIn ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="clock"
            title="Sign in to see your deadlines"
            message="Deadlines for opportunities you save, track or set a reminder for appear here."
            actionLabel="Sign in"
            onAction={() => router.push('/auth')}
          />
        </View>
      ) : loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.teal700} />
          <Text style={styles.loadingText}>Checking your closing dates…</Text>
        </View>
      ) : error ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="alert-triangle"
            title="Could not load deadlines"
            message={error}
            actionLabel="Try again"
            onAction={() => void load()}
          />
        </View>
      ) : records.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="clock"
            title="No deadlines in the next 45 days"
            message="Save or track an opportunity with an upcoming closing date and it will show up here."
            actionLabel="Explore opportunities"
            onAction={() => router.push('/explore')}
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.noticeCard}>
            <Feather name="bell" size={16} color={colors.teal700} />
            <Text style={styles.noticeText}>
              Set a reminder and we will alert you seven days before the closing
              date. Times shown are South African dates.
            </Text>
          </View>

          <DeadlineSection
            title="This week"
            subtitle={`${thisWeek.length} closing within 7 days`}
            records={thisWeek}
            onOpen={(id) => router.push(`/opportunity/${id}`)}
            onToggleReminder={toggleReminder}
          />

          <DeadlineSection
            title="Coming up"
            subtitle={`${later.length} closing later`}
            records={later}
            onOpen={(id) => router.push(`/opportunity/${id}`)}
            onToggleReminder={toggleReminder}
          />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function DeadlineSection({
  title,
  subtitle,
  records,
  onOpen,
  onToggleReminder,
}: {
  title: string;
  subtitle: string;
  records: (UpcomingDeadline & { reminded: boolean })[];
  onOpen: (opportunityId: string) => void;
  onToggleReminder: (opportunityId: string, reminded: boolean) => void;
}) {
  if (records.length === 0) return null;

  return (
    <>
      <SectionHeader title={title} subtitle={subtitle} />
      <View style={styles.list}>
        {records.map((record) => {
          const { opportunity } = record;
          const closingLabel =
            record.daysLeft === 0
              ? 'Closes today'
              : `Closes in ${record.daysLeft} day${record.daysLeft === 1 ? '' : 's'}`;
          const urgent = record.daysLeft <= 3;

          return (
            <View key={opportunity.id} style={styles.card}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open ${opportunity.title}`}
                onPress={() => onOpen(opportunity.id)}
                style={({ pressed }) => [styles.cardTop, pressed && styles.pressed]}
              >
                <View style={styles.dateBadge}>
                  <Text style={styles.dateBadgeDay}>
                    {new Date(`${opportunity.closingDate}T00:00:00`).getDate()}
                  </Text>
                  <Text style={styles.dateBadgeMonth}>
                    {formatShortDate(opportunity.closingDate).split(' ')[1]}
                  </Text>
                </View>
                <View style={styles.cardCopy}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {opportunity.title}
                  </Text>
                  <Text style={styles.cardMeta} numberOfLines={1}>
                    {opportunity.organisation}
                  </Text>
                  <View style={styles.pillRow}>
                    <Chip
                      label={closingLabel}
                      tone={urgent ? 'red' : 'amber'}
                      icon="clock"
                    />
                    <Chip label={opportunity.category} tone="teal" />
                  </View>
                </View>
                <Feather name="chevron-right" size={19} color={colors.muted} />
              </Pressable>

              <View style={styles.cardFooter}>
                <Text style={styles.closingDate}>
                  Closing date {formatShortDate(opportunity.closingDate)}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: record.reminded }}
                  onPress={() => onToggleReminder(opportunity.id, record.reminded)}
                  hitSlop={6}
                  style={({ pressed }) => [
                    styles.reminderButton,
                    record.reminded && styles.reminderButtonOn,
                    pressed && styles.pressed,
                  ]}
                >
                  <Feather
                    name={record.reminded ? 'bell-off' : 'bell'}
                    size={14}
                    color={record.reminded ? colors.teal700 : colors.navy800}
                  />
                  <Text
                    style={[
                      styles.reminderText,
                      record.reminded && styles.reminderTextOn,
                    ]}
                  >
                    {record.reminded ? 'Reminder on' : 'Remind me'}
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>
    </>
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
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    ...type.small,
  },
  noticeCard: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.blue50,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  noticeText: {
    ...type.small,
    color: colors.navy800,
    flex: 1,
  },
  list: {
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
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  dateBadge: {
    width: 52,
    borderRadius: radius.sm,
    backgroundColor: colors.teal50,
    borderWidth: 1,
    borderColor: colors.teal100,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  dateBadgeDay: {
    fontFamily: type.h2.fontFamily,
    fontSize: 20,
    fontWeight: '800',
    color: colors.teal700,
    lineHeight: 23,
  },
  dateBadgeMonth: {
    fontFamily: type.label.fontFamily,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.teal700,
  },
  cardCopy: {
    flex: 1,
    gap: 3,
  },
  cardTitle: {
    ...type.h3,
    fontSize: 15,
  },
  cardMeta: {
    ...type.small,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.md,
  },
  closingDate: {
    ...type.caption,
    flex: 1,
  },
  reminderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 34,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  reminderButtonOn: {
    borderColor: colors.teal100,
    backgroundColor: colors.teal50,
  },
  reminderText: {
    fontFamily: type.bodyStrong.fontFamily,
    fontSize: 12,
    fontWeight: '700',
    color: colors.navy800,
  },
  reminderTextOn: {
    color: colors.teal700,
  },
  pressed: {
    opacity: 0.7,
  },
});
