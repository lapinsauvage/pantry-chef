# Free EN↔FR translator: build instructions

Spec for building Pantry Chef's own free English↔French translator. Written on 13 Nov 2026 by the
session that built M0–M5. The same text, with a drawn architecture diagram, is in the user's Claude Doc
"Pantry Chef — free EN↔FR translator: build instructions".

## How to use this document

Start a new Claude Code session on the repository **lapinsauvage/pantry-chef** and paste the prompt below.

```text
Read docs/TRANSLATOR.md in lapinsauvage/pantry-chef (branch claude/exciting-shannon-2dz7wy),
then CLAUDE.md and docs/SPEC.md. Build the free English<->French translator it describes,
task by task. Everything must stay free: no paid APIs, no API keys, no payment methods.
Stop after each task with a short summary and wait for my OK before the full translation run.
```

The agent should treat this document as the spec. Anything it cannot confirm here (a model name, a
GitHub limit) it checks before relying on it.

## Goal and hard constraints

Build a translator that Pantry Chef owns and runs for free, then use it to give the French app French recipes.

**What it must do**

- Translate the recipe database from English to French: recipe names, steps and ingredient lines (text
  and note). Descriptions stay in English: they add 17.2 M characters and are rarely read.
- Translate any text file on request, French → English or English → French (Markdown or plain text).
- Re-run incrementally. When the recipe data changes, only new or changed texts are translated; finished
  work is never lost.

