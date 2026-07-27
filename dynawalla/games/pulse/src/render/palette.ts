/**
 * The register: a CRT vector display in a dark room. Additive neon on near-black,
 * phosphor persistence, no fills — everything is light.
 *
 * Hue is never the only carrier of meaning. Lane identity is also vertical position
 * and voice; subdivision is also *shape*; judgment is also size, text and haptics.
 */

export type Ink = keyof typeof INK;

export const INK = {
  cyan: [90, 240, 255],
  magenta: [255, 84, 214],
  lime: [168, 255, 120],
  amber: [255, 196, 84],
  white: [235, 245, 255],
  rose: [255, 96, 96],
  violet: [168, 140, 255],
} as const satisfies Record<string, readonly [number, number, number]>;

export const INK_KEYS = Object.keys(INK) as Ink[];

export function rgb(k: Ink, a = 1): string {
  const c = INK[k];
  return a >= 1 ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}

export const BG = "#04050a";
export const BG_RGB = [4, 5, 10] as const;

/** Lane inks, top (highest voice) to bottom. */
export const LANE_INK: readonly Ink[] = ["cyan", "magenta", "amber"];

export function laneInk(lane: number, laneCount: number): Ink {
  if (laneCount <= 1) return "cyan";
  if (laneCount === 2) return lane === 0 ? "magenta" : "amber";
  return LANE_INK[lane] ?? "cyan";
}

export const JUDGE_INK = {
  perfect: "lime",
  great: "cyan",
  good: "amber",
  miss: "rose",
} as const satisfies Record<string, Ink>;
