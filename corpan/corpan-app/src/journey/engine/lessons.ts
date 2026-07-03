// journey/engine/lessons.ts — the R5 lesson/checkpoint layer (engine.md §5.10).
// The engine owns session structure end-to-end; the runtime never invents it.

import { WELCOME_BACK_GAP_DAYS, RARE_DELIGHT_P, RARE_ETYMOLOGY_P, RARE_MINIGAME_P } from "./constants.ts"
import type { GraphIndex } from "./graph.ts"
import type { Mastery } from "./mastery.ts"
import type { Rng } from "./rng.ts"
import { weightedPick } from "./rng.ts"
import type { Scheduler } from "./scheduler.ts"
import type {
  CheckpointRun,
  CheckpointSummary,
  CourseGraph,
  CourseState,
  EngineCard,
  ItemCard,
  RecipeSlot,
  SessionState,
} from "./types.ts"

export interface LessonBag {
  gidx: GraphIndex
  course: CourseState
  session: SessionState
  cards: Map<string, ItemCard>
  mastery: Mastery
  scheduler: Scheduler
  nowMs: number
  day: number
}

type Checkpoint = CourseGraph["checkpoints"][number]

export function unitCheckpoint(gidx: GraphIndex, unitId: string): Checkpoint | undefined {
  return gidx.graph.checkpoints.find((c) => c.scope === "unit" && c.unitId === unitId)
}

export function arcCheckpoint(gidx: GraphIndex, arcId: string): Checkpoint | undefined {
  return gidx.graph.checkpoints.find((c) => c.scope === "arc" && c.arcId === arcId)
}

export function unitSkillsPracticed(bag: LessonBag, unitOrdinal: number): boolean {
  const unit = bag.gidx.units[unitOrdinal]
  if (!unit) return false
  return unit.skillIds.every((s) => bag.mastery.levelOf(s, bag.nowMs) >= 3)
}

/** Boss-readiness: the unit's material has been SEEN (coverage at the
 *  Practiced threshold per skill). The checkpoint's pass_score — not the
 *  noisy accEwma scalar — is what gates advancement (§5.10: a passed boss is
 *  the ONLY way position crosses a checkpointed unit). */
export function unitCoverageReady(bag: LessonBag, unitOrdinal: number): boolean {
  const unit = bag.gidx.units[unitOrdinal]
  if (!unit) return false
  return unit.skillIds.every(
    (s) => bag.mastery.getSkillState(s, bag.nowMs).coverage >= 0.8,
  )
}

/** Reset the lesson cursor for the position's current unit. */
export function initLessonCursor(bag: LessonBag): void {
  const unitId = bag.course.position.unitId
  const plan = bag.gidx.graph.unitLessons[unitId]
  bag.course.lesson =
    plan && plan.length > 0 ? { unitId, lessonIndex: 0, slotIndex: 0 } : null
}

/** Consume up to `max` recipe slots from the active unit lesson (§5.4 step
 *  1.5). Advances the cursor; nulls course.lesson when the plan is exhausted
 *  (the boss follows). */
export function takeLessonSlots(
  bag: LessonBag,
  max: number,
): { slot: RecipeSlot; lessonParams?: Record<string, unknown> }[] {
  const out: { slot: RecipeSlot; lessonParams?: Record<string, unknown> }[] = []
  const { course, gidx } = bag
  while (out.length < max && course.lesson) {
    const cursor = course.lesson
    if (cursor.unitId !== course.position.unitId) {
      initLessonCursor(bag)
      continue
    }
    const plan = gidx.graph.unitLessons[cursor.unitId] ?? []
    const lesson = plan[cursor.lessonIndex]
    if (!lesson) {
      course.lesson = null // plan exhausted ⇒ boss next
      break
    }
    const recipe = gidx.graph.lessonRecipes[lesson.recipeId]
    const slots = recipe?.slots ?? []
    if (cursor.slotIndex >= slots.length) {
      cursor.lessonIndex += 1
      cursor.slotIndex = 0
      if (cursor.lessonIndex >= plan.length) course.lesson = null
      continue
    }
    out.push({ slot: slots[cursor.slotIndex], lessonParams: lesson.params })
    cursor.slotIndex += 1
    if (cursor.slotIndex >= slots.length) {
      cursor.lessonIndex += 1
      cursor.slotIndex = 0
      if (cursor.lessonIndex >= plan.length) course.lesson = null
    }
  }
  return out
}

