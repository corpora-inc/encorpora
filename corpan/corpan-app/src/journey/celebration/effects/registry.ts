// effects/registry.ts — the effect registry + the rotation/escalation picker
// (PREMIUM_SCROLL §3.4). The CelebrationLayer rotates through these on every
// correct: non-repeating (never the last pick), intensity/reduced-motion gated,
// and COMBO-WEIGHTED so early cards stay calm and deep combos trend to fireworks.
//
// The picker is pure (RNG injected) so both eligibility and escalation are
// unit-testable without a renderer.

import { comboMomentum } from "../../feed/cardTransition.ts"
import { INTENSITY_RANK, type CelebrationEffect, type EffectContext } from "./types.ts"
import { confettiBurst } from "./confettiBurst.ts"
import { tumblingShards } from "./tumblingShards.ts"
import { badgeFlip } from "./badgeFlip.ts"
import { shockwave } from "./shockwave.ts"
import { neonPop } from "./neonPop.ts"

/** All registered effects. Add an effect here and it joins the rotation. */
export const EFFECTS: readonly CelebrationEffect[] = [
  confettiBurst,
  shockwave,
  tumblingShards,
  badgeFlip,
  neonPop,
]

/** Whether an effect may run for the given moment (intensity + motion + combo). */
export function isEligible(effect: CelebrationEffect, ctx: EffectContext): boolean {
  if (INTENSITY_RANK[ctx.intensity] < INTENSITY_RANK[effect.minIntensity]) return false
  if (ctx.reducedMotion && effect.uses3d) return false
  if ((effect.minCombo ?? 0) > ctx.comboCount) return false
  return true
}

export function eligibleEffects(ctx: EffectContext): CelebrationEffect[] {
  return EFFECTS.filter((e) => isEligible(e, ctx))
}

/**
 * Selection weight for an effect at a given combo. Escalation curve: at low
 * combo (momentum→0) low-energy effects dominate; at high combo (momentum→1)
 * high-energy effects dominate. A floor keeps every eligible effect possible so
 * the rotation always feels varied, never deterministic.
 */
export function effectWeight(effect: CelebrationEffect, comboCount: number): number {
  const m = comboMomentum(comboCount) // 0..1
  const e = effect.energy // 0..1
  const aligned = (1 - m) * (1 - e) + m * e // peaks at e≈0 when calm, e≈1 when hot
  return 0.15 + aligned
}

export interface EffectPicker {
  /** Choose the next effect for `ctx`, or null when none are eligible. */
  pick(ctx: EffectContext): CelebrationEffect | null
}

export interface EffectPickerOpts {
  /** How many recent picks to avoid repeating (default 1). */
  avoid?: number
  /** Injected RNG for deterministic tests (default Math.random). */
  rng?: () => number
  /** Override the effect list (tests). */
  effects?: readonly CelebrationEffect[]
}

/**
 * A stateful, non-repeating, combo-weighted picker. Avoids the last `avoid`
 * effect ids (unless that would leave nothing eligible), then draws by
 * `effectWeight`. Pure given the injected RNG.
 */
export function createEffectPicker(opts: EffectPickerOpts = {}): EffectPicker {
  const rng = opts.rng ?? Math.random
  const avoid = Math.max(0, opts.avoid ?? 1)
  const list = opts.effects ?? EFFECTS
  let recent: string[] = []

  return {
    pick(ctx) {
      const eligible = list.filter((e) => isEligible(e, ctx))
      if (eligible.length === 0) return null
      let pool = eligible.filter((e) => !recent.includes(e.id))
      if (pool.length === 0) pool = eligible // avoidance never starves the pool

      const weights = pool.map((e) => effectWeight(e, ctx.comboCount))
      const total = weights.reduce((a, b) => a + b, 0)
      let r = rng() * total
      let chosen = pool[pool.length - 1]
      for (let i = 0; i < pool.length; i++) {
        r -= weights[i]
        if (r <= 0) {
          chosen = pool[i]
          break
        }
      }

      recent.push(chosen.id)
      while (recent.length > avoid) recent.shift()
      return chosen
    },
  }
}
