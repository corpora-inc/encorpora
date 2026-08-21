/**
 * The bar as a probability matrix: which instants in the bar this soundscape
 * likes, and how full it wants the bar to be.
 *
 * The founder's brief for PULSE, and the thing this exists to make true:
 * *"we should see if we could make some probability matrix that makes a nice
 * tune on the beat … when the input is sort of the mode and the desired
 * density."*
 *
 * So there are exactly two inputs and this file has no others: **the mode**,
 * which comes from the soundscape the host published, and **the density**,
 * which the game's escalation owns. Everything else — the grid, the metre, the
 * tension lean — is arithmetic over those two.
 *
 * ## Why a mode has anything to say about rhythm
 *
 * A mode is a set of positions inside a cyclic space of 1200 cents. A bar is a
 * set of positions inside a cyclic space of N beats. Laying one over the other
 * — cents of the octave onto fractions of the bar — is an old compositional
 * device and it is completely honest arithmetic: nothing here claims that Rast
 * *is* a rhythm, only that projecting Rast's degrees onto the bar produces a
 * different set of favoured instants than projecting Hirajoshi's, and that the
 * difference is stable, reproducible and audible.
 *
 * That is the whole trick, and it is what makes the chart different when the
 * app is in a different key without a game ever choosing anything musical for
 * itself. A five-degree pentatonic leaves wide holes in the bar and grooves
 * sparse; a seven-degree maqam with a neutral second favours instants a
 * whole-tone grid never lands on and grooves syncopated. **The affinity is
 * bounded well away from zero on purpose**: the mode colours the bar, it never
 * deletes a slot, so no mode can make a grid unplayable or a subdivision
 * unreachable.
 *
 * ## Why `density` means something exact
 *
 * `density` is the expected number of notes per bar divided by the number of
 * slots in the bar. Not a vibe, not a multiplier that happens to saturate: the
 * matrix is normalised so `sum(p) === max(1, density × slots)` to within
 * rounding. That is what makes "start sparse and stay sparse for longer" a
 * number a test can hold, rather than a hope. The old PULSE generator
 * multiplied a `density` of 0.9 by a metric weight of 1.25 and got 1.125, so
 * every slot fired, every bar, every run — a "density" that had quietly stopped
 * being one.
 *
 * The `max(1, …)` is the downbeat, which is never negotiable: see
 * `grooveMatrix`.
 *
 * There is no Web Audio here and no frequency anywhere: this returns a plan
 * over TIME, exactly as `melody.ts` returns a plan over PITCH.
 */

import { modeOf, type Soundscape } from "./soundscape.ts"

/** What the caller wants a bar of. */
export type GrooveSpec = {
  /** Beats in a bar. Four, in every game that has asked so far. */
  readonly beatsPerBar: number
  /**
   * The per-beat subdivisions in play. `1` is quarters, `2` eighths, `3`
   * triplets, `4` sixteenths. The slot grid is their union, so `[1, 3]` gives a
   * bar a child can feel as quarters with triplets inside them.
   */
  readonly divs: readonly number[]
  /**
   * Expected notes per bar, as a fraction of the slots in the bar. `0` is an
   * empty bar and `1` is every slot. Clamped into `[0, 1]`.
   */
  readonly density: number
}

/**
 * A lean on the bar that is not the mode's and not the metre's.
 *
 * This is the seam `evolve.ts` drifts through, and it is a separate argument
 * rather than a field of `GrooveSpec` because it is a different KIND of thing:
 * a spec is what a stage wants and is written down in the game, while a bias is
 * where a living groove has wandered to and is written down nowhere. Keeping
 * them apart is also what keeps `grooveMatrix` honest — pass no bias and you
 * get the seed matrix, byte for byte, forever, which is the property every test
 * written before drift existed still rests on.
 *
 * **It cannot break either of the matrix's two invariants**, and that is by
 * construction rather than by clamping afterwards. `at` moves an instant's
 * affinity along the interval it was always allowed to occupy — `+1` takes it
 * to exactly 1 and `-1` to exactly `MIN_AFFINITY` — so a drifted bar still
 * colours every instant and still deletes none of them. `openness` may only
 * ever REMOVE expected notes, never add them, so a groove that has wandered can
 * never hand a child a fuller bar than the stage asked for.
 */
