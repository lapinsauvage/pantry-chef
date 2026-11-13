# Pantry Chef 🍳

A personal, offline cooking app for iPhone and Android:

- **What can I cook?** Pick the ingredients you have, how much time you have and which
  appliances you own (oven, microwave, slow cooker…) → recipes ranked by fewest missing
  ingredients.
- **Browse & search** ~107,000 well-rated recipes by category, cuisine, diet and time.
- **Recipe view** in metric (g, ml, °C) or US units, servings scaling, shopping list,
  favourites and a step-by-step cooking mode.
- English and French interface. Works without internet (except recipe photos).

> Status: M3 done — "What can I cook?" (pick ingredients → ranked recipes), the recipe screen
> (metric quantities, servings, what you're missing) and Browse (search as you type in English or
> French, collections, courses, cuisines, filters, sorting), on top of M1 (tabs, English/French,
> onboarding, settings). Next: favourites, shopping list and cooking mode — see `docs/SPEC.md`.

## Get the app on your phone
GitHub → **Actions** → **Build apps** → **Run workflow**, then download from **Releases**:
the `.apk` for Android, the `-unsigned.ipa` for iPhone (install with Sideloadly/AltStore).
Step-by-step: [`docs/BUILD.md`](docs/BUILD.md).

## Continue building with Claude Code
Open this repo in Claude Code and say, for example:

> Read CLAUDE.md and docs/SPEC.md, then implement milestone M1. Stop after M1 with a short summary.

Then M2, M3… one milestone per session works best.

## Repository
| Path | What |
|---|---|
| `src/` | Expo / React Native app (TypeScript, Expo Router) |
| `assets/db/recipes.db` | 2,500-recipe sample database for development |
| `data-pipeline/` | Python pipeline that builds the full recipe database from Food.com datasets |
| `.github/workflows/` | CI checks and the APK/IPA build |
| `docs/` | product spec, data reference, build & install guide |

## Data & licence
Recipes, text and photos come from Food.com (via public research datasets) and belong to
their authors. This project is for **personal, non-commercial use** with family and friends;
don't publish the app or the database. Each recipe links back to its Food.com page.
