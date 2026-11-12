# Pantry Chef — product spec

An offline cooking app for personal use (Mich, family and friends): tell it what
you have, how much time you have and which appliances you own, and it shows what
you can cook. You can also browse and search ~107,000 rated recipes.

- **Platforms:** iPhone (unsigned .ipa, sideloaded) and Android (.apk), one Expo / React Native codebase.
- **Languages:** app UI in **English and French** (Belgian French wording where it differs:
  *taque*, *sucre impalpable*, *cassonade*, *poudre à lever*). Recipe text stays English;
  ingredient names have a French hint.
- **Units:** metric by default (g, ml, °C, cm), US units as a setting. Spoons stay spoons.
- **Offline-first:** all recipe data ships inside the app (SQLite). Only photos load from
  the internet (cached). No account, no server, nothing to pay.

## Users and the core job

"It's 18:30, I have chicken, rice, a pepper and some cheddar, 30 minutes and an oven.
What can I make?" — answer in two taps, ranked by *fewest missing ingredients*, then
*uses most of what I picked*, then popularity.

## Navigation

Expo Router, tabs + stacks (routes in `src/app/`):

| Route | Screen |
|---|---|
| `(tabs)/index` | **Cook** — "What can I cook?" |
| `(tabs)/browse` | **Browse** — categories, collections, search |
| `(tabs)/favorites` | **Favourites** + recently viewed |
| `(tabs)/shopping` | **Shopping list** |
| `recipe/[id]` | Recipe detail |
| `cook/[id]` | Cooking mode (step by step) |
| `settings` | Settings (gear icon in headers) |
| `onboarding` | First-run setup (shown until `settings.onboarded = 1`) |

## Features

### 1. Onboarding (first launch, ~4 short steps, skippable)
1. Language: system default / English / Français.
2. Appliances I have — checkboxes from `EQUIPMENT` (default: oven, stovetop, microwave).
3. Basics I always have — `DEFAULT_BASICS` pre-checked, editable (salt, pepper, water are always assumed).
4. Optional: diet (`DIETS`) and things to avoid (`AVOID`: allergens, pork, alcohol…).
While the user does this, the recipe database is being imported (first launch copies the
bundled ~220 MB database; show a progress/"preparing recipes" state, never a frozen screen).

### 2. Cook tab — "What can I cook?"
- **Ingredient picker:** search box (type-ahead in EN and FR, accent-insensitive —
  `searchIngredients`), below it a grid of popular ingredients grouped by
  `INGREDIENT_CATEGORIES` (`popularIngredients`). Picked items show as removable chips and
  are saved to `user.db pantry` (they persist: "my fridge").
- **Time:** presets 15 / 30 / 45 / 60 / 90 min / any (`TIME_PRESETS`).
- **Missing allowed:** 0 ("cook right now"), 1, 2, 3 — default 1.
- **Appliances / diet / avoid:** taken from settings, overridable in a filter sheet.
- **Course:** default meals (`MEAL_COURSES`), chips to switch to desserts, baking, snacks, drinks.
- **Results** (`findByPantry`): card with photo, name, time, rating, difficulty, a badge
  "✓ ready" or "missing 1: soy sauce", and "uses 3 of your ingredients". Infinite scroll
  (limit/offset). Debounce queries ~300 ms after changes.
- Empty state suggests: allow 1 more missing ingredient, raise the time, or add basics.

### 3. Browse tab
- Search bar (FTS5 via `search`), searching recipe names, ingredients and keywords.
- Course grid (`COURSES`), cuisine list (`CUISINES`), quick collections:
  *Under 15 min*, *Vegetarian*, *One pot* (`chips` contains `one_pot`), *Kid friendly*,
  *Budget*, *Slow cooker*, *No oven* (equipment without oven), *Desserts*.
- Filter sheet shared with Cook tab (`RecipeFilters`): time, appliances, diet, avoid,
  difficulty, cuisine, "with photo only". Sort: popular / quickest / best rated.