export type GrooveBias = {
  /**
   * Beat offset -> lean, `-1..1`. `0`, or a beat that is not in the map, is the
   * mode's own opinion untouched.
   *
   * Keyed by BEAT and not by slot index on purpose. A game changes its
   * subdivisions between stages — PULSE walks `[1]` to `[1,2,3,4]` — so an
   * array indexed by slot would silently re-point every lean at a different
   * instant the moment the grid grew. Beat 1.5 is beat 1.5 in every grid that
   * contains it, and in the grids that do not it is simply not read.
   */
  readonly at: ReadonlyMap<number, number>
  /**
   * How much room to leave in the bar, `0..1`. `0` is the density asked for.
   *
   * Spends down to `MAX_OPENNESS` of the budget and no further, and never up:
   * this exists so a groove can make SPACE, which is a thing music does when a
   * player needs a moment. It is not a difficulty knob and it cannot become
   * one, because the only direction it moves is toward the empty bar the
   * downbeat still anchors.
   */
  readonly openness: number
}

/** One instant in the bar, and how likely this soundscape is to strike it. */
export type GrooveSlot = {
  /** Offset from the bar line, in beats. `0` is the downbeat. */
  readonly beat: number
  /** The smallest per-beat division that lands exactly here. */
  readonly div: number
  /** How strong this instant is metrically, `0..1`. Nothing to do with the mode. */
  readonly metre: number
  /** How much the mode likes this instant, `MIN_AFFINITY..1`. */
  readonly affinity: number
  /** Probability of a note here, `0..1`. The matrix proper. */
  readonly p: number
}

/**
 * The floor under a mode's opinion.
 *
 * A mode may make an instant about three times as likely as another; it may
 * never make one impossible. Zero affinity anywhere would mean a subdivision a
 * child is being taught to feel could silently vanish for a whole session
 * because the app happened to launch in Hirajoshi — and a teaching game whose
 * content depends on a random draw is not a teaching game. PULSE holds the
 * other end of this: `chart.test.ts` asserts that every stage still teaches its
 * own subdivision in every one of the 38 modes.
 */
export const MIN_AFFINITY = 0.35

/** No single slot is ever a certainty except the downbeat. */
const MAX_P = 0.95

/**
 * The most of the density budget a fully-open groove may hand back.
 *
 * A quarter. Enough that a child hears the bar breathe out; far too little for
 * the emptier bar to be worth playing for. A game whose gates get easier the
 * more you miss is a game that teaches missing, so the ceiling is the whole of
 * why this is safe — see `evolve.ts`, which is the only thing that sets it.
 */
export const MAX_OPENNESS = 0.25

/**
 * A mode's opinion about an instant, leaned on by a drift.
 *
 * The mapping is chosen so the bounds hold with no clamp anywhere: at `b = +1`
 * the instant is a full `1`, at `b = -1` it is exactly `MIN_AFFINITY`, and at
 * `b = 0` it is whatever the mode said. That is why a drifted matrix passes the
 * same "a mode colours the bar but can never delete a slot" assertion the
 * undrifted one does, rather than passing it because something clipped.
 */
export function leanAffinity(affinity: number, bias: number): number {
  if (!Number.isFinite(affinity)) return MIN_AFFINITY
  const a = Math.min(1, Math.max(MIN_AFFINITY, affinity))
  const b = Number.isFinite(bias) ? Math.min(1, Math.max(-1, bias)) : 0
  return b >= 0 ? a + b * (1 - a) : a + b * (a - MIN_AFFINITY)
}

const CENTS_PER_OCTAVE = 1200

