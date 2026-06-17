/**
 * LiquidStage — the Canvas-2D implementation of the FULL-SCREEN juice background.
 *
 * Why Canvas 2D (not Pixi/WebGL): on iOS 26.5 WebKit, Pixi's `app.init()`
 * resolves and our draw runs, but Pixi's GPU render (FillGradient) throws a bare
 * `Script error` every frame → nothing paints (invisible juice). Canvas 2D has
 * no WebGL/GPU-render fragility and is bulletproof on iOS. It also drops ~500 KB
 * of Pixi from the bundle.
 *
 * ONE <canvas>, ONE 2D context, ONE requestAnimationFrame loop. Everything is
 * torn down on dispose() so re-mounts never leak.
 *
 * Visual model (no glass tumbler — the liquid IS the background):
 *   - The liquid is a body that rises from the BOTTOM of the full canvas. The
 *     surface Y maps from fill level01: 0 → a sliver near the very bottom
 *     (~8% up), 1 → nearly full (~88% up).
 *   - A 3-stop vertical gradient body, a gentle two-sine slosh on the surface, a
 *     bright meniscus stroke at the surface line, a soft moving sheen band, and a
 *     subtle top fade just above the surface so the floating UI stays readable.
 *   - triggerWin → the surface surges up briefly + a few chunky droplets + a soft
 *     bloom flash, then settles.
 *   - triggerBottleComplete → a bigger overflow surge + more droplets + a stronger
 *     flash; the store then drops the fill toward empty + cycles color.
 *
 * Performance guards (iPhone):
 *   - DPR capped at min(devicePixelRatio, 2); we draw in CSS pixels via setTransform.
 *   - droplet particles capped (28) + pooled; cleared when idle / on dispose.
 *   - one rAF loop, dt clamped; gradients are cheap to rebuild per frame in 2D.
 */

type RGB = [number, number, number]

const MAX_DROPLETS = 28
// Pour stream duration — long enough to SEE the juice pour in (synced with the
// glass-fill "glug" sound), not a flash.
const POUR_MS = 1150

// Surface mapping: even 0% shows a sliver; 100% nearly fills the screen.
const MIN_FILL_FRAC = 0.08 // surface this far up from the bottom at level 0
const MAX_FILL_FRAC = 0.88 // surface this far up from the bottom at level 1

type Droplet = {
  x: number
  y: number
  r: number
  vx: number
  vy: number
  life: number // remaining seconds
  maxLife: number
  active: boolean
}

export type LiquidStage = {
  setColor(gradient: [string, string, string]): void
  setFill(level01: number, opts?: { animate?: boolean }): void
  triggerWin(): void
  triggerBottleComplete(): void
  resize(): void
  dispose(): void
}

class LiquidStageImpl implements LiquidStage {
  private parent: HTMLElement
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private raf = 0
  private destroyed = false

  // Canvas geometry in CSS pixels (recomputed on resize).
  private cssW = 0
  private cssH = 0

  // Liquid state
  private targetFill = 0
  private renderFill = 0
  private fillVel = 0 // for the satisfying "surge" on win
  private surgeBoost = 0 // transient extra rise (decays), in fill units
  private color: [RGB, RGB, RGB] = [
    [255, 184, 77],
    [255, 152, 0],
    [230, 81, 0],
  ]

  // Animation phases
  private t = 0 // global seconds
  private lastTs = 0
  private sloshAmp = 1 // multiplier, bumps on win
  private flashLife = 0
  private flashMax = 0.5
  private pourLife = 0
  private bigPour = false

  private droplets: Droplet[] = []

  constructor(parent: HTMLElement, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
    this.parent = parent
    this.canvas = canvas
    this.ctx = ctx
    this.computeGeometry()
    this.lastTs = performance.now()
    this.raf = requestAnimationFrame(this.tick)
  }

  // ---- public API ---------------------------------------------------------

  setColor(gradient: [string, string, string]): void {
    this.color = [hexToRgb(gradient[0]), hexToRgb(gradient[1]), hexToRgb(gradient[2])]
  }

  setFill(level01: number, opts?: { animate?: boolean }): void {
    const lvl = clamp01(level01)
    this.targetFill = lvl
    if (opts?.animate === false) {
      this.renderFill = lvl
      this.fillVel = 0
      this.surgeBoost = 0
    }
  }

  triggerWin(): void {
    if (this.destroyed) return
    this.sloshAmp = 2.4
    this.fillVel += 0.05
    this.surgeBoost = Math.max(this.surgeBoost, 0.05) // brief surface surge
    this.flashLife = 0.32
    this.flashMax = 0.32
    this.pourLife = POUR_MS / 1000
    this.bigPour = false
    this.spawnDroplets(12, 1)
  }

