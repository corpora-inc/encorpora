// journey/engine/mixer.ts — nextFeedItems: slot sampler + constraints +
// model batching (engine.md §5.4). Owns issue() — the engine mints every
// ActivitySpec it grades (§0 rule 5).

import {
  BASE_QUOTA,
  DEBT_BRAKE_RATIO,
  DEFAULT_BATCH_SIZE,
  DEFAULT_CHECKPOINT_CADENCE,
  ITEM_MIN_GAP,
  ITEM_MIN_GAP_RELAXED,
  MATCH_PAIRS_MAX_ITEMS,
  MATCH_PAIRS_MIN_ITEMS,
  MAX_FUN_PER_10,
  MAX_LEECH_PER_BATCH,
  LEECH_SERVE_P,
  CONSTRAINT_REPAIR_PASSES,
  NEAR_WIN_R_MIN,
  OPENER_R_MAX,
  OPENER_R_MIN,
  REPLAY_MIN_GAP,
  SESSION_THROUGHPUT_MIN,
  SOFT_BACKLOG_RATIO,
  STRUGGLE_NEW_CUT,
  STRUGGLE_NEW_FLOOR,
  STRAND_BIAS_WEIGHT,
  JUMP_CRUISE_SESSIONS,
  JUMP_OFFER_INTERVAL_DAYS,
} from "./constants.ts"
import { chooseForm } from "./forms.ts"
import type { GraphIndex } from "./graph.ts"
import { leechTypeAllowed, recordLeechServing } from "./leech.ts"
import {
  buildBossPicks,
  checkpointSummary,
  pendingBoss,
  startCheckpointRun,
  takeLessonSlots,
  rollRare,
  type LessonBag,
} from "./lessons.ts"
import type { Mastery } from "./mastery.ts"
import { buildPools, isLeech, type Pools } from "./pools.ts"
import { weightedPick } from "./rng.ts"
import type { Scheduler } from "./scheduler.ts"
import {
  languageOverCap,
  mostDeficientStrand,
  strandControlWeights,
  pushLast40,
  STRAND_INDEX,
} from "./strands.ts"
import type {
  ActivityTemplate,
  CourseState,
  EngineCard,
  FeedConstraints,
  IssuedCard,
  ItemCard,
  PoolTag,
  SessionState,
  SkillScalars,
  Strand,
} from "./types.ts"

export interface MixerTelemetry {
  batches: number
  relaxations: number
  shortfalls: number
  lastShortfallReason: string | null
}

export interface MixerBag {
  gidx: GraphIndex
  course: CourseState
  session: SessionState
  cards: Map<string, ItemCard>
  skills: Map<string, SkillScalars>
  mastery: Mastery
  scheduler: Scheduler
  nowMs: number
  day: number
  telemetry: MixerTelemetry
}

type ModelNeed = "stt" | "llm" | "tts"

interface Slot {
  itemIds: string[]
  activityType: string
  form: 0 | 1 | 2
  pool: PoolTag
  strand: Strand
  guessable: boolean
  estSec: number
  modelNeeds: ModelNeed[]
  provider: string
  unscored?: boolean
  isReplay?: boolean
  debutIntro?: boolean
  minPos?: number // absolute emit position floor (replay/debut gap)
  checkpoint?: EngineCard["meta"]["checkpoint"]
  rareVariant?: EngineCard["meta"]["rareVariant"]
  celebration: "normal" | "rare"
  coolDown?: boolean
  leech?: boolean
  pinTail?: boolean
  checkpointId?: string
}

interface NormalizedConstraints {
  providers: Set<string>
  models: Set<ModelNeed>
  exclude: Set<string>
  timeboxSec?: number
  cadence: number
}

function normalizeConstraints(c?: FeedConstraints): NormalizedConstraints {
  const providers = new Set(c?.availableProviders ?? [])
  providers.add("native")
  return {
    providers,
    models: new Set<ModelNeed>(c?.modelsAvailable ?? ["stt", "llm", "tts"]),
    exclude: new Set(c?.excludeActivityTypes ?? []),
    timeboxSec: c?.timeboxSec,
    cadence: c?.checkpointCadence ?? DEFAULT_CHECKPOINT_CADENCE,
  }
}

function templateUsable(t: ActivityTemplate, cons: NormalizedConstraints): boolean {
  if (!cons.providers.has(t.provider)) return false
  if (cons.exclude.has(t.activityType)) return false
  return t.modelNeeds.every((m) => cons.models.has(m))
}

export function isDebtBrakeActive(course: CourseState, dueNow: number): boolean {
  return dueNow > DEBT_BRAKE_RATIO * course.dailyCapacityEwma
}

/** engine.md §5.3 — fixed adjustment order. */
export function adjustQuotas(
  course: CourseState,
  mode: "cruise" | "normal" | "struggle",
  dueNow: number,
): { review: number; new: number; repair: number; fun: number; flex: number; debt: boolean } {
  const q = { ...BASE_QUOTA } as { review: number; new: number; repair: number; fun: number; flex: number }
  // 1. flow mode
  if (mode === "cruise") {
    q.new += q.repair
    q.repair = 0
  } else if (mode === "struggle") {
    const cut = Math.min(STRUGGLE_NEW_CUT, Math.max(0, q.new - STRUGGLE_NEW_FLOOR))
    q.new -= cut
    q.review += 0.1
    q.repair += 0.1
  }
  // 2. debt brake / soft backlog pressure
  const debt = isDebtBrakeActive(course, dueNow)
  if (debt) {
    q.review += q.new // intake paused ⇒ the freed quota burns the backlog down
    q.new = 0
  } else {
    const throughput = Math.max(
      SESSION_THROUGHPUT_MIN,
      course.dailyCapacityEwma / Math.max(1, course.sessionsPerDayEwma),
    )
    if (dueNow > SOFT_BACKLOG_RATIO * throughput) {
      q.review += 0.15
      q.flex = Math.max(0, q.flex - 0.15)
    }
  }
  return { ...q, debt }
}

