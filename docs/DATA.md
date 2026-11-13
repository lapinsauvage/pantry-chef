# Recipe data

## Sources

Both datasets are scrapes of **Food.com** and share recipe ids; the pipeline joins them.

| File | Kaggle dataset | What we take from it |
|---|---|---|
| `recipes.parquet` (179 MB, 522,517 recipes) | `irkaal/foodcom-recipes-and-reviews` | name, prep/cook/total time, photo URL, category, keywords, rating, review count, nutrition per serving, servings, instructions |
| `recipes_w_search_terms.csv` (800 MB, 494,963 recipes) | `shuyangli94/foodcom-recipes-with-search-terms-and-tags` | full ingredient lines **with units** ("1 (14 ounce) can diced tomatoes, drained"), clean ingredient names, 600+ tags (course, cuisine, equipment), author description |

`data-pipeline/scripts/fetch_sources.sh` downloads them from Kaggle when a `KAGGLE_API_TOKEN`
is available, otherwise from byte-identical public copies on GitHub (verified by sha256).

**Licence / use:** the recipes, text and photos belong to their authors on Food.com. The
datasets are research scrapes. This app is for **personal, non-commercial use** (family and
friends) and must not be published in an app store or on a public website. Every recipe
screen links back to its Food.com page. To publish publicly one day, switch to licensed
data (e.g. TheMealDB with a supporter key, or a paid API such as Spoonacular).

## Selection (default build)

- in both files, ≥ 3 reviews, rating ≥ 4.0, total time 1 min–48 h, has steps and ≥ 2 ingredients
- result: **106,929 recipes**, **7,771 normalised ingredients** (476 with French names,
  covering 91 % of all ingredient uses), **223 MB** SQLite (65 MB gzipped)
- 77,785 have a photo; 45,122 take ≤ 30 min; 60,918 vegetarian; 15,776 vegan
- by course: main 28,994 · dessert 19,508 · side 10,823 · snack 8,304 · baking 7,297 ·
  soup 6,597 · salad 6,498 · sauce 5,132 · breakfast 4,711 · drink 4,085 · other 4,980
- appliances: oven 50,616 · stovetop 49,392 · blender 9,622 · grill 4,957 · microwave 4,526 ·
  slow cooker 4,211 · pressure cooker 216 · air fryer 1 (the data ends in 2018)

Smaller app: `--min-reviews 5` ≈ 63k recipes (~130 MB). Dev sample: `--max-recipes 2500`
(5.6 MB, committed as `assets/db/recipes.db` so Expo Go starts instantly).

## Pipeline (`data-pipeline/pantry_pipeline/`)

| Module | Job |
|---|---|
| `build_db.py` | join, select, write SQLite + FTS5 index, `meta` table |
| `ingredients.py` | `canonicalize()` raw names → pantry names ("boneless skinless chicken breasts" → "chicken breast", "salt and pepper" → salt + black pepper); `avoid_mask()` allergen/diet flags; `category()` grocery aisle |
| `quantities.py` | parse "1 -2 clove garlic, minced" → qty range, unit, text, note; ISO-8601 durations |
| `classify.py` | appliances (tags + keywords + step text, e.g. "preheat oven", "dutch oven" ≠ oven), course, cuisine, diet bits, difficulty |
| `vocab/ingredients_fr.json` | French ingredient names (Belgian usage) |

Run tests: `cd data-pipeline && python -m pytest -q tests` (also checks that
`src/lib/constants.ts` uses the same codes and bit values).

Rebuild locally:
```bash
bash data-pipeline/scripts/fetch_sources.sh data-raw   # ~1 GB download
npm run db:full      # -> build/recipes.db (~90 s)
npm run db:sample    # -> assets/db/recipes.db (2,500 recipes for development)
```

## Schema (`assets/db/recipes.db`, read-only in the app)

