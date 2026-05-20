# Changelog — Rasmapan pack

Arabic-writing studio for Corpán: alphabet-onboarding lessons,
positional-form letter tracing, lam-alif ligature, common-word
tracing, classical-calligraphy notes. Sister to Hanzipan.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).
Conventions: `corpan/CHANGELOGS.md`.

## [Unreleased]

## [0.4.6] - 2026-05-20 — Snappier swipe + Bismillah cleanup

### Changed
- **Swipe now fires on `pointermove`** instead of waiting for
  `pointerup`. The moment the user drags past the 32-px horizontal
  threshold with dominant horizontal motion, `navByDelta` runs.
  Feels snappier and avoids the mobile edge case where pointerup
  fires off the listener element.
- **All swipe listeners attach to `root`** (the .rasmapan-root div)
  — no more window-level fallback. Matches the lessons.js
  `_wireSwipe` pattern exactly, which the user confirmed works well.
- **Per-pointer state via Map** — multi-touch no longer mangles the
  primary gesture's start position.
- Swipe threshold lowered 36 → 32 px.

### Removed
- The obsolete second paragraph from the Bismillah lesson
  ("Tap the pen-tip below to watch a real calligrapher trace all
  23 strokes...") — stripped across all 51 locales in
  `build/seed/lessons_seed.json` via a programmatic pass. The
  Watch button + canvas were removed back in v0.4.0; the text is
  no longer relevant.

## [0.4.5] - 2026-05-20 — Stop overpainting the hole + wider swipe surface

### Fixed
- **Counter holes were still being filled by the per-stroke
  highlight** in v0.4.4. The combined-path + even-odd fill correctly
  subtracted the inner counter from the body, but the very next
  rendering step — the dirEnabled (guided-mode) "current contour
  highlight" — fills the current contour SOLID with the highlight
  color. For letters with counters (ه م ظ و ف ق ل etc.) on the
  first render, strokeIndex=0 points at the body contour; filling
  the body solid painted right over the hole. v0.4.5 changes the
  highlight to `ctx.clip(target.path2d, "evenodd")` followed by
  `ctx.fill(this.outlineCombined, "evenodd")` — restricts rendering
  to the target contour's area but uses the combined path so
  counters STILL subtract within the highlighted region.
- **Swipe filter was too aggressive** in v0.4.4. The
  `.examples-list` / `.examples-panel` exclusions covered most of
  the lower-screen on portrait phones, leaving very little
  swipeable area below the hero. v0.4.5 drops those from the
  filter — the examples panel scrolls vertically, so horizontal
  swipe there doesn't conflict with its own gesture.
- Swipe threshold lowered from 48 px → 36 px so quick swipes
  register more reliably.

### Why v0.4.4 didn't show as different on device
- The bundle DID contain the v0.4.4 changes (verified by
  decompressing the GH release zip). The hole-subtraction code was
  running correctly, but the highlight step (which always runs in
  the default dirEnabled=true state) was immediately overpainting
  the result. From the user's POV the letters looked identical to
  v0.4.3.

## [0.4.4] - 2026-05-20 — Counter holes + reliable word fit + global swipe

### Fixed
- **Letters with inner counter shapes** (ه م ظ و ف ق ل etc.) no
  longer render as solid blobs. The previous code called
  `ctx.fill(path, "evenodd")` separately on each contour, which
  painted the counter on top of the body. Now we combine ALL
  contours into a single `Path2D` via `addPath()` and call
  `ctx.fill()` ONCE with even-odd — counters subtract from the
  body fill so the visible holes stay empty.
- **Words no longer overflow on WebViews that under-report
  `actualBoundingBoxAscent/Descent`.** `fitArabicText` switched
  from the modern measureText metrics to an empirical
  `realH = fontPx * 1.6` multiplier — conservative upper bound for
  Amiri including marks above + descender below. Predictable across
  all Tauri WebKit / Blink builds at the cost of words being
  slightly smaller than optimal on engines where the modern metrics
  do work.
- **Swipe-to-advance now fires from anywhere on the main pack
  screen**, not just the hero card. Replaced the hero-only swipe
  with a root-level handler that filters out targets owning their
  own gestures (`.canvas-shell`, `.letter-picker`, `.examples-list`,
  `.examples-panel`, buttons/inputs). `pointerup` /
  `pointercancel` attach to `window` so a finger lifting off the
  app root still completes the swipe. 48 px threshold +
  dominant-axis check (same as the lessons swipe).

### Notes
- Direction-of-travel matches the nav arrows and lessons swipe:
  swipe left → next letter / word; swipe right → previous.
- Per-stroke contour highlight (`dirEnabled` mode) still works
  per-contour by design — points the user at which sub-shape to
  trace next.

## [0.4.3] - 2026-05-20 — Canvas-sizing fix (the actual root cause)

### Fixed
- **Canvas buffer no longer overshoots the visible trace area.**
  `DrawingEngine.resize()` was sizing the canvas buffer to the
  shell's bounding rect (`shellW × shellH`) and force-overriding
  the canvas-layer's CSS `width` / `height` to match. But the
  canvas-layer is positioned `inset: 12px` inside the shell's
  padding box, so the inline-width override extended the buffer
  **24 CSS px past the shell's `overflow: hidden` clip on the
  right and bottom**. Every centered glyph was visually shifted
  toward the lower-right, crossing the dashed border on those
  sides. The v0.4.1 and v0.4.2 margin changes were fixing the
  wrong problem.
- `resize()` now reads the canvas-layer's actual rendered rect
  via `getBoundingClientRect()` (the CSS-governed visible size)
  and sizes only the pixel buffer accordingly. Inline `style.width`
  / `style.height` overrides removed — CSS governs visible size.

### Effect on prior versions
- v0.4.2's margin formula (7% with 16-px floor + 0.90 word safety)
  becomes accurate. Letters and words now sit visually centered
  inside the dashed border with the intended margins.

## [0.4.2] - 2026-05-20 — Letters + words stay inside the dashed border

### Fixed
- **Letters no longer cross the dashed trace border.** The trace
  canvas has two visual edges: the actual canvas pixel-edge AND a
  dashed border drawn at `.canvas-shell::after { inset: 20px }`,
  which sits 8 CSS pixels inside the canvas pixel-edge. v0.4.1's
  4% margin was comparable to that 8 CSS px gap on small phones,
  so the bbox-fit glyph (correct against the canvas pixel-edge)
  appeared to cross the visible border. Switched to
  `max(min(w, h) * 0.07, 16)` — 7% padding with a hard 16 CSS px
  floor — so even on the narrowest phones the glyph stays well
  inside the dashed border. Tall letters (alif, laam) still span
  ~80% of canvas height.
- **Words no longer overflow either.** The Words ghost picked up
  the same `max(7%, 16px)` margin formula. On top of that,
  `fitArabicText` now applies a 0.90 safety multiplier to the
  computed font size to absorb `actualBoundingBoxAscent` /
  `Descent` under-reporting on some WebViews (a few WebKit/Blink
  builds return font-design metrics rather than per-string ink
  bounds, under-reporting Arabic nuqat ascent + descender extent).
  Words render ~10% smaller than v0.4.1 in exchange for guaranteed
  no-clip on every device.

### Changed
- The score-mask rasterizer (`rasterizeWordText`) inherits the
  0.90 safety multiplier automatically via the shared
  `fitArabicText` helper, so scoring stays aligned with what's
  rendered on screen.

## [0.4.1] - 2026-05-20 — Bigger glyphs, words-corpus, swipe nav

### Fixed
- **Word ghost no longer overflows the canvas.** v0.4.0 only checked
  `m.width` from `measureText`; tall words with dots above and below
  (ث, خبز) pushed past the assumed `0.7×innerH` font size and clipped
  top/bottom. v0.4.1 reads `actualBoundingBoxAscent` /
  `Descent` / `Left` / `Right` and scales by the tighter of width or
  height. Plus a `yOffset` shifts the EM-line midpoint so the actual
  ink center sits at the canvas midpoint regardless of asymmetric
  dots.
- **Letters fill the canvas.** `LetterTraceLayer` now reads
  `writer.bbox = [minX, minY, maxX, maxY]` and scales the glyph's
  REAL bounding box into the canvas with a 4% safety margin (was 8%
  on the full 0..1000 viewBox). Tall narrow letters (alif, laam)
  span nearly top-to-bottom; wide letters (baa, taa) span
  left-to-right. `_canvasToView` updated to match so scoring still
  aligns. Falls back to the legacy full-viewBox layout if a writer
  is missing a bbox.

### Added
- **Words mode now surfaces host-corpus Arabic phrases** below the
  40-word picker — same pattern as Letters mode's "Phrases from the
  corpus" section. When you select a word, the panel queries
  `hostApi.searchEntriesByText({ text: word.word })` and appends up
  to 20 matching corpus cards. Picker pills paint synchronously
  (no waiting on the corpus fetch); cards append once the fetch
  returns.
- **Swipe navigation on the hero card.** Mirrors the lessons swipe
  pattern: 48px horizontal threshold, dominant-axis check, ignores
  drags that start on buttons. Swipe left → next letter / word;
  swipe right → previous. Doesn't conflict with the brush canvas's
  `touch-action: none` or the letter-picker's horizontal scroll
  because it's attached only to `.hero-card`.
- `WordTraceLayer.getViewportSize()` — used by the score-me path so
  the offscreen word-text rasterizer matches the on-screen canvas
  aspect (16:7 in Words mode), keeping scoring aligned with what the
  user sees.

### Changed
- `scoring.js` `scoreFreeDrawing` now accepts a target with optional
  `width` / `height` for word-text targets, scaling the recall
  tolerance proportionally so a short word's canvas uses the same
  fraction of canvas height for the "pen passes near here" check
  as the 1000×1000 letter case.
- Shared `fitArabicText(ctx, text, innerW, innerH)` helper exported
  from `scoring.js` and reused by `trace.js`'s WordTraceLayer —
  single source of truth for Arabic text fitting.

## [0.4.0] - 2026-05-20 — Shippable cut: beautiful Words ghost

### Removed
- **Calligraphy mode tab** + its 1642-recording gallery, filter chips,
  calligrapher canvas panel. Even with v0.3.1's polish (slower
  playback, smoothed quadratic curves, finished-frame default), raw
  Calliar handwriting samples didn't feel like calligraphy — the
  surface promised more than the data could deliver. The build
  pipeline (`build/extract_calliar_words.py`) and DB schema can be
  reused later; for v0.4 the table + data are dropped so the pack
  zip stays small.
