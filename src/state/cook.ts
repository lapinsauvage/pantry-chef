/** Cook tab options (time, missing allowed, course, filter-sheet overrides) for this session. */
import { useSyncExternalStore } from 'react';

import { type CookOptions, DEFAULT_COOK_OPTIONS } from '@/lib/cook';
import { createStore } from '@/lib/store';

export const cookStore = createStore<CookOptions>(() => DEFAULT_COOK_OPTIONS);

export function useCookOptions(): CookOptions {
  return useSyncExternalStore(cookStore.subscribe, cookStore.get);
}

export function updateCookOptions(patch: Partial<CookOptions>): void {
  cookStore.set({ ...cookStore.get(), ...patch });
}

/** Back to the appliances/diet/avoid from Settings. */
export function clearCookOverrides(): void {
  const { equipment: _e, diet: _d, avoid: _a, ...rest } = cookStore.get();
  cookStore.set(rest);
}
