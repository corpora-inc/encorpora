# Changelog — Stargate Reader pack

Immersive 3D audiobook: words stream through space in sync with narrated
audio. Distributed as a Corpán pack (manifest + zip via the
`encorpora.io` catalog).

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).
Conventions: `corpan/CHANGELOGS.md`.

## [Unreleased]
### Changed
- Upgraded Babylon.js **6.48 → 9.11** (latest stable). No source changes
  required; build clean. (Pre-existing `WaveformConfig` type-cast warnings
  in `game.ts`/`settingsPanel.ts` are unrelated and untouched.)
- Dated periodicals in the catalog (e.g. "AI This Week") now list
  newest-first. The shared catalog grouping (`@shared/catalog`
  `groupByBook`) sorts books by `publishedAt` descending when present,
  falling back to the legacy narration-count/volume/title order for
  evergreen titles. (Applies to earthgate-reader too.)

## [0.6.7] - 2026-05-30
### Fixed
- Corpán Plus preview/premium now actually works. The shared catalog
  parser (`@shared/catalog` `parseNarration`) was silently dropping the
  two-ZIP fields (`preview`/`full`/`totalSegments`/`freeSegments`), so
  every entry looked legacy-only — `isTwoZipEntry()` was always false and
  every download fell back to the full legacy ZIP with no preview and no
  end-of-preview paywall. Carry the fields through. (Applies to
  earthgate-reader too.)
### Changed
- Narration rows now show the size you'll actually download and tag it
  "Free preview" for non-subscribers on two-ZIP entries, so a long book's
  small preview no longer masquerades as the whole thing. (`@shared/catalog`.)
- End-of-preview paywall is now skinned to match the reader (deep
  indigo/space accent + background) via a `theme` hint on the
  `corpan:request-unlock` event. Requires Corpán ≥ 0.16.0; older hosts
  ignore the hint and show the default paywall.

## [0.6.6] - 2026-05-19
### Changed
- Catalog browser drawer now renders a calm "Browse needs internet"
  notice when the user cold-starts the pack offline with no cached
  catalog, instead of a misleading "No books match your search" empty
  state. Installed narrations are unaffected — they play offline via
  `corpan-pack://` as before. (Lives in `@shared/catalog`, applies to
  earthgate-reader too.)

## [0.6.5] - 2026-05-18
### Fixed
- Transport bar no longer shows a `"Ready"` placeholder for
  chapterless books, and no longer flickers a stale chapter string
  when switching languages. The `|| "Ready"` fallback on
  `transport.setChapter` was a regression — the same bug was already
  fixed in earthgate-reader 0.6.3. Stargate now passes `""` for the
  chapterless case, and `.stargate-chapter-title:empty` collapses the
  row so the book title stays vertically centered against the time.
- Transport controls no longer jerk down when the chapter title
  arrives async for chaptered books. New per-book `hasChapters` cache
  in localStorage; on mount the reader reads it synchronously and
  asks the transport to reserve a line (via a non-breaking-space
  placeholder so `:empty` doesn't collapse the row), then verifies +
  rewrites the cache after segments load. First-ever read of a
  brand-new chaptered book still has one small shift when the title
  resolves; every subsequent mount, including language switches, is
  stable from frame one. Chapterless books reserve no space and keep
  the book title vertically centered against the time, as before.

### Added
- Catalog now prioritizes the user's stack languages. Book cards render
  every stack-matched language as an accent pill + a "+N more" chip for
  the non-stack remainder (or a "N languages" count chip when there's
  zero overlap), so a stack of 5–15 stays fully visible. Book-detail
  pages split narrations into "Your languages" / "More languages" with
  the long tail behind a "Show all N languages" expander, and narrator
  profiles accent stack pills while collapsing the rest. Same data —
  but a 50-language book is now skimmable for the languages you
  actually care about.

## [0.6.3] - 2026-05-13
### Added
- Anonymous analytics: `segment_play` event with `segment_index` fires
  on auto-advance during active playback. Replaces wall-clock
  `duration_ms` as the engagement metric — counts segments actually
  listened to, survives lock-screen background audio. (No
  `segment_play_one` here — Stargate has no tap-to-replay gesture.)

## [0.6.2] - 2026-05-10
### Changed
- Transport bar typography refreshed: book title (italic cyan, 13 px)
  stacks above a dainty chapter title (italic muted, 10 px,
  letter-spaced). Each line ellipses on its own, so the chapter can no
  longer collide with the time on the right.
- Compact language switcher pulled out of a wrapper and inserted
  directly above the chapter / scrub / controls inside the transport
  bar — the standalone book-title row above the pills is gone.

### Added
- `transportBar.setBookTitle()` on the shared transport API; the
  reader calls it after creating the transport so the book prefix
  renders next to the chapter span.

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
