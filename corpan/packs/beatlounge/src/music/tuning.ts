/**
 * beatlounge — exact pitch math (cents / ratios / frequency), pure &
 * dependency-free.
 *
 * THE FOUNDATION the world-modes corpus and (later) the global harmony engine
 * stand on. The founder's correctness bar is "fully master the math — cents /
 * frequency / ratios — backwards and forwards." This module is where that is
 * proven, by tests against textbook values.
 *
 * ## The representation decision (authoritative)
 *
 * Internal pitch = **cents-above-tonic as a REAL (float) number**. This is
 * effectively "1200-TET granularity" but LOSSLESS: a cents value is computed
 * from the EXACT ratio (`cents = 1200 · log2(ratio)`) and stored as a float, so
 * a Pythagorean 81/64 third or a just 5/4 third is exact to float precision —
 * NOT rounded to an integer cent. 12-TET is just the special case where every
 * value happens to be a multiple of 100.
 *
 * Why not MIDI integers? A `Midi` 0..127 cannot represent maqam's E-half-flat,
 * Pythagorean's +7.82¢ third, or a shruti-inflected svara — they round to the
 * nearest semitone and the whole "master the math" goal dies. So the model is
 * cents; MIDI authoring is preserved and we *detune at the edge* (see the
 * MIDI↔mode bridge at the bottom).
 *
 * ## The four load-bearing formulas (exact)
 *
 *   ratio → cents:            cents = 1200 · log2(ratio)
 *   cents → freq:             freq  = ref · 2^(cents / 1200)
 *   freq  → cents-above-ref:  cents = 1200 · log2(freq / ref)
 *   12-TET semitones → freq:  freq  = ref · 2^(semitones / 12)
 *
 * Everything else is a corollary. No runtime deps; no throwing on the hot path
 * (invalid ratios are guarded loudly, see `assertPositive`).
 */

// ===================================================================== ratios
/** A pitch reference: an absolute frequency anchored to a MIDI note number. */
export interface PitchReference {
  /** Frequency in Hz of the anchor note. */
  hz: number
  /** MIDI note number of the anchor (A4 = 69). */
  midi: number
}

/** The modern-convention default: A4 = 440 Hz at MIDI 69. */
export const DEFAULT_REFERENCE: PitchReference = { hz: 440, midi: 69 }

/** Cents per octave (the universal currency). */
export const CENTS_PER_OCTAVE = 1200
/** Cents per 12-TET semitone. */
export const CENTS_PER_SEMITONE = 100

/** Guard: ratios/frequencies must be strictly positive (log2 is undefined ≤0).
 *  Noisy-not-silent: a bad ratio is a programming error, surface it. */
const assertPositive = (label: string, ...vals: number[]): void => {
  for (const v of vals) {
    if (!(v > 0) || !Number.isFinite(v)) {
      throw new Error(`tuning: ${label} must be a finite positive number, got ${v}`)
    }
  }
}

/**
 * Exact cents of a frequency ratio. Two overloads:
 *   centsFromRatio(3, 2)  → 701.955…   (a 3:2 fifth)
 *   centsFromRatio(1.5)   → 701.955…   (the same ratio as a single number)
 */
export function centsFromRatio(num: number, den: number): number
export function centsFromRatio(ratio: number): number
export function centsFromRatio(a: number, b?: number): number {
  const ratio = b === undefined ? a : a / b
  assertPositive("ratio", ratio)
  return CENTS_PER_OCTAVE * Math.log2(ratio)
}

/** Alias reading more naturally when you already hold a single ratio value. */
export const ratioToCents = (ratio: number): number => centsFromRatio(ratio)

/** The inverse: cents → the (real) frequency ratio it represents. */
export const centsToRatio = (cents: number): number =>
  Math.pow(2, cents / CENTS_PER_OCTAVE)

/**
 * Best small-integer ratio approximating a cents value, via a continued-fraction
 * search bounded by `maxDen`. Returns the ratio AND its exact cents + the error
 * vs the input, so callers can decide if the rational fit is good enough (e.g.
 * to label a measured/12-TET interval with a JI ratio). This is an APPROXIMATION
 * helper — the stored representation is always the exact cents float.
 */
