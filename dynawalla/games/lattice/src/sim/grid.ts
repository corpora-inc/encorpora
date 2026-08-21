// THE GRID — a mass-spring lattice that tears and re-knits.
//
// This is the thing the arena is strung on, and it is the reason the pack is
// called what it is. Every point is a small mass held to its rest position by a
// weak anchor spring and to its four neighbours by struts. A husk coming apart
// puts an impulse into the sheet, the impulse travels, and a strut stretched
// past its limit **lets go** — it stops pulling, the sheet opens, and a moment
// later the strut finds its neighbour again and knits back. Nothing about that
// is decorative: the tear is where the number came apart.
//
// **Reduced motion is a branch, not a switch.** Turning this off would remove
// the only cue that says where a split happened. So the reduced branch keeps
// the whole simulation and changes its character: the springs are stiff, the
// damping is at critical, and the amplitude ceiling is low — the sheet dents
// and recovers in about a fifth of a second with no travelling wave and no
// ringing. A strut still tears; it is drawn as a strut that has gone dark
// rather than as one that has been flung. A child who needs stillness still
// sees where the 12 became a 4 and a 3.
//
// Everything here is pure arithmetic over `Float32Array`s and is tested without
// a canvas: the sheet must never produce a NaN, must always come back to rest,
// and must always re-knit every strut it tore.

export type GridOptions = {
  /** Points across and down. Struts are the edges between them. */
  cols: number
  rows: number
  width: number
  height: number
  reduced: boolean
}

/** Rest length is derived from the cell size; strain is relative to it. */
const TEAR_STRAIN = 0.62
const TEAR_MS = 620
const REDUCED_TEAR_MS = 260

/** Points beyond which an impulse is not felt at all. Keeps a tap local. */
const IMPULSE_FALLOFF = 2.4

export class Grid {
  cols: number
  rows: number
  private width: number
  private height: number
  private reduced: boolean

  /** Live positions, rest positions, velocities. Flat, one entry per point. */
  x: Float32Array
  y: Float32Array
  vx: Float32Array
  vy: Float32Array
  restX: Float32Array
  restY: Float32Array

  /** Struts as index pairs, with the milliseconds each has left to re-knit. */
  strutA: Int32Array
  strutB: Int32Array
  strutTorn: Float32Array
  strutRest: Float32Array

