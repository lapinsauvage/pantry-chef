/**
 * Ingredient-quantity formatting, scaling and US -> metric conversion.
 *
 * Recipe ingredient lines are stored in the database as compact JSON arrays
 * (trailing nulls omitted):
 *   [qmin, qmax, unit, pkgQty, pkgUnit, text, note, ingredientId]
 * e.g. [1, null, "can", 14, "oz", "diced tomatoes", "briefly drained", 57]
 *
 * This file has no imports so it can be unit-tested with plain Node.
 */

export type UnitSystem = 'metric' | 'us';

export type IngredientTuple = [
  qmin?: number | null,
  qmax?: number | null,
  unit?: string | null,
  pkgQty?: number | null,
  pkgUnit?: string | null,
  text?: string | null,
  note?: string | null,
  ingredientId?: number | null,
];

export interface IngredientLine {
  qmin: number | null;
  qmax: number | null;
  unit: string | null;
  pkgQty: number | null;
  pkgUnit: string | null;
  text: string;
  note: string;
  ingredientId: number | null;
}

export function parseIngredientTuple(t: IngredientTuple): IngredientLine {
  return {
    qmin: t[0] ?? null,
    qmax: t[1] ?? null,
    unit: t[2] ?? null,
    pkgQty: t[3] ?? null,
    pkgUnit: t[4] ?? null,
    text: t[5] ?? '',
    note: t[6] ?? '',
    ingredientId: t[7] ?? null,
  };
}

// ---------------------------------------------------------------------------
// Conversion tables

const ML_PER: Record<string, number> = {
  cup: 236.588, floz: 29.5735, pint: 473.176, quart: 946.353, gallon: 3785.41,
  tbsp: 14.7868, tsp: 4.92892, ml: 1, l: 1000,
};
const G_PER: Record<string, number> = { oz: 28.3495, lb: 453.592, g: 1, kg: 1000 };

/** Grams per US cup for common baking ingredients (canonical names). */
export const GRAMS_PER_CUP: Record<string, number> = {
  flour: 125, 'whole wheat flour': 120, 'self-raising flour': 125, 'cake flour': 115,
  'rice flour': 160, sugar: 200, 'brown sugar': 220, 'powdered sugar': 120,
  butter: 227, margarine: 227, shortening: 190, 'cocoa powder': 85, oats: 90, oatmeal: 90,
  rice: 185, 'brown rice': 190, cornmeal: 150, 'yellow cornmeal': 150, cornstarch: 128,
  'chocolate chips': 170, raisins: 150, 'dried cranberries': 120, walnuts: 120, pecans: 110,
  almonds: 140, 'peanut butter': 255, honey: 340, 'maple syrup': 315, breadcrumbs: 110,
  parmesan: 100, cheddar: 113, mozzarella: 113, coconut: 85, 'graham crackers': 100,
};

/** Units kept as-is in metric mode (spoons are common in Belgian/European kitchens). */
const KEEP_IN_METRIC = new Set(['tsp', 'tbsp', 'pinch', 'dash', 'drop']);

const UNIT_LABEL: Record<string, [singular: string, plural: string]> = {
  cup: ['cup', 'cups'], tbsp: ['tbsp', 'tbsp'], tsp: ['tsp', 'tsp'], floz: ['fl oz', 'fl oz'],
  oz: ['oz', 'oz'], lb: ['lb', 'lb'], pint: ['pint', 'pints'], quart: ['quart', 'quarts'],
  gallon: ['gallon', 'gallons'], ml: ['ml', 'ml'], l: ['l', 'l'], g: ['g', 'g'], kg: ['kg', 'kg'],
  cm: ['cm', 'cm'], inch: ['inch', 'inches'], pinch: ['pinch', 'pinches'], dash: ['dash', 'dashes'],
  clove: ['clove', 'cloves'], can: ['can', 'cans'], package: ['package', 'packages'],
  jar: ['jar', 'jars'], bottle: ['bottle', 'bottles'], box: ['box', 'boxes'],
  stick: ['stick', 'sticks'], slice: ['slice', 'slices'], piece: ['piece', 'pieces'],
  bunch: ['bunch', 'bunches'], head: ['head', 'heads'], sprig: ['sprig', 'sprigs'],
  stalk: ['stalk', 'stalks'], drop: ['drop', 'drops'], handful: ['handful', 'handfuls'],
  container: ['container', 'containers'], bag: ['bag', 'bags'], loaf: ['loaf', 'loaves'],
  fillet: ['fillet', 'fillets'], whole: ['whole', 'whole'],
};

