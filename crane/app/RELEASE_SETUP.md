# Crane app: mobile release setup

Everything `.github/workflows/release-crane.yml` needs before it can ship
`inc.corpora.crane` to TestFlight internal testing and the Play internal track.

**No credential value appears in this repository.** This file lists secret
**names** and how to produce each value. The repository is public.

## Status

| | |
|---|---|
| The workflow, `unsigned` mode | **never executed**. No step has run against this app; Rust does not build on the machine the workflow was written on. Run it first (see [Prove the build](#prove-the-build-before-any-secret-exists)). |
| The workflow, signed | **never executed**. Nothing from `Import signing certificate` / `Sign the AAB` onward has run, including both uploads and both verifications. |
| App Store Connect app record | **does not exist** (founder, browser only) |
| Play app record | **does not exist** (founder, browser only) |
| The four new secrets | **do not exist** |
| Product name | **placeholder** (`Crane Companion`), see [below](#product-name) |

Until each secret exists, a signed run fails in its first steps and names every
missing secret. It never reports success after skipping work.

## Prove the build before any secret exists

Actions → *Release · Crane mobile* → *Run workflow* → tick **unsigned**.

That run reads no secret and contacts neither store. It generates both native
projects, builds an unsigned iOS archive (`--no-sign`, which passes
`CODE_SIGNING_ALLOWED=NO` to `xcodebuild`) and an unsigned AAB, runs every
artifact check below on them, and keeps them as workflow artifacts
(`crane-ios-unsigned-<build>`, `crane-android-unsigned-<build>`) for 14 days.

`workflow_dispatch` only offers workflows that exist on `main`, so this run is
possible once the workflow has merged.

## Founder actions, in order

### Browser only: no API exists

1. **Decide the product name** ([below](#product-name)) before the store records
   are created, because the record name is what testers see first.
2. **Create the App Store Connect app record** for bundle id
   `inc.corpora.crane`. The App Store Connect API has no app-create operation.
3. **Create the Play app record** with package name `inc.corpora.crane`. The
   package name is locked forever by the first uploaded AAB; the workflow reads
   it back from the AAB and refuses to upload a different one.
4. **Grant the existing Play service account access to the new app**
   (`Release to testing tracks` is enough). Per-app grants do not carry over:
   the same service account already gets 403 on sibling apps on this account
   (`dynawalla/docs/STORE.md`, G-09).
5. **Enrol the app in Play App Signing** and register the new upload key's
   certificate.
6. **Publish the first Play release from the Console.** On an app that has
   never been published, the API can only create *draft* releases. Afterwards
   set the repository **variable** `CRANE_PLAY_RELEASE_STATUS` to `completed`.
   Until then the workflow uploads as `draft`, which is correct.
7. **Check the Play developer account type.** Personal accounts created after
   2023-11-13 must run a closed test with 12 testers for 14 continuous days
   before production access; organization accounts are exempt. The account's
   type is unverified (`dynawalla/docs/STORE.md`). It does not block the
   internal track, but it is a two-week calendar cost before a public release.
8. **Privacy policy URL** in both consoles. Both stores require one for every
   app (App Store Review Guideline 5.1.1(i); Google Play User Data policy).

### API-automatable

The `store-operator` agent (`.claude/agents/store-operator.md`) drives these by
API and names any step that has none.

- Register the Apple **bundle id** `inc.corpora.crane`. No extra capability is
  needed: the app uses no push, iCloud, IAP or associated domains.
- Mint the **App Store provisioning profile**, named exactly
  **`crane appstore ci`**, bound to the new bundle id and the existing
  `Apple Distribution: Corpora Inc` certificate. The workflow pins that name in
  the Xcode project and in `ExportOptions.plist` and checks the profile's
  `Name` and `application-identifier` (`F9AV5HKF6N.inc.corpora.crane`) before
  building.
- **Age rating** (Apple) and **content rating** (Play, IARC questionnaire). Both
  are required before release. Answer them for what the app is: crane rules,
  inspections and practice.
- **App Privacy** (Apple) and **Data safety** (Play): *no data collected, no
  data shared*. What that rests on, as verified in this tree:
  - `src-tauri/tauri.conf.json`: the webview's CSP is
    `connect-src 'self' ipc: http://ipc.localhost`, so the frontend can reach no
    network origin.
  - `src-tauri/capabilities/default.json` grants eight single commands:
    `tts:allow-speak`, `tts:allow-stop`, `stt:allow-is-available`,
    `stt:allow-validate-model`, `stt:allow-prepare`, `stt:allow-start-session`,
    `stt:allow-stop-session`, `corpan-llm:allow-llm-status`. The STT plugin's
    download command, `install_model`, is not among them, and `prepare` is a
    local-only load on both platforms (its own code and comments say so).
  - Voice input is speech-to-text on the device (whisper.cpp). The microphone
    purpose string in `src-tauri/Info.ios.plist` says speech is not sent
    anywhere.
  - The merged Android manifest still declares `INTERNET` (from the Tauri
    template, and from `tauri-plugin-stt` for `install_model`) and
    `RECORD_AUDIO` (from `tauri-plugin-stt`). Declaring a permission is not
    collection. Re-check this list whenever a capability is added.
- **Advertising ID** declaration (Play Console): *no*. The workflow fails if the
  merged manifest ever requests `com.google.android.gms.permission.AD_ID`.
- **Target audience** (Play): adults. Nothing in the app is directed at
  children.
- Store listings, screenshots, TestFlight internal group, track promotion.

## GitHub Actions secrets

Settings → Secrets and variables → Actions.

### Reused: already set, nothing to do

| Secret | What it is | Note |
|---|---|---|
| `APPLE_DIST_CERT_P12` | `Apple Distribution: Corpora Inc`, base64 `.p12` | A distribution certificate signs any bundle id in team `F9AV5HKF6N`; the profile is what is per-app. |
| `APPLE_DIST_CERT_PASSWORD` | the password on that `.p12` | |
| `ASC_KEY_ID` | App Store Connect API key id | |
| `ASC_ISSUER_ID` | issuer id | |
| `ASC_API_KEY_P8` | the `.p8` private key contents | |
| `PLAY_SERVICE_ACCOUNT_JSON` | Play publishing service account | The identity is reused. Its access is not: founder action 4. |

### New: four secrets

| Secret | What it is | How to produce it |
|---|---|---|
| `CRANE_APPLE_PROVISIONING_PROFILE` | the App Store `.mobileprovision` named `crane appstore ci`, base64 | Mint it (API or developer portal), download it into `~/.corpora-signing/`, then `base64 -i ~/.corpora-signing/crane.mobileprovision \| pbcopy`. Never reuse another product's profile. |
| `CRANE_ANDROID_KEYSTORE_B64` | a **new** upload keystore, base64 | Generate it outside the repository ([below](#signing-material-lives-outside-the-repository)), then `base64 -i ~/.corpora-signing/crane-upload.jks \| pbcopy`. Separate from Corpán's and Dynawalla's so one compromised key risks one app. |
| `CRANE_ANDROID_KEYSTORE_PASSWORD` | the store password you chose | |
| `CRANE_ANDROID_KEY_ALIAS` | the key alias you chose | `upload` with the command below |

There is no key-password secret: `jarsigner` signs with `-storepass` only. That
is enough for the PKCS12 keystore the command below produces, whose key password
is the store password. If a keystore ever has a different key password, add a
secret and wire it as `-keypass:env` in the same change.

### Repository variable

| Variable | Default | Meaning |
|---|---|---|
| `CRANE_PLAY_RELEASE_STATUS` | `draft` when unset | Set to `completed` after founder action 6. |

### Signing material lives outside the repository

Use **`~/.corpora-signing/`**, never `crane/app/`. A keystore in the project
tree is a commit away from a public repository, and the Vite dev server serves
files from that directory.

```sh
mkdir -p ~/.corpora-signing && chmod 700 ~/.corpora-signing
keytool -genkeypair -v \
  -keystore ~/.corpora-signing/crane-upload.jks \
  -alias upload -keyalg RSA -keysize 2048 -validity 10000
```

Once each value is a GitHub secret, nothing in this tree reads the file again.
The workflow writes the keystore to `$RUNNER_TEMP` (deleted when the step
exits), the profile into the runner's Provisioning Profiles directory, and the
certificate into a throwaway keychain.

Team ID `F9AV5HKF6N`, the bundle id and the profile name are not secrets; they
are in every shipped artifact.

## What the workflow does

Triggers: a `crane-v<version>` tag (it must equal `version` in
`src-tauri/tauri.conf.json`) or a manual dispatch with `platforms` and
`unsigned`. It never runs on a pull request and is not a required check.

1. **Fails hard on a missing secret**, naming each one, before any work
   (signed runs only).
2. **Checks the profile** (`application-identifier`, `Name`) and asks App Store
   Connect and Play whether the app records exist and are reachable, before
   building (signed runs only).
3. **Generates both native projects** (`gen/` is not committed) with
   `tauri ios init` / `tauri android init`, then edits the generated files and
   asserts each edit landed:
   - iOS `gen/apple/project.yml`: `ITSAppUsesNonExemptEncryption = false`
     (export compliance; the app is offline and uses no encryption of its own),
     the whisper.cpp link flags, manual signing with `crane appstore ci`
     (signed only), and removal of the static `libapp.a` from the bundle
     (ITMS-90171). The Xcode project is regenerated from the edited spec.
   - Android `gen/android/app/build.gradle.kts`: native debug symbols
     (`SYMBOL_TABLE`) and the pinned NDK `28.2.13676358`.
   - The committed icons in `src-tauri/icons/ios/` and `src-tauri/icons/android/`
     replace the template icons.
   - The microphone string is not added by the workflow: the Tauri CLI merges
     `src-tauri/Info.ios.plist` into the generated `Info.plist` at build time.
     `RECORD_AUDIO` comes from `tauri-plugin-stt`'s manifest.
4. **Builds** with Rust from `src-tauri/rust-toolchain.toml` set as the runner's
   default toolchain, and with `CMAKE_DISABLE_FIND_PACKAGE_OpenSSL=ON` (and, on
   Android, the pinned NDK and `ANDROID_PLATFORM=android-26` for llama.cpp)
   written to the runner's `$CARGO_HOME/config.toml`. The Tauri CLI runs cargo
   from `crane/app` with a filtered environment, so neither job environment
   variables nor `src-tauri/rust-toolchain.toml` reach it otherwise. Android
   builds arm64-v8a only.
5. **Reads the finished artifacts back** and fails on any mismatch:
   - IPA / archive: bundle id, `CFBundleShortVersionString`, `CFBundleVersion`
     ending in this run's build number, `ITSAppUsesNonExemptEncryption = false`,
     iOS 26 SDK or later, `MinimumOSVersion` 16.0,
     `NSMicrophoneUsageDescription` present (ITMS-90683), no static library in
     the bundle, a dSYM in the archive, and an opaque 1024×1024 App Store icon
     in the compiled `Assets.car` (ITMS-90717).
   - AAB: applicationId, versionCode, versionName, minSdk 26, targetSdk 36 or
     higher (Play target API requirement), `RECORD_AUDIO` present, `AD_ID`
     absent, arm64-v8a only including `libcrane_lib.so`, every native library's
     LOAD segments 16 KiB aligned and 16 KiB APK packaging requested (Play's
     16 KB page size requirement), and arm64-v8a native debug symbols.
6. **Uploads** to TestFlight and the Play internal track, then **verifies this
   run put the build there**: TestFlight requires the build's `uploadedDate` to
   be at or after the run started; Play snapshots the track before the upload
   and requires the versionCode to have been added. Presence alone would pass
   on a duplicate build number.

Every run keeps its IPA (or unsigned archive) and AAB as workflow artifacts,
even when a later step fails.

## Build numbers

Minutes since the epoch, shared by both platforms in a run: `CFBundleVersion`
is `<version>.<build>` and the Android `versionCode` is `<build>`. Monotonic by
construction and far below Play's 2,100,000,000 ceiling. Never switch to
`github.run_number`: it restarts when the workflow file is renamed, so the
number would decrease and both stores reject that at the end of a long job.

Two runs cannot compute the same minute because `concurrency.group` is one
constant (`release-crane`) and runs never overlap. The cost: GitHub keeps one
pending run per group and cancels an older pending one, reported as
`cancelled`. If a release is dropped that way, push the tag again or dispatch.

## Product name

`Crane Companion` is a placeholder. It lives in two files, which change
together:

- `src-tauri/tauri.conf.json` → `productName` (the iOS app and IPA name, the
  Android launcher label) and `app.windows[0].title`;
- `src/config.ts` → `PRODUCT.name`, which every screen reads.

The bundle id `inc.corpora.crane` is independent of the name and is the one
value that cannot change after the first upload. The store record names are set
in each console and can differ from `productName`.
