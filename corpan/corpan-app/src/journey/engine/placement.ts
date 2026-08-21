// journey/engine/placement.ts — 3-phase adaptive probe controller +
// finalize (engine.md §4.3, adaptivity §4.3 verbatim, + the R10 content
// ceiling). Probe results update θ and tallies only — they NEVER create
// ItemCards and never enter the review log (§9.7).
//
// The interactive controller and placeUser() share ONE pure state machine
// (PlacementMachine): the controller adds item SELECTION on top; placeUser
// replays a transcript through the identical update/phase logic — so the two
// are bit-identical given the same answer sequence (§4.3, tested in §8.2).

import {
  PLACED_ACC_EWMA,
  PLACEMENT_ABOVE_CONTENT_MARGIN,
  PLACEMENT_ABOVE_CONTENT_MAX_SE,
  PLACEMENT_FRONTIER_PROBES,
  PLACEMENT_K_DECAY,
  PLACEMENT_K_FLOOR,
  PLACEMENT_K_START,
  PLACEMENT_LADDER_RUNGS,
  PLACEMENT_MAX_ITEMS,
  PLACEMENT_MAX_MS,
  PLACEMENT_MAX_TOTAL,
  PLACEMENT_SE_START,
  PLACEMENT_SE_TARGET,
  PLACEMENT_TARGET_JITTER,
  PLACEMENT_THETA_START,
  PLACEMENT_UNLOCK_MARGIN,
  THETA_DEFAULT,
} from "./constants.ts"
import type { GraphIndex } from "./graph.ts"
import type { Mastery } from "./mastery.ts"
import type { Rng } from "./rng.ts"
import { sigmoid } from "./theta.ts"
import type {
  ActivityResult,
  CourseState,
  EngineCard,
  PlacementOutcome,
  PlacementRecord,
  PlacementSummary,
  ProbeResult,
  SessionState,
} from "./types.ts"

export interface PlacementBag {
  gidx: GraphIndex
  course: CourseState
  session: SessionState
  mastery: Mastery
  rng: Rng
  nowMs(): number
  day: number
  /** Probe card minting (fast, guessable-OK, no speaking, no hints —
   *  adaptivity §4.2). Undefined when no template can render the item. */
  mintProbe(itemId: string): EngineCard | undefined
}

export interface PlacementController {
  next(): EngineCard | undefined
  submit(result: ActivityResult): void
  finalize(): PlacementOutcome
  abort(): void
}

/* ------------------------------------------------------------------------- */
/*  Graph helpers                                                            */
/* ------------------------------------------------------------------------- */

/** First locked teachable layer given a set of unlocked skill ids. */
function frontierOf(gidx: GraphIndex, unlocked: Set<string>): string[] {
  const out: string[] = []
  for (const [skillId, skill] of Object.entries(gidx.graph.skills)) {
    if (unlocked.has(skillId)) continue
    if (skill.prereqs.every((p) => unlocked.has(p))) out.push(skillId)
  }
  return out
}

/** Unlock every skill with b_s ≤ θ − 0.5 whose prereqs are unlocked. */
function unlockedByTheta(gidx: GraphIndex, theta: number): Set<string> {
  const unlocked = new Set<string>()
  let changed = true
  while (changed) {
    changed = false
    for (const [skillId, skill] of Object.entries(gidx.graph.skills)) {
      if (unlocked.has(skillId)) continue
      if (skill.b > theta - PLACEMENT_UNLOCK_MARGIN) continue
      if (!skill.prereqs.every((p) => unlocked.has(p))) continue
      unlocked.add(skillId)
      changed = true
    }
  }
  return unlocked
}

function startUnitFor(gidx: GraphIndex, unlocked: Set<string>): string {
  for (const unit of gidx.units) {
    if (!unit.skillIds.every((s) => unlocked.has(s))) return unit.unitId
  }
  return gidx.units[gidx.units.length - 1]?.unitId ?? ""
}

/* ------------------------------------------------------------------------- */
/*  The shared pure state machine                                            */
/* ------------------------------------------------------------------------- */

type Phase = "ladder" | "elo" | "frontier" | "done"

class PlacementMachine {
  theta = PLACEMENT_THETA_START
  se = PLACEMENT_SE_START
  k = PLACEMENT_K_START
  sumInfo = 0
  asked: { itemId: string; b: number; correct: boolean }[] = []
  phase: Phase = "ladder"
  outcome: PlacementRecord["outcome"] = "placed"
  rungs: number[]
  rungIndex = 0
  frontierLayer: string[] = []
  frontierProbesLeft = 0
  frontierMissUsed = false

