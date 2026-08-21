/**
 * Seven layers, and the lag between them is what makes the world feel deep and
 * heavy rather than like a set of sliding planes.
 *
 *   L0 sky + haze band        0.00
 *   L1 far skyline            0.08
 *   L2 mid roofline           0.22
 *   L3 canopy, lanterns       0.55
 *   L4 stall facades          1.00   (DOM)
 *   L5 street floor           1.00
 *   L6 foreground traffic     1.35
 *
 * Projection is anchored on the centre of the viewport, so a landmark placed at
 * a ward gate arrives at the centre of the screen exactly when you arrive at
 * the gate — however slowly it approached.
 *
 *   screenX = (worldX − camCentre) · p + viewW/2
 *
 * Each distant layer follows the scroll through a **critically damped** spring
 * (ζ = 1.0). 60–120 ms of lag reads as weight. It never bounces and it never
 * rubber-bands — an overshoot would read as elastic, and stone is not.
 *
 * Reduced motion turns parallax **off entirely**: it is a vestibular trigger,
 * not a decoration (BZ-13).
 */

export type LayerName = "sky" | "far" | "mid" | "canopy" | "street" | "fore";

export const PARALLAX: Record<LayerName, number> = {
  sky: 0,
  far: 0.08,
  mid: 0.22,
  canopy: 0.55,
  street: 1,
  fore: 1.35,
};

interface Spring {
  x: number;
  v: number;
  omega: number;
  seeded: boolean;
}

export class ParallaxRig {
  private springs: Record<string, Spring> = {
    far: { x: 0, v: 0, omega: 14, seeded: false },
    mid: { x: 0, v: 0, omega: 14, seeded: false },
    canopy: { x: 0, v: 0, omega: 22, seeded: false },
  };
  private reduced = false;
  private viewW = 0;

  setReduced(v: boolean): void {
    this.reduced = v;
  }

  setViewW(w: number): void {
    this.viewW = w;
  }

  /** `dt` in seconds, `camCentre` the world x at the centre of the viewport. */
  update(camCentre: number, dt: number): void {
    const step = Math.min(dt, 1 / 20);
    for (const k of Object.keys(this.springs)) {
      const s = this.springs[k]!;
      if (!s.seeded) {
        s.x = camCentre;
        s.seeded = true;
      }
      if (this.reduced) {
        s.x = camCentre;
        s.v = 0;
        continue;
      }
      const w = s.omega;
      const a = -w * w * (s.x - camCentre) - 2 * w * s.v;
      s.v += a * step;
      s.x += s.v * step;
      if (!Number.isFinite(s.x)) {
        s.x = camCentre;
        s.v = 0;
      }
    }
  }

  /** A projector for one layer: world x → screen x. */
  projector(layer: LayerName, camCentre: number): (worldX: number) => number {
    const p = PARALLAX[layer];
    const s = this.springs[layer];
    const c = this.reduced || !s ? camCentre : s.x;
    const half = this.viewW / 2;
    return (worldX: number) => (worldX - c) * p + half;
  }

  /** The inverse, for deciding what to generate. */
  unproject(layer: LayerName, camCentre: number, screenX: number): number {
    const p = PARALLAX[layer];
    const s = this.springs[layer];
    const c = this.reduced || !s ? camCentre : s.x;
    if (p === 0) return c;
    return (screenX - this.viewW / 2) / p + c;
  }
}
