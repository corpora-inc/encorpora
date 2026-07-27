/**
 * Fraction-aware typesetting.
 *
 * A prompt arrives from the host as a plain string — `1/4 + 1/4 = ?`. Drawing
 * that literally gives a child a slash, which is not what a fraction looks like
 * in any book they have ever read. Every `n/d` token is set properly stacked:
 * numerator, rule, denominator.
 *
 * Layout is measured once per string at a reference size and scaled, so nothing
 * is measured during a frame.
 */

import { font } from "../theme.ts";

type Seg =
  | { frac: false; t: string; w: number }
  | { frac: true; n: string; d: string; suffix: string; w: number; barW: number; sufW: number };

type Layout = { segs: Seg[]; w: number };

const REF = 100;
const GAP = 0.26 * REF;
const NUM_SCALE = 0.74;

const cache = new Map<string, Layout>();
const FRACTION = /^([\d?]+)\s*\/\s*([\d?]+)(.*)$/;

function layoutOf(ctx: CanvasRenderingContext2D, text: string): Layout {
  const hit = cache.get(text);
  if (hit) return hit;

  const segs: Seg[] = [];
  const prevFont = ctx.font;
  for (const raw of text.split(/\s+/)) {
    if (!raw) continue;
    const m = FRACTION.exec(raw);
    if (m) {
      const n = m[1]!;
      const d = m[2]!;
      const suffix = m[3] ?? "";
      ctx.font = font(REF * NUM_SCALE, 900);
      const barW = Math.max(ctx.measureText(n).width, ctx.measureText(d).width) * 1.24;
      ctx.font = font(REF, 800);
      const sufW = suffix ? ctx.measureText(suffix).width : 0;
      segs.push({ frac: true, n, d, suffix, w: barW + sufW, barW, sufW });
    } else {
      ctx.font = font(REF, 800);
      segs.push({ frac: false, t: raw, w: ctx.measureText(raw).width });
    }
  }
  ctx.font = prevFont;

  let w = 0;
  for (let i = 0; i < segs.length; i++) w += segs[i]!.w + (i > 0 ? GAP : 0);
  const l: Layout = { segs, w };
  if (cache.size > 400) cache.clear();
  cache.set(text, l);
  return l;
}

/** Width the string will occupy when drawn at `size`. */
export function measureRich(ctx: CanvasRenderingContext2D, text: string, size: number): number {
  return (layoutOf(ctx, text).w * size) / REF;
}

/** Total height including numerator and denominator, at `size`. */
export function heightRich(text: string, size: number): number {
  return /[\d?]+\s*\/\s*[\d?]+/.test(text) ? size * 1.86 : size * 1.06;
}

export type RichStyle = {
  fill: string;
  /** optional outer glow; skipped when empty */
  glow?: string;
  glowWidth?: number;
};

/**
 * Draw `text` with stacked fractions. `x` is the LEFT edge unless `center` is
 * true, in which case it is the centre. `y` is the vertical centre.
 */
export function drawRich(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  style: RichStyle,
  center = false,
): number {
  const l = layoutOf(ctx, text);
  const k = size / REF;
  const total = l.w * k;
  let cx = center ? x - total / 2 : x;

  ctx.save();
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  if (style.glow) {
    ctx.shadowColor = style.glow;
    ctx.shadowBlur = style.glowWidth ?? size * 0.5;
  }
  ctx.fillStyle = style.fill;

  for (let i = 0; i < l.segs.length; i++) {
    const s = l.segs[i]!;
    if (i > 0) cx += GAP * k;
    if (!s.frac) {
      ctx.font = font(size, 800);
      ctx.fillText(s.t, cx, y);
      cx += s.w * k;
      continue;
    }
    const barW = s.barW * k;
    const numSize = size * NUM_SCALE;
    ctx.font = font(numSize, 900);
    ctx.textAlign = "center";
    ctx.fillText(s.n, cx + barW / 2, y - size * 0.46);
    ctx.fillText(s.d, cx + barW / 2, y + size * 0.5);
    ctx.textAlign = "left";
    const th = Math.max(2, size * 0.085);
    ctx.fillRect(cx + barW * 0.06, y - th / 2, barW * 0.88, th);
    cx += barW;
    if (s.suffix) {
      ctx.font = font(size, 800);
      ctx.fillText(s.suffix, cx, y);
      cx += s.sufW * k;
    }
  }
  ctx.restore();
  return total;
}
