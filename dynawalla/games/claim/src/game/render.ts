// The look: flat spot inks, hard edges, one enormous fill per decision.
//
// Cost control is the whole design. Claimed territory lives in an ImageData at
// GRID resolution (98 x 77 = 7546 px) and is blitted once per frame with
// smoothing off, so a fully claimed arena costs exactly the same as an empty
// one. Nothing per-cell happens in the draw loop.

import { VOID, type Grid } from "./grid.ts"
import { batchColour, css, INK, mix, type LevelInk, type Rgb } from "./palette.ts"
import type { Particles } from "./particles.ts"
import type { Hunter } from "./hunters.ts"

export type Camera = {
  shakeX: number
  shakeY: number
  rot: number
  zoom: number
  flash: number
  flashStyle: string
}

export class Renderer {
  readonly canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private terr: HTMLCanvasElement
  private terrCtx: CanvasRenderingContext2D
  private terrData: ImageData
  private terrDirty = true
  private ghost: HTMLCanvasElement
  private ghostCtx: CanvasRenderingContext2D
  private ghostData: ImageData
  private g: Grid
  private paper: HTMLCanvasElement | null = null
  dpr = 1
  /** CSS pixels. */
  w = 0
  h = 0
  cs = 8
  ox = 0
  oy = 0
  ink: LevelInk

  constructor(canvas: HTMLCanvasElement, g: Grid, ink: LevelInk) {
    this.canvas = canvas
    this.g = g
    this.ink = ink
    const ctx = canvas.getContext("2d", { alpha: false })
    if (!ctx) throw new Error("2d context unavailable")
    this.ctx = ctx
    this.terr = document.createElement("canvas")
    this.terr.width = g.w
    this.terr.height = g.h
    const tc = this.terr.getContext("2d", { willReadFrequently: false })
    if (!tc) throw new Error("2d context unavailable")
    this.terrCtx = tc
    this.terrData = tc.createImageData(g.w, g.h)
    this.ghost = document.createElement("canvas")
    this.ghost.width = g.w
    this.ghost.height = g.h
    const gc = this.ghost.getContext("2d")
    if (!gc) throw new Error("2d context unavailable")
    this.ghostCtx = gc
    this.ghostData = gc.createImageData(g.w, g.h)
  }

  setGrid(g: Grid, ink: LevelInk): void {
    this.g = g
    this.ink = ink
    if (this.terr.width !== g.w || this.terr.height !== g.h) {
      this.terr.width = g.w
      this.terr.height = g.h
      this.ghost.width = g.w
      this.ghost.height = g.h
      this.terrData = this.terrCtx.createImageData(g.w, g.h)
      this.ghostData = this.ghostCtx.createImageData(g.w, g.h)
    }
    this.paper = null
    this.clearTerritory()
  }

  clearTerritory(): void {
    this.terrData.data.fill(0)
    this.ghostData.data.fill(0)
    this.terrDirty = true
    this.ghostCtx.putImageData(this.ghostData, 0, 0)
  }

  paintCell(cell: number, batch: number): void {
    const c: Rgb = batchColour(this.ink, batch, cell)
    const p = cell * 4
    const d = this.terrData.data
    d[p] = c[0]
    d[p + 1] = c[1]
    d[p + 2] = c[2]
    d[p + 3] = 255
    this.terrDirty = true
  }

  paintCellRaw(cell: number, c: Rgb, alpha = 255): void {
    const p = cell * 4
    const d = this.terrData.data
    d[p] = c[0]
    d[p + 1] = c[1]
    d[p + 2] = c[2]
    d[p + 3] = alpha
    this.terrDirty = true
  }

  clearCell(cell: number): void {
    const p = cell * 4
    this.terrData.data[p + 3] = 0
    this.terrDirty = true
  }

  /** Repaint every claimed cell — used on a level's colour change and on resize. */
  repaintAll(): void {
    const g = this.g
    this.terrData.data.fill(0)
    for (let i = 0; i < g.own.length; i++) {
      if (g.own[i] === VOID) continue
      const x = i % g.w
      const y = (i / g.w) | 0
      if (x === 0 || y === 0 || x === g.w - 1 || y === g.h - 1) {
        this.paintCellRaw(i, INK.paperLift, 255)
      } else {
        this.paintCell(i, g.batch[i] as number)
      }
    }
    this.terrDirty = true
  }

