# `@dynawalla/audio` — the procedural audio foundation

Every sound in the Dynawalla Bazaar is synthesized in Web Audio at runtime.
**There are no audio files in this project and there never will be.** Zero
runtime dependencies, no build step. 4,426 lines of kit, plus 255 of tests,
1,300 of measurement harness, 694 of demo and 98 of tooling.

```ts
import { audio } from "@dynawalla/audio"

await audio.init()             // once, anywhere. Unlock is automatic.
audio.play("ui.chunk")         // a sound
audio.combo(streak)            // a rising ladder that stays musical
audio.music.setIntensity(0.7)  // the score responds
audio.ambience("bazaar")       // the place
audio.onCue(c => flash(c))     // visuals, so sound is never the only channel
```

That is the whole API a prototype needs. Everything else in this directory
exists so those six lines are correct on iOS, on a silenced phone, on a cheap
tablet, with audio switched off, at 60 fps, after ten thousand taps.

---

## Run it

```bash
node tools/serve.mjs        # http://localhost:8788/  demo
                            # http://localhost:8788/measure/index.html  harness
npm test                    # 21 unit tests, Node's native runner, no deps
```

The dev server transpiles `.ts` on the fly with Node's built-in
`module.stripTypeScriptTypes`. No vite, no esbuild, no `node_modules`.

---

## What is in the box

| | |
|---|---|
| **Physical modelling** | Polyphonic Karplus-Strong (24 voices) and modal resonator banks (16 voices × 10 modes) in an `AudioWorklet`, f64, sample-accurate scheduling |
| **Materials** | brass · bell · tile · glass · stone · wood · skin (Bessel membrane) · copper pot — real inharmonic ratios, per-mode decay |
| **Subtractive / FM / granular** | filtered-noise bursts and sweeps, 2-op FM, sub thump with saturation, a 1-node-per-grain granular cloud |
| **25 presets** | UI, impacts, plucks, rewards, failures, motion, plus a combo ladder |
| **Procedural music** | 6 layers on a Hijaz mode, lookahead scheduler, `setIntensity(0..1)`, never loops |
| **4 ambient beds** | continuous filtered-noise air + sparse randomly-scheduled distant events |
| **Mix** | 4 buses, sidechain ducking, compressor + oversampled soft clipper, measured true-peak ceiling |
| **Budget** | 4 quality tiers, auto-detected by a 13 ms offline benchmark; voice cap with weighted stealing |

---

## Measured, on real hardware

Apple M-series laptop, Chrome 149, 48 kHz. Every number below was produced by
`measure/index.html` in this repo, not read from a specification.

### The synthesis is correct

| Claim | Measured |
|---|---|
| String bank pitch accuracy, 82 Hz – 1760 Hz | **±0.12 cents** |
| Modal decay: requested T60 vs achieved, 6 materials | **within 0.6 %** |
| Presets producing audio through the live path | **25 / 25** |

### The mix cannot clip

Twelve of the loudest presets fired on the same sample:

| Chain | Peak |
|---|---|
| No master chain | **+24.17 dBFS** |
| `DynamicsCompressorNode` alone | **+3.03 dBFS** — it is not a limiter |
| Compressor + oversampled soft clipper | **−0.25 dBFS, 0 clipped samples** |

### It does not cost frames

Synthetic 60 Hz loop, 6 ms of main-thread work per tick, `MessageChannel`-driven:

| Trigger rate | Mean tick | Kit's share of a 16.67 ms frame |
|---|---|---|
| control (no audio) | 6.021 ms | — |
| 8 sounds/s (real gameplay) | 6.032 ms | **+0.018 ms** |
| 30 sounds/s (punishing) | 6.061 ms | **+0.040 ms** |

Zero ticks over 16.7 ms in any condition. Per-call `play()` cost is **6–11 µs**
warm.

### Audio-thread cost (fraction of one core)

| Component | Cost |
|---|---|
| Empty graph | 0.85 % |
| Convolution reverb, 1.1 s tail | 2.21 % |
| Convolution reverb, 2.4 s tail | 2.46 % |
| Modal bank, 16 voices × 8 modes, sustained | 5.31 % |
| String bank, 24 voices, sustained | 4.88 % |
| Granular cloud, 140 grains/s | 5.82 % *(was 49.32 % — see traps)* |
| **Native BiquadFilter fallback, 100 voices** | **24.35 %** |
| An **idle** `AudioWorkletNode`, each | **~0.33 %** |

Whole scenes, rendered through the real master chain and the real voice budget:

