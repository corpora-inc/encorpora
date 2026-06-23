# beatlounge — Harmony Vision

**One global pitch world. Every module vibes on it. Change it once, everything follows.**

Status: DESIGN / RESEARCH. This is for the founder to review *before* implementation. It
proposes an architecture; it is not yet built. TypeScript sketches below are illustrative —
the implementation team should treat them as a starting contract, not final code.

---

## 0. The problem (the founder's framing — honored verbatim)

> "All of this scale/mode/melody/harmony needs to be combined into TOP-LEVEL things that all
> the different modules can vibe on. Not every module should be re-choosing its own mode. We
> don't need one module playing a D harmonic minor and another playing a maqam in C.
> Centralize that decision at the top level — and then if we change it, all the
> players/widgets change too (so if we have the infinite piano player, we can change the song
> chords and it automatically follows along). Ultimately we want things to be EASY for people
> so they're making awesome, satisfying music without even trying hard — and it all sounds
> good together from the global state, not disjoint where every module gets to choose its own
> scale."

Two authoring entry points, **both feeding ONE global active pitch world**:

1. **CHORD-FILL** — "fill in the number of beats in the song/loop with fixed chords to choose
   from (ALL the chords! crazy chords!). If you go this chord route then the mode/scale is
   IMPLIED by the union of all the notes in all the chords."
2. **MODAL** — "choose a thaat / Pythagorean scale / maqam / Western mode and just be in a
   modal system."

And a hard correctness bar:

> "To really do Pythagorean/maqam/thaat correctly we need to FULLY MASTER THE MATH in all
> ways — cents / frequency / ratios — backwards and forwards."

### Where we are today (the disease is real and already in the tree)

The pack already has THREE independent, decentralized scale tables and a fourth ad-hoc key/mode:

| Location | What it defines | Used by |
| --- | --- | --- |
| `src/music/harmony.ts` → `SCALES` | 14 Western modes (12-TET pc offsets) + chords/diatonic | JAM composer |
| `src/music/ribbonScales.ts` → `SCALE_MODES` | 11 modes (slightly different set + ids) + its own `midiToFreq`/`A4` | ribbon |
| `src/modules/piano-roll/pitchModel.ts` → `MAJOR_SCALE` | hardcoded major + own `isInScale` | piano-roll |
| `src/modules/composer/composerState.ts` → `key`/`mode` fields | per-module key + mode | composer only |

So the ribbon can be in `C natural-minor`, the piano-roll silently assumes `C major`, and the
composer is in `Eb dorian` — **simultaneously, with no shared truth.** This document's job is
to delete that divergence: one `doc.harmony`, one resolver, every module reading it.

---

## 1. Vision & principles (the non-negotiables)

1. **One global active pitch world lives on the document.** A single `doc.harmony` field is the
   sole source of truth for tonic, tuning, the modal/chordal choice, and the chord timeline.
2. **No module ever picks its own scale.** Modules *read* the active pitch set through a pure
   resolver. The three duplicate scale tables above collapse into one engine. A module that
   wants "what notes are legal at tick T" calls `activePitches(doc, T)` — it does not own a
   `SCALES` map.
3. **Change-propagates-everywhere, automatically.** Because harmony is on the doc and modules
   subscribe to the doc (existing `CommandBus.subscribe`), changing the global tonic/mode/chords
   re-derives every widget's locked notes on the next render. "Change the song chords → the
   infinite piano player auto-follows" is a *consequence of the architecture*, not a feature we
   wire per-widget.
4. **Effortless good-sounding results.** Defaults are musical. The user is *never required* to
   understand cents or maqam to make something that sounds good together. The hard math is
   available to the curious and invisible to everyone else.
5. **Two editors, one model.** CHORD-FILL and MODAL are not two systems — they are two *editors*
   over the same resolved "active pitch set at time T." (§3 resolves the apparent either/or.)
6. **Microtonal-capable from day one in the DATA MODEL, 12-TET-easy in the DEFAULTS.** The
   internal pitch representation must not be 12-TET MIDI integers, or maqam/Pythagorean/thaat
   can never be correct. But a plain Western user must never pay for that generality. (§2, §4.)
7. **Pitch and rhythm are orthogonal global axes.** Harmony (this doc) governs *which pitches*;
   groove/rhythm (a separate workstream, see ROADMAP §6) governs *when things hit*. They compose;
   they do not collide. (§7.)
8. **Honesty about approximation.** Where we approximate (24-TET for maqam, equal-tempered
   thaat), the model records *which tuning* produced a pitch so we can sharpen it later without a
   migration.

---

## 2. The music theory, done correctly

This is the section the founder cares most about. Everything here is verified against cited
sources and stated as exact formulas.

### 2.1 Pitch math foundations — frequency, cents, ratios

A pitch is fundamentally a **frequency** in Hz. Two pitches an octave apart have a 2:1 frequency
ratio. The ear hears pitch *logarithmically*, so we measure intervals in **cents**: there are
**1200 cents per octave**, hence **100 cents per 12-TET semitone**.

The four load-bearing formulas (these are exact — get them right):

```
12-TET semitones → freq:   freq = ref * 2^(semitones / 12)
cents → freq:              freq = ref * 2^(cents / 1200)
ratio → cents:             cents = 1200 * log2(ratio)        =  1200 * ln(ratio)/ln(2)
freq → cents-above-ref:    cents = 1200 * log2(freq / ref)
```

