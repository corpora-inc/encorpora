/**
 * FUSE looks like a magnetic containment well seen from above: near-black
 * indigo, thin bright vector rims, additive plasma. Nothing is a card, nothing
 * is a gradient panel, nothing is beige.
 *
 * Tile colour encodes tier (how big the number is relative to the KEY) and is
 * decorative only — the number itself is always printed, so no information is
 * ever carried by colour alone.
 */

export type Rgb = readonly [number, number, number];

export const BG_DEEP: Rgb = [4, 5, 13];
export const BG_MID: Rgb = [10, 13, 31];
export const WELL_BACK: Rgb = [7, 10, 24];
export const WELL_RIM: Rgb = [42, 58, 112];
export const HAIRLINE: Rgb = [24, 33, 66];

export const HOT: Rgb = [255, 240, 214];
export const KEYC: Rgb = [255, 214, 120];
export const DANGER: Rgb = [255, 51, 85];
export const CHARGE: Rgb = [110, 255, 214];

/** tier 0..5, low numbers cool, high numbers hot */
export const TIERS: Rgb[] = [
  [46, 230, 255], // cyan
  [77, 140, 255], // blue
  [164, 92, 255], // violet
  [255, 77, 157], // magenta
  [255, 138, 61], // ember
  [255, 216, 77], // gold
];

export function tierColor(tier: number): Rgb {
  return TIERS[Math.max(0, Math.min(TIERS.length - 1, tier))] as Rgb;
}

export function rgb(c: Rgb, a = 1): string {
  return a >= 1 ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}

export function mix(a: Rgb, b: Rgb, t: number): Rgb {
  const k = Math.max(0, Math.min(1, t));
  return [
    Math.round(a[0] + (b[0] - a[0]) * k),
    Math.round(a[1] + (b[1] - a[1]) * k),
    Math.round(a[2] + (b[2] - a[2]) * k),
  ];
}

export function shade(c: Rgb, k: number): Rgb {
  return [
    Math.max(0, Math.min(255, Math.round(c[0] * k))),
    Math.max(0, Math.min(255, Math.round(c[1] * k))),
    Math.max(0, Math.min(255, Math.round(c[2] * k))),
  ];
}

export const FONT_STACK =
  '"Avenir Next", "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif';

export function font(px: number, weight = 800): string {
  return `${weight} ${px}px ${FONT_STACK}`;
}
