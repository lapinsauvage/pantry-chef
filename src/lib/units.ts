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
  gallon: ['gallon', 'gallons'], ml: ['ml', 'ml'], l: ['l', 'l'], g: ['g', 'g'], kg: ['kg', 'kg'], mm: ['mm', 'mm'],
  cm: ['cm', 'cm'], inch: ['inch', 'inches'], pinch: ['pinch', 'pinches'], dash: ['dash', 'dashes'],
  clove: ['clove', 'cloves'], can: ['can', 'cans'], package: ['package', 'packages'],
  jar: ['jar', 'jars'], bottle: ['bottle', 'bottles'], box: ['box', 'boxes'],
  stick: ['stick', 'sticks'], slice: ['slice', 'slices'], piece: ['piece', 'pieces'],
  bunch: ['bunch', 'bunches'], head: ['head', 'heads'], sprig: ['sprig', 'sprigs'],
  stalk: ['stalk', 'stalks'], drop: ['drop', 'drops'], handful: ['handful', 'handfuls'],
  container: ['container', 'containers'], bag: ['bag', 'bags'], loaf: ['loaf', 'loaves'],
  fillet: ['fillet', 'fillets'], whole: ['whole', 'whole'],
};

/** French unit words, for ingredient lines shown with their machine translation ('' = no word). */
const UNIT_LABEL_FR: Record<string, [singular: string, plural: string]> = {
  cup: ['tasse', 'tasses'], tbsp: ['c. à soupe', 'c. à soupe'], tsp: ['c. à café', 'c. à café'],
  floz: ['fl oz', 'fl oz'], oz: ['oz', 'oz'], lb: ['lb', 'lb'], pint: ['pinte', 'pintes'],
  quart: ['quart', 'quarts'], gallon: ['gallon', 'gallons'], inch: ['pouce', 'pouces'],
  pinch: ['pincée', 'pincées'], dash: ['trait', 'traits'], clove: ['gousse', 'gousses'],
  can: ['boîte', 'boîtes'], package: ['paquet', 'paquets'], jar: ['bocal', 'bocaux'],
  bottle: ['bouteille', 'bouteilles'], box: ['boîte', 'boîtes'], stick: ['bâton', 'bâtons'],
  slice: ['tranche', 'tranches'], piece: ['morceau', 'morceaux'], bunch: ['botte', 'bottes'],
  head: ['tête', 'têtes'], sprig: ['brin', 'brins'], stalk: ['branche', 'branches'],
  drop: ['goutte', 'gouttes'], handful: ['poignée', 'poignées'], container: ['pot', 'pots'],
  bag: ['sachet', 'sachets'], loaf: ['pain', 'pains'], fillet: ['filet', 'filets'], whole: ['', ''],
};

// "h" words that take "de" (h aspiré): de haricots, de hachis…
const H_ASPIRE = /^(?:hach|haricot|homard|hareng|hampe|houblon|hot|hamburger|halloumi|haddock|hors)/i;