- **Bismillah Watch button + inline calligrapher canvas**. The
  phrase lesson is now strictly TTS-only; the Amiri-rendered phrase
  text is already large and beautiful via the existing
  `.lesson-phrase-text` styling.
- `src/calligrapher.js` deleted; `src/calligrapher.css` deleted (the
  `.score-banner` block moved into `src/styles.css`).
- `arabic_calliar_recording` table dropped from
  `build/build_arabic_pack.py`. DB size drops from ~21 MB back to
  ~1.4 MB; pack zip from ~7.5 MB back to ~1.2 MB.
- Locale keys `calligraphy.*` + `aria.watch_calligraphy` /
  `aria.replay` removed from `src/locales/en.json` + `ar.json`.

### Changed
- **Words mode ghost is now a single big Amiri-rendered word**.
  Replaced the per-letter-outline-in-slots layout with one
  `ctx.fillText` of the full Arabic string via the embedded Amiri
  webfont. Gets proper RTL shaping, contextual forms, ligatures, and
  kerning from the browser's text engine. Centered, sized to fill
  the canvas with a 6% margin. Waits for `document.fonts.load("Amiri")`
  before first paint and redraws once the woff2 lands — handles the
  font-race cleanly on iOS / iPadOS / Android.
- **"Score me" now works in Words mode** too. `scoreFreeDrawing`
  generalized to accept either a writer record (letters) or a
  `WordTextTarget { kind: "text", text }`. For the text case, the
  same precision + coverage metrics run against a rasterized
  `fillText` mask on a 1000×1000 offscreen canvas. Same banner UI.

