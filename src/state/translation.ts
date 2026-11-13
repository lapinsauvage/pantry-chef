/** "Show the original (English)" on recipe screens and in cooking mode (session only). */
import { useSyncExternalStore } from 'react';

import { createStore } from '@/lib/store';

export const showOriginalStore = createStore<boolean>(() => false);

export function useShowOriginal(): boolean {
  return useSyncExternalStore(showOriginalStore.subscribe, showOriginalStore.get);
}

export function setShowOriginal(value: boolean): void {
  showOriginalStore.set(value);
}
