// The renderer's entry point. Draw order is fixed and cheap: cold background,
// the furnace column, the workbench, then every additive pass together at the
// end so the compositing mode is switched twice per frame rather than two
// hundred times.
//
// Each region lives in its own module; this file owns only the order.

import type { Game } from "../game/types.ts"
import { text } from "../render/gfx.ts"
import { drawBackdrop, drawFurnace } from "./backdrop.ts"
import { drawChain } from "./chain.ts"
import { drawFloats, drawFlyers, drawStamp } from "./ephemera.ts"
import { drawHeader } from "./header.ts"
import { drawOverlay } from "./overlays.ts"
import { drawAnvil } from "./workbench.ts"

export { overlayQuestionRects, markRects } from "./overlays.ts"

export function drawScene(ctx: CanvasRenderingContext2D, g: Game): void {
  const L = g.layout
  ctx.save()
  ctx.translate(g.juice.shakeX, g.juice.shakeY)

  drawBackdrop(ctx, g)
  drawFurnace(ctx, g)
  drawChain(ctx, g)
  drawHeader(ctx, g)
  drawAnvil(ctx, g)

  g.particles.draw(ctx)
  drawFlyers(ctx, g)
  drawFloats(ctx, g)
  drawStamp(ctx, g)

  ctx.restore()

  if (g.mode !== "play") drawOverlay(ctx, g)

  if (g.juice.flash > 0.003) {
    ctx.fillStyle = `rgba(255,246,224,${g.juice.flash})`
    ctx.fillRect(0, 0, L.w, L.h)
  }

  if (g.showFps) {
    text(ctx, `${g.fps.toFixed(0)} fps · ${g.particles.count()}p`, 8, L.h - 8, {
      size: 12,
      mono: true,
      color: "rgba(255,255,255,0.45)",
    })
  }
}