interface TypeChoiceOpts {
  pool: PoolTag
  restrict?: string[]
  biasStrand: Strand | null
  strandWeights?: [number, number, number, number]
  forceInputFluency: boolean
  leechItem: boolean
  /** Previous slot's type — avoided when alternatives exist (adjacency
   *  killed at the source; the §5.4 step-5 repair only mops up). */
  avoidType?: string
}

/** Activity types that need a multi-token target to be renderable: cloze
 *  blanks one of ≥2 tokens; word_order shuffles ≥2 tokens. A single-word item
 *  ("jam", "ship") produces a degenerate one-blank cloze or a one-tile
 *  "reorder" — never assign these to inherently single-token items
 *  (defect: degenerate exercises). Gated at SELECTION so the feed reroutes to
 *  a valid activity (choice_pick / flip_recall / …) instead of dropping. */
const MULTI_TOKEN_ACTIVITY_TYPES = new Set(["cloze", "word_order"])

/** Item kinds whose resolved target is always ONE token — no phrase to blank
 *  or reorder. `phrase`/`segment` carry real sentences; `grammarNode` renders
 *  its own exemplars, so only the single-lexeme kinds are gated here.
 *
 *  This is a best-effort FRONT filter only: selection runs before resolution,
 *  so it can reason about `kind` but not the resolved token count (a `phrase`
 *  whose text collapses to one token can't be detected here — `textLen` is
 *  characters, not tokens). The AUTHORITATIVE, kind-independent token guard
 *  lives in runtime.ts::prepareExercise, which counts tokens on the resolved
 *  text and reroutes any degenerate cloze/word_order regardless of kind. */
const SINGLE_TOKEN_KINDS = new Set<string>(["word", "char", "phoneme"])

function isSingleTokenKind(kind: string): boolean {
  return SINGLE_TOKEN_KINDS.has(kind)
}

function chooseActivityType(
  bag: MixerBag,
  cons: NormalizedConstraints,
  itemId: string,
  form: 0 | 1 | 2,
  opts: TypeChoiceOpts,
): ActivityTemplate | undefined {
  const item = bag.gidx.graph.items[itemId]
  if (!item) return undefined
  const all = bag.gidx.templatesByKind.get(item.kind) ?? []
  const singleToken = isSingleTokenKind(item.kind)
  const formsToTry: (0 | 1 | 2)[] =
    form === 2 ? [2, 1, 0] : form === 1 ? [1, 0] : [0]
  for (const f of formsToTry) {
    let candidates = all.filter(
      (t) =>
        t.form === f &&
        templateUsable(t, cons) &&
        // Never a multi-token activity on a single-token item (degenerate card).
        !(singleToken && MULTI_TOKEN_ACTIVITY_TYPES.has(t.activityType)) &&
        (opts.pool !== "fun" || (t.funWeight ?? 0) > 0) &&
        (!opts.restrict || opts.restrict.includes(t.activityType)) &&
        (!opts.leechItem || leechTypeAllowed(bag.course, itemId, t.activityType)),
    )
    if (opts.forceInputFluency) {
      const soft = candidates.filter((t) => t.strand === "input" || t.strand === "fluency")
      if (soft.length > 0) candidates = soft
    }
    if (opts.avoidType) {
      const distinct = candidates.filter((t) => t.activityType !== opts.avoidType)
      if (distinct.length > 0) candidates = distinct
    }
    if (candidates.length === 0) continue
    return weightedPick(
      bag.session.rng,
      candidates.map((t) => {
        // proportional control toward the stage targets; the most-deficient
        // strand keeps the spec's ×1.5 floor (engine.md §5.3.3)
        let w = opts.strandWeights ? opts.strandWeights[STRAND_INDEX[t.strand]] : 1
        if (t.strand === opts.biasStrand) w = Math.max(w, STRAND_BIAS_WEIGHT)
        return [t, w] as const
      }),
    )
  }
  return undefined
}

function poolStrandDefault(t: ActivityTemplate): Strand {
  return t.strand
}

function makeSlot(
  bag: MixerBag,
  itemId: string,
  t: ActivityTemplate,
  pool: PoolTag,
  extra?: Partial<Slot>,
): Slot {
  const card = bag.cards.get(itemId)
  return {
    itemIds: [itemId],
    activityType: t.activityType,
    form: t.form,
    pool,
    strand: poolStrandDefault(t),
    guessable: t.guessable,
    estSec: t.estSec,
    modelNeeds: [...t.modelNeeds],
    provider: t.provider,
    celebration: "normal",
    leech: card ? isLeech(card) : false,
    ...extra,
  }
}

/** Defect #2: a match_pairs card needs several items so the renderer shows
 *  multiple pairs. Draw compatible companions for `primaryItemId` from its own
 *  unit(s) and the immediately-prior unit — same item kind, not Suspended, not
 *  already used this batch, and respecting the item-gap floor against recent
 *  emits. Prefers already-seen items (a pairing reviews known material) but
 *  fills with fresh ones. Deterministic under the session PRNG. Returns up to
 *  MATCH_PAIRS_MAX_ITEMS − 1 companions (fewer when the band is thin). */
