#!/usr/bin/env bash
# Put a freshly built recipe database into the app before a native build
# (or, with assets/db/recipes.db itself, just record its version and size).
#   scripts/use-full-db.sh <path/to/recipes.db> <version-id>
# The version id (e.g. sha256 prefix) becomes the on-device file name, so an
# app update with new data re-imports it and deletes the old copy.
set -euo pipefail
SRC="$1"; VERSION="${2:-$(sha256sum "$1" | cut -c1-12)}"
BYTES="$(wc -c < "$SRC" | tr -d ' ')"
[ "$(realpath "$SRC")" = "$(realpath assets/db/recipes.db)" ] || cp "$SRC" assets/db/recipes.db
cat > src/db/data-version.ts <<TS
/**
 * Identifies the bundled recipe database. Written by scripts/use-full-db.sh in CI.
 * A new value makes the app import the new asset under a new file name and delete the old copy.
 */
export const RECIPE_DB_VERSION = '${VERSION}';
export const RECIPE_DB_NAME = \`recipes-\${RECIPE_DB_VERSION}.db\`;
/** Size of the bundled database in bytes (first-launch import progress). */
export const RECIPE_DB_BYTES = ${BYTES};
TS
echo "assets/db/recipes.db <- $SRC ($(du -h "$SRC" | cut -f1)), version $VERSION"
