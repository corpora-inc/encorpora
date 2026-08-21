import { HALF_W } from "../game/constants.ts";

export type Fit = {
  /** css pixels per world unit */
  scale: number;
  /** half the visible frustum, in world units */
  halfWv: number;
  halfHv: number;
};

/** Fit the 100-unit-wide playfield into the canvas, letterboxing the remainder. */
export function fit(cssW: number, cssH: number, halfH: number): Fit {
  const scale = Math.min(cssW / (2 * HALF_W), cssH / (2 * halfH));
  return { scale, halfWv: cssW / (2 * scale), halfHv: cssH / (2 * scale) };
}

export function toWorldX(cssX: number, cssW: number, f: Fit): number {
  return (cssX - cssW / 2) / f.scale;
}

export function toWorldY(cssY: number, cssH: number, f: Fit): number {
  return -(cssY - cssH / 2) / f.scale;
}
