// Bloom and splats.
//
// **Bloom without a shader.** Emissive things — particles, the blade, halos,
// prime bursts — are drawn into a half-resolution `emissive` buffer instead of
// onto the frame. That buffer is then composited three times with `lighter`:
// once sharp, and twice after successive bilinear downsamples, which is a
// cheap and surprisingly convincing two-tap Gaussian. Net cost is *lower* than
// drawing the particles at full resolution, because a half-res particle is a
// quarter of the fill — the bloom is effectively free and the sharp pass is
// where the saving comes from.
//
// **Splats.** Juice that lands on the "camera glass" and stays. It accumulates
// over a run as a record of what you did, and fades slowly enough that a good
// thirty seconds is still visible. This is the "leave a mark" technique, and it
// is the difference between a run that happened and a run you can see.

type Buf = { c: HTMLCanvasElement; g: CanvasRenderingContext2D }

function buf(w: number, h: number): Buf {
  const c = document.createElement("canvas")
  c.width = Math.max(1, Math.floor(w))
  c.height = Math.max(1, Math.floor(h))
  const g = c.getContext("2d")
  if (!g) throw new Error("slice: 2D context unavailable")
  return { c, g }
}

export class Bloom {
  emissive: Buf | null = null
  private b1: Buf | null = null
  private b2: Buf | null = null
  scale = 0.5
  enabled = true
  private w = 0
  private h = 0

  resize(w: number, h: number, enabled: boolean): void {
    this.enabled = enabled
    this.w = w
    this.h = h
    if (!enabled) {
      this.emissive = null
      this.b1 = null
      this.b2 = null
      return
    }
    this.emissive = buf(w * this.scale, h * this.scale)
    this.b1 = buf(w * this.scale * 0.5, h * this.scale * 0.5)
    this.b2 = buf(w * this.scale * 0.25, h * this.scale * 0.25)
    for (const b of [this.emissive, this.b1, this.b2]) b.g.imageSmoothingEnabled = true
  }

  /** Begin the emissive pass. Returns the context to draw into, already scaled. */
  begin(): CanvasRenderingContext2D | null {
    const e = this.emissive
    if (!this.enabled || !e) return null
    e.g.setTransform(1, 0, 0, 1, 0, 0)
    e.g.clearRect(0, 0, e.c.width, e.c.height)
    e.g.setTransform(this.scale, 0, 0, this.scale, 0, 0)
    return e.g
  }

  /** Composite the emissive pass and its bloom onto the frame. */
  composite(g: CanvasRenderingContext2D, strength: number): void {
    const e = this.emissive
    const b1 = this.b1
    const b2 = this.b2
    if (!this.enabled || !e || !b1 || !b2) return

    b1.g.setTransform(1, 0, 0, 1, 0, 0)
    b1.g.clearRect(0, 0, b1.c.width, b1.c.height)
    b1.g.drawImage(e.c, 0, 0, b1.c.width, b1.c.height)

    b2.g.setTransform(1, 0, 0, 1, 0, 0)
    b2.g.clearRect(0, 0, b2.c.width, b2.c.height)
    b2.g.drawImage(b1.c, 0, 0, b2.c.width, b2.c.height)

    const prev = g.globalCompositeOperation
    g.globalCompositeOperation = "lighter"
    g.globalAlpha = 1
    g.drawImage(e.c, 0, 0, this.w, this.h)
    g.globalAlpha = 0.42 * strength
    g.drawImage(b1.c, 0, 0, this.w, this.h)
    g.globalAlpha = 0.62 * strength
    g.drawImage(b2.c, 0, 0, this.w, this.h)
    g.globalAlpha = 1
    g.globalCompositeOperation = prev
  }
}

export class Splats {
  private b: Buf | null = null
  scale = 0.5
  enabled = true
  private w = 0
  private h = 0
  private fadeAcc = 0

  resize(w: number, h: number, enabled: boolean): void {
    this.enabled = enabled
    this.w = w
    this.h = h
    this.b = enabled ? buf(w * this.scale, h * this.scale) : null
  }

  clear(): void {
    const b = this.b
    if (!b) return
    b.g.setTransform(1, 0, 0, 1, 0, 0)
    b.g.clearRect(0, 0, b.c.width, b.c.height)
  }

  /** A burst of juice hitting the glass. `n` blobs around (x, y). */
  splat(x: number, y: number, color: string, n: number, spread: number, rand: () => number): void {
    const b = this.b
    if (!this.enabled || !b) return
    const g = b.g
    g.setTransform(this.scale, 0, 0, this.scale, 0, 0)
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2
      const d = Math.pow(rand(), 0.6) * spread
      const rx = x + Math.cos(a) * d
      const ry = y + Math.sin(a) * d
      const r = 3 + rand() * 10
      // Deliberately faint. An earlier pass ran 0.14–0.44 per blob and, after
      // sixty seconds of good play, the accumulated glass was opaque enough to
      // wash out the numerals — the splat layer is a *record* of the run, not a
      // participant in it.
      g.globalAlpha = 0.05 + rand() * 0.13
      g.fillStyle = color
      g.beginPath()
      // Slightly elliptical and rotated: a round splat reads as a sticker.
      g.ellipse(rx, ry, r, r * (0.55 + rand() * 0.6), rand() * Math.PI, 0, Math.PI * 2)
      g.fill()
    }
    g.globalAlpha = 1
  }

  /** Fade toward transparent. Called every frame; costs one low-res fillRect. */
  update(dt: number): void {
    const b = this.b
    if (!this.enabled || !b) return
    this.fadeAcc += dt
    if (this.fadeAcc < 1 / 30) return
    const step = this.fadeAcc
    this.fadeAcc = 0
    const g = b.g
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.globalCompositeOperation = "destination-out"
    // ~6 seconds to clear: long enough that a burst leaves a visible mark,
    // short enough that the glass can never saturate during a long run.
    g.fillStyle = `rgba(0,0,0,${Math.min(0.4, step * 0.26).toFixed(4)})`
    g.fillRect(0, 0, b.c.width, b.c.height)
    g.globalCompositeOperation = "source-over"
  }

  draw(g: CanvasRenderingContext2D, alpha: number): void {
    const b = this.b
    if (!this.enabled || !b) return
    g.globalAlpha = alpha
    g.drawImage(b.c, 0, 0, this.w, this.h)
    g.globalAlpha = 1
  }
}
