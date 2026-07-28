// Shared scaffolding for the rules tests: a recording host and an arena.
//
// Every test in this package is seeded from a literal. Nothing here reads
// `Math.random`, `Date.now` or `performance.now`, so a run that passes passes
// every time and a run that fails fails every time.

import type { Host } from "../contract.ts"
import { Rng } from "../core/rng.ts"
import { Arena } from "../game/arena.ts"
import { primeFactors } from "../game/factor.ts"
import { createStubHost } from "../stubHost.ts"

export type Report = { questionId: string; correct: boolean; ms: number; answered: string }

export type Rig = {
  host: Host
  arena: Arena
  reports: Report[]
  transitions: Array<{ kind: string; label?: string }>
  haptics: string[]
}

export function rig(seed = 0x1a771ce, opts: { difficulty?: number } = {}): Rig {
  const reports: Report[] = []
  const transitions: Array<{ kind: string; label?: string }> = []
  const haptics: string[] = []
  const host = createStubHost({
    seed,
    reducedMotion: true,
    ...(opts.difficulty === undefined ? {} : { difficulty: opts.difficulty }),
    onReport: (r) => reports.push(r),
    onHaptic: (k) => haptics.push(k),
    onTransition: (kind, label) =>
      transitions.push(label === undefined ? { kind } : { kind, label }),
  })
  const arena = new Arena(host, new Rng(seed ^ 0x51de), { width: 900, height: 700 })
  arena.begin(0)
  return { host, arena, reports, transitions, haptics }
}

/**
 * Grind every composite on the field down to primes, the way a child with a
 * trigger finger does — by striking, over and over, until nothing splits.
 *
 * Returns the primes now drifting. Bounded, so a bug that makes a husk
 * un-splittable fails the test rather than hanging the suite.
 */
export function grindToPrimes(arena: Arena, limit = 400): number[] {
  for (let i = 0; i < limit; i++) {
    const composite = arena.bodies.find((b) => !b.prime)
    if (!composite) break
    arena.strike(composite.id)
  }
  if (arena.bodies.some((b) => !b.prime)) throw new Error("a composite would not grind down")
  return arena.bodies.map((b) => b.value)
}

/**
 * Sweep exactly the primes that multiply to `target`, and nothing else.
 *
 * Returns false when the field cannot supply them — which is itself an
 * assertion the seeding tests make, because a resonator the field cannot answer
 * is a resonator the child cannot open.
 */
export function sweepFactorisation(arena: Arena, target: number): boolean {
  const wanted = primeFactors(target)
  for (const prime of wanted) {
    const mote = arena.bodies.find((b) => b.prime && b.value === prime)
    if (!mote) return false
    // `touch` is the rule; the shell only ever calls it after a collision.
    const before = arena.bank.size
    arena.touch(mote.id)
    if (arena.bank.size !== before + 1) return false
  }
  return true
}

/** A wall clock that ticks a fixed amount per call. No real time anywhere. */
export function stepClock(step = 1800): () => number {
  let t = 0
  return () => {
    t += step
    return t
  }
}