  triggerBottleComplete(): void {
    if (this.destroyed) return
    this.sloshAmp = 3.2
    this.fillVel += 0.1
    this.surgeBoost = Math.max(this.surgeBoost, 0.12) // bigger overflow surge
    this.flashLife = 0.5
    this.flashMax = 0.5
    this.pourLife = (POUR_MS * 1.6) / 1000
    this.bigPour = true
    this.spawnDroplets(MAX_DROPLETS, 1.5)
    // The store cycles the bottle color + drops the fill toward empty after a
    // bottle completes; we just play the overflow burst here. The fill RESET is
    // pushed via setFill() by the HeroVessel store subscription.
  }

  resize(): void {
    if (this.destroyed) return
    this.computeGeometry()
  }

  dispose(): void {
    if (this.destroyed) return
    this.destroyed = true
    if (this.raf) cancelAnimationFrame(this.raf)
    this.raf = 0
    try {
      this.canvas.remove()
    } catch {
      /* noop */
    }
    this.droplets = []
  }

  // ---- geometry -----------------------------------------------------------

  private computeGeometry() {
    const cssW = Math.max(1, this.parent.clientWidth)
    const cssH = Math.max(1, this.parent.clientHeight)
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.cssW = cssW
    this.cssH = cssH
    this.canvas.width = Math.floor(cssW * dpr)
    this.canvas.height = Math.floor(cssH * dpr)
    // Draw in CSS pixels; the DPR transform handles crispness.
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  /** Surface Y (px from top) for a given fill 0..1, mapped over the full canvas. */
  private surfaceYFor(fill: number): number {
    const frac = MIN_FILL_FRAC + (MAX_FILL_FRAC - MIN_FILL_FRAC) * clamp01(fill)
    return this.cssH * (1 - frac)
  }

  // ---- per-frame ----------------------------------------------------------

  private tick = (ts: number) => {
    if (this.destroyed) return
    this.raf = requestAnimationFrame(this.tick)

    const dt = Math.min(Math.max(0, ts - this.lastTs), 50) / 1000
    this.lastTs = ts
    this.t += dt

    // Ease the fill toward target so a level change reads as a visible POUR
    // (~1s rise), NOT a spring flash. Exponential approach with a time constant
    // of ~0.32s; snap when essentially arrived so we don't crawl forever.
    const diff = this.targetFill - this.renderFill
    if (Math.abs(diff) < 0.001) {
      this.renderFill = this.targetFill
      this.fillVel = 0
    } else {
      this.renderFill += diff * (1 - Math.exp(-dt / 0.32))
      this.renderFill = clamp01(this.renderFill)
    }

    // Decay the transient surge boost back to 0.
    this.surgeBoost += (0 - this.surgeBoost) * Math.min(1, dt * 3.2)
    if (this.surgeBoost < 0.0005) this.surgeBoost = 0

    // Relax slosh amplitude back to idle.
    this.sloshAmp += (1 - this.sloshAmp) * Math.min(1, dt * 4)

    // Decay flash.
    if (this.flashLife > 0) this.flashLife -= dt

    // Pour stream timer.
    if (this.pourLife > 0) this.pourLife -= dt

    this.updateDroplets(dt)
    this.draw()
  }

  private draw() {
    const ctx = this.ctx
    const w = this.cssW
    const h = this.cssH
    ctx.clearRect(0, 0, w, h)

    // Effective fill includes the transient surge so the surface visibly jumps.
    const fill = clamp01(this.renderFill + this.surgeBoost)
    const surfaceY = this.surfaceYFor(fill)
    const bottomY = h

    // Wavy top: sum of two sines for an organic slosh. Idle motion is gentle +
    // slow (a soft breathing roll); the win/complete surge bumps sloshAmp and
    // makes it visibly choppier before relaxing back.
    const amp = this.sloshAmp * Math.min(9, w * 0.011)
    const seg = 28
    const w1 = 1.6
    const w2 = 2.7
    const p1 = this.t * 0.95
    const p2 = this.t * 1.55

    const top: { x: number; y: number }[] = []
    for (let i = 0; i <= seg; i++) {
      const x = (w * i) / seg
      const u = i / seg
      const wave =
        Math.sin(u * Math.PI * w1 + p1) * amp + Math.sin(u * Math.PI * w2 - p2) * amp * 0.45
      top.push({ x, y: surfaceY + wave })
    }

    // ---- Body fill: wavy top → down right → across bottom → up left ----
    ctx.beginPath()
    ctx.moveTo(top[0].x, top[0].y)
    for (let i = 1; i < top.length; i++) ctx.lineTo(top[i].x, top[i].y)
    ctx.lineTo(w, bottomY)
    ctx.lineTo(0, bottomY)
    ctx.closePath()

    // Deeper, juicier 3-stop vertical gradient. We push more saturation +
    // contrast top→bottom: a glossy lifted lip, a saturated upper body, then a
    // deepened, slightly darkened base for volume. Cheap to rebuild per frame.
    const grad = ctx.createLinearGradient(0, surfaceY, 0, bottomY)
    grad.addColorStop(0, rgbCss(lighten(this.color[0], 0.22))) // glossy lifted top
    grad.addColorStop(0.1, rgbCss(saturate(this.color[0], 0.12)))
    grad.addColorStop(0.52, rgbCss(saturate(this.color[1], 0.1)))
    grad.addColorStop(0.86, rgbCss(this.color[2]))
    grad.addColorStop(1, rgbCss(darken(this.color[2], 0.1))) // deepened base
    ctx.fillStyle = grad
    ctx.fill()

    // Everything below is clipped to the liquid body so sheen/shadow/columns
    // never bleed over the light UI background.
    ctx.save()
    ctx.clip()

    // ---- Glossy vertical highlight column (soft sheen down one side) ----
    // A wide, very soft light column ~28% in from the left gives the body a
    // "lit from the upper-left" glossiness without looking like a stripe.
    const colX = w * 0.3
    const colW = w * 0.34
    const colGrad = ctx.createLinearGradient(colX - colW / 2, 0, colX + colW / 2, 0)
    colGrad.addColorStop(0, "rgba(255,255,255,0)")
    colGrad.addColorStop(0.5, "rgba(255,255,255,0.1)")
    colGrad.addColorStop(1, "rgba(255,255,255,0)")
    ctx.fillStyle = colGrad
    ctx.fillRect(colX - colW / 2, surfaceY, colW, bottomY - surfaceY)

    // ---- Inner shadow at the very bottom for volume ----
    const shadeH = h * 0.14
    const shade = ctx.createLinearGradient(0, bottomY - shadeH, 0, bottomY)
    shade.addColorStop(0, "rgba(0,0,0,0)")
    shade.addColorStop(1, "rgba(0,0,0,0.1)")
    ctx.fillStyle = shade
    ctx.fillRect(0, bottomY - shadeH, w, shadeH)

    // ---- Slow moving caustic bands — "the liquid is alive" ----
    // Two soft horizontal light bands drift at different speeds/phases. Very low
    // alpha + soft vertical falloff so they read as light moving through juice,
    // not solid lines. Skipped when the body is too thin to host them.
    const bodyH = bottomY - surfaceY
    if (bodyH > 24) {
      this.drawCaustic(surfaceY, bottomY, 0.4 + 0.26 * Math.sin(this.t * 0.55), 0.07)
      this.drawCaustic(surfaceY, bottomY, 0.68 + 0.22 * Math.sin(this.t * 0.8 + 2), 0.05)
    }
    ctx.restore()

    // ---- Soft glossy highlight band just below the surface ----
    ctx.beginPath()
    ctx.moveTo(top[0].x, top[0].y + 2)
    for (let i = 1; i < top.length; i++) ctx.lineTo(top[i].x, top[i].y + 2)
    ctx.lineWidth = Math.max(5, w * 0.012)
    ctx.strokeStyle = "rgba(255,255,255,0.26)"
    ctx.lineJoin = "round"
    ctx.lineCap = "round"
    ctx.stroke()

    // ---- Thin saturated lifted-tint edge just under it for definition ----
    const tint = lighten(this.color[0], 0.5)
    ctx.beginPath()
    ctx.moveTo(top[0].x, top[0].y + 1.5)
    for (let i = 1; i < top.length; i++) ctx.lineTo(top[i].x, top[i].y + 1.5)
    ctx.lineWidth = Math.max(2, w * 0.004)
    ctx.strokeStyle = `rgba(${tint[0]},${tint[1]},${tint[2]},0.95)`
    ctx.stroke()

    // ---- Bright crisp meniscus (white core) + a thin specular highlight ----
    ctx.beginPath()
    ctx.moveTo(top[0].x, top[0].y)
    for (let i = 1; i < top.length; i++) ctx.lineTo(top[i].x, top[i].y)
    ctx.lineWidth = Math.max(3, w * 0.006)
    ctx.strokeStyle = "rgba(255,255,255,0.9)"
    ctx.stroke()
    // Tight specular line riding the very top of the meniscus for crisp gloss.
    ctx.beginPath()
    ctx.moveTo(top[0].x, top[0].y - 1)
    for (let i = 1; i < top.length; i++) ctx.lineTo(top[i].x, top[i].y - 1)
    ctx.lineWidth = Math.max(1, w * 0.002)
    ctx.strokeStyle = "rgba(255,255,255,0.95)"
    ctx.stroke()

    // Pour stream + droplets + top fade + flash.
    this.drawPour(surfaceY)
    this.drawDroplets()
    this.drawTopFade(surfaceY)
    this.drawFlash()
  }

  /**
   * One soft moving caustic/light band inside the body. `frac01` is its center
   * as a fraction of the body height (surface→bottom); a vertical gradient gives
   * it a soft falloff above + below so it reads as drifting light, not a stripe.
   */
  private drawCaustic(surfaceY: number, bottomY: number, frac01: number, alpha: number) {
    const ctx = this.ctx
    const w = this.cssW
    const bodyH = bottomY - surfaceY
    const cy = surfaceY + bodyH * clamp01(frac01)
    const half = Math.max(8, bodyH * 0.1)
    const top = Math.max(surfaceY, cy - half)
    const bot = Math.min(bottomY, cy + half)
    if (bot - top < 2) return
    const g = ctx.createLinearGradient(0, top, 0, bot)
    g.addColorStop(0, "rgba(255,255,255,0)")
    g.addColorStop(0.5, `rgba(255,255,255,${alpha})`)
    g.addColorStop(1, "rgba(255,255,255,0)")
    ctx.fillStyle = g
    ctx.fillRect(0, top, w, bot - top)
  }

  /** A soft white fade just above the surface so the floating UI stays readable. */
  private drawTopFade(surfaceY: number) {
    const ctx = this.ctx
    const w = this.cssW
    const fadeTop = Math.max(0, surfaceY - this.cssH * 0.14)
    const fadeH = surfaceY - fadeTop
    if (fadeH <= 0) return
    const fade = ctx.createLinearGradient(0, fadeTop, 0, surfaceY)
    fade.addColorStop(0, "rgba(255,255,255,0)")
    fade.addColorStop(1, "rgba(255,255,255,0.18)")
    ctx.fillStyle = fade
    ctx.fillRect(0, fadeTop, w, fadeH)
  }

  private drawPour(surfaceY: number) {
    if (this.pourLife <= 0) return
    const ctx = this.ctx
    const w = this.cssW
    const cx = w / 2
    const streamW = this.bigPour ? w * 0.1 : w * 0.06
    const topY = -w * 0.1
    // wobbling pour stream from the top down to the surface
    const wob = Math.sin(this.t * 30) * streamW * 0.15
    const col = lighten(this.color[1], 0.1)
    ctx.beginPath()
    ctx.moveTo(cx - streamW / 2 + wob, topY)
    ctx.lineTo(cx + streamW / 2 + wob, topY)
    ctx.lineTo(cx + (streamW / 2) * 0.6, surfaceY)
    ctx.lineTo(cx - (streamW / 2) * 0.6, surfaceY)
    ctx.closePath()
    ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},0.85)`
    ctx.fill()
  }

  /** A soft white radial bloom overlay that fades out (~flashMax seconds). */
  private drawFlash() {
    if (this.flashLife <= 0) return
    const ctx = this.ctx
    const w = this.cssW
    const h = this.cssH
    const k = Math.max(0, this.flashLife) / this.flashMax
    const alpha = 0.45 * k * k
    if (alpha <= 0.001) return
    const cx = w / 2
    const cy = h * 0.75
    const radius = Math.max(w, h) * 0.85
    const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
    bloom.addColorStop(0, `rgba(255,255,255,${alpha})`)
    bloom.addColorStop(0.5, `rgba(255,255,255,${alpha * 0.5})`)
    bloom.addColorStop(1, "rgba(255,255,255,0)")
    ctx.fillStyle = bloom
    ctx.fillRect(0, 0, w, h)
  }

  // ---- droplets -----------------------------------------------------------

  private spawnDroplets(count: number, scale: number) {
    const w = this.cssW
    const cx = w / 2
    const surfaceY = this.surfaceYFor(clamp01(this.renderFill + this.surgeBoost))
    for (let i = 0; i < count; i++) {
      const d = this.acquireDroplet()
      if (!d) break
      d.r = (3 + Math.random() * 6) * scale
      d.x = cx + (Math.random() - 0.5) * w * 0.7
      d.y = surfaceY
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.6
      const sp = (180 + Math.random() * 240) * scale
      d.vx = Math.cos(ang) * sp
      d.vy = Math.sin(ang) * sp
      d.maxLife = 0.55 + Math.random() * 0.4
      d.life = d.maxLife
      d.active = true
    }
  }

  private acquireDroplet(): Droplet | null {
    for (const d of this.droplets) if (!d.active) return d
    if (this.droplets.length >= MAX_DROPLETS) return null
    const d: Droplet = {
      x: 0,
      y: 0,
      r: 4,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 0,
      active: false,
    }
    this.droplets.push(d)
    return d
  }

  private updateDroplets(dt: number) {
    const gravity = 1100
    for (const d of this.droplets) {
      if (!d.active) continue
      d.life -= dt
      if (d.life <= 0) {
        d.active = false
        continue
      }
      d.vy += gravity * dt
      d.x += d.vx * dt
      d.y += d.vy * dt
    }
  }

  private drawDroplets() {
    const ctx = this.ctx
    const col = lighten(this.color[0], 0.2)
    for (const d of this.droplets) {
      if (!d.active) continue
      const k = d.life / d.maxLife
      const alpha = Math.min(1, k * 1.4)
      const s = 0.7 + 0.6 * k
      const r = d.r * s
      // chunky round droplet
      ctx.beginPath()
      ctx.arc(d.x, d.y, r, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${0.95 * alpha})`
      ctx.fill()
      // gooey highlight
      ctx.beginPath()
      ctx.arc(d.x - r * 0.3, d.y - r * 0.3, r * 0.35, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255,255,255,${0.5 * alpha})`
      ctx.fill()
    }
  }
}

// ---- helpers --------------------------------------------------------------

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n
}

function hexToRgb(hex: string): RGB {
  let h = hex.trim().replace(/^#/, "")
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  }
  const n = parseInt(h, 16)
  if (Number.isNaN(n)) return [255, 152, 0]
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbCss(rgb: RGB): string {
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`
}