export interface Quantity {
  qmin: number | null;
  qmax: number | null;
  unit: string | null;
}

/** Convert one quantity to the target system. `ingredient` = canonical name (for grams per cup). */
export function convertQuantity(q: Quantity, system: UnitSystem, ingredient?: string | null): Quantity {
  const { unit } = q;
  if (system === 'us' || !unit || q.qmin == null) return q;
  if (KEEP_IN_METRIC.has(unit)) return q;
  const map = (f: (n: number) => number): [number | null, number | null] => [
    q.qmin == null ? null : f(q.qmin),
    q.qmax == null ? null : f(q.qmax),
  ];
  if (unit === 'stick' && ingredient && /butter|margarine/.test(ingredient)) {
    const [a, b] = map((n) => n * 113.4);
    return { qmin: a, qmax: b, unit: 'g' };
  }
  if (unit === 'cup' && ingredient && GRAMS_PER_CUP[ingredient]) {
    const gpc = GRAMS_PER_CUP[ingredient];
    const [a, b] = map((n) => n * gpc);
    return grams(a, b);
  }
  if (unit in ML_PER && unit !== 'ml' && unit !== 'l') {
    const [a, b] = map((n) => n * ML_PER[unit]);
    if ((b ?? a ?? 0) >= 1000) return { qmin: a == null ? null : a / 1000, qmax: b == null ? null : b / 1000, unit: 'l' };
    return { qmin: a, qmax: b, unit: 'ml' };
  }
  if (unit === 'oz' || unit === 'lb') {
    const [a, b] = map((n) => n * G_PER[unit]);
    return grams(a, b);
  }
  if (unit === 'inch') {
    const [a, b] = map((n) => n * 2.54);
    return { qmin: a, qmax: b, unit: 'cm' };
  }
  return q;
}

function grams(a: number | null, b: number | null): Quantity {
  if ((b ?? a ?? 0) >= 1000) return { qmin: a == null ? null : a / 1000, qmax: b == null ? null : b / 1000, unit: 'kg' };
  return { qmin: a, qmax: b, unit: 'g' };
}

// ---------------------------------------------------------------------------
// Number formatting

const FRACTIONS: [number, string][] = [
  [1 / 8, '⅛'], [1 / 4, '¼'], [1 / 3, '⅓'], [3 / 8, '⅜'], [1 / 2, '½'], [5 / 8, '⅝'],
  [2 / 3, '⅔'], [3 / 4, '¾'], [7 / 8, '⅞'],
];

/** US style: 1.5 -> "1½", 0.333 -> "⅓". */
export function formatFraction(n: number): string {
  const whole = Math.floor(n + 1e-9);
  const frac = n - whole;
  if (frac < 0.04) return String(whole);
  if (frac > 0.96) return String(whole + 1);
  let best = FRACTIONS[0];
  for (const f of FRACTIONS) if (Math.abs(f[0] - frac) < Math.abs(best[0] - frac)) best = f;
  return whole ? `${whole}${best[1]}` : best[1];
}

/** Metric style rounding: 236.6 -> "235", 14.2 -> "14", 1.25 (l/kg) -> "1.25", 0.5 -> "½". */
export function formatMetric(n: number, unit: string | null, lang: 'en' | 'fr' = 'en'): string {
  let v: number;
  if (unit === 'g' || unit === 'ml') {
    v = n >= 100 ? Math.round(n / 5) * 5 : n >= 10 ? Math.round(n) : Math.round(n * 2) / 2;
  } else if (unit === 'l' || unit === 'kg' || unit === 'cm') {
    v = Math.round(n * 100) / 100;
    if (unit === 'cm') v = n >= 10 ? Math.round(n) : Math.round(n * 2) / 2;
  } else {
    return formatFraction(n);
  }
  const s = String(v);
  return lang === 'fr' ? s.replace('.', ',') : s;
}

export interface FormatOptions {
  /** Multiply quantities (servings wanted / recipe servings). */
  factor?: number;
  system?: UnitSystem;
  lang?: 'en' | 'fr';
  /** Canonical ingredient name, enables grams-per-cup conversion. */
  ingredient?: string | null;
}