function matchPairsCompanions(bag: MixerBag, primaryItemId: string, slots: Slot[]): string[] {
  const { gidx, session } = bag
  const primary = gidx.graph.items[primaryItemId]
  if (!primary) return []
  const kind = primary.kind

  const used = new Set<string>([primaryItemId])
  for (const s of slots) for (const id of s.itemIds) used.add(id)

  const ordinals = new Set<number>()
  for (const skillId of primary.skillIds) {
    const unitId = gidx.graph.skills[skillId]?.unitId
    const ord = unitId !== undefined ? gidx.unitPos.get(unitId) : undefined
    if (ord !== undefined) {
      ordinals.add(ord)
      if (ord - 1 >= 0) ordinals.add(ord - 1)
    }
  }
  if (ordinals.size === 0) ordinals.add(bag.course.position.unitOrdinal)

  const pos = session.emitIndex + slots.length
  const candidates: string[] = []
  for (const ord of [...ordinals].sort((a, b) => a - b)) {
    const unit = gidx.units[ord]
    if (!unit) continue
    for (const skillId of unit.skillIds) {
      for (const id of gidx.skillItems.get(skillId) ?? []) {
        if (used.has(id)) continue
        const item = gidx.graph.items[id]
        if (!item || item.kind !== kind) continue
        const card = bag.cards.get(id)
        if (card && (card.flags & 8) !== 0) continue // Suspended — never served
        const last = session.lastEmit.get(id)
        if (last !== undefined && pos - last < ITEM_MIN_GAP) continue
        used.add(id)
        candidates.push(id)
      }
    }
  }
  if (candidates.length === 0) return []

  const seen = candidates.filter((id) => (bag.cards.get(id)?.fsrs.reps ?? 0) > 0)
  const fresh = candidates.filter((id) => (bag.cards.get(id)?.fsrs.reps ?? 0) === 0)
  session.rng.shuffle(seen)
  session.rng.shuffle(fresh)
  const ordered = [...seen, ...fresh]
  const want =
    MATCH_PAIRS_MIN_ITEMS -
    1 +
    session.rng.int(MATCH_PAIRS_MAX_ITEMS - MATCH_PAIRS_MIN_ITEMS + 1)
  return ordered.slice(0, want)
}

function modelKey(modelNeeds: ModelNeed[], pinTail?: boolean): number {
  if (pinTail) return 9
  if (modelNeeds.includes("llm")) return 3
  if (modelNeeds.includes("stt")) return 2
  if (modelNeeds.includes("tts")) return 1
  return 0
}

/** Lesson recipe slot → pool + candidate items (engine.md §5.10). The debt
 *  brake still applies inside a lesson — a recipe never overrides safety. */
function lessonSlotItem(
  bag: MixerBag,
  pools: Pools,
  cursor: { due: number; new: number; repair: number; trickle: number; fun: number },
  selector: string,
  debt: boolean,
): { itemId: string; pool: PoolTag } | undefined {
  const unit = bag.gidx.units[bag.course.position.unitOrdinal]
  switch (selector) {
    case "due": {
      if (cursor.due < pools.due.length) return { itemId: pools.due[cursor.due++], pool: "due" }
      return undefined
    }
    case "new": {
      if (debt) return undefined
      if (cursor.new < pools.new.length) return { itemId: pools.new[cursor.new++], pool: "new" }
      return undefined
    }
    case "known": {
      if (cursor.fun < pools.fun.length) return { itemId: pools.fun[cursor.fun++], pool: "fun" }
      return undefined
    }
    case "unit":
    case "grammar-node":
    case "l1-phoneme": {
      const wantKind = selector === "grammar-node" ? "grammarNode" : selector === "l1-phoneme" ? "phoneme" : null
      for (const skillId of unit?.skillIds ?? []) {
        for (const itemId of bag.gidx.skillItems.get(skillId) ?? []) {
          if (wantKind && bag.gidx.graph.items[itemId].kind !== wantKind) continue
          const pos = bag.session.lastEmit.get(itemId)
          if (pos !== undefined && bag.session.emitIndex - pos < ITEM_MIN_GAP) continue
          const card = bag.cards.get(itemId)
          if (!card) {
            if (debt) continue
            return { itemId, pool: "new" }
          }
          if ((card.flags & 8) !== 0) continue // Suspended — never served
          if (card.fsrs.reps > 0) return { itemId, pool: "due" }
        }
      }
      return undefined
    }
    default:
      return undefined // "rare" rides the rare roll; "none" is display-only
  }
}