  /** Rebuild the "if you closed now" overlay from `grid.scratch` (3 = would take). */
  buildGhost(): void {
    const g = this.g
    const s = g.scratch
    const d = this.ghostData.data
    d.fill(0)
    const inner: Rgb = mix(this.ink.a, INK.bone, 0.35)
    const edge: Rgb = INK.bone
    for (let y = 1; y <= g.h - 2; y++) {
      const row = y * g.w
      for (let x = 1; x <= g.w - 2; x++) {
        const c = row + x
        if (s[c] !== 3) continue
        const isEdge =
          s[c - 1] !== 3 || s[c + 1] !== 3 || s[c - g.w] !== 3 || s[c + g.w] !== 3
        const col = isEdge ? edge : inner
        const p = c * 4
        d[p] = col[0]
        d[p + 1] = col[1]
        d[p + 2] = col[2]
        d[p + 3] = isEdge ? 240 : 120
      }
    }
    this.ghostCtx.putImageData(this.ghostData, 0, 0)
  }

  clearGhost(): void {
    this.ghostData.data.fill(0)
    this.ghostCtx.putImageData(this.ghostData, 0, 0)
  }

  /**
   * Backing-store budget, in device pixels.
   *
   * The art is flat blocks with hard edges, so it loses almost nothing at 1.5x
   * — but a 2.9 MPx surface is four fullscreen fills a frame, and on a
   * mid-range tablet that is the whole frame budget spent on fill rate before
   * a single hunter is drawn. Cap the pixels, not the device.
   */
  private static readonly PIXEL_BUDGET = 2_100_000

  resize(cssW: number, cssH: number): void {
    const want = Math.min(2, globalThis.devicePixelRatio || 1)
    const px = cssW * cssH * want * want
    this.dpr =
      px > Renderer.PIXEL_BUDGET
        ? Math.max(1, want * Math.sqrt(Renderer.PIXEL_BUDGET / px))
        : want
    this.w = cssW
    this.h = cssH
    this.canvas.width = Math.max(1, Math.round(cssW * this.dpr))
    this.canvas.height = Math.max(1, Math.round(cssH * this.dpr))
    this.canvas.style.width = `${cssW}px`
    this.canvas.style.height = `${cssH}px`
    // Integer cell size: every cell the same width, no shimmer on the blit.
    const cs = Math.max(2, Math.floor(Math.min(cssW / this.g.w, cssH / this.g.h)))
    this.cs = cs
    this.ox = Math.round((cssW - cs * this.g.w) / 2)
    this.oy = Math.round((cssH - cs * this.g.h) / 2)
    this.buildPaper()
  }

  cellToPx(cell: number): { x: number; y: number } {
    const x = cell % this.g.w
    const y = (cell / this.g.w) | 0
    return { x: this.ox + (x + 0.5) * this.cs, y: this.oy + (y + 0.5) * this.cs }
  }

  gridToPx(gx: number, gy: number): { x: number; y: number } {
    return { x: this.ox + gx * this.cs, y: this.oy + gy * this.cs }
  }

  begin(cam: Camera): CanvasRenderingContext2D {
    const ctx = this.ctx
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.fillStyle = css(INK.paper)
    ctx.fillRect(0, 0, this.w, this.h)
    ctx.save()
    ctx.translate(this.w / 2 + cam.shakeX, this.h / 2 + cam.shakeY)
    ctx.rotate(cam.rot)
    ctx.scale(cam.zoom, cam.zoom)
    ctx.translate(-this.w / 2, -this.h / 2)
    return ctx
  }

