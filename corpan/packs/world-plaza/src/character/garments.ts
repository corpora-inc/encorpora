/**
 * garments — the data-driven wardrobe shape catalogue.
 *
 * One table maps a GARMENT FAMILY (the tail of a cosmetic itemId, e.g.
 * "hat-sombrero" → "sombrero") to the procedural pieces figure3d composes from
 * its SHARED primitive masters (sphere / cone / cylinder / torus — all
 * instanced, never per-character meshes). Adding a future hat is a data edit
 * here, not renderer code.
 *
 * MULTIPLAYER SAFETY: an itemId whose family is NOT in this table renders as
 * the classic dome+brim (hats) or plain torso (tops) — the exact look every
 * pre-garment client already draws — so new cosmetics degrade gracefully on
 * old clients and unknown future cosmetics degrade gracefully on this one.
 *
 * Units: hat piece `scale`/`offset` are in HEAD-RADIUS multiples; `offset.y`
 * is relative to the head-centre anchor figure3d already uses for hats.
 * Cultural garments (hijab, sari, sombrero…) are EVERYDAY wear in a modern,
 * multicultural Corpan City — rendered dignified (the hijab never occludes
 * the face), never as costume or caricature.
 */

/* ----------------------------------------------------------------- pieces */

export type GarmentShape = "sphere" | "cone" | "cylinder" | "torus"

export interface GarmentPiece {
  /** which shared master mesh to instance. */
  shape: GarmentShape
  /** scaling in head-radius units (x, y, z). */
  scale: [number, number, number]
  /** offset in head-radius units; y is relative to the head-centre anchor. */
  offset: [number, number, number]
  /** optional rotation in radians (x, y, z). */
  rotate?: [number, number, number]
  /** colour: "base" = hat tint, "accent" = trim tint, or darken(base, f). */
  tint?: "base" | "accent" | { darken: number }
}

/* ------------------------------------------------------------------- hats */

/**
 * Hat families → pieces. Families NOT listed here fall back to the classic
 * dome+brim in figure3d (the MP-safe default).
 */
export const HAT_GARMENTS: Record<string, GarmentPiece[]> = {
  // Wide festive brim, low crown, bright band — everyday plaza sunshine wear.
  sombrero: [
    { shape: "sphere", scale: [3.6, 0.18, 3.6], offset: [0, 0.55, -0.05] }, // wide brim disc
    { shape: "torus", scale: [3.25, 1.1, 3.25], offset: [0, 0.62, -0.05], tint: { darken: 0.88 } }, // rolled rim
    { shape: "cone", scale: [1.55, 1.15, 1.55], offset: [0, 1.05, -0.05] }, // tall-ish crown
    { shape: "torus", scale: [1.5, 0.55, 1.5], offset: [0, 0.7, -0.05], tint: "accent" }, // band
  ],
  // Tall cylinder, flat brim, satin band — fancy evening wear.
  tophat: [
    { shape: "cylinder", scale: [1.55, 1.75, 1.55], offset: [0, 1.42, -0.05] }, // tall crown
    { shape: "sphere", scale: [2.45, 0.14, 2.45], offset: [0, 0.52, -0.05] }, // flat brim
    { shape: "torus", scale: [1.62, 0.5, 1.62], offset: [0, 0.78, -0.05], tint: "accent" }, // band
  ],
  // Soft tilted pancake + nub — artist's classic.
  beret: [
    { shape: "sphere", scale: [2.25, 0.72, 2.25], offset: [0, 0.78, -0.1], rotate: [0, 0, 0.14] },
    { shape: "sphere", scale: [0.24, 0.24, 0.24], offset: [0.05, 1.16, -0.1] }, // nub
  ],
  // Snug knit dome with a folded brim.
  beanie: [
    { shape: "sphere", scale: [2.08, 1.55, 2.05], offset: [0, 0.52, -0.08] },
    { shape: "torus", scale: [2.0, 0.95, 1.98], offset: [0, 0.26, -0.08], tint: { darken: 0.82 } }, // fold
  ],
  // Everyday hijab: a soft wrap over crown/sides/back + a graceful shoulder
  // fall. The face stays fully open (wrap sits flush with the head's front).
  hijab: [
    { shape: "sphere", scale: [2.42, 2.36, 2.3], offset: [0, 0.16, -0.16] }, // wrap
    { shape: "sphere", scale: [2.1, 1.9, 1.45], offset: [0, -0.8, -0.5] }, // shoulder fall
    { shape: "sphere", scale: [1.5, 1.1, 1.2], offset: [0, -1.25, 0.05], tint: { darken: 0.94 } }, // chin drape (below the face)
  ],
  // A leafy ring with alternating blossoms.
  "flower-crown": [
    { shape: "torus", scale: [2.25, 0.55, 2.25], offset: [0, 0.8, -0.06], tint: { darken: 0.78 } }, // vine ring
    { shape: "sphere", scale: [0.34, 0.34, 0.34], offset: [1.05, 0.88, -0.06] },
    { shape: "sphere", scale: [0.34, 0.34, 0.34], offset: [-1.05, 0.88, -0.06], tint: "accent" },
    { shape: "sphere", scale: [0.34, 0.34, 0.34], offset: [0.42, 0.92, 0.92], tint: "accent" },
    { shape: "sphere", scale: [0.34, 0.34, 0.34], offset: [-0.42, 0.92, 0.92] },
    { shape: "sphere", scale: [0.34, 0.34, 0.34], offset: [0, 0.9, -1.1] },
  ],
  // Short felt cylinder, flat top, swinging tassel.
  fez: [
    { shape: "cylinder", scale: [1.5, 0.95, 1.5], offset: [0, 1.0, -0.05] },
    { shape: "sphere", scale: [1.42, 0.1, 1.42], offset: [0, 1.48, -0.05], tint: { darken: 0.8 } }, // top
    { shape: "sphere", scale: [0.2, 0.2, 0.2], offset: [0.66, 1.28, 0], tint: "accent" }, // tassel
  ],
  // The chef's toque: banded base + proud puff.
  toque: [
    { shape: "cylinder", scale: [1.5, 0.7, 1.5], offset: [0, 0.82, -0.05] },
    { shape: "sphere", scale: [1.95, 1.35, 1.95], offset: [0, 1.55, -0.05] }, // puff
  ],
  // Party cone with a pompom tip.
  party: [
    { shape: "cone", scale: [1.32, 1.7, 1.32], offset: [0, 1.35, -0.05] },
    { shape: "sphere", scale: [0.36, 0.36, 0.36], offset: [0, 2.24, -0.05], tint: "accent" }, // pompom
  ],
  // The starter trio gets real silhouettes too (was the generic dome):
  // visored street cap…
  cap: [
    { shape: "sphere", scale: [1.95, 1.15, 1.95], offset: [0, 0.6, -0.12] }, // dome
    { shape: "sphere", scale: [1.35, 0.14, 1.5], offset: [0, 0.42, 1.05], tint: { darken: 0.85 } }, // visor
  ],
  // …puffy baker's hat…
  baker: [
    { shape: "cylinder", scale: [1.45, 0.55, 1.45], offset: [0, 0.72, -0.05] },
    { shape: "sphere", scale: [1.85, 1.2, 1.85], offset: [0, 1.3, -0.05] },
  ],
  // …and the wide woven sun hat (shared by "sun" and the catalog "straw").
  sun: [
    { shape: "sphere", scale: [3.2, 0.16, 3.2], offset: [0, 0.55, -0.05] }, // wide brim
    { shape: "sphere", scale: [1.7, 1.0, 1.7], offset: [0, 0.85, -0.05] }, // round crown
    { shape: "torus", scale: [1.7, 0.5, 1.7], offset: [0, 0.62, -0.05], tint: "accent" }, // ribbon
  ],
}
// the catalog's straw hat shares the sun-hat silhouette
HAT_GARMENTS.straw = HAT_GARMENTS.sun

