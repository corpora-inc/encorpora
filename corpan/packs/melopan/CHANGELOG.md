# Changelog — Melopan pack

Make music in any language. Lightweight offline DAW pack for corpan,
with the voice clones and multilingual phrase corpus as first-class
instruments.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).
Conventions: `corpan/CHANGELOGS.md`.

## [Unreleased]

## [0.2.3] - 2026-05-25

### Changed
- **Unified step-count math across all signatures.** Picker options are
  now `{ top × 2ⁿ }` filtered to `[6, 64]`. 3/4 → [6, 12, 24, 48], 4/4 →
  [8, 16, 32, 64], 5/8 → [10, 20, 40], 11/4 or 11/8 → [11, 22, 44],
  13/4 or 13/8 → [13, 26, 52]. Same rule everywhere, musically clean.
- **Defaults bumped.** Each sig defaults to `top × 4`, which keeps
  4/4 → 16 and 3/4 → 12 but finally distinguishes 6/8 → 24 from 3/4 → 12.
- **Loop interval formula rewritten** to `(bottom × steps / top)n`,
  always a clean Tone subdivision for any valid combination.
- **Switching SIG preserves the resolution multiplier.** 4/4 @ 32 (×8)
  → 3/4 lands at 24 (also ×8) instead of resetting to the default.
- **3rd skin replaced with Juice Squeeze** — warm cream paper, deep
  teal, soft gold, warm orange accents (palette lifted from the
  juice-squeeze pack). Persisted `"hover-runner"` auto-migrates.

### Added
- **Time signatures: 2/4, 3/8, 5/8, 7/4, 10/4, 10/8, 12/8.**
- **Return-to-default button** is now a two-tap confirm (tap → button
  arms with `?` in accent color → tap again within 3 s to commit).
  Avoids `window.confirm()`, which silently fails inside the Tauri
  iOS webview.
- **Clear button on the beats grid** (matches the synth's Clear).
  Wipes all step patterns across kick/snare/hat/voice1/voice2 while
  preserving volumes, mutes, names, and pitches.

### Fixed / Tightened
- Track-label column shrunk from 110 px to 48 px and font from 18 px
  to 15 px so the cells column reclaims that space on phone widths.
  Long names ellipsis cleanly.
- Removed the redundant `(muted)` text from drum rows and the synth
  header — the existing Mute/Unmute button already conveys state.

## [0.2.2] - 2026-05-25

### Fixed
- **Smooth pitch / volume / edit tweaks while playing.** `setProject()` in
  the audio engine no longer reassigns `Tone.Loop.interval` on every store
  change — only when `timeSignature` or `lengthSteps` actually changed.
  Pre-fix, the pitch slider (a continuous-fire range input) would
  re-sequence the loop dozens of times per second during a drag, audibly
  glitching the kick/snare. Now interval reassignment is gated behind a
  local last-applied-value cache (`loopIntervalStr`), so live edits route
  straight to in-place node updates (`voicePad.setPitch` etc.).

### Added
- **Return-to-default button (↺).** In the top bar between the exit
  button and the brand. Prompts via `window.confirm` before wiping the
  active project back to the first-open state from `createDefaultProject()`.
  Preserves the user's chosen skin (skins are a preference, not pattern
  data). Writes through the same `persistDebounced` path as every other
  mutation, so the reset survives a reload.

## [0.2.1] - 2026-05-21

### Fixed
- **Hi-hat is now actually audible.** The MetalSynth-based hat in v0.2.0
  was still inaudible on phone speakers — high-Q metal partials are easy
  to lose. Replaced with a filtered-noise burst (white noise → 4 kHz HPF
  → 8.5 kHz bandpass) on a snappy AR envelope. Same pattern hover-runner
  uses for hits; reliably cuts through.
- **Cell rows no longer overlap the mute/volume slider.** At 5/4, 9/8,
  and especially the new 11/8 / 13/8 sigs the cells were colliding with
  the right-side controls. The row now lays out as a horizontal strip
  with the track label `position: sticky; left: 0` and the
  mute+volume column `position: sticky; right: 0`, while `.mp-grid-wrap`
  takes the horizontal scroll. Same treatment on the piano roll (the
  key label sticks left). Cells are a fixed 28 px each so the row width
  scales linearly with step count.

### Added
- **Time signatures: 11/8, 13/8, 11/4, 13/4.** The "additive meters"
  fit alongside the existing 3/4–9/8 set. Default step counts at 16ths:
  11/8=22, 13/8=26, 11/4=44, 13/4=52.
- **STEPS picker** next to SIG. Lets you double / quadruple the
  subdivision independently of the time signature — 4/4 at 16 = sixteenth
  notes, at 32 = thirty-seconds, at 64 = sixty-fourths. Options scale
  per signature (3/4: 12/24/48, 6/8: 12/24/48, 11/4: 44, …) and are
  capped at 96 cells to keep individual cells tappable on phone screens.
- The engine's Loop interval now recomputes from `intervalForSteps`
  whenever the project changes, so the playhead always covers exactly
  one bar regardless of step count.

## [0.2.0] - 2026-05-21 — Melopán

