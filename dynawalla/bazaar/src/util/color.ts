/**
 * Colour arithmetic.
 *
 * BZ-LAW-5: light is warm, shadow is cool. There is no `rgba(0,0,0,x)` anywhere
 * in the bazaar — a shadow is transmitted skylight composited over the ground,
 * and a lit face is sunlight composited over the same ground. Both operations
 * live here so that the rest of the code never opens an alpha channel by hand.
 */

export type RGB = readonly [number, number, number];

const HEX = /^#?([0-9a-f]{6})$/i;

export function parseHex(hex: string): RGB {
  const m = HEX.exec(hex.trim());
  if (!m) throw new Error(`not a 6-digit hex colour: ${hex}`);
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function toHex(c: RGB): string {
  const b = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${((1 << 24) | (b(c[0]) << 16) | (b(c[1]) << 8) | b(c[2])).toString(16).slice(1)}`;
}

/** Source-over composite of `top` at `alpha` onto opaque `base`. */
export function over(base: string, top: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));
  const b = parseHex(base);
  const t = parseHex(top);
  return toHex([
    b[0] + (t[0] - b[0]) * a,
    b[1] + (t[1] - b[1]) * a,
    b[2] + (t[2] - b[2]) * a,
  ]);
}

/** Mix two colours by weight (0 = a, 1 = b). */
export const mix = (a: string, b: string, t: number): string => over(a, b, t);

function toLinear(v: number): number {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance. */
export function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** WCAG 2.x contrast ratio, 1…21. */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/** CIE L*, the perceptual lightness axis. Used to prove ward separation. */
export function lstar(hex: string): number {
  const y = luminance(hex);
  return y > 0.008856451679 ? 116 * Math.cbrt(y) - 16 : 903.2962962 * y;
}

/** A colour with an explicit alpha, for the few places canvas needs one. */
export function alpha(hex: string, a: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}
