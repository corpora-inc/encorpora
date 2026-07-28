// Which mob comes round the corner.
//
// A band per block, widening. Not a difficulty curve on *run length* — the band
// is a function of how many blocks have been finished, which is a thing the
// child did, and it stops widening at the fourth block. After that the street
// is the street.
//
// Two properties `wave.test.ts` holds:
//
//   * every size the street can send is inside the pool `factor.ts` guarantees
//     the breaker bar can express, so there is never a mob whose seam the child
//     cannot say; and
//   * a size never repeats back to back, because the second identical mob in a
//     row is a mob nobody looks at.

import { CROWD_MAX, CROWD_MIN, isPrime } from "./factor.ts"
import type { Rng } from "../core/rng.ts"

export const WAVES_PER_BLOCK = 3

type Band = { readonly lo: number; readonly hi: number }

const BANDS: readonly Band[] = [
  { lo: 4, hi: 9 },
  { lo: 4, hi: 12 },
  { lo: 6, hi: 16 },
  { lo: 6, hi: CROWD_MAX },
] as const

export function bandFor(blockIndex: number): Band {
  const i = Math.max(0, Math.min(BANDS.length - 1, Math.trunc(blockIndex)))
  return BANDS[i] as Band
}

/**
 * The next mob.
 *
 * `previous` is rejected so the same rectangle never arrives twice running. The
 * rejection loop is bounded: every band holds at least six sizes, so a second
 * draw almost always differs and the bound is there for the pathological case
 * rather than for the common one.
 */
export function nextWaveSize(rng: Rng, blockIndex: number, previous: number): number {
  const { lo, hi } = bandFor(blockIndex)
  let size = rng.int(lo, hi)
  for (let guard = 0; guard < 12 && size === previous; guard++) {
    size = rng.int(lo, hi)
  }
  if (size === previous) size = size === hi ? lo : size + 1
  return Math.max(CROWD_MIN, Math.min(CROWD_MAX, size))
}

/**
 * How many mobs a block holds. Fixed, and short: a block is the unit the street
 * celebrates and the unit the host may put a sheet after, so it has to be
 * reachable inside a couple of minutes from a standing start.
 */
export function wavesPerBlock(): number {
  return WAVES_PER_BLOCK
}

/** For the renderer's marquee: a solid mob is worth naming. */
export function isSolid(size: number): boolean {
  return isPrime(size)
}
