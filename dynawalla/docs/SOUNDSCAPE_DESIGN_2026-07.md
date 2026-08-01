# The Dynawalla soundscape

**Status:** live. `packs/shared/game-soundscape/` exists and has 57 tests; the host
now chooses a soundscape and publishes it, so THE STEELYARD plays through it in
production. Stage 2 (games talking back) and stage 3 (the host's ambient bed) are
still proposed. The founder's answers to the open questions are recorded at the
end.

**Second pack wired, and the module grew a seventh file.** PULSE reads the same
soundscape as TIME rather than as pitch. The founder's brief for it — *"some
probability matrix that makes a nice tune on the beat … when the input is sort of
the mode and the desired density"* — is `groove.ts`: a mode is a set of positions
in a cyclic space of 1200 cents and a bar is a set of positions in a cyclic space
of four beats, so projecting one onto the other gives a bar this key likes the
shape of. Twelve tests. It lives in the shared module and not in the pack because
the next rhythm game will want it, and because a matrix a pack owned privately
would be one more thing that stops agreeing with the drone. PULSE still names no
pitch and chooses no key: `groove.ts` returns probabilities, never frequencies.

**What turning it on actually was.** Not a change to any pack: the pack side was
finished and waiting. `dynawalla-app/src/app/soundscape.ts` chooses one key for
the whole app and `packSettings` puts it on the wire, where `game-host`'s
`publish()` was already forwarding it. THE STEELYARD's own ship gate — "nothing
in the shipped pack turns the soundscape on" — still passes unchanged, because
turning it on was the host's job and never the pack's.

---

## The brief

> *"we need a global pass on these elements. Maybe even a shared library of
> infinite music and sounds that we can draw from so nothing is boring or lame …
> here is a fantastic idea … we use some stochasticity and randomness … but in a
> lot of cases we have a nice drone that is in tune with the little sound effects
> that play a melody. so for the steelyard, right now have the same sound for
> every +1/−1 … it would be way cooler if it randomly played a melody based on
> the randomly chosen soundscape for any given moment .. so we are in a certain
> maqam in a certain root note, then the little sound effects play a nice little
> song .. this in itself could be satisfying and addictive. right now it's too
> predictable, too annoying, too static .. we need some life. All of the Raga,
> all of the maqam, all of the western modes, many chord progressions to choose
> from .. I think this is a place that we can have a standardized interface from
> the native side that informs the game what the current soundscape is .. and
> then from the game side, we could say 'level complete' or 'more tension' or
> 'less tension' or high-level changes like this that would affect the global
> soundscape."*

Plus, on the state of the fleet: *"the sound effects… tend to be a bit abrasive ..
maybe lower pitched in a lot of cases ... like building crumbling here instead of
white noise"*, and on the bed: *"Premium, chill (usually), not too loud. Never
empty, always optional."*

---

## What is actually wrong today, measured

Twenty-eight games, **11,064 lines of audio code**, and not one line of it shared
except the safety bus. Three facts, counted rather than felt:

| | |
|---|---|
| Games whose cues are a table of fixed frequencies | all 28. THE STEELYARD's is `{ 1: 1180, 10: 830, 100: 520, 1000: 288 }` |
| Games with a white-noise buffer source | **24 of 28** |
| Distinct pitches a child hears from ten taps on THE STEELYARD's ones plate | **one** |

That last row is the whole problem, and it is worth being precise about why,
because the obvious fixes are all wrong:

- It is **not** that the sounds are ugly. `audio.ts` in THE STEELYARD is careful,
  hand-shaped work: a bowed band-passed drone that tracks the beam, place-pitched
  clangs, a shear that falls 760 Hz to 74. Making it *prettier* changes nothing.
- It is **not** that it is too loud. `game-audio` already holds a −1 dBFS ceiling,
  a 6 ms minimum attack and a polyphony cap, and PR #696 routed the last two games
  through it. Turning it down changes nothing either.
- It is that **nothing that happens changes what the next sound is.** The tenth
  blow is bit-for-bit the first. A system with no memory cannot be surprising, and
  a child stops hearing it in about ninety seconds — which is exactly the founder's
  "too predictable, too annoying, too static".

Fixing that is a *state* problem, not a synthesis problem, and it is fixed in
about 500 lines of pure arithmetic with no Web Audio in them at all.

---

## 1. The musical core

### Cents, not semitones

Every pitch collection is stored as **exact cents above the tonic**, ported from
Corpán's beatlounge pack (`corpan/packs/beatlounge/src/music/modes/`), whose
corpus is 130 modes over six families in precisely this representation.

This is not fussiness. Maqam Rast's third is a neutral interval at ~350 cents —
three-quarters of a tone — and Saba's fourth is narrowed. There is no integer
number of semitones that says either. A semitone table does not *approximate* the
maqamat, it **deletes** them and silently substitutes the nearest Western mode.
The founder rejected a blanket 24-TET grid in beatlounge for the same reason, and
that decision carries over unchanged.

Shipped in `packs/shared/game-soundscape/modes.ts`: **38 modes** — 16 Western, the
10 Hindustani thaats, 12 Arabic maqamat. The 72 Carnatic melakartas, the 7 Persian
dastgāh and the 10 Turkish makamlar exist in beatlounge and are a data change away
with zero migration; they were left out to keep a pack's vendored payload small
until somebody has *heard* 38 and wants more.

> **On "all of the Raga".** A thaat is a raga's parent scale, not a raga: a raga
> adds an ascent, a descent, a resting note and a set of characteristic phrases.
> What the walker below supplies is exactly an ascent, a descent and a resting
> note — so a thaat plus this walker is much closer to a raga than a thaat alone.
> The ids still say `thaat`, because claiming otherwise would be a lie a musician
> would catch.

### A soundscape is four numbers

```ts
type Soundscape = {
  modeId: string   // "maqam.rast"
  rootHz: number   // 130.72 — the tonic, and the drone
  seed: number     // every stochastic choice comes from here
  tension: number  // 0..1
}
```

Small enough to sit on the host↔pack wire beside `locale` and `reducedMotion`,
which is the whole reason it is four numbers and not an object graph.

The **root band is Bb2–Eb3 (116–156 Hz)** and it is narrow on purpose: the melody's
brightest register is root×4 to root×8, so the top of the root band times eight is
the highest note the entire system can produce — 1244 Hz. Widening the roots by a
fourth would put that at 1600 Hz, inside the 2–5 kHz band the ear is most sensitive
in. **The ceiling on the music is set by choosing the roots, not by clamping
later.** The chosen root is then detuned by up to ±6 cents — under the threshold at
which anyone hears "out of tune", over the threshold at which two sessions sound
like the same session.

### The walker: how consecutive +1s become a phrase

One integer of state: a signed scale degree. Each `step` gesture moves it, and the
pitch that comes out is wherever it now is.

1. **Direction is the mode's own grammar.** `+1` walks ascending, `−1` walks
   descending. This is why the founder's example is the right one to build against:
   THE STEELYARD's rack has an on-face and an off-face on every pillar, so hanging
   brass and trimming it are opposite motions — and the balanced-base-ten shortcut
   the whole game exists to teach (*eight is ten less two*) is literally **one step
   up and two steps down**. That figure now sounds like a turn instead of like
   three identical ticks. `soundscape.test.ts` asserts it descends in 60 of 60
   soundscapes.
2. **Interval by tension.** The step is 1 degree most of the time, 2 sometimes, 3–4
   rarely, on a distribution the tension scalar reweights. Calm is nearly all
   stepwise — that is what "chill" means mechanically, and it is asserted rather
   than hoped.
3. **Gravity and cadence.** Each mode declares `rest` degrees (its own 1-3-5, or a
   jins tonic and its ghammaz). After 3–8 steps — length drawn per phrase, longer
   under tension — the walk *resolves* onto one, weighted heavily toward the tonic.
   **This is the part that makes it satisfying.** Without it a run of taps is a
   scale exercise that never arrives; with it, it is a sentence that lands.
4. **Colour under tension.** Each mode also declares its `colour` degree — Lydian's
   sharp fourth, Phrygian's flat second, Hijaz's augmented second. Tension spends
   itself by leaning on that degree. So a soundscape can get more wound-up **without
   anything going out of tune**, because the extra tension is still inside the mode.
5. **Register is bought with weight, not with pitch.** `weight: 0..1` is *how heavy
   the thing the child did was*. THE STEELYARD's ones plate is 0 and its thousands
   plate is 1, mapping to four one-octave bands at root×4, ×2, ×1 and ÷2. The bands
   are exactly one octave wide and a degree is folded into its band, so **they never
   overlap**: the ones plate is above the tens plate in every mode on every root,
   with no ordering left to chance. The game's existing "place value is a thing you
   can hear" property is kept *exactly* and made musical rather than replaced.

### In tune with the drone, by construction

Every frequency is `rootHz * 2^(cents/1200)`. The drone is the same `rootHz`.
**There is one number, so there is nothing to drift.**

The drone is the root, the octave below it, and the fifth **only when the mode has
one** within 25 cents of 702. Whole tone does not; Saba's is elsewhere. A fixed
"root plus fifth" drone would put a pitch under one soundscape in five that is not
in the scale, which is the exact clash this branch exists to avoid.

One consequence in the prototype worth calling out: THE STEELYARD's drone used to
*transpose* a major third across the beam's travel. With a soundscape live it
**bends ±35 cents** instead — a bowed string leaning under load. A tonic that
slides a major third is a melody out of tune with itself.

---

## 2. The event vocabulary

Eight things a game may say. Games cannot say a frequency.

```ts
type Gesture =
  | { kind: "step"; direction: 1 | -1; weight?: number }
  | { kind: "success" }        // it worked
  | { kind: "failure" }        // it did not — warm, low, never a buzzer
  | { kind: "levelComplete" }  // the only gesture allowed to be big
  | { kind: "refuse" }         // declined: too soon, not allowed, nothing there
  | { kind: "arrive" }         // something appeared or was laid out
  | { kind: "moreTension" }    // silent in itself
  | { kind: "lessTension" }
```

`melody.emit(gesture)` returns `Voice[]` — `{ hz, at, seconds, gain, timbre }` —
which is a **plan, not a sound**. The pack owns synthesis; the module owns music.
That split is why 45 tests can assert every note in Node with no device.

The two tension gestures return `[]`. That is the answer rather than an omission:
winding a soundscape up is not a sound, it is a change in every sound after it.

**Why a game must not pass a pitch.** Given the option, a game will eventually pass
one that is not in the mode — and then the drone is wrong and nobody can say why,
in a codebase where the drone is in a different file from the cue. The type system
is the enforcement, and it costs nothing: THE STEELYARD's entire musical vocabulary
after this change is `tune.ts`, which is 45 lines including comments.

---

## 3. Where it lives — two options, and the recommendation

The founder asks for *"a standardized interface from the native side that informs
the game what the current soundscape is"*. There are two honest readings.

### Option A — native owns the audio

A `tauri-plugin-soundscape` synthesises the bed natively; packs ask it for pitches
and cues over a stream capability. Genuinely process-wide, survives the WebView,
one engine for the whole app.

**Rejected, for three reasons and the first is fatal:**

1. **Latency.** A melody note is caused by a finger. A pack↔host round trip is a
   `MessagePort` post plus a native IPC hop plus scheduling — two frames at best,
   unbounded under load. `budgetMs` exists in the capability table *because* native
   answers are slow (2 s for a store read, 10 s for anything that may prompt). A
   note that arrives 40 ms after the tap is not a melody, it is a fault.
2. **It punches a hole in the only safety guarantee this fleet has.**
   `game-audio`'s WaveShaper ceiling governs the *pack's* graph. A natively
   synthesised bed is a separate output path that the ceiling cannot see, and it
   cannot duck to the pack's cues either. The MOSAIC incident (+22.9 dBFS, a
   nine-year-old saying it almost made his ears explode) is what that guarantee was
   built out of.