/** The full §5.4 algorithm. */
export function nextFeedItems(bag: MixerBag, n = DEFAULT_BATCH_SIZE, constraints?: FeedConstraints): EngineCard[] {
  const cons = normalizeConstraints(constraints)
  const { session, course, gidx } = bag
  const rng = session.rng
  bag.telemetry.batches += 1
  bag.telemetry.lastShortfallReason = null

  const lessonBag: LessonBag = bag

  // ---- unit boss / arc gate: ONE dedicated batch, returned as-is (§5.10) --
  const boss = pendingBoss(lessonBag)
  if (boss && !session.checkpointRun) {
    const picks = buildBossPicks(lessonBag, boss, rng)
    const slots: Slot[] = []
    for (const pick of picks) {
      const t = chooseActivityType(bag, cons, pick.itemId, 2, {
        pool: "checkpoint",
        restrict: pick.slot.activityTypes.length > 0 ? pick.slot.activityTypes : undefined,
        biasStrand: null,
        forceInputFluency: false,
        leechItem: false,
        avoidType: slots[slots.length - 1]?.activityType,
      })
      if (!t) continue
      slots.push(makeSlot(bag, pick.itemId, t, "checkpoint", { checkpointId: boss.checkpointId }))
    }
    if (slots.length > 0) {
      const summary = checkpointSummary(lessonBag, boss, slots.length)
      startCheckpointRun(session, boss, slots.length)
      slots.forEach((s, i) => {
        s.checkpoint = {
          checkpointId: boss.checkpointId,
          scope: boss.scope,
          passScore: boss.passScore,
          index: i,
          count: slots.length,
          summary,
        }
      })
      for (let i = 1; i < slots.length; i++) {
        if (slots[i].activityType === slots[i - 1].activityType) bag.telemetry.relaxations += 1
      }
      return finalize(bag, slots)
    }
  }

  const pools = buildPools(bag)
  const quota = adjustQuotas(course, session.flow.mode, pools.dueCount)
  const slots: Slot[] = []
  const cursor = { due: 0, new: 0, repair: 0, trickle: 0, fun: 0 }
  const stage = gidx.stageOfUnit(course.position.unitOrdinal)
  const biasStrand = mostDeficientStrand(course, bag.day, stage)
  const strandWeights = strandControlWeights(course, bag.day, stage)
  let forceInputFluencyBudget = languageOverCap(session) ? 2 : 0
  let leechServed = 0
  let funServed = 0
  let edgeUsed = 0

  const rOf = (itemId: string): number => {
    const card = bag.cards.get(itemId)
    if (!card) return 0
    const cached = pools.r.get(itemId)
    return cached !== undefined ? cached : bag.scheduler.retrievability(card, bag.nowMs)
  }

  const tryIssue = (
    itemId: string,
    pool: PoolTag,
    form: 0 | 1 | 2,
    extra?: Partial<Slot>,
    restrict?: string[],
  ): Slot | null => {
    const card = bag.cards.get(itemId)
    if (card && (card.flags & 8) !== 0) return null // Suspended — never served
    const leechItem = card ? isLeech(card) : false
    if (leechItem && leechServed >= MAX_LEECH_PER_BATCH) return null
    if (leechItem && bag.session.rng.next() > LEECH_SERVE_P) return null // §5.7 containment
    const typeOpts: TypeChoiceOpts = {
      pool,
      biasStrand,
      strandWeights,
      forceInputFluency: forceInputFluencyBudget > 0,
      leechItem,
      restrict,
      // Cross-batch §5.4 seed: the first slot of a batch avoids the previous
      // batch's tail type (the seam was previously unchecked — W10/W4 fix b).
      avoidType: slots[slots.length - 1]?.activityType ?? bag.session.lastBatchTailType ?? undefined,
    }
    const t = chooseActivityType(bag, cons, itemId, form, typeOpts)
    if (!t) return null
    let slot = makeSlot(bag, itemId, t, pool, extra)
    // Defect #2: a match_pairs card must carry several items so the renderer
    // shows multiple pairs — never the one-pair collapse. A single-item
    // presentation (debut intro / unscored) OR a band too thin to form even
    // one extra pair re-picks a different activity type instead.
    if (t.activityType === "match_pairs") {
      const companions =
        slot.debutIntro || slot.unscored ? [] : matchPairsCompanions(bag, itemId, slots)
      if (companions.length >= 1) {
        slot.itemIds = [itemId, ...companions]
      } else {
        const alt = chooseActivityType(bag, cons, itemId, form, {
          ...typeOpts,
          avoidType: "match_pairs",
        })
        if (alt && alt.activityType !== "match_pairs") slot = makeSlot(bag, itemId, alt, pool, extra)
      }
    }
    slots.push(slot)
    if (leechItem) leechServed += 1
    if (pool === "fun") funServed += 1
    if (forceInputFluencyBudget > 0 && (slot.strand === "input" || slot.strand === "fluency")) {
      forceInputFluencyBudget -= 1
    }
    return slot
  }

  // -- 0. session opener: warm win (once per session) ------------------------
  if (!session.openerServed) {
    let best: string | null = null
    let bestR = -1
    for (const card of bag.cards.values()) {
      if (card.fsrs.reps === 0 || (card.flags & 8) !== 0) continue
      const r = rOf(card.itemId)
      if (r >= OPENER_R_MIN && r <= OPENER_R_MAX && r > bestR) {
        const t = chooseActivityType(bag, cons, card.itemId, card.form, {
          pool: "due",
          biasStrand: null,
          forceInputFluency: false,
          leechItem: isLeech(card),
        })
        if (t && t.modelNeeds.length === 0) {
          best = card.itemId
          bestR = r
        }
      }
    }
    if (best) {
      const card = bag.cards.get(best)
      tryIssue(best, "due", card?.form ?? 0)
    }
    session.openerServed = true
  }

  // -- 1. struggle scaffolding (prepend, outside quota) ------------------------
  if (session.flow.mode === "struggle" && session.scaffoldItemId) {
    const failedItem = session.scaffoldItemId
    session.scaffoldItemId = null
    tryIssue(failedItem, "scaffold", 0)
    // near-certain win: R ∈ [0.9, 1)
    let win: string | null = null
    let winR = -1
    for (const card of bag.cards.values()) {
      if (card.fsrs.reps === 0 || card.itemId === failedItem || (card.flags & 8) !== 0) continue
      const r = rOf(card.itemId)
      if (r >= NEAR_WIN_R_MIN && r < 1 && r > winR) {
        win = card.itemId
        winR = r
      }
    }
    if (win) tryIssue(win, "due", bag.cards.get(win)?.form ?? 0)
  }

  // -- 1.5 lesson layer (R5, §5.10) --------------------------------------------
  if (course.lesson) {
    const lessonSlots = takeLessonSlots(lessonBag, Math.max(0, n - slots.length))
    for (const { slot } of lessonSlots) {
      if (slot.itemSelector === "none" || slot.itemSelector === "rare") continue
      // optional slots drop under modelNeeds pressure
      const restricted = slot.activityTypes.filter((ty) =>
        gidx.graph.activityTemplates.some((t) => t.activityType === ty && templateUsable(t, cons)),
      )
      if (restricted.length === 0) {
        if (slot.optional) continue
        // required slot with no usable declared type: fall through unrestricted
      }
      const pick = lessonSlotItem(bag, pools, cursor, slot.itemSelector, quota.debt)
      if (!pick) continue
      if (pick.pool === "new" && !bag.cards.has(pick.itemId)) {
        // NEW debuts keep the intro → recognition ladder inside lessons too
        if ((session.debuts.get(pick.itemId) ?? 0) === 0) {
          const introSlot = tryIssue(pick.itemId, "new", 0, { debutIntro: true, unscored: true })
          if (introSlot) session.debuts.set(pick.itemId, 1)
        }
        continue
      }
      const form = chooseForm(
        bag.cards.get(pick.itemId) ?? emptyForForm(pick.itemId),
        session.flow.mode,
        rOf(pick.itemId),
        rng,
      )
      tryIssue(pick.itemId, pick.pool, form, undefined, restricted.length > 0 ? restricted : undefined)
    }
  }

  // -- 2. fill remaining slots ---------------------------------------------------
  const poolOrder: { tag: "due" | "new" | "repair" | "fun" | "trickle"; list: string[] }[] = [
    { tag: "due", list: pools.due },
    { tag: "new", list: pools.new },
    { tag: "repair", list: pools.repair },
    { tag: "fun", list: pools.fun },
    { tag: "trickle", list: pools.trickle },
  ]
  const remaining = (tag: "due" | "new" | "repair" | "fun" | "trickle"): number => {
    const entry = poolOrder.find((p) => p.tag === tag)
    return entry ? entry.list.length - cursor[tag] : 0
  }
  // "edge" = stretch material beyond the position unit's ceiling AND beyond
  // θ+1 (jump-fail boosts, substitutes from ahead) — ≤1 per batch
  // (pedagogy §12.2). Normal spine intake is paced by newPerDay, not this.
  const unitSkills = gidx.units[course.position.unitOrdinal]?.skillIds ?? []
  const unitMaxB = unitSkills.reduce(
    (a, s) => Math.max(a, gidx.graph.skills[s]?.b ?? a),
    Number.NEGATIVE_INFINITY,
  )
  const isEdge = (itemId: string): boolean => {
    const item = gidx.graph.items[itemId]
    if (!item) return false
    return item.b > course.theta + 1 && item.b > unitMaxB + 0.25
  }

  let attempts = 0
  while (slots.length < n && attempts < n * 12) {
    attempts += 1

    // replays (and owed debut recognitions) preempt when their gap is satisfied
    const pos = session.emitIndex + slots.length
    const replayIdx = session.replayQueue.findIndex((e) => e.notBeforeEmitIndex <= pos)
    if (replayIdx >= 0) {
      const entry = session.replayQueue.splice(replayIdx, 1)[0]
      const slot = tryIssue(entry.itemId, "replay", entry.form, { isReplay: true, minPos: entry.notBeforeEmitIndex })
      if (slot) continue
    }
    const debutIdx = session.pendingDebutRecognitions.findIndex((e) => e.notBeforeEmitIndex <= pos)
    if (debutIdx >= 0) {
      const entry = session.pendingDebutRecognitions.splice(debutIdx, 1)[0]
      const slot = tryIssue(entry.itemId, "new", 0, { minPos: entry.notBeforeEmitIndex })
      if (slot) {
        session.debuts.set(entry.itemId, 2)
        continue
      }
      session.pendingDebutRecognitions.push(entry) // type unavailable; retry later
    }

    const weights: [("due" | "new" | "repair" | "fun" | "trickle"), number][] = []
    const push = (tag: "due" | "new" | "repair" | "fun" | "trickle", w: number): void => {
      if (w > 0 && remaining(tag) > 0) weights.push([tag, w])
    }
    const trickleBacklog = !quota.debt && remaining("trickle") > 0
    push("due", quota.review)
    push("new", quota.debt ? 0 : trickleBacklog ? quota.new * 0.5 : quota.new)
    push("repair", quota.repair)
    push("fun", funServed < Math.max(1, Math.ceil(n / 10)) * MAX_FUN_PER_10 ? quota.fun : 0)
    // flex → largest normalized backlog (trickle preferred when nonempty);
    // the placed-backlog TRICKLE shares the NEW quota (both are intake) and
    // absorbs its overflow — that is how the §4.3.3 backlog actually drains
    if (trickleBacklog) {
      push("trickle", quota.flex + quota.new * 0.5 + (remaining("new") === 0 ? quota.new * 0.5 : 0))
    } else {
      const backlogs: ["due" | "repair" | "fun", number][] = [
        ["due", remaining("due")],
        ["repair", remaining("repair")],
        ["fun", remaining("fun")],
      ]
      backlogs.sort((a, b) => b[1] - a[1])
      if (backlogs[0][1] > 0) push(backlogs[0][0], quota.flex)
    }
    if (weights.length === 0) break

    const tag = weightedPick(rng, weights)
    if (!tag) break
    const list = poolOrder.find((p) => p.tag === tag)!.list
    const itemId = list[cursor[tag]++]
    if (itemId === undefined) continue
    if (session.lastEmit.has(itemId)) {
      const last = session.lastEmit.get(itemId)!
      if (session.emitIndex + slots.length - last < ITEM_MIN_GAP) continue
    }
    if (slots.some((s) => s.itemIds.includes(itemId))) continue

    if ((tag === "new" || tag === "trickle") && isEdge(itemId)) {
      if (edgeUsed >= 1) continue // ≤1 edge card per batch (pedagogy §12.2)
      edgeUsed += 1
    }

    if (tag === "new") {
      // debut ladder: intro (unscored) → recognition, same session
      const stage = session.debuts.get(itemId) ?? 0
      if (stage === 0) {
        const slot = tryIssue(itemId, "new", 0, { debutIntro: true, unscored: true })
        if (slot) session.debuts.set(itemId, 1)
        continue
      }
      continue // stages 1/2 ride pendingDebutRecognitions / are done
    }

    if (tag === "trickle") {
      tryIssue(itemId, "trickle", 0)
      continue
    }

    const card = bag.cards.get(itemId)
    const form = card ? chooseForm(card, session.flow.mode, rOf(itemId), rng) : 0
    tryIssue(itemId, tag, form)
  }

  // -- 3. rare-card roll (variable ratio, D7 economy) ----------------------------
  const rare = rollRare(lessonBag, rng, [...cons.providers])
  if (rare) {
    // replaces a flex/fun-ish slot only; never replay/scaffold/opener/checkpoint
    const idx = slots.findIndex(
      (s) => (s.pool === "fun" || s.pool === "due" || s.pool === "trickle") && !s.isReplay && !s.debutIntro,
    )
    if (idx >= 0) {
      slots[idx].rareVariant = rare.rareVariant
      slots[idx].celebration = "rare"
      if (rare.rareCard.provider && rare.rareCard.provider !== "native") {
        slots[idx].provider = rare.rareCard.provider
      }
    }
  }

  // -- 3.5 cadence checkpoint (R5) -------------------------------------------------
  const emittedAfter = session.emitIndex + slots.length
  if (slots.length > 0 && emittedAfter >= (session.cadenceEmitted + 1) * cons.cadence) {
    session.cadenceEmitted += 1
    const unit = gidx.units[course.position.unitOrdinal]
    slots.push({
      itemIds: [],
      activityType: "checkpoint_summary",
      form: 0,
      pool: "checkpoint",
      strand: "fluency",
      guessable: false,
      estSec: 8,
      modelNeeds: [],
      provider: "native",
      celebration: "normal",
      unscored: true,
      pinTail: true,
      checkpoint: {
        checkpointId: `cadence:${session.sessionId}:${session.cadenceEmitted}`,
        scope: "unit",
        passScore: 0,
        index: 0,
        count: 1,
        summary: {
          unitId: unit?.unitId,
          skillIds: unit?.skillIds ?? [],
          itemCount: 0,
          passScore: 0,
        },
      },
    })
  }

  // -- 4. Jump checkpoint offer (§5.9) ----------------------------------------------
  const jumpEligible =
    !quota.debt &&
    !session.jumpOfferedThisSession &&
    bag.day - course.jump.lastOfferedDay >= JUMP_OFFER_INTERVAL_DAYS &&
    (course.jump.consecutiveCruiseSessions >= JUMP_CRUISE_SESSIONS ||
      course.placementCheckPending === "offer-jump")
  if (jumpEligible && slots.length > 0) {
    session.jumpOfferedThisSession = true
    course.jump.lastOfferedDay = bag.day
    slots.push({
      itemIds: [],
      activityType: "jump_offer",
      form: 0,
      pool: "jump",
      strand: "fluency",
      guessable: false,
      estSec: 8,
      modelNeeds: [],
      provider: "native",
      celebration: "normal",
      unscored: true,
      pinTail: true,
    })
  }

  // -- 5. constraint repair (bounded local swaps within the batch) --------------------
  repairConstraints(bag, slots)

  // -- 6. model-residency batching (D8) -------------------------------------------------
  stablePartition(slots)
  reorderWithinBlocks(slots)
  enforceMinPos(bag, slots)
  enforceItemGapFinal(bag, slots)

  // -- 7. timebox + cool-down ----------------------------------------------------------
  if (cons.timeboxSec !== undefined) {
    let total = slots.reduce((a, s) => a + s.estSec, 0)
    while (slots.length > 1 && total > cons.timeboxSec) {
      const dropped = slots.pop()!
      total -= dropped.estSec
    }
  }
  const last = slots[slots.length - 1]
  if (last && (last.strand === "fluency" || last.pool === "fun") && !last.checkpoint) {
    last.coolDown = true
  }

  // residual sameType adjacency (unsatisfiable on tiny type sets) is RELAXED
  // and logged — starvation telemetry for the simulation gate (§5.4 step 5).
  // Pairs INSIDE an stt/llm/tts run are exempt: block contiguity is MANDATED
  // by step 6, and a model class with one renderable type is inherently
  // same-type-adjacent (models warm once, run their block, unload).
  if (
    slots.length > 0 &&
    bag.session.lastBatchTailType !== null &&
    slots[0].activityType === bag.session.lastBatchTailType &&
    modelKey(slots[0].modelNeeds, slots[0].pinTail) === 0
  ) {
    bag.telemetry.relaxations += 1
  }
  for (let i = 1; i < slots.length; i++) {
    if (slots[i].activityType !== slots[i - 1].activityType) continue
    if (modelKey(slots[i].modelNeeds, slots[i].pinTail) !== 0) continue
    if (modelKey(slots[i - 1].modelNeeds, slots[i - 1].pinTail) !== 0) continue
    bag.telemetry.relaxations += 1
  }

  if (slots.length === 0) {
    bag.telemetry.shortfalls += 1
    bag.telemetry.lastShortfallReason = quota.debt
      ? "debt-brake-and-no-due"
      : "no-servable-items-or-templates"
    return []
  }
  return finalize(bag, slots)
}

