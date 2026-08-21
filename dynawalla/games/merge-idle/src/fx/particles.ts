/**
 * A pooled particle system. Struct-of-arrays, fixed capacity, zero allocation
 * after construction — no object is created in `update` or `draw`, ever, so the
 * GC never gets a reason to stutter mid-merge.
 *
 * Capacity is set by the quality tier. Everything is drawn additively into the
 * half-resolution glow layer, which is both four times cheaper and the reason
 * the particles bloom instead of looking like confetti.
 */

import type { Rgb } from '../render/palette.ts'
import type { SpriteBook } from '../render/sprites.ts'

export const SPARK = 0
export const BUBBLE = 1
export const SILT = 2
export const SHARD = 3
export const INK = 4

export class Particles {
  readonly cap: number
  private x: Float32Array
  private y: Float32Array
  private vx: Float32Array
  private vy: Float32Array
  private life: Float32Array
  private max: Float32Array
  private size: Float32Array
  private cr: Uint8Array
  private cg: Uint8Array
  private cb: Uint8Array
  private kind: Uint8Array
  private rot: Float32Array
  private spin: Float32Array
  private head = 0
  live = 0

  constructor(cap: number) {
    this.cap = cap
    this.x = new Float32Array(cap)
    this.y = new Float32Array(cap)
    this.vx = new Float32Array(cap)
    this.vy = new Float32Array(cap)
    this.life = new Float32Array(cap)
    this.max = new Float32Array(cap)
    this.size = new Float32Array(cap)
    this.cr = new Uint8Array(cap)
    this.cg = new Uint8Array(cap)
    this.cb = new Uint8Array(cap)
    this.kind = new Uint8Array(cap)
    this.rot = new Float32Array(cap)
    this.spin = new Float32Array(cap)
  }

  clear(): void {
    this.life.fill(0)
    this.live = 0
  }

  private alloc(): number {
    // Ring buffer: when full we steal the oldest slot. Overrunning the pool is a
    // dropped particle, never a dropped frame.
    for (let n = 0; n < this.cap; n++) {
      const i = (this.head + n) % this.cap
      if (this.life[i]! <= 0) {
        this.head = (i + 1) % this.cap
        this.live++
        return i
      }
    }
    const i = this.head
    this.head = (i + 1) % this.cap
    return i
  }

  emit(
    kind: number,
    x: number,
    y: number,
    vx: number,
    vy: number,
    life: number,
    size: number,
    c: Rgb,
    spin = 0,
  ): void {
    const i = this.alloc()
    this.kind[i] = kind
    this.x[i] = x
    this.y[i] = y
    this.vx[i] = vx
    this.vy[i] = vy
    this.life[i] = life
    this.max[i] = life
    this.size[i] = size
    this.cr[i] = c[0]
    this.cg[i] = c[1]
    this.cb[i] = c[2]
    this.rot[i] = 0
    this.spin[i] = spin
  }

