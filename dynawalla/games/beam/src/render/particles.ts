// Struct-of-arrays particle field. Allocated once at the ULTRA ceiling and
// never grown; the tier caps how many are allowed *alive*, so a tier change
// costs nothing and allocates nothing.
//
// Zero per-frame allocation is not a slogan here — there is no object literal,
// no closure and no array push anywhere in `update` or `draw`. Everything is
// drawn with `fillRect` under a single transform per shard, which is what keeps
// three thousand of them inside the frame budget on the tablet that sets the
// floor.

export const KIND_MOTE = 0
/** A stretched streak, drawn along its velocity — shattered brass. */
export const KIND_SHARD = 1

const CAP = 3400

export class Particles {
  private x = new Float32Array(CAP)
  private y = new Float32Array(CAP)
  private vx = new Float32Array(CAP)
  private vy = new Float32Array(CAP)
  private life = new Float32Array(CAP)
  private inv = new Float32Array(CAP)
  private size = new Float32Array(CAP)
  private drag = new Float32Array(CAP)
  private kind = new Uint8Array(CAP)
  private col = new Uint8Array(CAP)

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
  ): void {
    if (this.count >= this.limit || this.count >= CAP) return
    const i = this.count++
    this.x[i] = x
    this.y[i] = y
    this.vx[i] = vx
    this.vy[i] = vy
    this.life[i] = lifeS
    this.inv[i] = 1 / Math.max(0.02, lifeS)
    this.size[i] = size
    this.drag[i] = drag
    this.kind[i] = kind
    this.col[i] = colorId
  }

  update(dt: number): void {
    let n = this.count
    for (let i = 0; i < n; i++) {
      const l = (this.life[i] as number) - dt
      if (l <= 0) {
        n--
        this.swap(i, n)
        i--
        continue
      }
      this.life[i] = l
      const k = Math.exp(-(this.drag[i] as number) * dt)
      this.vx[i] = (this.vx[i] as number) * k
      this.vy[i] = (this.vy[i] as number) * k
      this.x[i] = (this.x[i] as number) + (this.vx[i] as number) * dt
      this.y[i] = (this.y[i] as number) + (this.vy[i] as number) * dt
    }
    this.count = n
  }

  private swap(a: number, b: number): void {
    if (a === b) return
    for (const arr of [this.x, this.y, this.vx, this.vy, this.life, this.inv, this.size, this.drag]) {
      const t = arr[a] as number
      arr[a] = arr[b] as number
      arr[b] = t
    }
    for (const arr of [this.kind, this.col]) {
      const t = arr[a] as number
      arr[a] = arr[b] as number
      arr[b] = t
    }
  }

  draw(g: CanvasRenderingContext2D): void {
    g.save()
    g.globalCompositeOperation = "lighter"
    let last = -1
    for (let i = 0; i < this.count; i++) {
      const c = this.col[i] as number
      if (c !== last) {
        g.fillStyle = this.colors[c] as string
        last = c
      }
      const t = (this.life[i] as number) * (this.inv[i] as number)
      g.globalAlpha = t * t
      const s = (this.size[i] as number) * (0.35 + t * 0.65)
      const px = this.x[i] as number
      const py = this.y[i] as number
      if (this.kind[i] === KIND_SHARD) {
        const vx = this.vx[i] as number
        const vy = this.vy[i] as number
        const l = Math.hypot(vx, vy) || 1
        const stretch = Math.min(5, 1 + l / 320)
        // `transform` and not `setTransform`: the camera's shake and punch-zoom
        // matrix is already on the context, and replacing it here would draw
        // every shard outside the shake while everything else moved with it.
        g.save()
        g.transform(vx / l, vy / l, -vy / l, vx / l, px, py)
        g.fillRect(-s * stretch * 0.5, -s * 0.22, s * stretch, s * 0.44)
        g.restore()
      } else {
        g.fillRect(px - s * 0.5, py - s * 0.5, s, s)
      }
    }
    g.restore()
    g.globalAlpha = 1
  }
}
