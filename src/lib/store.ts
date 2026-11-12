/**
 * Minimal external store for React's useSyncExternalStore: lazily loads its value
 * (e.g. from user.db) on first read and notifies subscribers on change.
 * No React import, so it can be unit-tested with plain Node.
 */
export interface Store<T> {
  get(): T;
  set(value: T): void;
  /** Re-read the value from its source (after a reset or a background write). */
  reload(): void;
  subscribe(listener: () => void): () => void;
}

export function createStore<T>(load: () => T): Store<T> {
  let loaded = false;
  let value: T;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  return {
    get() {
      if (!loaded) {
        value = load();
        loaded = true;
      }
      return value;
    },
    set(next) {
      value = next;
      loaded = true;
      emit();
    },
    reload() {
      value = load();
      loaded = true;
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
