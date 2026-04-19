# Corpan 0.11.3 App Release — Punch List

Scope: the native iOS + Android app binary and its cloud backend. Narration/book content publishing is a separate cadence and **not** covered here. Web deploys and reader-pack publishes are also independent of this release.

Source: research carried over from the `next-dgx` merge review. Starts the next polish branch fully loaded.

---

## A. Hermetic regen of `gen/` (enables everything below)

Two existing scripts do the heavy lifting:

- `corpan/corpan-app/scripts/ios-gen.sh` — cleans `gen/apple/`, pre-copies template files (`Corpan.storekit`, `corpan_iOS.entitlements`) from the template dir, runs `npx tauri ios init --ci` (which runs xcodegen from `src-tauri/ios/project.yml`), verifies `/usr/lib/swift` is in `LD_RUNPATH_SEARCH_PATHS`, and patches the StoreKit scheme reference that xcodegen misses. `--clean` supported.
- `corpan/corpan-app/scripts/patch-android.sh` — idempotent post-init patch pinning `compileSdk=36`, `targetSdk=36`, `ndkVersion=28.2.13676358`, Java/Kotlin 17, and the source-target-deprecation suppressor. Safe to re-run. Does **not** currently touch `AndroidManifest.xml`.

`src-tauri/ios/project.yml:58-60` explicitly notes that `CFBundleShortVersionString` and `CFBundleVersion` auto-inject from `tauri.conf.json.version` — rely on that contract; never hardcode versions in `project.yml`.

**First action on the polish branch — empirically validate regen before changing anything:**

1. `cd corpan/corpan-app && ./scripts/ios-gen.sh --clean` → read `gen/apple/corpan_iOS/Info.plist`: does `CFBundleShortVersionString` become `0.11.3` (matching `tauri.conf.json`) or stay `0.11.2`?
2. Wipe `gen/android`, run `cargo tauri android init`, then `./scripts/patch-android.sh` → read `gen/android/app/tauri.properties`: does `tauri.android.versionName` become `0.11.3` / `versionCode=11003`?
3. Read the regenerated `gen/android/app/src/main/AndroidManifest.xml`: is `com.android.vending.BILLING` present (because `tauri-plugin-iap` contributes it) or still absent?

The answers decide whether fixes in section B need template-layer changes, script extensions, or both.

**Longer-term ideal** the user raised: once regen is deterministic and correct, `gen/` can be `.gitignore`d and rebuilt on every CI/local build. **Don't pursue this inside 0.11.3** — keep `gen/` checked in for now. Doing the prep work (template-layer fixes, reproducible scripts) is what makes the future `.gitignore` move safe.

---

## B. Known template-layer fixes

All edits go in `src-tauri/` templates, `scripts/`, or root config files — never in `gen/`.

### B1. Cargo.toml version
`corpan/corpan-app/src-tauri/Cargo.toml:3` is `0.11.2`. Bump to `0.11.3`.

### B2. iOS entitlements
`corpan/corpan-app/src-tauri/ios/corpan_iOS/corpan_iOS.entitlements` is bare `<dict></dict>`. `ios-gen.sh` pre-copies this file into `gen/apple/corpan_iOS/` before `tauri ios init`, so any changes to the template propagate automatically.

Enable the **In-App Purchase** capability on the Xcode target via `project.yml` (not by hand-toggling in Xcode, which gets lost on `--clean`). Research the xcodegen + Tauri-compatible syntax — likely either a `settings` addition on the `corpan_iOS` target or a Capabilities declaration.

### B3. `PrivacyInfo.xcprivacy` — Apple-required since iOS 17
Does not exist in the repo; App Store will reject. Create `corpan/corpan-app/src-tauri/ios/corpan_iOS/PrivacyInfo.xcprivacy`:

- `NSPrivacyTracking = false`
- `NSPrivacyCollectedDataTypes = []` (Corpan core collects nothing)
- `NSPrivacyAccessedAPITypes` — audit native plugin code for Required Reason APIs. Declare only what's actually used:
  - `NSPrivacyAccessedAPICategoryUserDefaults` reason `CA92.1`
  - `NSPrivacyAccessedAPICategoryDiskSpace` reason `E174.1`
  - `NSPrivacyAccessedAPICategoryFileTimestamp` reason `C617.1`
  - `NSPrivacyAccessedAPICategorySystemBootTime` reason `35F9.1`

  Start from grepping `AudioKeepAlivePlugin.swift`, `tauri-plugin-iap`, any UserDefaults/disk usage.

Register the file in `project.yml` under `targets.corpan_iOS.sources` so xcodegen includes it in the bundle. Extend `scripts/ios-gen.sh` to pre-copy it the same way it pre-copies `corpan_iOS.entitlements`.

### B4. Android BILLING permission
`gen/android/app/src/main/AndroidManifest.xml` declares INTERNET / FOREGROUND_SERVICE / WAKE_LOCK / POST_NOTIFICATIONS but not `com.android.vending.BILLING`. Play Billing will not initialize and the AAB will be rejected. `corpan/CLAUDE.md` already flags this requirement.

**Fix priority order:**

1. **Tauri-native path**: check whether `tauri-plugin-iap`'s plugin manifest should contribute BILLING automatically (it arguably should — if not, file upstream). Check Tauri v2 options for per-project manifest overrides (e.g., an `android.manifest` entry in `tauri.conf.json`, or a `src-tauri/android/` overlay).
2. **Script extension**: if no native path, extend `scripts/patch-android.sh` to inject `<uses-permission android:name="com.android.vending.BILLING" />` idempotently with a BEGIN/END marker pattern matching the Gradle patches.
3. **Hand-edit `gen/`**: last resort; document as an accepted exception in `corpan/CLAUDE.md`.