| Scene | Requested | Admitted | Peak voices | CPU | Peak | Clipped |
|---|---|---|---|---|---|---|
| UI only (5/s) | 19 | 19 | 2 | 5.5 % | −0.26 dBFS | 0 |
| Busy (23/s) | 91 | 89 | 18 | 18.7 % | −0.22 dBFS | 0 |
| Chaos (53/s) | 211 | 176 | 20 | 47.4 % | −0.26 dBFS | 0 |
| Chaos, **budget disabled** | 211 | 211 | ∞ | 128 % | — | — |

### Latency

`baseLatency` 5.33 ms + `outputLatency` 24 ms + the kit's 4 ms scheduling
offset = **~33 ms** end to end. Init (probe + worklet + tables + warm) is
**94 ms**, once, and belongs on a loading screen.

---

## The budget the kit enforces

The mid-range tablet is the **floor**, not the target. Tiers are picked by a
real benchmark (`probeTier`), never by sniffing the user agent.

| | ultra | high | medium | low |
|---|---|---|---|---|
| max voices | 48 | 32 | 20 | 12 |
| reverb tail | 2.4 s | 1.8 s | 1.1 s | off |
| modal partials | 10 | 8 | 6 | 4 |
| grains/s | 140 | 90 | 45 | 0 |
| music layers | 6 | 5 | 4 | 2 |
| worklet banks | yes | yes | yes | native fallback |

**Hard budget: the audio thread must stay under 30 % of one core in normal play
and under 60 % in the worst case.** It has 2.67 ms to render each 128-frame
quantum at 48 kHz; going over is a dropout, and a dropout is the only
unrecoverable audio failure. Degradation order when a tier drops: reverb tail →
grain density → modal partials → music layers → voice cap.

Calibration: `realtimeFactor` on the reference M-series machine is **74**.
Thresholds are ultra > 55, high > 28, medium > 10. **Re-run
`measure/index.html` on a real target tablet and re-anchor these** — one device
is not a calibration.

---

## The traps, found by hitting them

**1. A `DelayNode` in a feedback cycle silently adds 128 samples.** Not clamps —
*adds*. The textbook native Karplus-Strong is therefore flat at *every* pitch:
measured −336 cents at 80 Hz, −2096 cents at 880 Hz. Subtracting
`128/sampleRate` fixes tuning below the ceiling (within 7 cents) and then hard-
pins at **373.5 Hz** for every request above it, because `delayTime` cannot go
negative. Any plucked string above F#4 requires an `AudioWorklet`. Measured, in
`measureNativeKarplusCeiling`.

**2. The loop filter must have magnitude ≤ 1 at *all* frequencies.** A default
`BiquadFilter` lowpass has Q = 1 and therefore a **+1.2 dB resonant peak**, so a
0.99 feedback gain still gives loop gain > 1. Measured peak before the fix:
**8.6 × 10¹⁷**. Use `(x[n] + x[n−1])/2` — an `IIRFilterNode([0.5,0.5],[1])`.

**3. `postMessage` to a worklet does not arrive before `startRendering()`.** In
an `OfflineAudioContext`, posting and rendering in the same task produces a
**totally silent buffer** — no error, no warning. Measured: same pluck, peak
`0.00000` without a macrotask yield, `0.61880` with one. Every offline bounce of
worklet-driven audio must yield first.

**4. In Web Audio you pay for the graph, not the arithmetic.** The obvious
granular cloud — `BufferSource → BiquadFilter → Gain → StereoPanner` per grain —
measured **49.3 % of a core** at 140 grains/s. Baking the band-pass, the Hann
window and four amplitude steps into pre-rendered buffers, and sharing five
static panners, gets it to **one node per grain and 5.8 %**. Identical sound,
8.5× cheaper.

**5. An idle `AudioWorkletNode` is not free** — about **0.33 % of a core each**
(12 idle banks measured 3.98 %). Hence the banks are per-bus *and* lazy.

**6. A shared polyphonic bank cannot be routed per voice.** One worklet node
serving many voices has one output, so it cannot pass through a per-voice gain
node and cannot land on a different bus per trigger. Symptom: a UI tick's modal
body ignoring both the UI fader and the preset's own level. Fix: one bank per
bus, and apply the per-voice level via the bank's own `gain` message field.

**7. `WaveShaperNode` with `oversample: "2x"` can output above its own curve's
maximum**, because the interpolation filter rings. A ceiling of 0.999 measured
**+0.05 dBFS** — over full scale, on the node whose whole job is to be under it.
The curve now tops out at 0.97 (−0.26 dBFS), which also gives a cheap tablet DAC
the inter-sample headroom it wants.