**Hard constraints (the user's rules)**

- **Free, with no exceptions.** No paid API, no API key, no account that needs a card, and no payment
  method on GitHub. Compute comes only from GitHub Actions free minutes on Linux runners. The only external
  API the user would accept is a permanent free one they could keep using; none qualifies today (DeepL API
  Free and Azure F0 are capped per month, and Azure asks for a card at sign-up), so the translator is
  self-hosted.
- **Self-owned and permanent.** Use open-source Opus-MT models (open licences; keep the attribution from
  each model card in the docs), downloaded from Hugging Face inside the workflow. The code lives in the
  repository and the results live in the repository's own GitHub Release. Nothing can start charging later.
- **Personal use only.** The Food.com data must never be published. Keep the repository private, never
  commit the full database or the full translation memory to git, and never host either publicly. Release
  assets of a private repository are private.
- **No secrets.** The workflows use the built-in `GITHUB_TOKEN`. Never ask the user for a token, password
  or Apple ID in chat.
- **Branch rules.** Work on `claude/exciting-shannon-2dz7wy` and push only there. No pull request unless
  the user asks.

## What is already known

A test already ran on GitHub: workflow **Translation test**, run 43455564707, on the branch above. It
translated the 200 most popular recipes (4,059 texts, 206,151 characters) on a Linux runner with 4 CPU
threads, using CTranslate2 int8 with beam 2, sentence by sentence.

| Model | Time | Characters/s | Whole DB, 1 job | Whole DB, 4 jobs |
|---|---|---|---|---|
| Helsinki-NLP/opus-mt-en-fr | 92 s | 2,252 | 11.7 h | 2.9 h |
| Helsinki-NLP/opus-mt-tc-big-en-fr | 195 s | 1,058 | 25.0 h | 6.2 h |

The whole-DB hours in that report include descriptions (95 M characters). Without descriptions and after
removing duplicates, the volume is smaller:

| Part (106,929 recipes, after metric conversion) | Characters |
|---|---|
| Names | 2.7 M |
| Steps | 54.7 M |
| Ingredient lines ("text, note"), unique | 7.5 M |
| **Total to translate** | **64.9 M** |
| Descriptions (skipped) | 17.2 M |

**Quality findings**

- **opus-mt-en-fr is not good enough.** Examples: "bite-size pieces" → "morceaux de morsure", dressing →
  "pansement", shortening → "raccourcissement", and some nonsense sentences.
- **opus-mt-tc-big-en-fr is clearly better; use it.** It still has recurring errors that a glossary must fix:
  - loaf pan → "miche de pain"; crock pot → "casserole".
  - softened butter → "beurre adouci".
  - Québec terms: crème sure, sucre brun, farine tout usage.
  - Words in capitals stay in English ("ENJOY", "LOW").
  - Short Title Case recipe names are translated poorly.

**Existing files to reuse**

- `.github/workflows/translate-test.yml`: the test workflow. It runs on a push to a branch (with a path
  filter) and on `workflow_dispatch`.
- `data-pipeline/scripts/translation_sample.ts`: exports the N most popular recipes as metric English,
  using `metricizeText` and `parseIngredientTuple` from `src/lib/units.ts`. It runs with Node
  `--experimental-strip-types` and `node:sqlite`.
- `data-pipeline/scripts/translate_sample.py`: the `Model` class (Hugging Face tokenizer and
  `ctranslate2.Translator`, sentence split, longest-first batching by tokens).
- `data-pipeline/pantry_pipeline/translations.py` is a different thing: the French names of canonical
  ingredients (`vocab/ingredients_fr.json`, written to `ingredients.name_fr`). Don't overwrite it. It is
  useful for consistent ingredient words.

**Install steps that worked on `ubuntu-latest`**

```bash
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install ctranslate2 sentencepiece sacremoses "transformers<5"
ct2-transformers-converter --model Helsinki-NLP/opus-mt-tc-big-en-fr \
  --output_dir models/opus-mt-tc-big-en-fr --quantization int8
```

torch is only needed for the conversion. Cache the converted model with `actions/cache`, keyed on the
model id, so later runs skip torch and the download.

## Architecture

Every translation lands in one memory that later runs and app builds reuse.

```text
translate.yml (recipe DB, EN→FR)                     
┌───────────────────────────────────────────┐
│ 1 Export (Node)  export_texts.ts           │
│   unique names, steps, ingredient lines    │
│   as metric English (metricizeText)        │
│              │                             │      ┌──────────────────────────────────────┐
│              ▼                             │      │ Translation memory                   │
│ 2 Prepare  drop texts already in memory ◄──┼──────│ release tag "translations" (private) │
│   max_chars cap, most popular first        │      │ translations-fr.jsonl.gz             │
│   split into N shards                      │      │ key, kind, en, mt, fr, model, qa     │
│              │                             │      └──────────────────────────────────────┘
│              ▼                             │             ▲                 │
│ 3 Shards × N in parallel                   │             │                 ▼
│   opus-mt-tc-big-en-fr, CTranslate2 int8   │             │      build-apps.yml: download memory,
│   glossary + checks, retry with beam 4     │             │      build_db --translations (schema v2)
│   stop near 330 min, keep partial results  │             │                 │
│              │                             │             │                 ▼
│              ▼                             │             │      App (French + metric): French names,
│ 4 Merge  add results, upload --clobber ────┼─────────────┘      lines, steps; toggle to English;
│   summary: counts, failed %, minutes       │                    French timers and search
└───────────────────────────────────────────┘

translate-text.yml (your own texts, FR↔EN, same library and models)
translations/inbox/name.fr.md|name.en.md ──► machine_translation.py ──► translations/outbox/ (committed)
```

The memory is the hub. Every run adds to it, the next run skips what it already holds, and app builds
read it. A run that is cut short keeps everything its shards already saved.

**`translate.yml` step by step**

- **Trigger.** `workflow_dispatch` with the inputs `max_chars` (default: no cap), `shards` (default 4),
  `beam` and `retranslate` (default false). Until the file is on `main`, start it with a push that changes
  a small `translations/request.json` holding the same inputs.
- **prepare.**
  - Build the full DB the way `build-apps.yml` does, caching `data-raw/`, and run `export_texts.ts`.
  - Download the current memory if it exists (`gh release download translations … || true`).
  - Drop texts already translated with the same model and glossary, sort by recipe score, and apply
    `max_chars`.
  - Split the rest into shards with equal numbers of characters and output the shard list for the matrix.
- **translate** (a matrix, one job per shard, `timeout-minutes: 350`).
  - Restore the converted model from `actions/cache`, converting it on a miss.
  - Translate in chunks of about 2,000 texts, appending each chunk to a gzip JSONL.
  - Stop starting new chunks after `--deadline-minutes 330`, and upload the results with `if: always()`
    so a cut job keeps its work.
- **merge** (`if: always()`, `permissions: contents: write`).
  - Add the shard results to the memory and upload it with
    `gh release upload translations translations-fr.jsonl.gz --clobber`.
  - The first time, create the release with `gh release create translations --latest=false`, so the apps
    release stays the latest one.
  - Write the summary.
- **Re-runs.**
  - Running again with the same inputs translates only what is still missing.
  - A change to the glossary's post-replacements is re-applied to the stored `mt`, without the model.
  - A new model, or a change to a pre-replacement, re-translates only with `retranslate: true`. For a
    pre-replacement, only the texts containing the changed term are re-translated.

Both workflows use the same Python module. The model and glossary settings live in that module, not in
the YAML.

## Quality: model, glossary and checks

**Model.** Use `Helsinki-NLP/opus-mt-tc-big-en-fr` as CTranslate2 int8 on CPU. Record the model id and
the glossary version in every memory entry.

**Before the model (English)**

- The source is metric English from `metricizeText(text, 'metric', 'en')`, with decimal points. Cups and
  spoons stay as written (the user's choice); the model turns them into "tasse" and "c. à soupe".
- Translate sentence by sentence (the split regex from the test) and keep each input at or under 500 tokens.
- Names: turn Title Case into sentence case before translating ("Best Ever Banana Bread" → "Best ever
  banana bread"), then capitalise the first letter of the result.
- Words in capitals: lower-case them, except temperature units (°C) and short acronyms. "ENJOY!" →
  "enjoy!", "cook on LOW" → "cook on low".
- Glossary pre-replacements: an English phrase the model gets wrong → an English wording it translates
  well. Check each one on the test set.

**After the model (French)**

- Glossary post-replacements: whole words, keeping capital letters. The starting list is below; check
  every entry against real output and grep the 200-recipe output for more Québec words.

| Model output | Belgian French |
|---|---|
| crème sure | crème aigre |
| farine tout usage | farine |
| sucre brun (clair / foncé) | cassonade (blonde / brune) |
| sucre à glacer | sucre impalpable |
| poudre à pâte | levure chimique |
| beurre adouci | beurre ramolli |
| fromage à la crème | fromage frais |
| papier ciré / papier parchemin | papier sulfurisé |
| poêlon | poêle |
| cuillère à table | cuillère à soupe |
| miche de pain (for "loaf pan") | moule à cake |
| casserole (for "crock pot") | mijoteuse |
| slow-cooker LOW / HIGH | position basse / position haute |

- Turn decimal points between digits into commas ("2.5 cm" → "2,5 cm"). Put a no-break space (` `)
  before `? ! : ;`, as `src/i18n/fr.ts` does.

**Automatic checks on every text**

- The output has the same numbers as the input.
- The length ratio French/English is between 0.5 and 2.5 (texts over 20 characters).
- No loop: no three-word sequence appears four or more times.
- No English left: under 30 % of the words come from a short list of English-only words (the, and, with,
  until, into…).
- If a check fails, retry with beam 4. If it still fails, keep the English text, mark the entry
  `qa: "failed"`, and let the app show English for that text.

**Report on every run (job summary):** texts translated, retried and failed; characters per second; billed
minutes; 30 random examples side by side (English | French).

**Settle in T2:** beam 2 versus greedy (beam 1), and glossary on versus off. Greedy is probably faster
(about 1.5×, not measured); keep it only if the examples don't get worse.

## Database and app integration

**Translation memory: the single source of truth**

- File `translations-fr.jsonl.gz`, one JSON object per unique text: `{key, kind, en, mt, fr, model, glossary, qa}`.
  - `kind` is `name`, `step` or `ingredient`.
  - `key` is the sha1 of `kind + "\n" + raw`. `raw` is the exact string stored in `recipes.db`; for
    ingredients it is `text + "\u0000" + (note ?? "")` from the tuple.
  - `en` is the metric English that was translated, `mt` the raw model output and `fr` the text after
    post-processing. Keeping `mt` lets a change to the post-replacements be re-applied without translating
    again.
- TypeScript (the export) and Python (`build_db`) must compute the same keys. Add one shared fixture of
  strings with their expected sha1, tested in both pytest and node:test.
- Store it as an asset of a GitHub Release with the tag `translations` (private, like the repository).
  Upload it with `gh release upload translations … --clobber`. Never commit it to git.

**Pipeline (`data-pipeline/`)**

- Add an optional `build_db --translations <memory.jsonl.gz>` that fills three new `recipes` columns:
  - `name_fr TEXT`.
  - `steps_fr TEXT`: a JSON array the same length as `steps`, with `null` for each step not translated.
  - `ingredients_fr TEXT`: a JSON array of "text, note" strings, the same length as `ingredients`.
  - All three are NULL when the recipe has no translation at all.
- Add a new contentless FTS table `recipe_fts_fr(name_fr)` with `tokenize='unicode61 remove_diacritics 2'`
  (the English porter stemmer would hurt French).
- Bump `SCHEMA_VERSION` to 2, update `docs/DATA.md`, and add pytest cases for the join (missing keys,
  partly translated recipes, length mismatch).
- `build-apps.yml` downloads the asset (`gh release download translations -p translations-fr.jsonl.gz`)
  before building the full DB. If it is missing, the build goes on in English only.
- The DB grows by the French text (estimate: +70 MB before compression). Measure the APK and IPA sizes and
  the first-launch import time after the change. `RECIPE_DB_BYTES` updates itself.
- Regenerate the committed 2,500-recipe sample DB with French, so the dev app and the tests show it.

**App (`src/`)**

- `getRecipe` and the card queries return `name_fr`, `steps_fr` and `ingredients_fr` (null when missing).
  All SQL stays in `src/db/recipes.ts`, with cases in `queries.test.ts`.
- Show French when the language is French, the units are metric and a translation exists. Otherwise show
  English as today: the French text has metric built in, so French with US units shows English.
- Recipe screen:
  - Show the French name and the French ingredient lines. The quantity still comes from
    `formatIngredient` (scaled); the text and note come from `ingredients_fr`.
  - Show the French steps without `metricizeText`, because they are already metric.
  - Add a small "Traduction automatique" label and a toggle "Voir l'original (anglais)" / "Voir la
    traduction".
  - Hide the `canonical_fr` hint on lines that are translated.
- Recipe cards (Cook, Browse, Favourites) show `name_fr`.
- Cooking mode `cook/[id]` shows the French steps, with the same toggle.
- `detectTimers` learns French durations, with unit tests in `src/lib/__tests__/timers.test.ts`:
  - Units: heure(s), h, minute(s), min, seconde(s).
  - Phrases: "une heure", "une demi-heure", "un quart d'heure", "1 h 30", "1 heure et demie".
  - Ranges: "10 à 15 minutes", "10-15 min".
  - Number words from un/une to soixante.
- Search: French words also match `recipe_fts_fr`, on top of the existing French→English ingredient
  mapping. Queries go through `ftsQuery()` with bound parameters.
- Descriptions stay in English. Every new string goes in both `src/i18n/en.ts` and `src/i18n/fr.ts`.

## French → English, and any text file

The same library also serves as a general translator for the user's own texts, in both directions.

**Models**

- EN→FR: `Helsinki-NLP/opus-mt-tc-big-en-fr`, the same as the recipes.
- FR→EN: `Helsinki-NLP/opus-mt-tc-big-fr-en`. Check on Hugging Face that it exists and converts; the
  fallback is `Helsinki-NLP/opus-mt-fr-en`. The glossary is EN→FR only; FR→EN gets the checks without
  replacements.

**How the user runs it (two ways, both free)**

1. **Text file.** In the GitHub app or website, the user adds a file to `translations/inbox/` on the branch:
   - `<name>.fr.md` or `<name>.fr.txt` is translated to English.
   - `<name>.en.md` or `<name>.en.txt` is translated to French.
   - A workflow triggered by the push writes `translations/outbox/<name>.<target>.md`, commits it to the
     same branch (`permissions: contents: write`) and shows it in the job summary. These are the user's
     own texts, so committing them is fine.
2. **Paste text.** Once the workflow is on `main`, "Run workflow" takes inputs `direction` (fr-en / en-fr)
   and `text`, and prints the result in the job summary. `workflow_dispatch` inputs are limited in size;
   for long texts use a file.

**Keep the Markdown intact**

- Translate line by line and keep the structure: heading `#`, list markers and numbers, blockquote `>`,
  table pipes.
- Never translate code blocks, inline code, URLs or e-mail addresses. Put a placeholder in their place and
  restore them afterwards.
- Split long lines into sentences, as for the recipes.
- Cache the converted models (`actions/cache`). A run should take about 2–5 minutes, most of it starting up.

This is the user's permanent free translator: no key, no quota other than the free Actions minutes, and it
keeps working as long as the repository exists.

## Budget: GitHub free minutes

- The repository is private, so it gets **2,000 Actions minutes per month** for free. Linux minutes count
  1× and macOS minutes count 10×.
- The counter resets on the 1st of each month at 00:00 UTC (01:00 in Brussels in winter). The user can see
  usage on GitHub under **Settings → Billing and licensing → Usage**.
- With no payment method on file, nothing is ever charged. GitHub's docs say: *"If your account does not
  have a valid payment method on file, usage is blocked once you consume the included compute usage."*
  Never add a payment method and never raise a spending limit.
- Release assets don't count against the Actions storage quota. Artifacts do: keep them small (gzip) with
  `retention-days: 3`.

**What things cost (estimates)**

| Job | Billed minutes |
|---|---|
| T2 re-test on 200 recipes | about 15 |
| Generic text translation, one file | about 2–5 |
| Full recipe DB, greedy (if T2 keeps it) | about 640 |
| Full recipe DB, beam 2 (the tested setting) | about 1,020 |
| One app build, iOS (15 min × 10) | about 150 |
| One app build, Android | about 20 |

Splitting into parallel shards makes it finish sooner but doesn't change the total billed minutes.

**Rules for the agent**

- Before the full run, ask the user how many minutes are left this month. About 1,700 were left in
  mid-November 2026 (an estimate). Plan the full run for when at least 1,100 are free, for example right
  after the 1st.
- The workflow takes a `max_chars` input and translates recipes in order of popularity (`score DESC`). A
  run can therefore stop at the cap and finish next month; untranslated recipes simply show in English.
- Every run prints its billed minutes (the sum of shard durations, rounded up per job) in the summary.

## Tasks, in order

Commit and push after each task, give the user a short summary, and wait for their OK before T4's full
run and before T7's builds.

**T1 — Translation library (no model in CI)**

- Create `data-pipeline/pantry_pipeline/machine_translation.py`. The name avoids the existing
  `translations.py`. It holds:
  - sentence splitting and pre/post-processing;
  - the glossary `pantry_pipeline/vocab/glossary_fr.json`, which has a `version`;
  - the quality checks;
  - the key function;
  - reading, merging and writing the memory (gzip JSONL).
- The translator is passed in (a small protocol), so pytest uses a fake one. Import CTranslate2 and
  transformers lazily, and list them in `data-pipeline/requirements-translate.txt`, not in CI's
  requirements.
- Add `data-pipeline/scripts/export_texts.ts`, based on `translation_sample.ts`. It writes unique texts as
  JSONL `{key, kind, en, score}`, with `score` the best score of the recipes that use the text.
- Add the shared key fixture, tested in pytest and node:test.

**T2 — Re-test and choose settings (about 15 min)**

- Point `translate-test.yml` at the library and drop the base model. Compare beam 2 with greedy, and
  glossary on with off, on the same 200 recipes.
- Show the user the speeds and about 10 examples side by side, and fix the settings with them.

**T3 — Text translator, FR↔EN**

- Add the `translate-text.yml` workflow. It runs on a push to `translations/inbox/**` and from
  `workflow_dispatch`, and keeps Markdown intact.
- Try it on one French and one English file and show the user the results.

**T4 — Translate the recipe DB (production run)**

- Add the `translate.yml` workflow (see Architecture). Build the full DB the same way `build-apps.yml`
  does, caching `data-raw/`.
- Run a smoke test first with `max_chars` about 1 M (around 1,000 recipes). Check the results and the
  failed rate.
- Do the full run only after the user's OK and a check of the minutes left.
- Done when the asset is on the `translations` release and the summary shows the counts, the failed % and
  the minutes.

**T5 — Pipeline and schema**

- Implement the pipeline part of "Database and app integration": `build_db --translations`, schema version
  2, `recipe_fts_fr`, the download in `build-apps.yml`, `docs/DATA.md`, and pytest.
- Regenerate the sample DB with French. This container may not be able to download private release
  assets. If not, have T4's merge job also commit `data-pipeline/fixtures/translations-sample.jsonl.gz`:
  only the 2,500 recipes already in the committed sample DB, so nothing new is exposed. Then pull it.

**T6 — The app in French**

- Implement the app part: French names, lines and steps, the toggle and label, French timers, French
  search, the i18n strings, and tests (`timers.test.ts`, `queries.test.ts`).

**T7 — Build and phone test**

- Run **Build apps** (about 170 minutes). The user installs the APK, and the IPA through Sideloadly with
  their own Apple ID, which they type there themselves.
- Add French checks to the checklist in `docs/BUILD.md`:
  - a recipe shows in French;
  - the toggle switches to English and back;
  - timers work in cooking mode with French steps;
  - searching "poulet" finds French names;
  - US units show English.

**Definition of done, every task (from `CLAUDE.md`)**

- `npm run typecheck && npm run lint && npm test` pass.
- `cd data-pipeline && python -m pytest -q tests` passes.
- CI is green.
- New pure logic has unit tests.
- The docs are updated: `CLAUDE.md` status and map, `docs/SPEC.md`, `docs/DATA.md`, `docs/BUILD.md`, and
  this file.

## Facts and gotchas

**Network and container**

- The Claude Code cloud container can't reach huggingface.co, img.sndimg.com or docs.expo.dev. Firecrawl
  can read the Expo docs. All model work runs on GitHub runners; read results from the job summary or with
  `get_job_logs`.
- `workflow_dispatch` (the "Run workflow" button) only works once the workflow file is on the default
  branch, `main`. Until the user merges it, start runs with a push to the branch and a path filter, as
  `translate-test.yml` does. Never push to `main` yourself.

**Data**

- The full DB can be built locally with `npm run data:fetch && npm run db:full` → `build/recipes.db`
  (223 MB, gitignored).
- Never commit the full DB, `data-raw/`, `build/`, `models/` or the full translation memory. GitHub's file
  limit is 100 MB.

**Code**

- `src/db/recipes.ts` keeps relative `.ts` imports and only type-imports expo-sqlite, so Node tests can run
  its real SQL.
- Node scripts run with `node --experimental-strip-types` and import with the `.ts` extension.
- `tests/test_constants_sync.py` keeps `src/lib/constants.ts` in sync with the pipeline.
- FTS5 needs an explicit `AND` before a bracketed group; always use `ftsQuery()`.
- After adding routes, run `npm run typecheck` both with and without `.expo/types` (CI has none).
- Expo SDK 58 changes a lot: read the versioned Expo docs before touching an Expo API (see `AGENTS.md`).
- Use the same action versions as the existing workflows (`actions/checkout@v7`, `setup-node@v7`,
  `setup-python@v7`, `upload-artifact@v7`).

**Translation tools**

- Keep `transformers<5`; that is the version that worked in the test.
- Inputs are capped at 500 tokens, with `max_decoding_length=512`.
- The test's sentence split was `(?<=[.!?])\s+(?=[A-Z0-9(])`.
- The runner reported 4 CPU threads. Set `intra_threads` from `os.cpu_count()`.

**Never**

- Add a payment method, create an API key, or ask for a secret in chat.
- Publish the database or the memory, or make the repository public.
- Push to any branch other than `claude/exciting-shannon-2dz7wy`, or open a pull request unless asked.
