// journey/engine/mastery.ts — derived SkillState + SkillIndex memoization
// (engine.md §2.3). Stored truth per skill is three scalars + timestamps;
// coverage/strength/mastery/level recompute from ItemCards on demand.

import { epochDayFromMs } from "./clock.ts"
import { LEVEL_DEMOTE, LEVEL_MASTERED, LEVEL_PRACTICED } from "./constants.ts"
import type { GraphIndex } from "./graph.ts"
import type { Scheduler } from "./scheduler.ts"
import { CardFlags, type ItemCard, type SkillScalars, type SkillState } from "./types.ts"

export interface MasteryDeps {
  gidx: GraphIndex
  cards: Map<string, ItemCard>
  skills: Map<string, SkillScalars>
  scheduler: Scheduler
}

export interface Mastery {
  getSkillState(skillId: string, nowMs: number): SkillState
  levelOf(skillId: string, nowMs: number): 0 | 1 | 2 | 3 | 4 | 5
  /** Bump the dirty seq for every skill of every touched item (§2.3). */
  markDirty(skillId: string): void
  markAllDirty(): void
  ensureScalars(skillId: string): SkillScalars
}

interface CacheEntry {
  value: SkillState
  day: number
  seq: number
}

export function defaultScalars(skillId: string): SkillScalars {
  return { skillId, accEwma: 0, announcedLevel: 0 }
}

export function createMastery(deps: MasteryDeps): Mastery {
  const cache = new Map<string, CacheEntry>()
  const dirtySeq = new Map<string, number>()

  // reverse prereq edges: dirtying a skill must also dirty its direct
  // dependents (their Unlocked level reads this skill's level)
  const dependents = new Map<string, string[]>()
  for (const [skillId, skill] of Object.entries(deps.gidx.graph.skills)) {
    for (const p of skill.prereqs) {
      const arr = dependents.get(p) ?? []
      arr.push(skillId)
      dependents.set(p, arr)
    }
  }

  const seqOf = (skillId: string): number => dirtySeq.get(skillId) ?? 0

  const ensureScalars = (skillId: string): SkillScalars => {
    let s = deps.skills.get(skillId)
    if (!s) {
      s = defaultScalars(skillId)
      deps.skills.set(skillId, s)
    }
    return s
  }

  const compute = (skillId: string, nowMs: number): SkillState => {
    const day = epochDayFromMs(nowMs)
    const scalars = ensureScalars(skillId)
    const itemIds = deps.gidx.skillItems.get(skillId) ?? []

    let seen = 0
    let cardsExist = 0
    let strengthSum = 0
    let everySeenFormAtLeast1 = true
    for (const itemId of itemIds) {
      const card = deps.cards.get(itemId)
      if (!card) continue
      cardsExist += 1
      if (card.fsrs.reps === 0) continue
      seen += 1
      strengthSum += deps.scheduler.retrievability(card, nowMs)
      if (card.form < 1) everySeenFormAtLeast1 = false
    }
    const coverage = itemIds.length > 0 ? seen / itemIds.length : 0
    const strength = seen > 0 ? strengthSum / seen : 0
    const mastery = coverage * strength

    let level: 0 | 1 | 2 | 3 | 4 | 5
    if (seen === 0) {
      if (scalars.placedAt !== undefined) {
        level = 3 // provisional Practiced (placement/jump — §4.3.2)
      } else if (cardsExist > 0) {
        level = 2 // first ItemCard exists ⇒ Learning
      } else {
        // Unlocked iff all DAG prerequisites ≥ 3 (Practiced)
        const prereqs = deps.gidx.graph.skills[skillId]?.prereqs ?? []
        const unlocked = prereqs.every((p) => levelOf(p, nowMs) >= 3)
        level = unlocked ? 1 : 0
      }
    } else {
      const demoted = strength < LEVEL_DEMOTE.strength || scalars.accEwma < LEVEL_DEMOTE.accEwma
      if (demoted) {
        level = 2
      } else if (scalars.legendaryAt !== undefined) {
        level = 5
      } else if (
        coverage >= LEVEL_MASTERED.coverage &&
        strength >= LEVEL_MASTERED.strength &&
        scalars.accEwma >= LEVEL_MASTERED.accEwma &&
        everySeenFormAtLeast1
      ) {
        level = 4
      } else if (
        coverage >= LEVEL_PRACTICED.coverage &&
        strength >= LEVEL_PRACTICED.strength &&
        scalars.accEwma >= LEVEL_PRACTICED.accEwma
      ) {
        level = 3
      } else {
        level = 2
      }
    }

    const value: SkillState = { ...scalars, coverage, strength, mastery, level }
    cache.set(skillId, { value, day, seq: seqOf(skillId) })
    return value
  }

  const getSkillState = (skillId: string, nowMs: number): SkillState => {
    const day = epochDayFromMs(nowMs)
    const entry = cache.get(skillId)
    if (entry && entry.day === day && entry.seq === seqOf(skillId)) return entry.value
    return compute(skillId, nowMs)
  }

  const levelOf = (skillId: string, nowMs: number): 0 | 1 | 2 | 3 | 4 | 5 =>
    getSkillState(skillId, nowMs).level

  return {
    getSkillState,
    levelOf,
    markDirty(skillId: string) {
      dirtySeq.set(skillId, seqOf(skillId) + 1)
      for (const dep of dependents.get(skillId) ?? []) {
        dirtySeq.set(dep, seqOf(dep) + 1)
      }
    },
    markAllDirty() {
      for (const skillId of Object.keys(deps.gidx.graph.skills)) {
        dirtySeq.set(skillId, seqOf(skillId) + 1)
      }
    },
    ensureScalars,
  }
}

/** Suspended cards never count toward pools; helper shared by pools/leech. */
export function isSuspended(card: ItemCard): boolean {
  return (card.flags & CardFlags.Suspended) !== 0
}

/** Retired cards (R-A: RETIRE_PERFECT_STREAK perfect completions) are excluded
 *  from serving pools + the debt backlog exactly like suspended ones — helper
 *  shared by pools/mixer so a twice-nailed item stops recycling (breadth-first). */
export function isRetired(card: ItemCard): boolean {
  return (card.flags & CardFlags.Retired) !== 0
}
