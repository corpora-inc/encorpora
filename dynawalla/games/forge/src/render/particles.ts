// A pooled particle system. Fixed-capacity Float32Array columns, zero
// allocation after construction, and one `drawImage` per glowing particle
// against a pre-rendered sprite — never `shadowBlur`, which costs an order of
// magnitude more and is the usual reason a canvas game misses frame on a
// tablet.
//
// Sprites are pre-tinted (one canvas per colour) so tinting never needs a
// filter or a composite pass per particle.

export const KIND_EMBER = 0
export const KIND_SPARK = 1
export const KIND_STEAM = 2
export const KIND_GOLD = 3
export const KIND_SHARD = 4
export const KIND_COLD = 5

const SPRITE_COLORS = [
  "255,150,42", // ember
  "255,238,196", // spark, near-white hot
  "225,235,255", // steam
  "255,206,84", // gold
  "180,190,205", // shard (unused for glow, kept for index parity)
  "110,215,255", // cold / quench
]

export type Particles = {
  readonly capacity: number
  count(): number
  /** Scales every future burst. Drops under load and under reduced-motion. */
  budget: number
  spawn(
    kind: number,
    x: number,
    y: number,
    vx: number,
    vy: number,
    life: number,
    size: number,
    gravity?: number,
  ): void
  burst(o: {
    kind: number
    x: number
    y: number
    n: number
    speed: number
    spread?: number
    angle?: number
    life?: number
    size?: number
    gravity?: number
  }): void
  update(dt: number): void
  draw(ctx: CanvasRenderingContext2D): void
  clear(): void
}

function makeSprite(color: string, size: number): HTMLCanvasElement {
  const c = document.createElement("canvas")
  c.width = size
  c.height = size
  const g = c.getContext("2d")
  if (!g) return c
  const r = size / 2
  const grad = g.createRadialGradient(r, r, 0, r, r, r)
  grad.addColorStop(0, `rgba(${color},1)`)
  grad.addColorStop(0.28, `rgba(${color},0.62)`)
  grad.addColorStop(0.62, `rgba(${color},0.16)`)
  grad.addColorStop(1, `rgba(${color},0)`)
  g.fillStyle = grad
  g.fillRect(0, 0, size, size)
  return c
}

export function makeParticles(capacity = 1100): Particles {
  const px = new Float32Array(capacity)
  const py = new Float32Array(capacity)
  const pvx = new Float32Array(capacity)
  const pvy = new Float32Array(capacity)
  const plife = new Float32Array(capacity)
  const pmax = new Float32Array(capacity)
  const psize = new Float32Array(capacity)
  const pgrav = new Float32Array(capacity)
  const pkind = new Uint8Array(capacity)
  let n = 0

  const sprites = SPRITE_COLORS.map((c) => makeSprite(c, 48))

  const api: Particles = {
    capacity,
    budget: 1,
    count: () => n,

    spawn(kind, x, y, vx, vy, life, size, gravity) {
      // Full: overwrite a random slot rather than dropping the newest, so a big
      // impact always reads even when the screen is already busy.
      const i = n >= capacity ? (Math.random() * capacity) | 0 : n++
      px[i] = x
      py[i] = y
      pvx[i] = vx
      pvy[i] = vy
      plife[i] = life
      pmax[i] = life
      psize[i] = size
      pkind[i] = kind
      pgrav[i] =
        gravity ?? (kind === KIND_STEAM ? -260 : kind === KIND_EMBER ? -90 : 900)
    },

    burst(o) {
      const count = Math.max(1, Math.round(o.n * api.budget))
      const spread = o.spread ?? Math.PI * 2
      const base = o.angle ?? 0
      for (let i = 0; i < count; i++) {
        const a = base + (Math.random() - 0.5) * spread
        const s = o.speed * (0.35 + Math.random() * 0.9)
        const life = (o.life ?? 0.7) * (0.6 + Math.random() * 0.8)
        const size = (o.size ?? 10) * (0.55 + Math.random() * 0.9)
        api.spawn(o.kind, o.x, o.y, Math.cos(a) * s, Math.sin(a) * s, life, size, o.gravity)
      }
    },

    update(dt) {
      for (let i = 0; i < n; i++) {
        plife[i] -= dt
        if (plife[i] <= 0) {
          // Swap-remove: order does not matter and this keeps the array dense.
          const last = --n
          px[i] = px[last]
          py[i] = py[last]
          pvx[i] = pvx[last]
          pvy[i] = pvy[last]
          plife[i] = plife[last]
          pmax[i] = pmax[last]
          psize[i] = psize[last]
          pkind[i] = pkind[last]
          pgrav[i] = pgrav[last]
          i--
          continue
        }
        pvy[i] += pgrav[i] * dt
        // Air drag, so nothing streaks off screen at launch velocity.
        const drag = Math.exp(-2.4 * dt)
        pvx[i] *= drag
        pvy[i] *= drag
        px[i] += pvx[i] * dt
        py[i] += pvy[i] * dt
      }
    },

    draw(ctx) {
      if (n === 0) return
      const prev = ctx.globalCompositeOperation
      ctx.globalCompositeOperation = "lighter"

      // Metal shards are lines, not glows: one path per frame, one stroke.
      let shardPath: Path2D | null = null

      for (let i = 0; i < n; i++) {
        const k = pkind[i]
        const t = plife[i] / pmax[i]
        if (k === KIND_SHARD) {
          if (!shardPath) shardPath = new Path2D()
          const l = 2 + psize[i] * 0.5
          const vx = pvx[i]
          const vy = pvy[i]
          const m = Math.hypot(vx, vy) || 1
          shardPath.moveTo(px[i], py[i])
          shardPath.lineTo(px[i] - (vx / m) * l, py[i] - (vy / m) * l)
          continue
        }
        // Fade in fast, out slow; grow slightly as they die (heat dissipating).
        const alpha = t > 0.85 ? (1 - t) / 0.15 : t * t
        const s = psize[i] * (k === KIND_STEAM ? 1 + (1 - t) * 2.4 : 0.6 + t * 0.8)
        ctx.globalAlpha = alpha
        ctx.drawImage(sprites[k], px[i] - s, py[i] - s, s * 2, s * 2)
      }

      if (shardPath) {
        ctx.globalAlpha = 0.85
        ctx.strokeStyle = "rgba(215,225,240,0.9)"
        ctx.lineWidth = 1.6
        ctx.stroke(shardPath)
      }

      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = prev
    },

    clear() {
      n = 0
    },
  }
  return api
}