/* ---------------------------------------------------------------- outfits */

/**
 * Top/outfit families that get a silhouette beyond the plain bubble torso.
 * figure3d composes these with body measurements (torso/hip/leg), so they are
 * dispatched by family name; anything else renders the classic torso.
 */
export const OUTFIT_FAMILIES = [
  "dress",
  "sari",
  "overalls",
  "suit",
  "kurta",
  "apron-dress",
  "hoodie",
] as const
export type OutfitFamily = (typeof OUTFIT_FAMILIES)[number]

export function isOutfitFamily(garment: string): garment is OutfitFamily {
  return (OUTFIT_FAMILIES as readonly string[]).includes(garment)
}

/* ------------------------------------------------------------------- hair */

/** Every hair style the renderer + contract know. Length is the first axis a
 *  player picks (short/medium/long); the rest are classic volume styles. */
export const KNOWN_HAIR_STYLES = [
  "none",
  "bald",
  "short",
  "medium",
  "long",
  "curly",
  "tied",
  "bun",
  "braid",
] as const
export type KnownHairStyle = (typeof KNOWN_HAIR_STYLES)[number]

export function parseHairStyle(itemId: string): KnownHairStyle {
  const tail = itemId.replace(/^hair-/, "")
  return (KNOWN_HAIR_STYLES as readonly string[]).includes(tail)
    ? (tail as KnownHairStyle)
    : "short"
}

/* ------------------------------------------------- itemId → garment family */

/**
 * Cosmetic ids that don't follow the `<slot>-<family>` convention (the item
 * catalog predates it: "straw-hat", "top-hat", "sombrero-festive"…). Checked
 * before the generic prefix-strip.
 */
export const ITEM_GARMENT_ALIASES: Record<string, string> = {
  "straw-hat": "straw",
  "top-hat": "tophat",
  "tricorn-hat": "tricorn",
  "bonnet-lace": "bonnet",
  "feathered-cap": "feathered",
  "sombrero-festive": "sombrero",
  "flower-crown": "flower-crown",
  "chef-toque": "toque",
  "party-cone": "party",
  "sari-formal": "sari",
  "fancy-suit": "suit",
  "apron-dress": "apron-dress",
  "embroidered-blouse": "blouse",
  "linen-shirt": "shirt",
  "traveler-coat": "coat",
}

/** Garment families with a bespoke 3D shape (tests assert catalog coverage). */
export const KNOWN_GARMENTS: readonly string[] = [
  ...Object.keys(HAT_GARMENTS),
  ...OUTFIT_FAMILIES,
]

/* ---------------------------------------------------------------- fabrics */

/**
 * The expanded wardrobe palette — wholesome warm/cool/jewel/neutral fabric
 * tints for NEW cosmetics. These are dress-up swatches only; the SCENE
 * palette (ground/sky/accent) is byte-locked elsewhere and never sourced
 * from here.
 */
export const FABRICS: readonly string[] = [
  // warms
  "#c0392b", "#c46b4a", "#d98f57", "#e0c060", "#b9492f", "#c97f3a",
  // cools
  "#3f7fae", "#46647e", "#2a8a8a", "#3a6ea5", "#5a7d9a", "#4a6a8a",
  // greens
  "#577f40", "#6f9c54", "#5a7d6e", "#2a8a6a",
  // jewels
  "#8a6aa8", "#7a3b48", "#8e44ad", "#5a3a7a", "#c0455a",
  // neutrals
  "#f2ede0", "#dcd2bc", "#9c6b3f", "#5a4632", "#22303f", "#2a2a32",
]
