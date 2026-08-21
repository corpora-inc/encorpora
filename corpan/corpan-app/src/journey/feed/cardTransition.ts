// src/journey/feed/cardTransition.ts — the ONE combo-reactive spring the feed
// reads for card-to-card advance + answer feedback (PREMIUM_SCROLL §3.1).
//
// Momentum you can *feel*: as the combo climbs, the card-to-card spring edges a
// hair snappier (stiffness up, damping steady) so the whole frame gets subtly
// more alive — the learner reads their own streak off the feel, never a counter.
// Break the combo and it exhales back to the calm baseline.
//
// Reduced-motion collapses the spring to a plain cross-fade (no travel, no
// bounce) — a first-class branch, not a degraded one. Pure math so the params
// are unit-testable without a renderer.

import type { Transition } from "framer-motion"

/** Calm baseline (matches the shipped feed spring: stiffness 320, damping 32). */
const BASE_STIFFNESS = 320
const BASE_DAMPING = 32

/** How much stiffness the streak can add, and where it saturates. A gentle,
 *  bounded lift — premium is intentional, not springy. */
const MAX_STIFFNESS_LIFT = 120 // at/above COMBO_SATURATION
const COMBO_SATURATION = 12 // combos past this add nothing more

/** 0..1 momentum from a combo count — eased so early combos matter most and it
 *  saturates gently (no runaway snappiness at combo 40). */
export function comboMomentum(combo: number): number {
  if (combo <= 1) return 0
  const raw = Math.min(combo, COMBO_SATURATION) / COMBO_SATURATION
  // ease-out: fast rise, gentle top
  return 1 - (1 - raw) * (1 - raw)
}

/** The combo-reactive stiffness. Baseline when calm; up to +MAX at saturation. */
export function comboStiffness(combo: number): number {
  return Math.round(BASE_STIFFNESS + MAX_STIFFNESS_LIFT * comboMomentum(combo))
}

/** Milestones where the ambient gauge pulses (mirrors the combo haptic/chime
 *  cadence: 5 / 10 / 25 …). Kept here (a `.ts` module) so it is unit-testable
 *  without the node runner choking on the `.tsx` gauge component. */
export function isComboMilestone(combo: number): boolean {
  return combo === 5 || combo === 10 || combo === 25 || (combo > 25 && combo % 25 === 0)
}

/**
 * The shared card transition. `reducedMotion` returns a cross-fade (tween,
 * opacity only — the caller animates opacity, not y). Otherwise a spring whose
 * stiffness scales gently with the combo.
 */
export function cardTransition(combo: number, reducedMotion: boolean): Transition {
  if (reducedMotion) return { type: "tween", duration: 0.2, ease: "easeOut" }
  return { type: "spring", stiffness: comboStiffness(combo), damping: BASE_DAMPING }
}

/**
 * The "settle weight" pulse a correct answer gives — a single small, heavy
 * scale beat (1 → 1.015 → 1), NOT a bounce (PREMIUM_SCROLL §3.1). Slightly
 * firmer at high combo. Reduced-motion ⇒ no pulse (empty keyframes).
 */
export function settleWeight(
  combo: number,
  reducedMotion: boolean,
): { scale: number[]; transition: Transition } {
  if (reducedMotion) return { scale: [1], transition: { duration: 0 } }
  const peak = 1.015 + 0.006 * comboMomentum(combo)
  return {
    scale: [1, peak, 1],
    transition: { duration: 0.14, ease: "easeOut", times: [0, 0.4, 1] },
  }
}
