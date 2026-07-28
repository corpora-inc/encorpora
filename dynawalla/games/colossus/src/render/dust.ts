// Dust. A slab landing on a slab throws a low sheet of it sideways; a slab
// blowing out throws it everywhere.
//
// Reduced motion does not get "less dust". It gets a different thing: one soft
// ring that expands once and fades, which reads as an impact without anything
// travelling across the field of view.

import { unit } from "../core/feel.ts"
import type { Rng } from "../core/rng.ts"
import { DUST } from "./palette.ts"

type Mote = {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  life: number
  age: number
}

type Ring = { x: number; y: number; r: number; life: number; age: number }

const MAX_MOTES = 260

export class Dust {
  private motes: Mote[] = []
  private rings: Ring[] = []
  private readonly rng: Rng
  private readonly reduced: boolean

  constructor(rng: Rng, reduced: boolean) {
    this.rng = rng
    this.reduced = reduced
  }

  /** A slab set down hard: a low sheet that runs out sideways along the stone. */
  impact(x: number, y: number, width: number, force: number): void {
    if (this.reduced) {
      this.rings.push({ x, y, r: width * 0.3, life: 420, age: 0 })
      return
    }
    const n = Math.round(6 + force * 16)
    for (let i = 0; i < n; i++) {
      const side = this.rng.chance(0.5) ? -1 : 1
      this.push({
        x: x + this.rng.range(-width * 0.5, width * 0.5),
        y: y + this.rng.range(-3, 3),
        vx: side * this.rng.range(0.04, 0.34) * (0.5 + force),
        vy: -this.rng.range(0.02, 0.16) * (0.4 + force),
        r: this.rng.range(2, 7.5),
        life: this.rng.range(520, 1250),
        age: 0,
      })
    }
  }

  /** A slab blown out of the building. */
  burst(x: number, y: number, width: number): void {
    if (this.reduced) {
      this.rings.push({ x, y, r: width * 0.45, life: 520, age: 0 })
      return
    }
    for (let i = 0; i < 26; i++) {
      const a = this.rng.range(0, Math.PI * 2)
      const s = this.rng.range(0.06, 0.52)
      this.push({
        x: x + this.rng.range(-width * 0.4, width * 0.4),
        y: y + this.rng.range(-10, 10),
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 0.08,
        r: this.rng.range(2.5, 10),
        life: this.rng.range(680, 1600),
        age: 0,
      })
    }
  }

  private push(m: Mote): void {
    if (this.motes.length >= MAX_MOTES) this.motes.shift()
    this.motes.push(m)
  }

  advance(dt: number): void {
    for (const m of this.motes) {
      m.age += dt
      m.x += m.vx * dt
      m.y += m.vy * dt
      m.vy += 0.00022 * dt // dust is light; it hangs, then sinks
      m.vx *= 0.995
      m.r += 0.006 * dt
    }
    this.motes = this.motes.filter((m) => m.age < m.life)
    for (const r of this.rings) r.age += dt
    this.rings = this.rings.filter((r) => r.age < r.life)
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save()
    for (const m of this.motes) {
      const t = unit(m.age / m.life)
      ctx.globalAlpha = (1 - t) * (1 - t) * 0.5
      ctx.fillStyle = DUST
      ctx.beginPath()
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2)
      ctx.fill()
    }
    for (const r of this.rings) {
      const t = unit(r.age / r.life)
      ctx.globalAlpha = (1 - t) * 0.34
      ctx.strokeStyle = DUST
      ctx.lineWidth = 10 * (1 - t) + 1
      ctx.beginPath()
      ctx.arc(r.x, r.y, r.r * (0.5 + t * 1.5), 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.restore()
  }

  clear(): void {
    this.motes = []
    this.rings = []
  }
}
