/// <reference types="node" />
/**
 * Runs the real queries of src/db/recipes.ts against the committed sample database
 * (assets/db/recipes.db) through Node's built-in SQLite, with a tiny expo-sqlite-shaped adapter.
 */
import type { SQLiteDatabase } from 'expo-sqlite';
import { strict as assert } from 'node:assert';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

import {
  browse,
  findByPantry,
  ftsQuery,
  ingredientsByName,
  matchIngredient,
  recipeCardsByIds,
  recipeIngredientIds,
  type RecipeFilters,
  search,
  searchAlternatives,
  stapleIds,
} from '../../db/recipes.ts';
import { DIETS, EQUIPMENT } from '../constants.ts';
import { missingIds } from '../cook.ts';

const raw = new DatabaseSync(new URL('../../../assets/db/recipes.db', import.meta.url).pathname, { readOnly: true });
const db = {
  getAllAsync: async (sql: string, params: unknown[] = []) => raw.prepare(sql).all(...(params as never[])),
  getFirstAsync: async (sql: string, params: unknown[] = []) => raw.prepare(sql).get(...(params as never[])) ?? null,
} as unknown as SQLiteDatabase;

const bit = (flags: { key: string; bit: number }[], key: string) => flags.find((f) => f.key === key)!.bit;
const OVEN = bit(EQUIPMENT, 'oven');
const SLOW = bit(EQUIPMENT, 'slow_cooker');
const VEG = bit(DIETS, 'vegetarian');

/** Full rows for the ids returned by a query, to check filters against the data. */
function rowsOf(ids: number[]) {
  return ids.map(
    (id) =>
      raw.prepare('SELECT id, course, cuisine, total_min, image, diet, avoid, equipment, difficulty, chips, rating, reviews, score FROM recipes WHERE id = ?').get(id) as {
        id: number; course: string; cuisine: string; total_min: number; image: string | null; diet: number; avoid: number;
        equipment: number; difficulty: number; chips: string; rating: number; reviews: number; score: number;
      },
  );
}

test('FTS query text: accents, prefix on the last word, alternatives', () => {
  assert.equal(ftsQuery('Crème  brûlée'), '"creme" AND "brulee"*');
  assert.equal(ftsQuery('  ?! '), null);
  assert.equal(
    ftsQuery('poulet riz', new Map([['poulet', ['chicken']], ['riz', ['rice', 'brown rice']]])),
    '("poulet" OR "chicken") AND ("riz"* OR "rice" OR "brown rice")',
  );
});

test('French ingredient words map to English names; English words add nothing', async () => {
  const alt = await searchAlternatives(db, 'poulet riz chicken');
  assert.ok(alt.get('poulet')?.includes('chicken'), JSON.stringify([...alt]));
  assert.ok(alt.get('riz')?.includes('rice'), JSON.stringify([...alt]));
  assert.equal(alt.has('chicken'), false);
});

test('search in French finds the English recipes', async () => {
  const fr = await search(db, 'poulet riz', {}, 'relevance', 20);
  assert.ok(fr.length >= 5, `only ${fr.length}`);
  const en = new Set((await search(db, 'chicken rice', {}, 'relevance', 200)).map((r) => r.id));
  assert.ok(fr.filter((r) => en.has(r.id)).length >= fr.length * 0.6);
});

test('search while typing: the last word is a prefix', async () => {
  const partial = await search(db, 'chocol', {}, 'relevance', 10);
  assert.ok(partial.length > 0);
  assert.ok(partial.some((r) => /chocol/i.test(r.name)));
});

test('filters combine (AND) in browse and search', async () => {
  const f: RecipeFilters = { courses: ['dessert'], maxMinutes: 60, withImageOnly: true, dietMask: VEG, maxDifficulty: 2 };
  const rows = rowsOf((await browse(db, f, 'popular', 200)).map((r) => r.id));
  assert.ok(rows.length > 0);
  for (const r of rows) {
    assert.equal(r.course, 'dessert');
    assert.ok(r.total_min <= 60);
    assert.notEqual(r.image, null);
    assert.equal(r.diet & VEG, VEG);
    assert.ok(r.difficulty <= 2);
  }
  const all = await browse(db, {}, 'popular', 5000);
  const desserts = await browse(db, { courses: ['dessert'] }, 'popular', 5000);
  const combined = await browse(db, f, 'popular', 5000);
  assert.ok(combined.length < desserts.length && desserts.length < all.length);

  const found = rowsOf((await search(db, 'chocolate', { courses: ['dessert'], maxMinutes: 45 }, 'relevance', 100)).map((r) => r.id));
  assert.ok(found.length > 0);
  for (const r of found) assert.ok(r.course === 'dessert' && r.total_min <= 45);
});

