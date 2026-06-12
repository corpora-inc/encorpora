# phrase-scratch — the real turntable

A hand-driven turntable for a single saved phrase. The founder's bar: **make the
record scratching as real as current technology allows.** This is a *continuous-rate
scrub engine*, not a granular looper.

## The model: one wave, one read-head, ONE continuous rate

A real record is ONE continuous wave read by ONE needle. The needle points at ONE
exact moment in the phrase; turning the disc moves that single read-head; the SPEED
you turn = the (signed) playback rate. Crucially, the disc is **always moving** at
the hand's current speed — the engine integrates a continuous rate every sample. It
never "snaps the needle to a target and freezes between frames."

- **No grains, no re-triggering, no voice spawning.** (The old `Tone.GrainPlayer`
  looper spawned overlapping grain voices. Retired.)
- **The phrase LOOPS.** Past the end the playhead wraps to the start (and past the
  start, to the end), so continuous spinning replays the phrase — a locked groove.
- A fixed arc of vinyl = a fixed slice of time in the wave.

## The engine (`scratchEngine.ts` + `scratchProcessor.ts` + `scratchDsp.ts`)

### CONTINUOUS-RATE integration — the heart (the anti-freeze fix)
The previous engine ran in *position mode*: each finger update posted an absolute
target buffer position, and the block glided to it in ONE render block (~3ms) then
RETURNED `playhead == target`. Between finger updates (~16ms / ~5–6 blocks) no new
target arrived, the per-sample increment was 0, and the playhead **froze** reading
one sample = DC. Result: ~3ms of audio then ~13ms of frozen buzz, 60×/sec → garble.

The fix is a **velocity engine**. The worklet holds the wave, a float `playhead`, and
a signed `rate` (buffer-samples per output-sample). EVERY sample it:

```
out = sample(playhead)                  // interpolated, LOOPING read
playhead = wrap(playhead + rate)        // advance continuously; modulo length
rate += (targetRate − rate) * slew      // one-pole smoothing toward the target
```

The main thread, each RAF tick, derives the disc's signed angular speed and posts a
**target rate** (`{type:"rate", rate}`); between posts the worklet keeps integrating
the last rate, so the audio is **always gliding** — never frozen. A light one-pole
**slew** on the rate (`DEFAULT_RATE_SLEW`) removes per-frame jitter without
perceptible lag. `{type:"hold"}` slews the target to 0 (a dead stop = silence). The
worklet posts its true `playhead` back (`{type:"pos"}`, ~once/frame) so the main
thread keeps the **needle locked to the audio** (off-contact it re-derives `discRot`
from the reported playhead; on-contact the finger owns `discRot` and the audio
follows through the slew).

### Tested DSP twin (`scratchDsp.ts`)
The AudioWorklet wrapper can't be instantiated in vitest, so the **exact** read/
advance math is pure functions (`linearSample`, `cubicSample`, `wrapPlayhead`,
`renderRateBlock`) that both the test (`scratchDsp.test.ts`) and the inlined
processor use. **Keep the inlined processor math in lockstep with this file.**

### Fallback
If `audioWorklet` is unavailable or `addModule` throws, the engine degrades to a
`ScriptProcessorNode` running the **same** `renderRateBlock`, so scrubbing still
works. If even that fails it returns a dignified silent stub — the load never crashes.

## Disc → playhead mapping + the spiral (`scratchMath.ts`)

