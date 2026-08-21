/**
 * Pre-baked glow sprites.
 *
 * `ctx.shadowBlur` is the obvious way to make things glow and it is catastrophically
 * slow — it re-blurs on every draw call. A radial-gradient disc rendered once per ink
 * and then blitted with `globalCompositeOperation = "lighter"` costs one textured
 * quad, so several hundred glows a frame stay inside budget on a mid-range tablet.
 */

import { INK, INK_KEYS, type Ink } from "./palette.ts";

const SIZE = 128;
const sprites = new Map<Ink, HTMLCanvasElement>();
let ring: HTMLCanvasElement | null = null;

function build(ink: Ink): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = SIZE;
  c.height = SIZE;
  const x = c.getContext("2d")!;
  const [r, g, b] = INK[ink];
  const grad = x.createRadialGradient(SIZE / 2, SIZE / 2, 0, SIZE / 2, SIZE / 2, SIZE / 2);
  grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
  grad.addColorStop(0.12, `rgba(${r},${g},${b},0.85)`);
  grad.addColorStop(0.32, `rgba(${r},${g},${b},0.32)`);
  grad.addColorStop(0.62, `rgba(${r},${g},${b},0.07)`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  x.fillStyle = grad;
  x.fillRect(0, 0, SIZE, SIZE);
  return c;
}

export function warmGlow(): void {
  for (const k of INK_KEYS) if (!sprites.has(k)) sprites.set(k, build(k));
  ringSprite();
}

function ringSprite(): HTMLCanvasElement {
  if (ring) return ring;
  const c = document.createElement("canvas");
  c.width = SIZE;
  c.height = SIZE;
  const x = c.getContext("2d")!;
  const grad = x.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.3, SIZE / 2, SIZE / 2, SIZE / 2);
  grad.addColorStop(0, "rgba(255,255,255,0)");
  grad.addColorStop(0.62, "rgba(255,255,255,0.9)");
  grad.addColorStop(0.78, "rgba(255,255,255,0.35)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = grad;
  x.fillRect(0, 0, SIZE, SIZE);
  ring = c;
  return c;
}

/** Additive glow disc of radius `r` (CSS px) centred on x,y. */
export function glow(
  ctx: CanvasRenderingContext2D,
  ink: Ink,
  x: number,
  y: number,
  r: number,
  alpha = 1,
): void {
  if (alpha <= 0.004 || r <= 0.4) return;
  let s = sprites.get(ink);
  if (!s) {
    s = build(ink);
    sprites.set(ink, s);
  }
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.drawImage(s, x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = prev;
}

/** A soft white annulus — shockwaves, ripples, the strike halo. */
export function halo(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  alpha: number,
): void {
  if (alpha <= 0.004 || r <= 0.4) return;
  const s = ringSprite();
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.drawImage(s, x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = prev;
}