/** French "de"/"d’" before an ingredient after a unit word: "farine" → "de farine", "huile" → "d’huile". */
export function frenchOf(text: string): string {
  const t = text.trim();
  if (/^(?:de |d[’']|du |des )/i.test(t)) return t;
  if (/^[aeiouâàäéèêëîïôöûùüœæ]/i.test(t) || (/^h/i.test(t) && !H_ASPIRE.test(t))) return `d’${t}`;
  return `de ${t}`;
}

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
    // under 1 cm, millimetres read better: ¼ inch → 6 mm
    if ((b ?? a ?? 0) < 1) return { qmin: a == null ? null : a * 10, qmax: b == null ? null : b * 10, unit: 'mm' };
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
  } else if (unit === 'l' || unit === 'kg') {
    v = Math.round(n * 100) / 100;
  } else if (unit === 'cm') {
    v = n >= 10 ? Math.round(n) : n >= 3 ? Math.round(n * 2) / 2 : Math.round(n * 10) / 10;
  } else if (unit === 'mm') {
    v = Math.max(1, Math.round(n));
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
  /**
   * French "text, note" of the line (machine translation, already metric): the line is then shown
   * in French — French unit words, "de" before the text, no separate note.
   */
  textFr?: string | null;
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
  const fr = Boolean(opts.textFr);
  const label = (unit: string, n: number) => unitLabel(unit, n, fr ? 'fr' : 'en');
  const num = (n: number) => (system === 'us' ? formatFraction(n) : formatMetric(n, q.unit, lang));
  let quantity = '';
  if (q.qmin != null) {
    quantity = num(q.qmin);
    if (q.qmax != null && num(q.qmax) !== quantity) quantity += `–${num(q.qmax)}`;
  }
  if (line.pkgQty != null && line.pkgUnit) {
    const pkg = convertQuantity({ qmin: line.pkgQty, qmax: null, unit: line.pkgUnit }, system);
    const pkgNum = system === 'us' ? formatFraction(pkg.qmin!) : formatMetric(pkg.qmin!, pkg.unit, lang);
    quantity += `${quantity ? ' ' : ''}(${pkgNum} ${label(pkg.unit!, pkg.qmin!)})`;
  }
  const unitWord = q.unit ? label(q.unit, q.qmax ?? q.qmin ?? 1) : '';
  if (unitWord) quantity += `${quantity ? ' ' : ''}${unitWord}`;
  if (fr) return { quantity: quantity.trim(), text: unitWord ? frenchOf(opts.textFr!) : opts.textFr!.trim(), note: '' };
  // Free text in the name/note ("1/2-inch thick", "about 8 oz") follows the unit system too.
  const free = (t: string) => (system === 'metric' && t ? metricizeText(t, 'metric', lang) : t);
  return { quantity: quantity.trim(), text: free(line.text), note: free(line.note) };
}

export function unitLabel(unit: string, n: number, lang: 'en' | 'fr' = 'en'): string {
  const l = (lang === 'fr' ? UNIT_LABEL_FR : UNIT_LABEL)[unit];
  if (!l) return unit;
  // English plural above 1 ("1.5 cups"); French from 2 ("1,5 tasse", "2 tasses")
  return n > (lang === 'fr' ? 2 - 1e-9 : 1 + 1e-9) ? l[1] : l[0];
}

// ---------------------------------------------------------------------------
// Temperatures and pan sizes inside instruction text

/** "350°F", "350 degrees", "325-350°" (but not "180°C" / "180 degrees C", already Celsius). */
const F_TEMP =
  /(\d{3})(?:\s*(?:-|–|to)\s*(\d{3}))?(?!\s*(?:°|º|˚|degrees?|deg\.?)?\s*C(?:el[cs]ius)?\b)\s*(?:°|º|˚|degrees?|deg\.?)(?:\s*F(?:ahrenheit)?\b)?|(\d{3})\s*°?\s*F\b/gi;
/** A Celsius value the author already gave right after the °F one: "(180C)", "/ 180º", "or 180°C". */
const EXISTING_C =
  /^\s*(?:\(\s*(?:about\s*)?(\d{2,3})\s*(?:°|º|˚|degrees?|deg\.?)?\s*C(?:el[cs]ius)?\s*\)|(?:\/|or\b)\s*(\d{2,3})\s*(?:°|º|˚|degrees?|deg\.?)?\s*(?:C(?:el[cs]ius)?\b)?)/i;
/** Celsius value right before a °F one: "190°C/", "200°C or ". */
const PRECEDING_C = /(\d{2,3})\s*(?:°|º|˚|degrees?|deg\.?)?\s*C(?:el[cs]ius)?(\s*(?:\/|\bor\b)\s*)$/i;

export function fToC(f: number): number {
  return Math.round(((f - 32) * 5) / 9 / 5) * 5;
}

/**
 * Metric version of free recipe text (steps, ingredient notes): °F → °C, inches → cm/mm,
 * oz/lb → g/kg, fl oz/pints/quarts/gallons → ml/l. Cups and spoons are left as written.
 */
export function metricizeText(text: string, system: UnitSystem = 'metric', lang: 'en' | 'fr' = 'en'): string {
  if (system === 'us') return text;
  let out = '';
  let last = 0;
  F_TEMP.lastIndex = 0;
  for (let m = F_TEMP.exec(text); m; m = F_TEMP.exec(text)) {
    const a = Number(m[1] ?? m[3]);
    const b = m[2] ? Number(m[2]) : null;
    if (a < 150 || a > 575) continue; // not an oven temperature in °F
    const before = text.slice(last, m.index);
    const given = before.match(PRECEDING_C);
    if (given && Math.abs(Number(given[1]) - fToC(b ?? a)) <= 25) {
      // "190°C/375°F": the author already gave Celsius first — keep it, drop the °F part.
      out += before.slice(0, before.length - given[2].length);
      last = m.index + m[0].length;
      continue;
    }
    out += before;
    out += b ? `${fToC(a)}–${fToC(b)}°C` : `${fToC(a)}°C`;
    last = m.index + m[0].length;
    const rest = text.slice(last);
    const dup = rest.match(EXISTING_C);
    // Drop it (we already print °C) when it is plausibly the same temperature, not a °F alternative.
    if (dup && Math.abs(Number(dup[1] ?? dup[2]) - fToC(b ?? a)) <= 25) {
      last += dup[0].length;
      F_TEMP.lastIndex = last;
    }
  }
  out += text.slice(last);
  return metricizeAmounts(out, lang);
}

// ---------------------------------------------------------------------------
// Amounts inside free text (steps, ingredient notes). Cups and spoons are left as written.

const VULGAR: Record<string, number> = {
  '½': 1 / 2, '¼': 1 / 4, '¾': 3 / 4, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 1 / 8, '⅜': 3 / 8, '⅝': 5 / 8, '⅞': 7 / 8,
};
/** "1 1/2", "1-1/2", "1½", "½", "3/4", "2.5", "12" */
const NUM = String.raw`\d+(?:\s+|-)\d+\/\d+|\d+\/\d+|\d+\s?[½¼¾⅓⅔⅛⅜⅝⅞]|[½¼¾⅓⅔⅛⅜⅝⅞]|\d+(?:\.\d+)?`;

/** Parse an amount written in a recipe: "1 1/2", "1-1/2", "1½", "½", "3/4", "2.5". */
export function parseAmount(text: string): number | null {
  const t = text.trim();
  let m = /^(\d+)(?:\s+|-)(\d+)\/(\d+)$/.exec(t);
  if (m) return Number(m[3]) ? Number(m[1]) + Number(m[2]) / Number(m[3]) : null;
  m = /^(\d+)\/(\d+)$/.exec(t);
  if (m) return Number(m[2]) ? Number(m[1]) / Number(m[2]) : null;
  m = /^(\d+)?\s?([½¼¾⅓⅔⅛⅜⅝⅞])$/.exec(t);
  if (m) return (m[1] ? Number(m[1]) : 0) + VULGAR[m[2]];
  return /^\d+(?:\.\d+)?$/.test(t) ? Number(t) : null;
}

const SEP = String.raw`\s*(?:-|–|to|or)\s*`;
/** Pan sizes: "9x13-inch", "8 x 8 x 2 inch", '9"x13"' */
const DIMENSIONS = new RegExp(
  String.raw`(^|[^\w/.])(${NUM})"?\s*(?:x|×|by)\s*(${NUM})"?(?:\s*(?:x|×|by)\s*(${NUM}))?(\s*-?\s*)(inch(?:es)?\b|")`,
  'gi',
);
/** "8-ounce", "1 1/2 lbs", "2 to 3 pounds", "1 quart", "1/2-inch", '9"' — not cups/spoons. */
const AMOUNT = new RegExp(
  String.raw`(^|[^\w/.,½¼¾⅓⅔⅛⅜⅝⅞-])(${NUM})(?:${SEP}(${NUM}))?(\s*-?\s*)(fl\.?\s?oz\b\.?|fluid\s+ounces?\b|ounces?\b|oz\b\.?|pounds?\b|lbs?\b\.?|pints?\b|quarts?\b|qts?\b\.?|gallons?\b|inch(?:es)?\b|")`,
  'gi',
);
/** "6-ounce ramekins", "12-ounce glass": ounces of volume. */
const FLUID_CONTAINER = /^\s*(?:custard\s+)?(?:glass(?:es)?|mugs?|jars?|bottles?|ramekins?|cups?|molds?|moulds?|pitchers?|carafes?)\b/i;

function unitOf(token: string): string {
  const t = token.toLowerCase();
  if (t.startsWith('fl')) return 'floz';
  if (t.startsWith('o')) return 'oz';
  if (t.startsWith('po') || t.startsWith('l')) return 'lb';
  if (t.startsWith('pi')) return 'pint';
  if (t.startsWith('q')) return 'quart';
  if (t.startsWith('g')) return 'gallon';
  return 'inch';
}

function metricAmount(qmin: number, qmax: number | null, unit: string, lang: 'en' | 'fr'): string {
  const q = convertQuantity({ qmin, qmax, unit }, 'metric');
  const a = formatMetric(q.qmin!, q.unit, lang);
  const b = q.qmax != null ? formatMetric(q.qmax, q.unit, lang) : null;
  return `${b && b !== a ? `${a}–${b}` : a} ${unitLabel(q.unit!, q.qmax ?? q.qmin!)}`;
}

function metricizeAmounts(text: string, lang: 'en' | 'fr'): string {
  const out = text.replace(DIMENSIONS, (whole, pre: string, w: string, h: string, d: string | undefined, sep: string, unit: string) => {
    const dims = [w, h, d].filter((x): x is string => !!x).map(parseAmount);
    if (dims.some((x) => x == null) || (unit === '"' && sep)) return whole;
    return `${pre}${dims.map((x) => formatMetric(x! * 2.54, 'cm', lang)).join(' x ')} cm`;
  });
  const converted = out.replace(
    AMOUNT,
    (whole, pre: string, a: string, b: string | undefined, sep: string, token: string, offset: number, all: string) => {
      if (token === '"' && sep) return whole; // a closing quote, not inches
      const qmin = parseAmount(a);
      const qmax = b ? parseAmount(b) : null;
      if (qmin == null || (b && qmax == null)) return whole;
      let unit = unitOf(token);
      if (unit === 'oz' && FLUID_CONTAINER.test(all.slice(offset + whole.length))) unit = 'floz';
      return `${pre}${metricAmount(qmin, qmax, unit, lang)}`;
    },
  );
  // "an 8-inch pan" became "an 20 cm pan": fix the article for the new number.
  return converted.replace(ARTICLE_BEFORE_METRIC, (_whole, article: string, num: string) => {
    const an = /^8/.test(num) || /^1[18](?![\d])/.test(num);
    const word = an ? 'an' : 'a';
    return `${article[0] === 'A' ? word[0].toUpperCase() + word.slice(1) : word} `;
  });
}

const ARTICLE_BEFORE_METRIC = /\b(an?|An?) (?=(\d[\d.,]*)(?:–[\d.,]+)?(?: x [\d.,]+)* (?:mm|cm|g|kg|ml|l)\b)/g;

/** Scale factor for a recipe, e.g. recipe serves 4, user wants 6 -> 1.5 */
export function scaleFactor(recipeServings: number | null | undefined, wanted: number): number {
  if (!recipeServings || recipeServings <= 0 || !wanted) return 1;
  return wanted / recipeServings;
}