### Added
- `WordTraceLayer.setWord(letters, text)` now takes the raw Arabic
  string as a second argument. `getText()` accessor returns the
  active text for scoring.

### What's left
- 28-letter alphabet × 4 positional forms (Letters mode trace +
  per-stroke + freedraw + score-me) — unchanged from v0.3.1.
- 40 hand-curated words (Words mode trace + score-me).
- Lam-alif ligature, classical-style notes, host-corpus phrase
  examples, TTS, 51-locale i18n, Android safe-area floor.
- 6-step intro lesson flow + Bismillah TTS-only phrase lesson.

## [0.3.1] - 2026-05-19 — Calligraphy polish + Android safe areas

### Fixed
- **Calligrapher card action buttons no longer cut off.** The canvas
  area now flexes to fill available card height instead of forcing a
  fixed 3:2 aspect ratio that pushed the Replay/Speak chips below the
  visible area on narrow viewports. Calligrapher-panel responsive
  heights tightened to clamp(280px, 36vh, 380px) on phone so the
  whole card + gallery list sit comfortably.
- **Android safe-area insets.** Android WebView often reports
  `env(safe-area-inset-*)` as 0 even when the system status bar
  overlaps WebView content. Pack-side fix: detect Android via UA and
  apply `max(env(...), <floor>)` for top (28px) / bottom (18px) /
  left+right (8px) so the close button, hero top, and bottom action
  chips never sit under the status bar or gesture inset. iOS keeps
  its real notch value via env() — only Android gets the floor.