Reference: A4 = **440 Hz** by modern convention, at MIDI note 69. **The reference must be
configurable** — Baroque ensembles use A4 = 415 Hz, some orchestras tune A4 = 442/443 Hz, and a
drone-based raga/maqam session is anchored to whatever Sa/qarar the player picks, not to A=440.
So we store `reference: { hz, midi }` (default `{ hz: 440, midi: 69 }`) and derive everything from
it.

MIDI-note ↔ frequency, for the 12-TET fast path:

```
midiToFreq(m) = ref.hz * 2^((m - ref.midi) / 12)
freqToMidi(f) = ref.midi + 12 * log2(f / ref.hz)
```

These already exist in `ribbonScales.ts` (`midiToFreq`/`freqToMidi`) — they move into the shared
engine and become reference-aware.

**Cents are the universal currency.** Every tuning system below ultimately produces a function
`degree → cents-above-tonic`. Once we have cents, frequency is one formula away. This is why the
internal representation (§2.7, §4) is *cents-from-tonic*, not MIDI integers.

### 2.2 Equal temperament vs Just Intonation vs Pythagorean

All three answer the same question — "how many cents above the tonic is each degree?" — and
*disagree*. We model each as a `degree → cents` mapping so a module never needs to know which one
is active.

**12-TET (equal temperament).** Every semitone is exactly 100 cents (the 12th root of 2,
`2^(1/12) ≈ 1.05946`). Simple, closes the octave perfectly, but every interval except the octave
is slightly "out of tune" relative to small-integer ratios. This is the Western default and our
easy path.

**Just Intonation (JI).** Intervals are *exact small-integer frequency ratios*, which beat-free
and "pure" to the ear. A justly-tuned major scale:

| Degree | Ratio | Cents (= 1200·log2 ratio) |
| --- | --- | --- |
| Unison | 1/1 | 0.00 |
| Major 2nd | 9/8 | 203.91 |
| Major 3rd | 5/4 | 386.31 |
| Perfect 4th | 4/3 | 498.04 |
| Perfect 5th | 3/2 | 701.96 |
| Major 6th | 5/3 | 884.36 |
| Major 7th | 15/8 | 1088.27 |
| Octave | 2/1 | 1200.00 |

Note the JI major third (386.31¢) is **~14¢ flatter** than the 12-TET major third (400¢) — that's
the audible "purity" of just thirds.