function lighten(rgb: RGB, k: number): RGB {
  return [
    Math.min(255, Math.round(rgb[0] + (255 - rgb[0]) * k)),
    Math.min(255, Math.round(rgb[1] + (255 - rgb[1]) * k)),
    Math.min(255, Math.round(rgb[2] + (255 - rgb[2]) * k)),
  ]
}

/** Darken toward black by factor k (0 = unchanged, 1 = black). */
function darken(rgb: RGB, k: number): RGB {
  return [
    Math.max(0, Math.round(rgb[0] * (1 - k))),
    Math.max(0, Math.round(rgb[1] * (1 - k))),
    Math.max(0, Math.round(rgb[2] * (1 - k))),
  ]
}

/**
 * Push saturation: move each channel away from the color's own luma by factor
 * k. Keeps the hue, just makes the juice read richer/deeper. Clamped to [0,255].
 */
function saturate(rgb: RGB, k: number): RGB {
  const luma = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]
  return [
    clampByte(luma + (rgb[0] - luma) * (1 + k)),
    clampByte(luma + (rgb[1] - luma) * (1 + k)),
    clampByte(luma + (rgb[2] - luma) * (1 + k)),
  ]
}

function clampByte(n: number): number {
  return n < 0 ? 0 : n > 255 ? 255 : Math.round(n)
}

/**
 * Factory: creates an <canvas>, gets a 2D context, mounts it into `parent`, and
 * returns the wired stage. Fully SYNCHRONOUS — no async init (that's the whole
 * point: instant, bulletproof on iOS).
 *
 * If a 2D context isn't available (e.g. happy-dom in tests), we return a no-op
 * stage that still satisfies the interface so callers never crash.
 */
export function createLiquidStage(parent: HTMLElement): LiquidStage {
  const canvas = document.createElement("canvas")
  canvas.style.position = "absolute"
  canvas.style.inset = "0"
  canvas.style.width = "100%"
  canvas.style.height = "100%"
  canvas.style.pointerEvents = "none"

  const ctx = canvas.getContext("2d")
  if (!ctx) {
    // No 2D context (test DOM / unsupported): a safe no-op stage.
    return {
      setColor() {},
      setFill() {},
      triggerWin() {},
      triggerBottleComplete() {},
      resize() {},
      dispose() {},
    }
  }

  parent.appendChild(canvas)
  return new LiquidStageImpl(parent, canvas, ctx)
}