  /** The merge burst: fast sparks out, slow shards tumbling after them. */
  burst(x: number, y: number, n: number, c: Rgb, speed: number, rnd: () => number): void {
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2
      const s = speed * (0.35 + rnd() * 0.9)
      this.emit(SPARK, x, y, Math.cos(a) * s, Math.sin(a) * s, 0.36 + rnd() * 0.4, 5 + rnd() * 9, c)
    }
    const shards = Math.max(2, n >> 2)
    for (let i = 0; i < shards; i++) {
      const a = rnd() * Math.PI * 2
      const s = speed * (0.2 + rnd() * 0.45)
      this.emit(
        SHARD,
        x,
        y,
        Math.cos(a) * s,
        Math.sin(a) * s - 20,
        0.7 + rnd() * 0.6,
        4 + rnd() * 6,
        c,
        (rnd() - 0.5) * 12,
      )
    }
  }

  /** A vent eruption: a column of bubbles that rise and wobble. */
  plume(x: number, y: number, n: number, c: Rgb, rnd: () => number): void {
    for (let i = 0; i < n; i++) {
      this.emit(
        BUBBLE,
        x + (rnd() - 0.5) * 46,
        y + rnd() * 16,
        (rnd() - 0.5) * 70,
        -110 - rnd() * 240,
        1.1 + rnd() * 1.1,
        4 + rnd() * 12,
        c,
      )
    }
  }

  /** A choke: heavy dark blobs that fall and fade. Reads as wrong without a red X. */
  ink(x: number, y: number, n: number, rnd: () => number): void {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (rnd() - 0.5) * 2.4
      const s = 60 + rnd() * 190
      this.emit(
        INK,
        x,
        y,
        Math.cos(a) * s,
        Math.sin(a) * s,
        0.6 + rnd() * 0.5,
        10 + rnd() * 20,
        [14, 10, 26],
      )
    }
  }

  /** Ambient marine snow. Seeded once, wraps forever, costs nothing to keep. */
  seedSnow(n: number, w: number, h: number, rnd: () => number): void {
    for (let i = 0; i < n; i++) {
      this.emit(
        SILT,
        rnd() * w,
        rnd() * h,
        (rnd() - 0.5) * 7,
        4 + rnd() * 12,
        1e9,
        1 + rnd() * 3.2,
        [150, 190, 230],
      )
    }
  }

  update(dt: number, w: number, h: number): void {
    let live = 0
    for (let i = 0; i < this.cap; i++) {
      const l = this.life[i]!
      if (l <= 0) continue
      const k = this.kind[i]!
      let vx = this.vx[i]!
      let vy = this.vy[i]!
      if (k === SPARK) {
        vx *= 1 - 2.6 * dt
        vy = vy * (1 - 2.6 * dt) + 210 * dt
      } else if (k === SHARD) {
        vx *= 1 - 1.1 * dt
        vy = vy * (1 - 1.1 * dt) + 340 * dt
        this.rot[i] = this.rot[i]! + this.spin[i]! * dt
      } else if (k === BUBBLE) {
        vx = vx * (1 - 1.4 * dt) + Math.sin((this.x[i]! + this.y[i]!) * 0.04) * 26 * dt
        vy = vy * (1 - 0.5 * dt) - 40 * dt
      } else if (k === INK) {
        vx *= 1 - 1.9 * dt
        vy = vy * (1 - 1.9 * dt) + 620 * dt
      }
      this.vx[i] = vx
      this.vy[i] = vy
      const nx = this.x[i]! + vx * dt
      const ny = this.y[i]! + vy * dt
      if (k === SILT) {
        // wrap, never expire
        this.x[i] = nx < -8 ? w + 8 : nx > w + 8 ? -8 : nx
        this.y[i] = ny > h + 8 ? -8 : ny
        live++
        continue
      }
      this.x[i] = nx
      this.y[i] = ny
      const nl = l - dt
      this.life[i] = nl > 0 ? nl : 0
      if (nl > 0) live++
    }
    this.live = live
  }

  /** Draws additively. Caller sets globalCompositeOperation. */
  draw(g: CanvasRenderingContext2D, book: SpriteBook, scale: number): void {
    for (let i = 0; i < this.cap; i++) {
      const l = this.life[i]!
      if (l <= 0) continue
      const k = this.kind[i]!
      const t = k === SILT ? 1 : Math.min(1, l / Math.max(0.0001, this.max[i]!))
      const c: Rgb = [this.cr[i]!, this.cg[i]!, this.cb[i]!]
      let a = t
      let s = this.size[i]!
      if (k === SPARK) {
        a = t * t
        s = s * (0.35 + t * 0.85)
      } else if (k === SILT) {
        a = 0.16
      } else if (k === BUBBLE) {
        a = t * 0.75
      } else if (k === INK) {
        a = t * 0.95
        s = s * (1.4 - t * 0.4)
      }
      const px = s * 3.1
      const img = book.glow(c, px)
      g.globalAlpha = a
      const x = this.x[i]! * scale
      const y = this.y[i]! * scale
      const d = px * scale
      if (k === SHARD) {
        g.save()
        g.translate(x, y)
        g.rotate(this.rot[i]!)
        g.drawImage(img, -d / 2, -d / 2, d, d * 0.5)
        g.restore()
      } else {
        g.drawImage(img, x - d / 2, y - d / 2, d, d)
      }
    }
    g.globalAlpha = 1
  }
}

/** Expanding shockwave rings — the impact effect that sells a merge. */
export class Shockwaves {
  private x: Float32Array
  private y: Float32Array
  private r0: Float32Array
  private r1: Float32Array
  private life: Float32Array
  private max: Float32Array
  private w: Float32Array
  private cr: Uint8Array
  private cg: Uint8Array
  private cb: Uint8Array
  private cap: number

  constructor(cap = 24) {
    this.cap = cap
    this.x = new Float32Array(cap)
    this.y = new Float32Array(cap)
    this.r0 = new Float32Array(cap)
    this.r1 = new Float32Array(cap)
    this.life = new Float32Array(cap)
    this.max = new Float32Array(cap)
    this.w = new Float32Array(cap)
    this.cr = new Uint8Array(cap)
    this.cg = new Uint8Array(cap)
    this.cb = new Uint8Array(cap)
  }

  clear(): void {
    this.life.fill(0)
  }

  add(x: number, y: number, r0: number, r1: number, dur: number, width: number, c: Rgb): void {
    let slot = -1
    for (let i = 0; i < this.cap; i++)
      if (this.life[i]! <= 0) {
        slot = i
        break
      }
    if (slot < 0) slot = 0
    this.x[slot] = x
    this.y[slot] = y
    this.r0[slot] = r0
    this.r1[slot] = r1
    this.life[slot] = dur
    this.max[slot] = dur
    this.w[slot] = width
    this.cr[slot] = c[0]
    this.cg[slot] = c[1]
    this.cb[slot] = c[2]
  }

  update(dt: number): void {
    for (let i = 0; i < this.cap; i++) {
      const l = this.life[i]!
      if (l > 0) this.life[i] = Math.max(0, l - dt)
    }
  }

  draw(g: CanvasRenderingContext2D, scale: number): void {
    for (let i = 0; i < this.cap; i++) {
      const l = this.life[i]!
      if (l <= 0) continue
      const t = 1 - l / Math.max(0.0001, this.max[i]!)
      const e = 1 - (1 - t) ** 3 // easeOutCubic — fast out, slow settle
      const r = (this.r0[i]! + (this.r1[i]! - this.r0[i]!) * e) * scale
      g.globalAlpha = (1 - t) ** 1.7
      g.strokeStyle = `rgba(${this.cr[i]},${this.cg[i]},${this.cb[i]},1)`
      g.lineWidth = Math.max(0.5, this.w[i]! * (1 - t) * scale)
      g.beginPath()
      g.arc(this.x[i]! * scale, this.y[i]! * scale, r, 0, Math.PI * 2)
      g.stroke()
    }
    g.globalAlpha = 1
  }
}