**8. `resume()` never rejects without a gesture — it just never resolves.**
`await ctx.resume()` outside a user gesture hangs forever. Call it
*synchronously* inside the gesture handler, and never `await` anything before
it. (This cost a 45-second tool timeout during development, which is exactly
what it does to a loading screen.)

**9. `requestAnimationFrame` never fires in a background tab, and `setTimeout`
is clamped to ~1 s.** An rAF-based perf harness hangs forever in automation. Use
a `MessageChannel` ping-pong, which is not throttled. The same trap is why the
music scheduler must detect that it woke up seconds behind and *rebase* rather
than fire the backlog — otherwise a tab that was hidden for 30 s dumps ~2000
notes into the graph at once.

**10. `performance.now()` is coarsened** (~5 µs, non-cross-origin-isolated), so
timing a single `play()` returns 0. Time a batch and divide.

**11. The first `play()` of a preset costs ~200 µs**, versus 6–11 µs warm — V8
compiling the render function and touching each node constructor. A screen
transition firing six new presets is over a millisecond of jank at the exact
moment the player is watching. `audio.warm()` (called by `init()`) runs every
preset through an `OfflineAudioContext` once: pure main-thread priming, zero
real-time cost.

**12. `exponentialRampToValueAtTime` cannot start or end at 0, and
`setTargetAtTime` never arrives.** Stop a source "when the decay ends" and you
chop an audible tail: a click. Every envelope in the kit goes through
`dsp/env.ts`, which uses a linear attack, an exponential-shaped decay and an
explicit `setValueAtTime(0, end)` at the −60 dB point.

**13. Allocation on the audio render thread is a click waiting to happen.** A
`new Float32Array` per pluck inside `process()` eventually drags a GC pause into
a 2.67 ms budget. There is a unit test that greps the worklet source for it.

---

## iOS, silent mode, and the plugin you must NOT reuse

**Do not call `tauri-plugin-audio-keepalive` from a Dynawalla prototype.** It
sets `AVAudioSession.setCategory(.playback)`, which makes audio ignore the
hardware mute switch — correct for Corpán, where a language learner has
deliberately started a narration, and **wrong here**. A parent who silences a
tablet at a doctor's office has silenced it. The default WKWebView session
category respects the mute switch; leave it alone.

Everything the kit does for iOS is in `armUnlock()`: one-shot capture listeners
on `pointerdown` / `touchend` / `keydown` / `mousedown`, a synchronous
`resume()`, and a 1-frame silent buffer started inside the gesture (older WebKit
wants a source to have started, not just a resumed context). `touchend` matters
— `pointerdown` alone is not enough on older WebKit.

The kit also suspends the context on `visibilitychange`. A backgrounded tab
holding a live 48 kHz graph is a battery complaint, and on iOS it is an audio
session fighting the user's music.

---

## Sound never carries information alone

`play()` emits a `Cue` **whether or not any sound was produced** — muted,
disabled, device silenced, or dropped by the voice budget. Every cue carries
`intensity`, `weight` (how big a flash this deserves) and `haptic`.

```ts
audio.onCue(cue => {
  flash(cue.id, cue.weight)
  haptics.impact(cue.haptic)   // tauri-plugin-haptics
})
```

Wire your visuals to cues and the prototype is accessible by construction. The
demo's checkbox proves it: switch audio off and the screen keeps working.

---

## What it actually sounds like

Sound design tuned against the brief — a minaret-punk bazaar of brass, tile and
glass — and the permanent anti-goal of anything that reads as a worksheet.

Every impact is **transient + body + tail (+ sub)**. The transient (0–15 ms of
noise through a tight bandpass) is what the ear uses to identify the material;
it is nearly inaudible alone and removing it makes any sound feel fake. The body
is modal or FM. The tail is a *reverb send*, not a longer envelope — a long
envelope is a synth pad, a tail is a room.

Pitched presets sit on **D** in a **Hijaz**-flavoured set (1 ♭2 3 4 5 ♭6 7). A
major triad reads as a corporate onboarding flow; Hijaz reads as somewhere with
hot dust and hammered metal. A child cannot name it and will absolutely feel it.

Timbres achieved, described honestly:

