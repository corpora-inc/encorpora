# Mobile release automation — one-time setup

Once this is configured, **you never touch your MacBook to ship a test build
again.** Bump the app version, merge to `main`, and CI builds signed iOS +
Android and pushes them to **TestFlight internal** and **Play internal
testing**. The build lands on your phone in ~10–30 min (Apple/Google
processing time). Internal tracks have **no beta review**, so it's automatic.

The pipeline is `.github/workflows/release-mobile.yml`. It only runs when the
version in `src-tauri/tauri.conf.json` changes (or on manual dispatch), and it
**skips cleanly if the secrets below aren't set** — so nothing breaks before
setup is done.

## How you cut a release (after setup)

```bash
cd corpan/corpan-app
node scripts/bump-app-version.mjs minor   # 0.19.2 -> 0.20.0 (or: patch / 0.20.0)
git commit -am "release: corpan 0.20.0"
# open a PR; when it merges to main, the release build fires
```

Testers see `0.20.0`; the unique build number (TestFlight/Play require it to
increase every upload) comes from the CI run number automatically.

---

## The secrets to add (Settings → Secrets and variables → Actions)

### Apple / iOS → TestFlight

| Secret | What it is | Where to get it |
|---|---|---|
| `ASC_KEY_ID` | App Store Connect API **Key ID** | App Store Connect → Users and Access → **Integrations → App Store Connect API** → generate a key with **App Manager** role |
| `ASC_ISSUER_ID` | The **Issuer ID** on that same page | same page (one per team) |
| `ASC_API_KEY_P8` | The `.p8` private key **contents** | downloaded **once** when you create the key. `cat AuthKey_XXXX.p8` and paste the whole thing (incl. BEGIN/END lines) |
| `APPLE_DIST_CERT_P12` | Your **Apple Distribution** cert, base64 | On your Mac (one time): Keychain → export the distribution identity as `.p12` → `base64 -i dist.p12 \| pbcopy` |
| `APPLE_DIST_CERT_PASSWORD` | password you set on that `.p12` | you choose it at export |
| `APPLE_PROVISIONING_PROFILE` | the App Store `.mobileprovision`, base64 | the profile already referenced in `src-tauri/ios/ExportOptions.plist` (`4d5c5e29-…`). Download from developer.apple.com or `~/Library/MobileDevice/Provisioning Profiles/`, then `base64 -i profile.mobileprovision \| pbcopy` |

Team ID (`F9AV5HKF6N`) and bundle id (`com.corpora.corpan`) are already in the
repo, no secret needed.

> The **only step that needs your Mac** is exporting the `.p12` cert and the
> `.mobileprovision` (you already have both — that's how you build locally).
> Everything else is web-console. If you'd rather never touch the Mac again for
> this, we can switch to **Fastlane `match`** later (stores certs in a private
> repo); the one-time export is quicker to start with.

### Google / Android → Play internal

| Secret | What it is | Where to get it |
|---|---|---|
| `PLAY_SERVICE_ACCOUNT_JSON` | Play publishing service account | Google Cloud (the project linked to Play) → create a service account → in **Play Console → Users & permissions**, invite it and grant **Release to testing tracks**. Paste the JSON |
| `ANDROID_KEYSTORE_B64` | your `upload-keystore.jks`, base64 | `base64 -i ~/.corpora-signing/corpan-upload-keystore.jks` (see below — it lives outside the repo) |
| `ANDROID_KEYSTORE_PASSWORD` | keystore password | your existing keystore creds |
| `ANDROID_KEY_ALIAS` | key alias | " |
| `ANDROID_KEY_PASSWORD` | key password | " |

The app must exist in Play Console with an **internal testing** track and at
least one internal tester (you) before the first upload.

### Where the keystore lives — outside the repository

**`~/.corpora-signing/corpan-upload-keystore.jks`**, never inside the project
tree. `src-tauri/` is inside the Vite dev server's root, and `TAURI_DEV_HOST`
(on-device Android testing) binds that server to the **LAN** — see
`corpan/DEV_LOOP.md`. `.gitignore` keeps a `.jks` off GitHub, the hygiene job's
signing-material guard fails any PR that adds one, and `vite.config.ts`'s
`server.fs.deny` keeps it off the network. All three are backstops for a file
that should not be there in the first place.

Create the directory private, and generate there:

```sh
mkdir -p ~/.corpora-signing && chmod 700 ~/.corpora-signing
keytool -genkeypair -v \
  -keystore ~/.corpora-signing/corpan-upload-keystore.jks \
  -alias upload -keyalg RSA -keysize 2048 -validity 10000
```

Local Android release builds find it through `keystore.properties`, which Tauri
reads from `src-tauri/gen/android/` (generated, ignored by `src-tauri/.gitignore`)
and which must use an **absolute** path:

```properties
storeFile=/Users/<you>/.corpora-signing/corpan-upload-keystore.jks
storePassword=…
keyAlias=upload
keyPassword=…
```

CI never reads that file: `release-mobile.yml` decodes `ANDROID_KEYSTORE_B64`
into `$RUNNER_TEMP` and signs the AAB with `jarsigner`. So this is a local-build
concern only.

**If a keystore already exists at `corpan-app/src-tauri/upload-keystore.jks`**,
move it — `mv corpan-app/src-tauri/upload-keystore.jks
~/.corpora-signing/corpan-upload-keystore.jks` — and update `storeFile`. Losing
this file means a new upload key and a Play support request, so verify the copy
before deleting anything. Nothing in CI changes.

---

## Honest caveats (read before the first run)

- **This scaffold hasn't been run yet** (it can't be built or tested from the
  Linux box it was authored on). Expect the **first real run to need 1–2
  tweaks**, almost always in one of two spots, both flagged in the workflow:
  1. **iOS build-number stamping** (`agvtool` on the generated Xcode project) —
     the exact project path / scheme name may differ.
  2. **Android AAB output path** and the `keystore.properties` wiring that
     `tauri android build` expects.
  Everything else (deps, signing import, uploads) uses standard, widely-used
  actions.
- We ship to **internal tracks only** — never auto-publish to the public store.
  Promoting a build to production stays a manual, deliberate action.
- **External** TestFlight testers (beyond your ~100 internal) require Apple's
  one-time Beta App Review per version; internal testers do not.
- macOS runners are **free** here (the repo is public), so cost isn't a factor.
