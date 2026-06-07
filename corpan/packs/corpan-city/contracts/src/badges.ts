import { z } from "zod"
import { ChallengeToolId } from "./challengeTool"

/**
 * Badges & progression (the mastery axis — BADGES_PROGRESSION.md). XP stops
 * being a static number: every XP earned FLOWS INTO specific, per-target-language
 * badges ("Spanish · Greetings", "Spanish · Numbers — Listening") that fill and
 * tier (bronze → silver → gold → platinum). ~1000 badges per language course,
 * GENERATED data-drivenly from the 13-domain × 6-CEFR × ~22-skill corpus.
 *
 * Badges are orthogonal to currency/markets (ECONOMY_CURRENCY) and live INSIDE a
 * Track: switch en→es to en→fr and you see French's badge case, not Spanish's
 * (progress keyed by `trackNamespace(id)` in IndexedDB, quota-safe).
 *
 * The catalog (badge DEFINITIONS) is never persisted — regenerated from the
 * bundled/CDN catalog at boot. Only per-badge PROGRESS persists, and tiny.
 */

/* ---------------------------------------------------------------- BadgeId */

/**
 * A stable, facet-derived badge id. STABLE IDS ARE LOAD-BEARING: derived from
 * facets so regenerating the catalog yields identical ids and progress never
 * orphans. Shape: `<family>:<facets...>`, e.g.
 *   "F:travel:vocab:A2"  (domain × skill × CEFR — the long tail)
 *   "A:travel"           (domain mastery)
 *   "G:social:greetings" (subtopic cluster)
 *   "H:word-scramble"    (tool virtuoso)
 * Plain (non-branded) string — it crosses the wire as a key and indexes a record.
 */
export const BadgeId = z.string().min(1)
export type BadgeId = z.infer<typeof BadgeId>

/** The badge generator families (A–K). See BADGES_PROGRESSION §1.2. */
export const BadgeFamily = z.enum([
  "A", // domain mastery
  "B", // domain × CEFR
  "C", // skill mastery
  "D", // skill × CEFR
  "E", // domain × skill
  "F", // domain × skill × CEFR (the long tail)
  "G", // subtopic / phrase-cluster
  "H", // challenge-type virtuoso
  "I", // consistency / streak (opt-in)
  "J", // quest / story
  "K", // seasonal / event (CDN-pushed, time-boxed)
])
export type BadgeFamily = z.infer<typeof BadgeFamily>

/** The 5-tier ladder. `locked` = no relevant XP yet; `platinum` = mastered (terminal). */
export const BadgeTier = z.enum(["locked", "bronze", "silver", "gold", "platinum"])
export type BadgeTier = z.infer<typeof BadgeTier>

/* ------------------------------------------------------------------ Badge */

/**
 * A badge DEFINITION (catalog, never persisted). Derived from facets by a family
 * generator. `glyph` selects the medal face emblem (a domain/skill/cluster motif
 * drawn by the shared `IconRenderer`). `copyKey` resolves the localized name.
 */
export const Badge = z.object({
  id: BadgeId,
  family: BadgeFamily,
  /** localization key for the badge's display name (resolved per `native`). */
  copyKey: z.string().min(1),
  /** medal-face emblem id for the IconRenderer ("badge" family). */
  glyph: z.string().min(1),
  // ---- routing facets (any subset, per family) ----
  domain: z.string().optional(),
  toolId: ChallengeToolId.optional(),
  level: z.string().optional(), // CEFR: A1…C2
  clusterId: z.string().optional(), // family G subtopic cluster
  questId: z.string().optional(), // family J story badge
  /** the corpus rows this badge is ABOUT (family G subtopic clusters). */
  entryIds: z.array(z.number().int()).optional(),
  /** cumulative weighted-XP tier multiplier (broad badges use ×2.5); CDN-tunable. */
  tierScale: z.number().positive().default(1),
})
export type Badge = z.infer<typeof Badge>

/* ------------------------------------------------------------ BadgeDeposit */

/**
 * The XP→badge ROUTING INPUT — the richer record the router consumes from a
 * challenge/quest result (the bare `XpEvent` doesn't carry the facets). One
 * deposit fans out to up to ~8 badges (domain/skill/CEFR/subtopic/virtuoso),
 * each credited a FRACTIONAL weight (weights sum ≤ 1 — no XP inflation).
 * Score-weighted (anti-mash): `credited = amount × (0.4 + 0.6 × score)`.
 *
 * (Named `BadgeDeposit` per the prompt; the design doc's working name was
 * `XpDeposit` — same shape.)
 */
export const BadgeDeposit = z.object({
  amount: z.number().nonnegative(), // the XP from this action
  /** which Track's badges this lands in — `trackNamespace(id)` derives the IDB key. */
  trackKey: z.string().min(1), // a TrackId, e.g. "en:es"
  source: z.enum(["challenge", "questStep", "daily", "coop", "pronunciation"]),
  domain: z.string().optional(), // ChallengeContext.domain / Quest.domain
  toolId: ChallengeToolId.optional(), // → skill family
  level: z.string().optional(), // CEFR
  entryIds: z.array(z.number().int()).optional(), // drilled rows → subtopic clusters
  score: z.number().min(0).max(1).optional(), // 0..1, gates tier-up quality
  questId: z.string().optional(), // story badges
})
export type BadgeDeposit = z.infer<typeof BadgeDeposit>

/* ------------------------------------------------------------- BadgeProgress */

/**
 * Per-badge progress (the "filling up"). `weightedXp` is the cumulative
 * score-weighted XP routed to THIS badge; `tier` is the achieved tier. Absent
 * from a Track's `PersistedBadges` ⇒ Locked, 0 xp. Tiny: a touched badge ≈ 32B.
 */
export const BadgeProgress = z.object({
  badgeId: BadgeId,
  tier: BadgeTier,
  weightedXp: z.number().nonnegative(),
})
export type BadgeProgress = z.infer<typeof BadgeProgress>

/**
 * The COMPACT persisted shape per Track (IndexedDB, key `wp:track:{id}:badges`).
 * Only TOUCHED badges are stored (absent id ⇒ Locked); a fresh Track is ~0 bytes.
 * `p[badgeId] = [tierIndex, weightedXp]` (tier index into BadgeTier.options).
 */
export const PersistedBadges = z.object({
  v: z.literal(1),
  /** badgeId → packed [tierIndex, weightedXp]. Absent id ⇒ Locked. */
  p: z.record(z.string(), z.tuple([z.number().int(), z.number()])),
})
export type PersistedBadges = z.infer<typeof PersistedBadges>