3. **It is the most expensive possible first native capability.** Every trap in
   `docs/NATIVE_CAPABILITIES.md` — the capability grant, the serde wire format
   silently dropping fields, `links =` uniqueness, cross-compiling both targets —
   for a feature whose value is entirely in the arithmetic.

### Option B — native owns the *selection*; the pack owns the *sound* **← recommended**

The pivot, and the one sentence this document exists to write down:

> **Pitch decisions must be local and synchronous. Soundscape selection must be
> global and slow.** A soundscape changes every few minutes. A note happens ten
> times a second. Put the slow thing on the wire and keep the fast thing in the
> pack.

So:

| | Where | Why |
|---|---|---|
| The mode corpus, the walker, the gesture vocabulary | **shared TS**, vendored into every pack | Pure arithmetic. Testable in Node. No device, no latency, no ceiling hole. |
| *Which* soundscape is current | **the host**, on the existing `settings` event | Cross-pack coherence cannot come from a pack: the frame is opaque-origin, its storage is not the app's, and it can see nothing of the pack open a minute ago. |
| Rotation and persistence — the soundscape drifting over a session and across days | **the host** | A pack does not have a session. The host does. |
| Synthesis — oscillators, envelopes, filters | **the pack**, through `game-audio`'s safety bus | Where the ceiling already is. |
| The always-on ambient bed | **the host** (stage 3, below) | So it does not stop at every doorway. |