test('collections: chips, required appliance, without oven, avoid', async () => {
  const onePot = rowsOf((await browse(db, { chips: ['one_pot'] }, 'popular', 500)).map((r) => r.id));
  assert.ok(onePot.length > 0);
  for (const r of onePot) assert.ok(JSON.parse(r.chips).includes('one_pot'));

  const slow = rowsOf((await browse(db, { equipmentRequired: SLOW }, 'popular', 500)).map((r) => r.id));
  assert.ok(slow.length > 0);
  for (const r of slow) assert.equal(r.equipment & SLOW, SLOW);

  const noOven = rowsOf((await browse(db, { equipmentAvailable: 0x7ff & ~OVEN }, 'popular', 500)).map((r) => r.id));
  assert.ok(noOven.length > 0);
  for (const r of noOven) assert.equal(r.equipment & OVEN, 0);

  const noPork = rowsOf((await browse(db, { avoidMask: 512 }, 'popular', 500)).map((r) => r.id));
  for (const r of noPork) assert.equal(r.avoid & 512, 0);
});

test('sort orders and paging', async () => {
  const quick = rowsOf((await browse(db, {}, 'quick', 60)).map((r) => r.id));
  for (let i = 1; i < quick.length; i++) assert.ok(quick[i - 1].total_min <= quick[i].total_min);
  const rated = rowsOf((await browse(db, {}, 'rating', 60)).map((r) => r.id));
  for (let i = 1; i < rated.length; i++) assert.ok(rated[i - 1].rating >= rated[i].rating);
  const popular = rowsOf((await browse(db, {}, 'popular', 60)).map((r) => r.id));
  for (let i = 1; i < popular.length; i++) assert.ok(popular[i - 1].score >= popular[i].score);

  const page1 = (await browse(db, { courses: ['main'] }, 'popular', 40, 0)).map((r) => r.id);
  const page2 = (await browse(db, { courses: ['main'] }, 'popular', 40, 40)).map((r) => r.id);
  assert.equal(page2.filter((id) => page1.includes(id)).length, 0);

  const searched = rowsOf((await search(db, 'chicken', {}, 'quick', 40)).map((r) => r.id));
  for (let i = 1; i < searched.length; i++) assert.ok(searched[i - 1].total_min <= searched[i].total_min);
});

test('what can I cook: ranking and missing ingredients agree with the recipe lines', async () => {
  const picked = (await ingredientsByName(db, ['chicken breast', 'rice', 'bell pepper', 'cheddar', 'tomato'])).map((i) => i.id);
  const basics = (await ingredientsByName(db, ['olive oil', 'garlic', 'onion', 'butter', 'egg'])).map((i) => i.id);
  const results = await findByPantry(db, { selected: picked, basics, maxMissing: 2, limit: 80 });
  assert.ok(results.length > 10);
  for (let i = 1; i < results.length; i++) {
    const [a, b] = [results[i - 1], results[i]];
    assert.ok(a.missing! < b.missing! || (a.missing === b.missing && a.hits! >= b.hits!), `order at ${i}`);
  }
  const staples = await stapleIds(db);
  const lines = await recipeIngredientIds(db, results.map((r) => r.id));
  const owned = new Set([...picked, ...basics]);
  for (const r of results) {
    assert.ok(r.missing! <= 2 && r.hits! >= 1);
    assert.equal(missingIds(lines.get(r.id)!, owned, staples).length, r.missing, `recipe ${r.id}`);
  }
});

test('cards by ids keep the given order and skip unknown ids', async () => {
  const ids = (await browse(db, {}, 'popular', 3)).map((r) => r.id).reverse();
  const cards = await recipeCardsByIds(db, [ids[0], 999999999, ids[1], ids[2]]);
  assert.deepEqual(cards.map((c) => c.id), ids);
  assert.deepEqual(await recipeCardsByIds(db, []), []);
});

test('typed shopping items match ingredients in English or French', async () => {
  assert.equal((await matchIngredient(db, 'Oignon'))?.name, 'onion');
  assert.equal((await matchIngredient(db, ' garlic '))?.name, 'garlic');
  assert.equal((await matchIngredient(db, 'oeuf'))?.name, 'egg');
  assert.equal((await matchIngredient(db, 'Sucre impalpable'))?.name, 'powdered sugar');
  assert.equal(await matchIngredient(db, 'batteries'), null);
  assert.equal(await matchIngredient(db, 'oign'), null); // prefixes don't count
});