/**
 * Every instant in the bar the given subdivisions can land on, ascending.
 *
 * Exported because a caller that places notes needs the same grid the matrix
 * was built over, and rebuilding it independently is how two files come to
 * disagree about what a slot is.
 */
export function grooveSlotBeats(beatsPerBar: number, divs: readonly number[]): number[] {
  const beats = Math.max(1, Math.floor(beatsPerBar))
  const set = new Set<number>()
  for (const d of divs) {
    const div = Math.max(1, Math.floor(d))
    for (let k = 0; k < beats * div; k++) set.add(round6((k / div) * 1))
  }
  return [...set].sort((a, b) => a - b)
}

/** The smallest per-beat division that lands exactly on this offset. */
export function divOfBeat(beat: number, divs: readonly number[]): number {
  const sorted = [...divs].map((d) => Math.max(1, Math.floor(d))).sort((a, b) => a - b)
  for (const d of sorted) {
    const x = beat * d
    if (Math.abs(x - Math.round(x)) < 1e-6) return d
  }
  return sorted[sorted.length - 1] ?? 1
}

/**
 * How strong an instant is, before the mode has said anything.
 *
 * The downbeat, then the halfway point, then the other beats, then the
 * subdivisions in order of fineness. This is metre, which is a property of the
 * bar and not of the music in it — which is why it is a pure function of the
 * position and carries no seed, no tempo and no escalation.
 */
export function metreWeight(beat: number, beatsPerBar: number, div: number): number {
  if (beat === 0) return 1
  const onBeat = Math.abs(beat - Math.round(beat)) < 1e-6
  if (onBeat) return Math.abs(beat - beatsPerBar / 2) < 1e-6 ? 0.86 : 0.74
  // A subdivision is worth less the finer it is: 1/2 of a beat reads as part of
  // the pulse, 1/16 of a bar reads as decoration.
  return 0.56 / Math.max(1, Math.log2(div))
}

/**
 * How much this mode likes this instant in the bar.
 *
 * The bar position is read as a fraction of a cycle and projected onto the
 * octave, so beat 1 of 4 is 300 cents and the halfway point is 600. The
 * distance to the nearest degree — measured the short way round the circle,
 * because both spaces are cyclic — is what decides: on a degree is 1, as far
 * from every degree as it is possible to get is `MIN_AFFINITY`.
 *
 * `tension` leans on the mode's own colour degree, exactly as the melody walker
 * does: a wound-up soundscape strikes the instant that makes the mode sound
 * like itself more often. That is the same tension knob, spent in time rather
 * than in pitch, and — like there — it can never take anything out of the mode.
 */
export function modeAffinity(scape: Soundscape, beat: number, beatsPerBar: number): number {
  const mode = modeOf(scape)
  const degrees = mode.degrees
  if (degrees.length === 0) return 1
  const cents = ((beat / Math.max(1, beatsPerBar)) % 1) * CENTS_PER_OCTAVE
  let nearest = CENTS_PER_OCTAVE
  for (const d of degrees) nearest = Math.min(nearest, cyclicCents(cents - d))
  // The worst case is half the widest gap between adjacent degrees, so the
  // normaliser is a property of the mode rather than a constant that happens to
  // suit seven-note scales and crushes pentatonics.
  const worst = Math.max(1, widestHalfGap(degrees))
  const near = 1 - Math.min(1, nearest / worst)
  let a = MIN_AFFINITY + (1 - MIN_AFFINITY) * near

  const colour = degrees[mode.colour]
  if (colour !== undefined) {
    const toColour = cyclicCents(cents - colour)
    const lean = 1 - Math.min(1, toColour / worst)
    a += clamp01(scape.tension) * 0.35 * lean
  }
  return Math.min(1, a)
}