**This needs no new capability, no new method, no permission, no stream, and no
Rust.** It is one optional field on `Settings`, which already re-fires on every
change — the same channel that carries `sound` and `safeArea`, both of which were
added exactly this way. `game-host` publishes it in one line beside those two.

### The three stages, and what is actually built

**Stage 1 — shipped in this change, off in production.**
`packs/shared/game-soundscape/` (seven source files and an index, 57 tests). `Settings.soundscape?`
on the wire. `game-host` publishes it. `game-audio`-style module state means
`currentSoundscape()` is `null` until somebody publishes one, and **no host
publishes one today**, so nothing in production changes audibly. THE STEELYARD is
wired end to end and its dev harness (`npm run dev`) publishes a soundscape, which
is where the idea can be heard: `?mode=maqam.rast&seed=7` to pin one,
`?soundscape=off` for the A/B against what ships now.

**Stage 2 — the host chooses (done), and games can talk back (not yet).** The
host picks a soundscape at launch, rotates it on a slow schedule, and publishes
it — that half is built, and the rotation policy is written down below. Games get
to *affect* it with a `feedback.soundscape` method under the **existing `audio`
capability** — `{ gesture: "moreTension" | "lessTension" | "levelComplete" }`, fire
and forget, 2 s budget, not native. The host adjusts and re-publishes through
`settings`, which every pack already handles. No parent-facing permission changes,
because "Play the app's sounds" already covers it.

