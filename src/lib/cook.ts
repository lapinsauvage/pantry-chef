/**
 * "What can I cook?" options and helpers. Pure (no React / expo) so they can be unit-tested.
 */
import type { RecipeFilters } from '../db/recipes.ts';
import { MEAL_COURSES } from './constants.ts';
import type { Settings } from './settings.ts';

/** Course chips on the Cook tab; "meals" is the default. */
export const COURSE_GROUPS = [
  { key: 'meals', courses: MEAL_COURSES },
  { key: 'desserts', courses: ['dessert'] },
  { key: 'baking', courses: ['baking'] },
  { key: 'snacks', courses: ['snack'] },
  { key: 'drinks', courses: ['drink'] },
] as const satisfies readonly { key: string; courses: readonly string[] }[];

export type CourseGroup = (typeof COURSE_GROUPS)[number]['key'];

/** "Missing allowed" choices: 0 = cook right now. */
export const MISSING_CHOICES = [0, 1, 2, 3] as const;

export interface CookOptions {
  /** null = any time */
  maxMinutes: number | null;
  maxMissing: number;
  courseGroup: CourseGroup;
  /** Overrides of the user's settings for this search only; undefined = use Settings. */
  equipment?: number;
  diet?: number;
  avoid?: number;
}

export const DEFAULT_COOK_OPTIONS: CookOptions = { maxMinutes: null, maxMissing: 1, courseGroup: 'meals' };

type KitchenSettings = Pick<Settings, 'equipment' | 'diet' | 'avoid'>;

/** Filters for findByPantry from the Cook tab options and the user's settings. */
export function cookFilters(opts: CookOptions, settings: KitchenSettings): RecipeFilters {
  const group = COURSE_GROUPS.find((g) => g.key === opts.courseGroup) ?? COURSE_GROUPS[0];
  return {
    courses: [...group.courses],
    maxMinutes: opts.maxMinutes,
    equipmentAvailable: opts.equipment ?? settings.equipment,
    dietMask: opts.diet ?? settings.diet,
    avoidMask: opts.avoid ?? settings.avoid,
  };
}

/** True when the filter sheet differs from Settings (shown as a badge on the Filters button). */
export function hasOverrides(opts: CookOptions, settings: KitchenSettings): boolean {
  return (
    (opts.equipment !== undefined && opts.equipment !== settings.equipment) ||
    (opts.diet !== undefined && opts.diet !== settings.diet) ||
    (opts.avoid !== undefined && opts.avoid !== settings.avoid)
  );
}

/** Stable key of everything that changes the result list (to debounce and drop stale responses). */
export function queryKey(selected: readonly number[], basics: readonly number[], opts: CookOptions, filters: RecipeFilters): string {
  return JSON.stringify([[...selected].sort((a, b) => a - b), [...basics].sort((a, b) => a - b), opts.maxMissing, filters]);
}

/**
 * Ingredients of a recipe the user doesn't have: distinct ingredient ids from its lines,
 * minus owned (pantry ∪ basics) and staples (water, salt, pepper…), in recipe order.
 */
export function missingIds(
  lineIds: readonly (number | null | undefined)[],
  owned: ReadonlySet<number>,
  staples: ReadonlySet<number>,
): number[] {
  const out: number[] = [];
  for (const id of lineIds) {
    if (id == null || owned.has(id) || staples.has(id) || out.includes(id)) continue;
    out.push(id);
  }
  return out;
}

export type LineStatus = 'owned' | 'missing' | 'unknown';

/** Mark an ingredient line on the recipe screen: ✓ owned (or staple), missing, or not matched. */
export function lineStatus(id: number | null | undefined, owned: ReadonlySet<number>, staples: ReadonlySet<number>): LineStatus {
  if (id == null) return 'unknown';
  return owned.has(id) || staples.has(id) ? 'owned' : 'missing';
}

/** Servings stepper bounds. */
export function clampServings(n: number): number {
  return Math.min(99, Math.max(1, Math.round(n)));
}