### `recipes`
| column | type | notes |
|---|---|---|
| id | INTEGER PK | Food.com recipe id |
| name, slug | TEXT | `sourceUrl(slug, id)` → food.com link |
| description | TEXT? | author's intro, ≤ 280 chars |
| total_min, prep_min, cook_min | INTEGER | minutes; total includes waiting/chilling |
| servings | INTEGER? | base for scaling; `yield` TEXT? e.g. "1 9x13 pan" |
| rating, reviews, score | REAL, INTEGER, REAL | `score` = Bayesian rating + popularity, default sort |
| image | TEXT? | path after `IMAGE_PREFIX`, or `!<full url>`; use `imageUrl()` |
| course | TEXT | one of `COURSES` |
| cuisine | TEXT | one of `CUISINES` (`other` = untagged, 59 % of recipes) |
| equipment | INTEGER | bitmask of needed `EQUIPMENT`; show if `(equipment & ~userHas) = 0` |
| diet | INTEGER | bitmask of `DIETS` (computed from ingredients + nutrition) |
| avoid | INTEGER | bitmask of `AVOID` the recipe contains |
| difficulty | INTEGER | 1 easy · 2 medium · 3 challenging |
| kcal, protein, carbs, fat | REAL? | per serving (estimates) |
| n_ing, n_core | INTEGER | ingredient lines; distinct non-staple ingredients (for matching) |
| chips | TEXT JSON | short labels (`CHIPS` keys) |
| steps | TEXT JSON | `string[]` |
| ingredients | TEXT JSON | `IngredientTuple[]` = `[qmin, qmax, unit, pkgQty, pkgUnit, text, note, ingredientId]`, trailing nulls omitted. Units: cup, tbsp, tsp, floz, oz, lb, pint, quart, gallon, ml, l, g, kg, inch, pinch, dash, clove, can, package, jar, bottle, box, stick, slice, piece, bunch, head, sprig, stalk, drop, handful, container, bag, loaf, fillet, whole |

### `ingredients`
`id`, `name` (canonical EN), `name_fr`, `recipes` (usage count), `category`
(`INGREDIENT_CATEGORIES`), `avoid` (bitmask), `staple` (1 = water/salt/pepper/ice/cooking
spray, never "missing"), `search` (accent-free "name name_fr" for type-ahead).

### `recipe_ingredients` (WITHOUT ROWID, PK `(ingredient_id, recipe_id)`)
One row per distinct non-staple ingredient per recipe. Drives "what can I cook".

### `recipe_fts` (FTS5, contentless, rowid = recipe id)
Columns `name`, `ingredients` (canonical names), `tags` (keywords + course + cuisine).
Tokenizer `porter unicode61 remove_diacritics 2`. Rank with `bm25(recipe_fts, 10, 2, 1)`.

### `meta`
`schema_version`, `built_at`, `recipes`, `ingredients`, `image_prefix`, `min_reviews`,
`min_rating`, `source`.

## User data (`user.db`, created by `src/db/user.ts`)
`settings(key, value)`, `pantry(ingredient_id, name, added_at)`, `basics(ingredient_id, name)`,
`favorites(recipe_id, added_at)`, `history(recipe_id, viewed_at)`,
`shopping_items(id, text, ingredient_id, recipe_id, checked, created_at)`.
Ingredient **names** are stored next to ids: when a new recipe database is imported, pantry and
basics are re-linked by name (`remapIngredientIds` in `src/db/recipe-db.ts`); names that no
longer exist are dropped.

`settings` keys (typed access: `src/lib/settings.ts` + `src/state/settings.ts`):
`language` (`system`|`en`|`fr`), `units` (`metric`|`us`), `equipment` / `diet` / `avoid`
(bitmasks as decimal text), `onboarded` (`1`), `recipe_db_name` (recipe DB file whose import
completed — an interrupted copy is redone), `basics_seeded` (`1` once `DEFAULT_BASICS` were added).
Missing or invalid values fall back to the defaults (metric, oven + stovetop + microwave).

`history` keeps the last 50 opened recipes (`recordView`). "Add missing to shopping list" inserts
one `shopping_items` row per missing ingredient (text in the UI language, `ingredient_id`,
`recipe_id`) and skips ingredients already on the list unchecked. Typed items get an
`ingredient_id` when their text exactly names an ingredient (EN or FR, `matchIngredient`), else
it stays null and the item is listed under "Other".

## Known limitations
- Photos are loaded from Food.com's image CDN; some may disappear over time → show the course placeholder.
- Diet/allergen flags are keyword heuristics on ingredient names — label them "estimated", not medical advice.
- Some Food.com ingredient lists miss items mentioned only in the steps (e.g. "ginger").
- Cuisine is unknown for 59 % of recipes (Food.com never tagged them).
- Nutrition values are Food.com's per-serving estimates.
