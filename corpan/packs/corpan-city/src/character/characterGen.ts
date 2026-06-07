import type {
  CharacterSpec,
  Build,
  HairSpec,
  FaceSpec,
  Clothing,
  ClothingLayer,
  PropKind,
  Demeanor,
  Expression,
  EyeShape,
  NoseStyle,
  FaceShape,
  BrowShape,
  AgeBand,
} from "./characterSpec"

/**
 * characterGen — deterministic, INFINITE, never-repetitive character variety.
 *
 * `generateCharacter(role, seed, theme)` → a unique CharacterSpec. Same inputs
 * always yield the same person (so a wandering agent is stable across frames and
 * reloads); different seeds yield visibly distinct people. The space is huge:
 * skin × build × hair(style×colour) × face × top × bottom × outer × hat ×
 * accessory × prop — millions of combinations — so a plaza of 40 has no twins.
 *
 * A WardrobeTheme (palette + garment vocabulary) drives ERA-appropriate dress.
 * Antigua-1770 colonial is the active theme; the SAME generator reskins to
 * Tokyo-2050 etc. by swapping the theme — the role logic is era-agnostic.
 */

/* ----------------------------------------------------------------- PRNG ---- */

/** Tiny fast deterministic hash → 32-bit. */
function hashStr(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** mulberry32 — small, well-distributed seedable PRNG. */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Rand = () => number
const pick = <T>(r: Rand, arr: readonly T[]): T => arr[Math.floor(r() * arr.length)]
const chance = (r: Rand, p: number) => r() < p

/** Shade a hex colour by a factor (lighten >1, darken <1) — for accents. */
function shade(hex: string, f: number): string {
  const n = parseInt(hex.replace("#", ""), 16)
  const cl = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
  const r = cl(((n >> 16) & 255) * f)
  const g = cl(((n >> 8) & 255) * f)
  const b = cl((n & 255) * f)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`
}

/* ------------------------------------------------------------- theme ------- */

/**
 * A wardrobe theme: the palette + garment vocabulary of a world/era. Roles draw
 * from these so everyone is "dressed for the world."
 */
export interface WardrobeTheme {
  id: string
  /** skin tones present in this population. */
  skins: readonly string[]
  /** hair colours. */
  hairColors: readonly string[]
  /** garment shape families allowed (renderer-known). */
  tops: readonly string[]
  bottoms: readonly string[]
  outers: readonly string[]
  hats: readonly string[]
  accessories: readonly string[]
  /** broad fabric palette for clothes; role tints bias within. */
  fabrics: readonly string[]
  /** muted/earthy vs bright — multiplies saturation feel via accent shade. */
  accentShade: number
}

/** Antigua-Guatemala, ~1770 colonial: earthy linens, indigo, ochre, terracotta. */
export const ANTIGUA_1770: WardrobeTheme = {
  id: "antigua-1770",
  skins: ["#f4d6b0", "#f0c79a", "#e3ad79", "#c98a55", "#a06a3c", "#7a4a26"],
  hairColors: ["#2a1c12", "#3a2a1c", "#4a3322", "#5a3b24", "#1c1410", "#6e5238", "#8a8480"],
  tops: ["tunic", "blouse", "shirt", "huipil"],
  bottoms: ["skirt", "trousers", "breeches", "wrap"],
  outers: ["none", "none", "shawl", "vest", "rebozo"],
  hats: ["none", "none", "straw", "tricorn", "kerchief", "coif"],
  accessories: ["none", "none", "sash", "scarf", "necklace", "shawlpin"],
  fabrics: [
    "#b9492f", // terracotta
    "#c97f3a", // ochre
    "#3f6079", // indigo
    "#6f8a4e", // olive
    "#8a5a8c", // muted plum
    "#c4a35a", // wheat
    "#9c5a3c", // clay
    "#5a7d6e", // sage teal
    "#7a3b48", // wine
    "#d6c2a0", // raw linen
  ],
  accentShade: 0.78,
}

/* ---------------------------------------------------- role wardrobe biases -- */

/**
 * Per-role biases: which garments/props/props a role tends toward, layered ON
 * TOP of the theme so a "vendor" reads as a vendor in any era. Pure biasing —
 * the generator still randomizes within these for infinite variety.
 */
interface RoleBias {
  apron?: number // probability of an apron
  props: readonly PropKind[]
  hatBias?: number // probability of wearing a hat
  outerBias?: number
  build?: readonly Build[]
  /**
   * DEMEANOR distribution — a weighted bag the generator picks from. List an
   * entry multiple times to weight it. `sly` (the only one that can unlock the
   * rare asymmetric smirk/sneer) appears at most ONCE per role, so a smirk is a
   * small minority. Default crowds are wholesome-heavy (friendly/cheery/shy).
   */
  demeanor?: readonly Demeanor[]
}

const ROLE_BIAS: Record<string, RoleBias> = {
  vendor: {
    apron: 0.8,
    props: ["basket", "bread", "scroll", "fan", "none"],
    hatBias: 0.55,
    build: ["average", "stocky", "tall", "slim"],
    // a merchant gives a warm grin; a rare one is a sly haggler
    demeanor: ["cheery", "cheery", "friendly", "friendly", "gruff", "sly"],
  },
  npc_station: {
    apron: 0.25,
    props: ["scroll", "book", "lantern", "none", "fan"],
    hatBias: 0.6,
    outerBias: 0.5,
    demeanor: ["friendly", "friendly", "cheery", "gruff", "shy", "sly"],
  },
  cafe_counter: {
    apron: 0.95,
    props: ["bread", "none"],
    hatBias: 0.7,
    // a baker beams
    demeanor: ["cheery", "cheery", "cheery", "friendly", "friendly"],
  },
  tailor: {
    apron: 0.7,
    props: ["needle", "none"],
    outerBias: 0.6,
    demeanor: ["friendly", "friendly", "shy", "gruff", "cheery"],
  },
  traveler: {
    apron: 0.05,
    props: ["satchel", "scroll", "lantern"],
    hatBias: 0.85,
    outerBias: 0.7,
    build: ["average", "tall", "slim"],
    demeanor: ["friendly", "cheery", "sleepy", "gruff", "shy", "sly"],
  },
  // a dockhand frowns — gruff-leaning, but still mostly good-natured
  dock: {
    apron: 0.1,
    props: ["basket", "satchel", "broom", "none"],
    hatBias: 0.5,
    build: ["stocky", "average", "tall"],
    demeanor: ["gruff", "gruff", "friendly", "sleepy", "cheery"],
  },
  // the one smuggler smirks — sly-leaning, used sparingly by callers
  smuggler: {
    apron: 0.0,
    props: ["satchel", "lantern", "none"],
    hatBias: 0.7,
    outerBias: 0.8,
    build: ["slim", "average"],
    demeanor: ["sly", "sly", "gruff"],
  },
  // generic wanderer / crowd — WHOLESOME-HEAVY mixed friendly crowd
  crowd: {
    apron: 0.12,
    props: ["none", "none", "basket", "satchel", "broom", "book", "fan", "scroll"],
    hatBias: 0.4,
    outerBias: 0.35,
    // friendly+cheery dominate; shy/sleepy/gruff garnish; sly is a single rare entry
    demeanor: [
      "friendly", "friendly", "friendly", "friendly",
      "cheery", "cheery", "cheery",
      "shy", "shy",
      "sleepy",
      "gruff",
      "sly",
    ],
  },
}

/**
 * Resolve a demeanor → a concrete resting Expression, using the seed for variety
 * WITHIN a demeanor. Wholesome demeanors NEVER yield an asymmetric mouth. Only
 * `sly` can (rarely) produce the asymmetric smirk/sneer — and even a sly person
 * is usually just a knowing half-lidded smile, not a sneer.
 */
function expressionFor(r: Rand, demeanor: Demeanor): Expression {
  switch (demeanor) {
    case "friendly":
      return pick(r, ["smile", "smile", "smile", "neutral", "content", "warm"] as const)
    case "cheery":
      return pick(r, ["grin", "grin", "smile", "cheery", "content"] as const)
    case "shy":
      return pick(r, ["shy", "shy", "smile", "content"] as const)
    case "sleepy":
      return pick(r, ["sleepy", "sleepy", "content", "neutral"] as const)
    case "gruff":
      // gruff = serious/tired, NOT mean — symmetric frown, never a sneer
      return pick(r, ["frown", "neutral", "neutral", "frown", "content"] as const)
    case "sly":
      // the rare one: mostly a sly-but-symmetric smile; occasionally a true smirk;
      // a sneer only on the rarest roll (the villain read)
      return pick(r, [
        "smirk", "smirk", "smile", "content", "neutral", "sneer",
      ] as const)
    default:
      return "smile"
  }
}

const BUILDS: readonly Build[] = ["slim", "average", "average", "stocky", "tall"]

/* ---------------------------------------------------------- FACE KIT (§1) -- *
 * Curated, weighted bags for the richer parametric face. Variety is COMBINATORIAL
 * and ART-DIRECTED: every bag is wholesome by construction, the "samey/ugly/
 * murderous" failure mode is engineered out (no narrow squint default, no one-
 * sided features, age-coherent greying/beards). Tens of millions of distinct
 * faces per Theme from a few dozen pieces.
 * --------------------------------------------------------------------------- */

// Eye shapes — all read warm; "round"/"soft" dominate (cutest), the rest garnish.
const EYE_SHAPES: readonly EyeShape[] = [
  "round", "round", "round", "soft", "soft", "almond", "almond", "wide", "upturned", "downturned",
]
// Warm iris palette (browns/hazel/green/blue) — biased to brown, never grey/cold.
const EYE_COLORS: readonly string[] = [
  "#4a3322", "#3a2a1c", "#5a3b24", "#6e4a2c", "#4a3322", "#3a2a1c", // browns (dominant)
  "#5a6e3c", "#4a6a4a", // greens
  "#3f5a79", // blue (rare)
  "#6e5238", // hazel
]
const NOSE_STYLES: readonly NoseStyle[] = [
  "soft", "soft", "button", "button", "straight", "petite", "broad",
]
const FACE_SHAPES: readonly FaceShape[] = [
  "round", "round", "oval", "oval", "heart", "soft-square", "long",
]
const BROW_SHAPES: readonly BrowShape[] = [
  "soft", "soft", "soft", "straight", "arched", "rounded",
]
// Age skew: an adult-heavy plaza with young/elder garnish + occasional child.
const AGE_BANDS: readonly AgeBand[] = [
  "adult", "adult", "adult", "adult", "young", "young", "young", "elder", "child",
]

/** Greying hair colours for elders (mixed into theme.hairColors when old). */
const GREY_HAIRS: readonly string[] = ["#8a8480", "#9c968e", "#b7b2aa", "#cfcac2"]

/**
 * Generate the rich parametric FACE for a character. AGE-COHERENT: an elder may
 * grey + carry a fuller beard; a child never greys or beards. SYMMETRIC by
 * construction — the renderer mirrors every eye/brow/lip, so a wholesome face can
 * never go one-sided (only the rare sly demeanor's `skew` does, in the renderer).
 */
function generateFace(r: Rand, demeanor: Demeanor, theme: WardrobeTheme): {
  face: FaceSpec
  ageBand: AgeBand
  hairOverride?: string
} {
  const ageBand: AgeBand = pick(r, AGE_BANDS)
  const isChild = ageBand === "child"
  const isElder = ageBand === "elder"

  // Children skew cuter: bigger eyes, button noses, rounder face; never a beard.
  const eyeShape: EyeShape = isChild
    ? pick(r, ["round", "round", "round", "soft", "wide"] as const)
    : pick(r, EYE_SHAPES)
  const eyeSize = (isChild ? 1.08 : 1.0) + (r() - 0.5) * 0.28 // ~0.86..1.22
  const eyeSpacing = 1 + (r() - 0.5) * 0.24 // ~0.88..1.12
  const noseStyle: NoseStyle = isChild ? pick(r, ["button", "soft", "petite"] as const) : pick(r, NOSE_STYLES)
  const faceShape: FaceShape = isChild ? pick(r, ["round", "round", "oval", "heart"] as const) : pick(r, FACE_SHAPES)
  const browShape: BrowShape = pick(r, BROW_SHAPES)
  const lipFullness = 0.85 + r() * 0.4 // ~0.85..1.25

  // garnish toggles — rarity-weighted so they stay special, not noise.
  const freckles = !isElder && chance(r, ageBand === "child" || ageBand === "young" ? 0.22 : 0.12)
  const beautyMark = chance(r, 0.07)
  const dimples = chance(r, 0.2)

  // age-coherent beard: only adult/elder men-ish; elders denser; child/young → none.
  let beard: FaceSpec["beard"] = "none"
  if (!isChild && ageBand !== "young") {
    if (chance(r, isElder ? 0.34 : 0.2)) beard = pick(r, isElder ? (["full", "full", "mustache"] as const) : (["stubble", "mustache", "full"] as const))
  }

  // age-coherent hair: elders may grey; children get richer young colour.
  const hairOverride = isElder && chance(r, 0.6) ? pick(r, GREY_HAIRS) : undefined
  void theme

  const face: FaceSpec = {
    expression: expressionFor(r, demeanor),
    brow: (isElder ? 0.12 : 0.06) + r() * 0.2,
    cheeks: chance(r, isChild ? 0.85 : 0.66),
    beard,
    eyeShape,
    eyeSize,
    eyeSpacing,
    noseStyle,
    faceShape,
    browShape,
    ageBand,
    lipFullness,
    freckles,
    beautyMark,
    dimples,
    eyeColor: pick(r, EYE_COLORS),
  }
  return { face, ageBand, hairOverride }
}

/* ------------------------------------------------------------- generator --- */

function makeLayer(r: Rand, theme: WardrobeTheme, item: string, fabric?: string): ClothingLayer {
  if (item === "none") return { item: "none", color: "transparent" }
  const color = fabric ?? pick(r, theme.fabrics)
  const pattern = chance(r, 0.22) ? pick(r, ["stripe", "check", "trim"] as const) : "plain"
  return { item, color, accent: shade(color, theme.accentShade), pattern }
}

/**
 * Generate a unique, deterministic CharacterSpec.
 * @param role  one of ROLE_BIAS keys, or any NpcRole.anchorId role; unknown → crowd.
 * @param seed  any string (e.g. "vendor_13" or "crowd:7") — same seed = same person.
 * @param theme wardrobe theme (defaults to Antigua-1770).
 */
export function generateCharacter(
  role: string,
  seed: string,
  theme: WardrobeTheme = ANTIGUA_1770,
): CharacterSpec {
  const r = rng(hashStr(`${theme.id}|${role}|${seed}`))
  const bias = ROLE_BIAS[role] ?? ROLE_BIAS.crowd

  const skinTone = pick(r, theme.skins)

  // Demeanor → resting expression. Wholesome-heavy by construction (see ROLE_BIAS).
  const demeanor: Demeanor = pick(r, bias.demeanor ?? ROLE_BIAS.crowd.demeanor!)

  // Rich parametric face + its age band (drives build + hair coherence below).
  const { face, ageBand, hairOverride } = generateFace(r, demeanor, theme)

  // Build — age-coherent: a "child" face implies the child build.
  const build: Build = ageBand === "child" ? "child" : pick(r, bias.build ?? BUILDS)

  // Hair: occasionally bald/covered; style + colour from theme (elders may grey).
  const hairStyles: HairSpec["style"][] = ["short", "short", "bun", "long", "curly", "tied", "braid"]
  const bald = ageBand === "elder" ? chance(r, 0.18) : chance(r, 0.05)
  const hair: HairSpec = {
    style: bald ? "bald" : pick(r, hairStyles),
    color: hairOverride ?? pick(r, theme.hairColors),
  }

  // Clothing — one fabric anchors the outfit; others harmonize/contrast.
  const baseFabric = pick(r, theme.fabrics)
  const clothing: Clothing = {
    top: makeLayer(r, theme, pick(r, theme.tops), baseFabric),
    bottom: makeLayer(r, theme, pick(r, theme.bottoms)),
  }
  if (chance(r, bias.outerBias ?? 0.3)) {
    const outer = pick(r, theme.outers)
    if (outer !== "none") clothing.outer = makeLayer(r, theme, outer)
  }
  if (chance(r, bias.hatBias ?? 0.4)) {
    const hat = pick(r, theme.hats)
    if (hat !== "none") clothing.hat = makeLayer(r, theme, hat)
  }
  {
    const acc = pick(r, theme.accessories)
    if (acc !== "none" && chance(r, 0.55)) clothing.accessory = makeLayer(r, theme, acc)
  }

  const apron =
    chance(r, bias.apron ?? 0.1)
      ? { color: pick(r, ["#f3ead2", "#e8dcc0", "#cbb083", "#9c6b3f", "#3f4a52"]), accent: undefined }
      : undefined

  const prop: PropKind = pick(r, bias.props)

  return {
    id: `npc:${seed}`,
    skinTone,
    build,
    hair,
    face,
    demeanor,
    clothing,
    apron,
    prop,
    role,
  }
}
