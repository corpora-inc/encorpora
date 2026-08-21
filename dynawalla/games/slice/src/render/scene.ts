// The night market at the blue hour.
//
// Everything here is baked once into offscreen layers at resize and blitted per
// frame — the sky gradient, the two silhouette ridges, the stall canopies. The
// only per-frame work is the lamp flicker and the dust, which is a few dozen
// draws. A background must never be the reason a frame is late.

import { Rng } from "../core/rng.ts"
import { HAZE, LAMP, LAMP_HOT, SKY_LOW, SKY_MID, SKY_TOP, withAlpha } from "./palette.ts"

type Layer = { c: HTMLCanvasElement; g: CanvasRenderingContext2D }

function layer(w: number, h: number): Layer {
  const c = document.createElement("canvas")
  c.width = Math.max(1, Math.floor(w))
  c.height = Math.max(1, Math.floor(h))
  const g = c.getContext("2d")
  if (!g) throw new Error("slice: 2D context unavailable")
  return { c, g }
}

type Lamp = { x: number; y: number; r: number; phase: number; rate: number }

export class Scene {
  private sky: Layer | null = null
  private far: Layer | null = null
  private near: Layer | null = null
  private canopy: Layer | null = null
  private lamps: Lamp[] = []
  private dustX = new Float32Array(90)
  private dustY = new Float32Array(90)
  private dustV = new Float32Array(90)
  private dustR = new Float32Array(90)
  private w = 0
  private h = 0
  private t = 0

  build(w: number, h: number, parallaxLayers: number): void {
    this.w = w
    this.h = h
    const rng = new Rng(0xba2aa5)

    // ── sky ────────────────────────────────────────────────────────────────
    const sky = layer(w, h)
    const grad = sky.g.createLinearGradient(0, 0, 0, h)
    grad.addColorStop(0, SKY_TOP)
    grad.addColorStop(0.42, SKY_MID)
    grad.addColorStop(0.78, SKY_LOW)
    grad.addColorStop(1, HAZE)
    sky.g.fillStyle = grad
    sky.g.fillRect(0, 0, w, h)
    // A low warm glow where the market is, under the horizon line.
    const gl = sky.g.createRadialGradient(w * 0.5, h * 1.02, h * 0.05, w * 0.5, h * 1.02, h * 0.75)
    gl.addColorStop(0, "rgba(255,150,60,0.30)")
    gl.addColorStop(1, "rgba(255,150,60,0)")
    sky.g.fillStyle = gl
    sky.g.fillRect(0, 0, w, h)
    // Stars, thinning toward the horizon.
    for (let i = 0; i < 170; i++) {
      const x = rng.next() * w
      const y = Math.pow(rng.next(), 1.7) * h * 0.62
      const a = 0.16 + rng.next() * 0.5 * (1 - y / (h * 0.62))
      sky.g.fillStyle = `rgba(255,244,220,${a.toFixed(3)})`
      const s = rng.next() < 0.9 ? 1 : 2
      sky.g.fillRect(x, y, s, s)
    }
    this.sky = sky

    // ── silhouette ridges: domes, minarets, awning-poles ───────────────────
    const ridge = (yBase: number, scale: number, color: string, seed: number): Layer => {
      const L = layer(w, h)
      const r = new Rng(seed)
      L.g.fillStyle = color
      L.g.beginPath()
      L.g.moveTo(0, h)
      let x = -20
      L.g.lineTo(x, yBase)
      while (x < w + 40) {
        const kind = r.next()
        const bw = (40 + r.next() * 110) * scale
        if (kind < 0.26) {
          // a dome
          const top = yBase - (26 + r.next() * 44) * scale
          L.g.lineTo(x, yBase - 6 * scale)
          L.g.quadraticCurveTo(x + bw / 2, top - 26 * scale, x + bw, yBase - 6 * scale)
        } else if (kind < 0.38) {
          // a minaret: thin, tall, with a finial
          const tw = 11 * scale
          const top = yBase - (90 + r.next() * 120) * scale
          L.g.lineTo(x, yBase)
          L.g.lineTo(x, top + 14 * scale)
          L.g.quadraticCurveTo(x + tw / 2, top - 16 * scale, x + tw, top + 14 * scale)
          L.g.lineTo(x + tw, yBase)
          x += tw + 6 * scale
          continue
        } else {
          // a flat roof with a parapet notch
          const top = yBase - (14 + r.next() * 58) * scale
          L.g.lineTo(x, top)
          L.g.lineTo(x + bw * 0.5, top)
          L.g.lineTo(x + bw * 0.5, top - 7 * scale)
          L.g.lineTo(x + bw, top - 7 * scale)
          L.g.lineTo(x + bw, yBase - 2 * scale)
        }
        x += bw
      }
      L.g.lineTo(w + 40, h)
      L.g.closePath()
      L.g.fill()
      return L
    }

    this.far = parallaxLayers >= 2 ? ridge(h * 0.70, 0.8, "rgba(18,10,38,0.85)", 0x1111) : null
    this.near = parallaxLayers >= 1 ? ridge(h * 0.80, 1.05, "rgba(9,5,22,0.95)", 0x2222) : null

    // ── canopies at the bottom: scalloped stall awnings ────────────────────
    const can = layer(w, h * 0.22)
    const ch = can.c.height
    can.g.fillStyle = "rgba(6,3,16,0.96)"
    can.g.beginPath()
    can.g.moveTo(0, ch)
    can.g.lineTo(0, ch * 0.52)
    const scal = 46
    for (let x = 0; x < w + scal; x += scal) {
      can.g.quadraticCurveTo(x + scal * 0.5, ch * 0.52 + 17, x + scal, ch * 0.52)
    }
    can.g.lineTo(w, ch)
    can.g.closePath()
    can.g.fill()
    this.canopy = can

    // ── lamps on wires ─────────────────────────────────────────────────────
    // Two strands, high and sparse. An earlier pass hung three dense strands
    // with a 96px glow radius and turned the top third of the screen into a
    // wall of blobs — a numeral crossing it was unreadable, which is the exact
    // failure mode "never let ornament eat legibility" names.
    this.lamps.length = 0
    const strands = parallaxLayers >= 2 ? 2 : 1
    for (let s = 0; s < strands; s++) {
      const y0 = h * (0.052 + s * 0.062)
      const sag = 20 + s * 12
      const count = Math.max(4, Math.round(w / 168))
      for (let i = 0; i <= count; i++) {
        const t = i / count
        const x = t * w
        const y = y0 + Math.sin(t * Math.PI) * sag
        this.lamps.push({
          x,
          y,
          r: 3.4 + rng.next() * 2.2,
          phase: rng.next() * Math.PI * 2,
          rate: 0.5 + rng.next() * 1.6,
        })
      }
    }

    for (let i = 0; i < this.dustX.length; i++) {
      this.dustX[i] = rng.next() * w
      this.dustY[i] = rng.next() * h
      this.dustV[i] = 6 + rng.next() * 22
      this.dustR[i] = 0.6 + rng.next() * 1.9
    }
  }

