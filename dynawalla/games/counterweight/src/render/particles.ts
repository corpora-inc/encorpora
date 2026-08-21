// Sparks off struck steel, and the shards of a sheared beam.
//
// A fixed pool, no allocation in the loop, and a hard ceiling on how much can be
// on screen at once — the juice dose in EXPERIENCE_DESIGN is a ceiling, not a
// target. Under reduced motion the emitters are simply never called; the field
// still exists and still draws nothing, which is cheaper than branching in the
// draw path.

import { alpha } from "./palette.ts"

type Spark = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  size: number
  hue: string
}

const CAP = 120

export class Sparks {
  private readonly pool: Spark[] = []
  private cursor = 0

  constructor() {
    for (let i = 0; i < CAP; i++) {
      this.pool.push({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 1, hue: "#fff" })
    }
  }

  /** A blow landed on a plate: a short cone of sparks off the face. */
  strike(x: number, y: number, dir: number, strength: number, hue: string): void {
    const n = Math.min(14, 4 + Math.round(strength))
    for (let i = 0; i < n; i++) {
      const s = this.pool[this.cursor++ % CAP] as Spark
      const spread = (i / n - 0.5) * 2.2
      const speed = 90 + strength * 26 + i * 7
      s.x = x
      s.y = y
      s.vx = spread * speed * 0.5
      s.vy = -dir * speed
      s.max = 260 + (i % 5) * 40
      s.life = s.max
      s.size = 1.4 + (i % 3) * 0.7
      s.hue = hue
    }
  }

  /** The steel let go. A wide, slow shower — the only big effect in the game. */
  shear(x: number, y: number, hue: string): void {
    for (let i = 0; i < 40; i++) {
      const s = this.pool[this.cursor++ % CAP] as Spark
      const a = (i / 40) * Math.PI * 2
      const speed = 130 + (i % 7) * 34
      s.x = x
      s.y = y
      s.vx = Math.cos(a) * speed
      s.vy = Math.sin(a) * speed - 60
      s.max = 520 + (i % 6) * 70
      s.life = s.max
      s.size = 1.6 + (i % 4) * 0.9
      s.hue = hue
    }
  }

  advance(dtMs: number): void {
    const dt = dtMs / 1000
    for (const s of this.pool) {
      if (s.life <= 0) continue
      s.life -= dtMs
      s.vy += 900 * dt
      s.vx *= 0.985
      s.x += s.vx * dt
      s.y += s.vy * dt
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const s of this.pool) {
      if (s.life <= 0) continue
      const t = s.life / s.max
      ctx.fillStyle = alpha(s.hue, t * t)
      ctx.fillRect(s.x - s.size / 2, s.y - s.size / 2, s.size, s.size * (1 + (1 - t) * 1.6))
    }
  }
}
