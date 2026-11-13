/**
 * Identifies the bundled recipe database. Written by scripts/use-full-db.sh in CI.
 * A new value makes the app import the new asset under a new file name and delete the old copy.
 */
export const RECIPE_DB_VERSION = 'sample';
export const RECIPE_DB_NAME = `recipes-${RECIPE_DB_VERSION}.db`;
/** Size of the bundled database in bytes (first-launch import progress). */
export const RECIPE_DB_BYTES = 5595136;