**Stage 3 — the bed moves to the host.** The always-on ambient bed lives in the
host's own document, so it is continuous across the shell and under every pack and
there is no silent gap at a doorway. It stays in tune with whatever pack is open
because **both derive from the same `{ modeId, rootHz, seed }`** — the host does
not send audio, it sends four numbers, and the same pure module turns them into
the same pitches on both sides. That is the elegant part and it is why Option B
is not a compromise.

> **A defect stage 3 must fix on the way past — fixed.** `dynawalla-app/src/packs/services.ts`
> `playCue()` connected straight to `context.destination`, so the host's own cues
> were **not** subject to any ceiling. Nothing had complained because they are five
> short triangle tones, but a continuous bed on an unlimited path is the MOSAIC
> incident with the roles swapped. The host now builds one `createSafetyBus` per
> session and every cue passes it. `dynawalla-app/src/packs/cues.test.ts` renders
> the graph and measures the peak rather than grepping for the line.

---

## 4. Premium and chill: the numbers

Concrete replacements for "abrasive", so this is checkable rather than tasteful.

### Pitch centres — go down

| | today | soundscape |
|---|---|---|
| Brightest cue | 1180 Hz (fixed, every tap) | 1244 Hz **worst case**, at the top root and top degree; typical note far below |
| Heaviest cue | 288 Hz | 58–117 Hz |
| Melody low-pass | none | `min(2400, hz × 6)` on every voice |

The 2–5 kHz band is where the ear is most sensitive and where "abrasive" lives.
Nothing melodic goes there, and the one-off transient that does (the metallic
`edge` on a struck plate) is 90 ms long and rides the note rather than sitting on
top of the music at a pitch nothing else is at.

### Attacks — 6 ms is a floor, not a target

`game-audio`'s `MIN_ATTACK` is 6 ms and it stops the click. Chill needs more:

| timbre | attack | use |
|---|---|---|
| `bloom` | **180 ms** | bowed, breathed in. Failures and arrivals. Never a transient. |
| `bell` | 14 ms | struck. The melodic default. |
| `pluck` | 10 ms | plucked. |
| impacts | 6 ms | only where the *impact* is the information. |

A failure that is a bloom rather than a buzz is most of what "not cruel" means in
practice, and it costs one number.

### White noise → modelled sound

**24 of 28 games have a noise buffer.** Noise is one event with no size to it,
which is why it reads as hiss rather than as a thing. The founder's example —
a building crumbling — is the recipe:

