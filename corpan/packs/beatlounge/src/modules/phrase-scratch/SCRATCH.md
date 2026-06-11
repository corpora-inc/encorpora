# phrase-scratch — the real turntable

A hand-driven turntable for a single saved phrase. The founder's bar: **make the
record scratching as real as current technology allows.** This is a *position-based
scrub engine*, not a granular looper.

## The model: one wave, one read-head

A real record is ONE continuous wave read by ONE needle. The needle points at ONE
exact moment in the phrase; turning the disc moves that single read-head forward or
backward through the single buffer; the speed you turn = the (signed) playback rate.

- **No grains, no looping, no re-triggering, no voice spawning.** (The old
  `Tone.GrainPlayer` looper spawned overlapping grain voices — moving the disc a
  little played a word as ~5 garbled overlapping voices. Retired.)
- A fixed arc of vinyl = a fixed slice of time in the wave.

## The engine (`scratchEngine.ts` + `scratchProcessor.ts` + `scratchDsp.ts`)

### AudioWorklet processor — the heart
`scratchProcessor.ts` holds the source as a **string** and the engine loads it via a
**Blob URL** (`URL.createObjectURL(new Blob([src]))` → `audioWorklet.addModule(url)`),
because the pack ships as one bundled IIFE behind a proxy — there is no served
worklet file. The module is added **once per AudioContext** (guarded by a `WeakSet`),
after a user gesture (audio is gesture-gated via `ensureAudio`).

The processor holds the phrase's channel data (`Float32Array` per channel) + one
float `playhead` (sample index) and runs two control modes per render block:

- **Position mode (finger in contact):** the main thread posts the exact target
  buffer position (samples) the needle should be at, each animation frame. Each
  block advances `playhead` toward `target` *linearly* — per-sample increment =
  `(target − playhead) / blockSize` — reading the buffer with interpolation. The
  emergent per-sample rate **is** the finger's signed speed → real scratch, forward
  and reverse, with natural pitch change.
- **Inertia mode (released):** integrate `playhead += velocity` per sample with
  exponential friction decay so the disc coasts and the audio coasts with it; below
  a tiny `|velocity|` → silence (held record), and on reaching rest it posts a `rest`
  message so the main thread flips to idle.

Other invariants: silence when held (`idle`); `playhead` clamped to `[0, length]`
with **no wrap** (past the end is run-off silence, past the start is lead-in
silence); mono **and** stereo (mono copies to both output channels); a ~3 ms output
gain ramp at contact transitions for anti-click (interpolation kills most clicks).

**Interpolation:** Catmull-Rom (Hermite) cubic by default for lower aliasing,
selectable down to linear via a `config` message. Cubic is the frontier choice; it
is exact on a linear ramp and ~4 taps — cheap enough on a phrase buffer.

### Tested DSP twin (`scratchDsp.ts`)
The AudioWorklet wrapper can't be instantiated in vitest, so the **exact** sample-
read/advance math is extracted as pure functions (`linearSample`, `cubicSample`,
`renderPositionBlock`, `renderInertiaBlock`, `blockFriction`, `clampPlayhead`) that
both the test (`scratchDsp.test.ts`) and the inlined processor use. **Keep the
inlined processor math in lockstep with this file.**

### Fallback
If `audioWorklet` is unavailable or `addModule` throws, the engine degrades to a
`ScriptProcessorNode` running the **same** pure DSP (`renderPositionBlock` /
`renderInertiaBlock`), so scrubbing still works. If even that fails it returns a
dignified silent stub — the load never crashes.

## Disc → playhead mapping + the spiral (`scratchMath.ts`)

Disc rotation accumulates **without wrapping** (unwrapped radians). A fixed
`BUFFER_SECONDS_PER_REV ≈ 2s` maps one full revolution to a fixed slice of the
phrase (`rotationToPlayhead`), clamped to the phrase duration. So a phrase longer
than one revolution spans **multiple revolutions → the groove/label spirals inward**
per turn (`timeToSpiral`: angle accumulates 2π/rev, radius walks outer→inner across
the phrase), exactly like a real record. The needle/visual position and the audio
playhead target are the **same** mapped value → needle and sound are LOCKED.

The release-coast friction (`decayAngularVelocity`) is frame-rate independent and
snaps to rest below an epsilon; the visual rotation and audio inertia share the same
decayed velocity, so they never diverge.

## Needle + word positions (`Platter.tsx`, `wordTiming.ts`)

- A **fixed needle** points at the top; the disc rotates under it, so the moment
  under the needle is the current playhead. A readout shows the position (seconds)
  and the current word.
- Each word is placed along the spiral groove at its **real buffer-time range**
  (spiraling across revolutions), and highlighted when it is under the needle.

### Forced-alignment seam (Whisper hook — not built now)
`wordTiming.ts` consumes a `WordTiming[] = {text, startSec, endSec}` for the loaded
phrase. Precedence:

1. **Exact timings** (forced alignment) — used verbatim if provided.
2. **Silence split** (`splitWordsBySilence`) — when its detected word count matches
   the token count.
3. **Even distribution** by token count — the robust fallback.

Exact per-word timings are best produced by **forced alignment** (e.g. Whisper, à la
Parlometron). When the host exposes such a capability, pass its output as the
`provided` `WordTiming[]` to `resolveWordSpans` and the Platter consumes it verbatim
— that is the only wiring needed. We do **not** build Whisper here.

## Two decks + crossfader

The engine is deck-shaped: `createScratchDeck` connects each deck through its own
gain into the destination, so a **second deck** is just another instance. The
immersive view defaults to **one** deck; a "Two decks" affordance reveals a second
turntable (own snippet) and an equal-power **crossfader** (deck A ↔ deck B). One
deck is flawless on its own; the crossfader can fade to nothing or to madness.

## Constraints honored

One global transport — the platter plays by hand, never via the transport (no
play/stop button). Audio resumes only on a real gesture (`onGrab` → `ensureAudio`).
`--bl-*` tokens only, minimal strings, 60fps (CSS vars written in the RAF handler,
not per-frame React re-renders for the disc).
