/**
 * Everything expensive is drawn once into an offscreen canvas and then blitted.
 *
 * `ctx.shadowBlur` is the only cheap way to get a real glow in Canvas2D and it
 * is far too slow to use per-frame — so it is used exactly here, at bake time,
 * and the frame loop only ever calls `drawImage`. That is the whole reason this
 * game holds 60fps with a few hundred glowing things on screen.
 */

import { mix, rgba } from "../core/palette.ts";

export type Glyph = {
  canvas: HTMLCanvasElement;
  /** Width/height of the baked bitmap in bake pixels. */
  w: number;
  h: number;
  /** Advance width of the glyph itself, for layout. */
  inkW: number;
};

const BAKE_PX = 92;
const FONT_STACK = `system-ui, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif`;

const glyphs = new Map<string, Glyph>();
const glows = new Map<string, HTMLCanvasElement>();

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

/**
 * A numeral (or a whole equation) with its bloom baked in: two wide coloured
 * passes for the halo, one tight pass for the edge, and a near-white core so it
 * reads at any size against the black water.
 */
export function getGlyph(text: string, color: string, weight = 800, px = BAKE_PX): Glyph {
  const key = `${text}|${color}|${weight}|${px}`;
  const hit = glyphs.get(key);
  if (hit) return hit;
  // Equations are unbounded strings over a long session; the ten numerals and a
  // handful of words are what actually recur, so a bounded cache with a hard
  // reset is enough and can never leak.
  if (glyphs.size > 160) glyphs.clear();

  const probe = makeCanvas(8, 8).getContext("2d") as CanvasRenderingContext2D;
  const font = `${weight} ${px}px ${FONT_STACK}`;
  probe.font = font;
  const inkW = probe.measureText(text).width;

  const pad = px * 0.62;
  const w = inkW + pad * 2;
  const h = px * 1.28 + pad * 2;
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const cx = w / 2;
  const cy = h / 2;

  // Halo, edge, body. The body is a *tint* of the colour rather than white:
  // a white core blooms out to a shapeless blob the moment two glows overlap,
  // and legibility of the numeral is the entire game.
  ctx.shadowColor = color;
  ctx.fillStyle = rgba(color, 0.34);
  ctx.shadowBlur = px * 0.46;
  ctx.fillText(text, cx, cy);
  ctx.shadowBlur = px * 0.16;
  ctx.fillStyle = rgba(color, 0.8);
  ctx.fillText(text, cx, cy);
  ctx.shadowBlur = 0;
  ctx.fillStyle = mix(color, "#ffffff", 0.62);
  ctx.fillText(text, cx, cy);

  const glyph: Glyph = { canvas, w, h, inkW };
  glyphs.set(key, glyph);
  return glyph;
}

/** Blits a baked glyph centred on (x, y), scaled so its cap height is `size`. */
export function drawGlyph(
  ctx: CanvasRenderingContext2D,
  glyph: Glyph,
  x: number,
  y: number,
  size: number,
  alpha = 1,
): void {
  if (alpha <= 0.004) return;
  const k = size / BAKE_PX;
  const w = glyph.w * k;
  const h = glyph.h * k;
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * alpha;
  ctx.drawImage(glyph.canvas, x - w / 2, y - h / 2, w, h);
  ctx.globalAlpha = prev;
}

/**
 * A soft additive blob. One per colour, 128px, drawn scaled. Under `lighter`
 * these stack into the bloom that carries the whole look.
 */
export function getGlow(color: string): HTMLCanvasElement {
  const hit = glows.get(color);
  if (hit) return hit;
  const size = 128;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, rgba(color, 1));
  g.addColorStop(0.22, rgba(color, 0.55));
  g.addColorStop(0.55, rgba(color, 0.14));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  glows.set(color, canvas);
  return canvas;
}

export function drawGlow(
  ctx: CanvasRenderingContext2D,
  color: string,
  x: number,
  y: number,
  radius: number,
  alpha: number,
): void {
  if (alpha <= 0.004 || radius <= 0.2) return;
  const sprite = getGlow(color);
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * Math.min(1, alpha);
  ctx.drawImage(sprite, x - radius, y - radius, radius * 2, radius * 2);
  ctx.globalAlpha = prev;
}

/** Corner darkening, baked at every resize. One blit, no per-frame gradient. */
export function bakeVignette(w: number, h: number): HTMLCanvasElement {
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  const g = ctx.createRadialGradient(
    w / 2,
    h * 0.52,
    Math.min(w, h) * 0.24,
    w / 2,
    h * 0.52,
    Math.max(w, h) * 0.78,
  );
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(0.62, "rgba(0,0,0,0.18)");
  g.addColorStop(1, "rgba(0,0,0,0.72)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  return canvas;
}

/** Free the glyph cache when the run ends — equations are unbounded strings. */
export function clearGlyphCache(): void {
  glyphs.clear();
}
