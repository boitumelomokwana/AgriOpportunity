import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { ToastHost } from '@/components/ToastHost';
import { colors } from '@/constants/theme';
import { AppProvider } from '@/state/AppProvider';

export default function RootLayout() {
  return (
    <AppProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.surfaceSoft },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="search" />
        <Stack.Screen name="filters" options={{ presentation: 'modal' }} />
        <Stack.Screen name="opportunity/[id]" />
        <Stack.Screen name="matches" />
        <Stack.Screen name="applications" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="admin" />
      </Stack>
      <ToastHost />
    </AppProvider>
  );
}
