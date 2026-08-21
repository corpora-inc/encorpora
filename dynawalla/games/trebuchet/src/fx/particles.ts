/**
 * Pooled particle system. Fixed allocation, swap-remove, hard caps.
 *
 * Everything is drawn with at most a handful of canvas calls per kind: sparks are
 * one stroked path, dust is one filled path per alpha bucket, embers are a
 * pre-rendered glow sprite via drawImage. No shadowBlur anywhere — it is the single
 * most expensive thing you can put in a 2D canvas frame.
 */

export type Kind = 0 | 1 | 2 | 3 | 4
export const SPARK: Kind = 0
export const DUST: Kind = 1
export const EMBER: Kind = 2
export const DEBRIS: Kind = 3
export const SHARD: Kind = 4

type P = {
  kind: Kind
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  rot: number
  spin: number
  drag: number
  grav: number
  /** 0..2 colour bucket within the kind */
  tone: number
  bounce: number
  w: number
  h: number
}

const make = (): P => ({
  kind: SPARK,
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  life: 0,
  maxLife: 1,
  size: 1,
  rot: 0,
  spin: 0,
  drag: 0,
  grav: 0,
  tone: 0,
  bounce: 0,
  w: 1,
  h: 1,
})

export class Particles {
  private pool: P[]
  private n = 0
  readonly cap: number
  /** scaled down under prefers-reduced-motion and on weak frames */
  budget = 1

  constructor(cap = 1500) {
    this.cap = cap
    this.pool = new Array(cap)
    for (let i = 0; i < cap; i++) this.pool[i] = make()
  }

  get count(): number {
    return this.n
  }

  clear(): void {
    this.n = 0
  }

  private recycle = 0

  private spawn(): P | null {
    if (this.n >= this.cap) {
      // Recycle rather than drop: an impact must never look thin because the
      // rain happened to be busy. Round-robin so we never eat the same slot.
      this.recycle = (this.recycle + 1) % this.cap
      return this.pool[this.recycle]
    }
    return this.pool[this.n++]
  }

  emit(
    kind: Kind,
    x: number,
    y: number,
    vx: number,
    vy: number,
    opts: Partial<Omit<P, 'kind' | 'x' | 'y' | 'vx' | 'vy'>> = {},
  ): void {
    const p = this.spawn()
    if (!p) return
    p.kind = kind
    p.x = x
    p.y = y
    p.vx = vx
    p.vy = vy
    p.maxLife = opts.maxLife ?? 0.6
    p.life = p.maxLife
    p.size = opts.size ?? 0.35
    p.rot = opts.rot ?? 0
    p.spin = opts.spin ?? 0
    p.drag = opts.drag ?? 0.6
    p.grav = opts.grav ?? 0
    p.tone = opts.tone ?? 0
    p.bounce = opts.bounce ?? 0
    p.w = opts.w ?? p.size
    p.h = opts.h ?? p.size
  }

  update(dt: number, groundY: number): void {
    const pool = this.pool
    for (let i = 0; i < this.n; i++) {
      const p = pool[i]
      p.life -= dt
      if (p.life <= 0) {
        const last = pool[this.n - 1]
        pool[this.n - 1] = p
        pool[i] = last
        this.n--
        i--
        continue
      }
      p.vy -= p.grav * dt
      const d = Math.exp(-p.drag * dt)
      p.vx *= d
      p.vy *= d
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.rot += p.spin * dt
      if (p.bounce > 0 && p.y < groundY + p.size * 0.5) {
        p.y = groundY + p.size * 0.5
        p.vy = -p.vy * p.bounce
        p.vx *= 0.72
        p.spin *= 0.6
        if (Math.abs(p.vy) < 0.6) {
          p.vy = 0
          p.bounce = 0
          p.grav = 0
          p.vx *= 0.2
        }
      }
    }
  }

