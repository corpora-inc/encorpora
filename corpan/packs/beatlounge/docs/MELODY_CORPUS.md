# Melody Corpus — the creation enabler

`src/music/melody/` is a key- AND mode-agnostic, IP-safe library that lets you
**compose without tapping every note**: a bank of melodic contour cells plus two
probability layers that drive endless, non-repeating, LLM-free melody. It is the
data foundation for the score's +/− "layer" dial and the auto-play mode.

Same philosophy as the chords corpus (`docs/CHORDS_CORPUS.md`): everything is a
generic, descriptively-tagged, **generated** theory object. No song, artist, or
album name appears anywhere — the contours are enumerated combinatorially by
shape, not copied.

## Why degrees, not pitches

A melody here is a sequence of **scale-degree indices** read against
`doc.harmony` through the global resolver (`src/music/resolver.ts`). Degree 0 =
the tonic of the working octave; +1 = the next scale step up; −1 = one step down;
an index past the scale size wraps into the next octave at resolve time. So the
SAME datum sings in C-major, D-dorian, or maqam rast — the resolver supplies the
cents/MIDI for whatever scale is live. `degreeToPitch()` is the one place a
degree becomes sound (12-TET MIDI + a residual detune in cents, so non-12-TET
tunings survive).

## The three layers

1. **Contour cells** (`cells.ts` → `CELLS`, 351 of them). Reusable melodic
   SHAPES — ascending, descending, arch, valley, static, zigzag, neighbor,
   enclosure, pendulum, leap-return — each crossed with a few musical rhythm
   templates. The score's +/− dial drops a cell onto a selected row range
   (`transposeCell` / `cellToNotes`).
2. **Metric profiles** (`weights.ts` → `METRIC_PROFILES`). Per-sixteenth onset
   weights within a 4/4 bar: four-on-floor, backbeat, ballad, sixteenths,
   syncopated. The founder's rule holds in every one — **downbeats high, the
   pre-downbeat 32nd ≈ 0** — so generated lines land cleanly. Answers WHEN.
3. **Transition tables** (`weights.ts` → `TRANSITION_TABLES`). Degree→degree
   weight matrices: stepwise, arpeggiac, pentatonic. Stepwise motion is favored,
   chord tones pull as resolutions, the rare leap is allowed. Answers WHICH next
   step. `octaveBias` controls register drift.

## Generation

`generateMelody({table, metric, bars, density, startDegree}, rng)` walks the
metric profile across `bars` bars, firing an onset where `metricWeight × density`
beats the rng, and drawing each onset's degree from the transition table. It is
**deterministic given `rng`** (inject your own seed). The first downbeat always
fires on `startDegree`; `density: 0` collapses to that single note; higher
density fills in. Degrees stay within ~2 octaves of the tonic so the line stays
singable and in range.

## Test gate

`src/music/melody/melody.test.ts` pins the whole contract: cell well-formedness +
family coverage + IP-safe generated ids, metric downbeat-strong / pre-downbeat-~0
rule, transition no-dead-state, the degree→pitch bridge (octave wrap, negatives,
detune for non-12-TET cents), and generation determinism + the density floor.

## Enrichment (optional, later)

The cell bank is algorithmic, so widening coverage (more shapes, odd meters,
longer cells) is a `cells.ts` change with zero migration. A codex pass could
extend the contour enumeration or tune the weight tables; the test gate above is
what any such data must pass before it merges.
