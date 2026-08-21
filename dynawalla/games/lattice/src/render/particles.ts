// Sparks. A fixed pool, because a game that allocates in its draw loop is a
// game that stutters on a mid-range tablet halfway through a session.
//
// The vocabulary is deliberately mechanical: chips off carved stone, a filing
// struck off brass. Not confetti and not a starburst — the hostile reference
// board in the experience design names both, and this is where they would get
// in.

export type Spark = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  size: number
  hue: string
}

const POOL = 320

export class Sparks {
  private readonly pool: Spark[] = []
  private cursor = 0

  private reduced: boolean

  constructor(reduced: boolean) {
    this.reduced = reduced
    for (let i = 0; i < POOL; i++) {
      this.pool.push({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 1, hue: "#fff" })
    }
  }

  setReduced(reduced: boolean): void {
    this.reduced = reduced
    if (reduced) for (const s of this.pool) s.life = 0
  }

  /**
   * Throw `count` chips. Under reduced motion this is a third as many, a third
   * as fast and half as long-lived — present, so the moment still has an
   * edge, but with nothing travelling far enough to be a distraction.
   */
  burst(x: number, y: number, count: number, speed: number, hue: string, size = 2.4): void {
    const n = this.reduced ? Math.max(2, Math.round(count / 3)) : count
    const v = this.reduced ? speed * 0.28 : speed
    const life = this.reduced ? 220 : 520
    for (let i = 0; i < n; i++) {
      const s = this.pool[this.cursor] as Spark
      this.cursor = (this.cursor + 1) % POOL
      const a = Math.random() * Math.PI * 2
      const m = v * (0.4 + Math.random() * 0.6)
      s.x = x
      s.y = y
      s.vx = Math.cos(a) * m
      s.vy = Math.sin(a) * m
      s.max = life * (0.6 + Math.random() * 0.6)
      s.life = s.max
      s.size = size
      s.hue = hue
    }
  }

  step(dtMs: number): void {
    const dt = Math.min(120, dtMs) / 1000
    const drag = Math.exp(-3.4 * dt)
    for (const s of this.pool) {
      if (s.life <= 0) continue
      s.life -= dtMs
      s.x += s.vx * dt
      s.y += s.vy * dt
      s.vx *= drag
      s.vy *= drag
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const s of this.pool) {
      if (s.life <= 0) continue
      const t = s.life / s.max
      ctx.globalAlpha = Math.max(0, Math.min(1, t))
      ctx.fillStyle = s.hue
      const r = s.size * (0.4 + t * 0.6)
      ctx.fillRect(s.x - r, s.y - r, r * 2, r * 2)
    }
    ctx.globalAlpha = 1
  }
}
