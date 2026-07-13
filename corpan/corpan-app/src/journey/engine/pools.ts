// journey/engine/pools.ts — DUE/REPLAY/NEW/REPAIR/TRICKLE/FUN pool
// construction (engine.md §5.2, adaptivity §5.2 verbatim).

import {
  FRONTIER_LOOKAHEAD_UNITS,
  FUN_POOL_R_MIN,
  PHONEME_NEW_POOL_MAX_SHARE,
  PHONEME_NEW_POOL_MIN_SEEN,
  REPAIR_ACC_BELOW,
  REPAIR_DEMOTED_WINDOW_DAYS,
} from "./constants.ts"
import type { GraphIndex } from "./graph.ts"
import { isRetired, isSuspended, type Mastery } from "./mastery.ts"
import type { Scheduler } from "./scheduler.ts"
import { CardFlags, type CourseState, type ItemCard, type SessionState, type SkillScalars } from "./types.ts"

export interface PoolsInput {
  gidx: GraphIndex
  cards: Map<string, ItemCard>
  skills: Map<string, SkillScalars>
  course: CourseState
  session: SessionState
  mastery: Mastery
  scheduler: Scheduler
  nowMs: number
  day: number
}

export interface Pools {
  /** Due cards sorted by priority desc. */
  due: string[]
  new: string[]
  repair: string[]
  trickle: string[]
  fun: string[]
  /** Frontier NEW items pulled forward for the EAGER CONTINUING learner — the
   *  next reachable units' fresh material, beyond the per-day throttle AND
   *  beyond the position cursor, DAG-gated (§6 position rules). This is what
   *  makes the feed INFINITE: a binger who blows past the daily target keeps
   *  unlocking new words/units in one sitting. Ordered by introOrder so intake
   *  stays prescriptive. The mixer draws from this ONLY as a continuation
   *  fallback (after the quota pools drain), so the normal daily path — and
   *  every golden transcript — is byte-identical. Position does NOT move here;
   *  that stays checkpoint-gated so spacing still governs REVIEWS (SRS
   *  integrity). Empty only when there is genuinely no reachable material left
   *  (true end of shipped content) — the ONLY acceptable terminal. */
  frontier: string[]
  /** RETIRED items (R-A) available for a LAST-RESORT continuation revisit — used
   *  by the mixer ONLY when frontier AND non-retired strong-known are both
   *  exhausted (a fully-mastered finite pool). This keeps the infinite feed from
   *  dead-ending on a binger who has nailed everything, while guaranteeing a
   *  retired item is never served WHILE any fresh / less-mastered material
   *  exists (R-B). On a real (large) pack the frontier is effectively inexhaustible,
   *  so this fallback never fires; it is the true end-of-content safety net. */
  retired: string[]
  dueCount: number
  /** Retrievability snapshot for items touched during pool build. */
  r: Map<string, number>
}

export function duePriority(r: number, importance: number, lapses: number): number {
  return (1 - r) * importance * (1 + 0.1 * lapses)
}

/** Count of cards due ≤ day (suspended + retired excluded) — the backlog metric.
 *  Retired items (R-A) must NOT inflate the debt backlog: a twice-nailed word is
 *  done, not owed, so freed capacity pulls FRESH intake (R-B) rather than tripping
 *  the debt brake on cards that will never be served. */
export function dueCount(cards: Map<string, ItemCard>, day: number): number {
  let n = 0
  for (const card of cards.values()) {
    if (isSuspended(card) || isRetired(card)) continue
    if (card.fsrs.reps > 0 && card.fsrs.due <= day) n += 1
  }
  return n
}

