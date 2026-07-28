// A flat, pooled particle system. No allocation after construction, no garbage
// per frame, and a hard ceiling that the quality tier sets.
//
// Three kinds, and the vocabulary is deliberately mechanical rather than
// festive — the hostile reference board bans confetti and starbursts by name:
//
//   SPARK   struck metal. A hot streak that cools as it falls.
//   SHARD   a chip off a plate. Tumbles, has weight, lands.
//   DUST    canvas dust punched up by a body. Slow, no glow.

import { heatColor, withAlpha } from "./palette.ts"

export const KIND_SPARK = 0
export const KIND_SHARD = 1
export const KIND_DUST = 2

/**
 * The array size. It is the ULTRA tier's ceiling; every tier below it runs the
 * same arrays with a smaller `limit`, so a downgrade costs no allocation and a
 * `low` device never iterates — or draws — the eighteen hundred slots it is not
 * allowed to use.
 */
const CAP = 2400

export class Particles {
  private x = new Float32Array(CAP)
  private y = new Float32Array(CAP)
  private vx = new Float32Array(CAP)
  private vy = new Float32Array(CAP)
  private life = new Float32Array(CAP)
  private maxLife = new Float32Array(CAP)
  private size = new Float32Array(CAP)
  private spin = new Float32Array(CAP)
  private rot = new Float32Array(CAP)
  private kind = new Uint8Array(CAP)
  private hot = new Float32Array(CAP)
  private alive = new Uint8Array(CAP)
  private cursor = 0
  private seed = 0x1f123bb5
  /** Live ceiling, set from the quality tier. Never above `CAP`. */
  private limit = CAP

  count = 0

  /**
   * Set the live ceiling. Shrinking it kills whatever is already above the new
   * line rather than leaving it stranded — a downgrade has to take effect on the
   * next frame, not once the current burst happens to expire.
   */
  setLimit(n: number): void {
    const next = Math.max(1, Math.min(CAP, Math.round(n)))
    if (next < this.limit) {
      for (let i = next; i < this.limit; i++) {
        if (this.alive[i]) {
          this.alive[i] = 0
          this.count--
        }
      }
    }
    this.limit = next
    if (this.cursor >= next) this.cursor = 0
  }

  private rand(): number {
    let s = this.seed
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    this.seed = s >>> 0
    return this.seed / 4294967296
  }

  private slot(): number {
    for (let n = 0; n < this.limit; n++) {
      const i = (this.cursor + n) % this.limit
      if (!this.alive[i]) {
        this.cursor = (i + 1) % this.limit
        return i
      }
    }
    // Full: recycle the oldest thing under the cursor rather than dropping the
    // emit. A burst that silently vanishes reads as a dropped frame.
    const i = this.cursor
    this.cursor = (i + 1) % this.limit
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
    hot = 1,
  ): void {
    const i = this.slot()
    if (!this.alive[i]) this.count++
    this.alive[i] = 1
    this.kind[i] = kind
    this.x[i] = x
    this.y[i] = y
    this.vx[i] = vx
    this.vy[i] = vy
    this.life[i] = life
    this.maxLife[i] = life
    this.size[i] = size
    this.hot[i] = hot
    this.rot[i] = this.rand() * Math.PI * 2
    this.spin[i] = (this.rand() - 0.5) * 14
  }

  /**
   * A burst of struck sparks along a direction, with spread.
   * `n` is already multiplied by the tier's burst factor by the caller.
   */
  burst(
    kind: number,
    x: number,
    y: number,
    n: number,
    speed: number,
    dir: number,
    spread: number,
    size: number,
  ): void {
    const total = Math.max(0, Math.round(n))
    for (let i = 0; i < total; i++) {
      const a = dir + (this.rand() - 0.5) * spread
      const s = speed * (0.35 + this.rand() * 0.9)
      this.emit(
        kind,
        x + (this.rand() - 0.5) * 6,
        y + (this.rand() - 0.5) * 6,
        Math.cos(a) * s,
        Math.sin(a) * s,
        0.35 + this.rand() * 0.7,
        size * (0.6 + this.rand() * 0.8),
        0.7 + this.rand() * 0.3,
      )
    }
  }

  step(dt: number, floorY: number): void {
    for (let i = 0; i < this.limit; i++) {
      if (!this.alive[i]) continue
      const k = this.kind[i]
      const drag = k === KIND_DUST ? 1.6 : 0.9
      const grav = k === KIND_DUST ? 120 : k === KIND_SHARD ? 1500 : 900
      this.vx[i] = (this.vx[i] as number) * Math.exp(-dt * drag)
      this.vy[i] = (this.vy[i] as number) * Math.exp(-dt * drag) + grav * dt
      this.x[i] = (this.x[i] as number) + (this.vx[i] as number) * dt
      this.y[i] = (this.y[i] as number) + (this.vy[i] as number) * dt
      this.rot[i] = (this.rot[i] as number) + (this.spin[i] as number) * dt
      if (k !== KIND_DUST && (this.y[i] as number) > floorY) {
        // Bounce off the canvas, losing most of it. Sparks skitter.
        this.y[i] = floorY
        this.vy[i] = -(this.vy[i] as number) * 0.28
        this.vx[i] = (this.vx[i] as number) * 0.7
      }
      const l = (this.life[i] as number) - dt
      this.life[i] = l
      if (l <= 0) {
        this.alive[i] = 0
        this.count--
      }
    }
  }

  draw(g: CanvasRenderingContext2D, glow: boolean): void {
    g.save()
    g.lineCap = "round"
    for (let i = 0; i < this.limit; i++) {
      if (!this.alive[i]) continue
      const t = (this.life[i] as number) / (this.maxLife[i] as number)
      const k = this.kind[i]
      const s = this.size[i] as number
      const x = this.x[i] as number
      const y = this.y[i] as number

      if (k === KIND_SPARK) {
        const heat = (this.hot[i] as number) * t
        g.strokeStyle = withAlpha(heatColor(heat), Math.min(1, t * 1.4))
        g.lineWidth = Math.max(0.7, s * t)
        const tail = 0.022
        g.beginPath()
        g.moveTo(x, y)
        g.lineTo(x - (this.vx[i] as number) * tail, y - (this.vy[i] as number) * tail)
        g.stroke()
        if (glow && t > 0.55) {
          g.fillStyle = withAlpha("#fff3d6", (t - 0.55) * 0.7)
          g.beginPath()
          g.arc(x, y, s * 0.9, 0, Math.PI * 2)
          g.fill()
        }
        continue
      }

      if (k === KIND_SHARD) {
        g.save()
        g.translate(x, y)
        g.rotate(this.rot[i] as number)
        g.fillStyle = withAlpha(heatColor((this.hot[i] as number) * t * 0.8), Math.min(1, t * 1.6))
        g.fillRect(-s * 0.5, -s * 0.28, s, s * 0.56)
        g.restore()
        continue
      }

      g.fillStyle = withAlpha("#a89c86", t * 0.32)
      g.beginPath()
      g.arc(x, y, s * (1.6 - t * 0.6), 0, Math.PI * 2)
      g.fill()
    }
    g.restore()
  }

  clear(): void {
    this.alive.fill(0)
    this.count = 0
  }
}
