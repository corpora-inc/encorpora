// journey/engine/scheduler.ts — the ONLY file that imports "ts-fsrs"
// (engine.md §1.3). Wraps FSRS-6 behind the Scheduler interface so an
// FSRS-7 / WASM-optimizer swap stays invisible to the app (adaptivity §7).

import {
  fsrs,
  generatorParameters,
  createEmptyCard,
  default_w,
  StrategyMode,
  GenSeedStrategyWithCardId,
  type Card,
  type FSRSParameters,
  type Grade as FsrsGrade,
} from "ts-fsrs"

import { DAY_MS, msToDate } from "./clock.ts"
import { DESIRED_RETENTION, MAX_ELAPSED_DAYS } from "./constants.ts"
import { fnv1a32 } from "./rng.ts"
import type { ItemCard, ReviewLogEntry } from "./types.ts"

/** Journey FSRS-6 configuration — adaptivity.md §1.3, verbatim.
 *  default_w (ts-fsrs 5.4.1) === the 21 FSRS-6 weights:
 *  [0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001,
 *   1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014,
 *   1.8729, 0.5425, 0.0912, 0.0658, 0.1542]
 *  T-sched-1 asserts this equality so a ts-fsrs upgrade that silently
 *  changes defaults fails loudly (engine.md §8.2). */
export const JOURNEY_FSRS_PARAMS: FSRSParameters = generatorParameters({
  request_retention: DESIRED_RETENTION, // pace knob — tunable lives in constants.ts (engine.md §1.1)
  maximum_interval: 365, // course content churns; the 36500 default is wrong for us
  w: default_w,
  enable_fuzz: true, // ±small% interval noise; prevents due-date clumping
  enable_short_term: true, // REQUIRED: same-session replay uses the w17–w19 path
  learning_steps: [], // the feed IS the intra-session pacing (adaptivity §1.3)
  relearning_steps: [],
})

export type SchedulerGrade = 1 | 2 | 3 | 4 // Rating.Again..Easy, Manual excluded

export interface Scheduler {
  /** Fresh New-state card fields at `nowDay`. */
  emptyCard(nowDay: number): ItemCard["fsrs"]
  /** Apply one graded review. Handles the same-day (short-term) path. */
  next(
    card: ItemCard,
    nowMs: number,
    grade: SchedulerGrade,
  ): { fsrs: ItemCard["fsrs"]; log: { rating: SchedulerGrade; day: number } }
  /** Closed-form retrievability at `nowMs` (power curve, w20 decay). */
  retrievability(card: ItemCard, nowMs: number): number
  /** "I never learned this" → reset to New (ts-fsrs forget()). */
  forget(card: ItemCard, nowMs: number): ItemCard["fsrs"]
  /** Rebuild memory state from a review-log slice (recovery, engine.md §3.5). */
  replay(entries: ReviewLogEntry[], nowMs: number): ItemCard["fsrs"] | undefined
  /** priorKnown seeding (§4.3.3): first review EASY then one same-day GOOD. */
  seedPriorKnown(itemId: string, nowMs: number): ItemCard["fsrs"]
}

type FsrsCardWithId = Card & { cardId: number }

function toFsrsCard(card: ItemCard, nowDay: number): FsrsCardWithId {
  const f = card.fsrs
  // Clock-jump guards (adaptivity §7): elapsed clamped to [0, 365] by moving
  // last_review; a negative elapsed (clock moved backwards) is same-day.
  let last = f.last
  if (last > 0) {
    if (nowDay < last) last = nowDay
    if (nowDay - last > MAX_ELAPSED_DAYS) last = nowDay - MAX_ELAPSED_DAYS
  }
  const scheduled = f.last > 0 ? Math.max(0, f.due - f.last) : 0
  return {
    due: msToDate(f.due * DAY_MS),
    stability: f.s,
    difficulty: f.d,
    elapsed_days: last > 0 ? nowDay - last : 0,
    scheduled_days: scheduled,
    learning_steps: 0,
    reps: f.reps,
    lapses: f.lapses,
    state: f.state,
    last_review: last > 0 ? msToDate(last * DAY_MS) : undefined,
    cardId: fnv1a32(card.itemId),
  }
}

function fromFsrsCard(c: Card): ItemCard["fsrs"] {
  return {
    s: c.stability,
    d: c.difficulty,
    due: Math.floor(c.due.getTime() / DAY_MS),
    last: c.last_review ? Math.floor(c.last_review.getTime() / DAY_MS) : 0,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state as 0 | 1 | 2 | 3,
  }
}

export function createScheduler(): Scheduler {
  const f = fsrs(JOURNEY_FSRS_PARAMS)
  // Deterministic fuzz: the default seed strategy mixes review_time ms into
  // the seed (non-reproducible). GenSeedStrategyWithCardId seeds from
  // (card.cardId + reps): deterministic given card state. cardId =
  // fnv1a32(itemId) — adaptivity §1.3 "deterministic seed = hash(itemId)".
  f.useStrategy(StrategyMode.SEED, GenSeedStrategyWithCardId("cardId"))

  const emptyAt = (nowDay: number): ItemCard["fsrs"] =>
    fromFsrsCard(createEmptyCard(msToDate(nowDay * DAY_MS)))

  const applyNext = (card: ItemCard, nowMs: number, grade: SchedulerGrade): ItemCard["fsrs"] => {
    const nowDay = Math.floor(nowMs / DAY_MS)
    const rec = f.next(toFsrsCard(card, nowDay), msToDate(nowMs), grade as unknown as FsrsGrade)
    return fromFsrsCard(rec.card)
  }

  return {
    emptyCard: emptyAt,

    next(card, nowMs, grade) {
      const nowDay = Math.floor(nowMs / DAY_MS)
      return { fsrs: applyNext(card, nowMs, grade), log: { rating: grade, day: nowDay } }
    },

    retrievability(card, nowMs) {
      const nowDay = Math.floor(nowMs / DAY_MS)
      if (card.fsrs.reps === 0 || card.fsrs.state === 0) return 0
      const r = f.get_retrievability(toFsrsCard(card, nowDay), msToDate(nowMs), false)
      return typeof r === "number" ? r : 0
    },

    forget(card, nowMs) {
      const nowDay = Math.floor(nowMs / DAY_MS)
      const rec = f.forget(toFsrsCard(card, nowDay), msToDate(nowMs))
      return fromFsrsCard(rec.card)
    },

    replay(entries, nowMs) {
      if (entries.length === 0) return undefined
      const sorted = [...entries].sort((a, b) => a.day - b.day || a.ts - b.ts)
      const itemId = sorted[0].itemId
      let card: ItemCard = { itemId, fsrs: emptyAt(sorted[0].day), flags: 0, form: 0 }
      for (const e of sorted) {
        const atMs = Math.min(e.day * DAY_MS + DAY_MS / 2, nowMs)
        card = { ...card, fsrs: applyNext(card, atMs, e.grade) }
      }
      return card.fsrs
    },

    seedPriorKnown(itemId, nowMs) {
      const nowDay = Math.floor(nowMs / DAY_MS)
      let card: ItemCard = { itemId, fsrs: emptyAt(nowDay), flags: 0, form: 0 }
      card = { ...card, fsrs: applyNext(card, nowMs, 4) } // EASY: S₀ = w3 ≈ 8.3d
      card = { ...card, fsrs: applyNext(card, nowMs, 3) } // same-day GOOD advance
      return card.fsrs
    },
  }
}
