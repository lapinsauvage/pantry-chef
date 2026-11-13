/**
 * Cooking timers: find durations in a step ("bake 25-30 minutes", "simmer 1 hour",
 * "1 1/2 hours", "half an hour"; in French "cuire 25 à 30 minutes", "1 h 30", "une demi-heure")
 * and format countdowns. Pure, unit-tested.
 */
import { parseAmount } from './units.ts';

export interface StepTimer {
  /** Text as written, e.g. "25-30 minutes". */
  text: string;
  /** Timer length: the lower bound of a range (check early, then keep going). */
  seconds: number;
}

const WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  fifteen: 15, twenty: 20, thirty: 30, forty: 40, 'forty-five': 45, sixty: 60, 'half a': 0.5, 'half an': 0.5,
};
const NUM = String.raw`\d+(?:\s+|-)\d+\/\d+|\d+\/\d+|\d+\s?[½¼¾⅓⅔]|[½¼¾⅓⅔]|\d+(?:\.\d+)?`;
const WORD = String.raw`half an?|forty-five|fifteen|twenty|thirty|forty|sixty|one|two|three|four|five|six|seven|eight|nine|ten|an?`;
const AMOUNT = `${NUM}|${WORD}`;
const UNIT = String.raw`hours?|hrs?\.?|minutes?|mins?\.?|seconds?|secs?\.?`;
const DURATION = new RegExp(
  String.raw`(^|[^\w/.-])(${AMOUNT})(?:\s*(?:-|–|to|or)\s*(${AMOUNT}))?\s*-?\s*(?:(?:more|additional|further|extra)\s+)?(${UNIT})(?![a-z])(?:,?\s*(?:and\s+)?(${NUM})\s*-?\s*(minutes?|mins?\.?|seconds?|secs?\.?)(?![a-z]))?`,
  'gi',
);

// French (machine-translated steps): numbers may use a decimal comma ("1,5 heure").
const WORDS_FR: Record<string, number> = {
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10,
  douze: 12, quinze: 15, vingt: 20, 'vingt-cinq': 25, trente: 30, quarante: 40, 'quarante-cinq': 45,
  cinquante: 50, soixante: 60,
};
const NUM_FR = String.raw`\d+\/\d+|\d+(?:[.,]\d+)?|[½¼¾⅓⅔]`;
const WORD_FR = String.raw`vingt-cinq|quarante-cinq|une|un|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|douze|quinze|vingt|trente|quarante|cinquante|soixante`;
const AMOUNT_FR = `${NUM_FR}|${WORD_FR}`;
const UNIT_FR = String.raw`heures?|h|minutes?|min\.?|secondes?|sec\.?`;
const DURATION_FR = new RegExp(
  String.raw`(^|[^\p{L}\d/.,-])(${AMOUNT_FR})(?:\s*(?:-|–|à|ou)\s*(${AMOUNT_FR}))?\s*(${UNIT_FR})(?![\p{L}])` +
    String.raw`(?:\s*(?:et\s+)?(demie?|${NUM_FR})(?:\s*(minutes?|min\.?|secondes?|sec\.?)(?![\p{L}]))?)?`,
  'giu',
);
// "une demi-heure", "un quart d'heure", "trois quarts d’heure"
const PHRASES_FR: [RegExp, number][] = [
  [/\b(?:une\s+)?demi-heure\b/giu, 1800],
  [/\b(?:un\s+)?quart\s+d[’']heure\b/giu, 900],
  [/\btrois\s+quarts\s+d[’']heure\b/giu, 2700],
];

function amount(text: string): number | null {
  const t = text.toLowerCase().replace(/\s+/g, ' ');
  const w = WORDS[t] ?? WORDS_FR[t];
  return w ?? parseAmount(t.replace(',', '.'));
}

function unitSeconds(unit: string): number {
  const u = unit.toLowerCase();
  if (u.startsWith('h')) return 3600;
  if (u.startsWith('m')) return 60;
  return 1;
}

/** Durations in a step that make sense as a timer (5 s – 24 h), without duplicates, in text order. */
export function detectTimers(step: string): StepTimer[] {
  // Candidates from the English and French patterns; where they overlap ("25 à 30 minutes" also
  // contains "30 minutes") the longest one wins.
  const candidates: { start: number; end: number; text: string; seconds: number }[] = [];
  const add = (start: number, text: string, seconds: number) =>
    candidates.push({ start, end: start + text.length, text: text.trim(), seconds: Math.round(seconds) });
  DURATION.lastIndex = 0;
  for (let m = DURATION.exec(step); m; m = DURATION.exec(step)) {
    const [whole, pre, a, , unit, extra, extraUnit] = m;
    const first = amount(a);
    if (first == null) continue;
    let seconds = first * unitSeconds(unit);
    if (extra && extraUnit) {
      const e = parseAmount(extra);
      if (e != null) seconds += e * unitSeconds(extraUnit);
    }
    add(m.index + pre.length, whole.slice(pre.length), seconds);
  }
  DURATION_FR.lastIndex = 0;
  for (let m = DURATION_FR.exec(step); m; m = DURATION_FR.exec(step)) {
    const [whole, pre, a, , unit, extra, extraUnit] = m;
    const first = amount(a);
    if (first == null) continue;
    const base = unitSeconds(unit);
    let seconds = first * base;
    if (extra) {
      if (/^demie?$/i.test(extra)) seconds += base / 2; // "1 heure et demie"
      else {
        const e = amount(extra);
        // "1 h 30" = 30 minutes; otherwise the unit written after the number
        if (e != null) seconds += e * (extraUnit ? unitSeconds(extraUnit) : base === 3600 ? 60 : base === 60 ? 1 : 0);
      }
    }
    add(m.index + pre.length, whole.slice(pre.length), seconds);
  }
  for (const [re, seconds] of PHRASES_FR) {
    re.lastIndex = 0;
    for (let m = re.exec(step); m; m = re.exec(step)) add(m.index, m[0], seconds);
  }
  candidates.sort((x, y) => x.start - y.start || y.end - x.end);
  const out: StepTimer[] = [];
  let taken = -1;
  for (const c of candidates) {
    if (c.start < taken) continue; // inside a longer match
    taken = c.end;
    if (c.seconds < 5 || c.seconds > 24 * 3600) continue;
    if (out.some((t) => t.seconds === c.seconds)) continue;
    out.push({ text: c.text, seconds: c.seconds });
  }
  return out;
}

/** "25:00", "1:05:00", "0:09" */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}