export function buildPools(input: PoolsInput): Pools {
  const { gidx, cards, course, session, mastery, scheduler, nowMs, day } = input
  const graph = gidx.graph
  const r = new Map<string, number>()
  const rOf = (card: ItemCard): number => {
    let v = r.get(card.itemId)
    if (v === undefined) {
      v = scheduler.retrievability(card, nowMs)
      r.set(card.itemId, v)
    }
    return v
  }

  // ---- DUE --------------------------------------------------------------
  const due: { itemId: string; p: number }[] = []
  for (const card of cards.values()) {
    // Retired items (R-A) leave the DUE loop alongside suspended ones: a
    // twice-nailed word stops recycling so unseen/frontier material leads.
    if (isSuspended(card) || isRetired(card)) continue
    if (card.fsrs.reps === 0 || card.fsrs.due > day) continue
    const item = graph.items[card.itemId]
    if (!item) continue
    due.push({ itemId: card.itemId, p: duePriority(rOf(card), item.importance, card.fsrs.lapses) })
  }
  due.sort((a, b) => b.p - a.p)
  // struggle mode rebuilds confidence: strongest (lowest-priority) first —
  // the scaffold + near-win prepends lead, the queue follows suit (§5.3.1)
  if (session.flow.mode === "struggle") due.reverse()

  // ---- NEW --------------------------------------------------------------
  // Frontier skills' items in introOrder, minus items with cards, capped by
  // (newPerDay − newIntroducedToday). The prescriptive spine bounds intake to
  // units at or before the position cursor; leech substitutes and jump-fail
  // boosts jump the queue head (§5.7 / §5.9).
  const newCap = Math.max(0, course.newPerDay - course.newIntroducedToday)
  const newPool: string[] = []
  // Pronunciation-drill domination guard: a learner must not drill the same
  // ~10 contrast words endlessly before meeting core vocab (defect: "jam 1000×
  // before please/thank you"). The set gidx.phonemeDrillItems covers BOTH the
  // phoneme-kind contrast items AND the minimal-pair WORD items in a phonology
  // skill (jam/ship/sheep/very/berry/yet) — the old kind==="phoneme" test
  // missed the latter, which is exactly what the CTO saw. Drills are DEFERRED
  // until the learner has met enough non-drill vocab, then capped to a small
  // share of any one NEW pool. Communicative content leads; phonics trickles.
  const isPlacedSkill = (skillId: string): boolean =>
    input.skills.get(skillId)?.placedAt !== undefined
  const inPlacedSkill = (itemId: string): boolean =>
    (graph.items[itemId]?.skillIds ?? []).some(isPlacedSkill)
  const seenNonPhoneme = (() => {
    let n = 0
    for (const card of cards.values()) {
      if (card.fsrs.reps === 0) continue
      if (gidx.phonemeDrillItems.has(card.itemId)) continue
      n += 1
    }
    return n
  })()
  const phonemesDeferred = seenNonPhoneme < PHONEME_NEW_POOL_MIN_SEEN
  let phonemesInPool = 0
  const phonemeShareCap = (): number => Math.floor(newCap * PHONEME_NEW_POOL_MAX_SHARE)
  const pushNew = (itemId: string): void => {
    if (newPool.length >= newCap) return
    if (cards.has(itemId)) return
    if (session.debuts.has(itemId)) return
    if (newPool.includes(itemId)) return
    if (gidx.phonemeDrillItems.has(itemId)) {
      // A PLACED learner already provisionally knows the sounds unit — never
      // pull A0 pronunciation drills into fresh intake (they resurface only on
      // a genuine failure via repair/replay). Everyone else: defer + share-cap.
      if (inPlacedSkill(itemId)) return
      if (phonemesDeferred) return
      if (phonemesInPool >= phonemeShareCap()) return
      phonemesInPool += 1
    }
    newPool.push(itemId)
  }
  for (const itemId of course.newBoost) pushNew(itemId)
  for (const itemId of course.leechSubstitutes) pushNew(itemId)
  if (newPool.length < newCap) {
    const maxUnit = course.position.unitOrdinal
    for (const itemId of gidx.itemsByIntro) {
      if (newPool.length >= newCap) break
      const item = graph.items[itemId]
      if (cards.has(itemId) || session.debuts.has(itemId)) continue
      let eligible = false
      for (const skillId of item.skillIds) {
        const unitId = graph.skills[skillId]?.unitId
        const ordinal = gidx.unitPos.get(unitId ?? "") ?? Number.POSITIVE_INFINITY
        if (ordinal > maxUnit) continue
        if (mastery.levelOf(skillId, nowMs) >= 1) {
          eligible = true
          break
        }
      }
      if (eligible) pushNew(itemId)
    }
  }

  // ---- REPAIR -----------------------------------------------------------
  const repairSkills = new Set<string>()
  for (const [skillId, scalars] of input.skills) {
    const hasCards = (gidx.skillItems.get(skillId) ?? []).some((id) => cards.has(id))
    if (!hasCards) continue
    if (
      scalars.accEwma < REPAIR_ACC_BELOW ||
      (scalars.demotedAt !== undefined && day - scalars.demotedAt <= REPAIR_DEMOTED_WINDOW_DAYS)
    ) {
      repairSkills.add(skillId)
    }
  }
  const repair: { itemId: string; oneMinusR: number }[] = []
  const repairSeen = new Set<string>()
  for (const skillId of repairSkills) {
    for (const itemId of gidx.skillItems.get(skillId) ?? []) {
      const card = cards.get(itemId)
      if (!card || card.fsrs.reps === 0 || isSuspended(card) || isRetired(card) || repairSeen.has(itemId)) continue
      repairSeen.add(itemId)
      repair.push({ itemId, oneMinusR: 1 - rOf(card) })
    }
  }
  repair.sort((a, b) => b.oneMinusR - a.oneMinusR)

  // ---- TRICKLE ----------------------------------------------------------
  const trickle: string[] = []
  for (const [skillId, scalars] of input.skills) {
    if (scalars.placedAt === undefined) continue
    for (const itemId of gidx.skillItems.get(skillId) ?? []) {
      // Pronunciation drills are NEVER placed-backlog intake: a placed learner
      // provisionally knows the sounds unit. Without this, a B1-placed user's
      // A0 phonology skill dumps every minimal-pair word (jam/ship/sheep …) and
      // phoneme contrast into TRICKLE — the dominant intake pool — so the feed
      // spotlights phonics before communicative vocab (the CTO defect). They
      // resurface only through a real failure (repair/replay), never here.
      if (gidx.phonemeDrillItems.has(itemId)) continue
      if (!cards.has(itemId) && !session.debuts.has(itemId)) trickle.push(itemId)
    }
  }
  trickle.sort((a, b) => graph.items[a].introOrder - graph.items[b].introOrder)

  // ---- FUN --------------------------------------------------------------
  // Strong-known items (R > 0.9) served through funWeight templates.
  const hasFunTemplates = new Set<string>()
  for (const t of graph.activityTemplates) {
    if ((t.funWeight ?? 0) > 0) hasFunTemplates.add(t.itemKind)
  }
  const fun: string[] = []
  // Retired items eligible for the last-resort continuation revisit (see the
  // Pools.retired doc). Reviewed + not suspended; ordered by introOrder so the
  // terminal revisit stays deterministic and prescriptive.
  const retired: string[] = []
  if (hasFunTemplates.size > 0) {
    for (const card of cards.values()) {
      if (isSuspended(card) || card.fsrs.reps === 0) continue
      const item = graph.items[card.itemId]
      if (!item || !hasFunTemplates.has(item.kind)) continue
      if (isRetired(card)) {
        // Retired items (R-A) never re-enter FUN: mastered variety is served
        // only until a word is twice-nailed. They are held here for the
        // end-of-content fallback ONLY (never while fresh material remains).
        retired.push(card.itemId)
        continue
      }
      if (rOf(card) > FUN_POOL_R_MIN) fun.push(card.itemId)
    }
    // Round-robin the terminal revisit by LEAST-RECENTLY-SERVED first: the mixer
    // walks this list from the front each batch, so ordering by lastEmit spreads
    // serves EVENLY across the whole retired set (never the "same 11 items 100×"
    // starvation the front-of-insertion-order caused) and maximizes spacing.
    retired.sort(
      (a, b) => (session.lastEmit.get(a) ?? -1) - (session.lastEmit.get(b) ?? -1),
    )
  }

  // ---- FRONTIER (eager continuation) ------------------------------------
  // The INFINITE-feed pool: fresh new material from the position unit AND the
  // next reachable units, WITHOUT the per-day cap and WITHOUT the position
  // ceiling — but still DAG-gated. A unit's items are frontier-eligible only
  // when every prereq skill (transitive) of the item's skills is already
  // reachable (levelOf ≥ 1), which is the same gate normal intake uses, just
  // extended a few units ahead. This lets a binger keep unlocking new words in
  // one sitting while the prerequisite graph is still honored. Excludes items
  // already in the (capped) new pool / already carded / already debuting so it
  // is a strict superset tail, never a duplicate. Ordered by introOrder.
  //
  // SRS TRADEOFF (deliberate): the per-day NEW_PER_DAY throttle is a SOFT
  // milestone for the eager continuing learner — the frontier ignores it so a
  // binger keeps exploring. Spacing still governs REVIEWS (the DUE pool comes
  // due on the FSRS schedule, and the debt brake above still zeroes intake when
  // review debt is high), but it does NOT gate NEW exploration. A learner who
  // introduces far more than NEW_PER_DAY in one sitting will owe more reviews
  // tomorrow; that debt is then absorbed by the DUE pool + debt brake, not by
  // capping the feed. Retention is protected by scheduling those reviews, not by
  // rationing new intake.
  const frontier: string[] = []
  const inNewPool = new Set(newPool)
  const maxFrontierUnit = Math.min(
    gidx.units.length - 1,
    course.position.unitOrdinal + FRONTIER_LOOKAHEAD_UNITS,
  )
  const skillReachable = (skillId: string): boolean => {
    // the skill itself is at least introduced, OR all its transitive prereqs
    // are (the item can be met without a missing upstream dependency).
    if (mastery.levelOf(skillId, nowMs) >= 1) return true
    for (const p of gidx.prereqClosure.get(skillId) ?? []) {
      if (mastery.levelOf(p, nowMs) < 1) return false
    }
    return true
  }
  // Phonics never enter the frontier: the eager continuation stream pulls
  // COMMUNICATIVE vocab forward for the binger. Minimal-pair contrasts still
  // arrive through the normal capped NEW pool on subsequent days (the phoneme
  // anti-domination guard) — the frontier never floods the feed with them.
  for (const itemId of gidx.itemsByIntro) {
    const item = graph.items[itemId]
    if (!item) continue
    if (cards.has(itemId) || session.debuts.has(itemId) || inNewPool.has(itemId)) continue
    if (gidx.phonemeDrillItems.has(itemId)) continue
    let eligible = false
    for (const skillId of item.skillIds) {
      const unitId = graph.skills[skillId]?.unitId
      const ordinal = gidx.unitPos.get(unitId ?? "") ?? Number.POSITIVE_INFINITY
      if (ordinal > maxFrontierUnit) continue
      if (skillReachable(skillId)) {
        eligible = true
        break
      }
    }
    if (eligible) frontier.push(itemId)
  }

  return {
    due: due.map((d) => d.itemId),
    new: newPool,
    repair: repair.map((x) => x.itemId),
    trickle,
    fun,
    frontier,
    retired,
    dueCount: due.length,
    r,
  }
}

/** Leech cards route through leech.ts (§5.7); helper for the mixer cap. */
export function isLeech(card: ItemCard): boolean {
  return (card.flags & CardFlags.Leech) !== 0
}
