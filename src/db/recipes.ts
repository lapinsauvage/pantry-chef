/**
 * Read-only queries against the bundled recipe database (assets/db/recipes.db).
 * Schema: see docs/DATA.md. All functions take an expo-sqlite database handle,
 * from `useRecipeDb()` (src/db/recipe-db.ts; suspends until the first-launch import is done).
 */
import type { SQLiteBindValue, SQLiteDatabase } from 'expo-sqlite';

import { MEAL_COURSES } from '@/lib/constants';
import { type IngredientTuple, parseIngredientTuple, type IngredientLine } from '@/lib/units';

export interface RecipeFilters {
  /** Bitmask of appliances the user HAS (EQUIPMENT bits). Recipes needing others are hidden. */
  equipmentAvailable?: number;
  /** Max total time in minutes (prep + cook + waiting). */
  maxMinutes?: number | null;
  courses?: string[];
  cuisines?: string[];
  /** Every selected diet bit must be set (DIETS). */
  dietMask?: number;
  /** Hide recipes containing any of these (AVOID bits). */
  avoidMask?: number;
  maxDifficulty?: 1 | 2 | 3;
  withImageOnly?: boolean;
}

export interface RecipeCard {
  id: number;
  name: string;
  image: string | null;
  total_min: number | null;
  rating: number | null;
  reviews: number | null;
  course: string;
  cuisine: string;
  difficulty: number;
  kcal: number | null;
  /** Only set by findByPantry */
  missing?: number;
  hits?: number;
}

const CARD_COLUMNS =
  'r.id, r.name, r.image, r.total_min, r.rating, r.reviews, r.course, r.cuisine, r.difficulty, r.kcal';

function placeholders(n: number): string {
  return Array.from({ length: n }, () => '?').join(',');
}

/** WHERE fragments for the shared filters (always prefixed by "AND"). */
export function filterSql(f: RecipeFilters): { sql: string; params: SQLiteBindValue[] } {
  const parts: string[] = [];
  const params: SQLiteBindValue[] = [];
  if (f.equipmentAvailable != null) {
    parts.push('(r.equipment & ~?) = 0');
    params.push(f.equipmentAvailable);
  }
  if (f.maxMinutes) {
    parts.push('r.total_min <= ?');
    params.push(f.maxMinutes);
  }
  if (f.courses?.length) {
    parts.push(`r.course IN (${placeholders(f.courses.length)})`);
    params.push(...f.courses);
  }
  if (f.cuisines?.length) {
    parts.push(`r.cuisine IN (${placeholders(f.cuisines.length)})`);
    params.push(...f.cuisines);
  }
  if (f.dietMask) {
    parts.push('(r.diet & ?) = ?');
    params.push(f.dietMask, f.dietMask);
  }
  if (f.avoidMask) {
    parts.push('(r.avoid & ?) = 0');
    params.push(f.avoidMask);
  }
  if (f.maxDifficulty) {
    parts.push('r.difficulty <= ?');
    params.push(f.maxDifficulty);
  }
  if (f.withImageOnly) parts.push('r.image IS NOT NULL');
  return { sql: parts.map((p) => ` AND ${p}`).join(''), params };
}

export interface PantryQuery {
  /** Ingredient ids the user picked ("what's in my fridge"). */
  selected: number[];
  /** Ingredient ids the user always has ("basics"). */
  basics: number[];
  /** Allow up to N missing ingredients (0 = cook right now). */
  maxMissing: number;
  filters?: RecipeFilters;
  limit?: number;
  offset?: number;
}

/**
 * "What can I cook?" — recipes that use at least one selected ingredient and
 * miss at most `maxMissing` non-staple ingredients, ranked by
 * fewest missing → most selected ingredients used → popularity.
 * ~150 ms on a laptop for 107k recipes; run it off the keystroke path (debounce).
 */
export async function findByPantry(db: SQLiteDatabase, q: PantryQuery): Promise<RecipeCard[]> {
  if (!q.selected.length) return [];
  const have = Array.from(new Set([...q.selected, ...q.basics]));
  const filters = { courses: MEAL_COURSES, ...q.filters };
  const f = filterSql(filters);
  const sql = `
    WITH m AS (
      SELECT recipe_id, COUNT(*) AS have, SUM(ingredient_id IN (${placeholders(q.selected.length)})) AS hits
      FROM recipe_ingredients
      WHERE ingredient_id IN (${placeholders(have.length)})
      GROUP BY recipe_id
      HAVING hits > 0)
    SELECT ${CARD_COLUMNS}, r.n_core - m.have AS missing, m.hits AS hits
    FROM m JOIN recipes r ON r.id = m.recipe_id
    WHERE r.n_core - m.have <= ?${f.sql}
    ORDER BY missing, hits DESC, r.score DESC
    LIMIT ? OFFSET ?`;
  return db.getAllAsync<RecipeCard>(sql, [
    ...q.selected, ...have, q.maxMissing, ...f.params, q.limit ?? 40, q.offset ?? 0,
  ]);
}

