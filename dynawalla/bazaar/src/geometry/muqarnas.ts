/**
 * Muqarnas — as structure, not as decoration.
 *
 * The corbelled honeycomb that carries a lintel. Tiers of simple prismatic
 * cells, each tier stepping forward and down over the one above, offset by half
 * a cell so the cells sit in the valleys of the tier above. That offset is the
 * honeycomb read; without it this is a row of arches.
 *
 *   3 tiers = a stall hood     5 = a ward gate     7 = a caravanserai soffit
 *   cells(t) = k0 + t·Δ        Δ = 2 (five-fold register) or 3 (six-fold)
 *
 * Shading is three FLAT facets per cell. A gradient anywhere in a muqarnas is
 * the exact thing that turns carved stone into an AI "ancient" texture, so
 * there are none: sunlight composited on the face, nothing on the cheek,
 * skylight composited on the soffit.
 */

import { archPath } from "./arch.ts";
import { over } from "../util/color.ts";

export interface MuqarnasOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  tiers: number;
  /** 2 for the five-fold register, 3 for the six-fold. */
  delta?: number;
  /** Cells in the topmost tier. */
  k0?: number;
  ground: string;
  sun: string;
  sunAlpha: number;
  shadow: string;
  shadowAlpha: number;
  litEdge: string;
  cut: string;
}

export function drawMuqarnas(ctx: CanvasRenderingContext2D, o: MuqarnasOptions): void {
  const tiers = Math.max(1, Math.round(o.tiers));
  const delta = o.delta ?? 2;
  const k0 = o.k0 ?? 3;
  const h = o.height / tiers;

  const face = over(o.ground, o.sun, o.sunAlpha * 1.6);
  const cheek = o.ground;
  // A recess in warm stone under warm light is not a grey hole: shade it with
  // transmitted skylight, then let a little of the bounce back into it.
  const soffit = over(over(o.ground, o.shadow, o.shadowAlpha * 1.25), o.sun, o.sunAlpha * 0.4);

  for (let t = 0; t < tiers; t++) {
    const cells = k0 + t * delta;
    const cw = o.width / cells;
    const yTop = o.y + t * h;
    const yBot = yTop + h;
    // Alternate tiers by half a cell: the cells sit in the valleys above.
    const off = t % 2 === 1 ? -cw / 2 : 0;

    for (let i = -1; i <= cells; i++) {
      const cx = o.x + (i + 0.5) * cw + off;
      if (cx + cw / 2 < o.x - 1 || cx - cw / 2 > o.x + o.width + 1) continue;

      const half = cw / 2;
      // Cheek: the side walls of the cell, the unmodified stone.
      ctx.fillStyle = cheek;
      ctx.fillRect(cx - half, yTop, cw, h);

      // Soffit: the niche, cut back under the tier above.
      const nw = cw * 0.7;
      ctx.fillStyle = soffit;
      ctx.beginPath();
      ctx.moveTo(cx - nw / 2, yBot);
      ctx.lineTo(cx - nw / 2, yTop + h * 0.42);
      archPath(ctx, cx, yTop + h * 0.42, nw, "drop");
      ctx.lineTo(cx + nw / 2, yBot);
      ctx.closePath();
      ctx.fill();
      // The arris at the head of the niche catches the light. One hairline on
      // the arch alone — a stroke all the way round would outline a lozenge
      // instead of lighting an edge.
      ctx.strokeStyle = o.litEdge;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - nw / 2, yTop + h * 0.42);
      archPath(ctx, cx, yTop + h * 0.42, nw, "drop");
      ctx.stroke();

      // Face: the corbel that projects at you and catches the sun. A trapezoid
      // narrower at the top, per the cell profile.
      ctx.fillStyle = face;
      ctx.beginPath();
      ctx.moveTo(cx - half, yBot);
      ctx.lineTo(cx - half * 0.55, yBot - h * 0.48);
      ctx.lineTo(cx + half * 0.55, yBot - h * 0.48);
      ctx.lineTo(cx + half, yBot);
      ctx.closePath();
      ctx.fill();

      // One lit edge on the sun side, one cut line on the shade side. Two
      // hairlines, no blur — that is the whole of the relief.
      ctx.strokeStyle = o.litEdge;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - half, yBot);
      ctx.lineTo(cx - half * 0.55, yBot - h * 0.48);
      ctx.lineTo(cx + half * 0.55, yBot - h * 0.48);
      ctx.stroke();

      ctx.strokeStyle = o.cut;
      ctx.beginPath();
      ctx.moveTo(cx + half * 0.55, yBot - h * 0.48);
      ctx.lineTo(cx + half, yBot);
      ctx.stroke();
    }
  }

  // A course line under each tier: corbelled stone is laid in courses, and
  // the line is what tells you the tier above projects over the one below.
  ctx.strokeStyle = o.cut;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  for (let t = 1; t < tiers; t++) {
    const y = Math.round(o.y + t * h) + 0.5;
    ctx.moveTo(o.x, y);
    ctx.lineTo(o.x + o.width, y);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;

  // The lintel line the whole hood is holding up.
  ctx.strokeStyle = o.cut;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(o.x, o.y + o.height + 0.5);
  ctx.lineTo(o.x + o.width, o.y + o.height + 0.5);
  ctx.stroke();
}

/** Node cost, for the budget in §9.1. */
export const muqarnasCells = (tiers: number, k0 = 3, delta = 2): number => {
  let n = 0;
  for (let t = 0; t < tiers; t++) n += k0 + t * delta;
  return n;
};