### Changed
- **Calligraphy playback now starts on the finished frame**, with a
  big tappable Play overlay over the canvas. The raw Calliar
  recordings are unusual shapes for most learners, so the first thing
  the user sees is the legible end result. Tap Play (or the Replay
  chip) to watch the strokes drawn in order.
- **Smoother stroke rendering.** Calligrapher polylines now drawn
  with quadratic curves through point midpoints — softens the
  60-point arc-length recordings into flowing calligraphic strokes.
  Applied to both the live animation and the held final frame.
- **Slower default playback** — strokeMs bumped from 900 to 1400 so
  unfamiliar calligraphic strokes are followable by the eye.

### Added
- **Per-recording context lookup.** When the user selects a
  recording, the card now shows transliteration (from the curated 40
  words when matched) + a translation (from the host Arabic corpus
  via `hostApi.searchEntriesByText` matching whole-phrase). Both rows
  hide when no match is found. Covers a meaningful slice of the 1642
  recordings — especially common phrases like بسم الله, سلام,
  الله الرحمن الرحيم that appear in both Calliar and the corpus.

## [0.3.0] - 2026-05-19 — "Score me" free-drawing scoring

### Added
- **"Score me" toolbar button** in Letters mode. After the user has
  drawn anything on the canvas (in trace-over-ghost mode or
  free-draw mode), tapping the check chip computes a shape-similarity
  score against the target letter's outline and shows a transient
  banner overlay with `{percent}% — {feedback}`. Auto-hides after
  ~4 seconds.
- **`scoreFreeDrawing(userStrokesView, writer)`** in
  `src/scoring.js`. Two-metric shape similarity:
  - **precision**: fraction of user points that land inside the
    outline polygon (via Path2D + `isPointInPath` on a hidden
    1000×1000 offscreen canvas).
  - **coverage**: fraction of probe points sampled along the outline
    edge that have a user point within 90 viewBox units. Punishes
    "scribble in one corner."
  - Quality = 0.6·coverage + 0.4·precision. Maps to a banner tone
    (`great` / `good` / `ok` / `low`) and a feedback string.
- Locale keys `score.*` for the four feedback strings + the
  "draw_to_score" / "letters_only" prompts.

### Notes
- Pure geometric scoring — no model, no native shim, fully offline.
- Word and Calligraphy modes don't run the scorer in v0.3; the
  letter-shape comparison is the simplest unit and the easiest to
  interpret. Word-level scoring is a v0.4 follow-up if useful.
- The score chip lives next to the Clear chip in the canvas toolbar.

### Future work
- Calligrapher-trajectory-based DTW scoring (compare the user's
  stroke order against a matched Calliar recording when one exists).
