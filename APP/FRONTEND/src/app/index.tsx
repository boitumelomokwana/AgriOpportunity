import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand } from '@/components/Brand';
import { Button } from '@/components/Button';
import { colors, radius, spacing, type } from '@/constants/theme';
import { useAuth } from '@/state/AuthProvider';

const points = [
  {
    icon: 'compass',
    title: 'Discover real opportunities',
    body: 'Bursaries, internships, learnerships, graduate programmes and jobs across all nine provinces.',
  },
  {
    icon: 'sliders',
    title: 'Filter to what fits',
    body: 'Search by category, province, education level and closing date in a few taps.',
  },
  {
    icon: 'bookmark',
    title: 'Save and track',
    body: 'Bookmark opportunities and follow each application from interested to outcome.',
  },
] as const;

export default function WelcomeScreen() {
  const router = useRouter();
  const { loading, session, configError } = useAuth();

  useEffect(() => {
    if (!loading && session) router.replace('/home');
  }, [loading, session, router]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
      <View style={styles.heroBackground} />
      <View style={styles.content}>
        <View style={styles.brandRow}>
          <Brand />
        </View>

        <View style={styles.hero}>
          <Text style={styles.kicker}>SOUTH AFRICA</Text>
          <Text style={styles.heading}>Your next step starts here</Text>
          <Text style={styles.subheading}>
            Discover agriculture, skills and youth opportunities in one place —
            then save, track and apply with confidence.
          </Text>
        </View>

        <View style={styles.cardStack}>
          {points.map((point) => (
            <View key={point.title} style={styles.pointCard}>
              <View style={styles.iconWrap}>
                <Feather name={point.icon} size={18} color={colors.teal700} />
              </View>
              <View style={styles.pointCopy}>
                <Text style={styles.pointTitle}>{point.title}</Text>
                <Text style={styles.pointBody}>{point.body}</Text>
              </View>
            </View>
          ))}
        </View>

        {configError ? (
          <View style={styles.configCard}>
            <Feather name="alert-triangle" size={16} color={colors.red700} />
            <Text style={styles.configText}>{configError}</Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          <Button
            title="Get started"
            fullWidth
            onPress={() => router.push('/auth')}
          />
          <Button
            title="Explore opportunities first"
            variant="secondary"
            fullWidth
            onPress={() => router.replace('/home')}
          />
          <Text style={styles.demoNote}>
            Sign in to save opportunities, set reminders and track applications.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.surfaceSoft,
  },
  heroBackground: {
    position: 'absolute',
    top: -140,
    left: -80,
    right: -80,
    height: 340,
    backgroundColor: colors.navy950,
    borderBottomLeftRadius: radius.xl * 2,
    borderBottomRightRadius: radius.xl * 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  brandRow: {
    marginTop: spacing.lg,
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    padding: spacing.sm,
    paddingRight: spacing.md,
    borderWidth: 1,
    borderColor: colors.teal100,
  },
  hero: {
    marginTop: spacing.xxl,
    gap: spacing.sm,
  },
  kicker: {
    ...type.label,
    color: colors.teal600,
  },
  heading: {
    ...type.display,
    color: colors.white,
    fontSize: 31,
  },
  subheading: {
    ...type.body,
    color: colors.teal100,
  },
  cardStack: {
    marginTop: spacing.xxl,
    gap: spacing.md,
  },
  pointCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.teal50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointCopy: {
    flex: 1,
    gap: 2,
  },
  pointTitle: {
    ...type.bodyStrong,
  },
  pointBody: {
    ...type.small,
  },
  configCard: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.red50,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  configText: {
    ...type.small,
    color: colors.red700,
    flex: 1,
  },
  actions: {
    marginTop: 'auto',
    paddingTop: spacing.xxl,
    gap: spacing.md,
  },
  demoNote: {
    ...type.caption,
    textAlign: 'center',
  },
});
