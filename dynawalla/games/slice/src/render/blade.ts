// The blade.
//
// This is the whole game's contract with the player's hand, so three things
// matter more than anything else in the codebase:
//
//   1. **Zero added latency.** Samples are taken from the pointer event, at
//      event rate, including `getCoalescedEvents()` — a 120Hz tablet digitiser
//      delivers 2–3 positions per frame and using all of them is the difference
//      between a trail that *is* your finger and a trail that follows it.
//   2. **The cut is tested against the sampled polyline, not the frame delta.**
//      A fast flick that crosses a numeral between two rAF ticks still cuts it.
//   3. **Taper.** A constant-width ribbon reads as a pipe. Width falls with age
//      *and* rises with speed, so a hard flick is visibly a harder cut.

const CAP = 64

export type Seg = { ax: number; ay: number; bx: number; by: number; speed: number }

export class Blade {
  private px = new Float32Array(CAP)
  private py = new Float32Array(CAP)
  private pt = new Float32Array(CAP)
  private head = 0
  private n = 0

  /** Samples added since the last `takeSegments()`, as a contiguous list. */
  private newX: number[] = []
  private newY: number[] = []
  private newT: number[] = []
  private segs: Seg[] = []
  private segCount = 0

  down = false
  lifeMs = 240
  maxSamples = 18
  /** Below this, a drag is a drag and not a cut. Keeps desktop deliberate. */
  minCutSpeed = 90 // px/s

  private lastX = 0
  private lastY = 0
  private lastT = 0
  private haveLast = false
  /** Rolling speed estimate, px/s — drives trail width and the whoosh pitch. */
  speed = 0

  constructor() {
    for (let i = 0; i < CAP; i++) this.segs.push({ ax: 0, ay: 0, bx: 0, by: 0, speed: 0 })
  }

  begin(x: number, y: number, tMs: number): void {
    this.down = true
    this.head = 0
    this.n = 0
    this.newX.length = 0
    this.newY.length = 0
    this.newT.length = 0
    this.haveLast = true
    this.lastX = x
    this.lastY = y
    this.lastT = tMs
    this.speed = 0
    this.push(x, y, tMs)
  }

  end(): void {
    this.down = false
    this.haveLast = false
    // The ribbon is NOT cleared: it fades out on its own over `lifeMs`, which
    // is what makes releasing feel like the blade left the frame rather than
    // being switched off.
  }

  move(x: number, y: number, tMs: number): void {
    if (!this.down) return
    if (this.haveLast) {
      const dt = Math.max(1, tMs - this.lastT)
      const d = Math.hypot(x - this.lastX, y - this.lastY)
      const inst = (d / dt) * 1000
      // Asymmetric smoothing: rise fast (a flick must register immediately),
      // fall slower (so the trail does not snap thin at the end of a stroke).
      this.speed = inst > this.speed ? this.speed * 0.35 + inst * 0.65 : this.speed * 0.72 + inst * 0.28
      this.newX.push(x)
      this.newY.push(y)
      this.newT.push(tMs)
    }
    this.lastX = x
    this.lastY = y
    this.lastT = tMs
    this.haveLast = true
    this.push(x, y, tMs)
  }

  private push(x: number, y: number, tMs: number): void {
    this.px[this.head] = x
    this.py[this.head] = y
    this.pt[this.head] = tMs
    this.head = (this.head + 1) % CAP
    if (this.n < CAP) this.n++
  }

  /**
   * Consume the samples accumulated since the last call as cut segments.
   * Returns a pooled array; valid until the next call. Never allocates.
   */
  takeSegments(): { segs: readonly Seg[]; count: number } {
    let out = 0
    const m = this.newX.length
    if (m >= 1 && this.n >= 1) {
      // Start from the sample immediately before the first new one so a cut is
      // never lost in the gap between frames.
      let ax = this.newX[0] as number
      let ay = this.newY[0] as number
      let at = this.newT[0] as number
      const prevIdx = (((this.head - m - 1) % CAP) + CAP) % CAP
      if (this.n > m) {
        ax = this.px[prevIdx] as number
        ay = this.py[prevIdx] as number
        at = this.pt[prevIdx] as number
      }
      for (let i = 0; i < m && out < CAP; i++) {
        const bx = this.newX[i] as number
        const by = this.newY[i] as number
        const bt = this.newT[i] as number
        const dt = Math.max(1, bt - at)
        const speed = (Math.hypot(bx - ax, by - ay) / dt) * 1000
        if (speed >= this.minCutSpeed) {
          const s = this.segs[out] as Seg
          s.ax = ax
          s.ay = ay
          s.bx = bx
          s.by = by
          s.speed = speed
          out++
        }
        ax = bx
        ay = by
        at = bt
      }
    }
    this.newX.length = 0
    this.newY.length = 0
    this.newT.length = 0
    this.segCount = out
    return { segs: this.segs, count: out }
  }

  // QA instrumentation. Three number writes per frame, and the only way to
  // check the ribbon without photographing it — every screenshot path costs
  // more latency than the trail's own lifetime, so an external capture always
  // catches it already faded.
  lastDrawPts = 0
  lastMaxW = 0
  lastOldestAge = 0

  get sampleCount(): number {
    return this.n
  }

  get lastSegCount(): number {
    return this.segCount
  }

  /** True while any part of the ribbon is still visible. */
  visible(nowMs: number): boolean {
    if (this.n === 0) return false
    const newest = this.pt[(this.head - 1 + CAP) % CAP] as number
    return nowMs - newest < this.lifeMs
  }

