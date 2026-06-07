/**
 * Badge ROUTER — pure XP→badge fan-out (BADGES_PROGRESSION §2). No UI, no
 * storage, no side effects. One `BadgeDeposit` (the richer record from a
 * challenge/quest result) fans out to up to ~8 badges by domain/skill/level/
 * subtopic/tool, each credited a FRACTIONAL weight so the weights sum to ≤ 1 —
 * NO XP inflation (the scalar `inventory().xp` keeps the full amount; badges are
 * a parallel ledger).
 *
 * The curve (also pure here, so the store + tests share one source of truth):
 *  - score gate (§2.4): `credited = amount × (0.4 + 0.6 × score)` (anti-mash).
 *  - geometric tier ladder (§2.3): Bronze/Silver/Gold/Platinum cumulative; broad
 *    badges (A,C) use a ×tierScale multiplier (mastery is a real journey).
 *  - near-tier soft cap (§2.5): the last 15% of a tier's arc credits at 0.6×.
 *  - platinum overflow re-routes (§2.5) to still-incomplete siblings.
 */

import type { Badge, BadgeDeposit, BadgeTier } from "@corpan-city/contracts"
import {
  type BadgeCatalog,
  TIER_LADDER,
  familyWeight,
  skillFamiliesForTool,
  clustersForEntryIds,
} from "./catalog"

/* --------------------------------------------------------------- tier curve */

export const TIER_NAMES: readonly BadgeTier[] = [
  "locked",
  "bronze",
  "silver",
  "gold",
  "platinum",
]

/** Index of a tier in the ladder (locked=0 … platinum=4). */
export function tierIndex(tier: BadgeTier): number {
  return TIER_NAMES.indexOf(tier)
}

/** The cumulative weighted-XP thresholds for a badge, scaled by `tierScale`. */
export function tierThresholds(tierScale: number): number[] {
  // [bronze, silver, gold, platinum] cumulative weighted-XP.
  return TIER_LADDER.map((x) => Math.round(x * (tierScale || 1)))
}

/** The achieved tier for a cumulative weighted-XP total on a badge. */
export function tierForXp(weightedXp: number, tierScale: number): BadgeTier {
  const th = tierThresholds(tierScale)
  if (weightedXp <= 0) return "locked"
  if (weightedXp >= th[3]) return "platinum"
  if (weightedXp >= th[2]) return "gold"
  if (weightedXp >= th[1]) return "silver"
  return "bronze"
}

/** Is this badge at terminal Platinum (an overflow sink)? */
export function isPlatinum(weightedXp: number, tierScale: number): boolean {
  return weightedXp >= tierThresholds(tierScale)[3]
}

/**
 * The 0..1 arc toward the NEXT tier for a cumulative weighted-XP total.
 * Platinum (terminal) reads as a full arc. Locked-at-0 reads as 0.
 */
export function arcForXp(weightedXp: number, tierScale: number): number {
  const th = tierThresholds(tierScale)
  const stops = [0, ...th] // [0, bronze, silver, gold, platinum]
  if (weightedXp >= th[3]) return 1
  for (let i = 1; i < stops.length; i++) {
    if (weightedXp < stops[i]) {
      const start = stops[i - 1]
      const end = stops[i]
      return clamp01((weightedXp - start) / (end - start))
    }
  }
  return 1
}

/** XP still needed to reach the next tier (0 at platinum). */
export function xpToNextTier(weightedXp: number, tierScale: number): number {
  const th = tierThresholds(tierScale)
  for (const t of th) if (weightedXp < t) return Math.max(0, Math.round(t - weightedXp))
  return 0
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x
}

/* --------------------------------------------------- score gate + soft cap */

/** Score-weighted credit (§2.4): bailing credits the 0.4 floor; 100% credits full. */
export function scoreGated(amount: number, score: number | undefined): number {
  const s = score == null ? 1 : clamp01(score)
  return amount * (0.4 + 0.6 * s)
}

/**
 * Apply the near-tier soft cap (§2.5): the last 15% of the CURRENT tier's arc
 * credits at 0.6×. Returns the EFFECTIVE weighted-xp delta to add given where
 * the badge currently sits. Pure; the store calls this to advance a badge.
 */
