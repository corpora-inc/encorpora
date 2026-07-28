// The canvas remembers.
//
// This is the design canon's "canvas glow-decal cooling", and it is the one
// piece of persistent state on the mat. Every kick-out scorches the spot the
// bar was on, at white heat; every refused total leaves a cold oxide smear. A
// scorch does not vanish — it *cools*, through the heat ramp in `palette.ts`,
// over about twelve seconds, and then stays as a dark bruise until the tier's
// decal budget pushes it off the bottom.
//
// It costs almost nothing and it does more than any particle: a child glancing
// at the mat can see the shape of the last minute of their own match.

import { heatColor, withAlpha } from "./palette.ts"

export type DecalKind = "scorch" | "refusal" | "slap"

type Decal = {
  kind: DecalKind
  x: number
  y: number
  r: number
  /** 1 → just poured, 0 → cold. Falls at a fixed rate; never resets. */
  heat: number
  /** Cold decals keep a bruise this dark. */
  stain: number
  rot: number
}

/** Seconds from white heat to cold. */
const COOL_S = 12

export class Decals {
  private list: Decal[] = []

  /** A kick-out. The hottest mark on the mat and the only white one. */
  scorch(x: number, y: number, r: number, cap: number): void {
    this.push({ kind: "scorch", x, y, r, heat: 1, stain: 0.34, rot: 0 }, cap)
  }

  /** A refused total. Never hot: failure does not glow. */
  refusal(x: number, y: number, r: number, cap: number): void {
    this.push({ kind: "refusal", x, y, r, heat: 0, stain: 0.3, rot: 0 }, cap)
  }

  /** The referee's palm. Three of these stack up under a body. */
  slap(x: number, y: number, r: number, rot: number, cap: number): void {
    this.push({ kind: "slap", x, y, r, heat: 0.22, stain: 0.24, rot }, cap)
  }

  private push(d: Decal, cap: number): void {
    this.list.push(d)
    const limit = Math.max(2, cap)
    while (this.list.length > limit) this.list.shift()
  }

  step(dt: number): void {
    for (const d of this.list) d.heat = Math.max(0, d.heat - dt / COOL_S)
  }

  /** Drawn under everything on the mat, so bodies and rope shadows sit on top. */
  draw(g: CanvasRenderingContext2D, glow: boolean): void {
    g.save()
    for (const d of this.list) {
      if (d.kind === "slap") {
        g.save()
        g.translate(d.x, d.y)
        g.rotate(d.rot)
        g.fillStyle = withAlpha("#4a4234", d.stain * (0.5 + d.heat))
        // A palm: four fingers and a heel, not an ellipse. It has to read as a
        // hand at a glance or the three-count is just three smudges.
        for (let i = 0; i < 4; i++) {
          const fx = (i - 1.5) * d.r * 0.42
          g.beginPath()
          g.ellipse(fx, -d.r * 0.55, d.r * 0.15, d.r * 0.42, 0, 0, Math.PI * 2)
          g.fill()
        }
        g.beginPath()
        g.ellipse(0, d.r * 0.2, d.r * 0.62, d.r * 0.44, 0, 0, Math.PI * 2)
        g.fill()
        g.restore()
        continue
      }

      if (d.kind === "refusal") {
        g.strokeStyle = withAlpha("#8c3a24", d.stain)
        g.lineWidth = Math.max(2, d.r * 0.16)
        g.lineCap = "round"
        // A struck-through mark. The referee's wave-off, printed on the mat.
        g.beginPath()
        g.moveTo(d.x - d.r * 0.8, d.y - d.r * 0.5)
        g.lineTo(d.x + d.r * 0.8, d.y + d.r * 0.5)
        g.stroke()
        continue
      }

      // A scorch. Dark ring, hot core while there is any heat left in it.
      g.fillStyle = withAlpha("#241d16", d.stain)
      g.beginPath()
      g.ellipse(d.x, d.y, d.r, d.r * 0.62, 0, 0, Math.PI * 2)
      g.fill()
      if (d.heat <= 0.001) continue
      const c = heatColor(d.heat)
      g.fillStyle = withAlpha(c, 0.28 + d.heat * 0.55)
      g.beginPath()
      g.ellipse(d.x, d.y, d.r * (0.34 + d.heat * 0.4), d.r * (0.2 + d.heat * 0.26), 0, 0, Math.PI * 2)
      g.fill()
      if (!glow) continue
      const grad = g.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r * 1.7)
      grad.addColorStop(0, withAlpha(c, 0.3 * d.heat))
      grad.addColorStop(1, withAlpha(c, 0))
      g.fillStyle = grad
      g.beginPath()
      g.ellipse(d.x, d.y, d.r * 1.7, d.r * 1.1, 0, 0, Math.PI * 2)
      g.fill()
    }
    g.restore()
  }

  /** How warm the mat is overall, 0..1. The crowd bed rides on this. */
  warmth(): number {
    let sum = 0
    for (const d of this.list) sum += d.heat
    return Math.min(1, sum / 4)
  }

  clear(): void {
    this.list.length = 0
  }
}
