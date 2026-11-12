/**
 * The user's own data (pantry, basics, appliances, favourites, shopping list,
 * settings) lives in a separate database so replacing the recipe database on
 * an app update never touches it.
 */
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

const USER_DB_VERSION = 1;
let db: SQLiteDatabase | null = null;

export function userDb(): SQLiteDatabase {
  if (!db) {
    db = openDatabaseSync('user.db');
    migrate(db);
  }
  return db;
}

function migrate(d: SQLiteDatabase): void {
  const row = d.getFirstSync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  if (current >= USER_DB_VERSION) return;
  if (current < 1) {
    d.execSync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
      -- ingredient ids refer to recipes.db ingredients.id; names kept so they survive a data rebuild
      CREATE TABLE IF NOT EXISTS pantry (ingredient_id INTEGER PRIMARY KEY NOT NULL, name TEXT NOT NULL, added_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS basics (ingredient_id INTEGER PRIMARY KEY NOT NULL, name TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS favorites (recipe_id INTEGER PRIMARY KEY NOT NULL, added_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS history (recipe_id INTEGER PRIMARY KEY NOT NULL, viewed_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS shopping_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT NOT NULL, ingredient_id INTEGER,
        recipe_id INTEGER, checked INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
    `);
  }
  d.execSync(`PRAGMA user_version = ${USER_DB_VERSION}`);
}

export function getSetting(key: string): string | null {
  return userDb().getFirstSync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key])?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  userDb().runSync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
}

export function getAllSettings(): Record<string, string> {
  const rows = userDb().getAllSync<{ key: string; value: string }>('SELECT key, value FROM settings');
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

/** Write several settings at once (one transaction). */
export function setSettings(rows: [key: string, value: string][]): void {
  const d = userDb();
  d.withTransactionSync(() => {
    for (const [key, value] of rows) {
      d.runSync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
    }
  });
}

/** Known setting keys (typed access to the user's preferences: src/state/settings.ts) */
export const SETTINGS = {
  language: 'language', // 'en' | 'fr' | 'system'
  units: 'units', // 'metric' | 'us'
  equipment: 'equipment', // bitmask of appliances the user has
  avoid: 'avoid', // bitmask of AVOID flags
  diet: 'diet', // bitmask of DIETS flags
  onboarded: 'onboarded', // '1' after first-run setup
  recipeDbName: 'recipe_db_name', // recipe database file whose import completed
  basicsSeeded: 'basics_seeded', // '1' once DEFAULT_BASICS were added on first launch
} as const;

// ---------------------------------------------------------------------------
// Basics ("I always have these")

export interface UserIngredient {
  /** recipes.db ingredients.id */
  id: number;
  /** canonical English name (survives a data rebuild that renumbers ids) */
  name: string;
}

export function getBasics(): UserIngredient[] {
  return userDb().getAllSync<UserIngredient>('SELECT ingredient_id AS id, name FROM basics ORDER BY name');
}

export function addBasic(item: UserIngredient): void {
  userDb().runSync('INSERT OR REPLACE INTO basics (ingredient_id, name) VALUES (?, ?)', [item.id, item.name]);
}

export function removeBasic(id: number): void {
  userDb().runSync('DELETE FROM basics WHERE ingredient_id = ?', [id]);
}

// ---------------------------------------------------------------------------
// Maintenance

/**
 * After a new recipe database was imported, point pantry and basics at the new
 * ingredient ids (matched by name). Items whose name no longer exists are dropped.
 */
export function remapIngredientIds(idsByName: ReadonlyMap<string, number>): void {
  const d = userDb();
  d.withTransactionSync(() => {
    const basics = d.getAllSync<{ name: string }>('SELECT name FROM basics');
    const pantry = d.getAllSync<{ name: string; added_at: number }>('SELECT name, added_at FROM pantry');
    d.runSync('DELETE FROM basics');
    d.runSync('DELETE FROM pantry');
    for (const b of basics) {
      const id = idsByName.get(b.name);
      if (id != null) d.runSync('INSERT OR REPLACE INTO basics (ingredient_id, name) VALUES (?, ?)', [id, b.name]);
    }
    for (const p of pantry) {
      const id = idsByName.get(p.name);
      if (id != null) {
        d.runSync('INSERT OR REPLACE INTO pantry (ingredient_id, name, added_at) VALUES (?, ?, ?)', [id, p.name, p.added_at]);
      }
    }
  });
}

/** Names of every ingredient the user data refers to (for remapIngredientIds). */
export function userIngredientNames(): string[] {
  return userDb()
    .getAllSync<{ name: string }>('SELECT name FROM basics UNION SELECT name FROM pantry')
    .map((r) => r.name);
}

/** "Reset app data": forget everything the user entered (the recipe database stays). */
export function resetUserData(): void {
  const d = userDb();
  d.withTransactionSync(() => {
    d.runSync('DELETE FROM settings WHERE key <> ?', [SETTINGS.recipeDbName]);
    for (const table of ['pantry', 'basics', 'favorites', 'history', 'shopping_items']) {
      d.runSync(`DELETE FROM ${table}`);
    }
  });
}