- A future Corpan-core `hostApi.recognizeHandwriting(strokes, lang)`
  shim (bridging ML Kit Digital Ink + Apple Vision/PencilKit) would
  unlock true Arabic handwriting recognition; the pack would swap
  the geometric scorer for the recognition call when available.

## [0.2.0] - 2026-05-19 — Calligraphy gallery + Bismillah watch

### Added
- **Calligraphy mode tab.** A new top-level mode alongside Letters
  and Words. Browses **1642 Calliar recordings** — real Arabic-
  speaking calligraphers' word and sentence handwriting — grouped
  by category (4 letters, 561 words, 888 phrases, 189 sentences).
  Tap any pill to mount a "watch a calligrapher write this" canvas
  that plays back the recording stroke-by-stroke with proportional
  timing and one color per stroke.
- **Bismillah lesson Watch button.** The Bismillah intro lesson
  gains a Watch action next to the existing TTS Play button. Tapping
  Watch mounts a CalligrapherCanvas inline below the phrase, using
  one of the 54 Bismillah recordings in the Calliar dataset.
- **CalligrapherCanvas** (`src/calligrapher.js`) — new module. Plays
  Calliar's native (x,y) stroke arrays on a 2D canvas in their
  native ~100-600px tablet coord space (no font mask, no bbox
  fitting). Mirrors Calliar's upstream `vis.py` renderer and
  arbml.github.io/Calliar's web demo.
- **`build/extract_calliar_words.py`** — extracts every Calliar
  sample (train/valid/test), normalizes Arabic text for matching
  (NFKC, diacritics + tatweel stripped, whitespace collapsed),
  picks one canonical recording per unique text, arc-length
  resamples each stroke to at most 60 points, rounds to 2 decimals,
  and writes `vendor/calliar_recordings.json` (~17 MB).
- **DB table `arabic_calliar_recording`** — populated by the build.
  Indexed on `arabic_text_norm` so any lesson, word, or corpus
  phrase can be matched against a recording at runtime in O(1).
- **Locale keys.** New `calligraphy.*` keys in `src/locales/en.json`
  and `src/locales/ar.json` for the filter chips, gallery hint,
  and Watch button label. Other locales fall back to English via
  the existing i18n pipeline.

### Changed
- Pack DB grows from ~5 MB to ~21 MB to accommodate the 1642
  Calliar recordings. Zip artifact ~6-8 MB. Acceptable tradeoff for
  the depth of content unlocked.
- Mode tabs now wrap three entries: Letters / Words / Calligraphy.
- Workspace layout adds a third panel variant
  (`.workspace.mode-calligraphy .calligrapher-panel`) that slots
  into the same grid column as the trace canvas, swapping in and
  out based on the active mode.

### Future work
- v0.3: free-hand "your turn" canvas with geometric similarity
  scoring (next release).
- v0.4: surface Calliar Watch buttons on the 40 curated words
  panel and on host-corpus Arabic phrases when a matching recording
  exists. Coverage is patchy (4/40 curated words match) so this is
  a polish pass rather than a primary surface.
- Playwright visual audit (deferred from this release — the gallery
  + Bismillah are visually verifiable on device).

## [0.1.1] - 2026-05-19 — Ship clean: animation removed

### Removed
- **Per-letter stroke-order animation.** Five iterations on letter-
  level animation (raw Calliar primitives, outline-edge walk, then
  outline-masked Calliar) all produced visually wrong traces — pens
  that ran along the top edge of a bowl instead of the centerline,
  pens that extended outside the visible glyph, two composite
  letters (Taa ط, DHaa ظ) with no animation at all. Showing a wrong
  stroke order is worse than showing none. Removed the
  `playStrokeOrder` invocation from the letter Play / Replay
  toolbar buttons (`src/main.js`); the buttons now play TTS only,
  matching the Bismillah lesson's behavior. The trace.js
  animation methods are intentionally kept in place so a future
  Calligrapher-watch surface (planned v0.2) can re-wire them.
- The "see other writers" variant chip — variant cycling no longer
  has a use without the per-letter animation. Chip is permanently
  hidden; handler removed.

