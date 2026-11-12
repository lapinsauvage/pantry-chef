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

/** Known setting keys */
export const SETTINGS = {
  language: 'language', // 'en' | 'fr' | 'system'
  units: 'units', // 'metric' | 'us'
  equipment: 'equipment', // bitmask of appliances the user has
  avoid: 'avoid', // bitmask of AVOID flags
  diet: 'diet', // bitmask of DIETS flags
  onboarded: 'onboarded', // '1' after first-run setup
  recipeDbName: 'recipe_db_name', // last imported recipe database file
} as const;
