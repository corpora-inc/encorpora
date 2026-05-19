# Changelog — Rasmapan pack

Arabic-writing studio for Corpán: alphabet-onboarding lessons,
positional-form letter tracing, lam-alif ligature, common-word
tracing, classical-calligraphy notes. Sister to Hanzipan.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).
Conventions: `corpan/CHANGELOGS.md`.

## [Unreleased]

### Added
- **Positional-form stroke-order animations** — every glyph
  variant the user sees in rasmapan (isolated / initial / medial
  / final) now gets its own real Calliar-derived animation when
  data exists. Position is inferred per Calliar stroke by
  classifying its primitive neighbors (dots skipped) against the
  Arabic connect-before / connect-after rules. 94 of the 100
  glyph rows now ship with `scoring: "median"` and real
  trajectories; the remaining 6 are positional Taa/DHaa (need
  more elaborate pair-extraction we defer).
- **Word-mode stroke-order animation** — tap Play on a 2-4 letter
  word and the pen tip traces every letter RTL in turn. Each
  letter's strokes are projected onto its slot transform from
  `WordTraceLayer._layoutSlots()` (factored out of the existing
  redraw). Letters whose writers lack real medians are silently
  skipped without a fake animation.
- **Multi-writer variant chip** — small "three-dots" icon next
  to the Play button. Click to cycle through 3 alternative
  trajectories per letter (different Arabic calligraphers'
  interpretations of the same primitive, picked at the 25 / 50 /
  75 percentile of the aspect-ratio distribution). Hidden when
  the current letter has no variants (e.g. composite Taa/DHaa
  or rare primitives with too-sparse Calliar samples). 25/28
  letters carry full variant sets.
- **Bismillah lesson** (intro lesson 11, type `phrase`): a "Your
  first phrase" card capping the intro flow. The 23-stroke
  trajectory for "بسم الله الرحمن الرحيم" is lifted from
  Calliar's 54 matching recordings — pick is the median sample
  by total path length. Animation auto-plays on entering the
  card; a Play button replays the full 23-stroke sequence with
  TTS in parallel. Title + body translated into all 51 corpan
  locales.
- Build-side extractor: `build/extract_calliar_bismillah.py`
  produces `build/seed/phrases_seed.json`. Lesson merge:
  `build/add_bismillah_lesson.py` appends the lesson to
  `lessons_seed.json` with all i18n.
- **Public-domain Wikimedia sample images** for the four
  calligraphic-style cards (Naskh / Thuluth / Diwani / Kufic) —
  resized to ≤ 800 px, ~480 KB combined. Replaces the
  broken-image-icon fallback to the textual "بسم الله".
  Attributions in `LICENSES.md`.
- **Stroke-order animation** for all 28 isolated-form letters,
  played on the existing fx canvas when the user taps the Play /
  Speak button (alongside TTS). A glowing pen tip traces each
  stroke in classical Naskh order; a soft sepia trail builds up
  behind it. Dots get a halo-and-core pulse.
- **Calliar (MIT, https://github.com/ARBML/Calliar)** as the
  upstream source of stroke trajectories. Build-side extractor
  (`build/extract_calliar_strokes.py`) groups Calliar strokes by
  primitive (alif, ٮ-bowl, ح-base, ر, د, س, ص, ع, ٯ, ل, م, ه,
  و, ى, ں, ﻛ, ﺻ, plus dots), picks the cleanest per primitive
  via aspect-ratio bands + path-length sanity + lowest tortuosity,
  normalizes direction per classical Naskh convention, and
  composes all 28 letters from those primitives + dot-placement
  rules. Two-primitive composites (Taa ط, DHaa ظ) lift adjacent
  Calliar stroke pairs to preserve stem/base spatial geometry.
- Visual audit tooling at `build/audit_strokes.py` (renders SVGs
  and a 28-letter grid; output gitignored).
- `LICENSES.md` documenting Amiri (SIL OFL 1.1) and Calliar (MIT)
  attributions.

### Changed
- `playStrokeOrder()` in `src/trace.js` is gated by
  `writer.scoring === "median"` — positional forms (initial /
  medial / final) without explicit Calliar overrides skip
  animation, so the feature never shows fake/auto-derived
  stroke order. Tracing still works at all positions via the
  permissive outline scorer.
- Builder default scoring restored to `"outline"`; only letters
  with Calliar-derived overrides ship with `"median"` scoring.

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
