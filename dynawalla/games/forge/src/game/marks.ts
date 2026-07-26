// THE FORGE MARK — the best maths in this game, and the only part with no
// question text at all.
//
// Two ingots rise out of the crucible. One says `+14 HAMMER`. The other says
// `x2 HAMMER`. The HAMMER row, three centimetres away, says you own 9.
//
// Take either. You keep whichever you take — there is no wrong answer to
// punish, and no red X anywhere. But one of them makes your numbers grow faster
// than the other, forever, and picking it stamps a permanent mark on the forge.
//
// The maths: with C units, `+N` gives you C+N and `x2` gives you 2C.
//
//     C + N > 2C   <=>   N > C
//
// That is the entire lesson, and it is a *comparison of two expressions in one
// variable*, which is pre-algebra. The crossover moves as you play: early, when
// C is 3, +14 is obviously right. An hour later, when C is 400, the same +14 is
// laughable. Nobody memorises an answer; you have to look at the row.

import { MICRO, type Micro } from "../core/bigmath.ts"
import { TIERS, type Economy, tierCount } from "../core/economy.ts"
import type { Rng } from "../core/rng.ts"

export type Offer =
  | { kind: "add"; tier: number; n: bigint }
  | { kind: "double"; tier: number }

export type MarkRound = {
  tier: number
  /** Whole units the player currently owns of that station — shown on the row. */
  have: bigint
  offers: [Offer, Offer]
  /** Index of the offer that yields more production. Exact integer comparison. */
  better: 0 | 1
}

/** Production after taking an offer, in micro-units of the station. Exact. */
export function resultingCount(e: Economy, o: Offer): Micro {
  const c = tierCount(e.tiers[o.tier])
  return o.kind === "add" ? c + o.n * MICRO : c * 2n
}

export function offerLabel(o: Offer): string {
  const name = TIERS[o.tier].name
  return o.kind === "add" ? `+${o.n} ${name}` : `×2 ${name}`
}

/** The station a mark is offered on: the deepest one the player actually runs. */
function chooseTier(e: Economy): number {
  for (let i = e.tiers.length - 1; i >= 0; i--) {
    if (e.tiers[i].unlocked && tierCount(e.tiers[i]) >= 3n * MICRO) return i
  }
  return 0
}

export function makeMarkRound(e: Economy, rng: Rng): MarkRound {
  const tier = chooseTier(e)
  const have = tierCount(e.tiers[tier]) / MICRO
  const h = have < 1n ? 1n : have

  // Half the time the addition wins, half the time the doubling does — and the
  // margin is kept well clear of the crossover so the comparison is decidable
  // by looking, not by arithmetic luck. Never a tie.
  const addWins = rng.chance(1, 2)
  const spread = 25 + rng.int(0, 60) // percent away from the crossover
  let n: bigint
  if (addWins) {
    n = (h * BigInt(100 + spread)) / 100n + 1n
    if (n <= h) n = h + 1n
  } else {
    n = (h * BigInt(100 - Math.min(70, spread))) / 100n
    if (n >= h) n = h - 1n
    if (n < 1n) n = 1n
  }

  const a: Offer = { kind: "add", tier, n }
  const b: Offer = { kind: "double", tier }
  const flip = rng.chance(1, 2)
  const offers: [Offer, Offer] = flip ? [b, a] : [a, b]

  const c0 = resultingCount(e, offers[0])
  const c1 = resultingCount(e, offers[1])
  return { tier, have: h, offers, better: c0 >= c1 ? 0 : 1 }
}

/**
 * Apply the chosen offer. `+N` lands as stock rather than purchases so it adds
 * exactly N units of production and moves neither the price nor the doubling
 * pips — the arithmetic on the ingot is the arithmetic that happens.
 */
export function applyOffer(e: Economy, o: Offer): void {
  const t = e.tiers[o.tier]
  if (o.kind === "add") t.stock += o.n * MICRO
  else t.bonusDoublings += 1n
}
