/**
 * Sky, weather and the three ridge layers.
 *
 * Everything expensive is pre-rendered once per resize into an offscreen canvas:
 * the whole backdrop costs four drawImage calls and three fills per frame, no
 * gradients, no shadows. Parallax is applied in screen space so the ridges keep
 * their silhouette no matter how far the camera zooms.
 */

import { clamp01 } from '../core/ease.ts'
import { makeRng, type Rng } from '../core/rng.ts'
import { C } from './theme.ts'

type Layer = { pts: number[]; scale: number; fill: string; parallax: number; base: number }

export class Backdrop {
  private sky: HTMLCanvasElement | null = null
  private cloud: HTMLCanvasElement | null = null
  private sun: HTMLCanvasElement | null = null
  private w = 0
  private h = 0
  private layers: Layer[] = []
  private drops: Float32Array = new Float32Array(0)
  private nDrops = 0
  private bolt: Array<{ x: number; y: number }> = []
  private boltT = 999
  private starSeed = 1

  constructor(seed: number) {
    const rng = makeRng(seed)
    this.starSeed = seed
    this.layers = [
      this.makeRidge(rng, 0.16, C.ridgeFar, 0.055, 0.5),
      this.makeRidge(rng, 0.26, C.ridgeMid, 0.14, 0.58),
      this.makeRidge(rng, 0.42, C.ridgeNear, 0.3, 0.68),
    ]
  }

  /**
   * Mountains, not a bar chart. Three octaves of smooth wave plus a little noise;
   * the occasional broad shoulder rather than a needle.
   */
  private makeRidge(rng: Rng, amp: number, fill: string, parallax: number, base: number): Layer {
    const n = 64
    const p1 = rng.range(0, 6.28)
    const p2 = rng.range(0, 6.28)
    const p3 = rng.range(0, 6.28)
    const pts: number[] = []
    for (let i = 0; i <= n; i++) {
      const u = (i / n) * Math.PI * 2
      const v =
        0.46 +
        0.26 * Math.sin(u * 1 + p1) +
        0.16 * Math.sin(u * 2.3 + p2) +
        0.09 * Math.sin(u * 4.7 + p3) +
        rng.range(-0.04, 0.04)
      pts.push(clamp01(v))
    }
    pts[n] = pts[0] // seamless tile
    return { pts, scale: amp, fill, parallax, base }
  }

  resize(w: number, h: number, dpr: number): void {
    this.w = w
    this.h = h
    const sky = document.createElement('canvas')
    sky.width = Math.max(2, Math.ceil(w * 0.25))
    sky.height = Math.max(2, Math.ceil(h))
    const sc = sky.getContext('2d')
    if (sc) {
      const g = sc.createLinearGradient(0, 0, 0, sky.height)
      for (const [p, col] of C.skyStops) g.addColorStop(p, col)
      sc.fillStyle = g
      sc.fillRect(0, 0, sky.width, sky.height)
      // stars in the upper third
      const rng = makeRng(this.starSeed ^ 0xa5a5)
      sc.globalAlpha = 0.6
      for (let i = 0; i < 90; i++) {
        const x = rng.next() * sky.width
        const y = rng.next() * sky.height * 0.4
        const a = rng.range(0.1, 0.7) * (1 - y / (sky.height * 0.4))
        sc.fillStyle = `rgba(200,220,255,${a.toFixed(3)})`
        sc.fillRect(x, y, 1, 1)
      }
      sc.globalAlpha = 1
    }
    this.sky = sky

    const cw = 512
    const ch = 256
    const cl = document.createElement('canvas')
    cl.width = cw
    cl.height = ch
    const cc = cl.getContext('2d')
    if (cc) {
      const rng = makeRng(this.starSeed ^ 0x1234)
      for (let i = 0; i < 26; i++) {
        const x = rng.next() * cw
        const y = rng.range(0.15, 0.9) * ch
        const r = rng.range(30, 120)
        const g = cc.createRadialGradient(x, y, 0, x, y, r)
        const a = rng.range(0.05, 0.16)
        g.addColorStop(0, `rgba(24,18,40,${a})`)
        g.addColorStop(1, 'rgba(24,18,40,0)')
        cc.fillStyle = g
        cc.beginPath()
        cc.ellipse(x, y, r, r * 0.42, 0, 0, Math.PI * 2)
        cc.fill()
      }
    }
    this.cloud = cl

    const sn = document.createElement('canvas')
    sn.width = 256
    sn.height = 96
    const snc = sn.getContext('2d')
    if (snc) {
      const g = snc.createRadialGradient(128, 84, 0, 128, 84, 120)
      g.addColorStop(0, 'rgba(255,190,120,0.55)')
      g.addColorStop(0.35, 'rgba(220,110,60,0.22)')
      g.addColorStop(1, 'rgba(120,40,40,0)')
      snc.fillStyle = g
      snc.fillRect(0, 0, 256, 96)
    }
    this.sun = sn

    const target = Math.min(240, Math.floor((w * h) / 5200))
    this.drops = new Float32Array(target * 4)
    this.nDrops = target
    const rng = makeRng(0xd00d)
    for (let i = 0; i < target; i++) {
      this.drops[i * 4] = rng.next() * w
      this.drops[i * 4 + 1] = rng.next() * h
      this.drops[i * 4 + 2] = rng.range(0.55, 1)
      this.drops[i * 4 + 3] = rng.range(0.4, 1)
    }
    void dpr
  }

