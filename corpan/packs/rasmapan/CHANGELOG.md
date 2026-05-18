# Changelog — Rasmapan pack

Arabic-writing studio for Corpán: alphabet-onboarding lessons,
positional-form letter tracing, lam-alif ligature, common-word
tracing, classical-calligraphy notes. Sister to Hanzipan.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).
Conventions: `corpan/CHANGELOGS.md`.

## [Unreleased]

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
