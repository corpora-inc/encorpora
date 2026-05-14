# Changelog — Earthgate Reader pack

Calm, earth-toned audiobook reader with word-level highlighting synced
to narrated audio. Distributed as a Corpán pack (manifest +
zip via the `encorpora.io` catalog).

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).
Conventions: `corpan/CHANGELOGS.md`.

## [Unreleased]

## [0.6.3] - 2026-05-13
### Added
- Anonymous analytics: `segment_play` (auto-advance + active playback)
  and `segment_play_one` (tap-to-replay) events with `segment_index`.
  Replaces wall-clock `duration_ms` as the engagement metric — counts
  what's actually being listened to, survives lock-screen background
  audio, and the `segment_play_one : segment_play` ratio per session
  is the language-learning vs. audiobook signal.

## [0.6.2] - 2026-05-10
### Changed
- Transport bar typography refreshed: book title (italic gold, 13 px)
  stacks above a dainty chapter title (italic muted, 10 px,
  letter-spaced). Each line ellipses on its own, so the chapter can no
  longer collide with the time on the right.
- Compact language switcher pulled out of a wrapper and inserted
  directly above the chapter / scrub / controls inside the transport
  bar — the standalone book-title row above the pills is gone (book
  title now lives next to the chapter).
- Auto-scroll reading anchor 0.4 → 0.67 of the clean reading area, so
  the active word lands ~2/3 down the frame and recently-read text
  stays visible longer.
- Vertical centering retuned for the new transport height
  (`--eg-transport-clearance` 130 → 140; responsive variants in step).

### Added
- `transportBar.setBookTitle()` on the shared transport API; readers
  call it after creating the transport so the book prefix renders next
  to the chapter span.

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
