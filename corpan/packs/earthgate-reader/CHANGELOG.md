# Changelog — Earthgate Reader pack

Calm, earth-toned audiobook reader with word-level highlighting synced
to narrated audio. Distributed as a Corpán pack (manifest +
zip via the `encorpora.io` catalog).

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).
Conventions: `corpan/CHANGELOGS.md`.

## [Unreleased]

## [0.7.1] - 2026-06-19

### Added
- **Seamless preview→full upgrade after subscribing to Corpán Plus.** The app
  shell now upgrades installed preview narrations to the full versions in place
  (no manual reinstall). The book open at the end-of-preview paywall upgrades the
  instant you subscribe and the reader reloads + resumes from where the preview
  cut off, auto-continuing into the full audio; the background sweep of other
  previews runs only on confirmed-unmetered connections (otherwise it defers and
  the just-in-time on-open upgrade covers it); opening any preview while Plus
  upgrades it on access. The
  reader exposes `persistBookmark` so the reload resumes at the exact position.

## [0.7.0] - 2026-06-16 — First-run seed: instant book in your stack languages

### Added
- **First-run "instant wow" seed.** When a brand-new user lands here from
  onboarding (the host passes a `seedBookId` on launch) and has nothing
  installed, the reader auto-downloads the FREE preview narrations of that book
  (the Biomes "Tropical Rainforest") for every language in the user's stack —
  the **primary (languages[0]) FIRST** so it opens ready to play, then the rest
  in the **background** (the language switcher refreshes as each lands, so they
  can flip between their stack languages the moment each is ready). Preview ZIPs
  are public, so this works for non-subscribers. Falls back to the normal browse
  onboarding if the seed book/narrations aren't available. (Implemented in the
  shared reader shell, `@shared/catalog` `appShell` `seedFirstBook`.)
### Added
- Catalog browse now has **compact and expanded views** with a clean
  toggle. Compact (the new default) is a dense, scannable list — small
  cover thumb + title + series/author caption + language badges per row
  (Apple Books / Audible style) — that flows to 2 columns on tablet and
  3 on desktop. Expanded keeps the large-cover series grid. The choice
  persists per reader (`corpan-catalog-view:<readerId>`).
- A **sort control** (Latest / Title / Series). "Latest" orders by
  `publishedAt` descending so a returning reader finds new additions at
  a glance; choice persists (`corpan-catalog-sort:<readerId>`).
### Changed
- Books within a series now honor an **explicit order**: `volume` (a
  series index) first, then publish date front-to-back, then title — so
  multi-volume series read in reading order rather than by narration
  count. (`@shared/catalog` `groupBySeries` / `sortBooksWithinSeries`.)
- Dated periodicals (e.g. "AI This Week") list newest-first across the
  catalog when sorted by Latest.
- Downloading a narration from the **Now Playing** surface now selects
  it (makes it the active narration), matching the language-pill flow.
### Fixed
- The catalog fetch parser was silently dropping `publishedAt` from
  narration and book rows, so "Latest" sort and newest-first periodical
  ordering had nothing to sort on. Carry it through. (Applies to
  stargate-reader too.)

## [0.6.7] - 2026-05-30
### Fixed
- Corpán Plus preview/premium now actually works. The shared catalog
  parser (`@shared/catalog` `parseNarration`) was silently dropping the
  two-ZIP fields (`preview`/`full`/`totalSegments`/`freeSegments`), so
  every entry looked legacy-only — `isTwoZipEntry()` was always false and
  every download fell back to the full legacy ZIP with no preview and no
  end-of-preview paywall. Carry the fields through. (Applies to
  stargate-reader too.)
### Changed
- Narration rows now show the size you'll actually download and tag it
  "Free preview" for non-subscribers on two-ZIP entries, so a long book's
  small preview no longer masquerades as the whole thing. (`@shared/catalog`.)
- End-of-preview paywall is now skinned to match the reader (warm
  earth/amber accent + background) via a `theme` hint on the
  `corpan:request-unlock` event. Requires Corpán ≥ 0.16.0; older hosts
  ignore the hint and show the default paywall.

## [0.6.6] - 2026-05-19
### Changed
- Catalog browser drawer now renders a calm "Browse needs internet"
  notice when the user cold-starts the pack offline with no cached
  catalog, instead of a misleading "No books match your search" empty
  state. Installed narrations are unaffected — they play offline via
  `corpan-pack://` as before. (Lives in `@shared/catalog`, applies to
  stargate-reader too.)

## [0.6.5] - 2026-05-18
### Fixed
- Chapter title no longer flickers a stale placeholder when switching
  languages. The shared transport bar used to initialize the chapter
  span to `"Loading…"`; on every language switch `mountReader()`
  creates a fresh transport, so that text was visible for the brief
  window before the new segments resolved. Initial text is now empty
  and `.earthgate-chapter-title:empty` keeps the row collapsed until
  the reader has a real chapter to show (chapterless books stay
  collapsed forever, as intended).
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

## [0.6.3] - 2026-05-14
### Added
- Anonymous analytics: `segment_play` (auto-advance + active playback)
  and `segment_play_one` (tap-to-replay) events with `segment_index`.
  Replaces wall-clock `duration_ms` as the engagement metric — counts
  what's actually being listened to, survives lock-screen background
  audio, and the `segment_play_one : segment_play` ratio per session
  is the language-learning vs. audiobook signal.

### Changed
- Auto-scroll reading anchor 0.67 → 0.60 of the clean reading area —
  active word lands a touch closer to mid-frame, so the next line is
  visible sooner without losing the read-text trail above.
- Long-segment first-word start position lifted ~8px:
  `--pad-top` buffer 40 → 32 below `--eg-top-clearance`. The first
  line now sits a touch higher in the clean zone, giving the eye a
  little more room to read forward before the auto-scroll pulls
  the word down to its anchor.

### Fixed
- Transport bar no longer shrinks on first play for chapterless
  books. Root cause was two bugs compounding: the chapter title
  initialized to `"Ready"` as a status placeholder, then was
  cleared on first play when the audio engine's segment-change
  callback fired `setChapter("")`. Fix: never use `"Ready"` as a
  fallback (no fake chapter), and `.earthgate-chapter-title:empty`
  collapses cleanly (`display: none`) so the book title stays
  vertically centered against the time on the right.

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
