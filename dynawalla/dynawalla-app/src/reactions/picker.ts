// Which effect gets drawn: energy-weighted, non-repeating, eligibility-gated.
//
// ## Weighted *against* energy, not for it
//
// The obvious reading of "energy-weighted" is that louder effects come up more
// often. That is the opposite of what this product wants. The largest study to
// date (N = 3,018) found both no juiciness and extreme juiciness reduced play
// time, player experience, intrinsic motivation and performance against
// medium/high; a 2024 decomposition found it was the *success-dependence* of
// feedback that did the work, and raw amplification that hurt. So within a
// tier, weight is inversely proportional to energy: the quiet effect is the
// common one and the loud one is the exception. Feedback contingent, not loud.
//
// ## Non-repeating
//
// Never the same effect twice running in the same tier. A repeat reads as a
// canned animation; alternation reads as a mechanism with more than one part.
//
// ## Eligibility, and the downgrade walk
//
// An effect needs things to be on screen — the answer row, the construction
// band, the aperture that was just cut. When a tier has nothing eligible the
// picker walks *down*, never up: a MECHANISM with no band to play in becomes an
// ILLUMINATE, then an ENGAGE, then a SEAT, which is still an honest reaction to
// a correct answer. It never walks up, so a missing anchor can never make a
// response louder than the outcome earned.
//
// The MECHANISM budget lives here too: once a session, per EXPERIENCE_DESIGN.
// Spending it is the picker's business rather than `chooseTier`'s, which keeps
// the escalation rule stateless and readable.

import { effectsIn, energy, type Effect, type Requirement } from "./effects.ts"
import { TIERS, TIER_ORDER, type TierName } from "./tiers.ts"
import type { Anchor } from "./surface.ts"

export interface PickerState {
  /** The last effect drawn in each tier, so it is not drawn twice running. */
  readonly last: Readonly<Partial<Record<TierName, string>>>
  /** Tiers whose once-a-session budget has been spent. */
  readonly spent: readonly TierName[]
}

export const FRESH: PickerState = { last: {}, spent: [] }

export interface Pick {
  readonly effect: Effect
  readonly tier: TierName
  readonly state: PickerState
}

function has(anchor: Anchor, requirement: Requirement): boolean {
  return anchor[requirement] !== null
}

function eligible(effect: Effect, anchor: Anchor, state: PickerState): boolean {
  if (TIERS[effect.tier].oncePerSession && state.spent.includes(effect.tier)) return false
  return effect.needs.every((requirement) => has(anchor, requirement))
}

/**
 * Choose an effect for `tier`, or the loudest eligible one below it.
 *
 * `draw` is a number in [0, 1) — `Math.random` in the app, a fixed value in the
 * tests. Passing it in rather than reaching for a generator keeps this a pure
 * function, which is what lets the weighting be asserted rather than eyeballed.
 */
export function pick(tier: TierName, anchor: Anchor, state: PickerState, draw: number): Pick | null {
  const from = TIER_ORDER.indexOf(tier)
  if (from === -1) return null

  for (let step = from; step < TIER_ORDER.length; step++) {
    const candidate = TIER_ORDER[step]
    if (candidate === undefined) continue
    const chosen = choose(candidate, anchor, state, draw)
    if (chosen === null) continue
    return {
      effect: chosen,
      tier: candidate,
      state: {
        last: { ...state.last, [candidate]: chosen.id },
        spent: TIERS[candidate].oncePerSession && !state.spent.includes(candidate)
          ? [...state.spent, candidate]
          : state.spent,
      },
    }
  }
  return null
}

function choose(tier: TierName, anchor: Anchor, state: PickerState, draw: number): Effect | null {
  const pool = effectsIn(tier).filter((effect) => eligible(effect, anchor, state))
  if (pool.length === 0) return null

  // Drop the one drawn last, unless it is the only one left — an effect that
  // can never repeat and has no sibling would mean no reaction at all.
  const previous = state.last[tier]
  const fresh = pool.length > 1 ? pool.filter((effect) => effect.id !== previous) : pool
  if (fresh.length === 1) return fresh[0] ?? null

  const weights = fresh.map((effect) => 1 / Math.max(energy(effect), 1))
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  let cursor = Math.min(Math.max(draw, 0), 0.999999) * total
  for (let i = 0; i < fresh.length; i++) {
    cursor -= weights[i] ?? 0
    if (cursor < 0) return fresh[i] ?? null
  }
  return fresh[fresh.length - 1] ?? null
}
