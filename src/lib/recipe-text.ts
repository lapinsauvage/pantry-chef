/**
 * Which texts of a recipe are shown: its machine-translated French (docs/TRANSLATOR.md) or the
 * original English. The French was translated from the metric English, so it is used only when
 * the app is in French AND metric; otherwise the English is shown as before (metricizeText).
 * Pure, unit-tested.
 */
import { metricizeText, type UnitSystem } from './units.ts';

type Lang = 'en' | 'fr';

export interface TranslatedRecipe {
  name: string;
  name_fr: string | null;
  steps: string[];
  steps_fr: (string | null)[] | null;
  ingredients_fr: (string | null)[] | null;
}

/** French recipe texts can be used in this language + unit system. */
export function frenchTextsFit(lang: Lang, units: UnitSystem): boolean {
  return lang === 'fr' && units === 'metric';
}

/** Card / list title: the French name when it fits, else the English one. */
export function recipeTitle(r: { name: string; name_fr?: string | null }, lang: Lang, units: UnitSystem): string {
  return (frenchTextsFit(lang, units) && r.name_fr) || r.name;
}

/** The recipe has some French text (name, a step or an ingredient line). */
export function hasFrenchTexts(r: Pick<TranslatedRecipe, 'name_fr' | 'steps_fr' | 'ingredients_fr'>): boolean {
  return Boolean(r.name_fr || r.steps_fr?.some(Boolean) || r.ingredients_fr?.some(Boolean));
}

/** Steps as shown: French where translated (already metric), else English through metricizeText. */
export function shownSteps(r: TranslatedRecipe, french: boolean, units: UnitSystem, lang: Lang): string[] {
  return r.steps.map((s, i) => (french && r.steps_fr?.[i]) || metricizeText(s, units, lang));
}

/** The French "text, note" of ingredient line i when shown in French (for formatIngredient's textFr). */
export function lineFr(r: TranslatedRecipe, i: number, french: boolean): string | null {
  return (french && r.ingredients_fr?.[i]) || null;
}
