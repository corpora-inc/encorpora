/**
 * A tiny sprite cache.
 *
 * The whole performance story of the backdrop is this file: a tower, a dome, a
 * lantern, a shutter, a stall's static chrome are each constructed once into an
 * offscreen canvas and blitted thereafter. Nothing that involves a girih
 * construction, a muqarnas tier stack or a turned-wood lattice ever runs inside
 * a frame.
 */

const cache = new Map<string, HTMLCanvasElement>();
const MAX = 160;

export function sprite(
  key: string,
  w: number,
  h: number,
  dpr: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): HTMLCanvasElement {
  const k = `${key}|${Math.round(w)}x${Math.round(h)}@${dpr}`;
  const hit = cache.get(k);
  if (hit) {
    // refresh LRU position
    cache.delete(k);
    cache.set(k, hit);
    return hit;
  }
  const cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(w * dpr));
  cv.height = Math.max(1, Math.round(h * dpr));
  const ctx = cv.getContext("2d");
  if (ctx) {
    ctx.scale(dpr, dpr);
    draw(ctx, w, h);
  }
  if (cache.size >= MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(k, cv);
  return cv;
}

export function clearSprites(): void {
  cache.clear();
}

export const spriteCount = (): number => cache.size;

/**
 * Quantise a continuously varying value so a sprite key does not change every
 * frame. The dusk moves through 24 steps, not 6,000.
 */
export const bucket = (v: number, steps = 24): number => Math.round(v * steps) / steps;
