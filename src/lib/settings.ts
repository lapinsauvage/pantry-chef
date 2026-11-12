/**
 * The user's preferences as stored in user.db `settings` (key → text value).
 * Pure functions only (no React / expo imports) so they can be unit-tested with Node;
 * the store that reads/writes user.db is src/hooks/use-settings.ts.
 */
import { EQUIPMENT, type Lang } from './constants.ts';
import type { UnitSystem } from './units.ts';

export type LanguagePref = 'system' | Lang;

export interface Settings {
  /** 'system' follows the phone's language (French if it is preferred over English, else English). */
  language: LanguagePref;
  units: UnitSystem;
  /** Bitmask of EQUIPMENT the user has. */
  equipment: number;
  /** Bitmask of DIETS the user follows. */
  diet: number;
  /** Bitmask of AVOID flags the user never wants. */
  avoid: number;
  /** First-run setup finished (or skipped). */
  onboarded: boolean;
}

/** user.db `settings` keys for each field of Settings. */
export const SETTING_KEYS: Record<keyof Settings, string> = {
  language: 'language',
  units: 'units',
  equipment: 'equipment',
  diet: 'diet',
  avoid: 'avoid',
  onboarded: 'onboarded',
};

export const SUPPORTED_LANGS: readonly Lang[] = ['en', 'fr'];

/** Bitmask for a list of flag keys, e.g. maskOf(EQUIPMENT, ['oven']) === 1. Unknown keys are ignored. */
export function maskOf(flags: readonly { key: string; bit: number }[], keys: readonly string[]): number {
  return flags.reduce((m, f) => (keys.includes(f.key) ? m | f.bit : m), 0);
}

export const DEFAULT_EQUIPMENT = maskOf(EQUIPMENT, ['oven', 'stovetop', 'microwave']);

export const DEFAULT_SETTINGS: Settings = {
  language: 'system',
  units: 'metric',
  equipment: DEFAULT_EQUIPMENT,
  diet: 0,
  avoid: 0,
  onboarded: false,
};

export function hasBit(mask: number, bit: number): boolean {
  return (mask & bit) !== 0;
}

export function toggleBit(mask: number, bit: number): number {
  return mask ^ bit;
}

/** Number of set bits, e.g. how many appliances are selected. */
export function countBits(mask: number): number {
  let n = 0;
  for (let m = mask; m > 0; m >>>= 1) n += m & 1;
  return n;
}

function parseMask(value: string | null | undefined, fallback: number): number {
  if (value == null || !/^\d+$/.test(value)) return fallback;
  return Number(value);
}

/** Build typed settings from raw user.db rows; missing or invalid values fall back to defaults. */
export function parseSettings(raw: Readonly<Record<string, string | undefined>>): Settings {
  const language = raw[SETTING_KEYS.language];
  const units = raw[SETTING_KEYS.units];
  return {
    language: language === 'en' || language === 'fr' || language === 'system' ? language : DEFAULT_SETTINGS.language,
    units: units === 'metric' || units === 'us' ? units : DEFAULT_SETTINGS.units,
    equipment: parseMask(raw[SETTING_KEYS.equipment], DEFAULT_SETTINGS.equipment),
    diet: parseMask(raw[SETTING_KEYS.diet], DEFAULT_SETTINGS.diet),
    avoid: parseMask(raw[SETTING_KEYS.avoid], DEFAULT_SETTINGS.avoid),
    onboarded: raw[SETTING_KEYS.onboarded] === '1',
  };
}

/** Key/value rows to write to user.db for a partial update. */
export function serializeSettings(patch: Partial<Settings>): [key: string, value: string][] {
  const rows: [string, string][] = [];
  for (const field of Object.keys(SETTING_KEYS) as (keyof Settings)[]) {
    const value = patch[field];
    if (value === undefined) continue;
    rows.push([SETTING_KEYS[field], typeof value === 'boolean' ? (value ? '1' : '0') : String(value)]);
  }
  return rows;
}

/**
 * The UI language: the explicit choice, or for 'system' the first of the phone's preferred
 * languages that the app supports (a Dutch/French Belgian phone gets French), else English.
 */
export function resolveLanguage(pref: LanguagePref, deviceLanguageCodes: readonly (string | null | undefined)[]): Lang {
  if (pref !== 'system') return pref;
  for (const code of deviceLanguageCodes) {
    const base = code?.toLowerCase().split(/[-_]/)[0];
    if (base && (SUPPORTED_LANGS as readonly string[]).includes(base)) return base as Lang;
  }
  return 'en';
}