export const centsToRatioApprox = (
  cents: number,
  maxDen = 1000
): { num: number; den: number; cents: number; errorCents: number } => {
  const target = centsToRatio(cents) // the real ratio we want to rationalize
  // Stern–Brocot / continued-fraction mediant search on the value `target`.
  let bestNum = 1
  let bestDen = 1
  let bestErr = Infinity
  let loN = 0
  let loD = 1
  let hiN = 1
  let hiD = 0 // represents +∞
  // Octave-reduce the search into [1,2) then re-expand, so big intervals work.
  let octaves = 0
  let t = target
  while (t >= 2) {
    t /= 2
    octaves++
  }
  while (t < 1) {
    t *= 2
    octaves--
  }
  for (let i = 0; i < 64; i++) {
    const medN = loN + hiN
    const medD = loD + hiD
    if (medD > maxDen) break
    const medVal = medN / medD
    const err = Math.abs(centsFromRatio(medVal) - centsFromRatio(t))
    if (err < bestErr) {
      bestErr = err
      bestNum = medN
      bestDen = medD
    }
    if (medVal < t) {
      loN = medN
      loD = medD
    } else if (medVal > t) {
      hiN = medN
      hiD = medD
    } else break
  }
  // Re-apply the octave folding to the rational result.
  let num = bestNum
  let den = bestDen
  if (octaves > 0) num *= 2 ** octaves
  else if (octaves < 0) den *= 2 ** -octaves
  // reduce
  const g = gcd(num, den)
  num /= g
  den /= g
  const exact = centsFromRatio(num, den)
  return { num, den, cents: exact, errorCents: exact - cents }
}

const gcd = (a: number, b: number): number => {
  a = Math.abs(a)
  b = Math.abs(b)
  while (b) {
    ;[a, b] = [b, a % b]
  }
  return a || 1
}

// ================================================================= frequency
/** Frequency of a pitch `centsAboveRef` cents above a reference frequency. */
export const freqFromCents = (centsAboveRef: number, refHz: number): number => {
  assertPositive("refHz", refHz)
  return refHz * Math.pow(2, centsAboveRef / CENTS_PER_OCTAVE)
}

/** Cents from f1 up to f2 (signed; negative if f2 is lower). */
export const centsBetween = (f1: number, f2: number): number => {
  assertPositive("frequency", f1, f2)
  return CENTS_PER_OCTAVE * Math.log2(f2 / f1)
}

/** 12-TET MIDI note → frequency (Hz). Reference defaults to A4 = 440 @ MIDI 69. */
export const midiToFreq = (
  midi: number,
  ref: PitchReference = DEFAULT_REFERENCE
): number => {
  assertPositive("ref.hz", ref.hz)
  return ref.hz * Math.pow(2, (midi - ref.midi) / 12)
}

/** Frequency (Hz) → (fractional) 12-TET MIDI note. Inverse of `midiToFreq`. */
export const freqToMidi = (
  hz: number,
  ref: PitchReference = DEFAULT_REFERENCE
): number => {
  assertPositive("hz", hz, ref.hz)
  return ref.midi + 12 * Math.log2(hz / ref.hz)
}

// ============================================================= tuning systems
/**
 * A TuningSystem makes "tuning" a FIRST-CLASS AXIS: given a scale-degree index
 * (0-based) it answers cents-above-tonic, so any abstract scale (Western mode,
 * thaat, melakarta) can be *voiced* in any tuning later with zero migration.
 *
 *   - `equal12`     — 12-TET, every semitone exactly 100¢ (the default; chords
 *                     require it). Degrees map through a provided semitone list.
 *   - `pythagorean` — stacked PURE 3:2 fifths, octave-reduced (shows the comma).
 *   - `just`        — 5-limit just intonation (small-integer ratios).
 *
 * A tuning is parameterized by the scale's *semitone skeleton* (the 12-TET
 * degree offsets, e.g. major = [0,2,4,5,7,9,11]); for the rational tunings each
 * semitone class maps to its canonical ratio. This is exactly the payoff of the
 * cents representation: the SAME degree list rendered through a different
 * TuningSystem yields the just/Pythagorean version of the mode for free.
 */
export interface TuningSystem {
  id: TuningSystemId
  /** Degree index (0-based, within the provided semitone skeleton) → cents. */
  degreeToCents(degreeSemitone: number): number
  /** Human label. */
  label: string
}

export type TuningSystemId = "equal12" | "pythagorean" | "just"

/** 12-TET: cents = 100 · semitone. The trivial, default, chord-safe tuning. */
export const equal12: TuningSystem = {
  id: "equal12",
  label: "Equal (12-TET)",
  degreeToCents: (semitone) => semitone * CENTS_PER_SEMITONE,
}

/**
 * Pythagorean cents for each of the 12 chromatic semitone classes, built by
 * stacking pure fifths (3/2) up and down from the tonic and octave-reducing.
 * The familiar spelling (fifths −1..+5 around the tonic + the sharp side) gives
 * the standard diatonic ratios: M2 9/8, M3 81/64, P4 4/3, P5 3/2, M6 27/16,
 * M7 243/128. The chromatic notes use the nearest fifth-chain member.
 *
 * Reference values this reproduces: P5 = 701.955¢, M3 = 81/64 = 407.820¢.
 */
