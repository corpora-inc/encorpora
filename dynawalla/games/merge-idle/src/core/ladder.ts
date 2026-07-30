/**
 * The value ladder.
 *
 * A polyp's VALUE is its whole identity. Two polyps merge if and only if their
 * values are equal, and the result is their sum — which is exactly double. So
 * the merge gesture *is* the doubling fact, performed with the hands. Halving a
 * polyp — the SPLIT gesture — runs the same fact backwards.
 *
 * EIGHT strains seed the ladder at every odd number from 1 to 15, and every
 * value is `seed * 2^step`. Because the odd part of a value is unique, the value
 * alone recovers the strain and the step — no separate identity field can ever
 * fall out of sync with it.
 *
 *   strain 0:   1   2   4   8  16  32  64 128 256 ...
 *   strain 1:   3   6  12  24  48  96 192 384 768 ...
 *   strain 2:   5  10  20  40  80 160 320 640 ...
 *   strain 3:   7  14  28  56 112 224 448 896 ...
 *   strain 4:   9  18  36  72 144 288 576 ...
 *   strain 5:  11  22  44  88 176 352 704 ...
 *   strain 6:  13  26  52 104 208 416 832 ...
 *   strain 7:  15  30  60 120 240 480 960 ...
 *
 * ## Why eight and not four
 *
 * It shipped with four — 1, 3, 5, 7 — and the founder played for hours and
 * "never saw a 5 or a 10". That was partly an emitter bug (the vent emitted one
 * strain), but widening the ladder is not cosmetic, because THE TARGET HAS TO BE
 * BUILDABLE and buildability is a property of this set.
 *
 * A target is answered with at most three polyps, so the question "which numbers
 * can this game ask a child for?" is "which integers are a sum of at most three
 * ladder values?". Measured over 1..1000:
 *
 *     seeds 1,3,5,7                 →  94.4% reachable, first hole at 585
 *     seeds 1,3,5,7,9,11,13,15      → 100.0% reachable, no holes
 *
 * and over 1..5000, 60.5% against 98.1%. Eight strains is what makes "the game
 * knows what would be a fun number to put on the vent" true rather than
 * aspirational — see `core/target.ts`. It is also what makes the founder's own
 * examples legal: `35 = 20 + 10 + 5` needs strain 2, and `15 = 30 ÷ 2` needs a
 * **30**, whose odd part is 15 and which does not exist on a four-seed ladder at
 * all.
 *
 * Everything here is integer. No floating point touches a value or a comparison.
 */

/** Odd seeds, one per strain. Must stay odd and distinct for `decompose` to work. */
export const SEEDS = [1, 3, 5, 7, 9, 11, 13, 15] as const

/** Highest step we ever generate. 15 * 2^17 = 1,966,080 — deep past a session. */
export const MAX_STEP = 17

export type Strain = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7

export type Ident = { strain: Strain; step: number }

/** Recover (strain, step) from a value. Returns null if the value is off-ladder. */
export function decompose(value: number): Ident | null {
  if (!Number.isInteger(value) || value <= 0) return null
  let odd = value
  let step = 0
  while (odd % 2 === 0) {
    odd /= 2
    step++
  }
  const strain = SEEDS.indexOf(odd as (typeof SEEDS)[number])
  if (strain < 0) return null
  if (step > MAX_STEP) return null
  return { strain: strain as Strain, step }
}

/** Is `value` a legal polyp value? */
export function onLadder(value: number): boolean {
  return decompose(value) !== null
}

export function valueOf(strain: Strain, step: number): number {
  const seed = SEEDS[strain]
  if (seed === undefined) throw new Error(`merge-idle: bad strain ${strain}`)
  return seed * 2 ** step
}

/** The highest ladder value, so callers never generate past the top rung. */
export const MAX_VALUE = 15 * 2 ** MAX_STEP

/**
 * Can this polyp be split into two equal halves?
 *
 * Only if it is not a seed: 12 splits into 6 and 6, but 3 does not split at all,
 * and that refusal is a real arithmetic fact a child meets with their hands. A
 * seed value is exactly a value at step 0.
 */
export function canSplit(value: number): boolean {
  const id = decompose(value)
  return id !== null && id.step > 0
}

/**
 * A single monotonic "rank" across all eight strains, used for colour, size and
 * glow so that a 96 and a 128 look about as important as each other even though
 * they sit on different ladders.
 *
 * Integer, and non-decreasing in the VALUE — the four-seed version was not: it
 * ranked by step first, so a 15 (rank 0) read as duller than a 2 (rank 3).
 * `OFFSET[s]` is `round(3 * log2(seed))` written out, so nothing here evaluates
 * a logarithm at run time.
 */
const OFFSET: readonly number[] = [0, 5, 7, 8, 9, 10, 11, 12]

export function rank(value: number): number {
  const id = decompose(value)
  if (!id) return 0
  return id.step * 3 + (OFFSET[id.strain] ?? 0)
}

export const MAX_RANK = MAX_STEP * 3 + 12

/**
 * The eight strain silhouettes. Shape carries strain so colour never has to.
 *
 * One path function drives all eight from a (waves, depth, sharpness) triple
 * rather than eight hand-written switch arms: adding four strains by hand is how
 * two of them end up indistinguishable at a 20px cell.
 */
export type Silhouette = {
  /** How many times the outline goes in and out. 0 is a plain circle. */
  readonly waves: number
  /** How deep the dents are, as a fraction of the radius. */
  readonly depth: number
  /** 1 is a smooth sine; higher is a sharper spike. */
  readonly sharpness: number
}

export const SILHOUETTE: readonly Silhouette[] = [
  { waves: 0, depth: 0, sharpness: 1 }, // 1  — a plain ring
  { waves: 7, depth: 0.14, sharpness: 1 }, // 3  — softly lobed
  { waves: 12, depth: 0.3, sharpness: 3 }, // 5  — finely spiked
  { waves: 5, depth: 0.4, sharpness: 1.6 }, // 7  — a five-armed star
  { waves: 3, depth: 0.26, sharpness: 1 }, // 9  — a broad trefoil
  { waves: 6, depth: 0.22, sharpness: 4 }, // 11 — a six-point cog
  { waves: 4, depth: 0.34, sharpness: 1.2 }, // 13 — a four-armed cross
  { waves: 9, depth: 0.18, sharpness: 2.2 }, // 15 — a nine-fluted crown
]

export function silhouetteOf(value: number): Silhouette {
  const id = decompose(value)
  return SILHOUETTE[id ? id.strain : 0] ?? { waves: 0, depth: 0, sharpness: 1 }
}

/** Digit-grouped display. 1280 -> "1,280". Integer-only, no toLocaleString. */
export function fmt(n: number): string {
  const neg = n < 0
  let s = String(Math.trunc(Math.abs(n)))
  let out = ''
  while (s.length > 3) {
    out = ',' + s.slice(-3) + out
    s = s.slice(0, -3)
  }
  return (neg ? '-' : '') + s + out
}

/** How many powers of ten `n` has crossed. 0 for <10, 1 for 10..99, ... */
export function magnitude(n: number): number {
  let m = 0
  let v = Math.trunc(n)
  while (v >= 10) {
    v = Math.floor(v / 10)
    m++
  }
  return m
}
