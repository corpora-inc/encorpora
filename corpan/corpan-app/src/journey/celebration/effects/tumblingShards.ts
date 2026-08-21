// effects/tumblingShards.ts — CSS-3D tumbling shards. A handful of thin slivers
// spawn at the anchor and tumble outward, spinning on all three axes (rotateX/Y/Z
// + translateZ for genuine depth) as they fall under a perspective camera. No 3D
// engine — pure Web Animations API. Excluded under reduced-motion (real spin).

import { comboMomentum } from "../../feed/cardTransition.ts"
import { canAnimate, createScope } from "./dom.ts"
import type { CelebrationEffect } from "./types.ts"

const PALETTE = [46, 12, 200, 280, 330, 160] // warm→cool spectrum of hues

export const tumblingShards: CelebrationEffect = {
  id: "shards",
  durationMs: 1150,
  minIntensity: "full",
  uses3d: true,
  energy: 0.6,
  minCombo: 2,
  render(container, ctx) {
    const scope = createScope(container)
    const m = comboMomentum(ctx.comboCount)
    const n = Math.round(12 + 10 * m) // 12 → ~22
    // Give the host a shared perspective so every shard reads the same camera.
    const prevPerspective = container.style.perspective
    container.style.perspective = "900px"

    for (let i = 0; i < n; i++) {
      const el = scope.spawn()
      const hue = PALETTE[i % PALETTE.length]
      const w = 7 + Math.random() * 9
      const h = 14 + Math.random() * 20
      el.style.left = "0px"
      el.style.top = "0px"
      el.style.width = `${w}px`
      el.style.height = `${h}px`
      el.style.borderRadius = "2px"
      el.style.transformStyle = "preserve-3d"
      el.style.background = `linear-gradient(135deg, hsl(${hue} 90% 66%), hsl(${hue + 24} 85% 52%))`
      el.style.boxShadow = `0 2px 10px hsl(${hue} 80% 45% / 0.45)`

      const ang = Math.random() * Math.PI * 2
      const dist = (70 + Math.random() * 150) * (0.85 + m * 0.6)
      const dx = Math.cos(ang) * dist
      const dy = Math.sin(ang) * dist - 40 // slight upward bias, then gravity in the fall
      const fall = dy + 120 + Math.random() * 90
      const zPop = 120 + Math.random() * 260
      const rx = 360 + Math.random() * 720
      const ry = 360 + Math.random() * 720
      const rz = 180 + Math.random() * 540

      if (canAnimate(el)) {
        scope.track(
          el.animate(
            [
              {
                transform: `translate3d(${ctx.cx}px, ${ctx.cy}px, 0) rotateX(0deg) rotateY(0deg) rotateZ(0deg) scale(0.4)`,
                opacity: 1,
              },
              {
                transform: `translate3d(${ctx.cx + dx}px, ${ctx.cy + dy}px, ${zPop}px) rotateX(${rx * 0.5}deg) rotateY(${ry * 0.5}deg) rotateZ(${rz * 0.5}deg) scale(1)`,
                opacity: 1,
                offset: 0.45,
              },
              {
                transform: `translate3d(${ctx.cx + dx * 1.15}px, ${ctx.cy + fall}px, 0px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(0.9)`,
                opacity: 0,
              },
            ],
            {
              duration: 900 + Math.random() * 250,
              easing: "cubic-bezier(0.22, 0.61, 0.36, 1)",
              fill: "forwards",
            },
          ),
        )
      }
    }

    return () => {
      container.style.perspective = prevPerspective
      scope.dispose()
    }
  },
}