function emptyForForm(itemId: string): ItemCard {
  return { itemId, fsrs: { s: 0, d: 0, due: 0, last: 0, reps: 0, lapses: 0, state: 0 }, flags: 0, form: 0 }
}

/** Greedy stable reorder of the movable slots to kill same-type adjacency.
 *  Slots with position obligations (replay/debut minPos, pins, checkpoints,
 *  debut intros) keep their indexes — debut-order is NEVER dropped. */
function reorderForAdjacency(slots: Slot[], prevTailType: string | null): void {
  // debut intros ARE movable: recognitions are queued at finalize from the
  // FINAL intro position, so intra-batch order carries no obligation
  const movable = (s: Slot): boolean =>
    !s.pinTail && !s.checkpoint && s.minPos === undefined
  const movableIdx: number[] = []
  for (let i = 0; i < slots.length; i++) if (movable(slots[i])) movableIdx.push(i)
  const pool = movableIdx.map((i) => slots[i])
  for (const idx of movableIdx) {
    // idx 0 checks against the previous batch's tail (cross-batch §5.4 seam).
    const prevType = idx > 0 ? slots[idx - 1].activityType : prevTailType
    const nextFixed = idx + 1 < slots.length && !movable(slots[idx + 1]) ? slots[idx + 1].activityType : null
    let pick = pool.findIndex(
      (s) => s.activityType !== prevType && (nextFixed === null || s.activityType !== nextFixed),
    )
    if (pick < 0) pick = pool.findIndex((s) => s.activityType !== prevType)
    if (pick < 0) pick = 0
    slots[idx] = pool.splice(pick, 1)[0]
  }
}