  /**
   * Draw the ribbon. `intensity` scales width and glow — used to pump the blade
   * on a big combo, so the weapon itself visibly gets hotter as you do well.
   */
  draw(
    g: CanvasRenderingContext2D,
    nowMs: number,
    scale: number,
    intensity: number,
    glow: boolean,
  ): void {
    if (this.n < 2) return
    const keep = Math.min(this.n, this.maxSamples)
    const life = this.lifeMs

    // Collect the live tail, newest first.
    let pts = 0
    const xs = SCRATCH_X
    const ys = SCRATCH_Y
    const ws = SCRATCH_W
    for (let k = 0; k < keep; k++) {
      const idx = (this.head - 1 - k + CAP * 2) % CAP
      const age = nowMs - (this.pt[idx] as number)
      if (age > life) break
      const t = 1 - age / life // 1 at the head
      // Width: quadratic taper to the tail, and a speed term so a flick is fat.
      const speedTerm = Math.min(1.7, 0.55 + this.speed / 2600)
      xs[pts] = this.px[idx] as number
      ys[pts] = this.py[idx] as number
      ws[pts] = t * t * speedTerm * scale * intensity
      pts++
    }
    this.lastDrawPts = pts
    this.lastMaxW = ws[0] as number
    this.lastOldestAge = nowMs - (this.pt[(this.head - pts + CAP * 2) % CAP] as number)
    if (pts < 2) return

    // Catmull-Rom resample: one interpolated point between each pair.
    //
    // A 60Hz mouse flicking across the screen delivers samples 80px apart, and
    // a straight-segment ribbon through them reads as a jagged saw rather than
    // a blade. Doubling the density costs one pass over at most 26 points and
    // is the difference between "a polyline" and "a stroke".
    if (pts >= 3 && pts * 2 - 1 <= CAP) {
      const n2 = pts * 2 - 1
      for (let i = pts - 1; i > 0; i--) {
        const p0x = xs[Math.min(pts - 1, i + 1)] as number
        const p0y = ys[Math.min(pts - 1, i + 1)] as number
        const p1x = xs[i] as number
        const p1y = ys[i] as number
        const p2x = xs[i - 1] as number
        const p2y = ys[i - 1] as number
        const p3x = xs[Math.max(0, i - 2)] as number
        const p3y = ys[Math.max(0, i - 2)] as number
        // Catmull-Rom at t = 0.5 collapses to this weighting.
        xs[i * 2 - 1] = (-p0x + 9 * p1x + 9 * p2x - p3x) / 16
        ys[i * 2 - 1] = (-p0y + 9 * p1y + 9 * p2y - p3y) / 16
        ws[i * 2 - 1] = ((ws[i] as number) + (ws[i - 1] as number)) * 0.5
        xs[i * 2] = p1x
        ys[i * 2] = p1y
        ws[i * 2] = ws[i] as number
      }
      pts = n2
    }

    const prev = g.globalCompositeOperation
    if (glow) {
      g.globalCompositeOperation = "lighter"
      this.ribbon(g, xs, ys, ws, pts, 5.4, "rgba(120, 60, 200, 0.11)")
      this.ribbon(g, xs, ys, ws, pts, 3.0, "rgba(160, 120, 255, 0.16)")
      this.ribbon(g, xs, ys, ws, pts, 1.7, "rgba(215, 190, 255, 0.30)")
    }
    g.globalCompositeOperation = "lighter"
    this.ribbon(g, xs, ys, ws, pts, 1.0, "rgba(240, 232, 255, 0.85)")
    this.ribbon(g, xs, ys, ws, pts, 0.42, "rgba(255, 255, 255, 1)")
    g.globalCompositeOperation = prev
  }

  private ribbon(
    g: CanvasRenderingContext2D,
    xs: Float32Array,
    ys: Float32Array,
    ws: Float32Array,
    n: number,
    mul: number,
    fill: string,
  ): void {
    g.beginPath()
    // Up one side…
    for (let i = 0; i < n - 1; i++) {
      const x0 = xs[i] as number
      const y0 = ys[i] as number
      const x1 = xs[i + 1] as number
      const y1 = ys[i + 1] as number
      let dx = x1 - x0
      let dy = y1 - y0
      const len = Math.hypot(dx, dy) || 1
      dx /= len
      dy /= len
      const w = (ws[i] as number) * mul
      if (i === 0) g.moveTo(x0 - dy * w, y0 + dx * w)
      else g.lineTo(x0 - dy * w, y0 + dx * w)
      g.lineTo(x1 - dy * (ws[i + 1] as number) * mul, y1 + dx * (ws[i + 1] as number) * mul)
    }
    // …and back down the other.
    for (let i = n - 1; i > 0; i--) {
      const x0 = xs[i] as number
      const y0 = ys[i] as number
      const x1 = xs[i - 1] as number
      const y1 = ys[i - 1] as number
      let dx = x1 - x0
      let dy = y1 - y0
      const len = Math.hypot(dx, dy) || 1
      dx /= len
      dy /= len
      g.lineTo(x0 + dy * (ws[i] as number) * mul, y0 - dx * (ws[i] as number) * mul)
      g.lineTo(x1 + dy * (ws[i - 1] as number) * mul, y1 - dx * (ws[i - 1] as number) * mul)
    }
    g.closePath()
    g.fillStyle = fill
    g.fill()
  }
}

const SCRATCH_X = new Float32Array(CAP)
const SCRATCH_Y = new Float32Array(CAP)
const SCRATCH_W = new Float32Array(CAP)
