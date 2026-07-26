/**
 * How the bazaar shifts between day and night.
 *
 * Two independent axes, and conflating them is the predictable bug:
 *
 *   · **theme** chooses which keyframe set the ambient interpolates over.
 *     Light runs morning → dusk; night runs lamplit-evening → deep night.
 *   · **day-state** `D ∈ [0,1]` chooses where in that set you are. It drives
 *     one struct, and everything reads it.
 *
 * Transitions are continuous and slow — a 40 s dusk, never a cut. The child
 * should never catch the light changing; they should only notice, at some
 * point, that it has.
 */

import { lerp, clamp } from "../util/rng.ts";
import { mix, over } from "../util/color.ts";
import { SEMANTIC, type Semantic } from "../tokens/palette.ts";

export interface Ambient {
  /** Degrees from the horizontal. */
  sunAzimuth: number;
  sunColor: string;
  sunAlpha: number;
  shadowAlpha: number;
  /** Per depth layer; multiplied by layerIndex/6 at the call site. */
  hazeAlpha: number;
  lanternGain: number;
  /** = 90 − sunAzimuth. Drives the light-shaft polygons. */
  shaftAngle: number;
  /** 0 = full day, 1 = deep night. Blends the whole semantic layer. */
  night: number;
  /** Extra dust in the shafts through the afternoon and golden hour. */
  dustGain: number;
  /** Everything gilded, at the end of the day. */
  gild: number;
}

interface Key {
  d: number;
  az: number;
  color: string;
  alpha: number;
  shadow: number;
  haze: number;
  lantern: number;
  dust: number;
  gild: number;
}

// Morning → midday → afternoon → golden. §7.3.
const DAY: Key[] = [
  { d: 0.0, az: 68, color: "#fff0ce", alpha: 0.18, shadow: 0.26, haze: 0.28, lantern: 0, dust: 1, gild: 0 },
  { d: 0.35, az: 82, color: "#ffe7b4", alpha: 0.24, shadow: 0.3, haze: 0.42, lantern: 0, dust: 1, gild: 0 },
  { d: 0.7, az: 52, color: "#ffd79a", alpha: 0.22, shadow: 0.28, haze: 0.36, lantern: 0, dust: 2, gild: 0.15 },
  { d: 0.9, az: 26, color: "#ffc178", alpha: 0.3, shadow: 0.22, haze: 0.3, lantern: 0.15, dust: 2, gild: 0.55 },
  { d: 1.0, az: 12, color: "#ffb268", alpha: 0.3, shadow: 0.18, haze: 0.3, lantern: 0.4, dust: 2, gild: 1 },
];

// The night bazaar: lamplit evening → deep night. The most beautiful state the
// product has, and it is what a subscription opens.
const NIGHT: Key[] = [
  { d: 0.0, az: 8, color: "#f5b94a", alpha: 0.1, shadow: 0.34, haze: 0.36, lantern: 1, dust: 1, gild: 0.3 },
  { d: 0.5, az: 4, color: "#f5b94a", alpha: 0.06, shadow: 0.4, haze: 0.5, lantern: 1, dust: 1, gild: 0.2 },
  { d: 1.0, az: 2, color: "#f5b94a", alpha: 0.04, shadow: 0.44, haze: 0.62, lantern: 1, dust: 1, gild: 0.15 },
];

function sample(keys: Key[], d: number): Key {
  const x = clamp(d, 0, 1);
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1]!;
    const b = keys[i]!;
    if (x <= b.d) {
      const t = b.d === a.d ? 0 : (x - a.d) / (b.d - a.d);
      return {
        d: x,
        az: lerp(a.az, b.az, t),
        color: mix(a.color, b.color, t),
        alpha: lerp(a.alpha, b.alpha, t),
        shadow: lerp(a.shadow, b.shadow, t),
        haze: lerp(a.haze, b.haze, t),
        lantern: lerp(a.lantern, b.lantern, t),
        dust: lerp(a.dust, b.dust, t),
        gild: lerp(a.gild, b.gild, t),
      };
    }
  }
  return keys[keys.length - 1]!;
}

/**
 * `d` is the day-state (0 = morning, 1 = dusk).
 * `night` is the dusk blend, 0…1, which the 40 s transition drives.
 */
export function ambient(d: number, night: number): Ambient {
  const n = clamp(night, 0, 1);
  const day = sample(DAY, d);
  const nite = sample(NIGHT, d);
  const az = lerp(day.az, nite.az, n);
  return {
    sunAzimuth: az,
    sunColor: mix(day.color, nite.color, n),
    sunAlpha: lerp(day.alpha, nite.alpha, n),
    shadowAlpha: lerp(day.shadow, nite.shadow, n),
    hazeAlpha: lerp(day.haze, nite.haze, n),
    lanternGain: Math.max(lerp(day.lantern, nite.lantern, n), n),
    shaftAngle: 90 - az,
    night: n,
    dustGain: lerp(day.dust, nite.dust, n),
    gild: lerp(day.gild, nite.gild, n),
  };
}

/** The semantic layer, continuously blended across the dusk. */
export function semanticAt(night: number): Semantic {
  const n = clamp(night, 0, 1);
  const a = SEMANTIC.light;
  const b = SEMANTIC.night;
  if (n <= 0) return a;
  if (n >= 1) return b;
  const k = (key: keyof Semantic): string => mix(a[key] as string, b[key] as string, n);
  return {
    ground: k("ground"),
    groundLit: k("groundLit"),
    groundShade: k("groundShade"),
    skyHigh: k("skyHigh"),
    skyLow: k("skyLow"),
    haze: k("haze"),
    ink: k("ink"),
    inkMuted: k("inkMuted"),
    signBoard: k("signBoard"),
    signInk: k("signInk"),
    metal: k("metal"),
    metalShade: k("metalShade"),
    metalLit: k("metalLit"),
    cut: k("cut"),
    litEdge: k("litEdge"),
    shadow: k("shadow"),
    shadowAlpha: lerp(a.shadowAlpha, b.shadowAlpha, n),
    focus: k("focus"),
    water: k("water"),
    cloth: k("cloth"),
    timber: k("timber"),
  };
}

/** Sunlight composited onto a surface. BZ-LAW-5. */
export const lit = (base: string, am: Ambient, k = 1): string =>
  over(base, am.sunColor, am.sunAlpha * k);

/** Transmitted skylight — the only shadow there is. Never black. */
export const shade = (base: string, am: Ambient, k = 1, sky = "#2c3a63"): string =>
  over(base, sky, am.shadowAlpha * k);

/** Aerial perspective: a layer at depth `i` of 6. BZ-LAW-6. */
export const hazed = (base: string, am: Ambient, i: number, hazeColor: string): string =>
  over(base, hazeColor, (am.hazeAlpha * i) / 6);
