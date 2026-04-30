# Changelog — `tauri-plugin-iap`

In-app purchase bridge for the Corpán Tauri app. Wraps native StoreKit 2
on iOS/macOS and Play Billing on Android. Powers per-book purchases and
the Corpán subscription.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).
Conventions: `corpan/CHANGELOGS.md`.

## [Unreleased]

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
