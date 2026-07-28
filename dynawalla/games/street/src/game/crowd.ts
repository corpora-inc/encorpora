// The crowd, as two integers.
//
// `ranks` ranks of `size` bodies. That is the whole state, and it is why the
// thing on screen is always a rectangle rather than a heap that happens to
// arrange itself into one: there is no representation here for a ragged crowd.
//
// Everything is pure. `street.ts` owns the clock and the animations; this file
// owns what is true, and `crowd.test.ts` plays whole waves through it with no
// canvas, no rAF and no host.

import { isPrime, isSeam, leftover } from "./factor.ts"

export type Crowd = {
  /** How many ranks are still standing. Never negative. */
  readonly ranks: number
  /** Bodies in each rank. Every rank is the same width — see the file header. */
  readonly size: number
  /** Bodies knocked down so far this wave. Counts up, never down. */
  readonly downed: number
  /** Bodies the wave started with. `standing + downed === total`, always. */
  readonly total: number
}

export function newCrowd(total: number): Crowd {
  const n = Math.max(2, Math.trunc(total))
  return { ranks: 1, size: n, downed: 0, total: n }
}

/** Bodies still on their feet. */
export function standing(crowd: Crowd): number {
  return crowd.ranks * crowd.size
}

export function isCleared(crowd: Crowd): boolean {
  return crowd.ranks === 0
}

/** A rank can be knocked down exactly when it is prime. This is the game. */
export function canPunch(crowd: Crowd): boolean {
  return crowd.ranks > 0 && isPrime(crowd.size)
}

export type StrikeResult =
  | {
      readonly kind: "crack"
      readonly crowd: Crowd
      /** The stud that landed. */
      readonly seam: number
      /** Ranks before and after, so the renderer can draw the split. */
      readonly wasRanks: number
      readonly wasSize: number
    }
  | {
      readonly kind: "ringoff"
      readonly crowd: Crowd
      readonly seam: number
      /** Bodies left standing outside the groups. The remainder, made visible. */
      readonly remainder: number
    }

/**
 * Strike stud `k` at the crowd.
 *
 * On a landing the body count is conserved by construction — `size / k` is an
 * exact integer because `isSeam` already established that `k` divides `size` —
 * and `crowd.test.ts` asserts conservation over every crowd and every stud.
 */
export function strike(crowd: Crowd, k: number): StrikeResult {
  if (crowd.ranks === 0 || !isSeam(crowd.size, k)) {
    return { kind: "ringoff", crowd, seam: k, remainder: leftover(crowd.size, k) }
  }
  const groups = crowd.size / k
  return {
    kind: "crack",
    crowd: { ...crowd, ranks: crowd.ranks * groups, size: k },
    seam: k,
    wasRanks: crowd.ranks,
    wasSize: crowd.size,
  }
}

export type PunchResult =
  | {
      readonly kind: "down"
      readonly crowd: Crowd
      /** Bodies that just fell. One rank's worth. */
      readonly felled: number
      /** The wave ended with this punch. */
      readonly cleared: boolean
    }
  | {
      readonly kind: "bounce"
      readonly crowd: Crowd
      /** Why it bounced: they are locked, and this is what they are locked as. */
      readonly size: number
    }

/** Swing at the front rank. */
export function punch(crowd: Crowd): PunchResult {
  if (!canPunch(crowd)) return { kind: "bounce", crowd, size: crowd.size }
  const next: Crowd = {
    ...crowd,
    ranks: crowd.ranks - 1,
    downed: crowd.downed + crowd.size,
  }
  return { kind: "down", crowd: next, felled: crowd.size, cleared: next.ranks === 0 }
}

/**
 * A clean break is a wave cleared in the fewest taps there are, with nothing
 * refused along the way. It is not a score and it is not shown as a percentage:
 * it is a stamp on a wave that was played well, and the street forgets it
 * immediately.
 */
export function isCleanBreak(taps: number, errors: number, minimum: number): boolean {
  return errors === 0 && taps === minimum
}
