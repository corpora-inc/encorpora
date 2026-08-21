// A fixed-capacity particle pool. Allocated once, never grown, never garbage —
// a mid-range Android WebView cannot afford a collection inside the frame that
// carries the reaction.
//
// Three kinds, and they are the three materials in the game: brass filings off
// a break, cold sparks off a seat, and oxide dust off a lump of slag hitting
// the floor. Nothing here is confetti and nothing bursts radially from a point
// for its own sake — every emitter is called by something that physically
// happened.

export const KIND_FILING = 0
export const KIND_SPARK = 1
export const KIND_DUST = 2

const CAPACITY = 320

type P = {
  alive: boolean
  kind: number
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  spin: number
  angle: number
  colour: string
}

export class Particles {
  private readonly pool: P[] = []
  private cursor = 0

  constructor() {
    for (let i = 0; i < CAPACITY; i++) {
      this.pool.push({
        alive: false,
        kind: 0,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 1,
        size: 1,
        spin: 0,
        angle: 0,
        colour: "#fff",
      })
    }
  }

  private take(): P {
    for (let n = 0; n < CAPACITY; n++) {
      const p = this.pool[this.cursor] as P
      this.cursor = (this.cursor + 1) % CAPACITY
      if (!p.alive) return p
    }
    // Every slot is live. Steal the oldest rather than dropping the event: a
    // missing burst reads as a bug, an overwritten one reads as a busy frame.
    return this.pool[this.cursor] as P
  }

  clear(): void {
    for (const p of this.pool) p.alive = false
  }

  emit(
    kind: number,
    x: number,
    y: number,
    count: number,
    speed: number,
    colour: string,
    spread = Math.PI * 2,
    aim = 0,
  ): void {
    for (let i = 0; i < count; i++) {
      const p = this.take()
      const a = aim + (i / Math.max(1, count) - 0.5) * spread + Math.random() * 0.24 - 0.12
      const s = speed * (0.5 + Math.random() * 0.8)
      p.alive = true
      p.kind = kind
      p.x = x
      p.y = y
      p.vx = Math.cos(a) * s
      p.vy = Math.sin(a) * s
      p.maxLife = kind === KIND_SPARK ? 0.42 : 0.7 + Math.random() * 0.4
      p.life = p.maxLife
      p.size = kind === KIND_DUST ? 2.4 + Math.random() * 2.6 : 1.4 + Math.random() * 2.2
      p.angle = Math.random() * Math.PI
      p.spin = (Math.random() - 0.5) * 12
      p.colour = colour
    }
  }

  step(dt: number): void {
    for (const p of this.pool) {
      if (!p.alive) continue
      p.life -= dt
      if (p.life <= 0) {
        p.alive = false
        continue
      }
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.angle += p.spin * dt
      // Filings and dust fall; sparks are light and drift.
      p.vy += (p.kind === KIND_SPARK ? 190 : 980) * dt
      const drag = p.kind === KIND_SPARK ? 2.4 : 1.1
      p.vx -= p.vx * drag * dt
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.pool) {
      if (!p.alive) continue
      const t = p.life / p.maxLife
      ctx.globalAlpha = p.kind === KIND_SPARK ? t : Math.min(1, t * 1.6)
      ctx.fillStyle = p.colour
      if (p.kind === KIND_DUST) {
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * (0.5 + t * 0.7), 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.angle)
        const w = p.size * (p.kind === KIND_SPARK ? 2.6 : 1.5)
        ctx.fillRect(-w / 2, -p.size / 2, w, p.size)
        ctx.restore()
      }
    }
    ctx.globalAlpha = 1
  }
}
