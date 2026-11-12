/**
 * Identifies the bundled recipe database. CI overwrites this file with the
 * full database's sha256 prefix (see .github/workflows/*). A new value makes the
 * app import the new asset under a new file name and delete the old copy.
 */
export const RECIPE_DB_VERSION = 'sample';
export const RECIPE_DB_NAME = `recipes-${RECIPE_DB_VERSION}.db`;
