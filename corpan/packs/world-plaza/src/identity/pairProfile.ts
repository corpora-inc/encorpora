import type { AvatarSpec, AvatarLayer, GeneratedIdentity, LearnerPair } from "@world-plaza/contracts"
import type { CharacterSpec } from "../character/characterSpec"
import { generateCharacter, ANTIGUA_1770, type WardrobeTheme } from "../character/characterGen"
import pairProfilesJson from "../../content/identity/pairProfiles.json"
import namesJson from "../../content/identity/names.json"
import starterJson from "../../content/cosmetics/starter.json"
import starterGrantsJson from "../../content/economy/starterGrants.json"

/**
 * pairProfile — the PURE resolver for R2-6 Pair Identity (see docs/PAIR_IDENTITY.md).
 *
 * A `{target, native}` language pair maps to a DISTINCT character: a culturally
 * themed (to the TARGET) name pool, a wardrobe theme, a starter cosmetic kit, and
 * a starting inventory grant. This module owns ONLY that lookup + a pair-stable,
 * seeded DEFAULT persona builder. It is a self-contained data adapter — it imports
 * the world's generators (`generateCharacter`) and contracts read-only and nothing
 * from `game.ts` / the orchestrator (the same posture as `entry/stackAdapter.ts`).
 *
 * SAFETY (the hardest invariant): names are ALWAYS composed `<Adjective> <Noun>`
 * (+ optional number) from FIXED, curated pools — never freeform, never a real
 * name, never identifying. Per-language pools only localize the WORD; the
 * construction is language-agnostic. Unknown ids fall back to `pool-universal`
 * with a loud warn, so a name can never become unreadable.
 *
 * DAY-ONE-WORKS: every layer degrades to a known-good default, so all 2,450 pairs
 * function before a single bespoke row exists. `profileForPair` ALWAYS returns a
 * complete `PairProfile`; every consumer treats every id as possibly-unknown.
 *
 * INERT: nothing in the trunk imports this yet. The Track-birth wiring (seed
 * `TrackState.identity/avatar` + apply the grant once for a FRESH Track) is handed
 * to integration as a documented snippet — see PAIR_IDENTITY.md §3 / §9.
 */

const LOG = "[wp/identity/pairProfile]"

/* ----------------------------------------------------------------- types */

/** What a pair resolves to — the ingredients of its persona. */
export interface PairProfile {
  /** name pool id in names.json (`pool-universal` | `pool-es` | …). */
  namePoolId: string
  /** a `WardrobeTheme` id known to characterGen (soft hint for the player's dress). */
  themeId: string
  /** starter cosmetic kit id in starter.json (`kit-traveler` | …). */
  starterKitId: string
  /** starter inventory grant id in starterGrants.json (`grant-traveler` | …). */
  starterGrantId: string
}

/** A curated name word — `id` is the durable seed, `label` the displayed word. */
interface Word {
  id: string
  label: string
}
interface NamePool {
  adjectives: Word[]
  nouns: Word[]
}

/** The Reward shape a starter grant carries (mirrors `economy/inventory.ts :: Reward`
 *  WITHOUT importing it — this module must stay free of the economy runtime so it
 *  can be unit-tested in isolation; the grant is plain data the caller applies). */
export interface StarterGrant {
  xp?: number
  currency?: Record<string, number>
  items?: string[]
}

/** A fully-built default persona for a fresh Track (no UI required). */
export interface SeededPersona {
  identity: GeneratedIdentity
  avatar: AvatarSpec
  /** the grant to apply ONCE to the new Track's inventory (already validated-ish:
   *  unknown currencies/items are NOT pruned here — the economy `applyReward`
   *  already drops unknowns with a warn; we keep the grant honest to the data). */
  grant: StarterGrant
  /** the resolved profile, for callers that want to record `bornProfile`. */
  profile: PairProfile
}

/* ----------------------------------------------------- load + validate data */

const HARDCODED_DEFAULT: PairProfile = {
  namePoolId: "pool-universal",
  themeId: "antigua-1770",
  starterKitId: "kit-traveler",
  starterGrantId: "grant-traveler",
}

function isProfileShape(v: unknown): v is PairProfile {
  if (!v || typeof v !== "object") return false
  const p = v as Record<string, unknown>
  return (
    typeof p.namePoolId === "string" &&
    typeof p.themeId === "string" &&
    typeof p.starterKitId === "string" &&
    typeof p.starterGrantId === "string"
  )
}

