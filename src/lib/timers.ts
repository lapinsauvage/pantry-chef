/**
 * Cooking timers: find durations in a step ("bake 25-30 minutes", "simmer 1 hour",
 * "1 1/2 hours", "half an hour") and format countdowns. Pure, unit-tested.
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

function amount(text: string): number | null {
  const w = WORDS[text.toLowerCase().replace(/\s+/g, ' ')];
  return w ?? parseAmount(text);
}

function unitSeconds(unit: string): number {
  const u = unit.toLowerCase();
  if (u.startsWith('h')) return 3600;
  if (u.startsWith('m')) return 60;
  return 1;
}

/** Durations in a step that make sense as a timer (5 s – 24 h), without duplicates. */
export function detectTimers(step: string): StepTimer[] {
  const out: StepTimer[] = [];
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
    seconds = Math.round(seconds);
    if (seconds < 5 || seconds > 24 * 3600) continue;
    if (out.some((t) => t.seconds === seconds)) continue;
    out.push({ text: whole.slice(pre.length).trim(), seconds });
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
