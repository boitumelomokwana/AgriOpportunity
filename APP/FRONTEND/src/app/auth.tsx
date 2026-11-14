import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/Button';
import { FormField } from '@/components/FormField';
import { KeyboardAwareScrollView } from '@/components/KeyboardAwareScrollView';
import { colors, radius, spacing, type } from '@/constants/theme';
import { errorMessage } from '@/lib/errors';
import { useAuth } from '@/state/AuthProvider';
import { useApp } from '@/state/AppProvider';
import type { AdminRole, IconName } from '@/types';

type Mode = 'login' | 'register' | 'reset';
type Audience = 'student' | 'company' | 'admin';

interface FormState {
  name: string;
  email: string;
  password: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  password?: string;
}

const AUDIENCE_OPTIONS: {
  key: Audience;
  icon: IconName;
  label: string;
  hint: string;
  accent: string;
  tint: string;
}[] = [
  {
    key: 'student',
    icon: 'user',
    label: 'Student',
    hint: 'Discover and apply',
    accent: colors.teal700,
    tint: colors.teal50,
  },
  {
    key: 'company',
    icon: 'briefcase',
    label: 'Company',
    hint: 'Publish opportunities',
    accent: colors.navy800,
    tint: colors.blue50,
  },
  {
    key: 'admin',
    icon: 'shield',
    label: 'Administrator',
    hint: 'Manage the platform',
    accent: colors.amber700,
    tint: colors.amber100,
  },
];

const ADMIN_DENIED_MESSAGE =
  'You do not have administrator access. Please use Student / User Login or contact an administrator.';

const ADMIN_CHECK_FAILED_MESSAGE =
  'We could not verify administrator access right now. Please check your connection and try again.';

const COMPANY_DENIED_MESSAGE =
  'No company is linked to this account. Register your company or contact an administrator.';

const COMPANY_CHECK_FAILED_MESSAGE =
  'We could not verify company access right now. Please check your connection and try again.';

