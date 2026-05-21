# Changelog — Melopan pack

Make music in any language. Lightweight offline DAW pack for corpan,
with the voice clones and multilingual phrase corpus as first-class
instruments.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).
Conventions: `corpan/CHANGELOGS.md`.

## [Unreleased]

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
