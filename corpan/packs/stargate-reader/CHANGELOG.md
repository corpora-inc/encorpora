# Changelog — Stargate Reader pack

Immersive 3D audiobook: words stream through space in sync with narrated
audio. Distributed as a Corpán pack (manifest + zip via the
`encorpora.io` catalog).

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).
Conventions: `corpan/CHANGELOGS.md`.

## [Unreleased]

## [0.7.3] - 2026-06-23

### Fixed
- **No more click/pop when scrubbing or switching narration language.**
  Seeking and language switches cut the playing source off mid-waveform and
  started the new one at full amplitude, producing an audible click. The audio
  engine now gives each source its own gain envelope: the outgoing source fades
  to silence before it stops and the incoming source ramps up from zero, so
  there is never a hard discontinuity on seek or language switch.
- **Book owners now download the full narration, not the preview.** Two-ZIP
  premium entries signed the full ZIP only for Corpán Plus subscribers; a
  one-time book owner without Plus got the truncated preview and the upgrade
  layer never replaced it. The two-ZIP install now resolves a book-purchase
  receipt (then falls back to a subscription) and signs the full ZIP under the
  owned book's product id; the row also advertises the full size to owners.
- **End-of-book "read next" suggestion now appears for restored-library
  readers.** Opening an installed book from the restored library and finishing
  it without ever opening the drawer left the catalog unfetched, so the
  suggestion silently no-op'd; the `corpan:book-finished` handler now
  lazy-hydrates the catalog before choosing the next book.
- **End-of-book "Up next" no longer loops between two books (#381).**
  `chooseNextBook` now reads on-device reading history (the progress store) and
  never re-suggests the just-finished or any completed book, deprioritizes
  recently-read / in-progress titles, and randomizes across the newest few
  eligible candidates — so finishing book A then book B can't ping-pong back to
  A. Near-term anti-loop heuristic; superseded by the data-driven engine (#380).

## [0.7.2] - 2026-06-19

### Added
- **End-of-book "read next" suggestion.** When a full book reaches its end
  (subscriber/owned path — a truncated free preview still offers Plus instead),
  a tasteful overlay suggests the next book to read: the next volume in the same
  series when available, otherwise the newest other title you can play in the
  current language. "Read next" installs + opens it; "Browse books" opens the
  catalog; × dismisses. The reader signals end-of-book via a new
  `corpan:book-finished` window event; the app shell (which owns the catalog)
  picks the next book and renders the suggestion. Next-book selection lives in
  the shared catalog module (`chooseNextBook`).
- **Seamless preview→full upgrade after subscribing to Corpán Plus.** The app
  shell now upgrades installed preview narrations to the full versions in place
  (no manual reinstall). The book open at the end-of-preview paywall upgrades the
  instant you subscribe and the reader reloads + resumes from where the preview
  cut off, auto-continuing into the full audio; the background sweep of other
  previews runs only on confirmed-unmetered connections (otherwise it defers and
  the just-in-time on-open upgrade covers it); opening any preview while Plus
  upgrades it on access. The
  reader exposes `persistBookmark` so the reload resumes at the exact position.

### Fixed
- **Pulse Ring trail/fade regression.** Visualization rings lingered at full
  opacity and only vanished when their slot was reused by a new ring; the
  Settings → Pulse Ring → "Trail" slider had no visible effect. Cause: the
  Babylon 9 upgrade (deps bump from `@babylonjs/core` 6.x → 9.x) made
  `LinesMesh` alpha blending opt-in — without `useVertexAlpha` the per-ring
  `alpha` is ignored at the blend stage, so the time-based fade math (which was
  correct all along) never showed. The ring meshes are now created with
  `useVertexAlpha: true`, so rings fade smoothly and the Trail setting again
  controls how long they persist (low = quick fade, high = long trail).
- Browse → Latest|Title|Series tabs: the selected tab now stays
  high-contrast when it also has keyboard focus (previously the text could
  render low-contrast against the accent fill), and its focus ring is drawn
  in the page colour so it remains visible over the accent background.
- **Word-stream micro-jitter when a new word/phrase enters view.** Glyph
  rasterization (drawing text onto a 512×384 DynamicTexture and uploading it to
  the GPU) is the heaviest synchronous step in the renderer. When several words
  crossed into the look-ahead range in the same frame (dense phrase, or right
  after a seek/swipe) they were all rasterized at once, occasionally causing a
  one-frame hitch. New words are now prepared with a small per-frame budget
  while they are still fully transparent in the far approach zone (they have a
  long invisible runway before they must be legible); words at/inside the
  fade-in zone still rasterize immediately. Output is visually identical — only
  fully-transparent far words are deferred, and never shown stale. No change to
  audio timing or sync. (`src/rendering/wordStream.ts`)

## [0.7.1] - 2026-06-16

### Changed
- Default **Word Hold "Depth"** (the z-pull that floats the current word
  toward the viewer when it holds) raised from 0.4 to 1.5 for a stronger,
  more legible hold. Adjustable in Settings → Word Hold → Depth.

## [0.7.0] - 2026-06-16 — First-run seed: instant book in your stack languages

### Added
- **First-run "instant wow" seed.** When a brand-new user lands here from
  onboarding (the host passes a `seedBookId` on launch) and has nothing
  installed, the reader auto-downloads the FREE preview narrations of that book
  (the Biomes "Tropical Rainforest") for every language in the user's stack —
  the **primary (languages[0]) FIRST** so it opens ready to play, then the rest
  in the **background** (the language switcher refreshes as each lands). Preview
  ZIPs are public, so this works for non-subscribers. Falls back to the normal
  browse onboarding if the seed book/narrations aren't available. (Implemented in
  the shared reader shell, `@shared/catalog` `appShell` `seedFirstBook`.)
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
- Upgraded Babylon.js **6.48 → 9.11** (latest stable). No source changes
  required; build clean. (Pre-existing `WaveformConfig` type-cast warnings
  in `game.ts`/`settingsPanel.ts` are unrelated and untouched.)
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
  earthgate-reader too.)

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
