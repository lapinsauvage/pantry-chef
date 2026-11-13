/** Ingredients picked on the Cook tab ("my fridge"), persisted in user.db `pantry`. */
import { useSyncExternalStore } from 'react';

import { addPantry, clearPantry, getPantry, removePantry, type UserIngredient } from '@/db/user';
import { createStore } from '@/lib/store';

export const pantryStore = createStore<UserIngredient[]>(getPantry);

export function usePantry(): UserIngredient[] {
  return useSyncExternalStore(pantryStore.subscribe, pantryStore.get);
}

export function addPantryIngredient(item: UserIngredient): void {
  addPantry(item);
  pantryStore.reload();
}

export function removePantryIngredient(id: number): void {
  removePantry(id);
  pantryStore.reload();
}

export function togglePantryIngredient(item: UserIngredient): void {
  if (pantryStore.get().some((p) => p.id === item.id)) removePantryIngredient(item.id);
  else addPantryIngredient(item);
}

export function clearPantryIngredients(): void {
  clearPantry();
  pantryStore.reload();
}
