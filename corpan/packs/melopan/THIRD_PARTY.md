# Third-Party Code & Assets

Every dependency and lifted snippet in melopan is logged here with its
license. Verify the actual LICENSE file in source before adding new
entries. Acceptable: MIT, BSD-2/3, Apache-2.0, ISC, Unlicense, CC0,
SIL OFL (fonts), MPL-2.0, 0BSD. Avoid: GPL, AGPL, CC BY-NC, source-
available, anything without a clear LICENSE.

## Runtime dependencies

| Package | Version | License | Source | Purpose |
|---|---|---|---|---|
| tone | ^15.1.22 | MIT | https://github.com/Tonejs/Tone.js | Audio engine: Transport, synths, sampler, effects |
| react | ^18.3.1 | MIT | https://github.com/facebook/react | UI framework |
| react-dom | ^18.3.1 | MIT | https://github.com/facebook/react | UI renderer |
| zustand | ^5.0.4 | MIT | https://github.com/pmndrs/zustand | State store |
| idb | ^8.0.0 | ISC | https://github.com/jakearchibald/idb | IndexedDB wrapper for project storage |

(Music theory: `tonal` (MIT) will be added in M2 when the piano roll lands.)

## Build dependencies

| Package | License | Source |
|---|---|---|
| vite | MIT | https://github.com/vitejs/vite |
| @vitejs/plugin-react | MIT | https://github.com/vitejs/vite-plugin-react |
| typescript | Apache-2.0 | https://github.com/microsoft/TypeScript |
| @types/react, @types/react-dom, @types/node | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped |

## Lifted snippets

(None yet. When lifting code, preserve the original copyright header and
add an entry here noting source repo, license, and file/lines.)

## Read-only inspiration (license-blocked, do not lift code)

- `andremichelle/openDAW` — AGPL-3.0 — Box data model patterns
- `gridsound/daw` — AGPL-3.0 — mature DAW feature surface
- `mxfng/drumhaus` — CC BY-NC-SA — animation clock tricks
- `kirie/StepSequencer`, `lukebertram/jsdj`, `theobourgeois/PianoRoll` — no LICENSE file, treat as all-rights-reserved

## Lift candidates for future milestones

| Project | License | Likely use |
|---|---|---|
| naomiaro/waveform-playlist | MIT | Slicer / timeline waveform |
| tigranpetrossian/klavier | MIT | Live keyboard widget |
| BeepBox | MIT | Visual/UX inspiration |
| @tonejs/midi | MIT | MIDI export |
| pitchy | 0BSD | Pitch detection for autotune |
| SoundTouchJS | MPL-2.0 | Formant-preserving pitch shift for autotune |
| VT323 font | SIL OFL | Pixel/lofi title and step numbers |

## Voice clones

The Ian / Flo / August / Kym / Sky / Victor reference WAVs are owned by
corpan. Voice-kit OGGs in `public/voice-kit/` are generated offline via
`scripts/generate-voice-kit.py` using the corpan Chatterbox pipeline
against those reference WAVs. Corpan owns the rendered output.
