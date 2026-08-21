/**
 * Screen light — and the one place that decides how bright the world is allowed to
 * get, how often.
 *
 * This is a children's product. Photosensitive epilepsy is triggered by *rate* and
 * *contrast*, so both are capped here rather than at each call site: no more than
 * `MAX_PER_SEC` bright events per second, never above `MAX_ALPHA`, and every event
 * ramps rather than steps. A big hit during a lightning strike does not add up to a
 * white frame — the budget is shared.
 */

import { clamp01, easeOutCubic } from '../core/ease.ts'

export class Flash {
  private events: Array<{ t: number; life: number; amp: number; x: number; y: number; r: number }> = []
  private recent: number[] = []
  private now = 0
  motion = 1

  static readonly MAX_PER_SEC = 3
  static readonly MAX_ALPHA = 0.34
  /** shortest a bright event may last — a hard strobe is never allowed */
  static readonly MIN_LIFE = 0.13

  /** @returns whether the flash was allowed */
  add(amp: number, life: number, x = 0.5, y = 0.5, r = 1): boolean {
    this.recent = this.recent.filter((t) => this.now - t < 1)
    if (this.recent.length >= Flash.MAX_PER_SEC) return false
    this.recent.push(this.now)
    const life2 = Math.max(Flash.MIN_LIFE, life)
    this.events.push({
      t: 0,
      life: life2,
      amp: clamp01(amp) * this.motion,
      x,
      y,
      r,
    })
    return true
  }

  update(dt: number): void {
    this.now += dt
    for (let i = this.events.length - 1; i >= 0; i--) {
      const e = this.events[i]
      e.t += dt
      if (e.t >= e.life) this.events.splice(i, 1)
    }
  }

  /** Composite every live event, clamped in total. Screen space. */
  draw(ctx: CanvasRenderingContext2D, w: number, h: number, tint: string): void {
    if (!this.events.length) return
    let total = 0
    for (const e of this.events) {
      const k = clamp01(e.t / e.life)
      // fast rise, slow fall — never a square edge
      const env = k < 0.18 ? easeOutCubic(k / 0.18) : 1 - easeOutCubic((k - 0.18) / 0.82)
      total += e.amp * env
    }
    if (total <= 0.001) return
    const a = Math.min(Flash.MAX_ALPHA, total)
    // Use the brightest event's position for the falloff centre.
    let best = this.events[0]
    let bestAmp = -1
    for (const e of this.events) {
      if (e.amp > bestAmp) {
        bestAmp = e.amp
        best = e
      }
    }
    const cx = best.x * w
    const cy = best.y * h
    const rad = best.r * Math.max(w, h)
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad)
    g.addColorStop(0, tint)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.globalAlpha = a
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    ctx.restore()
  }

  clear(): void {
    this.events.length = 0
  }
}