A FIXED `SECONDS_PER_REV` (≈2s) maps one full disc revolution to a fixed slice of
audio — **the same for every phrase, regardless of sample length** ("time is
consistent for a length of record"). A longer phrase simply spans more revolutions
before it loops; the mapping is NEVER scaled by phrase duration. `rotationToPlayhead`
WRAPS (modulo duration) → the phrase loops. The groove/label **spirals inward** per
turn (`timeToSpiral`).

## Loop QUANTIZED to the revolution + one START marker (`scratchPad.ts`)

The phrase used to loop at its raw duration, which is almost never a whole number of
2s revolutions — so the phrase START landed at a DIFFERENT angle every loop (the
needle "in a different place every time"). The fix (`scratchPad.ts`): when a snippet
loads, **pad the decoded buffer with trailing SILENCE** to
`paddedLoopSeconds(duration) = ceil(duration / SECONDS_PER_REV) * SECONDS_PER_REV` —
an INTEGER number of revolutions. The engine wraps at this padded length, so after
every loop the playhead returns to 0 at a whole number of full disc turns → the
phrase start comes back **under the 3 o'clock needle at the SAME angle, every loop**.
`SECONDS_PER_REV` stays fixed; the mapping is NOT scaled by duration.

A short (~22ms) **fade is baked at the phrase↔silence boundary** (fade-out into the
trailing pad, fade-in at the very start) so looping through the silent gap is
click-free even on a hard transient (`padChannelToLength`).

The disc mapping (`durationSec`) uses the **padded** length (so the wrap is
rev-quantized); **word spans + the spiral stay on the REAL phrase timeline**
(`phraseSec`), so labels don't smear across the silent pad. A single **START marker**
(`.bl-scr-start`) is fixed on the disc at the start-of-phrase groove point (spiral
angle 0, outer rim → under the needle at playhead 0). Because the loop is
rev-quantized, that marker returns under the needle every loop. This REPLACES marking
every word as the primary reference; subtle word labels remain as a secondary layer
(the `wordTiming.ts` forced-alignment seam is kept for later). Proven pure:
`startMarkerScreenAngle` is invariant across loops on the padded length
(`scratchMath.test.ts`); the padding + fade math is in `scratchPad.test.ts`.

## Fixed decks + deluxe, space-filling layout (`phrase-scratch.css`)

**Reserved footprint.** Each turntable is a fixed aspect-ratio box sized from a single
`--bl-platter` value derived from the available box (width AND `vh`, minus the fader
lane / mixer column). The disc, needle, START marker, and word labels are all
positioned ABSOLUTELY inside that box, so nothing about playback (spin, marker, word
position) can change a deck's size — decks **stay fixed** and never shove each other,
down to ~320px. `--bl-platter` is the ONE knob.

**Deluxe layout.** Single-deck mode centers one large platter + its channel-fader-style
Cut fader (the throw matches the platter height), filling the immersive sheet. Two-deck
mode lays out a real **DJ console**: deck A | a center **mixer column** carrying the
crossfader (vertical) | deck B on wide screens; below ~640px the decks **stack** with a
horizontal crossfader between them. Everything sizes off `min()/clamp()` of the
available box, never fixed px — it reflows on resize, no lonely corner.

**Direction:** the disc's accumulated `rotation` is clockwise-positive (screen atan2,
y-down). Dragging the record FORWARD (clockwise) advances the playhead FORWARD
(`playhead = +rotation * SECONDS_PER_RAD`); reverse drag plays backward.

**Spin / Hold:** `NATURAL_ANGULAR_VEL` is the angular speed for rate 1.0 (one
revolution every `SECONDS_PER_REV` real seconds). **Spin** auto-rotates the platter
at this speed (phrase plays at natural tempo, looping); **Hold** stops it dead.
Scratching over the top overrides while in contact; on release it returns to Spin (if
on) or coasts to rest under friction (`decayAngularVelocity`).

## Needle + word positions (`Platter.tsx`, `wordTiming.ts`)

- A **fixed needle at 3 o'clock (the RIGHT)** points at the exact moment under it.
  The current playhead time `t` has spiral angle `θ = t / SECONDS_PER_RAD`, which
  equals `rotation` (mod 2π); each word is placed at local screen angle `−θ` from the
  needle, so after the disc rotates by `rotation` the current word lands exactly under
  the right-side needle — **what's under the needle == what you hear** (the old build
  put the needle at the top with a `sin θ / −cos θ` placement that read ~180° off).
- Each word is placed along the spiral groove at its real buffer-time range,
  highlighted when it is under the needle.

### Forced-alignment seam (Whisper hook — not built now)
`wordTiming.ts` consumes a `WordTiming[] = {text, startSec, endSec}`. Precedence:
exact timings (forced alignment) → silence split → even distribution. We do **not**
build Whisper here.

## Single-deck CUT FADER (`CutFader.tsx`)

