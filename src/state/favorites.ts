/** Favourite recipes and recently viewed ones (user.db `favorites`, `history`). */
import { useSyncExternalStore } from 'react';

import { clearHistory, getFavoriteIds, getHistoryIds, recordView, setFavorite } from '@/db/user';
import { createStore } from '@/lib/store';

/** Favourite ids, most recently added first. */
export const favoritesStore = createStore<readonly number[]>(getFavoriteIds);
/** Recently viewed ids, newest first (last 50). */
export const historyStore = createStore<readonly number[]>(getHistoryIds);

export function useFavoriteIds(): readonly number[] {
  return useSyncExternalStore(favoritesStore.subscribe, favoritesStore.get);
}

export function useIsFavorite(recipeId: number): boolean {
  return useSyncExternalStore(favoritesStore.subscribe, () => favoritesStore.get().includes(recipeId));
}

export function toggleFavorite(recipeId: number): void {
  setFavorite(recipeId, !favoritesStore.get().includes(recipeId));
  favoritesStore.reload();
}

export function useHistoryIds(): readonly number[] {
  return useSyncExternalStore(historyStore.subscribe, historyStore.get);
}

export function recordRecipeView(recipeId: number): void {
  recordView(recipeId);
  historyStore.reload();
}

export function clearRecipeHistory(): void {
  clearHistory();
  historyStore.reload();
}