/** §5.4 step 5 — bounded passes; relaxation order sameType → itemGap(3→2);
 *  NEVER drop replay-gap or debut-order rules. */
function repairConstraints(bag: MixerBag, slots: Slot[]): void {
  const swappable = (s: Slot): boolean => !s.pinTail && !s.checkpoint

  for (let pass = 0; pass < CONSTRAINT_REPAIR_PASSES; pass++) {
    let dirty = false
    // no two consecutive slots share activityType — greedy stable reorder.
    // The batch head also checks the previous batch's tail (the seam).
    const tailType = bag.session.lastBatchTailType
    let adjacency = 0
    if (slots.length > 0 && tailType !== null && slots[0].activityType === tailType) adjacency += 1
    for (let i = 1; i < slots.length; i++) {
      if (slots[i].activityType === slots[i - 1].activityType) adjacency += 1
    }
    if (adjacency > 0) {
      reorderForAdjacency(slots, tailType)
      dirty = true
    }
    // same itemId gap ≥ 3 (incl. lastEmit from previous batches)
    for (let i = 0; i < slots.length; i++) {
      for (const itemId of slots[i].itemIds) {
        const priorInBatch = slots.findIndex((s, j) => j < i && s.itemIds.includes(itemId))
        const prevPos =
          priorInBatch >= 0
            ? bag.session.emitIndex + priorInBatch
            : bag.session.lastEmit.get(itemId)
        if (prevPos === undefined) continue
        const gap = bag.session.emitIndex + i - prevPos
        const minGap = pass < CONSTRAINT_REPAIR_PASSES - 1 ? ITEM_MIN_GAP : ITEM_MIN_GAP_RELAXED
        if (gap >= minGap) continue
        if (pass === CONSTRAINT_REPAIR_PASSES - 1 && gap >= ITEM_MIN_GAP_RELAXED) {
          bag.telemetry.relaxations += 1
          continue
        }
        // push later; if it cannot move (tail), defer to next batch (drop)
        if (i < slots.length - 1 && swappable(slots[i])) {
          const s = slots.splice(i, 1)[0]
          slots.push(s)
          dirty = true
        } else if (swappable(slots[i]) && !slots[i].isReplay && !slots[i].debutIntro) {
          slots.splice(i, 1)
          dirty = true
        }
        break
      }
    }
    // ≤1 FUN full-game card per 10 slots
    const funCap = Math.max(1, Math.ceil(slots.length / 10)) * MAX_FUN_PER_10
    let fun = 0
    for (let i = 0; i < slots.length; i++) {
      if (slots[i].pool !== "fun") continue
      fun += 1
      if (fun > funCap) {
        slots.splice(i, 1)
        i -= 1
        dirty = true
      }
    }
    // a card with modelNeeds never occupies slot 0
    if (slots.length > 1 && slots[0].modelNeeds.length > 0) {
      const j = slots.findIndex((s) => s.modelNeeds.length === 0)
      if (j > 0) {
        const s = slots.splice(j, 1)[0]
        slots.unshift(s)
        dirty = true
      }
    }
    if (!dirty) break
  }
}

