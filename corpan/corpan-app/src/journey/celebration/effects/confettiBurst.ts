// effects/confettiBurst.ts — the upgraded, combo-scaled confetti burst. Builds
// on the shared canvas engine (particles.ts): denser + full-spectrum + spinning
// rectangles, with density that climbs with the combo. Calm (reduced-motion) it
// stays a soft mono-ish puff. This is the low-energy, always-eligible baseline.

import { burst } from "../particles.ts"
import { comboMomentum } from "../../feed/cardTransition.ts"
import type { CelebrationEffect } from "./types.ts"

export const confettiBurst: CelebrationEffect = {
  id: "confetti",
  durationMs: 1200,
  minIntensity: "reduced",
  uses3d: false,
  energy: 0.3,
  render(_container, ctx) {
    if (!ctx.canvas) return () => {}
    const m = comboMomentum(ctx.comboCount)
    const reduced = ctx.reducedMotion || ctx.intensity === "reduced"
    if (reduced) {
      // gentle, near-monochrome puff — no spectrum, no spin
      burst(ctx.canvas, ctx.cx, ctx.cy, { count: Math.round(14 + 10 * m), hue: ctx.hue })
    } else {
      const count = Math.round(30 + 60 * m) // 30 → ~90 as the streak climbs
      burst(ctx.canvas, ctx.cx, ctx.cy, {
        count,
        colorful: true,
        power: 1 + 0.5 * m,
        upward: 0.55,
      })
    }
    // particles.ts owns its own RAF lifecycle (stops when empty); nothing to tear
    // down here — the layer calls clearParticles on skip/unmount.
    return () => {}
  },
}
