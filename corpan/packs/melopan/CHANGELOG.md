# Changelog — Melopan pack

Make music in any language. Lightweight offline DAW pack for corpan,
with the voice clones and multilingual phrase corpus as first-class
instruments.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).
Conventions: `corpan/CHANGELOGS.md`.

## [Unreleased]

## [0.1.3] - 2026-05-20

### Added
- On-screen debug strip below the footer showing the resolved
  `PACK_BASE_URL`, the constructed sample URL, and the load result
  (incl. error message). Temporary while we diagnose why voice samples
  still fall back to synth on device. Remove once playback is confirmed.

### Changed
- `voicePad.loadSample` now returns `{ ok, error? }` instead of `void`,
  so callers can surface load failures without scraping console logs.

## [0.1.2] - 2026-05-20

### Fixed
- Voice samples now actually load when the pack is hosted via
  `corpan-pack://`. Previously, the relative URL `voice-kit/{file}`
  resolved against the corpan-app host page's origin instead of the
  pack's own location, so every sample fetch 404'd and the voice pad
  silently fell back to synth-vox. App.tsx now resolves asset URLs
  against `script.dataset.corpGameBaseUrl` (set by the host), matching
  the pattern in hanzipan's `resolvePackBaseUrl()`.

### Changed
- Footer build label now reads the version from `manifest.json`
  instead of being hardcoded, so what you see is what's actually running.

## [0.1.1] - 2026-05-20

### Changed
- Voice kit shipped as 16-bit PCM WAV at 24 kHz mono (down from Opus-in-OGG,
  which iOS < 17 WebKit cannot decode). Total kit ~500 KB; final zip ~1 MB.

## [0.1.0] - 2026-05-20

### Added
- Initial scaffold (React + TypeScript + Vite + Tone.js).
- Transport bar: BPM, time signature, play/stop, master volume.
- Four-track 16-step sequencer with synth kick, snare, hi-hat, and a
  synth-vox voice pad.
- Three swappable color skins (Earthgate / Stargate / Hover Runner),
  toggled in-pack and persisted in localStorage.
- Default project that plays a 4-on-the-floor beat with voice on
  beat 1 the moment the pack opens.
- IndexedDB project save/load (single slot for now).
- `scripts/generate-voice-kit.py` — one-shot Chatterbox renderer for
  the ~76-word elemental voice kit in Ian and Flo.
- `THIRD_PARTY.md` license log.
