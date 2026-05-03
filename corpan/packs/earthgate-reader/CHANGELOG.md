# Changelog — Earthgate Reader pack

Calm, earth-toned audiobook reader with word-level highlighting synced
to narrated audio. Distributed as a Corpán pack (manifest +
zip via the `encorpora.io` catalog).

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).
Conventions: `corpan/CHANGELOGS.md`.

## [Unreleased]
### Changed
- Catalog drawer is a bottom sheet on iPad too (was a right side panel
  ≥ 1024px). Same overlay pattern at every size, capped at 880px tall
  so a portrait iPad doesn't get a 2000px sheet. Fixes status-bar
  overlap on the screen-nav tabs in iPad landscape and gives the
  image-heavy catalog the 3-column grid it needs.

## [0.5.8] - 2026-04
### Changed
- Bundled with the readers + radio polish pass.

## [0.5.x] - 2026-04 (#233 — Narrators in catalog)
### Added
- Narrator catalog integration; the reader picks up Narrator metadata
  from the host catalog rather than per-pack hardcoding.

## [0.5.x] - 2026-03 (#231 — Anonymous analytics)
### Added
- Anonymous analytics + telemetry for books, hardened CORS for Tauri
  WKWebView, dropped subdivision geo, generic `track()`.

## [0.5.1] - 2026-03 (Corpán 0.11.6)
### Added
- Initial bundling alongside Corpán 0.11.6 IAP retry / diagnostics.

## Older

See `git log corpan/packs/earthgate-reader/` for development pre-0.5.
