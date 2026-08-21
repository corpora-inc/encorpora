/**
 * The climb, as weather.
 *
 * Eight named bands, each committing to near-black + two hues + one hot accent.
 * Crossing into a new one is the biggest moment in the game short of a collapse.
 * After the eighth the cycle repeats with a hue rotation, so a long run never
 * lands on exactly the same sky twice.
 */

export type Stratum = {
  name: string;
  /** Sky gradient, bottom → mid → top. */
  sky: [number, number, number];
  /** Slab body and the hot enamel edge. */
  slab: number;
  accent: number;
  /** Hemisphere fill: up / down. */
  hemiUp: number;
  hemiDown: number;
  key: number;
  rim: number;
  fog: number;
  /** Distant silhouettes. */
  spire: number;
  /** Ambient particle mood. */
  mote: { color: number; rise: number; drift: number; size: number; count: number };
  /** Inverted band: light-on-dark flips to dark-on-light for the HUD. */
  invert?: boolean;
};

const S: readonly Stratum[] = [
  {
    name: "BASALT",
    sky: [0x05060f, 0x0b1030, 0x161f4d],
    slab: 0x7d89ab,
    accent: 0xff6a1f,
    hemiUp: 0x3a4a86,
    hemiDown: 0x0a0c18,
    key: 0xdfe8ff,
    rim: 0x4d7bff,
    fog: 0x080a18,
    spire: 0x0d1128,
    mote: { color: 0x7f95d8, rise: 0.12, drift: 0.1, size: 0.028, count: 90 },
  },
  {
    name: "VERDIGRIS",
    sky: [0x02100e, 0x063230, 0x0a5a4d],
    slab: 0x4fae93,
    accent: 0xff2f92,
    hemiUp: 0x1e8f7c,
    hemiDown: 0x041614,
    key: 0xdcfff2,
    rim: 0xff59a8,
    fog: 0x04140f,
    spire: 0x05201c,
    mote: { color: 0x8ff0d2, rise: 0.05, drift: 0.24, size: 0.022, count: 120 },
  },
  {
    name: "EMBER",
    sky: [0x140301, 0x3a0a04, 0x6b1405],
    slab: 0x4a3f42,
    accent: 0xffb23d,
    hemiUp: 0x8c3212,
    hemiDown: 0x1a0603,
    key: 0xffe6c8,
    rim: 0xff5a17,
    fog: 0x180503,
    spire: 0x230704,
    mote: { color: 0xff9134, rise: 0.55, drift: 0.16, size: 0.03, count: 150 },
  },
  {
    name: "AZURE",
    sky: [0x0d3d78, 0x1f79c8, 0x9ad8ff],
    slab: 0xe8ecf2,
    accent: 0x00e5ff,
    hemiUp: 0x7ec6ff,
    hemiDown: 0x123a63,
    key: 0xffffff,
    rim: 0x00c2ff,
    fog: 0x2a7fc4,
    spire: 0x14568f,
    mote: { color: 0xffffff, rise: 0.08, drift: 0.42, size: 0.05, count: 70 },
  },
  {
    name: "VIOLET",
    sky: [0x110320, 0x340a5c, 0x6b1d9e],
    slab: 0x8a5fbb,
    accent: 0xc6ff2e,
    hemiUp: 0x7431b8,
    hemiDown: 0x120424,
    key: 0xeadcff,
    rim: 0xa6ff3c,
    fog: 0x160529,
    spire: 0x230840,
    mote: { color: 0xd7a6ff, rise: 0.1, drift: 0.18, size: 0.024, count: 110 },
  },
  {
    name: "AURORA",
    sky: [0x00120e, 0x02322c, 0x0a5c3e],
    slab: 0xc4e8fa,
    accent: 0xff4d7a,
    hemiUp: 0x1fae7f,
    hemiDown: 0x021410,
    key: 0xd8f4ff,
    rim: 0xff6f96,
    fog: 0x021512,
    spire: 0x04241d,
    mote: { color: 0x6dffc0, rise: 0.22, drift: 0.3, size: 0.02, count: 160 },
  },
  {
    name: "VACUUM",
    sky: [0x000000, 0x03030a, 0x0a0a1a],
    slab: 0xf4f6ff,
    accent: 0xff1440,
    hemiUp: 0x1a1a3a,
    hemiDown: 0x000000,
    key: 0xffffff,
    rim: 0xff2a50,
    fog: 0x000004,
    spire: 0x05050c,
    mote: { color: 0xffffff, rise: 0.02, drift: 0.06, size: 0.016, count: 200 },
  },
  {
    name: "SOLAR",
    sky: [0xfff3d0, 0xffd870, 0xff9a1f],
    slab: 0x191410,
    accent: 0xffffff,
    hemiUp: 0xffe9a8,
    hemiDown: 0x8a5a10,
    key: 0xfff8e0,
    rim: 0xffffff,
    fog: 0xffcf70,
    spire: 0xd88a20,
    mote: { color: 0xfff6d8, rise: 0.34, drift: 0.2, size: 0.034, count: 130 },
    invert: true,
  },
];