- **`impact.brass`** — a struck tray. Eight modes at 1 / 2.01 / 3.02 / 4.17 …,
  2.6 s ring, paired detuning that produces real audible beating, a bright noise
  strike on top and a saturated 58 Hz thump under it. Measured centroid 408 Hz,
  crest 20 dB, decay 2.46 s. It sounds like *metal*, not like a bell patch.
- **`ui.chunk`** — the confirm. Wood transient, tile body, 82 Hz sub falling 5
  semitones in 45 ms. Reads as a heavy, well-made thing seated into its slot.
  17 ms of actual attack; the whole event is under 200 ms.
- **`ui.tap`** — 12 ms of velvet noise at 2.4 kHz plus a whisper of tile body. A
  fingertip on glazed ceramic. ±55 cents of shaped jitter and a random read
  offset into the noise buffer, so 500 of them never machine-gun.
- **`pluck.string`** — Karplus-Strong santur with a pick-position comb on the
  excitation. Plucking near the bridge is thin and nasal, over the hole is
  round; without that comb every pluck is the same instrument.
- **`impact.drum`** — a darbuka built on the actual Bessel modes of a circular
  membrane (1 / 1.593 / 2.135 / 2.295 / 2.917). It has a pitch you can almost
  but not quite name, which is what a real drum does.
- **`fail.pot`** — a copper pot wobbling to a stop: five strikes at shrinking
  intervals, alternating pan. Genuinely funny. No buzzer, no descending minor
  third, nothing that says *you are bad*.
- **`fail.retry`** — three notes, down, down, then **up**, resolving to the
  fifth. It ends open and consonant: the audio equivalent of *go on, again*.
- **`fail.lampOut`** — the business model's emotional beat. A glass ring being
  damped away, a falling filtered sweep, one soft thud. A loss of warmth, never
  a penalty klaxon.
- **`reward.big`** — sub + brass gong + a second gong a fifth up 12 ms later +
  a six-string rolled harp + a 0.9 s granular shimmer + a rising sweep, ducking
  the music by 55 %. This is the moment the whole kit exists to land.

Anti-fatigue, which is what stops all of this becoming torture by lunchtime:
per-trigger shaped pitch jitter (deliberately *not* uniform — uniform noise
clusters at the centre and reads as "the same sound, slightly detuned"), random
read offsets into the shared noise buffers, per-strike modal detune, round-robin
variant selection that never repeats immediately, and a `minGap` per preset so
two identical transients 8 ms apart cannot phase-sum into a 6 dB spike.

---

## Files

```
src/
  index.ts              the AudioKit facade — the six-line API
  engine.ts             context, buses, master chain, ducking, tiers, voice budget, unlock
  types.ts              public types
  rng.ts                deterministic randomness + the anti-fatigue shapers
  dsp/
    tables.ts           noise, curves, procedural impulse responses, pre-baked grains
    env.ts              envelope helpers that close Web Audio's three sharp edges
    materials.ts        the modal material library
    banks.ts            worklet loading, the two polyphonic banks, native fallback
  worklets/source.ts    dw-string, dw-modal, dw-meter (as source text)
  presets/
    voices.ts           synthesis primitives (noise, FM, sub, sweep, grains)
    library.ts          the 25 presets
  music/
    music.ts            the procedural score
    ambience.ts         the ambient beds
  kit.test.ts           21 unit tests
measure/                the harness every number in this file came from
demo/                   the playable demo
tools/                  zero-dep dev server, worklet emitter
```

## Adding a preset

```ts
import { createAudio, type Preset } from "@dynawalla/audio"
import { noiseBurst, subThump } from "@dynawalla/audio/presets/voices.ts"

const myPreset: Preset = {
  id: "game.slam",
  bus: "sfx",
  gain: 0.4,          // set it from a measured LUFS, not by ear alone
  group: "impact",    // shares a polyphony budget with the other impacts
  poly: 4,
  weight: 0.8,        // how big a flash this deserves
  haptic: "heavy",
  duck: 0.3,
  render(rc) {
    const t = noiseBurst(rc, { kind: "white", freq: 2200, gain: 0.4, decay: 0.03, highpass: 600 })
    const s = subThump(rc, { freq: 55, drop: 8, gain: 0.5, decay: 0.2, drive: 0.5 })
    return { endsAt: Math.max(t, s) }
  },
}

const audio = createAudio({ presets: [myPreset] })
```

Then run `measure/index.html` → `library` and set `gain` so it lands on its
family's loudness target. The library is matched to: UI −26 LUFS, motion −22,
plucks/beads −18, impacts/chimes −16, unlock −14, jackpot −12.
