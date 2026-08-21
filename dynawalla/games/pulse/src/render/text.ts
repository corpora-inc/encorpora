/**
 * Vector-display typography.
 *
 * Fractions are drawn *stacked* — numerator, rule, denominator — not as "3/4". A
 * stacked fraction is how the notation is actually taught, it survives being small,
 * and next to it we draw a miniature of the playfield itself: a bar cut into `d`
 * segments with `n` lit. Two representations, neither of them colour-dependent.
 */

import { INK, type Ink } from "./palette.ts";

export const DISPLAY_FONT =
  '800 var(--s) "Avenir Next", "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif';
export const NUM_FONT =
  '700 var(--s) ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace';

function font(spec: string, size: number): string {
  return spec.replace("var(--s)", `${size.toFixed(1)}px`);
}

export type TextOpts = {
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  alpha?: number;
  /** Extra soft halo passes. 0 disables. */
  bloom?: number;
  mono?: boolean;
  track?: number;
};

/** Additive neon text. Caller should already be in "lighter" composite. */
export function neon(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  size: number,
  ink: Ink,
  o: TextOpts = {},
): void {
  const c = INK[ink];
  const a = o.alpha ?? 1;
  ctx.font = font(o.mono ? NUM_FONT : DISPLAY_FONT, size);
  ctx.textAlign = o.align ?? "center";
  ctx.textBaseline = o.baseline ?? "middle";
  const bloom = o.bloom ?? 1;
  if (bloom > 0) {
    ctx.lineJoin = "round";
    ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${(0.1 * a * bloom).toFixed(3)})`;
    ctx.lineWidth = size * 0.34;
    ctx.strokeText(s, x, y);
    ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${(0.18 * a * bloom).toFixed(3)})`;
    ctx.lineWidth = size * 0.16;
    ctx.strokeText(s, x, y);
  }
  ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;
  ctx.fillText(s, x, y);
}

/** Stacked fraction. Returns the drawn half-width so callers can lay out around it. */
export function fraction(
  ctx: CanvasRenderingContext2D,
  n: number,
  d: number,
  cx: number,
  cy: number,
  size: number,
  ink: Ink,
  alpha = 1,
): number {
  const c = INK[ink];
  if (d === 1) {
    neon(ctx, String(n), cx, cy, size * 1.5, ink, { alpha });
    ctx.font = font(DISPLAY_FONT, size * 1.5);
    return ctx.measureText(String(n)).width / 2;
  }
  const ns = String(n);
  const ds = String(d);
  ctx.font = font(DISPLAY_FONT, size);
  const wn = ctx.measureText(ns).width;
  const wd = ctx.measureText(ds).width;
  const half = Math.max(wn, wd) / 2 + size * 0.1;
  const gap = size * 0.56;
  neon(ctx, ns, cx, cy - gap, size, ink, { alpha, bloom: 0.7 });
  neon(ctx, ds, cx, cy + gap, size, ink, { alpha, bloom: 0.7 });
  ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${(alpha * 0.95).toFixed(3)})`;
  ctx.lineWidth = Math.max(1.4, size * 0.09);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx - half, cy);
  ctx.lineTo(cx + half, cy);
  ctx.stroke();
  return half;
}

/**
 * A miniature of the playfield: one bar cut into `d` equal cells with `n` lit. The
 * same picture as the thing they are standing in, which is the point.
 */
export function fractionBar(
  ctx: CanvasRenderingContext2D,
  n: number,
  d: number,
  x: number,
  y: number,
  w: number,
  h: number,
  ink: Ink,
  alpha = 1,
): void {
  if (d < 1 || d > 24) return;
  const c = INK[ink];
  const cell = w / d;
  ctx.lineWidth = 1;
  for (let i = 0; i < d; i++) {
    const lit = i < n;
    ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${((lit ? 0.55 : 0.08) * alpha).toFixed(3)})`;
    ctx.fillRect(x + i * cell + 0.8, y, Math.max(1, cell - 1.6), h);
  }
  ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${(0.5 * alpha).toFixed(3)})`;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

export function measure(ctx: CanvasRenderingContext2D, s: string, size: number, mono = false): number {
  ctx.font = font(mono ? NUM_FONT : DISPLAY_FONT, size);
  return ctx.measureText(s).width;
}

export function setFont(ctx: CanvasRenderingContext2D, size: number, mono = false): void {
  ctx.font = font(mono ? NUM_FONT : DISPLAY_FONT, size);
}