A throwable vertical level fader **on each deck** — the scratch "cut", styled as a real
channel fader (fat grip cap on a slim recessed track). Flick it 0→full for the fast
fade-ins real scratching lives on. On pointer move it writes the cap position to its
`--bl-cut` CSS var **imperatively** (immediate, no wait for a React re-render → zero
lag on a fast flick) AND reports the value up so the deck gain follows. Tap anywhere on
the track to jump there (instant cut); drag, wheel, keyboard all work. It exists with a
single deck (not gated behind two). The deck gain = `cut × crossfade-contribution`, so
the cut and the two-deck crossfader compose.

## Two decks + crossfader

The engine is deck-shaped: `createScratchDeck` connects each deck through its own gain
into the destination, so a **second deck** is just another instance. A "Two decks"
affordance reveals a second turntable + an equal-power **crossfader** (deck A ↔ deck B);
the per-deck cut fader stays.

## The shared bottom drawer (Effects + Phrases) — UNIFIED surface

Scratch hosts its tools in the SAME bottom drawer Drums / Instruments use
(`../track-studio/TrackDrawer`), NOT a bespoke popover. The page (`.bl-scr`) is
`position:relative; overflow:hidden` and reserves the drawer peek zone at the bottom, so
the drawer slides over the stage on the one z-scale (never `document.body`), exactly like
the other track-studio pages. The header "Effects" / "Phrases" tools just OPEN the drawer
on their tab. One surface type, one open/close convention.

### Master FX rack (`scratchFxBus.ts` + `scratchFxChain.ts` + `ScratchFxPanel.tsx`)

The decks aren't a mixer track, but they still deserve a turntable's master FX. The
decks connect into a native `input` GainNode (their `destination`); that bus is wired
`input → fx[0] → … → fx[n] → ctx.destination` using `Tone.connect` (Tone shares our
AudioContext via `Tone.setContext`), so a few curated DJ inserts colour BOTH decks at
once — the right model for one turntable. The inserts are the SAME `Effect`s the mixer
builds (`createEffect`, the shared `EFFECT_SPECS` param schemas), so a "Filter" here is
the exact filter there. The rack is a FIXED curated set (Filter, Delay, Reverb, Crush),
held in scratch-LOCAL React state — there is no document coupling (scratch never writes
the doc / has no undo history; `actions: []`), so it CAN'T be the doc-backed `TrackFxChain`.
Instead `ScratchFxPanel` renders the SHARED fx-rack effect-CARD look — the EXACT
`.bl-fxchain` / `.bl-fxcard` / `.bl-fxcard-power` / `.bl-fxcard-xy` classes the mixer rack
uses (reused by class, no edits to fx-rack) — and drives the live bus directly so the
cards match every other screen's rack. Inserts start BYPASSED. The chain is rebuilt only
on add/remove; toggling + param moves go through the effect's own `update`/`setParam` (no
graph rebuild). Realtime knob wiring mirrors the fx-rack: live moves drive `bus.liveParam`;
release commits one local edit. Pure chain helpers (`scratchFxChain.ts`) are unit-tested.

### Phrases → catalog DISCOVERY (`ScratchPhrasePanel.tsx`)

The "Phrases" drawer tab is phrase DISCOVERY, not an owned-list (the per-deck picker
already covers owned snippets). It REUSES the full `phrase-sampler/PhraseSamplerImmersive`
flow verbatim — search the WHOLE corpus → drill a language → audition → save a combo
(renders TTS + IDB-caches + registers a `FragmentRef`). On save we auto-load the new
snippet onto the aimed deck (A unless the user aims B), so "discover → on the platter" is
one gesture. The empty state keeps the drawer mounted on Phrases so the first phrase is
found right here.

The deck toggle lives in the TOP header (with the Effects + Phrases buttons); the
crossfader stays fixed above the drawer's peek zone and the responsive landscape-row /
portrait-stack deck layout is unchanged. The per-deck picker dropdown is an absolutely
positioned OVERLAY (anchored to its `position:relative` deck), so opening it never pushes
or resizes the platter.

## Constraints honored

One global transport — the platter plays by hand / Spin, never via the transport.
Audio resumes only on a real gesture (`onGrab`/Spin → `ensureAudio`). `--bl-*` tokens
only, minimal strings, 60fps (CSS vars written in the RAF handler, not per-frame React
re-renders for the disc).
