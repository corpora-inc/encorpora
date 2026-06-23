# Changelog — `tauri-plugin-iap`

In-app purchase bridge for the Corpán Tauri app. Wraps native StoreKit 2
on iOS/macOS and Play Billing on Android. Powers per-book purchases and
the Corpán subscription.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).
Conventions: `corpan/CHANGELOGS.md`.

## [Unreleased]

## [0.9.0] - 2026-06-16

### Fixed
- **iOS build break in `presentOfferCodeRedeemSheet`.** The command wrapped its
  body in a synchronous `MainActor.run { }`, so the iOS 16+ `async throws`
  `AppStore.presentOfferCodeRedeemSheet(in:)` failed to compile ("'async' call in
  a function that does not support concurrency"). The method is now `@MainActor`
  and `try await`s the SK2 call directly; the SK1 fallback is unchanged.
- **Android free-trial offer selection.** With no explicit `offerToken` (the plain
  "Start Free Trial", no affiliate code), the purchase now PREFERS the subscription
  offer whose pricing has a zero-price phase (the free trial) instead of
  `subscriptionOfferDetails.firstOrNull()` — which could land on the bare base plan
  and silently deny a trial-eligible user their 7 days. `queryProductDetails` only
  returns eligible offers, so a present trial offer is safe; falls back to the first
  offer when there's no trial.

### Added
- **`request_review` command — OS-native in-app review prompt.** Routes
  through the same plugin seam as the rest of the store integration. iOS calls
  StoreKit `SKStoreReviewController.requestReview(in:)` (scene-based, with the
  legacy `requestReview()` fallback); Android runs the Google Play In-App
  Review flow (`ReviewManager.requestReviewFlow` → `launchReviewFlow`, new
  `com.google.android.play:review` dependency). macOS / Windows / Linux resolve
  as a clean no-op. The OS is the throttle (iOS ~3×/year) and may show nothing;
  the call is fire-and-forget and never gates anything. Exposed in `guest-js`
  as `requestReview()`.

## [0.8.2] - 2026-03 — IAP rewrite for App Review (Corpán 0.11.7)

### Changed
- Full rewrite for App Review resubmission. Native StoreKit 2 + Play
  Billing flow stabilized; cleaner product status reporting; restored
  purchases plumbing.

### Fixed
- Purchase lifecycle edge cases that tripped Apple 3.1.2(c) and 2.1(b)
  rejections.

## [0.8.1] - 2026-03 — IAP retry + diagnostics (Corpán 0.11.6)

### Added
- Retry surfaces and richer diagnostics on purchase failures.
- Lifecycle hardening for backgrounded purchase flows.

## Older

See `git log corpan/plugins/tauri-plugin-iap/`.