### B5. StoreKit configuration placeholder
`corpan/corpan-app/src-tauri/ios/Corpan.storekit:24` has `"_applicationInternalID": "PLACEHOLDER"`. Replace with the real App Store Connect app ID once the app record exists.

---

## C. Cloud backend for receipt verification

Code-complete per `corpan/IAP_IMPLEMENTATION_STATE.md` and `corpan/infra/IAP_SETUP_RUNBOOK.md`; not fully provisioned.

- **App Store Connect**: create app record; register production IAP IDs matching `Corpan.storekit` (`corpan.sub.monthly`, `corpan.sub.annual`, `corpan.book.*`).
- **Play Console**: register matching products; upload an AAB to internal testing.
- **Apple App Store Server API credentials** (`.p8`, key ID, issuer ID) → AWS Secrets Manager, read by the Lambda at cold start.
- **Play Developer API service-account JSON** → AWS Secrets Manager.
- **CloudFront signed-URL private key** → AWS Secrets Manager. Still flagged pending in `IAP_IMPLEMENTATION_STATE.md`; **this blocks paid-book downloads** (URL signing fails without it).
- **Sandbox testers** in both consoles for end-to-end review.
- **Disable the Lambda dev-bypass in prod**: `corpan/infra/terraform/lambda/verify_purchase.js:377-382` honors an `x-dev-bypass` header that returns a synthetic entitlement; `main.tf:129` wires `DEV_BYPASS_TOKEN`. Either unset the env var on the prod stage or gate the branch on `stage !== "prod"`. Anyone with the token otherwise gets free entitlements.

---

## D. End-to-end buy-flow verification (physical devices)

The paywall spans three artifacts that must line up: main app (`src/store/entitlements.ts`, `src/components/packs/*`, `src/contentPacks/purchase.ts`), reader pack (`packs/shared/catalog/src/purchaseManager.ts`, `appShell.ts`), and cloud (Lambda + CloudFront + Secrets Manager).

Run on a physical iPhone and a physical Android:

1. Fresh install → sandbox-account sign-in → buy `corpan.sub.monthly` → entitlement appears in `useEntitlementStore` → reader catalog shows subscriber state → open a paid book → CloudFront signed URL resolves → narration downloads and plays.
2. Cancel subscription in system settings → on next launch, entitlement clears.
3. Per-book purchase (`corpan.book.*`) → reader reflects ownership after app restart and after reopening the reader cold.
4. Restore Purchases on a wiped install → entitlements rehydrate from platform.
5. Android acknowledgment within the 3-day window (already wired in `purchase.ts`; verify end-to-end).
6. Error paths: purchase sheet cancelled, network drop mid-purchase, `already_owned` on a repeat buy. Errors must surface per `memory/feedback_noisy_errors.md`.
7. Reader-to-app bridge: reader triggers a buy → `corpan:purchase-recorded` CustomEvent fires → main app's entitlement store appends the product → reader UI updates reactively.

---

## E. Frontend polish

- **Silent-catch sweep** in `corpan-app/src/` per `memory/feedback_noisy_errors.md`. An earlier audit flagged candidates in `App.tsx` and `util/speak.ts` — verify before fixing. Every catch needs at minimum a `console.error` or OS-log emission.
- **New-string localization check**: 28 locale files were updated for IAP/legal. Spot-check a non-Latin locale (`ar`, `zh-Hans`, `ja`) that every new key in `PackActions`, `SubscriptionOffer`, `RestorePurchases` resolves to a real translation.
- **Release-build flags**: `android:debuggable="false"` and `usesCleartextTraffic=false` resolve correctly in the release flavor of `gen/android/app/build.gradle.kts`.
- **Provisioning profile** in `corpan/corpan-app/src-tauri/ios/ExportOptions.plist` (UUID `4d5c5e29-f71e-4053-a7b6-fc1d5874d97a`): validate it's current and includes In-App Purchase capability once B2 is done.
- **Upload keystore** at `corpan/corpan-app/src-tauri/upload-keystore.jks` — confirm it's in `.gitignore` and has an off-box backup. Losing the upload key means never updating the Play listing again.

---

## F. Store listing + compliance

No `fastlane/metadata/` equivalent found — produce via store consoles manually:

- **"What's new" / release notes**: subscriptions + per-book purchases, two updated reader packs (stargate 0.5.0, earthgate 0.4.0), expanded book catalog.
- **Screenshots**: iOS 6.5" + 6.9" + iPad 13"; Android phone + tablet. ~5 per device class per locale. English baseline is enough for initial approval.
- **Short (<30 char) + long description + keywords + support/privacy/marketing URLs** in both consoles.
- **Play Data Safety form**: Corpan core collects nothing — reflect that truthfully; disclose IAP receipts transit the Lambda for verification.
- **Age rating / IARC**: historical-violence descriptor for pirate biographies; otherwise tame.
- **Localized IAP product descriptions** on App Store Connect / Play Console (live in the stores, not in the repo — can iterate post-launch).

---

## Key references

- `corpan/IAP_IMPLEMENTATION_STATE.md` — implementation status as of April 2026.
- `corpan/infra/IAP_SETUP_RUNBOOK.md` — manual setup steps for the Lambda + consoles.
- `corpan/CLAUDE.md` — project conventions (notes BILLING requirement + `gen/` edit policy).
- `memory/iap-architecture.md`, `memory/feedback_noisy_errors.md`, `memory/engineering-standards.md` — background context.