export const STRATUM_COUNT = S.length;

/** Rotate a packed 0xRRGGBB hue by `deg`, preserving luma reasonably well. */
function rotateHue(hex: number, deg: number): number {
  if (deg === 0) return hex;
  const r = ((hex >> 16) & 255) / 255;
  const g = ((hex >> 8) & 255) / 255;
  const b = (hex & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return hex; // greys stay grey
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  h = (h + deg / 360) % 1;
  if (h < 0) h += 1;

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2 = (t: number): number => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const rr = Math.round(hue2(h + 1 / 3) * 255);
  const gg = Math.round(hue2(h) * 255);
  const bb = Math.round(hue2(h - 1 / 3) * 255);
  return (rr << 16) | (gg << 8) | bb;
}

/**
 * Relative luminance of a packed colour, 0..1.
 *
 * The HUD picks light-on-dark or dark-on-light from THIS, measured off the sky
 * the chrome actually sits in front of — not from a flag set by hand. AZURE
 * shipped as white-on-pale-blue on the first playthrough and was unreadable;
 * a hand-maintained `invert` boolean will always eventually be wrong on one of
 * the strata, and a run reaches all of them.
 */
export function luma(hex: number): number {
  const f = (v: number): number => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f((hex >> 16) & 255) + 0.7152 * f((hex >> 8) & 255) + 0.0722 * f(hex & 255);
}

/** True when chrome in front of this stratum's sky must be drawn dark-on-light. */
export function isBright(s: Stratum): boolean {
  return s.invert ?? luma(s.sky[2]) > 0.34;
}

const cache = new Map<number, Stratum>();

/** Stratum for band index `i` (0-based). Cycles with a 37° hue rotation. */
export function stratumAt(i: number): Stratum {
  const key = i < 0 ? 0 : i;
  const hit = cache.get(key);
  if (hit) return hit;

  const base = S[key % STRATUM_COUNT]!;
  const lap = Math.floor(key / STRATUM_COUNT);
  const deg = lap * 37;
  const out: Stratum =
    deg === 0
      ? base
      : {
          ...base,
          name: lap === 0 ? base.name : `${base.name} ${"II III IV V VI VII VIII IX X".split(" ")[Math.min(8, lap - 1)]}`,
          sky: [rotateHue(base.sky[0], deg), rotateHue(base.sky[1], deg), rotateHue(base.sky[2], deg)],
          slab: rotateHue(base.slab, deg),
          accent: rotateHue(base.accent, deg),
          hemiUp: rotateHue(base.hemiUp, deg),
          hemiDown: rotateHue(base.hemiDown, deg),
          key: rotateHue(base.key, deg * 0.35),
          rim: rotateHue(base.rim, deg),
          fog: rotateHue(base.fog, deg),
          spire: rotateHue(base.spire, deg),
          mote: { ...base.mote, color: rotateHue(base.mote.color, deg) },
        };

  if (cache.size > 64) cache.clear();
  cache.set(key, out);
  return out;
}