  private gidx: GraphIndex

  constructor(gidx: GraphIndex) {
    this.gidx = gidx
    // Phase 1 ladder (R10): the rungs must subdivide the installed pack's
    // ACTUAL b range, not the global CEFR ladder. Merely dropping global
    // rungs above max_b collapses a narrow-band pack (journey_en:
    // b ∈ [−3.5, −1.5]) onto [−3, −1.5] — the second rung IS the ceiling,
    // mid-band learners pass both and exit "above-content" (W10 P8 FAIL).
    // Clamp the global ladder's span to [minB, maxB] and re-subdivide it
    // evenly; a pack spanning the full ladder reproduces the spec's
    // [−3, −1.5, 0, 1.5, 3] exactly (engine.md §4.3 Phase 1).
    const lo = Math.max(gidx.minB, PLACEMENT_LADDER_RUNGS[0])
    const hi = Math.min(gidx.maxB, PLACEMENT_LADDER_RUNGS[PLACEMENT_LADDER_RUNGS.length - 1])
    if (hi > lo) {
      const n = PLACEMENT_LADDER_RUNGS.length
      this.rungs = Array.from({ length: n }, (_, i) => lo + ((hi - lo) * i) / (n - 1))
    } else {
      // degenerate band (single-b pack, or a pack entirely outside the
      // global ladder span): one probe at the band midpoint
      this.rungs = [(gidx.minB + gidx.maxB) / 2]
    }
  }

  /** One Elo/1PL update + phase bookkeeping. Purely answer-driven. */
  recordAnswer(itemId: string, b: number, correct: boolean): void {
    const p = sigmoid(this.theta - b)
    this.theta += this.k * ((correct ? 1 : 0) - p)
    this.k = Math.max(PLACEMENT_K_FLOOR, this.k * PLACEMENT_K_DECAY)
    this.sumInfo += p * (1 - p)
    this.se = this.sumInfo > 0 ? 1 / Math.sqrt(this.sumInfo) : PLACEMENT_SE_START
    this.asked.push({ itemId, b, correct })

    if (this.phase === "frontier") {
      this.frontierProbesLeft -= 1
      if (!correct) {
        if (!this.frontierMissUsed) {
          // step frontier back one DAG layer, re-verify once
          this.frontierMissUsed = true
          this.theta -= PLACEMENT_UNLOCK_MARGIN
          this.frontierLayer = frontierOf(this.gidx, unlockedByTheta(this.gidx, this.theta))
          this.frontierProbesLeft = PLACEMENT_FRONTIER_PROBES
        } else {
          this.frontierProbesLeft = 0
        }
      }
    }
  }

  /** Finalize-time θ̂: 1PL MAP refit over the FULL transcript (Newton on the
   *  log-posterior with the Phase-2 prior N(θ_start, se_start²)). The
   *  running Elo iterate (recordAnswer) still drives item selection exactly
   *  per §4.3; the final estimate re-reads the same answers in one batch —
   *  the stochastic iterate carries O(K_floor) excess variance that the P8
   *  |θ̂ − a| ≤ 0.6 bound cannot afford on ≤25 items (W11 round 2, real
   *  journey_en pack). A 3PL guess-floor term (c = 0.25 for the guessable
   *  probe forms) was evaluated and REJECTED: learners also slip below the
   *  upper asymptote, and the two 1PL mismatches roughly cancel — the 3PL
   *  fit is strictly worse at every c ∈ {0.1..0.25} on the real pack
   *  (scripts/journey-sim/CALIBRATION.md §5). Pure + deterministic;
   *  placeUser shares this machine, so transcript equivalence holds. */
  mapTheta(): number {
    if (this.asked.length === 0) return this.theta
    const priorVar = PLACEMENT_SE_START * PLACEMENT_SE_START
    let t = this.theta
    for (let iter = 0; iter < 20; iter++) {
      let g = (PLACEMENT_THETA_START - t) / priorVar
      let h = 1 / priorVar
      for (const a of this.asked) {
        const p = sigmoid(t - a.b)
        g += (a.correct ? 1 : 0) - p
        h += p * (1 - p)
      }
      const step = Math.max(-1.5, Math.min(1.5, g / h))
      t += step
      if (Math.abs(step) < 1e-10) break
    }
    return t
  }

