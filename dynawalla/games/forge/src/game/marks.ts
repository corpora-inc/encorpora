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
// laughable. Nobody memorises an answer; you have to look at what you own.
//
// THE ONE RULE OF THIS FILE: there is exactly one C, it is `MarkRound.have`, it
// is cut once when the card opens, and nothing on the card is ever recomputed
// from the live economy afterwards. This is an idle game — the station is
// producing while the child is thinking, so a C read live would tick upward
// between the number on the card and the number in the sum. A quantity you are
// asked to compare against cannot move while you are looking at it, and a card
// whose printed C is not the C in its own arithmetic teaches the child that
// correct reasoning gives the wrong answer.

import { MICRO } from "../core/bigmath.ts"
import { TIERS, type Economy, tierCount } from "../core/economy.ts"
import type { Rng } from "../core/rng.ts"

export type Offer =
  | { kind: "add"; tier: number; n: bigint }
  | { kind: "double"; tier: number }

export type MarkRound = {
  tier: number
  /**
   * C. Whole units of that station at the instant the card was cut, and the
   * only base any number on this card is ever measured from. Frozen.
   */
  have: bigint
  offers: [Offer, Offer]
  /** Index of the offer that leaves you with more. Exact integer comparison. */
  better: 0 | 1
}

/** What `o` leaves you holding, in whole units, measured from a fixed `have`. */
function outcomeFrom(have: bigint, o: Offer): bigint {
  return o.kind === "add" ? have + o.n : have * 2n
}

/**
 * The number printed under ingot `i`, in whole units of the station.
 *
 * It reads the frozen `have` and nothing else. There is deliberately no
 * overload that takes an `Economy`: the live count is not an input to this
 * card, and the previous version of this function taking one is the whole bug.
 */
export function markOutcome(m: MarkRound, i: number): bigint {
  return outcomeFrom(m.have, m.offers[i])
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
  let addWins = rng.chance(1, 2)
  const spread = 25 + rng.int(0, 60) // percent away from the crossover
  // C = 1 has no room below the crossover: x2 leaves you with 2, and the only
  // addition that loses to it is +0, which is not an offer. Give the addition
  // rather than print a tie. The draw above is still spent so the sequence a
  // seed produces does not depend on how big the player is.
  if (h <= 1n) addWins = true
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

  // Decided from the same frozen C the card prints, so the game's idea of the
  // better ingot can never disagree with the two numbers the child compares.
  const c0 = outcomeFrom(h, offers[0])
  const c1 = outcomeFrom(h, offers[1])
  return { tier, have: h, offers, better: c0 > c1 ? 0 : 1 }
}

/**
 * Apply the chosen offer.
 *
 * Both arms move the COUNT on the row, because the count is what the ingot
 * promised. `+N` lands as stock rather than purchases so it adds exactly N
 * units and moves neither the price nor the doubling pips. `x2` doubles that
 * same count, which multiplies the station's output by exactly two — the older
 * version banked a hidden `bonusDoublings` instead, so an ingot reading
 * `x2 HAMMER -> 92` left the HAMMER row still reading 46 and the promised
 * number appeared nowhere on the screen.
 */
export function applyOffer(e: Economy, o: Offer): void {
  const t = e.tiers[o.tier]
  if (o.kind === "add") t.stock += o.n * MICRO
  else t.stock += tierCount(t)
}
