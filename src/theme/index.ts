/**
 * Colours, spacing and type scale. Follows the phone's light/dark mode
 * (app.json userInterfaceStyle: automatic). Use `useColors()` in components.
 */
import { DarkTheme, DefaultTheme, type Theme } from 'expo-router';
import { type TextStyle, useColorScheme } from 'react-native';

const light = {
  background: '#F7F5F2',
  surface: '#FFFFFF',
  surfaceAlt: '#EFEBE6',
  text: '#1C1917',
  textMuted: '#635B55',
  border: '#DDD7D0',
  primary: '#C2410C',
  onPrimary: '#FFFFFF',
  primarySoft: '#FDE7D8',
  onPrimarySoft: '#7C2D12',
  danger: '#B91C1C',
  success: '#15803D',
};

export type Colors = typeof light;

const dark: Colors = {
  background: '#121110',
  surface: '#1E1C1A',
  surfaceAlt: '#2A2724',
  text: '#F5F3F0',
  textMuted: '#ADA6A0',
  border: '#3A3632',
  primary: '#FB923C',
  onPrimary: '#1C1917',
  primarySoft: '#43281A',
  onPrimarySoft: '#FED7AA',
  danger: '#F87171',
  success: '#4ADE80',
};

export const palette = { light, dark };

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

/** React Navigation theme (headers, tab bar, screen backgrounds). */
export function useNavigationTheme(): Theme {
  const isDark = useColorScheme() === 'dark';
  const base = isDark ? DarkTheme : DefaultTheme;
  const c = isDark ? dark : light;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: c.primary,
      background: c.background,
      card: c.surface,
      text: c.text,
      border: c.border,
      notification: c.primary,
    },
  };
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
/** Minimum touch target (iOS HIG 44 pt, Material 48 dp). */
export const TOUCH = 48;

export const typography = {
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 22 },
  label: { fontSize: 16, lineHeight: 22, fontWeight: '500' },
  caption: { fontSize: 13, lineHeight: 18 },
  overline: { fontSize: 13, lineHeight: 18, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
} satisfies Record<string, TextStyle>;
