/**
 * Layer 1 — raw materials, and Layer 2 — the semantic layer.
 *
 * This file is the single source of truth for colour in the bazaar. The
 * canvas layers read it directly; `bazaar.css` republishes the identical
 * values as custom properties for the DOM layer, and `tokens.test.ts` asserts
 * the two never drift apart.
 *
 * Layer 1 is the ONLY place a literal hex may appear (BZ-01).
 * Every semantic role exists in both themes (BZ-01).
 */

export const MATERIALS = {
  // ── Sandstone, plaster, mud-brick: the body of the city ──────────────────
  "sandstone-50": "#f7edd8",
  "sandstone-100": "#efe0c0",
  "sandstone-200": "#e0cca4",
  "sandstone-400": "#b99c6e",
  "sandstone-600": "#8a7048",
  "mudbrick-500": "#b08a5e",
  "terracotta-600": "#96422c",

  // ── Glazed tile, in the historical order of the craft ────────────────────
  "tile-white": "#f1ead9",
  "lapis-700": "#1c3f8f",
  "lapis-500": "#2e58b0",
  "lapis-300": "#5c8fe8",
  "indigo-800": "#23356b",
  "turquoise-700": "#0f6167",
  "turquoise-500": "#17868c",
  "turquoise-300": "#2fa6a8",
  "ochre-500": "#d19a24",
  "saffron-400": "#e8b93f",
  "madder-600": "#a33a2c",
  "madder-400": "#e08a6a",
  "sabz-700": "#24603e",
  "aubergine-800": "#4a2b52",
  "aubergine-400": "#bc8fc8",
  "manganese-900": "#33261c",

  // ── Brass, copper, verdigris: the mechanism ──────────────────────────────
  "brass-200": "#e8ce79",
  "brass-300": "#e8c36a",
  "brass-400": "#c9a227",
  "brass-500": "#d6a93c",
  "brass-600": "#8f6e1e",
  "brass-800": "#5a421e",
  "copper-400": "#c97a4c",
  "copper-600": "#b06e42",
  "verdigris-500": "#3e8f79",
  "verdigris-300": "#59a88f",
  "bronze-700": "#6b4a2b",

  // ── Cloth, wood, ink ─────────────────────────────────────────────────────
  "walnut-600": "#4a3220",
  "walnut-800": "#33241a",
  "bone-100": "#e6dcc4",
  "cream-50": "#f4e8d0",
  "ink-900": "#2a2015",
  "ink-600": "#6b5940",

  // ── Light, shadow, atmosphere: used only as composites ────────────────────
  sun: "#ffe9bc",
  "sky-shadow": "#2c3a63",
  haze: "#e8c89a",
  "haze-night": "#1a2140",
  lantern: "#f5b94a",
  "nightsky-900": "#0d1330",
  "nightsky-700": "#1b2454",
  nightground: "#241c13",
  nightraised: "#2f251a",
  nightdeep: "#1a140d",
  nightcut: "#120e08",
  nightshadow: "#05070f",
  "nightink-100": "#f0e2c6",
  "nightink-400": "#a99070",
  "sky-high": "#9ec4e8",
  "sky-low": "#dcd2b4",
  "lit-edge": "#fff3d6",
  "water-day": "#4e8fa0",
  "water-night": "#17324a",

  // ── Lantern glass. Emissive; never a text ground ─────────────────────────
  "glass-amber": "#f0a93b",
  "glass-ruby": "#c4402f",
  "glass-emerald": "#2e8b5a",
  "glass-cobalt": "#2a56a8",
  "glass-clear": "#f6ebcf",
} as const;

export type Material = keyof typeof MATERIALS;

export const m = (k: Material): string => MATERIALS[k];

/** The roles. Nothing outside this type names a material. */
export interface Semantic {
  ground: string;
  groundLit: string;
  groundShade: string;
  skyHigh: string;
  skyLow: string;
  haze: string;
  ink: string;
  inkMuted: string;
  signBoard: string;
  signInk: string;
  metal: string;
  metalShade: string;
  metalLit: string;
  cut: string;
  litEdge: string;
  shadow: string;
  shadowAlpha: number;
  focus: string;
  water: string;
  cloth: string;
  timber: string;
}

