import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, spacing } from '@/constants/theme';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <View style={styles.lockup}>
      <View style={[styles.mark, compact && styles.markCompact]}>
        <View style={[styles.bar, styles.barOne]} />
        <View style={[styles.bar, styles.barTwo]} />
        <View style={[styles.bar, styles.barThree]} />
      </View>
      {!compact && (
        <View>
          <Text style={styles.name}>NextStep</Text>
          <Text style={styles.country}>SOUTH AFRICA</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  lockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  mark: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.navy950,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 3,
    paddingBottom: 9,
  },
  markCompact: {
    width: 34,
    height: 34,
    borderRadius: 10,
    paddingBottom: 7,
  },
  bar: {
    width: 5,
    borderRadius: 4,
    backgroundColor: colors.teal600,
  },
  barOne: { height: 10 },
  barTwo: { height: 16, backgroundColor: colors.teal100 },
  barThree: { height: 21 },
  name: {
    fontFamily: fonts.bold,
    fontSize: 16,
    fontWeight: '800',
    color: colors.navy950,
    letterSpacing: -0.2,
  },
  country: {
    fontFamily: fonts.semibold,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: colors.muted,
    marginTop: 1,
  },
});