/** §5.4 step 6 — contiguous model blocks, keyOrder [none, tts, stt, llm],
 *  stable within-block order; tail-pinned faces stay at the end. */
function stablePartition(slots: Slot[]): void {
  const keyed = slots.map((s, i) => ({ s, i, k: modelKey(s.modelNeeds, s.pinTail) }))
  keyed.sort((a, b) => a.k - b.k || a.i - b.i)
  for (let i = 0; i < keyed.length; i++) slots[i] = keyed[i].s
}

/** The partition can re-cluster same-type cards (few types per model class);
 *  a second greedy pass runs WITHIN each model block only. */
function reorderWithinBlocks(slots: Slot[]): void {
  let start = 0
  while (start < slots.length) {
    const key = modelKey(slots[start].modelNeeds, slots[start].pinTail)
    let end = start + 1
    while (end < slots.length && modelKey(slots[end].modelNeeds, slots[end].pinTail) === key) end += 1
    if (end - start > 2) {
      const block = slots.slice(start, end)
      const movable = (s: Slot): boolean => s.minPos === undefined && !s.checkpoint
      const pool = block.filter(movable)
      for (let i = start; i < end; i++) {
        if (!movable(slots[i])) continue
        const prevType = i > 0 ? slots[i - 1].activityType : null
        let pick = pool.findIndex((s) => s.activityType !== prevType)
        if (pick < 0) pick = 0
        if (pool.length > 0) slots[i] = pool.splice(pick, 1)[0]
      }
    }
    start = end
  }
}

/** Re-verify replay/debut minimum positions after the partition; resolve by
 *  swapping WITHIN the slot's model block only (block contiguity survives).
 *  If the gap cannot be satisfied in this batch, the card is deferred back
 *  to its queue — the replay-gap/debut-order rules are never relaxed. */
function enforceMinPos(bag: MixerBag, slots: Slot[]): void {
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i]
    if (s.minPos === undefined) continue
    const key = modelKey(s.modelNeeds, s.pinTail)
    let idx = i
    while (
      bag.session.emitIndex + idx < s.minPos &&
      idx < slots.length - 1 &&
      modelKey(slots[idx + 1].modelNeeds, slots[idx + 1].pinTail) === key &&
      // never pull ANOTHER position-obligated slot below its own floor
      (slots[idx + 1].minPos === undefined || bag.session.emitIndex + idx >= slots[idx + 1].minPos!)
    ) {
      const tmp = slots[idx]
      slots[idx] = slots[idx + 1]
      slots[idx + 1] = tmp
      idx += 1
    }
    if (bag.session.emitIndex + idx < s.minPos) {
      // defer to the next batch
      slots.splice(idx, 1)
      const itemId = s.itemIds[0]
      if (s.isReplay && itemId) {
        bag.session.replayQueue.push({
          itemId,
          notBeforeEmitIndex: s.minPos,
          form: s.form,
          failures: 1,
        })
      } else if (itemId && s.pool === "new" && !s.debutIntro) {
        bag.session.pendingDebutRecognitions.push({ itemId, notBeforeEmitIndex: s.minPos })
        bag.session.debuts.set(itemId, 1)
      }
      i -= 1
    }
  }
}