/** The checkpoint batch the mixer must emit now, if any (§5.10). */
export function pendingBoss(bag: LessonBag): Checkpoint | undefined {
  const { course, gidx, session } = bag
  const unit = gidx.units[course.position.unitOrdinal]
  if (!unit) return undefined

  const cp = unitCheckpoint(gidx, unit.unitId)
  if (cp && course.checkpointsPassed[cp.checkpointId] === undefined) {
    if (session.bossAttempted.has(cp.checkpointId)) return undefined
    const hasLessons = (gidx.graph.unitLessons[unit.unitId] ?? []).length > 0
    const planExhausted = !hasLessons || course.lesson === null
    // the boss is OFFERED once the plan is done and the unit's material has
    // been seen; its pass_score gates advancement (§5.10)
    if (planExhausted && unitCoverageReady(bag, course.position.unitOrdinal)) return cp
    return undefined
  }

  // Unit gate cleared (or absent) — arc gate at the arc boundary.
  const isLastOfArc =
    gidx.units[course.position.unitOrdinal + 1]?.arcId !== unit.arcId
  if (isLastOfArc) {
    const gate = arcCheckpoint(gidx, unit.arcId)
    if (
      gate &&
      course.checkpointsPassed[gate.checkpointId] === undefined &&
      !session.bossAttempted.has(gate.checkpointId) &&
      unitCoverageReady(bag, course.position.unitOrdinal)
    ) {
      return gate
    }
  }
  return undefined
}

export interface BossItemPick {
  itemId: string
  slot: RecipeSlot
}

/** Fill the boss recipe's slots with unit material: one seen item per skill,
 *  round-robin (breadth over the whole unit — a representative task, not a
 *  worst-cards exam; "tasks, not tests", pedagogy §9). */
export function buildBossPicks(bag: LessonBag, cp: Checkpoint, rng: Rng): BossItemPick[] {
  const { gidx, cards } = bag
  const unitId = cp.unitId ?? bag.course.position.unitId
  const unit = gidx.units[gidx.unitPos.get(unitId) ?? bag.course.position.unitOrdinal]
  const scopeSkills =
    cp.scope === "arc"
      ? gidx.units.filter((u) => u.arcId === cp.arcId).flatMap((u) => u.skillIds)
      : unit?.skillIds ?? []
  const bySkill: string[][] = []
  for (const skillId of scopeSkills) {
    const seen: string[] = []
    for (const itemId of gidx.skillItems.get(skillId) ?? []) {
      const card = cards.get(itemId)
      if (!card || (card.flags & 8) !== 0) continue // unseen/suspended excluded
      if (card.fsrs.reps > 0) seen.push(itemId)
    }
    if (seen.length > 0) bySkill.push(rng.shuffle(seen))
  }
  const recipe = gidx.graph.lessonRecipes[cp.recipeId]
  const slots = (recipe?.slots ?? []).filter((s) => s.itemSelector !== "none" && s.itemSelector !== "rare")
  const picks: BossItemPick[] = []
  const used = new Set<string>()
  let skillCursor = 0
  for (const slot of slots) {
    let itemId: string | undefined
    for (let tries = 0; tries < bySkill.length && itemId === undefined; tries++) {
      const skillItems = bySkill[(skillCursor + tries) % Math.max(1, bySkill.length)]
      itemId = skillItems?.find((id) => !used.has(id))
    }
    skillCursor += 1
    if (itemId === undefined) continue
    used.add(itemId)
    picks.push({ itemId, slot })
  }
  return picks
}

export function checkpointSummary(bag: LessonBag, cp: Checkpoint, itemCount: number): CheckpointSummary {
  const unitId = cp.unitId ?? bag.course.position.unitId
  const skillIds =
    cp.scope === "arc"
      ? bag.gidx.units.filter((u) => u.arcId === cp.arcId).flatMap((u) => u.skillIds)
      : bag.gidx.units[bag.gidx.unitPos.get(unitId) ?? -1]?.skillIds ?? []
  return {
    unitId: cp.scope === "unit" ? unitId : undefined,
    arcId: cp.arcId,
    skillIds,
    itemCount,
    passScore: cp.passScore,
  }
}

export function startCheckpointRun(session: SessionState, cp: Checkpoint, count: number): CheckpointRun {
  const run: CheckpointRun = {
    checkpointId: cp.checkpointId,
    scope: cp.scope,
    passScore: cp.passScore,
    count,
    resolved: 0,
    scoreSum: 0,
    weakSkillIds: new Set(),
  }
  session.checkpointRun = run
  session.bossAttempted.add(cp.checkpointId)
  return run
}

/** Advance position past the current unit (and across a passed arc gate). */
export function advancePosition(bag: LessonBag): void {
  const { course, gidx } = bag
  const next = gidx.units[course.position.unitOrdinal + 1]
  if (!next) return // end of shipped content — frontier cap
  course.position = {
    arcId: next.arcId,
    unitId: next.unitId,
    unitOrdinal: course.position.unitOrdinal + 1,
  }
  initLessonCursor(bag)
}