> **Rubble.** Many small impacts whose sizes follow a power law. Sixteen grains
> over ~340 ms; grain *i* has size `1/(1+i)`; amplitude ∝ size, centre frequency ∝
> 1/size, so a few big low ones and a lot of small high ones. Scatter the onsets
> unevenly. Low-pass the whole cloud at 1.4 kHz. **That distribution is the entire
> difference between "static" and "masonry"**, and it costs sixteen short
> oscillators — which must be budgeted as ONE voice, because it is one gesture.

Implemented in `games/counterweight/src/audio.ts` `rubble()`. The same recipe with
different size exponents is gravel, a collapsing shelf, a wave, a fire.

### Loudness

| | linear peak | ≈ dBFS |
|---|---|---|
| Melodic voice (`MELODY_PEAK`) | 0.14 | −17 |
| Drone, bowed | 0.075 | −22 |
| Drone anchors (sub, fifth) | 0.05 / 0.028 | −26 / −31 |
| Ambient bed (proposed) | ≤ 0.04 | −28 |
| Output ceiling (`game-audio`) | 0.89 | −1 |

The bed must sit ~10 dB under the melody. "Not too loud" is a ratio, not a volume
knob — a bed you notice is a bed that is too loud.

### Always optional

Already true and unchanged: the app's Sound switch closes `game-audio`'s gate after
the ceiling, so muted means silent and not merely quiet, and a game's own mute
cannot reopen a gate a parent closed. Stage 3's bed needs **its own** switch as
well — a parent may reasonably want cues without music, and one setting is the
whole cost.

---

## 5. Never empty

An ambient bed that is always there and never repeats. Three layers, and the point
of each is aperiodicity **by construction** rather than by being long:

1. **Drone.** Root, sub-octave, and the mode's own fifth where it has one. Two
   detuned oscillators per pitch, ~4 cents apart, so the beating gives slow motion
   with nothing repeating.
2. **Pad.** Re-voices on a Poisson schedule (mean ~11 s) onto degrees drawn from
   the mode, weighted to the rest degrees, coloured by tension. Aperiodic by
   definition — there is no loop point because there is no loop.
3. **Air.** A very low-level filtered layer whose filter frequency is the sum of
   three LFOs at 0.013, 0.021 and 0.034 Hz. Deliberately incommensurable: the
   combined pattern's period is longer than any session a child will play.

Cost: about six oscillators and two filters, permanently. Cheaper than one of the
27 games' particle systems.

---

## 6. What is proven, and what is not

**Proven in Node, no device, 45 module tests + 6 in the game + 4 on the wire:**

- Twelve taps produce ≥5 distinct pitches in all 40 seeds tried (today: 1).
- Every pitch every gesture can emit is a degree of the live mode — 60 seeds × 6
  rounds × 8 gestures, exhaustively.
- The four register bands never overlap and nothing is ever folded — 200 seeds ×
  25 steps × 4 weights.
- Ascending steps ascend and descending steps descend, 100/100 seeds.
- A phrase resolves onto a rest degree ≥6 times in 60 taps, all seeds.
- Calm walks by smaller intervals than wound-up.
- The drone takes the fifth iff the mode has one (Dorian yes, whole tone no).
- The same seed is the same music, exactly.
- Malformed wire input can never become a `NaN` frequency.
- The `10 − 2` shortcut descends in 60 of 60 soundscapes.
- Place-value register order holds in 100 of 100 soundscapes.
- Nothing in the shipped pack publishes a soundscape (a source scan, so it fails
  if somebody wires it on by accident).

**Not proven, and needs ears:**

- **Whether it is actually nice.** Thirty-eight modes is a lot of surface and some
  of them will be wrong for a maths game — whole tone under a drone may be
  seasick, Todi may be too strange. The corpus is data; culling is cheap.
- **The rubble recipe on a tablet speaker.** Sixteen grains under 1.4 kHz is
  modelled on paper. A small speaker rolls off below ~300 Hz and may turn it into
  a click.
- **The heaviest register.** 58–117 Hz is a real low clang on headphones and may be
  inaudible on a tablet. The metallic `edge` at hz×3.4 is what carries it; that is
  a hypothesis, not a measurement.
- **Everything in stages 2 and 3.** Not built.

---

## 7. Open questions for the founder