### 4. Recipe screen
- Photo (expo-image, disk cache, placeholder per course when `image` is null), name,
  ★ rating (reviews), total/prep/cook time, difficulty, appliance icons, diet badges, chips.
- **Servings stepper** → scales quantities (`scaleFactor`, `formatIngredient`).
- **Ingredients:** formatted with `formatIngredient` in the chosen unit system; in French UI
  show the French ingredient name (`canonical_fr`) as a small hint under the English line.
  Mark lines the user has (pantry ∪ basics) with ✓; tap to check off while cooking.
- **Steps:** numbered, text passed through `metricizeText` (°F→°C, inches→cm).
- Nutrition per serving (kcal, protein, carbs, fat) — "estimate" label.
- Buttons: ♥ favourite · "Add missing to shopping list" (`missingIngredients`) · "Start cooking".
- Footer: "Recipe from Food.com by its author" + link (`sourceUrl`) — always shown.

### 5. Cooking mode
One step per screen, large type, swipe/next buttons, screen kept awake (`expo-keep-awake`),
ingredient list in a bottom sheet. Detect durations in a step ("bake 25 minutes",
"simmer 1 hour") and offer a tap-to-start timer (in-app countdown; notification when the
app is in background is a later improvement).

### 6. Favourites & history
Saved recipes (user.db `favorites`) and the last 50 viewed (`history`).

### 7. Shopping list
Items from "add missing" (linked to the recipe) and free-text items. Grouped by ingredient
category, check off, clear checked, share as plain text (React Native `Share`).

### 8. Settings
Language, units (metric/US), appliances, basics, diet, avoid, data info (`dataInfo`: number
of recipes, data version, build date), about + attribution ("Recipes and photos from
Food.com, for personal use"), reset app data.

## Out of scope for v1
Accounts/sync, publishing to the App Store / Play Store (data is personal-use only),
user-written recipes, AI-generated recipes, nutrition tracking.

## Ideas for later
Weekly meal planner · "use it up first" (mark pantry items as expiring) · barcode scan to add
pantry items (expo-camera + Open Food Facts) · import a recipe from a URL · translated recipe
text (FR) for favourites · home-screen widget · voice "next step" in cooking mode ·
Belgian/French recipe pack from a licensed source.

## Quality bars
- Cold start to usable UI < 3 s after the first import; first import < 30 s with visible progress.
- Pantry query < 500 ms on a mid-range phone; never block typing.
- Lists virtualized (FlatList or FlashList), images cached, 60 fps scrolling.
- Every string in `src/i18n/en.ts` and `src/i18n/fr.ts`; no hard-coded UI text.
- Works in light and dark mode; touch targets ≥ 44 pt; supports large text.

## Milestones (each ends with typecheck + lint + tests green and a short demo note)

| | Scope | Done when |
|---|---|---|
| **M0** ✅ | Data pipeline, sample + full DB, query layer (`src/db/recipes.ts`), units/temperatures (`src/lib/units.ts`), user DB, CI, build workflows | this repo |
| **M1** | Tabs + stacks, i18n (EN/FR, follows system, override in settings), settings store on `user.db`, onboarding, theme | App opens to Cook tab in the right language; onboarding saves appliances/basics |
| **M2** | Cook tab (picker + results) and Recipe screen (scaling, units, missing list, favourite) | Picking 5 ingredients shows ranked results in < 0.5 s; recipe shows metric quantities |
| **M3** | Browse: search, categories, collections, filter sheet, sort | FTS search returns results while typing; filters combine correctly |
| **M4** | Favourites, history, shopping list, cooking mode with timers + keep-awake | Missing ingredients go to the list in one tap; cooking mode stays awake |
| **M5** | Polish: icon/splash, empty/error states, first-launch import progress, perf pass, run "Build apps" workflow and install on both phones | APK installs on Android; IPA sideloads on iPhone and runs offline |
