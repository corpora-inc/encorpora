# Changelog — Rasmapan pack

Arabic-writing studio for Corpán: alphabet-onboarding lessons,
positional-form letter tracing, lam-alif ligature, common-word
tracing, classical-calligraphy notes. Sister to Hanzipan.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).
Conventions: `corpan/CHANGELOGS.md`.

## [Unreleased]

### Changed
- **Stroke-order medians now derived from the Amiri outline
  itself**, not from Calliar's recorded sentence trajectories.
  Each glyph's contours are flattened to polygons via a fontTools
  `BasePen`-derived `FlattenPen` (decomposes composites; samples
  Bezier curves at 14 parametric steps), then for each contour we
  walk one side of the polygon between two extreme vertices to
  produce a median polyline that *provably* traces the visible
  ghost outline:
  - Tall contours (height > 1.2 × width — alif, laam, kaaf, raa,
    waaw, miim, …) walk topmost → leftmost vertex along the
    higher-mean-X edge. That's the right side of the spine,
    sweeping into any hook or tail tip on the left.
  - Wide / square contours (baa-bowl, siin teeth, haa-body, dots,
    accents) walk rightmost → leftmost vertex along the
    lower-mean-Y edge. That's the upper silhouette, matching the
    natural RTL start of an Arabic calligrapher's bowl.
  Polylines are arc-length-resampled to 28 evenly-spaced points
  so the runtime animation is smooth regardless of how many
  Bezier samples each contour produced. Visual audit grid at
  `build/calliar_stroke_audit.svg` confirms every letter's median
  hugs its outline.
- Calliar-derived stroke trajectories are no longer the source of
  truth for animation. The Calliar samples (recorded from real
  calligraphers' sentences) carry trailing connecting strokes
  that bleed out of the canonical isolated-letter shape — e.g.
  baa's bowl trajectory ended inside the dot region because the
  writer was mid-word. The outline-derived medians don't have
  that artifact: they come from the *same* font geometry the user
  sees on screen. The override path in `build_glyph_record` still
  loads `stroke_orders_seed.json` but ignores the data — kept as
  dead plumbing in case we revive Calliar-based medians later.
- Every letter writer now ships `scoring: "median"` (was: only
  letters with Calliar overrides). All 28 letters animate when
  the user taps Play/Speak.
- Multi-writer variant chip — the cycle button next to Play —
  auto-hides for every letter now that there are no variants.
  The DOM and JS plumbing stay in place; the chip is gated by
  `traceLayer.variantCount() > 0`, which is always 0 since the
  outline-derived approach yields a single canonical median per
  contour.
- Bismillah phrase lesson no longer animates the Calliar
  full-phrase trajectory. The 23 strokes packed into a 4:1
  canvas produced visually unreadable overlap (per user feedback
  in 2026-05-19). The lesson keeps its phrase text +
  transliteration + translation; the Play button now plays TTS
  only, matching the rest of the app.

### Added
- **`FlattenPen`** in `build/build_arabic_pack.py` — a fontTools
  `BasePen` subclass that captures glyph outlines as flattened
  polygons. Automatic composite-glyph decomposition (Amiri uses
  components for some accent marks) via `BasePen.addComponent`.
- **`derive_median_from_polygon`** in the same module — walks a
  polygon between two extreme vertices (chosen by the tall/wide
  heuristic above) and arc-length-resamples the result to a
  uniform polyline.
- **`polygon_area`** helper — shoelace formula, used to sort
  flattened polygons by area so the median order matches the
  outline-contour render order (largest = main body first, then
  dots, matching Arabic writing convention).
- **`LICENSES.md` retained** documenting Amiri (SIL OFL 1.1) and
  Calliar (MIT) attributions — Calliar is still credited even
  though we no longer ship its stroke trajectories at runtime,
  since the extraction-and-curation pipeline using it remains in
  the repo for potential future use.
- **Public-domain Wikimedia sample images** for the four
  calligraphic-style cards (Naskh / Thuluth / Diwani / Kufic) —
  resized to ≤ 800 px, ~480 KB combined. Attributions in
  `LICENSES.md`.

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
