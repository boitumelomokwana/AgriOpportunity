import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { FormField } from '@/components/FormField';
import { SectionHeader } from '@/components/SectionHeader';
import { StatCard } from '@/components/StatCard';
import { colors, radius, spacing, type } from '@/constants/theme';
import { OPPORTUNITY_CATEGORIES, PROVINCES, type AdminListing } from '@/types';
import { adminAttentionThresholdDays } from '@/data/admin';
import { useApp } from '@/state/AppProvider';
import { daysUntil, formatShortDate } from '@/utils/date';

type EditorError = { title?: string; organisation?: string };

function emptyListing(): AdminListing {
  const closingDate = formatShortDate(new Date());
  return {
    id: `adm-${Date.now()}`,
    title: '',
    organisation: '',
    category: 'Bursary',
    province: 'Gauteng',
    closes: closingDate,
    closingDate,
    status: 'Draft',
    description: '',
    education: '',
    eligibility: '',
    openingDate: formatShortDate(new Date()),
    applicationMethod: 'External official website',
    sourceUrl: '',
    sourceChecked: new Date().toISOString(),
  };
}

export default function AdminScreen() {
  const router = useRouter();
  const {
    adminListings,
    adminSummary,
    adminAttention,
    saveAdminListing,
    markSourceChecked,
    showToast,
  } = useApp();

  const [editing, setEditing] = useState<AdminListing | null>(null);
  const [editingIsNew, setEditingIsNew] = useState(false);
  const [errors, setErrors] = useState<EditorError>({});

  const patch = (part: Partial<AdminListing>) =>
    setEditing((current) => (current ? { ...current, ...part } : current));

  const startEdit = (listing: AdminListing) => {
    setEditing({ ...listing });
    setEditingIsNew(false);
    setErrors({});
  };

  const startNew = () => {
    setEditing(emptyListing());
    setEditingIsNew(true);
    setErrors({});
  };

  const closeEditor = () => {
    setEditing(null);
    setErrors({});
  };

  const submit = (mode: 'draft' | 'publish') => {
    if (!editing) return;
    const nextErrors: EditorError = {};
    if (editing.title.trim().length < 3) nextErrors.title = 'Give the listing a title.';
    if (editing.organisation.trim().length < 2) {
      nextErrors.organisation = 'Which organisation is offering this?';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const closingDate = new Date(
      Number.isNaN(Date.parse(editing.closingDate)) ? Date.now() : Date.parse(editing.closingDate),
    );
    const listing: AdminListing = {
      ...editing,
      closingDate: closingDate.toISOString(),
      closes: formatShortDate(closingDate),
    };
    saveAdminListing(listing, mode);
    closeEditor();
  };

  const summaryStatusTone = useMemo(
    () => ({
      Published: 'green',
      Draft: 'blue',
      'Closing soon': 'amber',
      Expired: 'red',
    }) as const,
    [],
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
      <AppHeader
        title="Admin area"
        subtitle="Demonstration with mock data"
        onBack={() => router.back()}
        action={
          editing ? undefined : (
            <Pressable
              accessibilityRole="button"
              onPress={startNew}
              hitSlop={8}
              style={({ pressed }) => [styles.newButton, pressed && styles.pressed]}
            >
              <Feather name="plus" size={16} color={colors.teal700} />
              <Text style={styles.newButtonText}>New</Text>
            </Pressable>
          )
        }
      />

      <View style={styles.noticeCard}>
        <Feather name="shield" size={16} color={colors.teal700} />
        <Text style={styles.noticeText}>
          Administrator demonstration area. Summaries, listings and approval
          actions all operate on local mock data — nothing is published
          anywhere.
        </Text>
      </View>

      {editing ? (
        <View style={styles.editorCard}>
          <SectionHeader
            title={editingIsNew ? 'New listing' : `Edit: ${editing.title || 'listing'}`}
            actionLabel="Close"
            onAction={closeEditor}
          />
          <FormField
            label="Title"
            value={editing.title}
            onChangeText={(title) => {
              patch({ title });
              setErrors((current) => ({ ...current, title: undefined }));
            }}
            placeholder="e.g. Municipal Finance Internship"
            error={errors.title}
          />
          <FormField
            label="Organisation"
            value={editing.organisation}
            onChangeText={(organisation) => {
              patch({ organisation });
              setErrors((current) => ({ ...current, organisation: undefined }));
            }}
            placeholder="e.g. Mpumalanga Municipal Partnership"
            error={errors.organisation}
          />
          <View style={styles.chipBlock}>
            <Text style={styles.chipLabel}>Category</Text>
            <View style={styles.chipRow}>
              {OPPORTUNITY_CATEGORIES.map((category) => (
                <Chip
                  key={category}
                  label={category}
                  active={editing.category === category}
                  onPress={() => patch({ category })}
                />
              ))}
            </View>
          </View>
          <View style={styles.chipBlock}>
            <Text style={styles.chipLabel}>Province</Text>
            <View style={styles.chipRow}>
              {PROVINCES.map((province) => (
                <Chip
                  key={province}
                  label={province}
                  active={editing.province === province}
                  onPress={() => patch({ province })}
                />
              ))}
            </View>
          </View>
          <FormField
            label="Education level"
            value={editing.education}
            onChangeText={(education) => patch({ education })}
            placeholder="e.g. Grade 12 / Undergraduate"
          />
          <FormField
            label="Closing date (ISO or YYYY-MM-DD)"
            value={editing.closingDate.slice(0, 10)}
            onChangeText={(value) => patch({ closingDate: value })}
            placeholder="2026-12-31"
            keyboardType="numbers-and-punctuation"
          />
          <FormField
            label="Description"
            value={editing.description}
            onChangeText={(description) => patch({ description })}
            placeholder="Short summary shown to young people"
            multiline
            maxLength={280}
          />
          <FormField
            label="Eligibility"
            value={editing.eligibility}
            onChangeText={(eligibility) => patch({ eligibility })}
            placeholder="Key requirements, separated by semicolons"
            multiline
            maxLength={280}
          />
          <FormField
            label="Official source URL"
            value={editing.sourceUrl}
            onChangeText={(sourceUrl) => patch({ sourceUrl })}
            placeholder="https://…"
            keyboardType="url"
          />
          <View style={styles.editorActions}>
            <Button
              title="Save draft"
              variant="secondary"
              onPress={() => submit('draft')}
            />
            <Button title="Publish (demo)" onPress={() => submit('publish')} />
          </View>
        </View>
      ) : (
        <>
          <View style={styles.statRow}>
            <StatCard label="Active" value={adminSummary.active} icon="zap" tone="green" />
            <StatCard label="Drafts" value={adminSummary.drafts} icon="edit-3" tone="blue" />
            <StatCard label="Closing soon" value={adminSummary.closingSoon} icon="clock" tone="amber" />
            <StatCard label="Expired" value={adminSummary.expired} icon="calendar" tone="red" />
          </View>

          <SectionHeader
            title={`Needs source check (${adminAttention.length})`}
            subtitle={`Not verified in over ${adminAttentionThresholdDays} days`}
          />
          <View style={styles.list}>
            {adminAttention.map((listing) => (
              <View key={listing.id} style={styles.attentionCard}>
                <View style={styles.attentionCopy}>
                  <Text style={styles.listingTitle}>{listing.title}</Text>
                  <Text style={styles.listingMeta}>
                    Last checked {formatShortDate(listing.sourceChecked)}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => markSourceChecked(listing.id)}
                  hitSlop={6}
                  style={({ pressed }) => [styles.checkButton, pressed && styles.pressed]}
                >
                  <Feather name="check-circle" size={15} color={colors.teal700} />
                  <Text style={styles.checkButtonText}>Mark checked</Text>
                </Pressable>
              </View>
            ))}
          </View>

          <SectionHeader
            title={`All listings (${adminListings.length})`}
            subtitle="Tap a listing to edit or republish"
          />
          <View style={styles.list}>
            {adminListings.map((listing) => {
              const remaining = daysUntil(listing.closingDate);
              return (
                <Pressable
                  key={listing.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${listing.title}`}
                  onPress={() => startEdit(listing)}
                  style={({ pressed }) => [styles.listingCard, pressed && styles.pressed]}
                >
                  <View style={styles.listingTop}>
                    <View style={styles.listingCopy}>
                      <Text style={styles.listingTitle}>{listing.title}</Text>
                      <Text style={styles.listingMeta}>
                        {listing.organisation} · {listing.province}
                      </Text>
                    </View>
                    <View
                    style={[
                      styles.statusPill,
                      statusPillStyles[listing.status].pill,
                    ]}
                  >
                    <Text style={[styles.statusText, statusPillStyles[listing.status].text]}>
                      {listing.status}
                    </Text>
                  </View>
                  </View>
                  <Text style={styles.listingMeta}>
                    {remaining < 0 ? 'Closed' : `Closes in ${remaining} days`}{listing.closes ? ` · ${listing.closes}` : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.surfaceSoft,
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.teal100,
    backgroundColor: colors.teal50,
    paddingHorizontal: spacing.md,
  },
  newButtonText: {
    fontFamily: type.bodyStrong.fontFamily,
    fontSize: 13,
    fontWeight: '700',
    color: colors.teal700,
  },
  noticeCard: {
    marginTop: spacing.md,
    marginHorizontal: spacing.xl,
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
  statRow: {
    marginTop: spacing.xl,
    marginHorizontal: spacing.xl,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  editorCard: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    gap: spacing.lg,
    marginBottom: spacing.xxxl,
  },
  editorActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
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
  list: {
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  attentionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.amber100,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  attentionCopy: {
    flex: 1,
    gap: 2,
  },
  checkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    minHeight: 36,
    paddingHorizontal: spacing.md,
  },
  checkButtonText: {
    fontFamily: type.bodyStrong.fontFamily,
    fontSize: 12,
    fontWeight: '700',
    color: colors.teal700,
  },
  listingCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  listingTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  listingCopy: {
    flex: 1,
    gap: 2,
  },
  listingTitle: {
    ...type.h3,
    fontSize: 15,
  },
  listingMeta: {
    ...type.small,
  },
  statusPill: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontFamily: type.bodyStrong.fontFamily,
    fontSize: 10,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.85,
  },
});

import type { AdminListingStatus } from '@/types';

const statusPillStyles: Record<AdminListingStatus, { pill: object; text: object }> = {
  Published: { pill: { backgroundColor: colors.teal50 }, text: { color: colors.teal700 } },
  Draft: { pill: { backgroundColor: colors.blue50 }, text: { color: colors.navy800 } },
  'Closing soon': { pill: { backgroundColor: colors.amber100 }, text: { color: colors.amber700 } },
  Expired: { pill: { backgroundColor: colors.red50 }, text: { color: colors.red700 } },
};
