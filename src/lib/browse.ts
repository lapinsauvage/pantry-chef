/**
 * Browse tab: collections, course/cuisine presets and how they combine with the filter sheet
 * and Settings. Pure (no React / expo) so it can be unit-tested.
 */
import type { RecipeFilters, SearchSort } from '../db/recipes.ts';
import { COURSES, CUISINES, DIETS, EQUIPMENT } from './constants.ts';
import type { Settings } from './settings.ts';

const bitOf = (flags: readonly { key: string; bit: number }[], key: string) => flags.find((f) => f.key === key)!.bit;
const OVEN = bitOf(EQUIPMENT, 'oven');

/** A preset is what a collection, course or cuisine tile selects. */
export interface Preset extends RecipeFilters {
  /** Appliances the recipes must NOT need (e.g. "No oven"). */
  withoutEquipment?: number;
}

export const COLLECTIONS = [
  { key: 'quick', emoji: '⏱️', preset: { maxMinutes: 15 } },
  { key: 'vegetarian', emoji: '🥕', preset: { dietMask: bitOf(DIETS, 'vegetarian') } },
  { key: 'one_pot', emoji: '🍲', preset: { chips: ['one_pot'] } },
  { key: 'kid_friendly', emoji: '🧒', preset: { chips: ['kid_friendly'] } },
  { key: 'budget', emoji: '💶', preset: { chips: ['budget'] } },
  { key: 'slow_cooker', emoji: '🫕', preset: { equipmentRequired: bitOf(EQUIPMENT, 'slow_cooker') } },
  { key: 'no_oven', emoji: '🍳', preset: { withoutEquipment: OVEN } },
  { key: 'desserts', emoji: '🍰', preset: { courses: ['dessert'] } },
] as const satisfies readonly { key: string; emoji: string; preset: Preset }[];

export type CollectionKey = (typeof COLLECTIONS)[number]['key'];
export type PresetKind = 'collection' | 'course' | 'cuisine';

/** Preset for a Browse list screen (route params), or null if unknown. */
export function presetFor(kind: string | undefined, key: string | undefined): Preset | null {
  if (kind === 'collection') return COLLECTIONS.find((c) => c.key === key)?.preset ?? null;
  if (kind === 'course') return COURSES.some((c) => c.key === key) ? { courses: [key!] } : null;
  if (kind === 'cuisine') return CUISINES.some((c) => c.key === key) ? { cuisines: [key!] } : null;
  return null;
}

/** Sorts offered on Browse ("relevance" only with search text). */
export type BrowseSort = Exclude<SearchSort, 'newest'>;

/** Filter sheet + sort for the Browse tab (session only). */
export interface BrowseOptions {
  sort: BrowseSort;
  maxMinutes: number | null;
  maxDifficulty: 1 | 2 | 3 | null;
  cuisines: string[];
  withImageOnly: boolean;
  /** Overrides of Settings; undefined = use Settings. */
  equipment?: number;
  diet?: number;
  avoid?: number;
}

export const DEFAULT_BROWSE_OPTIONS: BrowseOptions = {
  sort: 'relevance',
  maxMinutes: null,
  maxDifficulty: null,
  cuisines: [],
  withImageOnly: false,
};

/** Sort to use: "relevance" only means something with search text. */
export function effectiveSort(sort: BrowseSort, hasText: boolean): BrowseSort {
  return !hasText && sort === 'relevance' ? 'popular' : sort;
}

export function sortChoices(hasText: boolean): BrowseSort[] {
  const base: BrowseSort[] = ['popular', 'quick', 'rating'];
  return hasText ? ['relevance', ...base] : base;
}

type KitchenSettings = Pick<Settings, 'equipment' | 'diet' | 'avoid'>;

function minDefined(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a == null) return b ?? null;
  if (b == null) return a;
  return Math.min(a, b);
}

/**
 * Everything AND-ed: preset ∧ filter sheet ∧ Settings. A collection's required appliance counts
 * as available (opening "Slow cooker" means you want slow-cooker recipes).
 */
export function browseFilters(preset: Preset | null, opts: BrowseOptions, settings: KitchenSettings): RecipeFilters {
  const p = preset ?? {};
  let cuisines = opts.cuisines;
  if (p.cuisines?.length) {
    cuisines = opts.cuisines.length ? p.cuisines.filter((c) => opts.cuisines.includes(c)) : [...p.cuisines];
    if (!cuisines.length) cuisines = ['__none__']; // contradictory choices: no results
  }
  const available = ((opts.equipment ?? settings.equipment) | (p.equipmentRequired ?? 0)) & ~(p.withoutEquipment ?? 0);
  const f: RecipeFilters = {
    equipmentAvailable: available,
    dietMask: (opts.diet ?? settings.diet) | (p.dietMask ?? 0),
    avoidMask: (opts.avoid ?? settings.avoid) | (p.avoidMask ?? 0),
    maxMinutes: minDefined(p.maxMinutes, opts.maxMinutes),
  };
  if (p.courses?.length) f.courses = [...p.courses];
  if (cuisines.length) f.cuisines = cuisines;
  if (p.chips?.length) f.chips = [...p.chips];
  if (p.equipmentRequired) f.equipmentRequired = p.equipmentRequired;
  if (opts.maxDifficulty) f.maxDifficulty = opts.maxDifficulty;
  if (opts.withImageOnly) f.withImageOnly = true;
  return f;
}

/** How many filter-sheet choices differ from the defaults/Settings (badge on the Filters chip). */
export function activeFilterCount(opts: BrowseOptions, settings: KitchenSettings): number {
  return [
    opts.maxMinutes != null,
    opts.maxDifficulty != null,
    opts.cuisines.length > 0,
    opts.withImageOnly,
    opts.equipment !== undefined && opts.equipment !== settings.equipment,
    opts.diet !== undefined && opts.diet !== settings.diet,
    opts.avoid !== undefined && opts.avoid !== settings.avoid,
  ].filter(Boolean).length;
}
