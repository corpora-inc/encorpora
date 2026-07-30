// Shared scaffolding for the rules tests: a recording host and an arena.
//
// Every test in this package is seeded from a literal. Nothing here reads
// `Math.random`, `Date.now` or `performance.now`, so a run that passes passes
// every time and a run that fails fails every time.

import type { Host } from "../contract.ts"
import { Rng } from "../core/rng.ts"
import { Arena } from "../game/arena.ts"
import { multisetDifference, primeFactors } from "../game/factor.ts"
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

/** Fly toward a point, and aim there too. */
function steer(arena: Arena, x: number, y: number): void {
  const dx = x - arena.ship.x
  const dy = y - arena.ship.y
  arena.setMove(dx, dy)
  arena.setAim(dx, dy)
}

function nearest<T extends { x: number; y: number }>(arena: Arena, xs: readonly T[]): T | null {
  let best: T | null = null
  let bestD = Number.POSITIVE_INFINITY
  for (const item of xs) {
    const d = Math.hypot(item.x - arena.ship.x, item.y - arena.ship.y)
    if (d < bestD) {
      bestD = d
      best = item
    }
  }
  return best
}

/** What a sitting looked like, for the tests that measure one. */
export type Sitting = {
  /** Every target a resonator carried, in order. */
  readonly targets: number[]
  /** Wall-clock milliseconds the arena had no question at all. */
  readonly withoutQuestionMs: number
  /** How long until the first target with a real factor tree in it. */
  readonly firstTreeMs: number | null
}

/**
 * A child who is playing properly: work out what the resonator needs, break
 * open whatever is holding those primes, collect exactly them, and go.
 *
 * The ceiling on how well this game can go, so a defect that only a perfect
 * player would reach still shows up. `loop.test.ts` uses it to ask whether the
 * loop closes at all; `pacing.test.ts` uses it to ask what the loop is *about*.
 */
export function playCarefully(arena: Arena, frames: number, frameMs = 16): Sitting {
  const targets: number[] = []
  const seen = new Set<string>()
  let withoutQuestionMs = 0
  let firstTreeMs: number | null = null
  let t = 0
  for (let f = 0; f < frames; f++) {
    t += frameMs
    const res = arena.resonator
    if (!res) withoutQuestionMs += frameMs
    if (res && !seen.has(res.questionId)) {
      seen.add(res.questionId)
      targets.push(res.target)
      if (firstTreeMs === null && res.target >= 12 && primeFactors(res.target).length >= 3) {
        firstTreeMs = t
      }
    }

    if (res) {
      const wanted = primeFactors(res.target)
      const held = arena.bank.tiles.slice()
      const surplus = multisetDifference(held, wanted)

      if (surplus.length > 0) {
        // Something got swept that the resonator does not want. Drop the lot and
        // start the hold again — the primes go back on the field.
        arena.vent()
      } else if (held.length === wanted.length) {
        // The hold is right. Run at it.
        steer(arena, res.x, res.y)
        if (Math.hypot(res.x - arena.ship.x, res.y - arena.ship.y) < 60) arena.enter(t)
      } else {
        const needed = multisetDifference(wanted, held)
        const motes = arena.bodies.filter((b) => b.prime && needed.includes(b.value))
        const mote = nearest(arena, motes)
        if (mote) {
          steer(arena, mote.x, mote.y)
        } else {
          // Nothing loose carries what is needed, so open something that does.
          const husks = arena.bodies.filter(
            (b) => !b.prime && needed.some((p) => b.value % p === 0),
          )
          const husk =
            nearest(arena, husks) ?? nearest(arena, arena.bodies.filter((b) => !b.prime))
          if (husk) {
            // Stand off and shoot rather than flying into it — a husk jostles.
            const dx = husk.x - arena.ship.x
            const dy = husk.y - arena.ship.y
            arena.setAim(dx, dy)
            const range = Math.hypot(dx, dy)
            arena.setMove(range > 220 ? dx : -dx, range > 220 ? dy : -dy)
            arena.fire()
          } else {
            // The field has nothing left that helps. Sit still rather than
            // thrashing; the assertions are what report it.
            arena.setMove(0, 0)
          }
        }
      }
    }
    arena.step(frameMs)
    // The shell calls this every frame. Without it a barren band would look like
    // a permanent stall in a test and would not be one in the game.
    arena.rearm(t)
  }
  return { targets, withoutQuestionMs, firstTreeMs }
}
