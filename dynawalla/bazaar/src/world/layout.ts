/**
 * The modular grid. One module `M` is the stall pitch, and everything derives
 * from it, so nothing in the bazaar needs a judgement call about size.
 *
 * BZ-LAW-10 — a stall may never fill the viewport edge to edge. The moment it
 * does, the street stops existing and you are back to a card. There is always
 * a slice of each neighbour.
 */

import { clamp, lerp } from "../util/rng.ts";

export interface Layout {
  w: number;
  h: number;
  dpr: number;
  /** The stall pitch. */
  M: number;
  skyH: number;
  canopyH: number;
  stallTop: number;
  stallH: number;
  floorY: number;
  floorH: number;
  /** Horizon: where the far skyline stands. */
  horizonY: number;
  apertureW: number;
  apertureH: number;
  jamb: number;
  sillDepth: number;
  signH: number;
  awningDrop: number;
  hoodH: number;
  small: boolean;
}

export function layout(w: number, h: number, dpr: number): Layout {
  // Bands. The canopy compresses first, and the driver is the ASPECT, not the
  // raw height: a tall phone needs a tall stall band to keep the aperture at
  // 44 % of the viewport, and a landscape tablet does not have that problem —
  // there the 4:3 aperture shape governs instead (§2.6, §4.5).
  const t = clamp((w / h - 0.6) / 0.7, 0, 1);
  const skyF = lerp(0.08, 0.2, t);
  const canopyF = lerp(0.06, 0.12, t);
  const stallF = lerp(0.76, 0.58, t);
  const floorF = lerp(0.1, 0.1, t);

  const skyH = h * skyF;
  const canopyH = h * canopyF;
  const stallH = h * stallF;
  const floorH = h * floorF;
  const stallTop = skyH + canopyH;
  const floorY = stallTop + stallH;

  // BZ-LAW-10: never edge to edge. On anything wider than a phone the street
  // shows three stalls and two slices, which is what makes it a street.
  const wideCap = w > 700 ? w / 2.4 : w * 0.82;
  const M = clamp(stallH / 1.35, 180, Math.min(w * 0.82, wideCap));

  // The fixed vertical stack above and below the aperture is 0.66·M:
  // hood 0.15 + band 0.05 + awning 0.11 + sign 0.15 + sill 0.20.
  const apertureW = M * 0.82;
  const apertureH = Math.max(M * 0.42, stallH - M * 0.66);

  return {
    w,
    h,
    dpr,
    M,
    skyH,
    canopyH,
    stallTop,
    stallH,
    floorY,
    floorH,
    horizonY: stallTop + stallH * 0.06,
    apertureW,
    apertureH,
    jamb: M * 0.045,
    sillDepth: M * 0.11,
    signH: M * 0.14,
    awningDrop: M * 0.18,
    hoodH: M * 0.16,
    small: w < 420,
  };
}

/**
 * Street curvature. A very slight vertical arc so the far end of the street
 * falls away rather than terminating. At 2,000 px away that is 44 px of drop —
 * enough to feel like the world bends, far too little to notice as an effect.
 */
export const CURVE_K = 1.1e-5;

export const curve = (dx: number): number => -CURVE_K * dx * dx;
