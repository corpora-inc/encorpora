/**
 * The value ladder.
 *
 * A polyp's VALUE is its whole identity. Two polyps merge if and only if their
 * values are equal, and the result is their sum — which is exactly double. So
 * the merge gesture *is* the doubling fact, performed with the hands.
 *
 * Four strains seed the ladder at 1, 3, 5 and 7 and every value is seed * 2^step.
 * Because the odd part of a value is unique, the value alone recovers the strain
 * and the step — no separate identity field can ever fall out of sync with it.
 *
 *   strain 0:  1  2  4   8  16  32  64 128 256  512 1024 ...
 *   strain 1:  3  6 12  24  48  96 192 384 768 1536 3072 ...
 *   strain 2:  5 10 20  40  80 160 320 640 1280 ...
 *   strain 3:  7 14 28  56 112 224 448 896 1792 ...
 *
 * Four interleaved ladders means the child doubles 96, 192, 448, 1280 — real
 * two- and three-digit doubling with regrouping — instead of walking the one
 * memorised power-of-two staircase every kid has already seen in 2048.
 *
 * Everything here is integer. No floating point touches a value or a comparison.
 */

/** Odd seeds, one per strain. Must stay odd and distinct for `decompose` to work. */
export const SEEDS = [1, 3, 5, 7] as const

/** Highest step we ever generate. 7 * 2^17 = 917,504 — deep past a long session. */
export const MAX_STEP = 17

export type Strain = 0 | 1 | 2 | 3

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

/**
 * A single monotonic "rank" across all four strains, used for colour, size and
 * glow so that a 96 and a 128 look about as important as each other even though
 * they sit on different ladders. Rank is roughly log2(value) scaled to integers.
 */
export function rank(value: number): number {
  const id = decompose(value)
  if (!id) return 0
  // seed 1,3,5,7 -> offset 0,1,2,2 keeps the visual ramp even across strains.
  const offset = [0, 1, 2, 2][id.strain] ?? 0
  return id.step * 3 + offset
}

export const MAX_RANK = MAX_STEP * 3 + 2

/** The four strain silhouettes. Shape carries strain so colour never has to. */
export type Silhouette = 'ring' | 'lobed' | 'spiked' | 'starred'
export const SILHOUETTE: readonly Silhouette[] = ['ring', 'lobed', 'spiked', 'starred']

export function silhouetteOf(value: number): Silhouette {
  const id = decompose(value)
  return SILHOUETTE[id ? id.strain : 0] ?? 'ring'
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

/**
 * Compact display for the essence counter once it leaves five digits.
 * 12,400 -> "12.4K". Deliberately keeps one decimal so the number visibly
 * *moves* between order-of-magnitude flares instead of sitting still.
 */
export function fmtCompact(n: number): string {
  const v = Math.trunc(n)
  if (v < 100_000) return fmt(v)
  const units = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi']
  let u = 0
  let scaled = v
  while (scaled >= 1000 && u < units.length - 1) {
    scaled = scaled / 1000
    u++
  }
  const oneDp = Math.floor(scaled * 10) / 10
  return `${oneDp}${units[u]}`
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