  update(dt: number): void {
    this.t += dt
    for (let i = 0; i < this.dustX.length; i++) {
      let y = (this.dustY[i] as number) - (this.dustV[i] as number) * dt
      let x = (this.dustX[i] as number) + Math.sin(this.t * 0.5 + i) * 4 * dt
      if (y < -8) {
        y = this.h + 8
        x = Math.random() * this.w
      }
      this.dustY[i] = y
      this.dustX[i] = x
    }
  }

  /** `warm` 0..1 pushes the whole market hotter as the run escalates. */
  draw(g: CanvasRenderingContext2D, warm: number, parallaxX: number, parallaxY: number): void {
    if (this.sky) g.drawImage(this.sky.c, 0, 0)

    if (this.far) g.drawImage(this.far.c, parallaxX * 0.35, parallaxY * 0.2)
    if (this.near) g.drawImage(this.near.c, parallaxX * 0.7, parallaxY * 0.4)

    // Wires and lamps.
    g.strokeStyle = "rgba(0,0,0,0.55)"
    g.lineWidth = 1.4
    for (let i = 1; i < this.lamps.length; i++) {
      const a = this.lamps[i - 1] as Lamp
      const b = this.lamps[i] as Lamp
      // A wrap back to the left edge means a new strand: do not join them.
      if (b.x < a.x) continue
      g.beginPath()
      g.moveTo(a.x, a.y)
      g.lineTo(b.x, b.y)
      g.stroke()
    }

    const prev = g.globalCompositeOperation
    g.globalCompositeOperation = "lighter"
    for (const l of this.lamps) {
      const flick = 0.78 + Math.sin(this.t * l.rate + l.phase) * 0.12 + Math.sin(this.t * 7.3 + l.phase) * 0.05
      const rr = l.r * (1.9 + warm * 0.9) * flick
      const grad = g.createRadialGradient(l.x, l.y, 0, l.x, l.y, rr * 2.2)
      grad.addColorStop(0, withAlpha(LAMP_HOT, 0.42 * flick))
      grad.addColorStop(0.3, withAlpha(LAMP, 0.19 * flick))
      grad.addColorStop(1, "rgba(0,0,0,0)")
      g.fillStyle = grad
      g.beginPath()
      g.arc(l.x, l.y, rr * 2.2, 0, Math.PI * 2)
      g.fill()
    }
    // Dust in the lamp light.
    for (let i = 0; i < this.dustX.length; i++) {
      g.fillStyle = `rgba(255,215,150,${(0.05 + (this.dustR[i] as number) * 0.05).toFixed(3)})`
      g.beginPath()
      g.arc(this.dustX[i] as number, this.dustY[i] as number, this.dustR[i] as number, 0, Math.PI * 2)
      g.fill()
    }
    g.globalCompositeOperation = prev

    for (const l of this.lamps) {
      g.fillStyle = LAMP_HOT
      g.beginPath()
      g.arc(l.x, l.y, l.r * 0.42, 0, Math.PI * 2)
      g.fill()
    }
  }

  /** Foreground canopies, drawn after gameplay so objects pass behind them. */
  drawForeground(g: CanvasRenderingContext2D, parallaxX: number): void {
    if (!this.canopy) return
    g.drawImage(this.canopy.c, parallaxX * 1.1, this.h - this.canopy.c.height + 2)
  }
}