### Added
- **Name now reads "Melopán"** (acute accent on the final á) everywhere
  it's displayed — top brand and footer build label. Pack `id` stays
  `melopan` so file paths and the host SDK contract are unchanged.
- **BPM ± stepper.** No more mid-keystroke clamp to 40 / 240 — the
  input now holds a local draft and only commits on blur / Enter, with
  dedicated −/+ buttons for fine control.
- **Time signature actually changes the pattern length.** 3/4 = 12,
  4/4 = 16, 5/4 = 20, 6/8 = 12, 7/8 = 14, 9/8 = 18 (new). Step arrays
  for every track (drums, voice tracks, synth notes) resize on
  signature change — padding with rests when growing, truncating when
  shrinking.
- **Second voice track.** Each voice track now carries its own
  `voice` / `word` / `pitchSemis`, so two voices can layer in the
  sequencer. Track ids: `voice1`, `voice2`. Engine spins up a separate
  `VoicePad` per track; App.tsx loads samples for both and tracks blob
  URLs per track. Persisted projects from v0.1.x migrate cleanly via
  `migrateSchema1To2` — the old single voice pad becomes `voice1`,
  `voice2` ships empty for the user to fill.
- **Piano roll scale modulation.** Long-press a key label (480 ms) to
  open a ♭ / ♮ / ♯ popover that shifts that row's effective pitch by
  -1 / 0 / +1 semitones. Stored as `synth.accidentals`; applied at
  trigger time so changing the accidental retroactively shifts all
  notes on that row.
- **VS Code-style resizable panels.** Drag the bar between StepGrid /
  PianoRoll / Voice Pads to resize each section; heights persist in
  the project.

### Changed
- **Hi-hat audibility.** The hat was running −6 dB through the bus
  AND multiplied by 0.4 effective velocity, which on a phone speaker
  was inaudible. Bumped the bus to 0 dB, raised the effective velocity
  floor, added a 6 kHz high-pass for clarity, and bumped MetalSynth
  resonance / decay.
- **Voice pad layout.** Pitch slider is now the dominant full-width
  control on its own row; the standalone "▶ preview" button is gone
  (it didn't work for first-touch anyway — `decodeAudioData` needs
  Tone.start). Sample selection still happens through the sample
  browser, where tapping a card previews the sound.
- **Engine guarantees Tone.start() before every preview path.** Web
  Audio's context is suspended until a user gesture resumes it; the
  preview paths now `await Tone.start()` first, so previewing works
  even before the first Play tap.

### Migration
- Project schema bumped 1 → 2. Stored projects from v0.1.x auto-migrate
  on next load and the new shape is re-persisted, so this is a one-way
  trip — downgrading back to v0.1.x will refuse to load the schema-2
  payload and fall back to the default project.

## [0.1.7] - 2026-05-21

### Added
- `‹` exit button in the top bar. Click dispatches the `corpan:exit`
  CustomEvent the host listens for — same pattern as hover-runner and
  pronunciation-coach. No more closing the whole corpan-app to leave
  Melopan.

## [0.1.6] - 2026-05-21

### Removed
- On-screen debug strip (added in v0.1.3 to diagnose voice load
  failure). Voice playback confirmed working on iOS via the
  `__TAURI_INTERNALS__.invoke` + Blob URL path; the diagnostic is no
  longer needed.

## [0.1.5] - 2026-05-21

### Fixed
- v0.1.4's Tauri fetch path read `window.__TAURI__`, which doesn't
  exist in Tauri 2 (and isn't enabled by `withGlobalTauri` in the
  corpan-app config). The canonical global is
  `window.__TAURI_INTERNALS__.invoke` — same as
  `packs/shared/data/packFetch.ts`. Updated `packAssets.ts` to match,
  and to handle the platform variance in the returned bytes
  (Uint8Array / number[] / ArrayBuffer).

### Added
- Debug strip now includes a `via:` line showing which path was used
  (`tauri-bytes`, `direct`, or `no-tauri-fallback`) plus the byte
  count when applicable. Confirms the binary fetch actually engaged.

## [0.1.4] - 2026-05-20

### Fixed
- Voice samples actually play now. iOS WebKit blocks `fetch`/`XHR` from
  custom protocols, so `corpan-pack://localhost/melopan/dist/.../foo.wav`
  was returning `Load failed` to `Tone.ToneAudioBuffer` even though the
  URL was correct (v0.1.3's debug strip pinpointed this — the entry
  script loaded fine via `<script src>` but binary fetches died).

  New `src/sdk/packAssets.ts` calls the host's
  `content_packs_fetch_bytes` Tauri command (`lib.rs:595`) to read the
  asset as bytes, wraps them in a `Blob`, and hands Tone a Blob URL.
  Outside Tauri (vite dev) the URL is returned unchanged. Same workaround
  hanzipan uses for its `hanziwriter.min.js` load.

### Added
- Debug strip now shows `eff:` (the effective URL passed to the audio
  engine — either a `blob:` URL for the Tauri path, or the original URL
  in dev). Still temporary; will pull before v0.2.

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