const LIGHT: Semantic = {
  ground: m("sandstone-100"),
  groundLit: m("sandstone-50"),
  groundShade: m("sandstone-400"),
  skyHigh: m("sky-high"),
  skyLow: m("sky-low"),
  haze: m("haze"),
  ink: m("ink-900"),
  inkMuted: m("ink-600"),
  signBoard: m("walnut-600"),
  signInk: m("cream-50"),
  metal: m("brass-400"),
  metalShade: m("brass-600"),
  metalLit: m("brass-200"),
  cut: m("sandstone-600"),
  litEdge: m("lit-edge"),
  shadow: m("sky-shadow"),
  shadowAlpha: 0.26,
  focus: m("lapis-700"),
  water: m("water-day"),
  cloth: m("bone-100"),
  timber: m("bronze-700"),
};

const NIGHT: Semantic = {
  ground: m("nightground"),
  groundLit: m("nightraised"),
  groundShade: m("nightdeep"),
  skyHigh: m("nightsky-900"),
  skyLow: m("nightsky-700"),
  haze: m("haze-night"),
  ink: m("nightink-100"),
  inkMuted: m("nightink-400"),
  signBoard: m("walnut-800"),
  signInk: m("cream-50"),
  metal: m("brass-200"),
  metalShade: m("brass-400"),
  metalLit: m("lantern"),
  cut: m("nightcut"),
  litEdge: m("lantern"),
  shadow: m("nightshadow"),
  shadowAlpha: 0.4,
  focus: m("brass-200"),
  water: m("water-night"),
  cloth: m("bone-100"),
  timber: m("walnut-800"),
};

export const SEMANTIC = { light: LIGHT, night: NIGHT } as const;
export type ThemeName = keyof typeof SEMANTIC;

export const theme = (t: ThemeName): Semantic => SEMANTIC[t];

// ── Awning stripe pairs ────────────────────────────────────────────────────
// Real souk awnings are woven cotton and goat-hair. A 1px brass-800 selvedge
// sits between every stripe, which is how a weft line actually looks and is
// what keeps the saffron/white pair (1.53:1) legible in greyscale.
export interface StripePair {
  readonly id: string;
  readonly a: string;
  readonly b: string;
}

export const STRIPES: readonly StripePair[] = [
  { id: "saffron-white", a: m("saffron-400"), b: m("tile-white") },
  { id: "indigo-white", a: m("indigo-800"), b: m("tile-white") },
  { id: "madder-cream", a: m("madder-600"), b: m("sandstone-100") },
  { id: "sabz-bone", a: m("sabz-700"), b: m("bone-100") },
  { id: "aubergine-bone", a: m("aubergine-800"), b: m("bone-100") },
  { id: "ochre-umber", a: m("ochre-500"), b: m("brass-800") },
];

export const SELVEDGE = m("brass-800");

// ── Wards ──────────────────────────────────────────────────────────────────
// Colour identifies a ward, never a single quarter (BZ-LAW-8). Every ward also
// carries a finial silhouette, a pattern fold and an awning stripe, so no
// meaning is ever carried by colour alone.
export type WardId = "lapis" | "aubergine" | "turquoise" | "madder" | "hemp";

export interface Ward {
  readonly id: WardId;
  readonly day: string;
  readonly night: string;
  /** Glaze for the tiled band; never carries text (BZ-LAW-7). */
  readonly glaze: string;
  readonly glazeDeep: string;
}

export const WARDS: Record<WardId, Ward> = {
  lapis: {
    id: "lapis",
    day: m("lapis-700"),
    night: m("lapis-300"),
    glaze: m("lapis-500"),
    glazeDeep: m("indigo-800"),
  },
  aubergine: {
    id: "aubergine",
    day: m("aubergine-800"),
    night: m("aubergine-400"),
    glaze: m("aubergine-800"),
    glazeDeep: m("manganese-900"),
  },
  turquoise: {
    id: "turquoise",
    day: m("turquoise-500"),
    night: m("turquoise-300"),
    glaze: m("turquoise-500"),
    glazeDeep: m("turquoise-700"),
  },
  madder: {
    id: "madder",
    day: m("madder-600"),
    night: m("madder-400"),
    glaze: m("madder-600"),
    glazeDeep: m("terracotta-600"),
  },
  hemp: {
    id: "hemp",
    day: m("brass-600"),
    night: m("brass-500"),
    glaze: m("ochre-500"),
    glazeDeep: m("brass-800"),
  },
};

export const WARD_ORDER: readonly WardId[] = [
  "lapis",
  "turquoise",
  "madder",
  "hemp",
  "aubergine",
];
