/**
 * Visual register: a neon oscilloscope canyon. Deep indigo night, a skyline cut
 * from the live FFT of the master bus, a waveform for a horizon, and a floor
 * ruled into the current subdivision.
 *
 * Two rules this file exists to enforce:
 *
 *  1. LANE IDENTITY IS FIXED FOREVER. Amber is always the low drum, rose always
 *     the mid, cyan always the high — in every sector, at every difficulty. The
 *     world changes colour around the player; the thing their hands have
 *     learned does not. Each lane also has its own SHAPE, so none of this
 *     information is carried by colour alone.
 *  2. ORNAMENT NEVER EATS LEGIBILITY. Numerals are heavy grotesque, never
 *     engraved or serif, and are drawn at a size derived from the smaller
 *     screen axis so they hold at 320px.
 */

export type Rgb = readonly [number, number, number];

export const rgba = (c: Rgb, a: number): string => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
export const rgb = (c: Rgb): string => `rgb(${c[0]},${c[1]},${c[2]})`;

export const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];

/** Lane colour AND lane shape. Never one without the other. */
export const LANE_COLOR: readonly Rgb[] = [
  [255, 156, 56], // 0 low  — amber
  [255, 77, 141], // 1 mid  — rose
  [78, 226, 255], // 2 high — cyan
];
export type LaneShape = "disc" | "square" | "wedge";
export const LANE_SHAPE: readonly LaneShape[] = ["disc", "square", "wedge"];
/** Screen-reader / legend text; also drawn under the strike pads. */
export const LANE_NAME: readonly string[] = ["LOW", "MID", "HIGH"];

export type SectorTheme = {
  /** background gradient, top → bottom */
  skyTop: Rgb;
  skyBottom: Rgb;
  /** far and near skyline silhouettes */
  farBar: Rgb;
  nearBar: Rgb;
  /** horizon glow + oscilloscope trace */
  horizon: Rgb;
  /** floor rules and cell dividers */
  grid: Rgb;
  /** haze behind the strike column */
  bloom: Rgb;
};

export const SECTOR_THEME: Record<string, SectorTheme> = {
  indigo: {
    skyTop: [6, 8, 26], skyBottom: [16, 22, 62], farBar: [30, 40, 104], nearBar: [58, 78, 186],
    horizon: [120, 205, 255], grid: [86, 120, 220], bloom: [70, 110, 255],
  },
  ember: {
    skyTop: [22, 6, 8], skyBottom: [58, 18, 12], farBar: [96, 34, 22], nearBar: [176, 66, 30],
    horizon: [255, 170, 96], grid: [200, 96, 52], bloom: [255, 110, 40],
  },
  violet: {
    skyTop: [15, 5, 28], skyBottom: [42, 12, 70], farBar: [74, 26, 122], nearBar: [136, 52, 210],
    horizon: [214, 150, 255], grid: [150, 90, 230], bloom: [170, 70, 255],
  },
  glacier: {
    skyTop: [3, 14, 20], skyBottom: [8, 40, 54], farBar: [16, 68, 90], nearBar: [34, 128, 160],
    horizon: [150, 240, 255], grid: [70, 170, 205], bloom: [50, 190, 230],
  },
  solar: {
    skyTop: [24, 16, 3], skyBottom: [62, 44, 8], farBar: [110, 76, 18], nearBar: [196, 142, 34],
    horizon: [255, 224, 130], grid: [216, 168, 60], bloom: [255, 190, 50],
  },
  abyss: {
    skyTop: [2, 4, 8], skyBottom: [6, 16, 26], farBar: [12, 34, 52], nearBar: [26, 74, 104],
    horizon: [110, 235, 210], grid: [50, 140, 140], bloom: [40, 220, 180],
  },
};

export const themeFor = (id: string): SectorTheme => SECTOR_THEME[id] ?? SECTOR_THEME.indigo!;

/* -------------------------------------------------------------------- */
/* quality tiers                                                         */
/* -------------------------------------------------------------------- */

export type Tier = "low" | "mid" | "ultra";

export type TierSpec = {
  sparks: number;
  shards: number;
  rings: number;
  /** skyline resolution */
  bars: number;
  /** draw the oscilloscope horizon */
  scope: boolean;
  /** additive bloom pass on an offscreen half-res buffer */
  bloom: boolean;
  /** trailing ribbon of everything you have played */
  ribbon: boolean;
  /** per-note motion streaks */
  streaks: boolean;
  /** starfield dust */
  dust: number;
  maxDpr: number;
};

export const TIER_SPEC: Record<Tier, TierSpec> = {
  low: { sparks: 260, shards: 56, rings: 20, bars: 26, scope: false, bloom: false, ribbon: false, streaks: false, dust: 0, maxDpr: 1.5 },
  mid: { sparks: 760, shards: 170, rings: 40, bars: 52, scope: true, bloom: true, ribbon: true, streaks: false, dust: 60, maxDpr: 2 },
  ultra: { sparks: 1900, shards: 420, rings: 76, bars: 96, scope: true, bloom: true, ribbon: true, streaks: true, dust: 150, maxDpr: 2 },
};

export function autoTier(): Tier {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const mem = nav.deviceMemory ?? 4;
  const cores = navigator.hardwareConcurrency ?? 4;
  const px = window.innerWidth * window.innerHeight * Math.min(2, window.devicePixelRatio || 1);
  if (mem >= 8 && cores >= 8) return "ultra";
  if (mem <= 3 || cores <= 4 || px > 4_500_000) return "low";
  return "mid";
}

/** Heavy grotesque only. Numerals must survive a 0.45s glance at speed. */
export const FONT_STACK =
  '"Inter", "SF Pro Display", "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif';

export const font = (px: number, weight = 800): string =>
  `${weight} ${px.toFixed(1)}px ${FONT_STACK}`;
