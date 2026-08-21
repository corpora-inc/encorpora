/**
 * Camera: world metres -> screen pixels, plus the three things that make an impact
 * feel like an impact — trauma shake (decaying, squared), zoom punch (elastic), and
 * a lead that pans ahead of the shot instead of chasing it.
 */

import { approach, clamp, easeOutElastic, noise1 } from './ease.ts'

export type Viewport = { w: number; h: number }

export class Camera {
  /** world-space centre */
  x = 50
  y = 22
  /** pixels per metre */
  ppm = 9
  /** where the camera wants to be; the real one eases toward it */
  wantX = 50
  wantY = 22
  wantPpm = 9

  /** 0..1, decays; shake magnitude is trauma^2 (Nijman) so small hits stay small */
  trauma = 0
  private shakeT = 0
  private punchT = 999
  private punchAmount = 0
  private rollT = 0

  /** motion scaling for prefers-reduced-motion; 0 disables shake and punch */
  motion = 1

  /** hard ceilings so a chain of impacts cannot stack into a seizure risk */
  static readonly MAX_SHAKE_PX = 26
  static readonly MAX_ROLL_RAD = 0.028

  snap(): void {
    this.x = this.wantX
    this.y = this.wantY
    this.ppm = this.wantPpm
  }

  addTrauma(amount: number): void {
    this.trauma = clamp(this.trauma + amount * this.motion, 0, 1)
  }

  punch(amount: number): void {
    this.punchAmount = amount * this.motion
    this.punchT = 0
  }

  /**
   * Frame a set of world points, and put the ground line at a fixed fraction of
   * the screen height so the composition never drifts: sky above, a sliver of
   * earth below, the siege on the line between them.
   */
  frame(
    pts: Array<{ x: number; y: number }>,
    vp: Viewport,
    opts: { minSpanX: number; padPx: number; padTopPx?: number; groundFrac?: number },
  ): void {
    let minX = Infinity
    let maxX = -Infinity
    let maxY = 12
    for (const p of pts) {
      if (p.x < minX) minX = p.x
      if (p.x > maxX) maxX = p.x
      if (p.y > maxY) maxY = p.y
    }
    if (!Number.isFinite(minX)) return
    const gf = opts.groundFrac ?? 0.8
    const spanX = Math.max(maxX - minX, opts.minSpanX)
    const usableW = Math.max(80, vp.w - opts.padPx * 2)
    // The tallest point must sit under the top pad given the ground is pinned at gf.
    const headroom = Math.max(60, gf * vp.h - (opts.padTopPx ?? opts.padPx))
    this.wantPpm = Math.min(usableW / spanX, headroom / Math.max(8, maxY))
    this.wantX = (minX + maxX) / 2
    this.wantY = (gf - 0.5) * (vp.h / this.wantPpm)
  }

  update(dt: number): void {
    // Pan/zoom are exponential approaches: no overshoot, frame-rate independent.
    this.x = approach(this.x, this.wantX, 7.5, dt)
    this.y = approach(this.y, this.wantY, 7.5, dt)
    this.ppm = approach(this.ppm, this.wantPpm, 6.0, dt)
    this.shakeT += dt
    this.rollT += dt
    // decay ~ 1.9/s: a big hit rings for about half a second
    this.trauma = Math.max(0, this.trauma - 1.9 * dt)
    if (this.punchT < 1) this.punchT += dt / 0.55
  }

  /** Effective zoom including the elastic punch. */
  get zoom(): number {
    if (this.punchT >= 1) return 1
    // easeOutElastic settles back to 1 with two visible ring-outs
    return 1 + this.punchAmount * (1 - easeOutElastic(this.punchT))
  }

  get shakeX(): number {
    const s = this.trauma * this.trauma
    return noise1(this.shakeT * 34, 1) * Camera.MAX_SHAKE_PX * s
  }

  get shakeY(): number {
    const s = this.trauma * this.trauma
    return noise1(this.shakeT * 31, 2) * Camera.MAX_SHAKE_PX * s * 0.72
  }

  get roll(): number {
    const s = this.trauma * this.trauma
    return noise1(this.rollT * 19, 3) * Camera.MAX_ROLL_RAD * s
  }

  /** Apply the view transform. Caller must ctx.save() first. */
  applyTransform(ctx: CanvasRenderingContext2D, vp: Viewport): void {
    ctx.translate(vp.w / 2 + this.shakeX, vp.h / 2 + this.shakeY)
    if (this.roll !== 0) ctx.rotate(this.roll)
    const s = this.ppm * this.zoom
    ctx.scale(s, -s)
    ctx.translate(-this.x, -this.y)
  }

  /** World -> unshaken screen pixel (for HUD anchors). */
  toScreen(wx: number, wy: number, vp: Viewport): { x: number; y: number } {
    const s = this.ppm * this.zoom
    return {
      x: vp.w / 2 + this.shakeX + (wx - this.x) * s,
      y: vp.h / 2 + this.shakeY - (wy - this.y) * s,
    }
  }
}
