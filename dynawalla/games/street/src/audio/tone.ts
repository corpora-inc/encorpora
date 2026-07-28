// The hum law, and why it is a pure function in its own file.
//
// The design entry for this game names one sound out loud: **the block's hum
// pitch is the log of the number.** That is not decoration. A mob standing in
// the street hums, and the hum is the only thing in the game that tells you how
// big it is *before* you read the lamp — so when a seam lands and twelve
// becomes four ranks of three, the drone jumps up a fixed interval and the
// child hears the number get smaller a frame before they see it.
//
// Written as a power law, which is the same statement:
//
//     pitch in semitones  =  const − 12/3 · log2(n)
//     frequency in hertz  =  HUM_ROOT · n^(−1/3)
//
// Every doubling of the crowd drops the hum by exactly four semitones — a major
// third, the same interval every time, so halving a mob twice is audibly the
// same move twice. `tone.test.ts` asserts the interval is constant rather than
// asserting particular frequencies, because the constancy is the design and the
// frequencies are taste.

/** The hum of a mob of one, extended down from. Below the numerals, above mud. */
export const HUM_ROOT = 264

/** Semitones the hum falls per doubling of the crowd. */
export const HUM_SEMITONES_PER_DOUBLING = 4

/** The drone of a rank of `n`. Bigger mob, lower hum. */
export function humHz(n: number): number {
  const size = Math.max(1, n)
  return HUM_ROOT * Math.pow(size, -HUM_SEMITONES_PER_DOUBLING / 12)
}

/** The same law in semitones, for anything that wants to reason in intervals. */
export function humSemitones(n: number): number {
  return -HUM_SEMITONES_PER_DOUBLING * Math.log2(Math.max(1, n))
}

/**
 * The pitch a falling rank rings at: the hum of its own size, an octave up, so
 * a rank of three and a rank of eleven are told apart by ear as they go down.
 */
export function fellHz(n: number): number {
  return humHz(n) * 2
}

/**
 * The ring of a refused seam.
 *
 * Deliberately **not** derived from the mob: a ring-off is the sound of a stud
 * hitting something that does not give, and it is the same sound whichever mob
 * refused it. A ring-off that sang the mob's number would reward being wrong
 * with information the child did not earn.
 */
export const RINGOFF_HZ = 1860

/**
 * The dull note of fists off locked arms.
 *
 * Below the drone of the biggest mob there is, on purpose: a bounce is the mob
 * absorbing a punch, and it has to sit under them rather than ring out of them.
 */
export const BOUNCE_HZ = 72

/** The pentatonic the rewards are built on, in hertz. C5 minor pentatonic. */
export const REWARD_HZ: readonly number[] = [523.25, 622.25, 698.46, 783.99, 932.33] as const
