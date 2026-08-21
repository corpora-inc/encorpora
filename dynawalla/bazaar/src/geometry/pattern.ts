/**
 * Strapwork panels — girih, khatem, six- and twelve-fold — rendered from the
 * construction, not from an image.
 *
 * Three levels of detail, matching the historical self-similar subdivision at
 * Darb-i Imam where large girih tiles decompose into smaller copies of the
 * same five:
 *
 *   tile edge ≥ 48 px   full strapwork, ribbon width b, interlaced
 *   tile edge 12–48 px  centrelines only, 1.5 px, no interlace
 *   tile edge < 12 px   a flat glaze fill and the ward colour; no pattern
 *
 * A panel is rasterised once into an offscreen canvas and blitted thereafter;
 * nothing here runs per frame.
 */

import { pic, type Segment } from "./pic.ts";
import { CONTACT, tilingFor, type Fold } from "./tilings.ts";
import { alpha } from "../util/color.ts";

export type Lod = "full" | "centreline" | "flat";

export function lodFor(tileEdgePx: number): Lod {
  if (tileEdgePx >= 48) return "full";
  if (tileEdgePx >= 12) return "centreline";
  return "flat";
}

export interface PanelOptions {
  width: number;
  height: number;
  fold: Fold;
  /** Tile edge length in px. Drives both the density and the LOD. */
  edge: number;
  /** The ground the pattern is cut into. */
  ground: string;
  /** The strap metal. */
  strap: string;
  /** The glaze filling the large tiles. */
  glaze: string;
  /** The deeper glaze, for the small tiles. */
  glazeDeep: string;
  /** Where the sky shows through — set for a canopy screen. */
  pierce?: string;
  /** Leave the ground transparent, so whatever is behind shows through. */
  transparent?: boolean;
  lod?: Lod;
  /** device pixel ratio to rasterise at */
  dpr?: number;
}

/** A cache so a ward's panel is constructed once per size, not per frame. */
const panelCache = new Map<string, HTMLCanvasElement>();
const MAX_PANELS = 28;

export function patternPanel(o: PanelOptions): HTMLCanvasElement {
  const dpr = o.dpr ?? 1;
  const lod = o.lod ?? lodFor(o.edge);
  const key = [
    o.fold,
    Math.round(o.width),
    Math.round(o.height),
    Math.round(o.edge),
    o.ground,
    o.strap,
    o.glaze,
    o.glazeDeep,
    o.pierce ?? "-",
    o.transparent ? "T" : "-",
    lod,
    dpr,
  ].join("|");
  const hit = panelCache.get(key);
  if (hit) return hit;

  const cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(o.width * dpr));
  cv.height = Math.max(1, Math.round(o.height * dpr));
  const ctx = cv.getContext("2d");
  if (ctx) {
    ctx.scale(dpr, dpr);
    drawPattern(ctx, o, lod);
  }

  if (panelCache.size >= MAX_PANELS) {
    const oldest = panelCache.keys().next().value;
    if (oldest !== undefined) panelCache.delete(oldest);
  }
  panelCache.set(key, cv);
  return cv;
}

export function clearPanelCache(): void {
  panelCache.clear();
}

function drawPattern(ctx: CanvasRenderingContext2D, o: PanelOptions, lod: Lod): void {
  const { width: w, height: h, fold, edge: L } = o;
  if (!o.transparent) {
    ctx.fillStyle = o.pierce ?? o.ground;
    ctx.fillRect(0, 0, w, h);
  }

  if (fold === "lattice") return; // mashrabiya has its own construction

  if (lod === "flat") {
    if (o.transparent) return;
    ctx.fillStyle = o.glaze;
    ctx.fillRect(0, 0, w, h);
    return;
  }

  const tiling = tilingFor(fold, L, w, h);

  // Fill the large tiles with glaze so the panel carries colour, exactly as a
  // glazed panel does. Small tiles take the deeper glaze.
  if (lod === "full" && !o.transparent) {
    for (const poly of tiling.polys) {
      if (poly.length < 3) continue;
      ctx.beginPath();
      ctx.moveTo(poly[0]!.x, poly[0]!.y);
      for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i]!.x, poly[i]!.y);
      ctx.closePath();
      ctx.fillStyle = poly.length >= 8 ? o.glaze : o.glazeDeep;
      ctx.globalAlpha = o.pierce ? 0.9 : 0.42;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  const segs = pic(tiling.polys, CONTACT[fold]);

  if (lod === "centreline") {
    ctx.strokeStyle = o.strap;
    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (const s of segs) {
      ctx.moveTo(s.a.x, s.a.y);
      ctx.lineTo(s.b.x, s.b.y);
    }
    ctx.stroke();
    return;
  }

  // Full strapwork. Ribbon width b = L/9 for the 5-fold family; the 8-fold
  // craft cuts a slightly heavier strap.
  const b = fold === "khatem8" ? L / 8 : L / 9;
  const casing = b + 2;

  // Interlace: two passes in a checkerboard order, so at every crossing one
  // ribbon reads as passing over and the other under. The under-ribbon is cut
  // by the casing stroke, not darkened by a shadow.
  const groups: Segment[][] = [[], []];
  for (const s of segs) {
    const k =
      (Math.round(s.a.x / L) + Math.round(s.a.y / L) + Math.round(s.b.x / L)) & 1;
    groups[k]!.push(s);
  }

  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";
  for (const g of groups) {
    if (!o.transparent) {
      ctx.strokeStyle = o.pierce ?? o.ground;
      ctx.lineWidth = casing;
      ctx.beginPath();
      for (const s of g) {
        ctx.moveTo(s.a.x, s.a.y);
        ctx.lineTo(s.b.x, s.b.y);
      }
      ctx.stroke();
    }

    ctx.strokeStyle = o.strap;
    ctx.lineWidth = b;
    ctx.beginPath();
    for (const s of g) {
      ctx.moveTo(s.a.x, s.a.y);
      ctx.lineTo(s.b.x, s.b.y);
    }
    ctx.stroke();
  }

  if (o.transparent) return;

  // A single hairline of the cut colour along the strap edge reads as the
  // depth of the incision. One pass, no blur.
  ctx.strokeStyle = alpha(o.glazeDeep, 0.5);
  ctx.lineWidth = 0.75;
  ctx.beginPath();
  for (const s of segs) {
    const dx = s.b.x - s.a.x;
    const dy = s.b.y - s.a.y;
    const l = Math.hypot(dx, dy) || 1;
    const nx = (-dy / l) * (b / 2);
    const ny = (dx / l) * (b / 2);
    ctx.moveTo(s.a.x + nx, s.a.y + ny);
    ctx.lineTo(s.b.x + nx, s.b.y + ny);
  }
  ctx.stroke();
}