export type SortOrder = 'popular' | 'quick' | 'rating' | 'newest';
const ORDER: Record<SortOrder, string> = {
  popular: 'r.score DESC',
  quick: 'r.total_min ASC, r.score DESC',
  rating: 'r.rating DESC, r.reviews DESC',
  newest: 'r.id DESC',
};

/** Browse by category with filters (no text query). */
export async function browse(
  db: SQLiteDatabase,
  filters: RecipeFilters,
  sort: SortOrder = 'popular',
  limit = 40,
  offset = 0,
): Promise<RecipeCard[]> {
  const f = filterSql(filters);
  return db.getAllAsync<RecipeCard>(
    `SELECT ${CARD_COLUMNS} FROM recipes r WHERE 1=1${f.sql} ORDER BY ${ORDER[sort]} LIMIT ? OFFSET ?`,
    [...f.params, limit, offset],
  );
}

/** Turn user text into a safe FTS5 query: every word must match, last word as prefix. */
export function ftsQuery(text: string): string | null {
  const words = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  if (!words.length) return null;
  return words.map((w, i) => (i === words.length - 1 ? `"${w}"*` : `"${w}"`)).join(' ');
}

/** Full-text search on recipe name (weighted), ingredients and keywords. */
export async function search(
  db: SQLiteDatabase,
  text: string,
  filters: RecipeFilters = {},
  limit = 40,
  offset = 0,
): Promise<RecipeCard[]> {
  const match = ftsQuery(text);
  if (!match) return browse(db, filters, 'popular', limit, offset);
  const f = filterSql(filters);
  return db.getAllAsync<RecipeCard>(
    `SELECT ${CARD_COLUMNS} FROM recipe_fts JOIN recipes r ON r.id = recipe_fts.rowid
     WHERE recipe_fts MATCH ?${f.sql}
     ORDER BY bm25(recipe_fts, 10.0, 2.0, 1.0) - r.score * 0.5
     LIMIT ? OFFSET ?`,
    [match, ...f.params, limit, offset],
  );
}

export interface RecipeDetail extends RecipeCard {
  slug: string;
  description: string | null;
  prep_min: number | null;
  cook_min: number | null;
  servings: number | null;
  yield: string | null;
  equipment: number;
  diet: number;
  avoid: number;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  chips: string[];
  steps: string[];
  ingredients: (IngredientLine & { canonical: string | null; canonical_fr: string | null })[];
}

export async function getRecipe(db: SQLiteDatabase, id: number): Promise<RecipeDetail | null> {
  const row = await db.getFirstAsync<Record<string, unknown>>('SELECT * FROM recipes WHERE id = ?', [id]);
  if (!row) return null;
  const lines = (JSON.parse(row.ingredients as string) as IngredientTuple[]).map(parseIngredientTuple);
  const ids = Array.from(new Set(lines.map((l) => l.ingredientId).filter((x): x is number => x != null)));
  const names = ids.length
    ? await db.getAllAsync<{ id: number; name: string; name_fr: string | null }>(
        `SELECT id, name, name_fr FROM ingredients WHERE id IN (${placeholders(ids.length)})`,
        ids,
      )
    : [];
  const byId = new Map(names.map((n) => [n.id, n]));
  return {
    ...(row as unknown as RecipeCard),
    slug: row.slug as string,
    description: row.description as string | null,
    prep_min: row.prep_min as number | null,
    cook_min: row.cook_min as number | null,
    servings: row.servings as number | null,
    yield: row.yield as string | null,
    equipment: row.equipment as number,
    diet: row.diet as number,
    avoid: row.avoid as number,
    protein: row.protein as number | null,
    carbs: row.carbs as number | null,
    fat: row.fat as number | null,
    chips: JSON.parse(row.chips as string),
    steps: JSON.parse(row.steps as string),
    ingredients: lines.map((l) => ({
      ...l,
      canonical: l.ingredientId != null ? byId.get(l.ingredientId)?.name ?? null : null,
      canonical_fr: l.ingredientId != null ? byId.get(l.ingredientId)?.name_fr ?? null : null,
    })),
  };
}

export interface Ingredient {
  id: number;
  name: string;
  name_fr: string | null;
  category: string;
  recipes: number;
  avoid: number;
}