/** The loaded pairProfiles table: `_default` + per-target rows. Falls back hard. */
const PROFILES: { defaultProfile: PairProfile; targets: Record<string, PairProfile> } = (() => {
  const raw = pairProfilesJson as {
    _default?: unknown
    targets?: Record<string, unknown>
  }
  const defaultProfile = isProfileShape(raw._default) ? raw._default : HARDCODED_DEFAULT
  if (!isProfileShape(raw._default)) {
    console.warn(`${LOG} pairProfiles.json has no/invalid _default — using hardcoded default`, raw._default)
  }
  const targets: Record<string, PairProfile> = {}
  for (const [code, row] of Object.entries(raw.targets ?? {})) {
    if (isProfileShape(row)) targets[code] = row
    else console.warn(`${LOG} dropping invalid pairProfiles target row "${code}"`, row)
  }
  return { defaultProfile, targets }
})()

/** The loaded name pools, keyed by pool id. `pool-universal` is the fallback. */
const POOLS: Record<string, NamePool> = (() => {
  const raw = namesJson as {
    schemaV?: number
    pools?: Record<string, unknown>
    // legacy flat shape (schemaV 1 / pre-R2-6): top-level adjectives+nouns
    adjectives?: Word[]
    nouns?: Word[]
  }
  const out: Record<string, NamePool> = {}
  const asPool = (v: unknown): NamePool | null => {
    if (!v || typeof v !== "object") return null
    const p = v as { adjectives?: unknown; nouns?: unknown }
    if (!Array.isArray(p.adjectives) || !Array.isArray(p.nouns)) return null
    const words = (arr: unknown[]): Word[] =>
      arr.filter(
        (w): w is Word =>
          !!w && typeof w === "object" && typeof (w as Word).id === "string" && typeof (w as Word).label === "string",
      )
    return { adjectives: words(p.adjectives), nouns: words(p.nouns) }
  }
  if (raw.pools && typeof raw.pools === "object") {
    for (const [id, v] of Object.entries(raw.pools)) {
      const pool = asPool(v)
      if (pool && pool.adjectives.length && pool.nouns.length) out[id] = pool
      else console.warn(`${LOG} dropping empty/invalid name pool "${id}"`)
    }
  }
  // LOUD-BUT-SAFE migration: a legacy flat names.json becomes `pool-universal`.
  if (!out["pool-universal"]) {
    const legacy = asPool({ adjectives: raw.adjectives, nouns: raw.nouns })
    if (legacy && legacy.adjectives.length && legacy.nouns.length) {
      console.warn(`${LOG} names.json missing pool-universal — migrating legacy flat lists into it`)
      out["pool-universal"] = legacy
    }
  }
  if (!out["pool-universal"]) {
    // Absolute last resort so name rolls never throw (should never happen with the
    // bundled data). One safe storybook pair keeps the construction valid.
    console.error(`${LOG} no usable name pool found — falling back to a minimal safe pool`)
    out["pool-universal"] = {
      adjectives: [{ id: "adj-brave", label: "Brave" }],
      nouns: [{ id: "noun-otter", label: "Otter" }],
    }
  }
  return out
})()

/** The loaded starter grants, keyed by grant id. `grant-traveler` is the fallback. */
const GRANTS: Record<string, StarterGrant> = (() => {
  const raw = starterGrantsJson as { grants?: Record<string, unknown> }
  const out: Record<string, StarterGrant> = {}
  for (const [id, v] of Object.entries(raw.grants ?? {})) {
    if (!v || typeof v !== "object") {
      console.warn(`${LOG} dropping invalid starter grant "${id}"`)
      continue
    }
    const g = v as { xp?: unknown; currency?: unknown; items?: unknown }
    const grant: StarterGrant = {}
    if (typeof g.xp === "number" && g.xp > 0) grant.xp = g.xp
    if (g.currency && typeof g.currency === "object") {
      const cur: Record<string, number> = {}
      for (const [cid, units] of Object.entries(g.currency as Record<string, unknown>)) {
        if (typeof units === "number" && units > 0) cur[cid] = Math.floor(units)
      }
      if (Object.keys(cur).length) grant.currency = cur
    }
    if (Array.isArray(g.items)) {
      const items = g.items.filter((s): s is string => typeof s === "string" && s.length > 0)
      if (items.length) grant.items = items
    }
    out[id] = grant
  }
  return out
})()

