/**
 * "Basics I always have" (user.db `basics`): counted as owned in every pantry search.
 */
import type { SQLiteDatabase } from 'expo-sqlite';
import { useSyncExternalStore } from 'react';

import { ingredientsByName } from '@/db/recipes';
import { addBasic, getBasics, getSetting, removeBasic, setSetting, SETTINGS, type UserIngredient } from '@/db/user';
import { DEFAULT_BASICS } from '@/lib/constants';
import { createStore } from '@/lib/store';

export const basicsStore = createStore<UserIngredient[]>(getBasics);

export function useBasics(): UserIngredient[] {
  return useSyncExternalStore(basicsStore.subscribe, basicsStore.get);
}

export function addBasicIngredient(item: UserIngredient): void {
  addBasic(item);
  basicsStore.reload();
}

export function removeBasicIngredient(id: number): void {
  removeBasic(id);
  basicsStore.reload();
}

/** On first launch (and after a reset), pre-fill the basics with DEFAULT_BASICS. */
export async function seedDefaultBasics(db: SQLiteDatabase): Promise<void> {
  if (getSetting(SETTINGS.basicsSeeded) === '1') return;
  const rows = await ingredientsByName(db, DEFAULT_BASICS);
  for (const r of rows) addBasic({ id: r.id, name: r.name });
  setSetting(SETTINGS.basicsSeeded, '1');
  basicsStore.reload();
}
