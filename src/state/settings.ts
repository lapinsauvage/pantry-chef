/**
 * The user's preferences, persisted in user.db and shared by every screen.
 * Reads are synchronous (user.db is tiny and opened with the sync API).
 */
import { useSyncExternalStore } from 'react';

import { getAllSettings, setSettings } from '@/db/user';
import { parseSettings, serializeSettings, type Settings } from '@/lib/settings';
import { createStore } from '@/lib/store';

export const settingsStore = createStore<Settings>(() => parseSettings(getAllSettings()));

export function useSettings(): Settings {
  return useSyncExternalStore(settingsStore.subscribe, settingsStore.get);
}

export function updateSettings(patch: Partial<Settings>): void {
  setSettings(serializeSettings(patch));
  settingsStore.set({ ...settingsStore.get(), ...patch });
}