/**
 * The probability matrix for one bar.
 *
 * Deterministic: same soundscape, same spec, same matrix, every time. Nothing
 * is drawn here — a caller with its own seeded stream turns these probabilities
 * into notes, which is what lets one run be reproducible and the next one be
 * different.
 *
 * The downbeat is forced to `1`. A bar with no downbeat is not a sparser bar,
 * it is a bar a child cannot find, and the whole point of starting sparse is
 * that what is left is unmistakable.
 *
 * `bias` is where a live groove has drifted to (`evolve.ts`). Omit it and this
 * is the same pure function it has always been; pass it and the mode still
 * chooses the colours and the metre still chooses the skeleton — the drift only
 * moves an instant inside the range the mode already allowed it.
 */
export function grooveMatrix(
  scape: Soundscape,
  spec: GrooveSpec,
  bias?: GrooveBias,
): GrooveSlot[] {
  const beatsPerBar = Math.max(1, Math.floor(spec.beatsPerBar))
  const divs = spec.divs.length > 0 ? spec.divs : [1]
  const density = clamp01(spec.density)
  const beats = grooveSlotBeats(beatsPerBar, divs)

  const raw = beats.map((beat) => {
    const div = divOfBeat(beat, divs)
    // METRE IS NEVER DRIFTED, and that is the constraint that keeps a wandering
    // groove a groove. A bar's skeleton — downbeat, then halfway, then the
    // beats, then decoration — is a property of the bar and not of the music
    // in it, so however far the drift travels the pulse a child is counting is
    // still where it was. What moves is which instants the key currently
    // FAVOURS, which is colour; what never moves is the frame that colour sits
    // in. Take this constraint away and the walk becomes noise within a few
    // minutes: every slot equal, every bar a coin toss.
    const metre = metreWeight(beat, beatsPerBar, div)
    const affinity = leanAffinity(
      modeAffinity(scape, beat, beatsPerBar),
      bias?.at.get(beat) ?? 0,
    )
    return { beat, div, metre, affinity, want: metre * affinity }
  })

  // Normalise so `density` means what it says: the expected notes per bar is
  // `density × slots`. The downbeat is spent first and the rest of the budget
  // is shared out in proportion to `want`, re-spreading whatever the per-slot
  // ceiling refuses so the total is preserved rather than quietly lost.
  const budget = density * raw.length * (1 - MAX_OPENNESS * clamp01(bias?.openness ?? 0))
  const out = raw.map((s) => ({ ...s, p: s.beat === 0 ? 1 : 0 }))
  let remaining = Math.max(0, budget - 1)
  const open = out.filter((s) => s.beat !== 0)
  for (let pass = 0; pass < 8 && remaining > 1e-9; pass++) {
    const pool = open.filter((s) => s.p < MAX_P - 1e-9)
    let total = 0
    for (const s of pool) total += s.want
    if (pool.length === 0 || total <= 0) break
    const scale = remaining / total
    let spent = 0
    for (const s of pool) {
      const add = Math.min(MAX_P - s.p, s.want * scale)
      s.p += add
      spent += add
    }
    remaining -= spent
    if (spent <= 1e-12) break
  }

  return out.map((s) => ({
    beat: s.beat,
    div: s.div,
    metre: s.metre,
    affinity: s.affinity,
    p: clamp01(s.p),
  }))
}

/** Expected notes per bar for a matrix. The contract, made checkable. */
export function expectedNotes(matrix: readonly GrooveSlot[]): number {
  let total = 0
  for (const s of matrix) total += s.p
  return total
}

function cyclicCents(delta: number): number {
  const d = Math.abs(delta) % CENTS_PER_OCTAVE
  return Math.min(d, CENTS_PER_OCTAVE - d)
}

/** Half the widest gap between adjacent degrees, wrapping the octave. */
function widestHalfGap(degrees: readonly number[]): number {
  let widest = 0
  for (let i = 0; i < degrees.length; i++) {
    const a = degrees[i] ?? 0
    const b = i + 1 < degrees.length ? (degrees[i + 1] ?? 0) : (degrees[0] ?? 0) + CENTS_PER_OCTAVE
    widest = Math.max(widest, b - a)
  }
  return widest / 2
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0
  return Math.min(1, Math.max(0, v))
}

function round6(v: number): number {
  return Math.round(v * 1e6) / 1e6
}
