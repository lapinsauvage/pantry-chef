/** Favourite recipe ids (user.db `favorites`). */
import { useSyncExternalStore } from 'react';

import { getFavoriteIds, setFavorite } from '@/db/user';
import { createStore } from '@/lib/store';

export const favoritesStore = createStore<ReadonlySet<number>>(() => new Set(getFavoriteIds()));

export function useIsFavorite(recipeId: number): boolean {
  return useSyncExternalStore(favoritesStore.subscribe, () => favoritesStore.get().has(recipeId));
}

export function toggleFavorite(recipeId: number): void {
  setFavorite(recipeId, !favoritesStore.get().has(recipeId));
  favoritesStore.reload();
}
