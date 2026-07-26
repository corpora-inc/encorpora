/**
 * Mashrabiya — the turned-wood lattice, in five real variants.
 *
 * The historical rule is also the correct UI rule: **smaller openings at the
 * bottom, larger openings at the top.** In a real screen that is for airflow —
 * fast air above the head, slow below. Here it means a shut stall is never a
 * dead black rectangle: you can see the glow of the game through the open top
 * of the screen and not make out what it is. That is exactly the right amount
 * of tease.
 *
 *   open-area fraction ramps 0.18 at the sill → 0.46 at the lintel
 *
 * Variants: hexagonal, `kanaysi` (narrow vertical balusters), `maymoni` (mixed
 * round and squared balusters in a mesh), `cross` (short round balusters set
 * diagonal, vertical and horizontal), `sahrigi` (large balusters, wide mesh,
 * for upper positions).
 */

import { frand, mix as mixSeed } from "../util/rng.ts";
import { over } from "../util/color.ts";

export type LatticeVariant = "hexagonal" | "kanaysi" | "maymoni" | "cross" | "sahrigi";

export const LATTICE_VARIANTS: readonly LatticeVariant[] = [
  "hexagonal",
  "kanaysi",
  "maymoni",
  "cross",
  "sahrigi",
];

export interface LatticeOptions {
  width: number;
  height: number;
  variant: LatticeVariant;
  /** Baluster pitch in px. */
  pitch: number;
  wood: string;
  woodLit: string;
  woodCut: string;
  seed: number;
  dpr?: number;
}

/**
 * A shutter panel with the holes punched out, so whatever is behind it glows
 * through. Returned as its own canvas; the caller composites it.
 */
export function latticePanel(o: LatticeOptions): HTMLCanvasElement {
  const dpr = o.dpr ?? 1;
  const cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(o.width * dpr));
  cv.height = Math.max(1, Math.round(o.height * dpr));
  const ctx = cv.getContext("2d");
  if (!ctx) return cv;
  ctx.scale(dpr, dpr);

  // The wood field, with the turning read as vertical bead-and-cove banding.
  ctx.fillStyle = o.wood;
  ctx.fillRect(0, 0, o.width, o.height);
  drawTurning(ctx, o);

  // Punch the openings. Open area ramps 0.18 at the sill to 0.46 at the lintel.
  ctx.globalCompositeOperation = "destination-out";
  const p = o.pitch;
  const cols = Math.ceil(o.width / p) + 1;
  const rows = Math.ceil(o.height / p) + 1;
  for (let j = 0; j <= rows; j++) {
    const cy = j * p + p / 2;
    const up = 1 - cy / o.height; // 1 at the lintel, 0 at the sill
    const openFrac = 0.18 + 0.28 * Math.max(0, Math.min(1, up));
    // radius from the open-area fraction of a cell
    const r = Math.sqrt((openFrac * p * p) / Math.PI);
    for (let i = 0; i <= cols; i++) {
      const stagger = o.variant === "hexagonal" || o.variant === "maymoni" ? (j & 1) * 0.5 : 0;
      const cx = (i + stagger) * p + p / 2;
      hole(ctx, cx, cy, r, o.variant, mixSeed(o.seed, j * 97 + i));
    }
  }
  ctx.globalCompositeOperation = "source-over";

  // A lit edge along the top of every course of wood: the screen is turned,
  // and the light lands on the shoulders.
  ctx.strokeStyle = over(o.wood, o.woodLit, 0.5);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let j = 0; j <= rows; j++) {
    const y = j * p + 0.5;
    ctx.moveTo(0, y);
    ctx.lineTo(o.width, y);
  }
  ctx.stroke();
  return cv;
}

function hole(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  variant: LatticeVariant,
  seed: number,
): void {
  ctx.beginPath();
  switch (variant) {
    case "hexagonal": {
      for (let k = 0; k < 6; k++) {
        const a = (k * 60 + 30) * (Math.PI / 180);
        const x = cx + r * 1.12 * Math.cos(a);
        const y = cy + r * 1.12 * Math.sin(a);
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      break;
    }
    case "kanaysi": {
      // Narrow vertical slots between the balusters.
      ctx.rect(cx - r * 0.62, cy - r * 1.5, r * 1.24, r * 3);
      break;
    }
    case "maymoni": {
      // Round and squared alternating, which is what "mixed" means here.
      if (frand(seed) < 0.5) ctx.arc(cx, cy, r, 0, Math.PI * 2);
      else ctx.rect(cx - r * 0.86, cy - r * 0.86, r * 1.72, r * 1.72);
      break;
    }
    case "cross": {
      // A quatrefoil of short balusters set diagonal, vertical, horizontal.
      const a = r * 0.62;
      ctx.rect(cx - a, cy - a * 2.2, a * 2, a * 4.4);
      ctx.rect(cx - a * 2.2, cy - a, a * 4.4, a * 2);
      break;
    }
    case "sahrigi": {
      // Large balusters, wide mesh — an upper-storey screen.
      ctx.arc(cx, cy, r * 1.22, 0, Math.PI * 2);
      break;
    }
  }
  ctx.fill();
}

/**
 * The turned profile of a baluster: a stack of five primitives — bead, fillet,
 * cove, ovolo, shaft — chosen by seed, 4 to 7 tall. Drawn as banding across the
 * wood field so the screen reads as turned rather than as a punched sheet.
 */
function drawTurning(ctx: CanvasRenderingContext2D, o: LatticeOptions): void {
  const p = o.pitch;
  const cols = Math.ceil(o.width / p) + 1;
  for (let i = 0; i <= cols; i++) {
    const s = mixSeed(o.seed, i * 31);
    const n = 4 + Math.floor(frand(s) * 4);
    const x = i * p;
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const kind = Math.floor(frand(mixSeed(s, k)) * 5);
      const y = t * o.height;
      const hgt = o.height / n;
      const inset = [0.08, 0.02, 0.16, 0.1, 0.05][kind]! * p;
      ctx.fillStyle = kind === 2 || kind === 4 ? o.woodCut : o.woodLit;
      ctx.globalAlpha = 0.24;
      ctx.fillRect(x + inset, y, p - inset * 2, Math.max(1, hgt * 0.34));
      ctx.globalAlpha = 1;
    }
  }
}