/** Tally one checkpoint-card result; settle the batch on the final card. */
export function applyCheckpointResult(
  bag: LessonBag,
  score: number,
  itemIds: string[],
): { checkpointId: string; passed: boolean; score: number } | undefined {
  const run = bag.session.checkpointRun
  if (!run) return undefined
  run.resolved += 1
  run.scoreSum += score
  if (score < run.passScore) {
    for (const itemId of itemIds) {
      for (const skillId of bag.gidx.graph.items[itemId]?.skillIds ?? []) {
        run.weakSkillIds.add(skillId)
      }
    }
  }
  if (run.resolved < run.count) return undefined

  const finalScore = run.count > 0 ? run.scoreSum / run.count : 0
  const passed = finalScore >= run.passScore
  bag.session.checkpointRun = null
  if (passed) {
    bag.course.checkpointsPassed[run.checkpointId] = bag.day
    const unit = bag.gidx.units[bag.course.position.unitOrdinal]
    const isLastOfArc = bag.gidx.units[bag.course.position.unitOrdinal + 1]?.arcId !== unit?.arcId
    if (run.scope === "unit") {
      // Arc boundaries additionally require the arc gate (§4.6.6).
      const gate = unit && isLastOfArc ? arcCheckpoint(bag.gidx, unit.arcId) : undefined
      if (!gate || bag.course.checkpointsPassed[gate.checkpointId] !== undefined) {
        advancePosition(bag)
      }
    } else {
      advancePosition(bag)
    }
  } else {
    // REPAIR routing: weak items' skills get a demotion stamp (remedial pool).
    for (const skillId of run.weakSkillIds) {
      const scalars = bag.mastery.ensureScalars(skillId)
      scalars.demotedAt = bag.day
      bag.mastery.markDirty(skillId)
    }
  }
  return { checkpointId: run.checkpointId, passed, score: finalScore }
}

/** welcomeBack signal (§4.1): gap ≥ 7 days; retainedPct = mean R over seen cards. */
export function computeWelcomeBack(
  bag: Pick<LessonBag, "cards" | "scheduler" | "nowMs" | "course" | "day">,
): { gapDays: number; retainedPct: number } | undefined {
  const { course, day } = bag
  if (course.lastActiveDay <= 0) return undefined
  const gapDays = day - course.lastActiveDay
  if (gapDays < WELCOME_BACK_GAP_DAYS) return undefined
  let sum = 0
  let n = 0
  for (const card of bag.cards.values()) {
    if (card.fsrs.reps === 0) continue
    sum += bag.scheduler.retrievability(card, bag.nowMs)
    n += 1
  }
  return { gapDays, retainedPct: n > 0 ? sum / n : 0 }
}

const RARE_VARIANT_OF: Record<string, NonNullable<EngineCard["meta"]["rareVariant"]>> = {
  delight: "delight",
  minigame: "miniGame",
  etymology: "etymology",
  story: "storyChapter",
}

export interface RareRoll {
  rareVariant: NonNullable<EngineCard["meta"]["rareVariant"]>
  rareCard: CourseGraph["rareCards"][number]
}

/** One roll per batch (§5.4 step 3): delight 1:8, game round 1:25, etymology
 *  gem 1:50 — the winning variant is a seeded-PRNG draw over graph.rareCards
 *  (rarity_weight as weights; eligibility: min_unit reached, provider
 *  installed; story is cut from v0.1 per R11). */
export function rollRare(
  bag: LessonBag,
  rng: Rng,
  availableProviders: string[],
): RareRoll | undefined {
  const u = rng.next()
  let cardType: "delight" | "minigame" | "etymology"
  if (u < RARE_DELIGHT_P) cardType = "delight"
  else if (u < RARE_DELIGHT_P + RARE_MINIGAME_P) cardType = "minigame"
  else if (u < RARE_DELIGHT_P + RARE_MINIGAME_P + RARE_ETYMOLOGY_P) cardType = "etymology"
  else return undefined

  const eligible = bag.gidx.graph.rareCards.filter((rc) => {
    if (rc.cardType !== cardType) return false // (story never rolls — R11)
    if (rc.minUnitOrdinal !== undefined && bag.course.position.unitOrdinal < rc.minUnitOrdinal) return false
    if (rc.provider && rc.provider !== "native" && !availableProviders.includes(rc.provider)) return false
    return true
  })
  const rareCard = weightedPick(rng, eligible.map((rc) => [rc, rc.rarityWeight] as const))
  if (!rareCard) return undefined
  return { rareVariant: RARE_VARIANT_OF[rareCard.cardType], rareCard }
}