const PYTHAGOREAN_RATIOS: ReadonlyArray<readonly [number, number]> = [
  [1, 1], //  0  unison
  [256, 243], //  1  m2  (limma, −5 fifths)
  [9, 8], //  2  M2  (+2 fifths)
  [32, 27], //  3  m3  (−3 fifths)
  [81, 64], //  4  M3  (+4 fifths)
  [4, 3], //  5  P4  (−1 fifth)
  [729, 512], //  6  A4  (tritone, +6 fifths)
  [3, 2], //  7  P5  (+1 fifth)
  [128, 81], //  8  m6  (−4 fifths)
  [27, 16], //  9  M6  (+3 fifths)
  [16, 9], // 10  m7  (−2 fifths)
  [243, 128], // 11  M7  (+5 fifths)
]

export const pythagorean: TuningSystem = {
  id: "pythagorean",
  label: "Pythagorean",
  degreeToCents: (semitone) => {
    const oct = Math.floor(semitone / 12)
    const pc = ((semitone % 12) + 12) % 12
    const [n, d] = PYTHAGOREAN_RATIOS[pc]
    return centsFromRatio(n, d) + oct * CENTS_PER_OCTAVE
  },
}

/**
 * 5-limit just-intonation ratios for the 12 chromatic semitone classes (the
 * common "5-limit symmetric" set). Diatonic majors: M2 9/8, M3 5/4, P4 4/3,
 * P5 3/2, M6 5/3, M7 15/8. Reference: M3 = 5/4 = 386.314¢.
 */
const JUST_RATIOS: ReadonlyArray<readonly [number, number]> = [
  [1, 1], //  0  unison
  [16, 15], //  1  m2
  [9, 8], //  2  M2
  [6, 5], //  3  m3
  [5, 4], //  4  M3
  [4, 3], //  5  P4
  [45, 32], //  6  tritone
  [3, 2], //  7  P5
  [8, 5], //  8  m6
  [5, 3], //  9  M6
  [9, 5], // 10  m7
  [15, 8], // 11  M7
]

export const just: TuningSystem = {
  id: "just",
  label: "Just (5-limit)",
  degreeToCents: (semitone) => {
    const oct = Math.floor(semitone / 12)
    const pc = ((semitone % 12) + 12) % 12
    const [n, d] = JUST_RATIOS[pc]
    return centsFromRatio(n, d) + oct * CENTS_PER_OCTAVE
  },
}

export const TUNING_SYSTEMS: Record<TuningSystemId, TuningSystem> = {
  equal12,
  pythagorean,
  just,
}

// ----------------------------------------------------------------- the commas
/** Pythagorean comma = 3¹²/2¹⁹ = 531441/524288 ≈ 23.460¢ (12 fifths − 7 octaves). */
export const PYTHAGOREAN_COMMA = centsFromRatio(531441, 524288)
/** Syntonic comma = 81/80 ≈ 21.506¢ (Pythagorean M3 81/64 vs just M3 5/4). */
export const SYNTONIC_COMMA = centsFromRatio(81, 80)

// ============================================================== MIDI ↔ mode
/**
 * A mode/scale as the corpus stores it: the ascending cents-above-tonic of each
 * degree within one octave (degrees[0] is always 0). This is the ONLY shape the
 * bridge below needs — `src/music/modes/` produces these for every family.
 */
export interface ModeCents {
  /** Ascending cents-above-tonic, one octave, degrees[0] === 0. */
  degrees: number[]
}

/** True positive modulo. */
const fmod = (n: number, m: number): number => ((n % m) + m) % m

/**
 * Reduce an arbitrary cents value into [0,1200) plus the octave it came from.
 */
const octaveReduce = (cents: number): { pc: number; octave: number } => {
  const octave = Math.floor(cents / CENTS_PER_OCTAVE)
  return { pc: cents - octave * CENTS_PER_OCTAVE, octave }
}

/**
 * Nearest scale degree (in cents-within-octave) to an arbitrary cents-from-tonic
 * value, wrapping across the octave boundary. Returns the EXACT mode cents and
 * the signed delta to it.
 */
const nearestDegreeCents = (
  pc: number,
  mode: ModeCents
): { degreeCents: number; delta: number } => {
  let best = mode.degrees[0]
  let bestDelta = Infinity
  for (const d of mode.degrees) {
    // consider this degree, and its wrap to the next octave below/above
    for (const cand of [d - CENTS_PER_OCTAVE, d, d + CENTS_PER_OCTAVE]) {
      const delta = cand - pc
      if (Math.abs(delta) < Math.abs(bestDelta)) {
        bestDelta = delta
        best = fmod(cand, CENTS_PER_OCTAVE)
      }
    }
  }
  return { degreeCents: best, delta: bestDelta }
}