/** Known WardrobeTheme ids (only `antigua-1770` ships today; others are forward hints). */
const THEMES: Record<string, WardrobeTheme> = {
  [ANTIGUA_1770.id]: ANTIGUA_1770,
}

/* -------------------------------------------------------------- resolution */

/**
 * Resolve a pair → its persona profile. Keys on the TARGET (PAIR_IDENTITY.md §1);
 * for a single-language / immersion pair `target === native`, so the one language's
 * row (or `_default`) is used with no special case. ALWAYS returns a complete
 * profile (unknown target → `_default`), so every one of the 2,450 pairs works.
 */
export function profileForPair(pair: LearnerPair): PairProfile {
  const target = typeof pair?.target === "string" ? pair.target : ""
  const row = PROFILES.targets[target]
  if (!row) return { ...PROFILES.defaultProfile }
  return { ...row }
}

/** The name pool for a pool id, falling back to `pool-universal` with a warn. */
export function namePoolFor(poolId: string): NamePool {
  const pool = POOLS[poolId]
  if (pool) return pool
  if (poolId !== "pool-universal") {
    console.warn(`${LOG} unknown name pool "${poolId}" — falling back to pool-universal`)
  }
  return POOLS["pool-universal"]
}

/** The starter grant for a grant id, falling back to `grant-traveler` then empty. */
export function starterGrantFor(grantId: string): StarterGrant {
  const grant = GRANTS[grantId]
  if (grant) return grant
  if (grantId !== "grant-traveler") {
    console.warn(`${LOG} unknown starter grant "${grantId}" — falling back to grant-traveler`)
  }
  return GRANTS["grant-traveler"] ?? {}
}

/** The starter cosmetic kit (items) for a kit id, falling back to `kit-traveler`.
 *  Returns the raw item rows (validated against the CosmeticItem contract by the
 *  onboarding loader; here we only shape-check so the resolver stays decoupled). */
export function starterKitItemsFor(kitId: string): unknown[] {
  const raw = starterJson as {
    kits?: Record<string, { items?: unknown[] }>
    items?: unknown[] // legacy flat shape
  }
  const kits = raw.kits
  if (kits && typeof kits === "object") {
    const kit = kits[kitId]
    if (kit && Array.isArray(kit.items)) return kit.items
    if (kitId !== "kit-traveler") {
      console.warn(`${LOG} unknown starter kit "${kitId}" — falling back to kit-traveler`)
    }
    const fallback = kits["kit-traveler"]
    if (fallback && Array.isArray(fallback.items)) return fallback.items
  }
  // LOUD-BUT-SAFE migration: a legacy flat starter.json is the traveler kit.
  if (Array.isArray(raw.items)) {
    console.warn(`${LOG} starter.json has no kits — using legacy flat items as kit-traveler`)
    return raw.items
  }
  console.error(`${LOG} no usable starter kit found — returning empty kit`)
  return []
}

/** The WardrobeTheme for a theme id, falling back to ANTIGUA_1770 (the only one
 *  that ships today). Unknown/forward theme ids resolve to the default dress. */
function themeFor(themeId: string): WardrobeTheme {
  const theme = THEMES[themeId]
  if (theme) return theme
  // Not necessarily an error: tokyo-2050/changan-tang are forward hints whose
  // Theme bundles land later. Quiet info, not a warn, to avoid log noise.
  return ANTIGUA_1770
}

/* ------------------------------------------------------ seeded PRNG (house) */

