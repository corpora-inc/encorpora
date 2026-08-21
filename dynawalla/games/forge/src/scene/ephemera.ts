// Floating figures, thrown ingots, and the order-of-magnitude stamp.

import type { Game } from "../game/types.ts"
import { GLOW_GOLD, GLOW_HOT, PAL, glow, text } from "../render/gfx.ts"
import { clamp01, ease } from "../render/juice.ts"

// --- ephemera ---------------------------------------------------------------

export function drawFloats(ctx: CanvasRenderingContext2D, g: Game): void {
  for (const f of g.floats) {
    const t = f.life / f.max
    text(ctx, f.text, f.x, f.y, {
      size: f.size,
      mono: true,
      align: "center",
      color: f.color,
      alpha: t > 0.8 ? (1 - t) / 0.2 : Math.min(1, t * 1.6),
      glowColor: GLOW_HOT,
      glowRadius: f.size,
    })
  }
}

export function drawFlyers(ctx: CanvasRenderingContext2D, g: Game): void {
  const prev = ctx.globalCompositeOperation
  ctx.globalCompositeOperation = "lighter"
  for (const f of g.flyers) {
    const t = clamp01(f.t / f.dur)
    const k = ease.inQuad(t)
    const x = f.x0 + (f.x1 - f.x0) * k
    // An arc, not a line: a lump of hot metal thrown across a room.
    const y = f.y0 + (f.y1 - f.y0) * k - Math.sin(t * Math.PI) * 90 * g.layout.scale
    f.x = x
    f.y = y
    glow(ctx, x, y, f.size * (1 - t * 0.4), f.color, 0.9)
  }
  ctx.globalCompositeOperation = prev
}

export function drawStamp(ctx: CanvasRenderingContext2D, g: Game): void {
  if (g.stamp <= 0) return
  const L = g.layout
  const t = 1 - clamp01(g.stamp)
  const k = ease.outBack(Math.min(1, t * 2.6))
  const alpha = t > 0.6 ? (1 - t) / 0.4 : 1
  // Centre of the whole screen, not over the readout it is about: a milestone
  // that covers the number it just changed is a milestone you cannot read.
  const cx = L.w / 2
  const cy = L.h * 0.43
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(cx, cy)
  ctx.scale(2.6 - k * 1.6, 2.6 - k * 1.6)
  ctx.rotate((1 - k) * 0.3)
  text(ctx, g.stampText, 0, 0, {
    size: Math.round(52 * L.scale),
    align: "center",
    color: PAL.white,
    glowColor: GLOW_GOLD,
    glowRadius: 110 * L.scale,
    tracking: 2,
  })
  ctx.restore()
  // Shockwave ring.
  ctx.save()
  ctx.globalAlpha = alpha * 0.5
  ctx.strokeStyle = "rgba(255,214,120,0.9)"
  ctx.lineWidth = 4 * (1 - t)
  ctx.beginPath()
  ctx.arc(cx, cy, 40 + t * 320 * L.scale, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}
