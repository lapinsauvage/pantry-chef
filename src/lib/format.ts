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

/** Cooking time: 45 → "45 min", 90 → "1 h 30", 120 → "2 h", 1500 → "1 d 1 h" ("1 j 1 h" in French). */
export function formatMinutes(min: number | null | undefined, lang: Lang): string {
  if (min == null || !Number.isFinite(min) || min <= 0) return '—';
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  if (m < 24 * 60) {
    const h = Math.floor(m / 60);
    const rest = m % 60;
    return rest ? `${h} h ${String(rest).padStart(2, '0')}` : `${h} h`;
  }
  const d = Math.floor(m / (24 * 60));
  const h = Math.round((m % (24 * 60)) / 60);
  const day = lang === 'fr' ? 'j' : 'd';
  return h ? `${d} ${day} ${h} h` : `${d} ${day}`;
}

/** Timer length: 30 → "30 s", 90 → "1 min 30 s", 1500 → "25 min", 5400 → "1 h 30". */
export function formatDuration(seconds: number, lang: Lang): string {
  const s = Math.round(seconds);
  if (s < 60) return `${s} s`;
  if (s < 3600 && s % 60) return `${Math.floor(s / 60)} min ${s % 60} s`;
  return formatMinutes(Math.round(s / 60), lang);
}
