/**
 * Shockwave rings — the single most legible way to say "something just happened
 * HERE, and it was this big". Expanding, thinning, easing out; a ground-hugging
 * variant that flattens into a dust wave rolling along the plain.
 */

import { clamp01, easeOutCubic } from '../core/ease.ts'

type Ring = {
  x: number
  y: number
  t: number
  life: number
  r0: number
  r1: number
  wide: number
  flat: number
  color: string
  live: boolean
}

export class Rings {
  private pool: Ring[] = []

  constructor(cap = 16) {
    for (let i = 0; i < cap; i++) {
      this.pool.push({ x: 0, y: 0, t: 0, life: 1, r0: 0, r1: 1, wide: 1, flat: 1, color: '#fff', live: false })
    }
  }

  add(
    x: number,
    y: number,
    r0: number,
    r1: number,
    life: number,
    color: string,
    wide = 3,
    flat = 1,
  ): void {
    let r = this.pool.find((p) => !p.live)
    if (!r) r = this.pool[0]
    r.x = x
    r.y = y
    r.t = 0
    r.life = life
    r.r0 = r0
    r.r1 = r1
    r.wide = wide
    r.flat = flat
    r.color = color
    r.live = true
  }

  clear(): void {
    for (const r of this.pool) r.live = false
  }

  update(dt: number): void {
    for (const r of this.pool) {
      if (!r.live) continue
      r.t += dt
      if (r.t >= r.life) r.live = false
    }
  }

  draw(ctx: CanvasRenderingContext2D, s: number): void {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    for (const r of this.pool) {
      if (!r.live) continue
      const k = clamp01(r.t / r.life)
      const e = easeOutCubic(k)
      const rad = r.r0 + (r.r1 - r.r0) * e
      const a = (1 - k) * (1 - k)
      ctx.beginPath()
      ctx.ellipse(r.x, r.y, rad, rad * r.flat, 0, 0, Math.PI * 2)
      ctx.strokeStyle = r.color
      ctx.globalAlpha = a * 0.85
      ctx.lineWidth = (r.wide * (1 - e * 0.85)) / s
      ctx.stroke()
    }
    ctx.restore()
    ctx.globalAlpha = 1
  }
}