export default function AuthScreen() {
  const router = useRouter();
  const { showToast } = useApp();
  const {
    configured,
    configError,
    signIn,
    signOut,
    signUp,
    resetPassword,
    refreshAdminRole,
    refreshCompanyAccess,
  } = useAuth();
  const [audience, setAudience] = useState<Audience>('student');
  const [mode, setMode] = useState<Mode>('login');
  const [form, setForm] = useState<FormState>({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const updateField = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(null);
  };

  const selectAudience = (next: Audience) => {
    setAudience(next);
    setErrors({});
    setFormError(null);
    // Administrators sign in only; students and companies can register.
    if (next === 'admin') setMode('login');
  };

  const validate = (): boolean => {
    const nextErrors: FormErrors = {};
    if (mode === 'register' && form.name.trim().length < 2) {
      nextErrors.name =
        audience === 'company'
          ? 'Enter the contact person for this company account.'
          : 'Please enter your full name.';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      nextErrors.email = 'Enter a valid email address.';
    }
    if (mode !== 'reset') {
      if (mode === 'register' && form.password.length < 8) {
        nextErrors.password = 'Use a password of at least 8 characters.';
      } else if (mode === 'login' && form.password.length === 0) {
        nextErrors.password = 'Enter your password.';
      }
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    if (!configured) {
      setFormError(configError);
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      if (mode === 'login') {
        const session = await signIn(form.email, form.password);

        if (audience === 'admin') {
          // Authenticate normally, then verify the role against Supabase.
          // The signed-in user is never trusted just because they picked the
          // Administrator option.
          let role: AdminRole | null = null;
          try {
            role = await refreshAdminRole(session.user.id);
          } catch {
            // Fail closed: an unverifiable session must not open the dashboard.
            await signOut().catch(() => undefined);
            setFormError(ADMIN_CHECK_FAILED_MESSAGE);
            return;
          }
          if (!role) {
            await signOut().catch(() => undefined);
            setFormError(ADMIN_DENIED_MESSAGE);
            return;
          }
          router.replace('/admin');
          return;
        }

        if (audience === 'company') {
          // Company access is a membership relationship, not a label chosen on
          // this screen: verify it against organization_members.
          try {
            const organizations = await refreshCompanyAccess(session.user.id);
            if (organizations.length === 0) {
              await signOut().catch(() => undefined);
              setFormError(COMPANY_DENIED_MESSAGE);
              return;
            }
          } catch {
            await signOut().catch(() => undefined);
            setFormError(COMPANY_CHECK_FAILED_MESSAGE);
            return;
          }
          router.replace('/organization');
          return;
        }

        router.replace('/home');
      } else if (mode === 'register') {
        const result = await signUp(form.email, form.password, {
          fullName: form.name.trim(),
        });
        if (result.needsEmailConfirmation) {
          setMode('login');
          showToast(
            audience === 'company'
              ? 'Check your email to confirm the account, then sign in as Company.'
              : 'Check your email to confirm your account, then sign in.',
          );
        } else if (audience === 'company') {
          // The company profile form opens automatically on this screen.
          router.replace('/organization');
        } else {
          router.replace('/home');
        }
      } else {
        await resetPassword(form.email);
        showToast('Password reset link sent. Check your inbox.');
        setMode('login');
      }
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const isAdminLogin = audience === 'admin';
  const isCompanyLogin = audience === 'company';
  const title =
    mode === 'reset'
      ? 'Reset your password'
      : isAdminLogin
        ? 'Administrator sign in'
        : isCompanyLogin
          ? mode === 'register'
            ? 'Register your company'
            : 'Company sign in'
          : mode === 'register'
            ? 'Create your profile'
            : 'Welcome back';
  const subtitle =
    mode === 'reset'
      ? 'Enter the email you signed up with and we will send a reset link.'
      : isAdminLogin
        ? 'Use your administrator account. Your role is verified with Supabase before the dashboard opens.'
        : isCompanyLogin
          ? mode === 'register'
            ? 'Create the contact account first. You will add your company details on the next screen for review.'
            : 'Use the account linked to your company. Membership is verified with Supabase before the dashboard opens.'
          : mode === 'register'
            ? 'Create a free account to save opportunities, set reminders and track applications.'
            : 'Sign in to see your matches, saved opportunities and application progress.';

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
      <KeyboardAwareScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <AppHeader onBack={() => router.back()} />

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        <View style={styles.audienceSwitch}>
          {AUDIENCE_OPTIONS.map((option) => {
            const active = audience === option.key;
            return (
              <Pressable
                key={option.key}
                accessibilityRole="button"
                accessibilityLabel={
                  option.key === 'admin'
                    ? 'Administrator login'
                    : option.key === 'company'
                      ? 'Company login'
                      : 'Student or user login'
                }
                accessibilityState={{ selected: active }}
                onPress={() => selectAudience(option.key)}
                style={[
                  styles.audienceOption,
                  active && {
                    borderColor: option.accent,
                    backgroundColor: option.tint,
                  },
                ]}
              >
                <View
                  style={[
                    styles.audienceIcon,
                    active && { backgroundColor: colors.surface },
                  ]}
                >
                  <Feather
                    name={option.icon}
                    size={17}
                    color={active ? option.accent : colors.muted}
                  />
                </View>
                <View style={styles.audienceCopy}>
                  <Text
                    style={[
                      styles.audienceLabel,
                      active && { color: option.accent },
                    ]}
                  >
                    {option.label}
                  </Text>
                  <Text style={styles.audienceHint}>{option.hint}</Text>
                </View>
                {active ? (
                  <Feather name="check-circle" size={16} color={option.accent} />
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {mode !== 'reset' && audience !== 'admin' ? (
          <View style={styles.modeSwitch}>
            {(['login', 'register'] as const).map((option) => (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityState={{ selected: mode === option }}
                onPress={() => {
                  setMode(option);
                  setErrors({});
                  setFormError(null);
                }}
                style={[styles.modeOption, mode === option && styles.modeOptionActive]}
              >
                <Text
                  style={[styles.modeText, mode === option && styles.modeTextActive]}
                >
                  {option === 'login'
                    ? 'Sign in'
                    : audience === 'company'
                      ? 'Register company'
                      : 'Register'}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={styles.form}>
          {mode === 'register' ? (
            <FormField
              label={audience === 'company' ? 'Contact person' : 'Full name'}
              value={form.name}
              onChangeText={(value) => updateField('name', value)}
              placeholder="e.g. Thando Nkosi"
              autoCapitalize="words"
              autoComplete="name"
              error={errors.name}
              hint={
                audience === 'company'
                  ? 'The person who will manage this company account.'
                  : undefined
              }
            />
          ) : null}
          <FormField
            label="Email"
            value={form.email}
            onChangeText={(value) => updateField('email', value)}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            error={errors.email}
          />
          {mode !== 'reset' ? (
            <FormField
              label="Password"
              value={form.password}
              onChangeText={(value) => updateField('password', value)}
              placeholder={mode === 'register' ? 'At least 8 characters' : 'Your password'}
              secureTextEntry
              autoComplete={mode === 'login' ? 'password' : 'new-password'}
              error={errors.password}
            />
          ) : null}
        </View>

        {formError ? (
          <View style={styles.errorCard}>
            <Feather name="alert-triangle" size={16} color={colors.red700} />
            <Text style={styles.errorText}>{formError}</Text>
          </View>
        ) : null}

        <Button
          title={
            mode === 'reset'
              ? 'Send reset link'
              : isAdminLogin
                ? 'Sign in to admin dashboard'
                : isCompanyLogin
                  ? mode === 'login'
                    ? 'Sign in to company dashboard'
                    : 'Create company account'
                  : mode === 'login'
                    ? 'Sign in'
                    : 'Create account'
          }
          fullWidth
          loading={submitting}
          onPress={() => void submit()}
          style={styles.submit}
        />

        {isAdminLogin && mode !== 'reset' ? (
          <Text style={styles.adminNote}>
            Administrator access is checked against the{' '}
            <Text style={styles.adminNoteStrong}>admin_roles</Text> table in Supabase. Students
            should use Student / User login.
          </Text>
        ) : null}

        {isCompanyLogin && mode !== 'reset' ? (
          <Text style={styles.adminNote}>
            Company access is checked against{' '}
            <Text style={styles.adminNoteStrong}>organization_members</Text> in Supabase. New
            companies start as pending and can publish once approved.
          </Text>
        ) : null}

        {mode === 'login' ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setMode('reset');
              setErrors({});
              setFormError(null);
            }}
            style={({ pressed }) => [styles.helperLink, pressed && styles.pressed]}
          >
            <Text style={styles.helperLinkText}>Forgot your password?</Text>
          </Pressable>
        ) : null}

        {mode === 'reset' ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setMode('login');
              setErrors({});
              setFormError(null);
            }}
            style={({ pressed }) => [styles.helperLink, pressed && styles.pressed]}
          >
            <Text style={styles.helperLinkText}>Back to sign in</Text>
          </Pressable>
        ) : null}

        <View style={styles.demoCard}>
          <Feather name="shield" size={16} color={colors.teal700} />
          <Text style={styles.demoText}>
            Your account is secured by Supabase Auth. Your password is never
            stored by this app, and what you save follows your account across
            devices.
          </Text>
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.surfaceSoft,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  title: {
    ...type.h1,
    marginTop: spacing.md,
  },
  subtitle: {
    ...type.body,
    color: colors.muted,
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  audienceSwitch: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  audienceOption: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  audienceOptionActive: {
    borderColor: colors.teal600,
    backgroundColor: colors.teal50,
  },
  audienceIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSoft,
  },
  audienceIconActive: {
    backgroundColor: colors.teal100,
  },
  audienceCopy: {
    flex: 1,
    gap: 1,
  },
  audienceLabel: {
    ...type.bodyStrong,
    color: colors.navy900,
  },
  audienceLabelActive: {
    color: colors.teal700,
  },
  audienceHint: {
    ...type.caption,
  },
  adminNote: {
    ...type.caption,
    marginTop: spacing.md,
    textAlign: 'center',
    lineHeight: 16,
  },
  adminNoteStrong: {
    ...type.caption,
    fontWeight: '700',
    color: colors.teal700,
  },
  modeSwitch: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  modeOption: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeOptionActive: {
    backgroundColor: colors.teal700,
  },
  modeText: {
    ...type.bodyStrong,
    color: colors.muted,
  },
  modeTextActive: {
    color: colors.white,
  },
  form: {
    marginTop: spacing.xl,
    gap: spacing.lg,
  },
  errorCard: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.red50,
    borderWidth: 1,
    borderColor: colors.red50,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  errorText: {
    ...type.small,
    color: colors.red700,
    flex: 1,
  },
  submit: {
    marginTop: spacing.xxl,
  },
  helperLink: {
    alignSelf: 'center',
    paddingVertical: spacing.md,
  },
  helperLinkText: {
    ...type.bodyStrong,
    color: colors.teal700,
  },
  demoCard: {
    marginTop: spacing.xl,
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.teal50,
    borderWidth: 1,
    borderColor: colors.teal100,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  demoText: {
    ...type.small,
    color: colors.teal700,
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
});
