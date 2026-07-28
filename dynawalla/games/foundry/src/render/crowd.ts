// The crowd — a bazaar at night with a ring dropped into the middle of it.
//
// Not people: lanterns. A field of hanging lamps at four depths, each one a
// household that came out to watch, and the only thing that changes about them
// is how hard they are burning. Heat rises on an escape and the whole hall
// brightens; a pinfall drops it and the lamps go back to embers.
//
// Deterministic from a seed, so the same match looks the same twice, and laid
// out once at resize rather than per frame.

import { Rng } from "../core/rng.ts"
import { CROWD_DIM, CROWD_LANTERN, LAPIS_DEEP, NIGHT, withAlpha } from "./palette.ts"

type Lantern = {
  x: number
  y: number
  r: number
  /** 0 = far, 1 = near the ring. Drives size and how much it reacts. */
  depth: number
  phase: number
  rate: number
}

export class Crowd {
  private lanterns: Lantern[] = []
  private w = 0
  private horizon = 0
  private t = 0

  /** Rebuild for a new viewport. Cheap enough to call on every resize. */
  layout(w: number, horizon: number, count: number, seed: number): void {
    this.w = w
    this.horizon = horizon
    const rng = new Rng(seed)
    const list: Lantern[] = []
    for (let i = 0; i < count; i++) {
      const depth = rng.next() ** 1.4
      // Lanterns crowd the horizon and thin out as they come forward, which is
      // what a hall full of people actually looks like from the ring.
      const y = horizon * (0.12 + depth * 0.86)
      const x = rng.range(-0.04, 1.04) * w
      list.push({
        x,
        y,
        r: 1.1 + depth * 3.4,
        depth,
        phase: rng.range(0, Math.PI * 2),
        rate: rng.range(0.4, 1.5),
      })
    }
    // Far first, so near lanterns overdraw.
    list.sort((a, b) => a.depth - b.depth)
    this.lanterns = list
  }

  step(dt: number): void {
    this.t += dt
  }

  /**
   * @param heat 0..1 — how loud the hall is
   * @param flare 0..1 — a momentary surge, spent by the caller over ~1s
   */
  draw(g: CanvasRenderingContext2D, heat: number, flare: number, glow: boolean): void {
    const h = Math.max(0, Math.min(1, heat))
    const f = Math.max(0, Math.min(1, flare))

    // The hall itself: night, with a warm wash rising off the crowd.
    const sky = g.createLinearGradient(0, 0, 0, this.horizon)
    sky.addColorStop(0, NIGHT)
    sky.addColorStop(0.55, LAPIS_DEEP)
    sky.addColorStop(1, withAlpha(CROWD_DIM, 0.5 + h * 0.35 + f * 0.25))
    g.fillStyle = sky
    g.fillRect(0, 0, this.w, this.horizon + 1)

    for (const l of this.lanterns) {
      const flicker = 0.72 + 0.28 * Math.sin(this.t * l.rate * 2.4 + l.phase)
      const lit = (0.16 + h * 0.66 + f * 0.5) * flicker * (0.45 + l.depth * 0.55)
      const a = Math.max(0, Math.min(1, lit))
      if (a < 0.02) continue
      g.fillStyle = withAlpha(CROWD_LANTERN, a)
      g.beginPath()
      g.arc(l.x, l.y, l.r, 0, Math.PI * 2)
      g.fill()
      if (!glow || a < 0.45 || l.depth < 0.5) continue
      const grad = g.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r * 6)
      grad.addColorStop(0, withAlpha(CROWD_LANTERN, a * 0.28))
      grad.addColorStop(1, withAlpha(CROWD_LANTERN, 0))
      g.fillStyle = grad
      g.beginPath()
      g.arc(l.x, l.y, l.r * 6, 0, Math.PI * 2)
      g.fill()
    }
  }
}
