/** Browse tab filter sheet + sort (session only; appliances/diet/avoid default to Settings). */
import { useSyncExternalStore } from 'react';

import { type BrowseOptions, DEFAULT_BROWSE_OPTIONS } from '@/lib/browse';
import { createStore } from '@/lib/store';

export const browseStore = createStore<BrowseOptions>(() => DEFAULT_BROWSE_OPTIONS);

export function useBrowseOptions(): BrowseOptions {
  return useSyncExternalStore(browseStore.subscribe, browseStore.get);
}

export function updateBrowseOptions(patch: Partial<BrowseOptions>): void {
  browseStore.set({ ...browseStore.get(), ...patch });
}

/** Clear the filter sheet (keeps the sort). */
export function clearBrowseFilters(): void {
  browseStore.set({ ...DEFAULT_BROWSE_OPTIONS, sort: browseStore.get().sort });
}