/**
 * Quantize a pitch (given as cents-from-tonic OR as a fractional MIDI with a
 * tonic) onto the nearest exact pitch of `mode`. Returns the snapped
 * cents-from-tonic (octave-preserving). This is fret/lock for the ribbon: a
 * continuous input lands on a genuine mode degree.
 */
export const quantizeToScale = (
  centsFromTonic: number,
  mode: ModeCents
): number => {
  const { pc, octave } = octaveReduce(centsFromTonic)
  const { degreeCents, delta } = nearestDegreeCents(pc, mode)
  // If the nearest degree wrapped, `octave` may need ±1 — derive from delta.
  const snappedPc = degreeCents
  // The wrapped candidate that won is pc + delta; recover its true octave.
  const wrappedCents = pc + delta
  const octShift = Math.round((wrappedCents - snappedPc) / CENTS_PER_OCTAVE)
  return snappedPc + (octave + octShift) * CENTS_PER_OCTAVE
}

/**
 * THE MIDI→MODE DETUNE BRIDGE — the headline of this module.
 *
 * Given a played 12-TET MIDI note, the active `mode` (cents-from-tonic degree
 * set), the `tuning` the mode's degrees should be intonated in, and the tonic
 * MIDI, return the CENTS OFFSET to apply to the 12-TET note so it lands on the
 * mode's exact pitch. THIS is what detunes a MIDI piano in real time to maqam
 * (or Pythagorean, or just): play the keyboard as 12-TET MIDI, add this delta as
 * synth detune, and the voice bends to the true microtonal pitch.
 *
 * In pure 12-TET (equal12 tuning + 100¢-multiple mode) the delta is 0 and
 * nothing changes — the integer authoring path is untouched.
 *
 * How it works:
 *   1. The MIDI note's 12-TET cents-above-tonic = 100 · (midi − tonicMidi).
 *   2. Snap that to the nearest mode degree (its semitone position in the scale).
 *   3. Re-intonate that degree through `tuning` (e.g. Pythagorean cents for its
 *      semitone offset) to get the EXACT target cents.
 *   4. delta = exactCents − the12TetCents.
 */
export const detuneCentsForMidi = (
  midi: number,
  mode: ModeCents,
  tuning: TuningSystem,
  tonicMidi: number
): number => {
  const twelveTetCents = (midi - tonicMidi) * CENTS_PER_SEMITONE
  // Find which mode degree this MIDI note represents (nearest, octave-aware).
  const { pc, octave } = octaveReduce(twelveTetCents)
  let bestIdx = 0
  let bestDelta = Infinity
  for (let i = 0; i < mode.degrees.length; i++) {
    for (const cand of [
      mode.degrees[i] - CENTS_PER_OCTAVE,
      mode.degrees[i],
      mode.degrees[i] + CENTS_PER_OCTAVE,
    ]) {
      const delta = cand - pc
      if (Math.abs(delta) < Math.abs(bestDelta)) {
        bestDelta = delta
        bestIdx = i
      }
    }
  }
  // The mode degree's 12-TET semitone offset (round its stored cents to a
  // semitone class) is what the tuning re-intonates.
  const degreeSemitone =
    Math.round(mode.degrees[bestIdx] / CENTS_PER_SEMITONE) + octave * 12
  // If the mode degree IS a non-12-TET value (maqam neutral tone), the corpus
  // already carries its exact cents — prefer that directly when the tuning is
  // equal12 (the maqam path), else re-voice the semitone skeleton via `tuning`.
  const exactCents =
    tuning.id === "equal12"
      ? mode.degrees[bestIdx] + octave * CENTS_PER_OCTAVE
      : tuning.degreeToCents(degreeSemitone)
  return exactCents - twelveTetCents
}

/**
 * Resolve a played MIDI note all the way to an exact FREQUENCY through the
 * active mode + tuning, anchored at a tonic MIDI and reference. Convenience that
 * composes `detuneCentsForMidi` with `midiToFreq` — the audio edge calls this.
 */
export const freqForMidiInMode = (
  midi: number,
  mode: ModeCents,
  tuning: TuningSystem,
  tonicMidi: number,
  ref: PitchReference = DEFAULT_REFERENCE
): number => {
  const detune = detuneCentsForMidi(midi, mode, tuning, tonicMidi)
  const baseFreq = midiToFreq(midi, ref)
  return baseFreq * Math.pow(2, detune / CENTS_PER_OCTAVE)
}
