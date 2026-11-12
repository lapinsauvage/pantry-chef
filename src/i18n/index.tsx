/**
 * UI language: the user's choice in Settings, or the phone's language ('system').
 *   const { t, lang } = useI18n();   <Text>{t.settings.title}</Text>
 *   EQUIPMENT[0].label[lang]          // labels shared with the data pipeline
 */
import { getLocales, useLocales } from 'expo-localization';
import { createContext, type ReactNode, use, useMemo } from 'react';

import type { Lang } from '@/lib/constants';
import { type LanguagePref, resolveLanguage } from '@/lib/settings';
import { settingsStore, useSettings } from '@/state/settings';

import { en, type Translations } from './en';
import { fr } from './fr';

export type { Translations };
export const translations: Record<Lang, Translations> = { en, fr };

export interface I18n {
  lang: Lang;
  t: Translations;
  /** Language the phone is set to (for "System default (Français)"). */
  systemLang: Lang;
}

const I18nContext = createContext<I18n | null>(null);

function build(pref: LanguagePref, deviceCodes: (string | null)[]): I18n {
  const lang = resolveLanguage(pref, deviceCodes);
  return { lang, t: translations[lang], systemLang: resolveLanguage('system', deviceCodes) };
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const { language } = useSettings();
  const locales = useLocales(); // re-renders when the phone's language changes (Android)
  const value = useMemo(() => build(language, locales.map((l) => l.languageCode)), [language, locales]);
  return <I18nContext value={value}>{children}</I18nContext>;
}

/** Saved language preference, or 'system' if user.db itself can't be read. */
function storedLanguage(): LanguagePref {
  try {
    return settingsStore.get().language;
  } catch {
    return 'system';
  }
}

export function useI18n(): I18n {
  // Outside the provider (e.g. the root error screen) compute it directly, without
  // depending on anything that might be the cause of the error.
  return use(I18nContext) ?? build(storedLanguage(), getLocales().map((l) => l.languageCode));
}

/** Ingredient name in the UI language (French name when known). */
export function ingredientName(i: { name: string; name_fr: string | null }, lang: Lang): string {
  return lang === 'fr' && i.name_fr ? i.name_fr : i.name;
}
