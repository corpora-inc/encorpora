// Struct-of-arrays particle field. Allocated once at the ULTRA ceiling and
// never grown; the tier caps how many are allowed *alive*, so a tier change
// costs nothing and allocates nothing.
//
// Zero per-frame allocation is not a slogan here — there is no object literal,
// no closure and no array push anywhere in `update` or `draw`.

import type { Atlases } from "./atlas.ts"

export const KIND_DOT = 0
export const KIND_SHARD = 1
export const KIND_SPARK = 2 // a stretched streak, drawn along its velocity

const CAP = 3400

export class Particles {
  private x = new Float32Array(CAP)
  private y = new Float32Array(CAP)
  private vx = new Float32Array(CAP)
  private vy = new Float32Array(CAP)
  private life = new Float32Array(CAP)
  private inv = new Float32Array(CAP) // 1 / maxLife, precomputed
  private size = new Float32Array(CAP)
  private rot = new Float32Array(CAP)
  private spin = new Float32Array(CAP)
  private drag = new Float32Array(CAP)
  private grav = new Float32Array(CAP)
  private kind = new Uint8Array(CAP)
  private col = new Uint8Array(CAP)

  /** Colour table — small, so the atlas only ever bakes a handful of sprites. */
  private colors: string[] = []
  private colorIndex = new Map<string, number>()

  private count = 0
  limit = 1400

  colorId(hex: string): number {
    const hit = this.colorIndex.get(hex)
    if (hit !== undefined) return hit
    const id = this.colors.length
    this.colors.push(hex)
    this.colorIndex.set(hex, id)
    return id
  }

  get alive(): number {
    return this.count
  }

  clear(): void {
    this.count = 0
  }

  spawn(
    kind: number,
    x: number,
    y: number,
    vx: number,
    vy: number,
    lifeS: number,
    size: number,
    colorId: number,
    drag: number,
    grav: number,
    spin: number,
  ): void {
    if (this.count >= this.limit || this.count >= CAP) return
    const i = this.count++
    this.x[i] = x
    this.y[i] = y
    this.vx[i] = vx
    this.vy[i] = vy
    this.life[i] = lifeS
    this.inv[i] = 1 / lifeS
    this.size[i] = size
    this.rot[i] = 0
    this.spin[i] = spin
    this.drag[i] = drag
    this.grav[i] = grav
    this.kind[i] = kind
    this.col[i] = colorId
  }

  update(dt: number): void {
    let n = this.count
    for (let i = 0; i < n; i++) {
      const l = (this.life[i] as number) - dt
      if (l <= 0) {
        // Swap-remove. Order does not matter for additive blending.
        n--
        this.x[i] = this.x[n] as number
        this.y[i] = this.y[n] as number
        this.vx[i] = this.vx[n] as number
        this.vy[i] = this.vy[n] as number
        this.life[i] = this.life[n] as number
        this.inv[i] = this.inv[n] as number
        this.size[i] = this.size[n] as number
        this.rot[i] = this.rot[n] as number
        this.spin[i] = this.spin[n] as number
        this.drag[i] = this.drag[n] as number
        this.grav[i] = this.grav[n] as number
        this.kind[i] = this.kind[n] as number
        this.col[i] = this.col[n] as number
        i--
        continue
      }
      this.life[i] = l
      const d = Math.exp(-(this.drag[i] as number) * dt)
      const nvx = (this.vx[i] as number) * d
      const nvy = (this.vy[i] as number) * d + (this.grav[i] as number) * dt
      this.vx[i] = nvx
      this.vy[i] = nvy
      this.x[i] = (this.x[i] as number) + nvx * dt
      this.y[i] = (this.y[i] as number) + nvy * dt
      this.rot[i] = (this.rot[i] as number) + (this.spin[i] as number) * dt
    }
    this.count = n
  }

  /** Additive pass — dots and sparks. */
  drawAdditive(g: CanvasRenderingContext2D, atl: Atlases): void {
    const n = this.count
    if (n === 0) return
    const prev = g.globalCompositeOperation
    g.globalCompositeOperation = "lighter"
    const dotSize = atl.dot.size
    for (let i = 0; i < n; i++) {
      const k = this.kind[i] as number
      if (k === KIND_SHARD) continue
      const t = (this.life[i] as number) * (this.inv[i] as number) // 1 → 0
      const a = t * t * (3 - 2 * t) // smoothstep-out; no hard pop at death
      const s = (this.size[i] as number) * (0.45 + 0.55 * t)
      const img = atl.dot.get(this.colors[this.col[i] as number] as string)
      g.globalAlpha = a
      if (k === KIND_SPARK) {
        const vx = this.vx[i] as number
        const vy = this.vy[i] as number
        const sp = Math.hypot(vx, vy)
        const stretch = 1 + Math.min(3.6, sp * 0.006)
        g.save()
        g.translate(this.x[i] as number, this.y[i] as number)
        g.rotate(Math.atan2(vy, vx))
        g.scale(stretch, 1)
        g.drawImage(img, (-s / 2) * (dotSize / dotSize), -s / 2, s, s)
        g.restore()
      } else {
        g.drawImage(img, (this.x[i] as number) - s / 2, (this.y[i] as number) - s / 2, s, s)
      }
    }
    g.globalAlpha = 1
    g.globalCompositeOperation = prev
  }

  /** Opaque pass — shards, which must read as solid debris, not as light. */
  drawSolid(g: CanvasRenderingContext2D, atl: Atlases): void {
    const n = this.count
    if (n === 0) return
    for (let i = 0; i < n; i++) {
      if ((this.kind[i] as number) !== KIND_SHARD) continue
      const t = (this.life[i] as number) * (this.inv[i] as number)
      const s = this.size[i] as number
      const img = atl.shard.get(this.colors[this.col[i] as number] as string)
      g.globalAlpha = Math.min(1, t * 2.2)
      g.save()
      g.translate(this.x[i] as number, this.y[i] as number)
      g.rotate(this.rot[i] as number)
      g.drawImage(img, -s / 2, -s / 2, s, s)
      g.restore()
    }
    g.globalAlpha = 1
  }
}
