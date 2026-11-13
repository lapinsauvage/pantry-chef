import { type ErrorBoundaryProps, router, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { HeaderTextButton, stackScreenOptions } from '@/components/navigation';
import { ErrorMessage } from '@/components/states';
import { recipeDb } from '@/db/recipe-db';
import { I18nProvider, useI18n } from '@/i18n';
import { useSettings } from '@/state/settings';
import { useColors, useNavigationTheme } from '@/theme';

export default function RootLayout() {
  useEffect(() => {
    // Start copying the bundled recipe database right away (slow on first launch only);
    // onboarding stays usable meanwhile. Errors surface where the database is used.
    recipeDb().catch(() => {});
  }, []);

  return (
    <I18nProvider>
      <ThemeProvider value={useNavigationTheme()}>
        <StatusBar style="auto" />
        <RootStack />
      </ThemeProvider>
    </I18nProvider>
  );
}

function RootStack() {
  const { onboarded } = useSettings();
  const { t } = useI18n();
  const colors = useColors();
  return (
    <Stack screenOptions={stackScreenOptions(colors)}>
      {/* Shown until onboarding is finished or skipped; then the guard flips to the tabs. */}
      <Stack.Protected guard={!onboarded}>
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={onboarded}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: t.common.appName }} />
        <Stack.Screen name="settings/index" options={{ title: t.settings.title }} />
        <Stack.Screen name="settings/appliances" options={{ title: t.settings.appliances }} />
        <Stack.Screen name="settings/basics" options={{ title: t.settings.basics }} />
        <Stack.Screen name="settings/diet" options={{ title: t.settings.dietAndAvoid }} />
        <Stack.Screen name="recipe/[id]" options={{ title: '' }} />
        <Stack.Screen name="cook/[id]" options={{ presentation: 'fullScreenModal', headerShown: false }} />
        <Stack.Screen
          name="pantry"
          options={{
            presentation: 'modal',
            title: t.picker.title,
            headerRight: () => <HeaderTextButton title={t.picker.done} onPress={() => router.back()} />,
          }}
        />
        <Stack.Screen
          name="filters"
          options={{
            presentation: 'modal',
            title: t.filters.title,
            headerRight: () => <HeaderTextButton title={t.filters.done} onPress={() => router.back()} />,
          }}
        />
      </Stack.Protected>
    </Stack>
  );
}

/** Last-resort error screen (e.g. the recipe database could not be imported). */
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <ErrorMessage onRetry={retry} />;
}
