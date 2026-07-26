/**
 * Zellij — the floor, and it is worn where feet fall.
 *
 * Hand-chiselled glazed squares, assembled face-down and plastered from
 * behind. The 8-point `khatem`, the `saft` cross that fills between them, and
 * the small rotated squares of the secondary course.
 *
 * The wear rule is not optional decoration — it is what stops a floor looking
 * rendered. Deterministic from the street seed:
 *
 *   · 4.0 % of tesserae get a chipped corner, a right triangle of leg 0.18·piece
 *   · 1.5 % are a *wrong* colour, drawn from the neighbouring ward's palette —
 *     historical repairs, never two adjacent
 *   · grout darkens and tile lightness rises down the centre of the street,
 *     because feet polish stone (applied by the floor layer, not baked in)
 *   · grout width varies ±0.3 px by seed; it is never a uniform stroke
 */

import { frand, mix as mixSeed } from "../util/rng.ts";
import { over } from "../util/color.ts";

export interface ZellijOptions {
  /** Lattice pitch in px. */
  pitch: number;
  /** How many cells across and down the repeating block is. */
  block?: number;
  seed: number;
  grout: string;
  field: string;
  glaze: string;
  glazeDeep: string;
  /** The neighbouring ward's glaze, for the repair pieces. */
  repair: string;
  dpr?: number;
}

const RI_RATIO = 0.76536686; // concave radius of the union of two squares

function khatemPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, ro: number) {
  ctx.beginPath();
  for (let k = 0; k < 16; k++) {
    const a = (k * 22.5 * Math.PI) / 180;
    const r = k % 2 === 0 ? ro : ro * RI_RATIO;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    if (k === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function squarePath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  rot: number,
) {
  ctx.beginPath();
  for (let k = 0; k < 4; k++) {
    const a = rot + (k * 90 * Math.PI) / 180;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    if (k === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** Chip one corner off the piece just drawn, by cutting a triangle out of it. */
function chip(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  seed: number,
  grout: string,
) {
  const a = frand(seed) * Math.PI * 2;
  const leg = r * 0.18;
  const px = cx + r * Math.cos(a);
  const py = cy + r * Math.sin(a);
  ctx.fillStyle = grout;
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px - leg * Math.cos(a - 0.9), py - leg * Math.sin(a - 0.9));
  ctx.lineTo(px - leg * Math.cos(a + 0.9), py - leg * Math.sin(a + 0.9));
  ctx.closePath();
  ctx.fill();
}

/** A repeating zellij block, ready for `createPattern`. */
export function zellijTile(o: ZellijOptions): HTMLCanvasElement {
  const dpr = o.dpr ?? 1;
  const block = o.block ?? 4;
  const p = o.pitch;
  const size = p * block;
  const cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(size * dpr));
  cv.height = Math.max(1, Math.round(size * dpr));
  const ctx = cv.getContext("2d");
  if (!ctx) return cv;
  ctx.scale(dpr, dpr);

  ctx.fillStyle = o.field;
  ctx.fillRect(0, 0, size, size);

  // Grout laid as the diagonals that cut the field into saft crosses.
  ctx.strokeStyle = o.grout;
  ctx.lineCap = "butt";
  for (let i = -block; i <= block * 2; i++) {
    const jitter = (frand(mixSeed(o.seed, i)) - 0.5) * 0.6;
    ctx.lineWidth = 1 + jitter;
    ctx.beginPath();
    ctx.moveTo(i * p, 0);
    ctx.lineTo(i * p + size, size);
    ctx.moveTo(i * p, size);
    ctx.lineTo(i * p + size, 0);
    ctx.stroke();
  }

  const ro = p * 0.46;
  let lastRepair = -99;
  let pieceIx = 0;

  for (let j = -1; j <= block; j++) {
    for (let i = -1; i <= block; i++) {
      const cx = i * p;
      const cy = j * p;
      const s = mixSeed(o.seed, (j + 7) * 131 + i);
      const r = frand(s);
      pieceIx++;
      let fill = o.glaze;
      if (r < 0.015 && pieceIx - lastRepair > 1) {
        fill = o.repair;
        lastRepair = pieceIx;
      }
      khatemPath(ctx, cx, cy, ro);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = o.grout;
      ctx.lineWidth = 1;
      ctx.stroke();
      if (frand(s ^ 0x51ed) < 0.04) chip(ctx, cx, cy, ro, s, o.grout);

      // Secondary course: a small square in the cell centre.
      const sx = cx + p / 2;
      const sy = cy + p / 2;
      const s2 = mixSeed(s, 0x2f3b);
      const r2 = frand(s2);
      let fill2 = o.glazeDeep;
      if (r2 < 0.015 && pieceIx - lastRepair > 1) {
        fill2 = o.repair;
        lastRepair = pieceIx;
      }
      squarePath(ctx, sx, sy, p * 0.17, Math.PI / 4);
      ctx.fillStyle = fill2;
      ctx.fill();
      ctx.strokeStyle = o.grout;
      ctx.stroke();
      if (frand(s2 ^ 0x77a1) < 0.04) chip(ctx, sx, sy, p * 0.17, s2, o.grout);
    }
  }

  // A whisper of the lit edge on the up-sun side of each star: the glaze is
  // slightly proud of the grout and catches the light.
  ctx.strokeStyle = over(o.glaze, "#fff3d6", 0.22);
  ctx.lineWidth = 0.6;
  for (let j = -1; j <= block; j++) {
    for (let i = -1; i <= block; i++) {
      khatemPath(ctx, i * p, j * p, ro - 0.8);
      ctx.stroke();
    }
  }

  return cv;
}
