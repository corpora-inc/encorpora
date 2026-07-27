/**
 * A uniform spatial hash, backed entirely by typed arrays. Rebuilt every frame
 * with zero allocation after construction: a counting sort into a CSR-style
 * (starts, items) pair.
 *
 * Broad-phase for ~250 bodies is cheap either way; this exists so the mote
 * count can climb into the hundreds on ULTRA without the O(n²) pass showing up
 * in a frame budget.
 *
 * **The grid moves and scales with the field it is indexing**, and that is not
 * a refinement. It used to be pinned to world coordinates over a fixed
 * ±9,300 box with everything outside clamped to an edge cell. ARENA's arena
 * radius passes 9,300 at a player mass of about 680 — from THE CHURN onward —
 * and reaches ~22,000 by THE SHELF, so from the third depth on, every body
 * near the player fell into a single corner cell and the broad phase silently
 * became the exact O(n²) scan it exists to avoid, at precisely the depths with
 * the most in the water. `build()` takes the centre and the span it must
 * cover; the cell size follows. The cell *count* is fixed at construction, so
 * nothing allocates.
 */
export class Grid {
  readonly cols: number
  readonly rows: number
  private cell = 1
  private originX = 0
  private originY = 0
  private readonly counts: Int32Array
  private readonly starts: Int32Array
  private readonly cursor: Int32Array
  private items: Int32Array

  /** `cols` is the fixed grid resolution; the cell size is set per build. */
  constructor(cols: number, capacity: number) {
    this.cols = Math.max(3, Math.round(cols))
    this.rows = this.cols
    const n = this.cols * this.rows
    this.counts = new Int32Array(n)
    this.starts = new Int32Array(n + 1)
    this.cursor = new Int32Array(n)
    this.items = new Int32Array(capacity)
  }

  private cx(x: number): number {
    const c = ((x - this.originX) / this.cell) | 0
    return c < 0 ? 0 : c >= this.cols ? this.cols - 1 : c
  }

  private cy(y: number): number {
    const c = ((y - this.originY) / this.cell) | 0
    return c < 0 ? 0 : c >= this.rows ? this.rows - 1 : c
  }

  /**
   * Rebuild from a packed position array. `xs`/`ys` are read at indices
   * `0..count-1`; `alive` gates membership.
   *
   * `centreX`/`centreY`/`span` place the grid over the region that actually
   * matters this frame. Anything outside still clamps to an edge cell — which
   * is correct, just slow — so the caller should pass a span that covers the
   * live field.
   */
  build(
    xs: Float32Array,
    ys: Float32Array,
    alive: Uint8Array,
    count: number,
    centreX = 0,
    centreY = 0,
    span = 18000,
  ): void {
    this.cell = Math.max(1e-3, span / (this.cols - 2))
    this.originX = centreX - span / 2 - this.cell
    this.originY = centreY - span / 2 - this.cell
    this.counts.fill(0)
    if (this.items.length < count) this.items = new Int32Array(count * 2)
    for (let i = 0; i < count; i++) {
      if (!alive[i]) continue
      const c = this.cy(ys[i] as number) * this.cols + this.cx(xs[i] as number)
      this.counts[c]!++
    }
    let acc = 0
    for (let c = 0; c < this.counts.length; c++) {
      this.starts[c] = acc
      this.cursor[c] = acc
      acc += this.counts[c] as number
    }
    this.starts[this.counts.length] = acc
    for (let i = 0; i < count; i++) {
      if (!alive[i]) continue
      const c = this.cy(ys[i] as number) * this.cols + this.cx(xs[i] as number)
      this.items[this.cursor[c]!++] = i
    }
  }

  /**
   * Visit every index whose cell overlaps the disc (x, y, r). The callback may
   * be called for bodies slightly outside r — the caller does the exact test.
   */
  query(x: number, y: number, r: number, fn: (i: number) => void): void {
    const c0 = this.cx(x - r)
    const c1 = this.cx(x + r)
    const r0 = this.cy(y - r)
    const r1 = this.cy(y + r)
    for (let ry = r0; ry <= r1; ry++) {
      const base = ry * this.cols
      for (let rx = c0; rx <= c1; rx++) {
        const c = base + rx
        const s = this.starts[c] as number
        const e = this.starts[c + 1] as number
        for (let k = s; k < e; k++) fn(this.items[k] as number)
      }
    }
  }
}
