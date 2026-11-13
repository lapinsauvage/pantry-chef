/**
 * Opens the bundled recipe database. On first launch (or after an app update that ships a
 * new database) the ~220 MB asset is copied to the app's documents, which takes a few
 * seconds — so it starts in the background as soon as the app starts (src/app/_layout.tsx),
 * onboarding stays usable meanwhile, and screens that need recipes suspend with
 * `useRecipeDb()` under a <Suspense fallback={<PreparingRecipes />}> (which shows the progress).
 */
import { Asset } from 'expo-asset';
import { File, Paths } from 'expo-file-system';
import {
  defaultDatabaseDirectory,
  deleteDatabaseAsync,
  importDatabaseFromAssetAsync,
  openDatabaseAsync,
  type SQLiteDatabase,
} from 'expo-sqlite';
import { use, useSyncExternalStore } from 'react';

import { createStore } from '@/lib/store';
import { basicsStore, seedDefaultBasics } from '@/state/basics';
import { pantryStore } from '@/state/pantry';

import { RECIPE_DB_BYTES, RECIPE_DB_NAME } from './data-version';
import { ingredientsByName } from './recipes';
import { getSetting, remapIngredientIds, setSetting, SETTINGS, userIngredientNames } from './user';

const ASSET = require('../../assets/db/recipes.db');

/** 0–1 while the first-launch copy runs; null when unknown or not importing. */
const progressStore = createStore<number | null>(() => null);

export function useImportProgress(): number | null {
  return useSyncExternalStore(progressStore.subscribe, progressStore.get);
}

/** The on-device database file, or null if the path can't be resolved (then nothing is optimised). */
function dbFile(): File | null {
  try {
    const dir = String(defaultDatabaseDirectory);
    return new File(dir.startsWith('file:') ? dir : `file://${dir}`, RECIPE_DB_NAME);
  } catch {
    return null;
  }
}

function fileExists(file: File | null): boolean | null {
  try {
    return file ? file.exists : null;
  } catch {
    return null;
  }
}

/** Copy the asset, reporting progress by watching the destination file grow. */
async function importAsset(forceOverwrite: boolean): Promise<void> {
  const file = dbFile();
  const poll = setInterval(() => {
    try {
      if (file?.exists && RECIPE_DB_BYTES > 0) progressStore.set(Math.min(1, file.size / RECIPE_DB_BYTES));
    } catch {
      // progress is cosmetic
    }
  }, 250);
  try {
    await importDatabaseFromAssetAsync(RECIPE_DB_NAME, { assetId: ASSET, forceOverwrite });
  } finally {
    clearInterval(poll);
    progressStore.set(null);
  }
}

/**
 * On Android the asset is first extracted from the APK into the cache, then copied: once the
 * import is done, delete that 220 MB cache copy (iOS reads it in place from the app bundle).
 */
function freeAssetCopy(): void {
  try {
    const uri = Asset.fromModule(ASSET).localUri;
    if (uri && uri.startsWith(Paths.cache.uri)) {
      const copy = new File(uri);
      if (copy.exists) copy.delete();
    }
  } catch {
    // only saves space
  }
}

let pending: Promise<SQLiteDatabase> | null = null;

async function openRecipeDb(): Promise<SQLiteDatabase> {
  // The name is recorded only after a complete import, so a copy interrupted by the app
  // being killed is redone instead of leaving a truncated database behind.
  const previous = getSetting(SETTINGS.recipeDbName);
  const exists = fileExists(dbFile());
  const imported = previous === RECIPE_DB_NAME && exists === true;
  if (!imported) {
    // Unknown existence (null) keeps expo-sqlite's own check: copy only if missing.
    await importAsset(previous !== RECIPE_DB_NAME || exists === false);
  }
  const db = await openDatabaseAsync(RECIPE_DB_NAME);
  await db.getFirstAsync('SELECT value FROM meta WHERE key = ?', ['schema_version']);
  // Read-only and ~220 MB: memory-mapped reads make cold queries several times faster.
  await db.execAsync('PRAGMA mmap_size = 268435456').catch(() => {});

  if (previous && previous !== RECIPE_DB_NAME) {
    // A new data build may renumber ingredients: re-link the user's pantry and basics by name.
    const rows = await ingredientsByName(db, userIngredientNames());
    remapIngredientIds(new Map(rows.map((r) => [r.name, r.id])));
    basicsStore.reload();
    pantryStore.reload();
    await deleteDatabaseAsync(previous).catch(() => {});
  }
  setSetting(SETTINGS.recipeDbName, RECIPE_DB_NAME);
  if (!imported) freeAssetCopy();
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
