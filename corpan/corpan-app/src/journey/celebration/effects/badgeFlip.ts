// effects/badgeFlip.ts — a perspective "badge punch": a glowing star disc rushes
// toward the camera from deep in Z (translateZ −520 → 0) while flipping on X/Y,
// landing with a spring overshoot before receding. Genuine depth via CSS 3D, no
// engine. Excluded under reduced-motion (it flips).

import { canAnimate, createScope, OVERSHOOT } from "./dom.ts"
import type { CelebrationEffect } from "./types.ts"

export const badgeFlip: CelebrationEffect = {
  id: "flip",
  durationMs: 1100,
  minIntensity: "full",
  uses3d: true,
  energy: 0.55,
  render(container, ctx) {
    const scope = createScope(container)
    const prevPerspective = container.style.perspective
    container.style.perspective = "700px"

    const size = 96
    const el = scope.spawn()
    el.style.left = "0px"
    el.style.top = "0px"
    el.style.width = `${size}px`
    el.style.height = `${size}px`
    el.style.marginLeft = `${-size / 2}px`
    el.style.marginTop = `${-size / 2}px`
    el.style.display = "flex"
    el.style.alignItems = "center"
    el.style.justifyContent = "center"
    el.style.borderRadius = "22px"
    el.style.transformStyle = "preserve-3d"
    el.style.background = `radial-gradient(circle at 32% 28%, hsl(${ctx.hue} 92% 72%), hsl(${ctx.hue + 20} 84% 48%))`
    el.style.boxShadow = `0 10px 40px hsl(${ctx.hue} 85% 45% / 0.6), inset 0 2px 10px rgba(255,255,255,0.35)`
    el.style.color = "rgba(255,255,255,0.96)"
    el.style.fontSize = "44px"
    el.style.lineHeight = "1"
    el.style.fontWeight = "900"
    el.textContent = "✦"

    if (canAnimate(el)) {
      scope.track(
        el.animate(
          [
            {
              transform: `translate(${ctx.cx}px, ${ctx.cy}px) translateZ(-520px) rotateY(-120deg) rotateX(35deg) scale(0.6)`,
              opacity: 0,
            },
            {
              transform: `translate(${ctx.cx}px, ${ctx.cy}px) translateZ(90px) rotateY(10deg) rotateX(-6deg) scale(1.18)`,
              opacity: 1,
              offset: 0.55,
            },
            {
              transform: `translate(${ctx.cx}px, ${ctx.cy}px) translateZ(0px) rotateY(0deg) rotateX(0deg) scale(1)`,
              opacity: 1,
              offset: 0.72,
            },
            {
              transform: `translate(${ctx.cx}px, ${ctx.cy}px) translateZ(-140px) rotateY(60deg) rotateX(-18deg) scale(0.8)`,
              opacity: 0,
            },
          ],
          { duration: 1050, easing: OVERSHOOT, fill: "forwards" },
        ),
      )
    }

    return () => {
      container.style.perspective = prevPerspective
      scope.dispose()
    }
  },
}
