import { useCallback, useEffect, useState } from 'react';

interface Page<T> {
  key: string;
  rows: T[];
  done: boolean;
  error: boolean;
  loadingMore: boolean;
}

/**
 * Paged results for a query identified by `key` (null = no query). The first page is loaded
 * `debounceMs` after the key changes; responses for an outdated key are dropped. While a new
 * key loads, the previous rows stay visible (`loading` is true). `fetchPage` must be memoized.
 */
export function usePagedQuery<T extends { id: number }>(
  key: string | null,
  fetchPage: (offset: number) => Promise<T[]>,
  { pageSize = 40, debounceMs = 300 }: { pageSize?: number; debounceMs?: number } = {},
) {
  const [page, setPage] = useState<Page<T> | null>(null);

  useEffect(() => {
    if (key == null) return;
    let live = true;
    const timer = setTimeout(() => {
      fetchPage(0).then(
        (rows) => live && setPage({ key, rows, done: rows.length < pageSize, error: false, loadingMore: false }),
        () => live && setPage({ key, rows: [], done: true, error: true, loadingMore: false }),
      );
    }, debounceMs);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [key, fetchPage, pageSize, debounceMs]);

  const current = page && page.key === key ? page : null;

  const loadMore = useCallback(() => {
    if (!current || current.done || current.loadingMore || current.error) return;
    setPage({ ...current, loadingMore: true });
    const update = (patch: (p: Page<T>) => Page<T>) => setPage((p) => (p && p.key === current.key ? patch(p) : p));
    fetchPage(current.rows.length).then(
      (rows) =>
        update((p) => {
          const seen = new Set(p.rows.map((r) => r.id));
          return { ...p, rows: [...p.rows, ...rows.filter((r) => !seen.has(r.id))], done: rows.length < pageSize, loadingMore: false };
        }),
      () => update((p) => ({ ...p, done: true, loadingMore: false })),
    );
  }, [current, fetchPage, pageSize]);

  return {
    /** Rows to show: current ones, or the previous query's while the new one loads. */
    rows: key == null ? [] : (page?.rows ?? []),
    loading: key != null && !current,
    loadingMore: !!current?.loadingMore,
    error: !!current?.error,
    /** True once the current query has answered with no rows. */
    empty: !!current && !current.error && current.rows.length === 0,
    loadMore,
  };
}
