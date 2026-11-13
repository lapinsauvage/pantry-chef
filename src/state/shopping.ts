/** Shopping list (user.db `shopping_items`). */
import { useSyncExternalStore } from 'react';

import {
  addShoppingItems,
  clearCheckedShopping,
  getShoppingItems,
  type NewShoppingItem,
  removeShoppingItem,
  setShoppingChecked,
} from '@/db/user';
import type { ShoppingItem } from '@/lib/shopping';
import { createStore } from '@/lib/store';

export const shoppingStore = createStore<ShoppingItem[]>(getShoppingItems);

export function useShoppingItems(): ShoppingItem[] {
  return useSyncExternalStore(shoppingStore.subscribe, shoppingStore.get);
}

/** Items still to buy (tab badge). */
export function useShoppingCount(): number {
  return useSyncExternalStore(shoppingStore.subscribe, () => shoppingStore.get().filter((i) => !i.checked).length);
}

/** Returns how many were added (ingredients already on the list are skipped). */
export function addToShoppingList(items: readonly NewShoppingItem[]): number {
  const added = addShoppingItems(items);
  shoppingStore.reload();
  return added;
}

export function toggleShoppingItem(item: ShoppingItem): void {
  setShoppingChecked(item.id, !item.checked);
  shoppingStore.reload();
}

export function deleteShoppingItem(id: number): void {
  removeShoppingItem(id);
  shoppingStore.reload();
}

export function clearCheckedItems(): void {
  clearCheckedShopping();
  shoppingStore.reload();
}
