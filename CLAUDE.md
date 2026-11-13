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
- **M1 done:** native tabs (each with a header stack + settings button), onboarding behind a
  `Stack.Protected` guard, EN/FR i18n (`src/i18n/`), settings store on `user.db`
  (`src/state/`), light/dark theme (`src/theme/`), Settings screens, background recipe-DB import.
  Browse/Favourites/Shopping tabs are placeholders.
- **M2 done:** Cook tab (picked ingredients → `pantry`, time / missing allowed / course chips,
  filter sheet `/filters` overriding Settings, debounced paged `findByPantry` results with
  "missing: …" names), ingredient picker `/pantry`, Recipe screen `recipe/[id]` (servings scaling,
  metric/US, ✓ owned lines, missing → shopping list, steps via `metricizeText`, nutrition,
  favourite, Food.com link, history). "Start cooking" (M4) not added yet.
- **M3 done:** Browse tab: search as you type (FTS; French ingredient words also match their
  English names: "poulet riz" → chicken rice), collections / courses / cuisines → `browse/list`,
  sort (best match / popular / quickest / best rated), filter sheet `/filters?scope=browse`
  (time, difficulty, cuisine, photo only, appliances, diet, avoid; AND-combined with the preset
  by `browseFilters`).
- **M4 done:** Favourites tab (saved ♥ / last 50 viewed), Shopping list tab (typed items matched
  to ingredients EN/FR → aisle groups, tick, clear ticked, share as text, tab badge = items to
  buy; "Add missing" from recipes), Cooking mode `cook/[id]` (full-screen, one step per page,
  `useKeepAwake`, timers from `detectTimers`, ingredients sheet). Background timer notifications
  are not done. **Next: M5** (polish, icon/splash, perf pass, build + install on both phones).

## Map
```
src/app/            routes only (Expo Router): _layout (guard), onboarding, settings/*, (tabs)/<tab>/{_layout,index},
                    recipe/[id], cook/[id] (cooking mode), pantry (picker modal), filters (filter modal;
                    ?scope=browse), browse/list
src/components/     ui.tsx (Text, Button, Section, rows, Chip), kitchen.tsx (editors shared by
                    onboarding + settings), navigation.tsx (TabStack, header options), states.tsx, icon.tsx,
                    recipe-card.tsx (RecipeRow list item, RecipePhoto with course placeholder),
                    recipe-results.tsx (Browse results: sort chips, filters badge, paging)
src/hooks/          use-ingredient-names.ts (French names for pantry/basics), use-paged-query.ts
                    (debounced first page, infinite scroll, stale responses dropped — Cook + Browse)
src/i18n/           en.ts + fr.ts (typed dictionaries) · index.tsx (useI18n → { t, lang })
src/state/          settings.ts (useSettings/updateSettings), basics.ts, pantry.ts, favorites.ts (+ history),
                    shopping.ts, cook.ts /
                    browse.ts (tab options, in memory), reset.ts — small stores over user.db
src/theme/          palette (light/dark), useColors, spacing, typography
src/db/recipe-db.ts first-launch import of recipes.db; useRecipeDb() suspends until ready
src/db/recipes.ts   ALL reads of recipes.db (findByPantry, browse, search, getRecipe, searchIngredients…)
src/db/user.ts      user.db: settings, pantry, basics, favourites, history, shopping list
src/db/data-version.ts   rewritten by CI (scripts/use-full-db.sh) — don't edit by hand
src/lib/units.ts    formatIngredient, convertQuantity, metricizeText (°F→°C), scaleFactor
src/lib/constants.ts     EQUIPMENT/DIETS/AVOID bits, COURSES, CUISINES, categories, labels EN/FR
src/lib/settings.ts      Settings type, defaults, parse/serialize, resolveLanguage (pure, tested)
src/lib/cook.ts          course groups, cookFilters, queryKey, missingIds, lineStatus (pure, tested)
src/lib/browse.ts        COLLECTIONS, presetFor, browseFilters (preset ∧ sheet ∧ Settings), sorts (pure, tested)
src/lib/format.ts        formatNumber / formatDate / formatMinutes / formatDuration (EN/FR)
src/lib/timers.ts        detectTimers (durations in a step), formatCountdown (pure, tested)
src/lib/shopping.ts      groupShopping (aisle order), shoppingText (share) (pure, tested)
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
- Every user-facing string comes from `src/i18n/en.ts` + `src/i18n/fr.ts` (`const { t, lang } = useI18n()`;
  value-dependent strings are functions; flag/course labels use `x.label[lang]` from constants).
  French = Belgian usage (taque, sucre impalpable, cassonade, septante/nonante if spelled out).
- Show quantities via `formatIngredient` and step text via `metricizeText(text, units, lang)`; metric
  by default. In free text (steps, notes) cups and spoons stay as written — the user's choice.
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
run with `node --experimental-strip-types`, import with the `.ts` extension). New or changed
queries get a case in `src/lib/__tests__/queries.test.ts`, which runs the real SQL of
`src/db/recipes.ts` against the sample DB through Node's built-in `node:sqlite` — so
`recipes.ts` keeps relative `.ts` imports (no `@/` alias) and only type-imports expo-sqlite.

## Gotchas
- `npx expo install` may fail behind a proxy → use the version from
  `node_modules/expo/bundledNativeModules.json` with `npm install`.
- The iOS app can only be compiled by the GitHub workflow (macOS runner); don't try Xcode locally on Linux.
- First launch of a release build copies the ~220 MB DB in the background (`recipeDb()` starts in
  the root layout). Components that need recipes call `useRecipeDb()` inside
  `<Suspense fallback={<PreparingRecipes />}>` — never block the whole app on it.
- Expo SDK 58: JS tabs moved to `expo-router/js-tabs`; we use `expo-router/native-tabs` (no header —
  hence a `Stack` per tab via `TabStack`). RN 0.88 `ScrollView` refs are `ScrollViewInstance`.
- Keyboard: Android is edge-to-edge, so use `KeyboardAvoidingView behavior="padding"` on both platforms.
- The app isn't meant for web: expo-sqlite's web build can't do the synchronous `user.db` open at startup.
- `findByPantry` excludes staples (water, salt, pepper, ice, cooking spray) automatically;
  user "basics" are passed in `basics` and count as owned. Measured ~110 ms for 5 picked
  ingredients on the full 107k DB on a dev machine (budget 500 ms on a phone); a "candidates
  first" rewrite was tried and was slower — re-measure before changing it.
- `recipe_ingredients` has no index by recipe: to know which ingredients a recipe misses, read
  `recipes.ingredients` (`recipeIngredientIds`) + `missingIds()`; don't query it by `recipe_id`.
- Build the full DB locally for benchmarks: `npm run data:fetch && npm run db:full` → `build/recipes.db`.
- FTS5 has no implicit AND before a bracketed group: `ftsQuery` joins terms with explicit `AND`.
- Typed routes (`.expo/types/router.d.ts`) only exist after `npx expo start` ran once; CI typechecks
  without them, so run `npm run typecheck` both ways after adding routes.
