# Building and installing

## Develop (fast loop)

```bash
npm ci
npm start            # scan the QR code with Expo Go (iPhone or Android)
```
Expo Go includes `expo-sqlite`, so the app runs with the **2,500-recipe sample database**
committed in `assets/db/recipes.db`. Checks before every commit:
```bash
npm run typecheck && npm run lint && npm test
(cd data-pipeline && python -m pytest -q tests)
```
If `npx expo install <pkg>` fails behind a proxy, install the version listed for that
package in `node_modules/expo/bundledNativeModules.json` with `npm install <pkg>@<version>`.

## Build the real apps (GitHub Actions — no Mac needed)

1. On github.com open the repo → **Actions** → **Build apps** → **Run workflow**
   (platforms: both / android / ios; keep min reviews = 3 unless you want a smaller app).
2. Wait ~20 min (Android) / ~30–40 min (iOS). The workflow:
   - builds the full recipe database on Linux (cached until the pipeline changes),
   - Android: `expo prebuild` + `gradlew assembleRelease` → **PantryChef-<version>.apk**
     (signed with the standard debug key, so new builds install over old ones),
   - iOS: `expo prebuild` + `xcodebuild archive` without code signing → **PantryChef-<version>-unsigned.ipa**,
   - publishes both on the **Releases** page (tag `latest`; pushing a tag `v1.0.0` makes a versioned release).

### Quick tryout with French recipes (database = sample)
**Run workflow** with *platforms* `android` and *database* `sample`: the APK uses the committed
2,500 most popular recipes, whose names, ingredient lines and steps are machine-translated to
French (`.github/workflows/translate.yml`, see docs/TRANSLATOR.md). About 20 Linux minutes, a
~35 MB APK, published under the separate pre-release **tryout** — the `latest` full builds stay.
Installing it over the full app keeps your settings and lists; favourites that aren't among the
2,500 stay hidden until the full app is installed again.

### Free-minutes budget (private repo)
Private repos get 2,000 included minutes per month on the Free plan, and macOS minutes count
**10×** — about 200 macOS minutes. An iOS build takes roughly 30–40 macOS minutes, so plan
on ~5 iOS builds a month; Android builds are cheap. Build `android` only while iterating.
(Public repos have unlimited minutes, but this repo contains personal-use data — keep it private.)

### Optional: Kaggle token
The database job downloads the source data from public GitHub copies. If those ever
disappear, create a token at kaggle.com → Settings → API → *Generate New Token*, then in
GitHub: repo **Settings → Secrets and variables → Actions → New repository secret**
`KAGGLE_API_TOKEN`.

## Install on Android
Open the Releases page on the phone, download the `.apk`, open it and allow "install unknown
apps" for your browser when asked. Each new build normally installs over the previous one, keeping your data (all builds use the same signing key from the Expo template).

## Install on iPhone (sideloading the unsigned .ipa)
You need a Windows PC or Mac, a cable, and an Apple ID (a free one works).

**Sideloadly** (simplest):
1. Install Sideloadly (sideloadly.io) and iTunes/Apple Devices (Windows) on the computer.
2. Connect the iPhone, trust the computer.
3. Drag `PantryChef-…-unsigned.ipa` into Sideloadly, enter your Apple ID, Start.
4. On the iPhone: Settings → General → VPN & Device Management → trust your Apple ID.
5. iOS 16+: Settings → Privacy & Security → **Developer Mode** → on (phone restarts).

**AltStore** works too and can refresh apps over Wi-Fi automatically.

Limits of a **free** Apple ID: the app stops opening after **7 days** until you re-sign it
(sideload the same file again — data is kept if you don't delete the app), and only
**3 sideloaded apps** at a time. A paid Apple Developer account ($99/year) removes both
limits and enables TestFlight via EAS (`npx eas-cli build -p ios`).

## First launch and storage
The first time it opens, the app copies its recipe library (~220 MB) into its own storage while
you go through the setup questions; "Preparing recipes…" shows a percentage. Later launches skip
this. Plan for about **0.5 GB** on the phone (the app plus its copy of the recipes). On Android the
temporary extraction is deleted after the copy. A smaller build: run **Build apps** with
`min reviews = 5` (~63k recipes, ~130 MB).

## Test checklist (after installing)
Check these on each phone and note anything odd (a screenshot helps):
1. **First launch:** the setup screens respond while "Preparing recipes…" counts up; how many
   seconds until it finishes? Close and reopen the app: it should open straight away.
2. **Language:** French phone → French app; switching in Settings changes everything at once.
3. **Cook tab:** add 5 ingredients → results within about half a second; "Ready to cook" /
   "Missing 1: …" badges; scrolling stays smooth; photos load (with internet) or show the
   course emoji (offline).
4. **Recipe:** grams/ml in the ingredient list, °C in the steps, servings +/– rescales,
   ♥ favourite, "Add missing to shopping list", the Food.com link opens.
5. **Cooking mode:** the screen stays on; swipe between steps; tap a ⏱ timer, change step,
   the countdown keeps going and the phone vibrates at zero.
6. **Browse:** typing shows results as you type (try "poulet riz"), collections, filters, sort.
   French titles are found too (try "tarte").
7. **French recipes** (French + metric): names, ingredient lines ("2 c. à soupe d’huile d’olive")
   and steps in French, "Traduction automatique · Voir l’original (anglais)" switches to English
   and back (cooking mode follows), timers appear on French steps ("cuire 25 minutes"); with US
   units the recipe text is English. Note odd translations (recipe + sentence) for the glossary.
8. **Shopping list:** items grouped by aisle, tick, "Clear checked", Share → WhatsApp/Messages.
9. **Offline:** turn on airplane mode — everything works except photos.
10. **Dark mode** and **large text** (phone settings): everything readable, nothing cut off.

## Updating the recipe data
Change the pipeline (with tests), push, run **Build apps**. The new database gets a new
version id (`src/db/data-version.ts` is rewritten in CI), the app imports it on first launch
after the update and deletes the old copy. User data (`user.db`) is never touched.

## Troubleshooting
- **`macos-26` runner not available** → change `runs-on` in `.github/workflows/build-apps.yml` to `macos-15`.
- **iOS archive fails on a Swift/Xcode version error** → pick a newer Xcode with
  `sudo xcode-select -s /Applications/Xcode_<version>.app` in a step before prebuild.
- **App shows only 2,500 recipes** → you are running the sample DB (Expo Go / local build);
  release builds from the workflow contain the full database.
- **First launch takes a while** → the bundled database (~220 MB) is copied once (with a percentage);
  later launches skip the copy.