/** "1 (14 oz) can diced tomatoes, briefly drained" -> metric "1 (400 g) can diced tomatoes …" */
export function formatIngredient(line: IngredientLine, opts: FormatOptions = {}): {
  quantity: string;
  text: string;
  note: string;
} {
  const factor = opts.factor ?? 1;
  const system = opts.system ?? 'metric';
  const lang = opts.lang ?? 'en';
  let q: Quantity = {
    qmin: line.qmin == null ? null : line.qmin * factor,
    qmax: line.qmax == null ? null : line.qmax * factor,
    unit: line.unit,
  };
  q = convertQuantity(q, system, opts.ingredient);
  const num = (n: number) => (system === 'us' ? formatFraction(n) : formatMetric(n, q.unit, lang));
  let quantity = '';
  if (q.qmin != null) {
    quantity = num(q.qmin);
    if (q.qmax != null && num(q.qmax) !== quantity) quantity += `–${num(q.qmax)}`;
  }
  if (line.pkgQty != null && line.pkgUnit) {
    const pkg = convertQuantity({ qmin: line.pkgQty, qmax: null, unit: line.pkgUnit }, system);
    const pkgNum = system === 'us' ? formatFraction(pkg.qmin!) : formatMetric(pkg.qmin!, pkg.unit, lang);
    quantity += `${quantity ? ' ' : ''}(${pkgNum} ${unitLabel(pkg.unit!, pkg.qmin!)})`;
  }
  if (q.unit) {
    const n = q.qmax ?? q.qmin ?? 1;
    quantity += `${quantity ? ' ' : ''}${unitLabel(q.unit, n)}`;
  }
  return { quantity: quantity.trim(), text: line.text, note: line.note };
}

export function unitLabel(unit: string, n: number): string {
  const l = UNIT_LABEL[unit];
  if (!l) return unit;
  return n > 1 + 1e-9 ? l[1] : l[0];
}

// ---------------------------------------------------------------------------
// Temperatures and pan sizes inside instruction text

const F_TEMP = /(\d{3})(?:\s*(?:-|–|to)\s*(\d{3}))?\s*(?:°|º|˚|degrees?|deg\.?)(?:\s*F(?:ahrenheit)?\b)?|(\d{3})\s*°?\s*F\b/gi;
const EXISTING_C = /^\s*\(\s*(?:about\s*)?\d{2,3}\s*°?\s*C(?:elsius)?\s*\)/i;
const PAN = /(\d+(?:\.\d+)?)\s*(?:x|×|by)\s*(\d+(?:\.\d+)?)(?:\s*(?:x|×|by)\s*(\d+(?:\.\d+)?))?(?:\s*|-)inch(?:es)?\b|(\d+(?:\.\d+)?)(?:\s*|-)inch(?:es)?\b|(\d+(?:\.\d+)?)"/gi;

export function fToC(f: number): number {
  return Math.round(((f - 32) * 5) / 9 / 5) * 5;
}

/** Replace Fahrenheit oven temperatures and inch sizes with metric equivalents. */
export function metricizeText(text: string, system: UnitSystem = 'metric'): string {
  if (system === 'us') return text;
  let out = '';
  let last = 0;
  F_TEMP.lastIndex = 0;
  for (let m = F_TEMP.exec(text); m; m = F_TEMP.exec(text)) {
    const a = Number(m[1] ?? m[3]);
    const b = m[2] ? Number(m[2]) : null;
    if (a < 150 || a > 575) continue; // not an oven temperature in °F
    out += text.slice(last, m.index);
    out += b ? `${fToC(a)}–${fToC(b)}°C` : `${fToC(a)}°C`;
    last = m.index + m[0].length;
    const rest = text.slice(last);
    const dup = rest.match(EXISTING_C);
    if (dup) last += dup[0].length;
  }
  out += text.slice(last);
  return out.replace(PAN, (whole, w, h, d, single, quote) => {
    const cm = (s: string) => {
      const v = Number(s) * 2.54;
      return String(v >= 10 ? Math.round(v) : Math.round(v * 2) / 2);
    };
    if (w && h) return d ? `${cm(w)} x ${cm(h)} x ${cm(d)} cm` : `${cm(w)} x ${cm(h)} cm`;
    if (single) return `${cm(single)} cm`;
    if (quote) return `${cm(quote)} cm`;
    return whole;
  });
}

/** Scale factor for a recipe, e.g. recipe serves 4, user wants 6 -> 1.5 */
export function scaleFactor(recipeServings: number | null | undefined, wanted: number): number {
  if (!recipeServings || recipeServings <= 0 || !wanted) return 1;
  return wanted / recipeServings;
}
