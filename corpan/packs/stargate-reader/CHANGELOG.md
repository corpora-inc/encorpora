# Changelog — Stargate Reader pack

Immersive 3D audiobook: words stream through space in sync with narrated
audio. Distributed as a Corpán pack (manifest + zip via the
`encorpora.io` catalog).

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).
Conventions: `corpan/CHANGELOGS.md`.

## [Unreleased]

## [0.6.1] - 2026-05-02
### Changed
- Catalog drawer is a bottom sheet on iPad too (was a right side panel
  ≥ 1024px). Same overlay pattern at every size, capped at 880px tall
  so a portrait iPad doesn't get a 2000px sheet. Fixes status-bar
  overlap on the screen-nav tabs in iPad landscape and gives the
  image-heavy catalog the 3-column grid it needs.
- Catalog browse now orders books by narration count, descending —
  most-narrated books float to the top within each series, and the
  series containing the most-narrated book floats up too. Replaces
  the previous alphabetical-by-series, volume-asc ordering.

## [0.5.18] - 2026-04
### Changed
- Bundled with the readers + radio polish pass.

## [0.5.x] - 2026-04 (#233 — Narrators in catalog)
### Added
- Narrator catalog integration.

## [0.5.x] - 2026-03 (#231 — Anonymous analytics)
### Added
- Anonymous analytics + telemetry for books.

## [0.5.x] - 2026-03 (Corpán 0.11.7)
### Changed
- Parallel downloads separated for stability under poor networks.

## [0.5.x] - 2025-12 (Corpán 0.9.8 #195)
### Added
- Full rollout shipped — initial public release of the immersive 3D
  audiobook experience.

## Older

See `git log corpan/packs/stargate-reader/`. The pack started life as
"book pack 00001: Monte Alban" (#187) and matured through several
iterations alongside Corpán 0.9.x – 0.11.x.
