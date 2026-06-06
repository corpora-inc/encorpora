/**
 * questVariety — the light REPLAY-VARIETY engine that keeps the journey from going
 * stale. Two jobs, both pure + deterministic-from-a-seed:
 *
 *   1. NEXT-QUEST ROTATION. The completion interlude offers a 2–3-way branch. The
 *      authored `nextQuestIds` are the DESIGNER'S preferred fork, but offering the
 *      exact same three cards after every replay of a quest is what makes a 6-quest
 *      demo feel like a 6-quest demo. `pickNextQuests` honours the authored branch
 *      FIRST, then BACKFILLS from the rest of the catalog — biased AWAY from quests
 *      the player just did (a small recent-history ring) so you rarely see the same
 *      quest twice in a row. The result is still capped at 3 and never empty.
 *
 *   2. PER-PLAY PARAMETERISATION. A quest is a TEMPLATE: its target vocab comes from
 *      the corpus by domain/level (not hard literals) and its objective NPC stands
 *      at the step anchor. `varyQuestPlay(seed)` derives a stable-per-attempt
 *      ROTATION offset so "fetch a coffee" draws a fresh slice of the café domain
 *      each attempt — even the same quest feels new. It's advisory: the challenge
 *      phrase resolver (DOMAIN + CEFR, owned by the challenges agent) consumes the
 *      domain/level the step declares; this just rotates WHICH slice of that pool.
 *
 * No DOM, no host, no storage. The orchestrator owns the recent-history ring (it
 * persists per-pair) and feeds it in; this module is the pure policy.
 */

import type { Quest } from "@world-plaza/contracts"

/* ----------------------------------------------------------- seeded PRNG ---- */

/** FNV-1a → a stable 32-bit seed from any string (the repo's canonical hash). */
export function hashSeed(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** mulberry32 — a tiny deterministic PRNG (same seed ⇒ same sequence). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A seeded Fisher–Yates shuffle (returns a NEW array; input untouched). */
export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const out = items.slice()
  const rng = mulberry32(seed)
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/* -------------------------------------------------- next-quest rotation ----- */

export interface PickNextOptions {
  /** The quest just completed (always excluded from its own follow-ups). */
  completedId: string
  /** The authored preferred follow-ups (`quest.nextQuestIds`), in author order. */
  preferredIds: readonly string[]
  /** Every known quest id (the catalog), so backfill always has somewhere to go. */
  allIds: readonly string[]
  /**
   * The recently-PLAYED quest ids (most-recent-first), used to BIAS backfill away
   * from repeats. Authored picks are NOT suppressed by history (the designer's fork
   * wins); only the catalog backfill avoids them. Optional ⇒ no bias.
   */
  recent?: readonly string[]
  /**
   * The OBJECTIVE VENUE (anchor) a candidate quest OPENS at — its first step's
   * anchor, i.e. where this fork would send the player next. Paired with
   * `completedVenue` (where the player just finished), the picker NEVER offers a
   * quest whose opening venue equals the just-completed venue AS THE FIRST OPTION,
   * so the player isn't sent back to the SAME place / SAME-looking NPC two quests in
   * a row (the "same special three times" bug). A same-venue quest can still appear
   * LATER in the branch if the catalog is too small to avoid it — it's a
   * de-prioritisation, never a hard drop, so the branch is still always full.
   * Resolver returns null/undefined for an unknown id (then it's a DISTINCT venue,
   * i.e. never suppressed). Optional — needs `completedVenue` to take effect.
   */
  anchorOf?: (questId: string) => string | null | undefined
  /**
   * The venue the player JUST finished at (the completed quest's LAST step anchor).
   * Candidates whose opening venue (`anchorOf`) equals this are demoted below
   * different-venue alternatives. Null/omitted ⇒ no venue de-prioritisation.
   */
  completedVenue?: string | null
  /** A varying seed (e.g. the completed id + a play counter) so the fork rotates. */
  seed: number
  /** Cap (the design's 2–3-way picker). Default 3. */
  max?: number
}

/**
 * Choose the next-quest options. Authored `preferredIds` come FIRST (filtered to
 * known, de-duped, minus the completed quest); then the rest of the catalog
 * BACKFILLS — shuffled by `seed`, with recently-played quests sorted to the BACK —
 * until we reach `max`. Never empty (unless the catalog has only the completed
 * quest); never includes the completed quest.
 */
export function pickNextQuests(opts: PickNextOptions): string[] {
  const max = Math.max(1, opts.max ?? 3)
  const known = new Set(opts.allIds)
  const recent = new Set(opts.recent ?? [])
  const seen = new Set<string>([opts.completedId])

  // Build the full ORDERED candidate list — authored fork first (designer's branch),
  // then catalog backfill (shuffled, recently-played sorted to the back). We collect
  // MORE than `max` here so the venue de-prioritisation below has room to reorder
  // before we truncate.
  const ordered: string[] = []

  // 1) Authored fork first (the designer's intended branch), in author order.
  for (const id of opts.preferredIds) {
    if (seen.has(id) || !known.has(id)) continue
    seen.add(id)
    ordered.push(id)
  }

  // 2) Backfill from the rest of the catalog, shuffled, recent-played to the back,
  //    so replays don't keep surfacing the same cards.
  const rest = opts.allIds.filter((id) => !seen.has(id))
  const shuffled = seededShuffle(rest, opts.seed)
  shuffled.sort((a, b) => Number(recent.has(a)) - Number(recent.has(b)))
  for (const id of shuffled) {
    seen.add(id)
    ordered.push(id)
  }

  // 3) NO CONSECUTIVE-VENUE REPEAT. If we know each quest's objective venue, push
  //    candidates that share the just-completed quest's venue toward the BACK — a
  //    STABLE sort, so it only ever demotes same-venue picks BELOW a different-venue
  //    alternative (the first slot is never the same place two quests running), while
  //    keeping the authored/backfill order within each group. Never a hard drop, so a
  //    tiny catalog still fills the branch. Skipped entirely without an `anchorOf`.
  const anchorOf = opts.anchorOf
  const completedVenue = opts.completedVenue
  if (anchorOf && completedVenue != null) {
    const sameVenue = (id: string) => Number(anchorOf(id) === completedVenue)
    ordered.sort((a, b) => sameVenue(a) - sameVenue(b))
  }

  return ordered.slice(0, max)
}

/* ----------------------------------------------------- recent-history ring -- */

/** Push `id` onto a most-recent-first ring, de-duped, capped at `size` (default 6). */
export function pushRecent(ring: readonly string[], id: string, size = 6): string[] {
  const out = [id, ...ring.filter((x) => x !== id)]
  return out.slice(0, Math.max(1, size))
}

/* ------------------------------------------------- per-play parameterisation */

/** Advisory variation knobs for a single play of a quest (stable for that play). */
export interface QuestPlayVariation {
  /**
   * A rotation offset into the step's domain/level corpus pool, so the SAME quest
   * drills a different slice each attempt. The phrase resolver (DOMAIN + CEFR) may
   * use it to window its selection; ignoring it is harmless (random selection).
   */
  vocabRotation: number
  /** A stable seed for any other per-play choice (e.g. which NPC persona variant). */
  seed: number
}

/**
 * Derive the per-play variation from a quest + an attempt counter. Same
 * (questId, attempt) ⇒ same variation (reload-stable); a new attempt rotates the
 * vocab window so even a re-played quest feels fresh.
 */
export function varyQuestPlay(quest: Quest, attempt: number): QuestPlayVariation {
  const seed = hashSeed(`${quest.id}#${attempt | 0}`)
  return { vocabRotation: seed % 997, seed }
}
