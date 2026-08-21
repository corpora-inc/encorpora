// effects/shockwave.ts — an expanding shockwave ring plus a radial starburst of
// thin spokes firing outward from the anchor. Pure 2D scale/opacity (no spin),
// so it is safe under reduced-motion and runs from the "reduced" floor up — the
// calm-but-satisfying middle-energy effect.

import { comboMomentum } from "../../feed/cardTransition.ts"
import { canAnimate, createScope } from "./dom.ts"
import type { CelebrationEffect } from "./types.ts"

export const shockwave: CelebrationEffect = {
  id: "shockwave",
  durationMs: 900,
  minIntensity: "reduced",
  uses3d: false,
  energy: 0.45,
  render(container, ctx) {
    const scope = createScope(container)
    const m = comboMomentum(ctx.comboCount)
    const reduced = ctx.reducedMotion || ctx.intensity === "reduced"

    // --- the ring ---
    const ring = scope.spawn()
    const ringSize = 40
    ring.style.left = "0px"
    ring.style.top = "0px"
    ring.style.width = `${ringSize}px`
    ring.style.height = `${ringSize}px`
    ring.style.marginLeft = `${-ringSize / 2}px`
    ring.style.marginTop = `${-ringSize / 2}px`
    ring.style.borderRadius = "50%"
    ring.style.border = `3px solid hsl(${ctx.hue} 90% 66%)`
    ring.style.boxShadow = `0 0 24px hsl(${ctx.hue} 90% 60% / 0.55)`
    const ringScale = 5 + 5 * m
    if (canAnimate(ring)) {
      scope.track(
        ring.animate(
          [
            { transform: `translate(${ctx.cx}px, ${ctx.cy}px) scale(0.2)`, opacity: 0.9, borderWidth: "3px" },
            { transform: `translate(${ctx.cx}px, ${ctx.cy}px) scale(${ringScale})`, opacity: 0, borderWidth: "0.5px" },
          ],
          { duration: 720, easing: "cubic-bezier(0.16, 0.84, 0.44, 1)", fill: "forwards" },
        ),
      )
    }

    // --- the starburst spokes (skipped in reduced-motion: keep it a plain ring) ---
    if (!reduced) {
      const spokes = Math.round(10 + 8 * m)
      for (let i = 0; i < spokes; i++) {
        const spoke = scope.spawn()
        const hue = ctx.hue + (i % 2 === 0 ? 0 : 30)
        const len = 26 + Math.random() * 14
        const ang = (i / spokes) * 360 + Math.random() * 8
        spoke.style.left = "0px"
        spoke.style.top = "0px"
        spoke.style.width = `${len}px`
        spoke.style.height = "3px"
        spoke.style.borderRadius = "2px"
        spoke.style.transformOrigin = "0% 50%"
        spoke.style.background = `linear-gradient(90deg, hsl(${hue} 92% 68%), transparent)`
        const reach = (60 + Math.random() * 70) * (0.9 + m * 0.5)
        if (canAnimate(spoke)) {
          scope.track(
            spoke.animate(
              [
                { transform: `translate(${ctx.cx}px, ${ctx.cy}px) rotate(${ang}deg) translateX(6px) scaleX(0.2)`, opacity: 1 },
                { transform: `translate(${ctx.cx}px, ${ctx.cy}px) rotate(${ang}deg) translateX(${reach}px) scaleX(1)`, opacity: 0 },
              ],
              { duration: 620 + Math.random() * 160, easing: "cubic-bezier(0.12, 0.7, 0.3, 1)", fill: "forwards" },
            ),
          )
        }
      }
    }

    return () => scope.dispose()
  },
}
