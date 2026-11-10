import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/Button';
import { FormField } from '@/components/FormField';
import { colors, radius, spacing, type } from '@/constants/theme';
import { useApp } from '@/state/AppProvider';

type Mode = 'login' | 'register';

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

export default function AuthScreen() {
  const router = useRouter();
  const { showToast, reloadOpportunities } = useApp();
  const [mode, setMode] = useState<Mode>('login');
  const [form, setForm] = useState<FormState>({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const updateField = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const validate = (): boolean => {
    const nextErrors: FormErrors = {};
    if (mode === 'register' && form.name.trim().length < 2) {
      nextErrors.name = 'Please enter your full name.';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      nextErrors.email = 'Enter a valid email address.';
    }
    if (form.password.length < 6) {
      nextErrors.password = 'Password must be at least 6 characters.';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    // Simulated local sign-in for demonstration purposes only.
    // No real authentication backend is used in this phase.
    await new Promise((resolve) => setTimeout(resolve, 700));
    await reloadOpportunities();
    setSubmitting(false);
    router.replace('/(tabs)');
    showToast(mode === 'login' ? 'Signed in (demo)' : 'Account created (demo)');
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AppHeader onBack={() => router.back()} />

        <Text style={styles.title}>
          {mode === 'login' ? 'Welcome back' : 'Create your profile'}
        </Text>
        <Text style={styles.subtitle}>
          {mode === 'login'
            ? 'Sign in to your trial demo account to save and track opportunities.'
            : 'Set up a demo profile to see matching opportunities.'}
        </Text>

        <View style={styles.modeSwitch}>
          {(['login', 'register'] as Mode[]).map((option) => (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === option }}
              onPress={() => {
                setMode(option);
                setErrors({});
              }}
              style={[styles.modeOption, mode === option && styles.modeOptionActive]}
            >
              <Text style={[styles.modeText, mode === option && styles.modeTextActive]}>
                {option === 'login' ? 'Sign in' : 'Register'}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.form}>
          {mode === 'register' ? (
            <FormField
              label="Full name"
              value={form.name}
              onChangeText={(value) => updateField('name', value)}
              placeholder="e.g. Thando Nkosi"
              autoCapitalize="words"
              autoComplete="name"
              error={errors.name}
            />
          ) : null}
          <FormField
            label="Email"
            value={form.email}
            onChangeText={(value) => updateField('email', value)}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoComplete="email"
            error={errors.email}
          />
          <FormField
            label="Password"
            value={form.password}
            onChangeText={(value) => updateField('password', value)}
            placeholder="At least 6 characters"
            secureTextEntry
            autoComplete={mode === 'login' ? 'password' : 'new-password'}
            error={errors.password}
          />
        </View>

        <Button
          title={mode === 'login' ? 'Sign in' : 'Create demo profile'}
          fullWidth
          loading={submitting}
          onPress={submit}
          style={styles.submit}
        />

        <View style={styles.demoCard}>
          <Feather name="info" size={16} color={colors.teal700} />
          <Text style={styles.demoText}>
            This is a frontend demonstration. No real account is created, no
            credentials are sent anywhere, and the sample profile stays local
            on this device.
          </Text>
        </View>
      </ScrollView>
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
  submit: {
    marginTop: spacing.xxl,
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
});
