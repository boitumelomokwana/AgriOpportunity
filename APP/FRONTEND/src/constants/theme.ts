import { Platform, type TextStyle, type ViewStyle } from 'react-native';

export const colors = {
  navy950: '#061a2d',
  navy900: '#0a2540',
  navy800: '#123b5a',
  teal700: '#087b70',
  teal600: '#0b9385',
  teal100: '#d9f2ed',
  teal50: '#effaf7',
  blue50: '#eef6fb',
  amber700: '#a45d00',
  amber100: '#ffedc6',
  red700: '#b42318',
  red50: '#fff1f0',
  ink: '#17212b',
  muted: '#647382',
  line: '#dce3e8',
  surface: '#ffffff',
  surfaceSoft: '#f4f7f8',
  white: '#ffffff',
  black: '#000000',
  overlay: 'rgba(6, 26, 45, 0.45)',
  transparent: 'transparent',
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

export const fontSize = {
  xs: 11,
  sm: 12,
  base: 14,
  md: 15,
  lg: 16,
  xl: 20,
  xxl: 24,
  display: 30,
} as const;

export const shadows = {
  card: Platform.select<ViewStyle>({
    ios: {
      shadowColor: colors.navy950,
      shadowOpacity: 0.08,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
    },
    android: { elevation: 2 },
    default: {},
  }),
  floating: Platform.select<ViewStyle>({
    ios: {
      shadowColor: colors.navy950,
      shadowOpacity: 0.18,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 10 },
    },
    android: { elevation: 8 },
    default: {},
  }),
} as const;

export const fonts = {
  regular: Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }),
  medium: Platform.select({ ios: 'System', android: 'sans-serif-medium', default: 'System' }),
  semibold: Platform.select({ ios: 'System', android: 'sans-serif-medium', default: 'System' }),
  bold: Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }),
} as const;

export const type = {
  display: {
    fontFamily: fonts.bold,
    fontSize: fontSize.display,
    lineHeight: 36,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: colors.navy950,
  } satisfies TextStyle,
  h1: {
    fontFamily: fonts.bold,
    fontSize: fontSize.xxl,
    lineHeight: 30,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: colors.navy950,
  } satisfies TextStyle,
  h2: {
    fontFamily: fonts.bold,
    fontSize: fontSize.xl,
    lineHeight: 26,
    fontWeight: '800',
    letterSpacing: -0.2,
    color: colors.navy950,
  } satisfies TextStyle,
  h3: {
    fontFamily: fonts.semibold,
    fontSize: fontSize.lg,
    lineHeight: 22,
    fontWeight: '700',
    color: colors.navy950,
  } satisfies TextStyle,
  body: {
    fontFamily: fonts.regular,
    fontSize: fontSize.base,
    lineHeight: 21,
    color: colors.ink,
  } satisfies TextStyle,
  bodyStrong: {
    fontFamily: fonts.semibold,
    fontSize: fontSize.base,
    lineHeight: 21,
    fontWeight: '700',
    color: colors.ink,
  } satisfies TextStyle,
  small: {
    fontFamily: fonts.regular,
    fontSize: fontSize.sm,
    lineHeight: 17,
    color: colors.muted,
  } satisfies TextStyle,
  label: {
    fontFamily: fonts.semibold,
    fontSize: fontSize.xs,
    lineHeight: 15,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: colors.teal700,
  } satisfies TextStyle,
  caption: {
    fontFamily: fonts.regular,
    fontSize: fontSize.xs,
    lineHeight: 15,
    color: colors.muted,
  } satisfies TextStyle,
} as const;

export const layout = {
  screenPadding: spacing.xl,
  cardPadding: spacing.lg,
  maxWidth: 760,
} as const;