/** FNV-1a 32-bit — the same hash family as characterGen/personaGen. */
function hashStr(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** mulberry32 — the same small seedable PRNG the generators use. */
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pick = <T>(r: () => number, arr: readonly T[]): T => arr[Math.floor(r() * arr.length)]

/* ----------------------------------------- CharacterSpec → AvatarSpec (inverse) */

/**
 * Map a render-ready `CharacterSpec` DOWN to the broadcast/durable `AvatarSpec`
 * (the inverse of `characterSpec.ts :: avatarToCharacterSpec`). The player's
 * generated default body becomes a tiny, storable, network-safe identity.
 *
 * Kept here (not in `characterSpec.ts`) so this round stays inside my-alone files;
 * integration may promote it next to `avatarToCharacterSpec`. The clothing item
 * names already ARE the garment tails characterGen emits ("tunic","cap",…); we
 * re-prefix them into the `slot-tail` itemId convention the onboarding cosmetics
 * use, so the round-trip is stable.
 */
export function characterSpecToAvatar(spec: CharacterSpec): AvatarSpec {
  const layers: AvatarLayer[] = []
  // skin tone rides on the face layer (mirrors avatarToCharacterSpec's read).
  layers.push({ slot: "face", itemId: "face-base", tint: spec.skinTone })
  if (spec.hair && spec.hair.style !== "none" && spec.hair.style !== "bald") {
    layers.push({ slot: "hair", itemId: `hair-${spec.hair.style}`, tint: spec.hair.color })
  }
  const c = spec.clothing ?? {}
  if (c.top) layers.push({ slot: "top", itemId: `top-${c.top.item}`, tint: c.top.color })
  if (c.bottom) layers.push({ slot: "bottom", itemId: `bottom-${c.bottom.item}`, tint: c.bottom.color })
  if (c.hat) layers.push({ slot: "hat", itemId: `hat-${c.hat.item}`, tint: c.hat.color })
  if (c.accessory) layers.push({ slot: "accessory", itemId: `acc-${c.accessory.item}`, tint: c.accessory.color })
  return {
    base: "paper-doll-a",
    layers,
    palette: { skin: spec.skinTone, hair: spec.hair?.color ?? "#43301d" },
  }
}

/* ------------------------------------------------- seeded default persona */

/**
 * Build a pair-stable, SEEDED default persona for a fresh Track — no UI required.
 * Same `(pair, playerId)` always yields the same opening persona (stable across
 * reloads, like every generated NPC); a different pair yields a visibly distinct,
 * on-theme one. The player can still reroll/redress in onboarding — this is only
 * the BIRTH default (and the Skip/auto-create value).
 *
 * PURE: takes plain inputs, returns plain data, touches no store. The caller
 * (integration) writes `identity`/`avatar` into the new `TrackState` and applies
 * `grant` to that Track's inventory ONCE. See PAIR_IDENTITY.md §3.
 *
 * @param pair      the learner pair (keys the profile + the gloss; persona themes target).
 * @param trackId   the per-Track key ("native:target") — the seed namespace.
 * @param playerId  the device player id, branded into the GeneratedIdentity.
 */
export function seededPersonaForPair(
  pair: LearnerPair,
  trackId: string,
  playerId: string,
): SeededPersona {
  const profile = profileForPair(pair)
  const pool = namePoolFor(profile.namePoolId)
  const grant = starterGrantFor(profile.starterGrantId)
  const theme = themeFor(profile.themeId)

  // --- name: the SAME safe Adjective+Noun(+number) construction, seeded ---
  const nr = rng(hashStr(`name|${trackId}`))
  const adj = pick(nr, pool.adjectives)
  const noun = pick(nr, pool.nouns)
  const withNum = nr() < 0.45
  const numId = withNum ? String(10 + Math.floor(nr() * 89)) : undefined
  const displayName = `${adj.label} ${noun.label}${numId ? " " + numId : ""}`
  const identity: GeneratedIdentity = {
    playerId: playerId as GeneratedIdentity["playerId"],
    displayName,
    nameSeed: { adjId: adj.id, nounId: noun.id, ...(numId ? { numId } : {}) },
  }

  // --- avatar: generated by the SAME engine that dresses the crowd, themed ---
  const character = generateCharacter("traveler", `persona:${trackId}`, theme)
  const avatar = characterSpecToAvatar(character)

  return { identity, avatar, grant, profile }
}

/* ------------------------------------------------------------ dev/introspection */

/** Pool ids known to the resolver (for tests / dev tools). */
export function knownNamePoolIds(): string[] {
  return Object.keys(POOLS)
}
/** Grant ids known to the resolver (for tests / dev tools). */
export function knownStarterGrantIds(): string[] {
  return Object.keys(GRANTS)
}
/** Target codes with an explicit (non-default) profile row. */
export function bespokeTargets(): string[] {
  return Object.keys(PROFILES.targets)
}
