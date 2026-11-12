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
- **First launch takes a while** → the bundled database (~220 MB) is copied once.