/** Post-partition item-gap re-verification (§5.4 step 6 note): the hard
 *  floor (gap ≥ 2, incl. cross-batch lastEmit) is enforced by moving the
 *  later serving to the end of its model block, else deferring it. */
function enforceItemGapFinal(bag: MixerBag, slots: Slot[]): void {
  const posOf = (i: number): number => bag.session.emitIndex + i
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i]
    if (s.itemIds.length === 0 || s.checkpoint) continue
    const violates = (idx: number): boolean => {
      for (const itemId of slots[idx].itemIds) {
        let prev = bag.session.lastEmit.get(itemId)
        for (let j = 0; j < idx; j++) {
          if (slots[j].itemIds.includes(itemId)) prev = posOf(j)
        }
        if (prev !== undefined && posOf(idx) - prev < ITEM_MIN_GAP_RELAXED) return true
      }
      return false
    }
    if (!violates(i)) continue
    // bubble toward the end of the same model block; never pull a
    // position-obligated (minPos) slot below its own floor
    const key = modelKey(s.modelNeeds, s.pinTail)
    let idx = i
    while (
      violates(idx) &&
      idx < slots.length - 1 &&
      modelKey(slots[idx + 1].modelNeeds, slots[idx + 1].pinTail) === key &&
      (slots[idx + 1].minPos === undefined || bag.session.emitIndex + idx >= slots[idx + 1].minPos!)
    ) {
      const tmp = slots[idx]
      slots[idx] = slots[idx + 1]
      slots[idx + 1] = tmp
      idx += 1
    }
    if (violates(idx)) {
      // defer: drop from this batch; replays/debut-recognitions re-queue
      const dropped = slots.splice(idx, 1)[0]
      const itemId = dropped.itemIds[0]
      if (dropped.isReplay && itemId) {
        bag.session.replayQueue.push({
          itemId,
          notBeforeEmitIndex: (dropped.minPos ?? posOf(idx)) + ITEM_MIN_GAP,
          form: dropped.form,
          failures: 1,
        })
        bag.session.replayedItems.delete(itemId)
      } else if (itemId && dropped.pool === "new" && !dropped.debutIntro) {
        bag.session.pendingDebutRecognitions.push({
          itemId,
          notBeforeEmitIndex: (dropped.minPos ?? posOf(idx)) + ITEM_MIN_GAP,
        })
        bag.session.debuts.set(itemId, 1)
      }
      i -= 1
    }
  }
}

function finalize(bag: MixerBag, slots: Slot[]): EngineCard[] {
  const { session, course, gidx } = bag
  const cards: EngineCard[] = []
  const level = gidx.arcById.get(course.position.arcId)?.cefr
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i]
    const position = session.emitIndex + i
    const specId = `${session.sessionId}:${position}`
    const itemRefs = s.itemIds.map((id) => gidx.graph.items[id].ref)
    const params: Record<string, unknown> = {}
    if (s.guessable) {
      params.b_distractor = session.flow.mode === "cruise" ? course.theta : course.theta - 0.5
    }
    if (s.debutIntro) params.intro = true
    const issued: IssuedCard = {
      specId,
      activityType: s.activityType,
      itemIds: [...s.itemIds],
      form: s.form,
      guessable: s.guessable,
      isReplay: s.isReplay === true,
      pool: s.pool,
      strand: s.strand,
      estSec: s.estSec,
      modelNeeds: [...s.modelNeeds],
      issuedAtMs: bag.nowMs,
      unscored: s.unscored,
      checkpointId: s.checkpointId,
    }
    session.issued.set(specId, issued)
    for (const itemId of s.itemIds) {
      session.lastEmit.set(itemId, position)
      if (s.isReplay) session.replayedItems.add(itemId) // one replay per session
      const card = bag.cards.get(itemId)
      if (card && isLeech(card)) recordLeechServing(course, itemId, s.activityType)
    }
    if (s.itemIds.length > 0) {
      pushLast40(session, { activityType: s.activityType, strand: s.strand, itemIds: [...s.itemIds] })
    }
    if (s.debutIntro && s.itemIds.length === 1) {
      session.pendingDebutRecognitions.push({
        itemId: s.itemIds[0],
        notBeforeEmitIndex: position + REPLAY_MIN_GAP,
      })
    }
    cards.push({
      spec: {
        specId,
        activityType: s.activityType,
        itemRefs,
        params: Object.keys(params).length > 0 ? params : undefined,
        level,
        targetLang: gidx.targetLang,
        timeboxSec: s.estSec,
        modelNeeds: s.modelNeeds.length > 0 ? [...s.modelNeeds] : undefined,
      },
      meta: {
        pool: s.pool,
        strand: s.strand,
        form: s.form,
        estSec: s.estSec,
        provider: s.provider,
        celebration: s.celebration,
        rareVariant: s.rareVariant,
        checkpoint: s.checkpoint,
        coolDownCandidate: s.coolDown === true,
        // Presentation-only exposure for the surface (W10/W4 fix a): the
        // IssuedCard already carried this; the wire card now does too.
        ...(s.unscored ? { unscored: true } : {}),
      },
    })
  }
  session.emitIndex += slots.length
  // Cross-batch §5.4 adjacency seed (W10/W4 fix b): remember the batch tail
  // type so the NEXT batch's head can avoid same-type adjacency at the seam.
  const tail = slots[slots.length - 1]
  if (tail) session.lastBatchTailType = tail.activityType
  return cards
}