/** Type-ahead for the pantry picker; matches English and French, accent-insensitive. */
export async function searchIngredients(db: SQLiteDatabase, text: string, limit = 30): Promise<Ingredient[]> {
  const t = text
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
  if (!t) return popularIngredients(db, undefined, limit);
  return db.getAllAsync<Ingredient>(
    `SELECT id, name, name_fr, category, recipes, avoid FROM ingredients
     WHERE staple = 0 AND (search LIKE ? OR search LIKE ?)
     ORDER BY (search LIKE ?) DESC, recipes DESC LIMIT ?`,
    [`${t}%`, `% ${t}%`, `${t}%`, limit],
  );
}

/** Most-used ingredients, optionally for one category — for the picker's default grid. */
export async function popularIngredients(db: SQLiteDatabase, category?: string, limit = 60): Promise<Ingredient[]> {
  return db.getAllAsync<Ingredient>(
    `SELECT id, name, name_fr, category, recipes, avoid FROM ingredients
     WHERE staple = 0 ${category ? 'AND category = ?' : ''}
     ORDER BY recipes DESC LIMIT ?`,
    category ? [category, limit] : [limit],
  );
}

/** Ingredients by canonical English name (unknown names are skipped), in the order of `names`. */
export async function ingredientsByName(db: SQLiteDatabase, names: readonly string[]): Promise<Ingredient[]> {
  if (!names.length) return [];
  const rows = await db.getAllAsync<Ingredient>(
    `SELECT id, name, name_fr, category, recipes, avoid FROM ingredients WHERE name IN (${placeholders(names.length)})`,
    [...names],
  );
  const byName = new Map(rows.map((r) => [r.name, r]));
  return names.map((n) => byName.get(n)).filter((r): r is Ingredient => r != null);
}

export async function ingredientsByIds(db: SQLiteDatabase, ids: readonly number[]): Promise<Ingredient[]> {
  if (!ids.length) return [];
  return db.getAllAsync<Ingredient>(
    `SELECT id, name, name_fr, category, recipes, avoid FROM ingredients WHERE id IN (${placeholders(ids.length)})`,
    [...ids],
  );
}

export async function ingredientIdsByName(db: SQLiteDatabase, names: string[]): Promise<number[]> {
  if (!names.length) return [];
  const rows = await db.getAllAsync<{ id: number }>(
    `SELECT id FROM ingredients WHERE name IN (${placeholders(names.length)})`,
    names,
  );
  return rows.map((r) => r.id);
}

/**
 * Ingredients of a recipe the user doesn't have. Note: scans recipe_ingredients (no index by
 * recipe); the app uses recipeIngredientIds + missingIds (src/lib/cook.ts) instead.
 */
export async function missingIngredients(
  db: SQLiteDatabase,
  recipeId: number,
  have: number[],
): Promise<Ingredient[]> {
  return db.getAllAsync<Ingredient>(
    `SELECT i.id, i.name, i.name_fr, i.category, i.recipes, i.avoid
     FROM recipe_ingredients ri JOIN ingredients i ON i.id = ri.ingredient_id
     WHERE ri.recipe_id = ? ${have.length ? `AND ri.ingredient_id NOT IN (${placeholders(have.length)})` : ''}
     ORDER BY i.category, i.name`,
    [recipeId, ...have],
  );
}

const stapleCache = new WeakMap<SQLiteDatabase, Promise<ReadonlySet<number>>>();

/** Ids of the staples (water, salt, pepper…) that never count as missing (cached per database). */
export function stapleIds(db: SQLiteDatabase): Promise<ReadonlySet<number>> {
  let ids = stapleCache.get(db);
  if (!ids) {
    ids = db
      .getAllAsync<{ id: number }>('SELECT id FROM ingredients WHERE staple = 1')
      .then((rows) => new Set(rows.map((r) => r.id)));
    stapleCache.set(db, ids);
  }
  return ids;
}

/**
 * Ingredient ids of each recipe, in recipe order, read from `recipes.ingredients` (primary-key
 * lookups; recipe_ingredients has no index by recipe). Used to name what a result card misses.
 */
export async function recipeIngredientIds(db: SQLiteDatabase, recipeIds: readonly number[]): Promise<Map<number, number[]>> {
  if (!recipeIds.length) return new Map();
  const rows = await db.getAllAsync<{ id: number; ingredients: string }>(
    `SELECT id, ingredients FROM recipes WHERE id IN (${placeholders(recipeIds.length)})`,
    [...recipeIds],
  );
  return new Map(
    rows.map((r) => [
      r.id,
      (JSON.parse(r.ingredients) as IngredientTuple[]).map((t) => t[7]).filter((x): x is number => x != null),
    ]),
  );
}

export async function dataInfo(db: SQLiteDatabase): Promise<Record<string, string>> {
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM meta');
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}