1. **Is the bed the host's or the pack's?** (Stage 3.) **ANSWERED: the host owns
   one bed.** Never a silent gap at a doorway, one continuous piece of music, and
   the shell has music too. The ceiling hole that would have made it unsafe is
   closed; building the bed itself is the next piece of work.
2. **How often does the soundscape rotate?** **ANSWERED, and implemented in
   `dynawalla-app/src/app/soundscape.ts`:**

   * **A fresh key every launch.** The launch seed is drawn once per process, so
     a child who plays for ninety seconds and closes the app still hears a
     different mode tomorrow.
   * **A new key every eight minutes after that** — long enough that a whole run
     at one game sits inside one key, short enough that a long afternoon hears
     five or six.
   * **The key cannot move while a pack owns it.** A change *underneath* a
     child — mid-question, because a timer went off — would slide the drone
     under the plate they are holding, and that is worse than repetition. So the
     app changes key while a child is walking between games and never while they
     are in one. A forty-minute session at a single pack stays in one key on
     purpose; the walker is what keeps that from being the same ding twice.

     This is an invariant of the module rather than a convention the caller
     keeps. `packSettings` re-runs on every settings change — a parent moving
     the text size slider — so "the host remembered to pin it" would be one
     refactor away from a key that rotates under a playing child with nothing
     failing. `soundscapeForPack(packId, now)` hands the same key back to the
     pack that already has it, however often it asks; leaving the stage is what
     lets the next doorway rotate.
   * **Never the same mode twice running.** A uniform draw from 38 repeats about
     one doorway in 38, and a repeat is exactly the "stale and repetitive" the
     brief names. Re-drawing costs one comparison.
   * **Always optional, two ways.** `sound` is total and unchanged — off is
     silent, not quiet. A second switch, **Music**, chooses between the app's
     generative key and the fixed cues a pack shipped with; off publishes
     *nothing*, which is the path a host too old to know about soundscapes
     already takes, and it means "keep your own sounds".

   Still open: `levelComplete` moving the key, which needs the stage 2 feedback
   channel.
3. **Chord progressions.** The brief asks for "many chord progressions to choose
   from" and beatlounge has ~994 generated ones. This design deliberately has
   **none** — a moving progression means the melody's home note moves, and a
   walker that resolves to a tonic that is itself moving is much harder to make
   sound good. Worth it, or is a static drone the more chill answer?
4. **How wide should the corpus be?** 38 now; 130 is a data change (adds the 72
   melakartas, Persian, Turkish). More variety, larger pack payload, more of it
   unvetted.
5. **Should the whole fleet convert at once, or game by game?** All 28 have their
   own `audio.ts`. Converting one is ~40 lines. Converting 28 is a week and a
   fleet-wide behaviour change with no A/B.
6. **Do we cull?** Some modes will not suit a maths game for a nine-year-old. Is
   "every mode is available" a feature, or should there be a chill subset that is
   the default with the rest behind something?

---

## Files

| | |
|---|---|
| Cents and the two conversions | `packs/shared/game-soundscape/pitch.ts` |
| The 38-mode corpus | `packs/shared/game-soundscape/modes.ts` |
| Mode + root + seed + tension, and the wire guard | `packs/shared/game-soundscape/soundscape.ts` |
| The walker, the gestures, the voices | `packs/shared/game-soundscape/melody.ts` |
| The bar as a probability matrix, by mode and density | `packs/shared/game-soundscape/groove.ts` |
| The soundscape the app is in | `packs/shared/game-soundscape/host.ts` |
| The wire field | `packs/sdk/src/protocol.ts` → `Settings.soundscape` |
| Where it is published to a pack | `packs/shared/game-host/index.ts` → `publish()` |
| Which key the app is in, and when it moves | `dynawalla-app/src/app/soundscape.ts` |
| Where it is put on the wire | `dynawalla-app/src/packs/services.ts` → `packSettings()` |
| The doorway that draws one, and gives it back | `dynawalla-app/src/packs/Stage.tsx` |
| THE STEELYARD's whole musical vocabulary | `games/counterweight/src/tune.ts` |
| PULSE's chart, generated from the mode and the density | `games/pulse/src/game/chart.ts` |
| The synthesis, and the rubble recipe | `games/counterweight/src/audio.ts` |
| Where it is turned on, for now | `games/counterweight/src/main.ts` |
| The corpus this was ported from | `corpan/packs/beatlounge/src/music/modes/` |
| The ceiling everything still passes | `packs/shared/game-audio/` |