  /** Advance the phase machine. `elapsedMs` participates only interactively
   *  (placeUser replays with 0 — a transcript has no wall clock). */
  advance(elapsedMs: number): void {
    if (this.phase === "ladder") {
      const missed = this.asked.some((a) => !a.correct)
      if (missed || this.rungIndex >= this.rungs.length) this.phase = "elo"
      if (this.phase !== "elo") return
    }
    if (this.phase === "elo") {
      // R10 early termination — above the installed content ceiling. Gated
      // on se: θ̂ must have measured support before we route someone out of
      // the course (see PLACEMENT_ABOVE_CONTENT_MAX_SE in constants.ts).
      if (
        this.theta - this.gidx.maxB > PLACEMENT_ABOVE_CONTENT_MARGIN &&
        this.se <= PLACEMENT_ABOVE_CONTENT_MAX_SE
      ) {
        this.outcome = "above-content"
        this.phase = "done"
        return
      }
      if (
        this.se <= PLACEMENT_SE_TARGET ||
        this.asked.length >= PLACEMENT_MAX_ITEMS ||
        elapsedMs >= PLACEMENT_MAX_MS
      ) {
        this.frontierLayer = frontierOf(this.gidx, unlockedByTheta(this.gidx, this.theta))
        this.frontierProbesLeft = PLACEMENT_FRONTIER_PROBES
        this.phase = this.frontierLayer.length > 0 ? "frontier" : "done"
      }
      return
    }
    if (this.phase === "frontier") {
      if (this.frontierProbesLeft <= 0 || this.asked.length >= PLACEMENT_MAX_TOTAL) {
        this.phase = "done"
      }
    }
  }
}

/* ------------------------------------------------------------------------- */
/*  finalize (adaptivity §4.3 finalize, verbatim)                            */
/* ------------------------------------------------------------------------- */

export interface FinalizeBag {
  gidx: GraphIndex
  course: CourseState
  mastery: Mastery
  day: number
}

function finalizeOutcome(
  bag: FinalizeBag,
  m: Pick<PlacementMachine, "theta" | "se" | "asked" | "mapTheta">,
  outcome: PlacementRecord["outcome"],
): PlacementOutcome {
  const { gidx, course } = bag
  let unlocked: Set<string>
  let theta = m.mapTheta()
  if (outcome === "skipped-zero-beginner") {
    theta = THETA_DEFAULT
    unlocked = new Set()
  } else if (outcome === "above-content") {
    // R10: unlock every content skill provisionally; frontier = end of
    // shipped content. Honest copy is the UI's job (house no-absolutes rule).
    // θ̂ is pinned to "just past the ceiling": the pack has no items above
    // max_b, so the Elo estimate has no discriminating support beyond it —
    // on a narrow-band pack the raw θ̂ is prior-dominated garbage (W10 P8).
    theta = gidx.maxB + PLACEMENT_ABOVE_CONTENT_MARGIN
    unlocked = new Set(Object.keys(gidx.graph.skills))
  } else {
    unlocked = unlockedByTheta(gidx, theta)
  }

  for (const skillId of unlocked) {
    const scalars = bag.mastery.ensureScalars(skillId)
    scalars.placedAt = bag.day
    scalars.accEwma = Math.max(scalars.accEwma, PLACED_ACC_EWMA)
    scalars.announcedLevel = 3 // suppress a celebration storm
    bag.mastery.markDirty(skillId)
  }

  // Above-content still returns a USABLE in-pack frontier — the last unit's
  // skills, i.e. the end of shipped content (R10) — so the learner lands on
  // real practice, not an empty screen, on narrow-band packs.
  const frontier =
    outcome === "above-content"
      ? [...(gidx.units[gidx.units.length - 1]?.skillIds ?? [])]
      : frontierOf(gidx, unlocked)
  const record: PlacementRecord = { theta, se: m.se, day: bag.day, asked: m.asked, outcome }
  course.theta = theta
  course.placement = record
  course.firstWeek = { results: 0, correct: 0, cruiseSessions: 0 }
  const startUnitId = startUnitFor(gidx, unlocked)
  const unitOrdinal = gidx.unitPos.get(startUnitId) ?? 0
  const arcId = gidx.units[unitOrdinal]?.arcId ?? gidx.graph.arcs[0]?.arcId ?? ""
  course.position = { arcId, unitId: startUnitId, unitOrdinal }
  const arc = gidx.arcById.get(arcId)
  // Concrete result payload (defect #9): where they landed + how much they
  // skipped past. unitsSkipped = the units before the placed unit; skillsSkipped
  // = the skills placement pre-lit. Both are 0 for a zero-beginner start.
  const placement: PlacementSummary = {
    aboveContent: outcome === "above-content",
    arcId,
    arcOrdinal: arc?.ordinal ?? 0,
    cefr: arc?.cefr ?? "",
    unitId: startUnitId,
    unitOrdinal,
    unitsSkipped: unitOrdinal,
    skillsSkipped: unlocked.size,
  }
  return { record, unlockedSkills: [...unlocked], frontier, startUnitId, placement }
}