  /**
   * The unprinted paper: halftone tooth, the 1/40 poster grid, and a
   * registration cross at every block corner. Rebuilt only on resize and
   * blitted once per frame, so a richer plane costs the same as a black one.
   */
  private buildPaper(): void {
    const { cs, g } = this
    const aw = Math.max(1, cs * g.w)
    const ah = Math.max(1, cs * g.h)
    if (!this.paper) this.paper = document.createElement("canvas")
    this.paper.width = aw
    this.paper.height = ah
    const p = this.paper.getContext("2d")
    if (!p) return
    p.fillStyle = "#08080c"
    p.fillRect(0, 0, aw, ah)

    // Halftone tooth. Deterministic, so the paper is the same every run.
    let s = 1234567
    const dot = Math.max(1, Math.round(cs / 4))
    const pitch = Math.max(6, cs * 1.5)
    for (let y = pitch / 2; y < ah; y += pitch) {
      for (let x = pitch / 2; x < aw; x += pitch) {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0
        const a = 0.012 + ((s >>> 24) / 255) * 0.026
        p.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`
        p.fillRect(Math.round(x), Math.round(y), dot, dot)
      }
    }

    // Interior is divided into exactly 40 equal blocks on every device. One
    // block is 1/40 of the area — the unit you learn to estimate in.
    p.strokeStyle = "rgba(255,255,255,0.055)"
    p.lineWidth = 1
    p.beginPath()
    for (let x = 1 + g.bx; x <= g.w - 2; x += g.bx) {
      p.moveTo(Math.round(x * cs) + 0.5, cs)
      p.lineTo(Math.round(x * cs) + 0.5, ah - cs)
    }
    for (let y = 1 + g.by; y <= g.h - 2; y += g.by) {
      p.moveTo(cs, Math.round(y * cs) + 0.5)
      p.lineTo(aw - cs, Math.round(y * cs) + 0.5)
    }
    p.stroke()

    // Registration crosses on the block corners — a printer's mark, and the
    // thing your eye actually counts blocks against.
    const arm = Math.max(3, cs * 0.7)
    p.strokeStyle = "rgba(255,255,255,0.14)"
    p.lineWidth = Math.max(1, Math.round(cs / 7))
    p.beginPath()
    for (let x = 1 + g.bx; x <= g.w - 2; x += g.bx) {
      for (let y = 1 + g.by; y <= g.h - 2; y += g.by) {
        const px = Math.round(x * cs) + 0.5
        const py = Math.round(y * cs) + 0.5
        p.moveTo(px - arm, py)
        p.lineTo(px + arm, py)
        p.moveTo(px, py - arm)
        p.lineTo(px, py + arm)
      }
    }
    p.stroke()
  }

  drawField(time: number): void {
    const ctx = this.ctx
    const { ox, oy, cs, g } = this
    const aw = cs * g.w
    const ah = cs * g.h
    if (!this.paper) this.buildPaper()
    if (this.paper) ctx.drawImage(this.paper, ox, oy)

    // A slow sheen across the untaken plane so it never looks dead.
    const sweep = ((time * 0.06) % 1.6) - 0.3
    const gx = ox + sweep * aw
    const grad = ctx.createLinearGradient(gx - aw * 0.18, 0, gx + aw * 0.18, 0)
    grad.addColorStop(0, "rgba(255,255,255,0)")
    grad.addColorStop(0.5, "rgba(255,255,255,0.03)")
    grad.addColorStop(1, "rgba(255,255,255,0)")
    ctx.fillStyle = grad
    ctx.fillRect(ox, oy, aw, ah)
  }

  drawTerritory(): void {
    if (this.terrDirty) {
      this.terrCtx.putImageData(this.terrData, 0, 0)
      this.terrDirty = false
    }
    const ctx = this.ctx
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(this.terr, this.ox, this.oy, this.cs * this.g.w, this.cs * this.g.h)
  }

  drawGhost(alpha: number): void {
    const ctx = this.ctx
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(this.ghost, this.ox, this.oy, this.cs * this.g.w, this.cs * this.g.h)
    ctx.restore()
  }

  /** The white edge sweeping across a region as the ink floods in. */
  drawWavefront(cells: Int32Array, from: number, to: number): void {
    if (to <= from) return
    const ctx = this.ctx
    const cs = this.cs
    ctx.save()
    ctx.globalCompositeOperation = "lighter"
    ctx.fillStyle = "rgba(255,255,255,0.85)"
    for (let i = from; i < to; i++) {
      const c = cells[i] as number
      const x = c % this.g.w
      const y = (c / this.g.w) | 0
      ctx.fillRect(this.ox + x * cs, this.oy + y * cs, cs, cs)
    }
    ctx.restore()
  }

  /**
   * The live cut. Decimated to its corners — a 300-cell trail is six line
   * segments, not three hundred.
   */
  drawTrail(trail: readonly number[], danger: number, time: number): void {
    if (trail.length < 1) return
    const ctx = this.ctx
    const pts: Array<{ x: number; y: number }> = []
    let lastDx = 999
    let lastDy = 999
    for (let i = 0; i < trail.length; i++) {
      const c = trail[i] as number
      const x = c % this.g.w
      const y = (c / this.g.w) | 0
      if (i > 0 && i < trail.length - 1) {
        const p = trail[i - 1] as number
        const dx = x - (p % this.g.w)
        const dy = y - ((p / this.g.w) | 0)
        if (dx === lastDx && dy === lastDy) {
          pts[pts.length - 1] = this.cellToPx(c)
          continue
        }
        lastDx = dx
        lastDy = dy
      }
      pts.push(this.cellToPx(c))
    }
    const path = new Path2D()
    path.moveTo((pts[0] as { x: number; y: number }).x, (pts[0] as { x: number; y: number }).y)
    for (let i = 1; i < pts.length; i++) {
      path.lineTo((pts[i] as { x: number; y: number }).x, (pts[i] as { x: number; y: number }).y)
    }
    const cs = this.cs
    ctx.save()
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    // Glow pass, additive. Brighter the closer a hunter gets.
    ctx.globalCompositeOperation = "lighter"
    ctx.strokeStyle = css(INK.pink, 0.1 + danger * 0.22)
    ctx.lineWidth = cs * (1.9 + danger * 1.6 + Math.sin(time * 9) * 0.12 * danger)
    ctx.stroke(path)
    ctx.restore()
    ctx.save()
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.strokeStyle = css(INK.pink)
    ctx.lineWidth = cs * 0.72
    ctx.stroke(path)
    ctx.strokeStyle = css(mix(INK.pink, INK.bone, 0.75))
    ctx.lineWidth = cs * 0.26
    ctx.stroke(path)
    ctx.restore()
  }

  /** The fuse eating the trail from its root. */
  drawFuse(trail: readonly number[], active: boolean, time: number): void {
    if (!active || trail.length === 0) return
    const ctx = this.ctx
    const p = this.cellToPx(trail[0] as number)
    const r = this.cs * (1.5 + Math.sin(time * 22) * 0.35)
    ctx.save()
    ctx.globalCompositeOperation = "lighter"
    ctx.fillStyle = css(INK.orange, 0.85)
    ctx.beginPath()
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = css(INK.yellow, 0.95)
    ctx.beginPath()
    ctx.arc(p.x, p.y, r * 0.45, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  drawPlayer(
    x: number,
    y: number,
    dx: number,
    dy: number,
    stretch: number,
    invuln: number,
    time: number,
    ghosts: Float32Array,
    ghostCount: number,
  ): void {
    const ctx = this.ctx
    const cs = this.cs
    const p = this.gridToPx(x, y)
    // After-images: the comet that makes 30 cells/second legible.
    ctx.save()
    ctx.globalCompositeOperation = "lighter"
    for (let i = 0; i < ghostCount; i++) {
      const t = 1 - i / ghostCount
      const gp = this.gridToPx(ghosts[i * 2] as number, ghosts[i * 2 + 1] as number)
      ctx.fillStyle = css(INK.pink, 0.16 * t * t)
      const s = cs * (0.5 + t * 0.85)
      ctx.fillRect(gp.x - s / 2, gp.y - s / 2, s, s)
    }
    ctx.restore()

    const sx = 1 + stretch * Math.abs(dx) - stretch * 0.5 * Math.abs(dy)
    const sy = 1 + stretch * Math.abs(dy) - stretch * 0.5 * Math.abs(dx)
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(Math.PI / 4)
    ctx.scale(sx, sy)
    const r = cs * 1.15
    if (invuln > 0 && Math.floor(time * 14) % 2 === 0) ctx.globalAlpha = 0.35
    ctx.fillStyle = css(INK.pink, 0.5)
    ctx.fillRect(-r * 1.5, -r * 1.5, r * 3, r * 3)
    ctx.fillStyle = css(INK.bone)
    ctx.fillRect(-r, -r, r * 2, r * 2)
    ctx.fillStyle = css(INK.paper)
    ctx.fillRect(-r * 0.34, -r * 0.34, r * 0.68, r * 0.68)
    ctx.restore()
  }

  drawHunter(h: Hunter, time: number, playerPx: { x: number; y: number }): void {
    const ctx = this.ctx
    const cs = this.cs
    const p = this.gridToPx(h.x, h.y)
    const scale = 0.35 + 0.65 * h.born

    if (h.kind === "charger" && h.mode === "aim") {
      // Telegraph. You get a full second and a beam; being hit is a decision.
      const a = Math.atan2(h.aimY - h.y, h.aimX - h.x)
      const len = Math.hypot(playerPx.x - p.x, playerPx.y - p.y) + cs * 6
      ctx.save()
      ctx.globalCompositeOperation = "lighter"
      ctx.translate(p.x, p.y)
      ctx.rotate(a)
      const pulse = 0.35 + Math.abs(Math.sin(time * 12)) * 0.5
      ctx.fillStyle = css(INK.red, 0.1 + pulse * 0.2)
      ctx.fillRect(0, -cs * 0.5, len, cs)
      ctx.fillStyle = css(INK.red, 0.55 * pulse)
      ctx.fillRect(0, -cs * 0.12, len, cs * 0.24)
      ctx.restore()
    }

    if (h.kind === "crawler") {
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(Math.atan2(h.fy, h.fx))
      ctx.scale(scale, scale)
      const r = cs * 1.25
      ctx.globalCompositeOperation = "lighter"
      ctx.fillStyle = css(INK.red, 0.3)
      ctx.fillRect(-r * 1.8, -r * 1.8, r * 3.6, r * 3.6)
      ctx.globalCompositeOperation = "source-over"
      ctx.fillStyle = css(INK.bone)
      ctx.fillRect(-r, -r, r * 2, r * 2)
      ctx.fillStyle = css(INK.red)
      ctx.beginPath()
      ctx.moveTo(r * 0.85, 0)
      ctx.lineTo(-r * 0.15, -r * 0.72)
      ctx.lineTo(-r * 0.15, r * 0.72)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
      return
    }

    // Drifter / charger: a spiked star whose points breathe. Erratic on
    // purpose — you should never be able to predict it exactly.
    const spikes = h.kind === "charger" ? 5 : 7
    const base = cs * (h.kind === "charger" ? 1.85 : 1.5) * scale
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(h.phase * (h.spin > 0 ? 0.5 : -0.5))
    ctx.globalCompositeOperation = "lighter"
    ctx.fillStyle = css(INK.red, h.mode === "dash" ? 0.5 : 0.26)
    ctx.beginPath()
    ctx.arc(0, 0, base * 1.9, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalCompositeOperation = "source-over"
    ctx.beginPath()
    for (let i = 0; i < spikes * 2; i++) {
      const ang = (i / (spikes * 2)) * Math.PI * 2
      const wob = 1 + Math.sin(h.phase * 1.7 + i * 1.9) * 0.26
      const rad = i % 2 === 0 ? base * wob : base * 0.42
      const px = Math.cos(ang) * rad
      const py = Math.sin(ang) * rad
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fillStyle = css(INK.bone)
    ctx.fill()
    ctx.fillStyle = css(h.mode === "dash" ? INK.yellow : INK.red)
    ctx.beginPath()
    ctx.arc(0, 0, base * 0.36, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  drawStick(stick: { on: boolean; x: number; y: number; dx: number; dy: number }): void {
    if (!stick.on) return
    const ctx = this.ctx
    ctx.save()
    ctx.strokeStyle = "rgba(255,255,255,0.16)"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(stick.x, stick.y, 42, 0, Math.PI * 2)
    ctx.stroke()
    const len = Math.hypot(stick.dx, stick.dy)
    const k = len > 0 ? Math.min(42, len) / len : 0
    ctx.fillStyle = "rgba(255,255,255,0.3)"
    const hx = stick.x + stick.dx * k
    const hy = stick.y + stick.dy * k
    ctx.fillRect(hx - 9, hy - 9, 18, 18)
    ctx.restore()
  }

  drawParticles(p: Particles): void {
    p.draw(this.ctx)
  }

  /** A revive-gate answer plate. Big enough to hit at speed with a thumb. */
  drawPlate(gx: number, gy: number, label: string, pop: number, time: number): void {
    const ctx = this.ctx
    const cs = this.cs
    const p = this.gridToPx(gx, gy)
    const k = 0.35 + 0.65 * pop
    const bob = Math.sin(time * 2.4 + gx * 0.4) * cs * 0.5
    const w = cs * 8.4 * k
    const h = cs * 5.4 * k
    ctx.save()
    ctx.translate(p.x, p.y + bob)
    ctx.globalCompositeOperation = "lighter"
    ctx.fillStyle = css(INK.yellow, 0.16)
    ctx.fillRect(-w * 0.62, -h * 0.72, w * 1.24, h * 1.44)
    ctx.globalCompositeOperation = "source-over"
    ctx.fillStyle = css(INK.paper)
    ctx.fillRect(-w / 2, -h / 2, w, h)
    ctx.strokeStyle = css(INK.yellow)
    ctx.lineWidth = Math.max(2, cs * 0.34)
    ctx.strokeRect(-w / 2, -h / 2, w, h)
    ctx.fillStyle = css(INK.bone)
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.font = `900 ${Math.round(h * 0.62)}px "Avenir Next Condensed", "Futura", ui-sans-serif, system-ui, sans-serif`
    ctx.fillText(label, 0, h * 0.03)
    ctx.restore()
  }

  /**
   * The live size of the cut you are drawing, pinned to the head. Early levels
   * only — after that the ghost region is all you get, and you estimate.
   * `over` is drawn in the danger ink AND with a slash, never colour alone.
   */
  drawPredict(gx: number, gy: number, text: string, over: boolean): void {
    const ctx = this.ctx
    const cs = this.cs
    const p = this.gridToPx(gx, gy)
    const label = over ? `${text} ✕` : text
    ctx.save()
    ctx.translate(p.x, p.y - cs * 3.4)
    ctx.font = `900 ${Math.max(13, Math.round(cs * 1.9))}px "Avenir Next Condensed", "Futura", ui-sans-serif, system-ui, sans-serif`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    const wdt = ctx.measureText(label).width + cs * 1.4
    const hgt = Math.max(16, cs * 2.6)
    ctx.fillStyle = "rgba(6,6,10,0.82)"
    ctx.fillRect(-wdt / 2, -hgt / 2, wdt, hgt)
    ctx.strokeStyle = css(over ? INK.red : INK.bone, 0.8)
    ctx.lineWidth = 2
    ctx.strokeRect(-wdt / 2, -hgt / 2, wdt, hgt)
    ctx.fillStyle = css(over ? INK.red : INK.bone)
    ctx.fillText(label, 0, 1)
    ctx.restore()
  }

  /** The gate's clock: a ring that closes. Never a number counting down. */
  drawGateRing(t: number): void {
    const ctx = this.ctx
    const r = Math.min(this.w, this.h) * 0.42
    ctx.save()
    ctx.translate(this.w / 2, this.h / 2)
    ctx.strokeStyle = css(INK.yellow, 0.32)
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, t))
    ctx.stroke()
    ctx.restore()
  }

  /** Level one, before the first move: a chevron pointing at the open plane. */
  drawHint(gx: number, gy: number, time: number): void {
    const ctx = this.ctx
    const cs = this.cs
    const inX = gx < this.g.w / 2 ? 1 : -1
    const inY = gy < this.g.h / 2 ? 1 : -1
    // Point along whichever axis actually leads inward from the rail.
    const onTopBottom = gy < 1.5 || gy > this.g.h - 1.5
    const ax = onTopBottom ? 0 : inX
    const ay = onTopBottom ? inY : 0
    const p = this.gridToPx(gx, gy)
    const pulse = (time * 1.6) % 1
    ctx.save()
    ctx.translate(p.x + ax * cs * (3 + pulse * 5), p.y + ay * cs * (3 + pulse * 5))
    ctx.rotate(Math.atan2(ay, ax))
    ctx.globalAlpha = 0.75 * (1 - pulse)
    ctx.fillStyle = css(INK.bone)
    ctx.beginPath()
    ctx.moveTo(cs * 2.2, 0)
    ctx.lineTo(-cs * 1.1, -cs * 1.9)
    ctx.lineTo(-cs * 0.2, 0)
    ctx.lineTo(-cs * 1.1, cs * 1.9)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  end(cam: Camera): void {
    const ctx = this.ctx
    ctx.restore()
    if (cam.flash > 0.001) {
      ctx.globalAlpha = cam.flash
      ctx.fillStyle = cam.flashStyle
      ctx.fillRect(0, 0, this.w, this.h)
      ctx.globalAlpha = 1
    }
  }
}
