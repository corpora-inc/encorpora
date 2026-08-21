/**
 * Abyssal neon. A bioluminescent trench: near-black water, cold light from an
 * impossibly distant surface, and everything alive glowing its own colour.
 *
 * Note what is NOT in here: a colour for "guilty". Every husk looks identical
 * until you do the arithmetic — that is the game. Colour only ever marks
 * something the player has already learned about (a husk they shot wrongly, and
 * that one also changes silhouette and motion, so the mark is never colour
 * alone).
 */

export const C = {
  void0: "#01030a",
  void1: "#05131f",
  void2: "#0a2d3a",
  surface: "#123f4d",

  /** Husks, the ship's sight line, most sparks. */
  cyan: "#7CF3DC",
  cyanDim: "#2b7f80",
  cyanDeep: "#124b55",

  /** The equation, and the score. Warm, so it never reads as a husk. */
  amber: "#FFC46B",
  amberDeep: "#8a5a1f",

  /** A husk you shot by mistake. Also spiky, also diving. */
  hostile: "#FF3D6E",
  hostileDeep: "#7d1330",

  ship: "#C3B0FF",
  shipCore: "#F2ECFF",
  thrust: "#7FA8FF",

  white: "#FFFFFF",
  plankton: "#59C8F0",

  boss: "#FFA0D8",
  bossDeep: "#6b1f52",
} as const;

/** rgba() from a #rrggbb and an alpha, without allocating a parser each call. */
const cache = new Map<string, [number, number, number]>();
export function rgba(hex: string, alpha: number): string {
  let parts = cache.get(hex);
  if (!parts) {
    parts = [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16),
    ];
    cache.set(hex, parts);
  }
  return `rgba(${parts[0]},${parts[1]},${parts[2]},${alpha < 0 ? 0 : alpha > 1 ? 1 : alpha})`;
}

export function mix(a: string, b: string, t: number): string {
  const pa = parseHex(a);
  const pb = parseHex(b);
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${bl
    .toString(16)
    .padStart(2, "0")}`;
}

function parseHex(hex: string): [number, number, number] {
  let parts = cache.get(hex);
  if (!parts) {
    parts = [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16),
    ];
    cache.set(hex, parts);
  }
  return parts;
}
