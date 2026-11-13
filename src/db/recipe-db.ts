/**
 * Opens the bundled recipe database. On first launch (or after an app update that ships a
 * new database) the ~220 MB asset is copied to the app's documents, which takes a few
 * seconds — so it starts in the background as soon as the app starts (src/app/_layout.tsx),
 * onboarding stays usable meanwhile, and screens that need recipes suspend with
 * `useRecipeDb()` under a <Suspense fallback={<PreparingRecipes />}>.
 */
import {
  deleteDatabaseAsync,
  importDatabaseFromAssetAsync,
  openDatabaseAsync,
  type SQLiteDatabase,
} from 'expo-sqlite';
import { use } from 'react';

import { basicsStore, seedDefaultBasics } from '@/state/basics';
import { pantryStore } from '@/state/pantry';

import { RECIPE_DB_NAME } from './data-version';
import { ingredientsByName } from './recipes';
import { getSetting, remapIngredientIds, setSetting, SETTINGS, userIngredientNames } from './user';

let pending: Promise<SQLiteDatabase> | null = null;

async function openRecipeDb(): Promise<SQLiteDatabase> {
  // The name is recorded only after a complete import, so a copy interrupted by the app
  // being killed is redone instead of leaving a truncated database behind.
  const previous = getSetting(SETTINGS.recipeDbName);
  await importDatabaseFromAssetAsync(RECIPE_DB_NAME, {
    assetId: require('../../assets/db/recipes.db'),
    forceOverwrite: previous !== RECIPE_DB_NAME,
  });
  const db = await openDatabaseAsync(RECIPE_DB_NAME);
  await db.getFirstAsync('SELECT value FROM meta WHERE key = ?', ['schema_version']);

  if (previous && previous !== RECIPE_DB_NAME) {
    // A new data build may renumber ingredients: re-link the user's pantry and basics by name.
    const rows = await ingredientsByName(db, userIngredientNames());
    remapIngredientIds(new Map(rows.map((r) => [r.name, r.id])));
    basicsStore.reload();
    pantryStore.reload();
    await deleteDatabaseAsync(previous).catch(() => {});
  }
  setSetting(SETTINGS.recipeDbName, RECIPE_DB_NAME);
  await seedDefaultBasics(db);
  return db;
}

/** The recipe database, imported on first use. A failed attempt is retried on the next call. */
export function recipeDb(): Promise<SQLiteDatabase> {
  pending ??= openRecipeDb().catch((error: unknown) => {
    pending = null;
    throw error;
  });
  return pending;
}

/** Suspends until the recipe database is ready. Wrap callers in <Suspense>. */
export function useRecipeDb(): SQLiteDatabase {
  return use(recipeDb());
}
