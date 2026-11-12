@AGENTS.md

# Pantry Chef — instructions for Claude Code

Offline cooking app (Expo SDK 58, React Native, Expo Router, TypeScript) for personal use:
pick the ingredients you have, your time and your appliances → see what you can cook;
browse/search ~107k Food.com recipes. UI in English + French (Belgian usage), metric units.

**Read before coding:** `docs/SPEC.md` (features, screens, milestones — work milestone by
milestone), `docs/DATA.md` (database schema and codes), `docs/BUILD.md` (builds, sideloading).

## Status
- **M0 done:** data pipeline + tests, sample DB in `assets/db/recipes.db`, DB import in
  `src/app/_layout.tsx`, query layer `src/db/recipes.ts`, user DB `src/db/user.ts`,
  units/temperatures `src/lib/units.ts`, codes/labels `src/lib/constants.ts`, CI and
  "Build apps" workflow (APK + unsigned IPA).
- `src/app/index.tsx` is a placeholder smoke-test screen. **Next: M1** (navigation, i18n,
  settings, onboarding).

## Map
```
src/app/            routes only (Expo Router)
src/db/recipes.ts   ALL reads of recipes.db (findByPantry, browse, search, getRecipe, searchIngredients…)
src/db/user.ts      user.db: settings, pantry, basics, favourites, history, shopping list
src/db/data-version.ts   rewritten by CI (scripts/use-full-db.sh) — don't edit by hand
src/lib/units.ts    formatIngredient, convertQuantity, metricizeText (°F→°C), scaleFactor
src/lib/constants.ts     EQUIPMENT/DIETS/AVOID bits, COURSES, CUISINES, categories, labels EN/FR
assets/db/recipes.db     2,500-recipe SAMPLE (committed). Full DB is built in CI only.
data-pipeline/      Python: builds recipes.db from the Food.com datasets (+ pytest)
.github/workflows/  ci.yml (checks) · build-apps.yml (DB → APK + unsigned IPA → Release)
```

## Commands
```bash
npm start                      # Expo Go dev server (sample DB)
npm run typecheck && npm run lint && npm test
cd data-pipeline && python -m pytest -q tests
npm run data:fetch && npm run db:sample   # regenerate sample DB (needs ~1 GB download)
```

## Rules
- `recipes.db` is generated and read-only. Need new data/columns? Change `data-pipeline/`,
  add tests, bump `SCHEMA_VERSION`, regenerate the sample DB, update `docs/DATA.md`.
- Keep `src/lib/constants.ts` in sync with the pipeline (`tests/test_constants_sync.py` enforces it).
- All SQL goes through `src/db/recipes.ts` / `src/db/user.ts` with bound parameters — never
  interpolate user input into SQL. FTS input goes through `ftsQuery()`.
- Every user-facing string comes from `src/i18n/en.ts` + `src/i18n/fr.ts` (create in M1).
  French = Belgian usage (taque, sucre impalpable, cassonade, septante/nonante if spelled out).
- Show quantities via `formatIngredient` and step text via `metricizeText`; metric by default.
- Always show the Food.com attribution link on recipe screens (`sourceUrl`). The data is for
  personal use only — never add store-publishing, public hosting or sharing of the database.
- No accounts, backend or analytics. Photos are the only network use (expo-image with cache).
- Expensive queries (`findByPantry`) must not block typing: debounce ~300 ms, show a loader.
- Use virtualized lists; don't load more than ~40 cards per page.
- Never create/edit `ios/` or `android/` by hand (CNG). Native config goes in `app.json`.
- Don't commit the full DB (>100 MB GitHub limit), `data-raw/` or `build/`.

## Definition of done (every task)
typecheck, lint, `npm test` and pipeline pytest pass; CI green; docs updated when behaviour
or schema changes; new pure logic gets unit tests in `src/lib/__tests__/` (node:test,
run with `node --experimental-strip-types`, import with the `.ts` extension).

## Gotchas
- `npx expo install` may fail behind a proxy → use the version from
  `node_modules/expo/bundledNativeModules.json` with `npm install`.
- The iOS app can only be compiled by the GitHub workflow (macOS runner); don't try Xcode locally on Linux.
- First launch of a release build copies the ~220 MB DB — keep the Suspense fallback / progress UI.
- `findByPantry` excludes staples (water, salt, pepper, ice, cooking spray) automatically;
  user "basics" are passed in `basics` and count as owned.