  /**
   * @param s pixels per metre (for line widths)
   */
  draw(
    ctx: CanvasRenderingContext2D,
    s: number,
    glow: CanvasImageSource,
    puff: CanvasImageSource,
    pal: Palette,
  ): void {
    const pool = this.pool
    const n = this.n

    // --- dust & smoke: a soft pre-rendered puff, so a cloud reads as a cloud
    // and not as a union of hard circles ------------------------------------
    for (let i = 0; i < n; i++) {
      const p = pool[i]
      if (p.kind !== DUST) continue
      const t = p.life / p.maxLife
      const r = p.size * (1 + (1 - t) * 2.6)
      ctx.globalAlpha = t * t * 0.5
      ctx.drawImage(puff, p.x - r, p.y - r, r * 2, r * 2)
    }
    ctx.globalAlpha = 1

    // --- debris & shards: rotated quads, grouped by tone ------------------
    for (let tone = 0; tone < 3; tone++) {
      let began = false
      for (let i = 0; i < n; i++) {
        const p = pool[i]
        if ((p.kind !== DEBRIS && p.kind !== SHARD) || p.tone !== tone) continue
        if (!began) {
          ctx.beginPath()
          began = true
        }
        const c = Math.cos(p.rot)
        const sn = Math.sin(p.rot)
        const hw = p.w * 0.5
        const hh = p.h * 0.5
        const x1 = c * hw
        const y1 = sn * hw
        const x2 = -sn * hh
        const y2 = c * hh
        ctx.moveTo(p.x - x1 - x2, p.y - y1 - y2)
        ctx.lineTo(p.x + x1 - x2, p.y + y1 - y2)
        ctx.lineTo(p.x + x1 + x2, p.y + y1 + y2)
        ctx.lineTo(p.x - x1 + x2, p.y - y1 + y2)
        ctx.closePath()
      }
      if (began) {
        ctx.fillStyle = pal.debris[tone]
        ctx.fill()
      }
    }

    // --- embers: additive glow sprite -------------------------------------
    ctx.globalCompositeOperation = 'lighter'
    for (let i = 0; i < n; i++) {
      const p = pool[i]
      if (p.kind !== EMBER) continue
      const t = p.life / p.maxLife
      const r = p.size * (0.5 + t * 1.4)
      ctx.globalAlpha = Math.min(1, t * 1.6) * 0.9
      ctx.drawImage(glow, p.x - r, p.y - r, r * 2, r * 2)
    }
    ctx.globalAlpha = 1

    // --- sparks: velocity-aligned streaks, one path per tone --------------
    ctx.lineCap = 'round'
    for (let tone = 0; tone < 3; tone++) {
      let began = false
      for (let i = 0; i < n; i++) {
        const p = pool[i]
        if (p.kind !== SPARK || p.tone !== tone) continue
        if (!began) {
          ctx.beginPath()
          began = true
        }
        const t = p.life / p.maxLife
        const len = Math.min(2.2, Math.hypot(p.vx, p.vy) * 0.032) * (0.4 + t)
        const m = Math.hypot(p.vx, p.vy) || 1
        ctx.moveTo(p.x, p.y)
        ctx.lineTo(p.x - (p.vx / m) * len, p.y - (p.vy / m) * len)
      }
      if (began) {
        ctx.strokeStyle = pal.spark[tone]
        ctx.lineWidth = (tone === 0 ? 2.6 : 1.7) / s
        ctx.globalAlpha = 0.95
        ctx.stroke()
      }
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }
}

export type Palette = {
  dust: string
  debris: [string, string, string]
  spark: [string, string, string]
}

/** A soft dark puff for smoke and dust. Same trick, opposite job. */
export function makePuffSprite(size = 96, color = '74,59,70'): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const g = c.getContext('2d')
  if (!g) return c
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0, `rgba(${color},0.85)`)
  grad.addColorStop(0.45, `rgba(${color},0.45)`)
  grad.addColorStop(1, `rgba(${color},0)`)
  g.fillStyle = grad
  g.fillRect(0, 0, size, size)
  return c
}

/** Pre-render a soft radial glow once. drawImage of this is ~20x cheaper than a gradient fill. */
export function makeGlowSprite(size = 96, inner = '#fff5d8', outer = '#ff6a1e'): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const g = c.getContext('2d')
  if (!g) return c
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0, inner)
  grad.addColorStop(0.28, outer)
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, size, size)
  return c
}
