// Shared drawing helpers for the scene modules.

import type { Rect } from "../game/layout.ts"
import { measure } from "../render/gfx.ts"

export function fitSize(
  ctx: CanvasRenderingContext2D,
  str: string,
  maxW: number,
  start: number,
  mono: boolean,
  tracking = 0,
): number {
  let s = start
  while (s > 8 && measure(ctx, str, s, mono, tracking) > maxW) s -= 1
  return s
}

export function chevron(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, c: string): void {
  ctx.beginPath()
  ctx.moveTo(x, y - s)
  ctx.lineTo(x + s * 0.85, y)
  ctx.lineTo(x, y + s)
  ctx.closePath()
  ctx.fillStyle = c
  ctx.fill()
}

/**
 * A chain across a sealed row. Links alternate between edge-on and flat, which
 * is the only thing that makes a row of ovals read as a chain rather than as a
 * decorative border. Shape, not colour, says "locked".
 */
export function chains(ctx: CanvasRenderingContext2D, r: Rect, t: number): void {
  ctx.save()
  const link = Math.min(r.h * 0.6, r.w / 12)
  const n = Math.max(4, Math.round(r.w / (link * 0.72)))
  const cy = r.y + r.h / 2
  for (let i = 0; i < n; i++) {
    const x = r.x + ((i + 0.5) * r.w) / n
    const sag = Math.sin(t * 1.6 + i * 0.5) * r.h * 0.04
    const flat = i % 2 === 0
    ctx.lineWidth = Math.max(2.5, link * 0.17)
    ctx.strokeStyle = flat ? "rgba(178,190,208,0.85)" : "rgba(108,120,138,0.85)"
    ctx.beginPath()
    ctx.ellipse(x, cy + sag, flat ? link * 0.42 : link * 0.15, link * 0.3, 0, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
}

// ---------------------------------------------------------------------------
