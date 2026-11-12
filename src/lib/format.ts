/**
 * Locale-aware number formatting without relying on the JS engine's Intl data.
 * French (Belgium) groups thousands with a narrow no-break space and uses a decimal comma.
 */
import type { Lang } from './constants.ts';

const NARROW_NBSP = ' ';

export function formatNumber(n: number, lang: Lang, maxDecimals = 0): string {
  const factor = 10 ** maxDecimals;
  const rounded = Math.round(Math.abs(n) * factor) / factor;
  const [int, dec] = String(rounded).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, lang === 'fr' ? NARROW_NBSP : ',');
  const sign = n < 0 && rounded !== 0 ? '-' : '';
  return sign + grouped + (dec ? (lang === 'fr' ? ',' : '.') + dec : '');
}

/** "2026-11-12T22:13:53Z" → "12/11/2026" (day first, as in Belgium); "—" if not a date. */
export function formatDate(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
}