export function softCappedDelta(
  fromXp: number,
  rawDelta: number,
  tierScale: number,
): number {
  if (rawDelta <= 0) return 0
  const th = tierThresholds(tierScale)
  const stops = [0, ...th]
  // Find the current tier band [start, end).
  let start = 0
  let end = th[th.length - 1]
  for (let i = 1; i < stops.length; i++) {
    if (fromXp < stops[i]) {
      start = stops[i - 1]
      end = stops[i]
      break
    }
  }
  if (fromXp >= th[3]) return rawDelta // platinum band: no soft cap (overflow handles it)
  const span = end - start
  const softStart = start + span * 0.85 // last 15% of the band
  if (fromXp >= softStart) {
    // Entirely inside the soft zone.
    return rawDelta * 0.6
  }
  const toSoft = softStart - fromXp
  if (rawDelta <= toSoft) return rawDelta // doesn't reach the soft zone
  // Part before the soft zone at 1×, the remainder at 0.6×.
  return toSoft + (rawDelta - toSoft) * 0.6
}

/* ----------------------------------------------------------------- routing */

/** One badge credited by a deposit: the badge + the raw weighted XP to add. */
export interface RoutedCredit {
  badgeId: string
  /** raw weighted-xp (family weight × score-gated amount), BEFORE the soft cap. */
  xp: number
}

/**
 * Fan one deposit out to its badges. PURE — returns the list of {badgeId, xp};
 * the store applies the soft cap + platinum overflow when it knows each badge's
 * current xp.
 *
 * NO XP INFLATION (the frozen `BadgeDeposit` invariant — weights sum ≤ 1): the
 * per-family numbers in `families.json` are RELATIVE PRIORITIES (F is the primary
 * sink at 1.0, broad A/C are 0.3, etc.). Across a realized fan-out their raw sum
 * can exceed 1, so we NORMALIZE: if the raw weights sum > 1 we scale every credit
 * by `1 / rawSum`, preserving the relative proportions while guaranteeing the
 * total credited "mastery work" ≤ the (score-gated) XP earned. A small fan-out
 * (raw sum ≤ 1) is left untouched.
 *
 * A `fast-translate` round in `travel` at `A2` drilling entryIds advances up to:
 *   A·Travel, B·Travel—A2, C·Vocab, D·Vocab—A2, E·Travel·Vocab,
 *   F·Travel·Vocab—A2, G·(matching cluster), H·fast-translate.
 */
export function route(d: BadgeDeposit, catalog: BadgeCatalog): RoutedCredit[] {
  const gated = scoreGated(d.amount, d.score)
  if (gated <= 0) return []

  // Collect the raw (badgeId, familyWeight) pairs the deposit hits.
  const raw: Array<{ badgeId: string; weight: number }> = []
  const seen = new Set<string>()
  const add = (badgeId: string, family: Parameters<typeof familyWeight>[0]) => {
    const def = catalog.get(badgeId)
    if (!def) return // clamped-away badge (no corpus coverage) → silently skip
    if (seen.has(badgeId)) return
    const w = familyWeight(family)
    if (w <= 0) return
    seen.add(badgeId)
    raw.push({ badgeId, weight: w })
  }

  const skills = d.toolId ? skillFamiliesForTool(d.toolId) : []

  if (d.domain) {
    add(`A:${d.domain}`, "A")
    if (d.level) add(`B:${d.domain}:${d.level}`, "B")
    for (const s of skills) {
      add(`E:${d.domain}:${s}`, "E")
      if (d.level) add(`F:${d.domain}:${s}:${d.level}`, "F")
    }
  }
  for (const s of skills) {
    add(`C:${s}`, "C")
    if (d.level) add(`D:${s}:${d.level}`, "D")
  }
  for (const c of clustersForEntryIds(d.entryIds)) {
    add(`G:${c.domain}:${c.clusterId}`, "G")
  }
  if (d.toolId) add(`H:${d.toolId}`, "H")

  if (raw.length === 0) return []
  const rawSum = raw.reduce((s, r) => s + r.weight, 0)
  // Normalize ONLY when the fan-out would inflate (rawSum > 1).
  const norm = rawSum > 1 ? 1 / rawSum : 1
  return raw.map((r) => ({ badgeId: r.badgeId, xp: gated * r.weight * norm }))
}

/**
 * Resolve the still-incomplete SIBLINGS of a platinum badge (§2.5 overflow
 * re-route). Siblings = same family, same domain (if any), same skill axis (if
 * any), differing only in CEFR level — the natural "next rung". Pure; the store
 * uses this to redirect overflow when `route` lands on a platinum badge.
 */
export function siblingsOf(badge: Badge, catalog: BadgeCatalog): Badge[] {
  if (!badge.level) return [] // only level-bearing badges (B/D/F) have CEFR siblings
  const prefix = badge.id.slice(0, badge.id.lastIndexOf(":")) // drop the trailing level
  return catalog.all.filter(
    (b) => b.id !== badge.id && b.id.startsWith(`${prefix}:`) && b.family === badge.family,
  )
}
