import type { AvatarSpec, CosmeticSlot } from "@world-plaza/contracts"

/**
 * characterSpec — the ONE character data model for World Plaza.
 *
 * The player (onboarding dress-up) and every NPC are the same kind of thing: a
 * `CharacterSpec`. It is render-ready, fully resolved (colours, not item refs),
 * so `characterArt.ts` can paint it with no further lookups. It is the layer the
 * `AvatarSpec` contract (broadcastable, item-id based) maps INTO at render time.
 *
 * Why two shapes?
 *   • `AvatarSpec` (contract) = the durable, tiny, network-safe identity:
 *     `{ base, layers:[{slot,itemId,tint}] }`. What gets stored + broadcast.
 *   • `CharacterSpec` (this) = the resolved paper-doll the renderer draws: skin,
 *     build, hair, face, clothing palettes, props. Derived from an AvatarSpec
 *     (player) OR generated from (role, seed, theme) (NPCs). Cosmetic slots map
 *     1:1 onto clothing layers, so an unlocked hat the player wears is the same
 *     hat slot an NPC can wear.
 */

/* ----------------------------------------------------------------- palettes */

/** A clothing layer: which garment shape + its colours. */
export interface ClothingLayer {
  /** garment id (shape family the renderer knows, e.g. "tunic","coat","cap"). */
  item: string
  /** primary fabric colour. */
  color: string
  /** secondary (trim/lining/shade) colour. */
  accent?: string
  /** optional pattern hint ("stripe" | "plain" | "check"). */
  pattern?: "plain" | "stripe" | "check" | "trim"
}

/** Body proportions — small, readable variety (paper-cutout, not anatomy). */
export type Build = "slim" | "average" | "stocky" | "tall" | "child"

export interface HairSpec {
  /** style family the renderer knows. */
  style: "none" | "short" | "bun" | "long" | "curly" | "tied" | "bald" | "braid"
  color: string
}

/**
 * Resting expression. The DEFAULT population is wholesome + SYMMETRIC: the curve
 * of the mouth and the tilt of the brows mirror left↔right. The eye reads warmth
 * and variety, never a sneering mob.
 *
 * `smirk` / `sneer` are the ONLY asymmetric (one-sided) expressions — they read
 * as sly/contemptuous and are RESERVED for explicitly sly/villain characters.
 * `characterGen` makes them rare (small minority of the crowd).
 */
export type Expression =
  // ── symmetric, wholesome default set ──
  | "neutral" // flat, calm
  | "smile" // gentle upturned arc
  | "grin" // wide warm smile (teeth hint)
  | "content" // soft closed-mouth ease
  | "shy" // small, bashful smile + raised inner brows
  | "frown" // symmetric downturn (gruff/dockhand) — not mean, just tired/serious
  | "surprised" // small round "oh" mouth, lifted brows
  | "sleepy" // droopy lids, relaxed mouth
  // ── RARE asymmetric set (sly / mean only) ──
  | "smirk" // one corner lifted — sly
  | "sneer" // one corner up + one brow raised — villain
  /** back-compat aliases (older specs / avatar map). Treated as wholesome. */
  | "warm"
  | "cheery"
  | "stern"
  | "tired"
  | "sly"

/**
 * Eye silhouette family. A curated, cute "paper-person" set — every one reads
 * warm at rest; none is the squinty/narrow villain default. Symmetric for all
 * wholesome demeanors (the §0.3 / "no murderous mob" guardrail extends here).
 */
export type EyeShape = "round" | "almond" | "wide" | "soft" | "upturned" | "downturned"

/** Nose silhouette family — a small mark, never a caricature. */
export type NoseStyle = "button" | "straight" | "soft" | "broad" | "petite"

/** Head/face silhouette — a gentle reshape of the head cutout, clamped cute. */
export type FaceShape = "round" | "oval" | "soft-square" | "heart" | "long"

/** Brow silhouette layered on the `brow` weight. */
export type BrowShape = "straight" | "soft" | "arched" | "rounded"

/**
 * Age band — gates wrinkles, brow set, lid heaviness, and (via characterGen) hair
 * greying + beard density together, so axes stay coherent (no child with a grey
 * beard). Purely visual softening, never unflattering.
 */
export type AgeBand = "child" | "young" | "adult" | "elder"

export interface FaceSpec {
  /** resting expression baseline; animator overrides the MOUTH per-frame for talk. */
  expression: Expression
  /** eyebrow weight 0..0.3 (character — thickness/presence of the brow). */
  brow: number
  /** rosy cheeks. */
  cheeks: boolean
  /** optional facial hair. */
  beard?: "none" | "stubble" | "mustache" | "full"

  /* ── richer parametric kit (all optional → full back-compat) ──────────── */