  constructor(options: GridOptions) {
    this.cols = Math.max(4, Math.round(options.cols))
    this.rows = Math.max(4, Math.round(options.rows))
    this.width = Math.max(64, options.width)
    this.height = Math.max(64, options.height)
    this.reduced = options.reduced

    const n = this.cols * this.rows
    this.x = new Float32Array(n)
    this.y = new Float32Array(n)
    this.vx = new Float32Array(n)
    this.vy = new Float32Array(n)
    this.restX = new Float32Array(n)
    this.restY = new Float32Array(n)

    const pairs: Array<[number, number]> = []
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const i = r * this.cols + c
        if (c + 1 < this.cols) pairs.push([i, i + 1])
        if (r + 1 < this.rows) pairs.push([i, i + this.cols])
      }
    }
    this.strutA = new Int32Array(pairs.map((p) => p[0]))
    this.strutB = new Int32Array(pairs.map((p) => p[1]))
    this.strutTorn = new Float32Array(pairs.length)
    this.strutRest = new Float32Array(pairs.length)

    this.layout()
  }

  get points(): number {
    return this.cols * this.rows
  }

  get struts(): number {
    return this.strutA.length
  }

  /** Struts currently letting go. The shell draws these differently. */
  get tornCount(): number {
    let n = 0
    for (let s = 0; s < this.strutTorn.length; s++) {
      if ((this.strutTorn[s] as number) > 0) n += 1
    }
    return n
  }

  /** The largest distance any point has been pushed from its rest position. */
  get peakDisplacement(): number {
    let best = 0
    for (let i = 0; i < this.x.length; i++) {
      const dx = (this.x[i] as number) - (this.restX[i] as number)
      const dy = (this.y[i] as number) - (this.restY[i] as number)
      const d = Math.hypot(dx, dy)
      if (d > best) best = d
    }
    return best
  }

  setReduced(reduced: boolean): void {
    this.reduced = reduced
  }

  resize(width: number, height: number): void {
    this.width = Math.max(64, width)
    this.height = Math.max(64, height)
    this.layout()
  }

  /** Rest positions, live positions and rest lengths, all from the box. */
  private layout(): void {
    const dx = this.width / (this.cols - 1)
    const dy = this.height / (this.rows - 1)
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const i = r * this.cols + c
        this.restX[i] = c * dx
        this.restY[i] = r * dy
        this.x[i] = c * dx
        this.y[i] = r * dy
        this.vx[i] = 0
        this.vy[i] = 0
      }
    }
    for (let s = 0; s < this.strutA.length; s++) {
      const a = this.strutA[s] as number
      const b = this.strutB[s] as number
      this.strutRest[s] = Math.hypot(
        (this.restX[a] as number) - (this.restX[b] as number),
        (this.restY[a] as number) - (this.restY[b] as number),
      )
      this.strutTorn[s] = 0
    }
  }

  /** The cell size, so the shell can size what it draws on the sheet. */
  get cell(): { w: number; h: number } {
    return { w: this.width / (this.cols - 1), h: this.height / (this.rows - 1) }
  }

  /**
   * Push the sheet outward from a point.
   *
   * `strength` is in arena units per second. It falls off with distance in
   * cells, so a 12 coming apart dents the sheet where it happened rather than
   * shaking the whole screen — the loudness ceiling in the experience design is
   * a real constraint and this is where it lives.
   */
  impulse(px: number, py: number, strength: number, radiusCells = 3): void {
    const { w } = this.cell
    const radius = Math.max(1, radiusCells) * w
    const gain = this.reduced ? 0.22 : 1
    for (let i = 0; i < this.x.length; i++) {
      const dx = (this.x[i] as number) - px
      const dy = (this.y[i] as number) - py
      const d = Math.hypot(dx, dy)
      if (d > radius * IMPULSE_FALLOFF) continue
      const k = strength * gain * Math.exp(-(d * d) / (2 * radius * radius))
      if (d < 1e-4) continue
      this.vx[i] = (this.vx[i] as number) + (dx / d) * k
      this.vy[i] = (this.vy[i] as number) + (dy / d) * k
    }
  }

  /** Pull the sheet inward — what a resonator opening does to the lattice. */
  implode(px: number, py: number, strength: number, radiusCells = 6): void {
    this.impulse(px, py, -strength, radiusCells)
  }

  /**
   * Advance the sheet.
   *
   * Semi-implicit Euler at a fixed substep. The substep is fixed rather than
   * derived from the frame so a slow frame cannot blow the springs up; a frame
   * that arrives late is simulated in more small steps, not one large one, and
   * a frame that arrives after a minute (a backgrounded tab) is clamped.
   */
  step(dtMs: number): void {
    const clamped = Math.min(120, Math.max(0, dtMs))
    if (clamped === 0) return
    const substep = 1000 / 240
    const steps = Math.min(16, Math.max(1, Math.round(clamped / substep)))
    const h = clamped / steps / 1000

    // Reduced motion: stiff and at critical damping, so the sheet dents and
    // returns without a single overshoot. Full motion: slack and springy.
    const anchorK = this.reduced ? 260 : 34
    const strutK = this.reduced ? 300 : 120
    const damp = this.reduced ? 32 : 3.1
    const tearMs = this.reduced ? REDUCED_TEAR_MS : TEAR_MS
    const cap = this.reduced ? this.cell.w * 0.35 : this.cell.w * 2.4

    for (let s = 0; s < this.strutTorn.length; s++) {
      const left = this.strutTorn[s] as number
      if (left > 0) this.strutTorn[s] = Math.max(0, left - clamped)
    }

    for (let n = 0; n < steps; n++) {
      // Anchor springs.
      for (let i = 0; i < this.x.length; i++) {
        const dx = (this.restX[i] as number) - (this.x[i] as number)
        const dy = (this.restY[i] as number) - (this.y[i] as number)
        this.vx[i] = (this.vx[i] as number) + dx * anchorK * h
        this.vy[i] = (this.vy[i] as number) + dy * anchorK * h
      }

      // Struts, and the strain that makes one let go.
      for (let s = 0; s < this.strutA.length; s++) {
        if ((this.strutTorn[s] as number) > 0) continue
        const a = this.strutA[s] as number
        const b = this.strutB[s] as number
        const dx = (this.x[b] as number) - (this.x[a] as number)
        const dy = (this.y[b] as number) - (this.y[a] as number)
        const len = Math.hypot(dx, dy)
        if (len < 1e-5) continue
        const rest = this.strutRest[s] as number
        const strain = (len - rest) / rest
        if (strain > TEAR_STRAIN) {
          this.strutTorn[s] = tearMs
          continue
        }
        const f = strain * strutK * h
        const ux = dx / len
        const uy = dy / len
        this.vx[a] = (this.vx[a] as number) + ux * f
        this.vy[a] = (this.vy[a] as number) + uy * f
        this.vx[b] = (this.vx[b] as number) - ux * f
        this.vy[b] = (this.vy[b] as number) - uy * f
      }

      // Integrate, damp, and hold the sheet inside its ceiling.
      const decay = Math.exp(-damp * h)
      for (let i = 0; i < this.x.length; i++) {
        this.vx[i] = (this.vx[i] as number) * decay
        this.vy[i] = (this.vy[i] as number) * decay
        let nx = (this.x[i] as number) + (this.vx[i] as number) * h
        let ny = (this.y[i] as number) + (this.vy[i] as number) * h
        const ox = nx - (this.restX[i] as number)
        const oy = ny - (this.restY[i] as number)
        const off = Math.hypot(ox, oy)
        if (off > cap) {
          nx = (this.restX[i] as number) + (ox / off) * cap
          ny = (this.restY[i] as number) + (oy / off) * cap
          this.vx[i] = (this.vx[i] as number) * 0.4
          this.vy[i] = (this.vy[i] as number) * 0.4
        }
        this.x[i] = nx
        this.y[i] = ny
      }
    }
  }
}