**Pythagorean tuning.** Build every pitch by stacking **pure perfect fifths (3:2 = 701.955¢)** and
reducing by octaves. Twelve fifths "should" equal seven octaves but overshoot by the **Pythagorean
comma = 3^12 / 2^19 = 531441/524288 ≈ 23.46 cents** ([Wikipedia: Pythagorean
comma](https://en.wikipedia.org/wiki/Pythagorean_comma)). The Pythagorean diatonic major scale:

| Degree | Ratio (powers of 3/2, octave-reduced) | Cents |
| --- | --- | --- |
| Unison | 1/1 | 0.00 |
| Major 2nd | 9/8 | 203.91 |
| Major 3rd | 81/64 | 407.82 |
| Perfect 4th | 4/3 | 498.04 |
| Perfect 5th | 3/2 | 701.96 |
| Major 6th | 27/16 | 905.87 |
| Major 7th | 243/128 | 1109.78 |
| Octave | 2/1 | 1200.00 |

The Pythagorean major third (81/64 = 407.82¢) is **~22¢ SHARPER** than the just third (5/4 =
386.31¢). That difference is the **syntonic comma = 81/80 ≈ 21.51 cents** ([microtonal.miraheze:
Syntonic comma](https://microtonal.miraheze.org/wiki/Syntonic_comma)). So the three systems
genuinely differ, audibly, on the same scale degree:

| Major 3rd in… | Cents | vs 12-TET |
| --- | --- | --- |
| Just (5/4) | 386.31 | −13.69¢ |
| 12-TET | 400.00 | 0 |
| Pythagorean (81/64) | 407.82 | +7.82¢ |

**Representation.** Each system is just a `Tuning` that maps a degree (or a 12-TET semitone class)
to cents-above-tonic. The fifth, fourth and octave nearly coincide across all three (the 4th/5th
differ by only ~2¢); thirds and sixths are where they diverge. Storing cents (not MIDI) lets us
honor that.

### 2.3 Western modes (12-TET degree sets)

The diatonic modes and the common minor variants, as semitone offsets from the tonic (these match
the existing `harmony.ts` `SCALES` — we keep them, they become the 12-TET tunings):

| Mode | Offsets (semitones from tonic) |
| --- | --- |
| Ionian (major) | 0 2 4 5 7 9 11 |
| Dorian | 0 2 3 5 7 9 10 |
| Phrygian | 0 1 3 5 7 8 10 |
| Lydian | 0 2 4 6 7 9 11 |
| Mixolydian | 0 2 4 5 7 9 10 |
| Aeolian (natural minor) | 0 2 3 5 7 8 10 |
| Locrian | 0 1 3 5 6 8 10 |
| Harmonic minor | 0 2 3 5 7 8 11 |
| Melodic minor (asc.) | 0 2 3 5 7 9 11 |
| Major / minor pentatonic, blues, whole-tone, chromatic | (as in `SCALES`) |

In 12-TET these become `degree → cents` by `cents = 100 · semitone`. The same offset list,
rendered through a JI or Pythagorean `Tuning`, yields the just/Pythagorean version of the mode for
free — that's the payoff of the cents representation.

### 2.4 Arabic maqam — the quarter-tone reality

A maqam is built from **ajnas** (singular **jins**): 3–5-note melodic cells (tetrachords/
trichords/pentachords) stacked, usually a lower jins + an upper jins sharing or adjoining a
pivot. The defining feature is **neutral (half-flat / half-sharp) intervals** that sit *between*
the Western chromatic pitches.

The pan-Arab pedagogical convention quantizes to **24-TET** — 24 equal quarter-tones, each
**50 cents** ([microtonaltheory.com](https://www.microtonaltheory.com/), [ethnicmusical.com maqam
guide](https://www.ethnicmusical.com/blog/maqam-music-for-beginners/)). A "half-flat" lowers a note
by 50¢; a three-quarter-tone is 150¢.

**Jins Rast** (the archetypal lower jins, on C): C – D – **E half-flat** – F. In 24-TET quarter-tone
steps that's `0, +200, +350, +500` cents (intervals 1, ¾, ¾ tone). Maqam Rast = Jins Rast on the
tonic + Jins Nahawand on the 5th (G – A – Bb – C):

```
Maqam Rast (24-TET approx), tonic = C:
  C    D    E½b   F    G    A    B½b   C
  0   200   350  500  700  900  1050 1200   cents above tonic
```

**Jins Bayati** (on D): D – **E half-flat** – F – G → `0, +150, +300, +500` cents (¾, ¾, 1 tone).

**The honesty caveat — 24-TET is an APPROXIMATION, and a contested one.** Real maqam intonation is
*regional and performer-dependent*: the neutral third of Rast is often played nearer the
**justly-derived ~355–366¢ or even the 11/9 neutral third (347¢)**, not exactly 350¢; Syrian vs
Egyptian vs Turkish practice differ; Turkish makam uses a *different* comma-based system (Holdrian,
53-TET-ish) entirely. So:

- 24-TET (50¢ grid) is a *correct, teachable first approximation* and the right v1 default — it's
  what most pedagogy and notation use.
- Because our representation is **cents, not a 24-step integer**, we can store a maqam as exact
  cents and later swap in a ratio-derived or regional tuning **without any data migration** — the
  jins just carries different cents. We will model jins as `degree → cents` lists so a "Rast
  (Egyptian)" preset and a "Rast (24-TET)" preset are the same shape with different numbers.

This is the key design decision the cents-representation buys us: **24-TET now, exact later, no
migration.**

### 2.5 Hindustani thaat → raga and Carnatic melakarta → janya (terminology MATTERS)

The founder flagged this and the distinction is real ([tiwariacademy: thaat vs
melakarta](https://discussion.tiwariacademy.com/question/what-differentiates-a-thaat-from-a-melakarta-in-raga-classification/),
[ragajunglism: thaat](https://ragajunglism.org/ragas/thaat/)):

- **Hindustani: 10 thaats.** A *thaat* is a parent scale used only to **classify** ragas — a thaat
  is *not itself performed*. Each thaat is a 7-note (sampoorna) scale; **many ragas** map to one
  thaat (e.g. Bilawal thaat = all-natural notes; Kafi, Bhairav, etc.). The system is Bhatkhande's.
- **Carnatic: 72 melakartas.** A *melakarta* is a complete **parent raga** (it *can* be performed),
  exhaustively enumerated as 72 by combinatorics over the svara positions. Each melakarta has
  **many janya ("derived") ragas** that take subsets / different ascending–descending paths.

So the correct mapping the founder supplied: **Thaats have many ragas; Melakartas have many janya
ragas.** They are *not* synonyms — a thaat is a classifier, a melakarta is a performable parent.
The classic equivalence noted in the literature: Hindustani **Bilawal** thaat ≈ Carnatic
**Dheerashankarabharanam** (29th melakarta) — both the all-natural major scale.

**The 12-svara framework + shruti.** Both systems share a **12-semitone framework** with the svara
names **Sa Re Ga Ma Pa Dha Ni** (Hindustani), where 4 positions take two variants (komal/tivra) →
the 12 positions; Carnatic names 16 svara-*sthanas* over the same 12 pitches (4 pitches carry two
names). Underneath sits the older **shruti** system (commonly cited as 22 micro-intervals per
octave) — these are *micro-inflections* (just-intonation-ish ratio placements + ornament-dependent
bends), **not** an equal 22-EDO grid.

**What to model now vs later:**
- **v1: model the 12-svara skeleton.** A thaat / melakarta is a 7-of-12 selection (`degree →
  cents` in 12-TET) — directly analogous to a Western mode. This already gives the user "be in
  Bhairav" or "be in a melakarta scale" with correct *note choices*, which is 90% of the perceived
  value and 100% buildable now.
- **Later: shruti micro-inflection.** Render the svaras through a JI/shruti `Tuning` (Sa–Pa pure
  5th, Ga/Ni from ratios) for authentic intonation, and — *much* later, out of scope here —
  raga-grammar behaviors (aroha/avaroha asymmetry, **pakad** signature phrase, **vadi/samvadi**
  emphasis, gamaka ornaments). Those are melodic *grammar*, not just a pitch set, and belong to a
  future "raga engine," not the global harmony field. We note the seam (§9 open questions) but do
  not build it in v1.

### 2.6 Why NOT 12-TET MIDI integers (the representation decision)

If the internal pitch is a `Midi` integer (0..127), maqam's E-half-flat, Pythagorean's +7.82¢
third, and a shruti-inflected Ga are **literally unrepresentable** — they round to the nearest
semitone and the whole "master the math" goal dies. 12-TET MIDI is a *lossy projection* of the
pitch world, fine as a *fast path* but wrong as *the model*.

### 2.7 Recommended internal pitch representation

**A pitch is `cents-from-tonic` (a real number), resolvable to absolute Hz via the tonic + the
configurable reference.** Equivalently we carry an optional absolute `freq` for samples whose
pitch we measured rather than computed.

```ts
/** The canonical microtonal pitch. 12-TET is just cents that happen to be multiples of 100. */
export interface Pitch {
  /** Cents above the active tonic. 0 = tonic, 1200 = octave. May be fractional/negative. */
  cents: number
}
```

- 12-TET stays trivial: semitone *s* above tonic ⇒ `cents = 100·s`. A C-major scale is
  `[0,200,400,500,700,900,1100]`. No one authoring Western music ever sees a non-round number.
- Maqam/Pythagorean/JI/shruti are *exactly* representable — they're just other cents values.
- Absolute frequency is one formula from cents: `hz = tonicHz · 2^(cents/1200)`.
- MIDI in/out (for soundfonts, the GrainPlayer detune, MIDI export) is a boundary concern: convert
  cents→freq→fractional-MIDI at the audio edge, where fractional MIDI = detune. The model stays
  exact; only the synth rounds (or detunes) as its engine allows.

**We keep `NoteEvent.pitch: Midi` as the stored, edited, 12-TET-friendly value** (no doc
migration, MIDI import/export unbroken). The harmony engine adds a *parallel exact channel*:
`degreeToCents(...)` / `centsToFreq(...)` / `quantizeToHarmony(...)`. A pure-Western track lives
entirely in the integer world; only when a microtonal tuning/maqam is active does a melodic
instrument resolve its note through cents→freq→detune. This is the pragmatic bridge: **exact model,
integer-friendly authoring, detune at the edge.**

---

## 3. How the two entry points unify (resolving the founder's either/or)

The founder offered CHORD-FILL and MODAL as alternatives ("If you go this chord route…" /
"Alternatively…"). They are **not** alternatives in the *model* — they are **two editors over one
resolver**. Both must produce the same thing the rest of the app consumes:

> **the "active pitch set" at a given time T** — the ordered set of legal/preferred pitches
> (as cents-from-tonic), plus the *chord-of-the-moment* if one is defined.

### 3.1 MODAL → active pitch set

Trivial: the active set is the chosen tuning's scale, time-invariant. `activePitches(T)` returns
the same scale degrees at every T. There may be no `chordAt(T)` (pure modal/drone), or the engine
can offer diatonic triads on demand (we already have `diatonicTriads`).

### 3.2 CHORD-FILL → active pitch set (the implied scale)

A chord progression is a **time-addressed chord timeline** (chords at ticks, exactly like the
existing `tempoMap`/`meterMap`/`progression.ts` model — comma-is-a-beat). Two derived quantities:

- **`chordAt(T)`** — the chord sounding at tick T (the *vertical* harmony; what an arpeggiator,
  a comping piano, or "lock to chord tones" reads).
- **`activePitches(T)`** — the *implied scale at T*. The founder's rule: **the mode/scale is the
  UNION of all the notes in all the chords.** Two useful granularities, both supported:
  - *Local* implied set: union of the current chord's tones + the tones of its neighbors (a
    smooth, slightly-wider-than-the-chord palette for melody) — good for "play over this chord."
  - *Global* implied set: the union of **all** chord tones across the whole loop, collapsed to
    pitch-classes → the song's overall scale. This is exactly "the mode is implied by all the
    chords." `Cmaj7 → Dm7 → G7 → Cmaj7` unions to `{C D E F G A B}` = C major; a "crazy chord"
    progression unions to a richer (possibly 8–12-note) palette, which is *correct* — the founder
    said "ALL the chords! crazy chords!" and the union honoring that is the point.

So as the chord progression changes across the loop, `chordAt(T)` changes beat-by-beat while
`activePitches(T)` can be either the local moving palette or the stable global implied scale —
the resolver exposes both; modules choose which they want (a ribbon wants the stable global scale
so it never feels like the frets are jumping; an arpeggiator wants `chordAt(T)`).

### 3.3 The unification

```
   MODAL editor ─┐                                  ┌─ activePitches(T)   (ribbon, piano-roll highlight, generative scale-lock)
                 ├──►  doc.harmony  ──► resolver ──► ┤
 CHORD-FILL editor┘     (one field)                  └─ chordAt(T)        (arp, comp, "lock to chord tones")
```

`doc.harmony` carries `mode: HarmonyMode = "modal" | "chordal"` plus *both* a `scale` (for modal)
and a `progression` (for chordal). The resolver reads `mode` and answers `activePitches`/`chordAt`
accordingly. Switching editors is one command (`setHarmonyMode`). **Crucially: every module calls
the resolver, never the editor** — so a module doesn't know or care whether the user authored via
chords or via a mode. That is the whole game.

(We can even keep both populated: a user can pick a mode AND drop chords; "chordal" just means
"derive the active set from the chords," "modal" means "from the scale." The fields coexist; `mode`
selects the resolver branch.)

---

## 4. Proposed data model + resolver API

Designed to fit the existing `BeatloungeDoc` (plain JSON, tick-addressed, PPQ ticks,
`tempoMap`/`meterMap` precedent, `ParamTarget` style) and the pure-reducer / command-bus
architecture. **One global `harmony` field; one command set; modules read via the resolver.**

### 4.1 Types (add to `src/model/document.ts`)

```ts
// -------------------------------------------------------------- tuning
/** Built-in tuning systems. A tuning answers "degree → cents above tonic". */
export type TuningSystemId =
  | "equal12"        // 12-TET — the default, every semitone 100¢
  | "just"           // 5-limit just intonation
  | "pythagorean"    // stacked 3:2 fifths
  | "equal24"        // 24-TET quarter-tone grid (maqam approximation)
  | "custom"         // explicit cents table (user / preset / future regional maqam)

export interface TuningSystem {
  id: TuningSystemId
  /** Reference pitch the whole tuning is anchored to. Default {hz:440, midi:69}. */
  reference: { hz: number; midi: number }
  /**
   * For "custom": explicit cents-above-tonic for each scale degree (length = scale size).
   * For built-ins this is omitted — the engine generates cents from the system + scale.
   */
  centsTable?: number[]
}

// -------------------------------------------------------------- scale / mode
/** A pitch-set family the active world can be in (Western + world systems). */
export type ScaleFamily =
  | { kind: "western"; mode: ScaleName }                 // reuse harmony.ts ScaleName
  | { kind: "maqam"; name: MaqamName }                   // jins-built, neutral degrees
  | { kind: "thaat"; name: ThaatName }                   // Hindustani 10
  | { kind: "melakarta"; index: number /*1..72*/ }       // Carnatic parent raga
  | { kind: "custom"; semitonesOrCents: number[]; unit: "semitone" | "cents" }

export interface Scale {
  /** Tonic as a pitch class 0..11 (Sa / qarar / do). */
  tonic: PitchClass
  family: ScaleFamily
  /** How the abstract degrees are intonated. Default equal12. */
  tuning: TuningSystem
}

// -------------------------------------------------------------- chords on a timeline
/** A chord placed at a tick — same addressing as NoteEvent / TempoEvent. */
export interface ChordEvent {
  id: Id
  tick: Tick
  /** Duration in ticks the chord sustains (until next chord, by default). */
  duration: Tick
  /** Chord SYMBOL ("Cmaj7", "Dm7b5") — parsed by harmony.parseChord (forgiving). */
  symbol: string
}

export interface ChordProgression {
  /** Sorted by tick. Empty ⇒ pure modal. */
  chords: ChordEvent[]
}

// -------------------------------------------------------------- the global field
export type HarmonyMode = "modal" | "chordal"

/** Strategy for the "implied scale" derived from chords (§3.2). */
export type ImpliedScaleScope = "globalUnion" | "localWindow"

export interface Harmony {
  /** Which editor's output the resolver consumes. */
  mode: HarmonyMode
  /** The active scale (used directly when mode==="modal"; the chord-derived
   *  implied scale snaps toward this tonic when mode==="chordal"). */
  scale: Scale
  /** Tick-addressed chord timeline (used when mode==="chordal"). */
  progression: ChordProgression
  /** How chordal mode derives activePitches(). Default "globalUnion". */
  impliedScope: ImpliedScaleScope
}

// added to BeatloungeDoc:
//   harmony: Harmony
```

`MaqamName`, `ThaatName` are closed string unions backed by `degree → cents` preset tables in a new
`src/music/worldScales.ts` (jins library + thaat/melakarta selections). 12-TET fast path: a
`western` family with an `equal12` tuning never computes a non-integer.

### 4.2 The resolver API (the ONE thing modules call)

A pure module, `src/music/resolver.ts`, depending only on `Harmony` (+ `Tick`). No React, no audio
— exhaustively testable, exactly like `harmony.ts`/`progression.ts` today.

```ts
/** The active vertical chord at a tick (chordal mode), or null (pure modal). */
export function chordAt(h: Harmony, tick: Tick): Chord | null

/**
 * The active pitch set at a tick, as cents-above-tonic (the universal currency).
 * - modal:   the scale degrees (time-invariant).
 * - chordal: the implied scale per h.impliedScope (§3.2).
 */
export function activePitches(h: Harmony, tick: Tick): { tonicPc: PitchClass; cents: number[] }

/** Convenience: the active set as concrete MIDI (12-TET projection) in a register window —
 *  what the ribbon/piano-roll draw as legal rows/frets. Rounds microtones to nearest semitone. */
export function activeMidiInRange(h: Harmony, tick: Tick, loMidi: number, hiMidi: number): number[]

/** Snap an arbitrary input (a continuous MIDI from the ribbon, or a freehand note) to the
 *  nearest legal pitch of the active harmony at this tick. Returns BOTH the rounded MIDI (for
 *  storage in NoteEvent.pitch) and the exact cents/freq (for microtonal playback). */
export function quantizeToHarmony(
  h: Harmony,
  midiOrFreq: { midi: number } | { freq: number },
  tick: Tick
): { midi: number; cents: number; freq: number }

/** Degree (0-based index into the active scale) → exact cents-above-tonic, honoring the tuning. */
export function degreeToCents(h: Harmony, degree: number): number
/** Degree → absolute frequency (Hz), via tonic + reference. */
export function degreeToFreq(h: Harmony, degree: number, octave: number): number

/** Cents-above-tonic → absolute Hz (the boundary helper the audio edge calls). */
export function centsToFreq(h: Harmony, cents: number, octave: number): number
```

### 4.3 Commands (add to `src/model/command.ts` — the ONE write path)

```ts
  // ---- harmony (global pitch world) ----
  | { t: "setHarmonyMode"; mode: HarmonyMode }
  | { t: "setTonic"; pc: PitchClass }
  | { t: "setScale"; family: ScaleFamily }              // pick Western mode / maqam / thaat / melakarta
  | { t: "setTuning"; tuning: TuningSystem }             // equal12 | just | pythagorean | equal24 | custom
  | { t: "setReference"; hz: number; midi?: number }     // A4=440 / 442 / drone anchor
  | { t: "setImpliedScope"; scope: ImpliedScaleScope }
  // chord timeline (chordal editor) — tick-addressed like notes:
  | { t: "setProgression"; chords: Omit<ChordEvent, "id">[] }   // bulk (chord-fill / parse text)
  | { t: "addChord"; chord: Omit<ChordEvent, "id"> }
  | { t: "removeChord"; chordId: Id }
  | { t: "editChord"; chordId: Id; patch: Partial<Omit<ChordEvent, "id">> }
```

The existing `src/music/progression.ts` comma-is-a-beat parser feeds `setProgression` (text →
`ChordEvent[]` by converting beats→ticks at PPQ). The existing `composerState.ts` `key`/`mode`
fields are **deleted** — the composer reads `doc.harmony` like everyone else (§5).

### 4.4 Migration

Additive + safe. `loadDoc` defaults a missing `harmony` to `{ mode:"modal", scale:{ tonic:0,
family:{kind:"western",mode:"major"}, tuning:{id:"equal12", reference:{hz:440,midi:69}} },
progression:{chords:[]}, impliedScope:"globalUnion" }` (C-major, 12-TET, A=440). Old docs open
sounding identical. `NoteEvent.pitch: Midi` is unchanged — no note migration.

---

## 5. Propagation — "change the chords, the piano player follows"

The mechanism is the architecture, not bespoke wiring:

1. The user changes harmony via a command (`setScale`, `setProgression`, `setTonic`, …). The
   command bus reduces it into a new `doc` (structural sharing) and notifies subscribers
   (`CommandBus.subscribe` — already exists).
2. Every module already subscribes to the doc to re-render. On the next render each module
   **re-derives its harmony-dependent view by calling the resolver** with the new `doc.harmony`:
   - **piano-roll**: `buildRows(...)` takes its `inScale`/`tonic` highlight from
     `activePitches(doc.harmony, tick)` instead of its hardcoded `MAJOR_SCALE`. Change the mode →
     the highlighted rows change instantly. (`pitchModel.ts` loses `MAJOR_SCALE`.)
   - **ribbon ("infinite piano player")**: `ribbonFrets(...)` / `xToScaleNote(...)` pull the fret
     set and snap target from `activeMidiInRange(doc.harmony, tick, lo, hi)`. Change the chords →
     the frets re-lay-out and the next note the player slides to is in the new harmony. This is
     *literally* "change the song chords and the infinite piano player automatically follows."
     (`ribbonScales.ts` loses its private `SCALE_MODES` and `A4`; tuning/reference now come from
     `doc.harmony.scale.tuning`.)
   - **composer / JAM**: `composeCommands` reads tonic/scale/progression from `doc.harmony` rather
     than its own `key`/`mode`/`text`. Re-roll respects the global harmony.
   - **generative fills / agents**: any "make a melody / arp / bass" action snaps its candidate
     pitches through `quantizeToHarmony(doc.harmony, …, tick)` so generated notes are in-harmony by
     construction.
   - **instruments with a keyboard** (synth-analog `Keyboard`): can highlight/lock to
     `activePitches`, optionally microtonally retune held notes via `centsToFreq` when a non-12-TET
     tuning is active.
3. **No module stores its own scale.** The single rule that makes the whole vision true:
   *the only place a scale/tonic/tuning/chord lives is `doc.harmony`; every consumer is derived.*
   This deletes the three duplicate tables (§0) and makes divergence structurally impossible.

For **microtonal playback**, locked notes carry their exact pitch to the audio edge: a melodic
voice resolves `NoteEvent.pitch` (its 12-TET anchor) → `quantizeToHarmony` → `{cents, freq}` →
GrainPlayer/synth detune (cents → ratio). In 12-TET the detune is 0 and nothing changes; in
maqam/Pythagorean the voice bends to the true pitch. The doc stays integer-MIDI; the *sound* is
exact.

---

## 6. Which modules LOCK to harmony, which DON'T

The founder's own insight: for **phrase samples (TTS) we don't know the base pitch**, so
pitch-quantizing them to a scale is "a fool's errand." Pitch-snapping audio of unknown fundamental
just produces an arbitrary, often-wrong shift. So harmony locking is **only** for voices whose
pitch we *know* (we generate it). Phrase/scratch widgets get *performance* freedom (pitch-shift,
scratch, stretch) instead of *correctness* locking.

| Module | Relationship to global harmony |
| --- | --- |
| **piano-roll** | **Reads** — highlights in-scale rows, optional snap-on-draw; notes stored as MIDI |
| **ribbon ("infinite piano")** | **Locks** — frets = active pitch set; fretless glide can quantize-on-release; auto-follows chords |
| **composer / JAM** | **Reads** — generates over `doc.harmony` tonic+scale+progression (its own key/mode deleted) |
| **synth-analog keyboard** | **Reads / optional lock** — can highlight scale + microtonally retune via cents |
| **drum-pads / step-grid (drums)** | **Ignores** — drum "pitch" is a pad index, not harmonic pitch; never locked |
| **generative fills / tweaker agents (note-gen)** | **Locks** — candidate notes pass through `quantizeToHarmony` |
| **phrase-sampler** | **Does NOT lock** — unknown base pitch; `pitchSemis` is a *performance* offset, not a scale snap |
| **phrase-jam** | **Does NOT lock** — same; rhythmic/scratch performance over the phrase |
| **fx-rack / mixer / modulators** | **N/A** — no pitch semantics |

A subtle "opt-in" for phrase samples (future, not v1): IF we ever *measure* a phrase's fundamental
(pitch detection on the rendered TTS buffer), it *could* opt into harmony — but that's a measured
`freq`, fed through `quantizeToHarmony({freq}, …)`, never a blind semitone snap. Flagged in §9.

---

## 7. Relationship to the RHYTHM axis (orthogonal)

Harmony answers **which pitches**; **rhythm/groove** answers **when things hit** (clave, samba,
tango, maqsoum, reggaeton — the traditional-rhythm library in ROADMAP §6). They are **independent
global axes** and must never be conflated:

- `doc.harmony` = the pitch world (this document).
- a future `doc.groove` (separate workstream) = the time world: a named groove/feel preset
  (swing, accent map, microtiming template) applied across tracks, analogous to how harmony is
  applied across tracks.

They compose cleanly because they touch *different fields of the same event*: harmony governs
`NoteEvent.pitch` (and its microtonal resolution); groove governs `tick` / `micro` / `velocity`.
"Apply a tango + these chords + scramble the phrases" = (groove preset) × (harmony progression) ×
(phrase-sampler performance) — three orthogonal global systems layered over the one tick-addressed
doc, no collision. The only shared substrate is the tick grid + PPQ, which both already respect.
This document deliberately scopes *only* harmony; it just guarantees the seam (a parallel
`doc.groove`) stays clean.

---

## 8. Phased implementation plan

Each phase is a shippable checkpoint that already improves the product.

**Phase 1 — Pitch-math core + 12-TET global modal state (the foundation).**
- New `src/music/tuning.ts`: cents/ratio/freq engine — the four formulas (§2.1), reference-aware
  `midiToFreq`/`freqToMidi` (moved from `ribbonScales.ts`), `TuningSystem` for `equal12`/`just`/
  `pythagorean`, with exhaustive tests asserting the cited cents (Pythagorean 3rd 407.82¢, just 3rd
  386.31¢, comma 23.46¢). This is where "master the math" is proven by tests.
- Add `doc.harmony` (modal-only first), `setTonic`/`setScale`/`setTuning`/`setReference` commands,
  resolver `activePitches`/`activeMidiInRange`.
- **Make ONE module follow it: the ribbon.** Delete `ribbonScales.ts`'s private `SCALE_MODES`/`A4`;
  point it at the resolver. Now changing the global tonic/mode visibly moves the frets. *Smallest
  end-to-end proof of the whole vision.*
- *Checkpoint:* global mode picker → ribbon re-frets. Risk: low (modal 12-TET is well-trodden).

**Phase 2 — Propagate to all melodic modules.**
- piano-roll highlight, synth-analog keyboard, composer/JAM all read `doc.harmony`; delete their
  private scale tables / key+mode fields. Generative fills route through `quantizeToHarmony`.
- *Checkpoint:* every melodic widget visibly follows one global mode change. Risk: medium — the
  composer rework (its key/mode/text are load-bearing); keep `progression.ts`/`jam.ts` intact,
  only re-source their inputs.

**Phase 3 — CHORD-FILL editor + implied-scale resolver.**
- `ChordProgression` on `doc.harmony`, `setProgression`/`addChord`/… commands, `chordAt(T)` and the
  union-implied `activePitches` (§3.2). Wire `progression.ts` (comma-is-a-beat) into chord-fill.
  Build the "fill N beats with chords" UI (the composer module is the natural home).
- Make the ribbon/arp consume `chordAt` so "change the chords → the player follows the changing
  harmony across the loop" is live.
- *Checkpoint:* type a progression → modes/frets across the loop reflect the union; arp follows the
  chord-of-the-moment. Risk: medium — defining "good" local vs global implied set; default to
  global union (matches the founder's words), expose local as an option.

**Phase 4 — Microtonal systems (maqam, then thaat/melakarta).**
- `equal24` tuning + `src/music/worldScales.ts` jins library → maqam scales as exact cents; the
  audio-edge cents→detune path so melodic voices bend to neutral pitches. Then the 10 thaats / 72
  melakartas as 12-svara selections (12-TET first; shruti/JI tuning later).
- *Checkpoint:* select "Maqam Rast" → ribbon frets land on E-half-flat and the synth *plays* it in
  tune. Risk: medium-high — the detune path on every melodic engine (GrainPlayer detune exists;
  soundfont/spessasynth microtuning needs verification — see §9). Honesty: 24-TET first, regional
  presets later, no migration (cents representation guarantees this).

**Phase 5 — Polish + "effortless."**
- Smart defaults, a one-tap "make it sound good" that picks a pleasing mode/progression, LLM tool
  bindings for the new harmony commands (so "put this in D Dorian" / "give me a jazzy turnaround"
  works), and the composer chord-fill UX refinement. Risk: low (additive over a solid base).

**Cross-cutting risks.** (a) The microtonal *playback* path is the real engineering risk —
authoring/visualizing microtones is easy, making every instrument engine *sound* them in tune is
the work (detune support varies by engine). De-risk by shipping Phases 1–3 fully in 12-TET first;
microtonal data is correct from Phase 1 even if a given synth can't yet sound it. (b) Deleting the
duplicate scale tables touches several modules at once — do it module-by-module behind the resolver
so each is independently verifiable. (c) The implied-scale "feel" (local vs global) is a taste
call; ship global-union as default and iterate.

---

## 9. Open questions for the founder (decisions needed)

1. **How far into microtonality for v1?** Recommendation: **24-TET maqam + 12-TET thaat/melakarta
   in v1; just/Pythagorean as selectable tunings; shruti/regional-maqam/raga-grammar deferred.**
   The cents representation means we can sharpen later with zero migration — but how loud should
   "authentic intonation" be in the first release vs. "correct note choices"?
2. **Default reference pitch.** A4 = 440 confirmed as default? And do we expose reference/tonic-Hz
   to the user in v1 (drone-anchored maqam/raga sessions want it), or keep it advanced?
3. **Default editor — CHORD-FILL or MODAL?** For a brand-new song, does the harmony panel open on
   "pick a mode" (modal) or "fill beats with chords" (chordal)? Recommendation: **default MODAL =
   C major** (zero-friction "just play"), with a prominent one-tap to chord-fill — but you may want
   chord-fill front-and-center since "all the crazy chords" is the headline.
4. **Implied-scale scope default.** When in chordal mode, should the ribbon/piano-roll show the
   **global union** of all chords (stable, never-jumping frets) or the **local moving** palette
   (tracks the current chord)? Recommendation: **global union as the visible scale**, `chordAt` for
   arps/comping. Confirm?
5. **"Crazy chords" → wide unions.** A deliberately chromatic progression can union to a 9–12-note
   "scale." Is that the desired behavior (maximum freedom, the founder's stated intent), or do we
   want a "tighten to the strongest N notes" option so the implied palette stays singable?
6. **Raga-specific behavior scope.** Confirm that **pakad / vadi-samvadi / aroha-avaroha asymmetry
   / gamaka** are explicitly OUT of the harmony field (a future "raga engine" of melodic grammar),
   and v1 raga support = the parent scale's pitch set only. (This keeps `doc.harmony` a *pitch-set*
   field, not a *grammar* field.)
7. **Phrase-sample pitch detection (future).** Do you want to eventually pitch-detect rendered TTS
   buffers so a phrase *can* opt into harmony (measured `freq` → `quantizeToHarmony`), or keep
   phrases permanently in the "performance, not scale-lock" lane? (v1 = the latter, per your "fool's
   errand" note.)
8. **Per-track tuning override?** Global harmony is the rule. Do we ever want a single track to
   opt *out* (e.g. a drone in a different tuning), or is one global tuning strictly enforced? (Lean:
   one global tuning in v1; per-track override is a clean later addition.)

---

## Sources

- Pythagorean comma (3¹²/2¹⁹ ≈ 23.46¢): [Wikipedia — Pythagorean
  comma](https://en.wikipedia.org/wiki/Pythagorean_comma)
- Syntonic comma (81/80 ≈ 21.51¢): [Microtonal Encyclopedia — Syntonic
  comma](https://microtonal.miraheze.org/wiki/Syntonic_comma)
- Just intonation ratios/cents: [Wikipedia — Just
  intonation](https://en.wikipedia.org/wiki/Just_intonation)
- 24-TET quarter-tone (= 50¢) + Jins Rast / Maqam Rast structure:
  [microtonaltheory.com — Makams and Maqamat](https://www.microtonaltheory.com/microtonal-ethnography/makams-and-maqamat),
  [ethnicmusical.com — Maqam beginner's guide](https://www.ethnicmusical.com/blog/maqam-music-for-beginners/),
  [Wikipedia — Arabic maqam](https://en.wikipedia.org/wiki/Arabic_maqam)
- Thaat (10, classifier, not performed) vs Melakarta (72 parent ragas, performable) + janya + the
  shared 12-svara framework + Bilawal≈Dheerashankarabharanam:
  [Tiwari Academy — thaat vs melakarta](https://discussion.tiwariacademy.com/question/what-differentiates-a-thaat-from-a-melakarta-in-raga-classification/),
  [Rāga Junglism — Thaat](https://ragajunglism.org/ragas/thaat/)
