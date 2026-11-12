/** Shared header configuration for the root stack and the stack inside each tab. */
import { type NativeStackNavigationOptions, router, Stack } from 'expo-router';
import { Pressable } from 'react-native';

import { useI18n } from '@/i18n';
import { type Colors, useColors } from '@/theme';

import { Icon } from './icon';

export function stackScreenOptions(colors: Colors): NativeStackNavigationOptions {
  return {
    headerTintColor: colors.primary,
    headerTitleStyle: { color: colors.text },
    headerStyle: { backgroundColor: colors.background },
    headerShadowVisible: false,
    headerBackButtonDisplayMode: 'minimal',
    contentStyle: { backgroundColor: colors.background },
  };
}

/** Gear button in tab headers → Settings. */
export function SettingsButton() {
  const { t } = useI18n();
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.common.settings}
      onPress={() => router.push('/settings')}
      hitSlop={10}
      style={({ pressed }) => ({ padding: 6, opacity: pressed ? 0.5 : 1 })}>
      <Icon name="settings" size={24} color={colors.primary} />
    </Pressable>
  );
}

/** The stack inside a tab: one root screen with a translated title and the settings button. */
export function TabStack({ title }: { title: string }) {
  const colors = useColors();
  return (
    <Stack screenOptions={{ ...stackScreenOptions(colors), headerRight: () => <SettingsButton /> }}>
      <Stack.Screen name="index" options={{ title }} />
    </Stack>
  );
}
