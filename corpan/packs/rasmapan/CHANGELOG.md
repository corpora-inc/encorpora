# Changelog — Rasmapan pack

Arabic-writing studio for Corpán: alphabet-onboarding lessons,
positional-form letter tracing, lam-alif ligature, common-word
tracing, classical-calligraphy notes. Sister to Hanzipan.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).
Conventions: `corpan/CHANGELOGS.md`.

## [Unreleased]

### Changed
- **Stroke-order medians now come from outline-masked Calliar
  trajectories.** This is the breakthrough we were chasing:
  - Calliar gives us authentic native-calligrapher pen paths
    (direction, curvature, natural timing) — recorded by real
    Arabic-speaking calligraphers across thousands of samples.
  - The Amiri font outline gives us the canonical isolated-letter
    boundary.
  - Combining them: per letter, every Calliar primitive candidate
    is aligned to the Amiri outline bbox (independent x/y scale so
    aspect-mismatched candidates still fit), tested point-by-point
    against the outline polygon via shapely, and the longest
    contiguous in-polygon run is kept as the median. The candidate
    with the highest in-polygon coverage wins, then it's smoothed
    (Savitzky-Golay) and resampled to 24 evenly-spaced points.
  - Each median is oriented so its first point is the polygon
    vertex closest to the bbox top-right corner — the natural RTL
    starting position a calligrapher's pen drops at.
  - Solves both prior failure modes: Calliar's trailing connecting
    strokes get masked off, and the resulting median is a true
    centerline that the pen tip (4 CSS-px wide) can trace without
    leaving the visible glyph.
- New build modules:
  - `build/calliar_outline_masking.py` — alignment, masking via
    shapely Polygon.contains, smoothing via scipy Savitzky-Golay,
    arc-length resampling.
  - `build/masked_medians.py` — per-letter composer that wires
    the Calliar primitive recipe to the outline polygon and emits
    a body stroke + one stroke per dot contour.
- `AmiriExtractor` now exposes the flattened polygon per contour
  (in 0..1000 viewBox coords) via `GlyphData.polygons`, so the
  masking pipeline consumes the same geometry the runtime ghost
  fills.
- Build dependencies bumped: `numpy`, `shapely`, `scipy` added
  to `build/requirements.txt`. Build must run under Python 3.11
  (homebrew Python 3.14 has a broken pyexpat).

### Removed
- The outline-edge walk (Phase C) — derived a median by tracing
  one side of each contour. Worked for narrow shapes like alif
  where the right edge ≈ the centerline; produced wrong
  directions and wrong shapes for everything else. Superseded by
  the masked-Calliar pipeline above.

- Multi-writer variant chip auto-hides — no per-letter variants
  in this pipeline (one canonical masked median per primitive).
- Bismillah phrase lesson canvas remains TTS-only for v0.1; the
  word-level masked-Calliar phrase animation is a v0.2 follow-up.

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