/* ------------------------------------------------------------------------- */
/*  Interactive controller                                                   */
/* ------------------------------------------------------------------------- */

export function createPlacementController(
  bag: PlacementBag,
  mode: "probe" | "zero-beginner",
): PlacementController {
  const m = new PlacementMachine(bag.gidx)
  const startedMs = bag.nowMs()
  const askedIds = new Set<string>()
  let pendingItemId: string | null = null
  let lastSkillId: string | null = null
  if (mode === "zero-beginner") {
    m.phase = "done"
    m.outcome = "skipped-zero-beginner"
  }

  const bank = bag.gidx.probeBank

  const pickNearest = (targetB: number, spreadSkills: boolean): string | undefined => {
    let best: { itemId: string; d: number } | undefined
    for (const probe of bank) {
      if (askedIds.has(probe.itemId)) continue
      if (spreadSkills && lastSkillId && probe.skillIds.includes(lastSkillId)) continue
      const d = Math.abs(probe.b - targetB)
      if (!best || d < best.d) best = { itemId: probe.itemId, d }
    }
    if (!best && spreadSkills) return pickNearest(targetB, false)
    return best?.itemId
  }

  const pickFrontierProbe = (): string | undefined => {
    for (const skillId of m.frontierLayer) {
      for (const probe of bank) {
        if (askedIds.has(probe.itemId)) continue
        if (probe.skillIds.includes(skillId)) return probe.itemId
      }
    }
    const bs = m.frontierLayer.map((s) => bag.gidx.graph.skills[s]?.b ?? 0)
    const target = bs.length > 0 ? bs.reduce((a, b) => a + b, 0) / bs.length : m.theta
    return pickNearest(target, false)
  }

  const controller: PlacementController = {
    next(): EngineCard | undefined {
      m.advance(bag.nowMs() - startedMs)
      if (m.phase === "done") return undefined
      let itemId: string | undefined
      if (m.phase === "ladder") {
        itemId = pickNearest(m.rungs[m.rungIndex] ?? m.theta, false)
        m.rungIndex += 1
      } else if (m.phase === "elo") {
        itemId = pickNearest(m.theta + bag.rng.gauss(0, PLACEMENT_TARGET_JITTER), true)
      } else {
        itemId = pickFrontierProbe()
      }
      if (itemId === undefined) {
        m.phase = "done"
        return undefined
      }
      pendingItemId = itemId
      const card = bag.mintProbe(itemId)
      if (!card) {
        askedIds.add(itemId)
        pendingItemId = null
        return controller.next()
      }
      return card
    },

    submit(result: ActivityResult): void {
      if (!pendingItemId) return
      const itemId = pendingItemId
      pendingItemId = null
      askedIds.add(itemId)
      const item = bag.gidx.graph.items[itemId]
      const correct =
        result.perItem.length > 0
          ? result.perItem.every((p) => p.outcome === "pass")
          : result.score >= 0.5
      lastSkillId = item?.skillIds[0] ?? null
      m.recordAnswer(itemId, item?.b ?? 0, correct)
    },

    finalize(): PlacementOutcome {
      m.advance(bag.nowMs() - startedMs)
      m.phase = "done"
      return finalizeOutcome(bag, m, m.outcome)
    },

    abort(): void {
      m.phase = "done"
      pendingItemId = null
      // no state written; restartable
    },
  }
  return controller
}

/* ------------------------------------------------------------------------- */
/*  Batch form                                                               */
/* ------------------------------------------------------------------------- */

/** Replay a completed probe transcript through the identical machine and the
 *  same finalize (engine.md §4.1). */
export function placeUser(bag: FinalizeBag, probeResults: ProbeResult[]): PlacementOutcome {
  if (probeResults.length === 0) {
    const m = new PlacementMachine(bag.gidx)
    return finalizeOutcome(bag, m, "skipped-zero-beginner")
  }
  const m = new PlacementMachine(bag.gidx)
  for (const pr of probeResults) {
    m.advance(0)
    if (m.phase === "done") break
    if (m.phase === "ladder") m.rungIndex += 1
    const item = bag.gidx.graph.items[pr.itemId]
    m.recordAnswer(pr.itemId, item?.b ?? 0, pr.correct)
  }
  m.advance(0)
  return finalizeOutcome(bag, m, m.outcome)
}