  /** eye silhouette family. default "round". */
  eyeShape?: EyeShape
  /** eye size multiplier ~0.82..1.22 (clamped cute). default 1. */
  eyeSize?: number
  /** eye spacing multiplier ~0.86..1.14 (clamped — never uncanny). default 1. */
  eyeSpacing?: number
  /** nose silhouette family. default "soft". */
  noseStyle?: NoseStyle
  /** head/face silhouette. default "round". */
  faceShape?: FaceShape
  /** brow silhouette (layered on `brow` weight). default "soft". */
  browShape?: BrowShape
  /** age band — drives wrinkles/lid/brow-set + (in gen) hair/beard. default "adult". */
  ageBand?: AgeBand
  /** lip fullness ~0.8..1.3. default 1. */
  lipFullness?: number
  /** freckles across the nose/cheeks (rare, warm garnish). */
  freckles?: boolean
  /** a single beauty mark (rare garnish). */
  beautyMark?: boolean
  /** dimples flanking a smile (warm garnish). */
  dimples?: boolean
  /** iris/eye tint (warm browns/greens/blues). default a warm brown. */
  eyeColor?: string
}

/**
 * A character's social demeanor — a small personality trait that BIASES the
 * resting expression and is set in `characterGen` from role + seed. Wholesome-
 * heavy: `sly` (and the asymmetric smirk/sneer it unlocks) is rare.
 */
export type Demeanor = "friendly" | "cheery" | "gruff" | "shy" | "sly" | "sleepy"

/** The clothing layer slots, mapped from CosmeticSlot. */
export interface Clothing {
  top?: ClothingLayer
  bottom?: ClothingLayer
  outer?: ClothingLayer // coat/cloak/apron-as-outer
  hat?: ClothingLayer
  accessory?: ClothingLayer // scarf, sash, glasses…
}

/** Held / worn props that give a role its read at a glance. */
export type PropKind =
  | "none"
  | "bread"
  | "needle"
  | "satchel"
  | "basket"
  | "tool"
  | "scroll"
  | "lantern"
  | "broom"
  | "fan"
  | "book"

export interface CharacterSpec {
  /** stable id for this character (player id or `npc:<seed>`). */
  id: string
  skinTone: string
  build: Build
  hair: HairSpec
  face: FaceSpec
  /** social demeanor — biases resting expression; partial personality read. */
  demeanor?: Demeanor
  clothing: Clothing
  /** apron over the torso (vendor/baker read), distinct from outer coat. */
  apron?: { color: string; accent?: string }
  prop: PropKind
  /** the role this character is bound to (for dialogue routing); "" for crowd. */
  role: string
}

/* --------------------------------------------- AvatarSpec → CharacterSpec map */

/**
 * Map a CosmeticSlot to the CharacterSpec clothing slot it drives. `face`/`hair`
 * are handled specially (skin tone / hair), the rest land in `clothing`.
 */
const SLOT_TO_CLOTHING: Partial<Record<CosmeticSlot, keyof Clothing>> = {
  hat: "hat",
  top: "top",
  bottom: "bottom",
  accessory: "accessory",
  // `shoes` and `aura` have no paper-doll garment yet; ignored gracefully.
}

/** Garment shape family for a cosmetic item id (best-effort; default per slot). */
function itemToGarment(slot: CosmeticSlot, itemId: string): string {
  const tail = itemId.replace(/^[a-z]+-/, "") // "top-tunic" → "tunic"
  return tail || slot
}

/**
 * Resolve a broadcast `AvatarSpec` into a render-ready `CharacterSpec`. This is
 * how the PLAYER's dressed avatar becomes their in-world body — one system.
 */
export function avatarToCharacterSpec(avatar: AvatarSpec, id: string): CharacterSpec {
  const palette = avatar.palette ?? {}
  const skin = palette.skin ?? "#f0c79a"

  const spec: CharacterSpec = {
    id,
    skinTone: skin,
    build: "average",
    hair: { style: "short", color: palette.hair ?? "#43301d" },
    face: { expression: "smile", brow: 0.12, cheeks: true, beard: "none" },
    demeanor: "friendly",
    clothing: {},
    prop: "none",
    role: "player",
  }

  for (const layer of avatar.layers) {
    if (layer.slot === "face") {
      if (layer.tint) spec.skinTone = layer.tint
      continue
    }
    if (layer.slot === "hair") {
      spec.hair = { style: "short", color: layer.tint ?? spec.hair.color }
      continue
    }
    const clothingSlot = SLOT_TO_CLOTHING[layer.slot]
    if (!clothingSlot) continue
    const garment = itemToGarment(layer.slot, layer.itemId)
    if (garment === "none") continue
    spec.clothing[clothingSlot] = {
      item: garment,
      color: layer.tint ?? "#cbb083",
    }
  }

  return spec
}