### Retained from build work
- The outline-masked Calliar median build pipeline
  (`build/calliar_outline_masking.py`, `build/masked_medians.py`)
  is kept and still populates `writer.medians` in the DB. The
  medians remain useful as a target trajectory for the v0.3
  free-hand scoring surface (geometric similarity vs. the masked
  Calliar centerline). They're just no longer animated as a
  preview.
- `AmiriExtractor` exposes flattened polygons per contour via
  `GlyphData.polygons` (used by the masking pipeline and by future
  geometric scoring).
- Build dependencies: `numpy`, `shapely`, `scipy` in
  `build/requirements.txt`. Build runs under Python 3.11.

### Added
- `FlattenPen` (BasePen subclass) in `build_arabic_pack.py` —
  captures glyph outlines as flattened polygons with automatic
  composite-glyph decomposition (Bezier curves sampled at 14
  parametric steps).
- `polygon_area` helper — shoelace formula, used to sort
  flattened polygons so the largest contour (the letter body)
  comes first.
- Public-domain Wikimedia sample images for the four calligraphic-
  style cards (Naskh / Thuluth / Diwani / Kufic). Attributions in
  `LICENSES.md`.

### Future work
- **v0.2 Calligrapher-watch surface.** Replace the per-letter
  animation idea with a "watch a calligrapher write this word"
  canvas that consumes Calliar's word and sentence recordings in
  their native coord system (no font mask, no bbox fit). Mirrors
  Calliar's own renderer pattern (`vendor/calliar/vis.py`,
  arbml.github.io/Calliar). Surfaces on the 40 common words,
  Bismillah, and matched host-corpus Arabic phrases.
- **v0.3 Free-hand "your turn" canvas.** User draws over a target
  outline; score via geometric similarity (IoU / Hausdorff / DTW
  against the Calliar trajectory when available).
- **Future Corpan-core ask.** True handwriting recognition needs
  the host to expose `hostApi.recognizeHandwriting(strokes, lang)`
  bridging Google ML Kit Digital Ink (Android, Arabic supported,
  on-device) and Apple Vision / PencilKit (iOS). Per-pack
  recognition with TF.js / ONNX is infeasible today (200-400 MB
  models). Pack-side geometric scoring is the bridge until then.

## [0.1.0] - 2026-05-17 — First cut

### Added
- Six-step intro lesson flow (RTL direction → the abjad at a glance
  → four positional forms → harakat overview → sound-to-letter
  mapping → trace alif). Progress persists in localStorage.
- All 28 Arabic letters traceable in every form they take (4 forms
  for connecting letters, 2 for the six non-connectors alif/daal/
  dhaal/raa/zaay/waaw). Glyph outlines extracted from Amiri at
  build time; stroke-order medians authored per letter family.
- Lam-alif ligature in isolated and final forms.
- 40 curated 2–4-letter Arabic words for sentence-shaped tracing
  (RTL composition, sub-stroke ordering preserved per letter).
- Four classical-calligraphy notes cards (Naskh, Thuluth, Diwani,
  Kufic) with sample images and short descriptions of when/why
  each style is used.
- Corpan corpus integration: the examples panel surfaces Arabic
  phrases via `hostApi.searchEntriesByText({ languageCodes: ["ar"] })`.
- TTS hookup via `hostApi.speak("ar", text)` — silently fails on
  devices without an `ar` voice (matches Hanzipan's behavior for
  Mandarin).

### Theme
- Earthgate parchment + gold palette retained from Hanzipan.
- Amiri (SIL OFL 1.1) shipped as the Arabic display font; Georgia
  retained for UI text. `OFL.txt` bundled in the pack zip;
  `LICENSES.md` attributes Wikimedia Commons style-sample images.

### Build / tooling
- Same Vite library build as Hanzipan / world-radio /
  pronunciation-coach. New scripts: `npm run dev`,
  `npm run dev:corpan` (auto-rebuild + manifest devRevision bump +
  static server on `:8989`), `npm run build`, `npm run pack:all`.
- Python builder at `corpan/dja/arabic_pack/build_arabic_pack.py`
  uses `fontTools` to extract glyph outlines from Amiri and
  joins with hand-authored stroke-order seeds.
- Catalog entries marked `channel: "preview"` for v0.1.0; flips
  to `"stable"` when the upstream PR opens.
