// effects/neonPop.ts — the high-energy finale: concentric neon rings pop out with
// a spring overshoot behind the praise word, wrapped in a bloom of glowing radial
// streaks. Heavy glow (box-shadow bloom), no 3D spin, so it reads as electric
// rather than dizzy. Reserved for deeper combos (the fireworks payoff).

import { comboMomentum } from "../../feed/cardTransition.ts"
import { canAnimate, createScope, OVERSHOOT } from "./dom.ts"
import type { CelebrationEffect } from "./types.ts"

const NEON = [ [280, 330], [190, 210], [40, 20] ] // hue pairs per ring, cool→hot

export const neonPop: CelebrationEffect = {
  id: "neonpop",
  durationMs: 1050,
  minIntensity: "full",
  uses3d: false,
  energy: 0.82,
  minCombo: 4,
  render(container, ctx) {
    const scope = createScope(container)
    const m = comboMomentum(ctx.comboCount)

    // --- concentric neon rings, each popping with an overshoot ---
    const rings = 3
    for (let i = 0; i < rings; i++) {
      const ring = scope.spawn()
      const [h1, h2] = NEON[i % NEON.length]
      const base = 70 + i * 46
      ring.style.left = "0px"
      ring.style.top = "0px"
      ring.style.width = `${base}px`
      ring.style.height = `${base}px`
      ring.style.marginLeft = `${-base / 2}px`
      ring.style.marginTop = `${-base / 2}px`
      ring.style.borderRadius = "50%"
      ring.style.border = `4px solid hsl(${h1} 95% 66%)`
      ring.style.boxShadow = `0 0 22px hsl(${h1} 95% 60% / 0.85), 0 0 44px hsl(${h2} 95% 58% / 0.6), inset 0 0 18px hsl(${h2} 95% 62% / 0.6)`
      const peak = 1.05 + 0.28 * m
      if (canAnimate(ring)) {
        scope.track(
          ring.animate(
            [
              { transform: `translate(${ctx.cx}px, ${ctx.cy}px) scale(0.2)`, opacity: 0 },
              { transform: `translate(${ctx.cx}px, ${ctx.cy}px) scale(${peak})`, opacity: 0.95, offset: 0.5 },
              { transform: `translate(${ctx.cx}px, ${ctx.cy}px) scale(${peak * 1.14})`, opacity: 0 },
            ],
            { duration: 850 + i * 90, delay: i * 60, easing: OVERSHOOT, fill: "forwards" },
          ),
        )
      }
    }

    // --- a bloom of glowing streaks radiating out ---
    const streaks = Math.round(8 + 10 * m)
    for (let i = 0; i < streaks; i++) {
      const s = scope.spawn()
      const hue = 40 + Math.random() * 300
      const len = 30 + Math.random() * 26
      const ang = (i / streaks) * 360 + Math.random() * 10
      s.style.left = "0px"
      s.style.top = "0px"
      s.style.width = `${len}px`
      s.style.height = "4px"
      s.style.borderRadius = "3px"
      s.style.transformOrigin = "0% 50%"
      s.style.background = `linear-gradient(90deg, hsl(${hue} 95% 70%), transparent)`
      s.style.boxShadow = `0 0 12px hsl(${hue} 95% 62% / 0.8)`
      const reach = (70 + Math.random() * 80) * (0.95 + m * 0.55)
      if (canAnimate(s)) {
        scope.track(
          s.animate(
            [
              { transform: `translate(${ctx.cx}px, ${ctx.cy}px) rotate(${ang}deg) translateX(8px) scaleX(0.2)`, opacity: 1 },
              { transform: `translate(${ctx.cx}px, ${ctx.cy}px) rotate(${ang}deg) translateX(${reach}px) scaleX(1)`, opacity: 0 },
            ],
            { duration: 680 + Math.random() * 200, easing: "cubic-bezier(0.1, 0.72, 0.28, 1)", fill: "forwards" },
          ),
        )
      }
    }

    return () => scope.dispose()
  },
}
