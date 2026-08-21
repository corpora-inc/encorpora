/**
 * A tapering ribbon trail. One filled polygon, one stroked core — two draw calls
 * for the whole tail, regardless of length.
 */

export class Trail {
  private xs: Float32Array
  private ys: Float32Array
  private n = 0
  private head = 0
  readonly cap: number

  constructor(cap = 34) {
    this.cap = cap
    this.xs = new Float32Array(cap)
    this.ys = new Float32Array(cap)
  }

  clear(): void {
    this.n = 0
    this.head = 0
  }

  push(x: number, y: number): void {
    this.xs[this.head] = x
    this.ys[this.head] = y
    this.head = (this.head + 1) % this.cap
    if (this.n < this.cap) this.n++
  }

  /** oldest -> newest */
  private at(i: number): [number, number] {
    const idx = (this.head - this.n + i + this.cap * 2) % this.cap
    return [this.xs[idx], this.ys[idx]]
  }

  draw(ctx: CanvasRenderingContext2D, s: number, widthPx: number, fill: string, core: string): void {
    if (this.n < 3) return
    const n = this.n
    const w = widthPx / s
    const left: Array<[number, number]> = []
    const right: Array<[number, number]> = []
    for (let i = 0; i < n; i++) {
      const [x, y] = this.at(i)
      const [px, py] = this.at(Math.max(0, i - 1))
      const [nx, ny] = this.at(Math.min(n - 1, i + 1))
      let dx = nx - px
      let dy = ny - py
      const m = Math.hypot(dx, dy) || 1
      dx /= m
      dy /= m
      const t = i / (n - 1)
      const hw = w * t * t * 0.5
      left.push([x - dy * hw, y + dx * hw])
      right.push([x + dy * hw, y - dx * hw])
    }
    ctx.beginPath()
    ctx.moveTo(left[0][0], left[0][1])
    for (let i = 1; i < n; i++) ctx.lineTo(left[i][0], left[i][1])
    for (let i = n - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1])
    ctx.closePath()
    ctx.globalCompositeOperation = 'lighter'
    ctx.fillStyle = fill
    ctx.fill()
    ctx.beginPath()
    const [x0, y0] = this.at(Math.max(0, n - 8))
    ctx.moveTo(x0, y0)
    for (let i = Math.max(0, n - 8) + 1; i < n; i++) {
      const [x, y] = this.at(i)
      ctx.lineTo(x, y)
    }
    ctx.strokeStyle = core
    ctx.lineWidth = (widthPx * 0.34) / s
    ctx.lineCap = 'round'
    ctx.stroke()
    ctx.globalCompositeOperation = 'source-over'
  }
}
