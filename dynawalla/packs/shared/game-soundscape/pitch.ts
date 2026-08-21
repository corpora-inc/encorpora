/**
 * Cents, and the two conversions everything else in this module is built from.
 *
 * **Why cents and not semitones.** A semitone table can express the Western
 * modes and nothing else. Maqam Rast's third is a neutral interval near 350
 * cents — three-quarters of a tone — and Saba's fourth is narrowed to about 590.
 * There is no integer number of semitones that says either of those, so a
 * semitone representation does not merely lose precision, it loses the maqamat
 * entirely and quietly replaces them with the nearest Western mode. Corpán's
 * beatlounge pack reached the same conclusion and its whole corpus
 * (`corpan/packs/beatlounge/src/music/modes/types.ts`) is cents-above-tonic;
 * this is the same currency, so a mode can be lifted from there without
 * translation.
 *
 * The consequence that matters for a game: **every pitch in this module is
 * derived from the root by an exponential of cents.** A drone at the root and a
 * melody note at 702 cents are the same number multiplied by 2^(702/1200). They
 * cannot drift out of tune with each other, because there is only one number.
 *
 * No Web Audio here, and none anywhere in this module. Everything is a pure
 * function over numbers, which is what lets an entire melody be asserted in Node
 * with no device, no browser and no `AudioContext` — the same discipline
 * `game-audio/ceiling.ts` and `game-pacing` already hold.
 */

/** One octave. The only magic number in the file. */
export const CENTS_PER_OCTAVE = 1200

/** Cents as a frequency multiplier. */
export function centsToRatio(cents: number): number {
  return Math.pow(2, cents / CENTS_PER_OCTAVE)
}

/**
 * A pitch, `cents` above `rootHz`.
 *
 * Negative cents go below the root, which is how the low register is reached —
 * a heavy gesture is the same degree an octave or two down, not a different
 * table.
 */
export function hz(rootHz: number, cents: number): number {
  if (!Number.isFinite(rootHz) || rootHz <= 0) return 0
  if (!Number.isFinite(cents)) return rootHz
  return rootHz * centsToRatio(cents)
}

/** The interval between two frequencies, in cents. For tests and for reporting. */
export function centsBetween(a: number, b: number): number {
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return 0
  return CENTS_PER_OCTAVE * Math.log2(b / a)
}

/**
 * Fold a frequency into `[lo, hi]` by whole octaves.
 *
 * Clamping would be the obvious thing and it is the wrong thing: a melody that
 * hits its ceiling and stays there has stopped being a melody and become a
 * held note. Folding by an octave keeps the pitch *class* — so it is still the
 * scale degree the walker chose, still in tune with the drone — and simply
 * plays it in a register that exists. A harp does the same thing when a run
 * reaches the end of the strings.
 *
 * Returns `lo` for a range that is not a range, rather than looping forever.
 */
export function foldIntoRange(value: number, lo: number, hi: number): number {
  if (!Number.isFinite(value) || value <= 0) return lo
  if (!(lo > 0) || !(hi > lo) || hi / lo < 2) return Math.min(hi, Math.max(lo, value))
  let out = value
  while (out > hi) out /= 2
  while (out < lo) out *= 2
  return out
}