  strike(rng: Rng): void {
    const x = rng.range(this.w * 0.15, this.w * 0.9)
    const pts: Array<{ x: number; y: number }> = [{ x, y: -10 }]
    let cx = x
    let cy = -10
    const end = this.h * 0.42
    while (cy < end) {
      cy += rng.range(18, 46)
      cx += rng.range(-34, 34)
      pts.push({ x: cx, y: cy })
    }
    this.bolt = pts
    this.boltT = 0
  }

  /**
   * @param camX camera world x, for parallax
   * @param horizonY screen y of the world ground line
   */
  draw(
    ctx: CanvasRenderingContext2D,
    t: number,
    camX: number,
    horizonY: number,
    windDir: number,
    rainAmt: number,
  ): void {
    const { w, h } = this
    // The gradient is anchored to the horizon, so the ember band always sits
    // exactly behind the ridge line however the camera is framed.
    const hy = Math.max(40, Math.min(h, horizonY))
    if (this.sky) ctx.drawImage(this.sky, 0, 0, w, hy)
    ctx.fillStyle = C.ground
    ctx.fillRect(0, hy - 1, w, h - hy + 1)
    // a slit of low sun burning through, additive and stationary-ish
    if (this.sun) {
      const sx = w * 0.72 - ((camX * 1.6) % (w * 0.2))
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      ctx.globalAlpha = 0.55
      const sw = w * 0.9
      ctx.drawImage(this.sun, sx - sw / 2, hy - sw * 0.24, sw, sw * 0.34)
      ctx.restore()
    }

    if (this.cloud) {
      ctx.globalAlpha = 0.85
      for (let i = 0; i < 3; i++) {
        const sp = 6 + i * 9
        const off = ((t * sp + camX * (0.02 + i * 0.02) * 8) % (w + 512)) - 512
        const y = h * (0.06 + i * 0.11)
        ctx.drawImage(this.cloud, -off, y, w + 512, h * 0.3)
        ctx.drawImage(this.cloud, -off + w + 512, y, w + 512, h * 0.3)
      }
      ctx.globalAlpha = 1
    }

    // lightning bolt (rate limited by the Flash budget at the call site)
    if (this.boltT < 0.22 && this.bolt.length > 1) {
      const a = 1 - this.boltT / 0.22
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      ctx.strokeStyle = `rgba(190,220,255,${(a * 0.75).toFixed(3)})`
      ctx.lineWidth = 2.4
      ctx.beginPath()
      ctx.moveTo(this.bolt[0].x, this.bolt[0].y)
      for (const p of this.bolt) ctx.lineTo(p.x, p.y)
      ctx.stroke()
      ctx.lineWidth = 6
      ctx.strokeStyle = `rgba(140,180,255,${(a * 0.18).toFixed(3)})`
      ctx.stroke()
      ctx.restore()
    }

    for (const L of this.layers) {
      const n = L.pts.length - 1
      const span = w * 1.7
      const off = -(((camX * L.parallax * 6) % span) + span) % span
      const baseY = hy + 1
      ctx.beginPath()
      ctx.moveTo(off - span - 4, baseY + 8)
      // two tiles, drawn with quadratics so ridges read as rock rather than teeth
      for (let tile = -1; tile <= 1; tile++) {
        for (let i = 0; i <= n; i++) {
          const x = off + tile * span + (i / n) * span
          const y = baseY - L.pts[i] * h * L.scale
          if (tile === -1 && i === 0) ctx.lineTo(x, y)
          else {
            const px = off + tile * span + ((i - 0.5) / n) * span
            const py = baseY - ((L.pts[i] + L.pts[Math.max(0, i - 1)]) / 2) * h * L.scale
            ctx.quadraticCurveTo(px, py, x, y)
          }
        }
      }
      ctx.lineTo(off + span * 2 + 4, baseY + 8)
      ctx.closePath()
      ctx.fillStyle = L.fill
      ctx.fill()
    }

    if (rainAmt > 0.02 && this.nDrops) {
      ctx.save()
      ctx.strokeStyle = C.rain
      ctx.lineWidth = 1.1
      ctx.beginPath()
      const slant = windDir * 5 + 2.5
      for (let i = 0; i < this.nDrops; i++) {
        const sp = this.drops[i * 4 + 2]
        const y = (this.drops[i * 4 + 1] + t * 900 * sp) % h
        const x = (this.drops[i * 4] + y * slant * 0.14) % w
        const len = 9 + sp * 16
        ctx.moveTo(x, y)
        ctx.lineTo(x - slant * 0.9, y - len)
      }
      ctx.globalAlpha = clamp01(rainAmt)
      ctx.stroke()
      ctx.restore()
    }
  }

  update(dt: number): void {
    this.boltT += dt
  }
}
