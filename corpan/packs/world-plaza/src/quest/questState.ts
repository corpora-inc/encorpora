/**
 * questState — the DETERMINISTIC quest engine (the missing runtime that binds
 * NPC dialogue ↔ challenge ↔ quest into one coherent thread).
 *
 * THESIS (COHESION_ITERATION §3, §7): the small model (Qwen3-4B) does NOT carry
 * the quest. This engine does — purely, from `inventory()` + the authored
 * `QUEST_ITEM_RULES`. The model is only ever a VOICE that re-speaks an authored
 * beat the engine pre-decided. So a model-emitted `questStep`/`reward` intent is
 * IGNORED unless the deterministic gate (`isStepSatisfied`) already agrees — the
 * mouth cannot move a gate it does not control.
 *
 * Per the ACTIVE step the engine computes ONE of three states from the live
 * inventory + the per-step requirements (COHESION_ITERATION §3.3):
 *   - "needs-item"        — a required item for this step isn't held yet.
 *   - "ready-to-deliver"  — every required item is held; the step can advance.
 *   - "done"              — the step is already marked done.
 * A step with NO authored item requirement is treated as "ready-to-deliver"
 * (it advances on its own gate, e.g. a challenge result), so challenge-only
 * quests still flow.
 *
 * STORAGE: a single compact `wp:quest:v1` record ({ questId, stepDone, xp,
 * complete }) — < 1KB, the same quota-safe discipline as inventory.
 */

import { PlayerId, type Quest, type QuestState, type QuestStep } from "@world-plaza/contracts"
import type { InventoryStore } from "../economy/inventory"
import {
  hasNeeded,
  missingFor,
  requiredForStep,
  cluesFor,
  sourceHints,
} from "../economy/questItems"

const LOG = "[wp/questState]"
const STORE_KEY = "wp:quest:v1"
const STORE_VERSION = 1 as const

/** The per-step computed state (pure, from inventory + rules). */
export type StepState = "needs-item" | "ready-to-deliver" | "done"

/** A map marker the (future) minimap/full-map consumes (§4). */
export interface QuestMarker {
  /** topology anchor id this marker points at. */
  anchorId: string
  /** what the marker is about ("find the ferry token" / current objective). */
  kind: "objective" | "source-hint"
  /** the item this hint is about (source-hint markers only). */
  itemId?: string
}

export type QuestEvent =
  | { type: "advance"; stepId: string }
  | { type: "complete" }
  | { type: "change" }

/**
 * The runtime quest store. Mirrors `inventory()` in shape: a tiny event bus +
 * deterministic getters. `state()` is the persisted `QuestState` contract.
 */
export interface QuestEngine {
  /** The persisted runtime state ({ questId, playerId, stepDone, xp, complete }). */
  state(): QuestState
  /** The active authored quest. */
  quest(): Quest
  /** First step whose `done` is not yet true (the active objective), or null. */
  currentStep(): QuestStep | null
  /** Compute a step's deterministic state from live inventory + rules. */
  stepState(stepId: string): StepState
  /** Convenience: the active step's state (or "done" when the quest is complete). */
  currentStepState(): StepState
  /**
   * Deterministic gate: may this step advance RIGHT NOW? True when every
   * required item is held (or the step has no item requirement). The model
   * cannot bypass this — it is the referee, the model is the mouth.
   */
  isStepSatisfied(stepId: string): boolean
  /**
   * Advance a step: ONLY honored when `isStepSatisfied(stepId)` agrees. Consumes
   * the step's required items, marks it done, grants the step/quest reward when
   * final, persists, and emits. Returns true iff it actually advanced.
   */
  advance(stepId: string): boolean
  /** Markers for the map: the current objective's anchor + unmet source hints. */
  getQuestMarkers(): QuestMarker[]
  subscribe(fn: (e: QuestEvent) => void): () => void
  /** QA / reset. */
  reset(): void
}

/* ------------------------------------------------------------- persistence */

interface PersistedQuest {
  v: typeof STORE_VERSION
  q: string // questId
  d: Record<string, boolean> // stepDone
  x: number // xp
  c: boolean // complete
}

function loadPersisted(questId: string): { stepDone: Record<string, boolean>; xp: number; complete: boolean } {
  const empty = { stepDone: {}, xp: 0, complete: false }
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return empty
    const p = JSON.parse(raw) as PersistedQuest
    if (p.v !== STORE_VERSION || p.q !== questId) {
      // A different quest (or version) was persisted → start this quest fresh.
      return empty
    }
    return {
      stepDone: { ...(p.d ?? {}) },
      xp: Math.max(0, p.x | 0),
      complete: Boolean(p.c),
    }
  } catch (err) {
    console.warn(`${LOG} could not read quest state:`, err)
    return empty
  }
}

function persist(questId: string, playerId: string, stepDone: Record<string, boolean>, xp: number, complete: boolean): void {
  void playerId
  const p: PersistedQuest = { v: STORE_VERSION, q: questId, d: stepDone, x: xp, c: complete }
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(p))
  } catch (err) {
    // Noisy, never silent — but a persistence failure must not break the loop.
    console.error(`${LOG} could not persist quest state (in-memory only this session):`, err)
  }
}

/* --------------------------------------------------------------- the engine */

export interface QuestEngineOptions {
  quest: Quest
  inventory: InventoryStore
  playerId: string
}

export function createQuestEngine(opts: QuestEngineOptions): QuestEngine {
  const { quest, inventory, playerId } = opts
  const persisted = loadPersisted(quest.id)
  const stepDone: Record<string, boolean> = { ...persisted.stepDone }
  // Seed any steps authored as `done:true` (designer-marked) so they aren't redone.
  for (const s of quest.steps) if (s.done) stepDone[s.id] = true
  let xp = persisted.xp
  let complete = persisted.complete

  const listeners = new Set<(e: QuestEvent) => void>()
  const emit = (e: QuestEvent) => {
    for (const fn of listeners) {
      try {
        fn(e)
      } catch (err) {
        console.error(`${LOG} subscriber threw:`, err)
      }
    }
    if (e.type !== "change") {
      for (const fn of listeners) {
        try {
          fn({ type: "change" })
        } catch (err) {
          console.error(`${LOG} subscriber threw:`, err)
        }
      }
    }
  }

  const save = () => persist(quest.id, playerId, stepDone, xp, complete)

  const stepById = (id: string): QuestStep | undefined => quest.steps.find((s) => s.id === id)

  function currentStep(): QuestStep | null {
    return quest.steps.find((s) => !stepDone[s.id]) ?? null
  }

  /** Deterministic gate: held all required items (or no item requirement). */
  function isStepSatisfied(stepId: string): boolean {
    if (stepDone[stepId]) return true
    const required = requiredForStep(quest.id, stepId)
    if (required.length === 0) return true // no item gate → satisfiable by other means
    return hasNeeded(inventory, quest.id, stepId)
  }

  function stepState(stepId: string): StepState {
    if (stepDone[stepId]) return "done"
    const required = requiredForStep(quest.id, stepId)
    if (required.length === 0) return "ready-to-deliver"
    return missingFor(inventory, quest.id, stepId).length > 0 ? "needs-item" : "ready-to-deliver"
  }

  function currentStepState(): StepState {
    const s = currentStep()
    if (!s) return "done"
    return stepState(s.id)
  }

  function advance(stepId: string): boolean {
    const step = stepById(stepId)
    if (!step) {
      console.warn(`${LOG} advance("${stepId}") — no such step in quest ${quest.id}`)
      return false
    }
    if (stepDone[stepId]) return false
    if (!isStepSatisfied(stepId)) {
      // The deterministic gate disagrees → refuse (e.g. a model emitted questStep
      // before the player actually holds the item). The model is a mouth, not a
      // referee. Noisy so we see misfires.
      console.warn(`${LOG} advance("${stepId}") refused — step not satisfied (gate held)`)
      return false
    }
    // Consume the step's required items (the delivery). Each is non-stackable here.
    for (const itemId of requiredForStep(quest.id, stepId)) {
      if (inventory.has(itemId)) inventory.consume(itemId, 1)
    }
    stepDone[stepId] = true
    emit({ type: "advance", stepId })

    // Quest completion: every step done → grant the quest reward exactly once.
    const allDone = quest.steps.every((s) => stepDone[s.id])
    if (allDone && !complete) {
      complete = true
      xp += quest.rewards.xp
      inventory.applyReward({
        xp: quest.rewards.xp,
        coins: quest.rewards.coins,
        items: quest.rewards.grant,
      })
      save()
      emit({ type: "complete" })
    } else {
      save()
    }
    return true
  }

  function getQuestMarkers(): QuestMarker[] {
    const markers: QuestMarker[] = []
    const cur = currentStep()
    if (cur?.anchorId) markers.push({ anchorId: cur.anchorId, kind: "objective" })
    // Source hints for items still missing → "where to find the X" markers.
    for (const h of sourceHints(inventory, quest.id)) {
      if (h.anchorId) markers.push({ anchorId: h.anchorId, kind: "source-hint", itemId: h.itemId })
    }
    return markers
  }

  // Brand the playerId once (it crosses the QuestState boundary). Fall back to a
  // safe default rather than throwing on a malformed id (noisy, never silent).
  const brandedPlayerId = (() => {
    const r = PlayerId.safeParse(playerId)
    if (r.success) return r.data
    console.warn(`${LOG} invalid playerId "${playerId}" — using "player-local"`)
    return PlayerId.parse("player-local")
  })()

  function buildState(): QuestState {
    return {
      questId: quest.id,
      playerId: brandedPlayerId,
      stepDone: { ...stepDone },
      xp,
      complete,
    }
  }

  // React to inventory changes so subscribers (the tracker) re-render when the
  // required item is acquired and the step flips needs-item → ready-to-deliver.
  const unsubInv = inventory.subscribe((e) => {
    if (e.type === "change") emit({ type: "change" })
  })

  return {
    state: buildState,
    quest: () => quest,
    currentStep,
    stepState,
    currentStepState,
    isStepSatisfied,
    advance,
    getQuestMarkers,
    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    reset() {
      for (const k of Object.keys(stepDone)) delete stepDone[k]
      for (const s of quest.steps) if (s.done) stepDone[s.id] = true
      xp = 0
      complete = false
      try {
        localStorage.removeItem(STORE_KEY)
      } catch (err) {
        console.warn(`${LOG} could not clear quest store:`, err)
      }
      unsubInv // keep ref alive; reset doesn't tear down the engine
      emit({ type: "change" })
    },
  }
}

/* ------------------------------------------------- authored clue resolution */

/**
 * Resolve the verbatim authored CLUE for a step's missing item (needs-item),
 * used to inject FACTS into the special-NPC prompt (§7.2) and as the scripted
 * fallback line. Returns the FIRST unmet clue for the step, or undefined.
 */
export function authoredClueForStep(
  inventory: InventoryStore,
  questId: string,
  stepId: string,
): string | undefined {
  return cluesFor(inventory, questId, stepId)[0]
}

/**
 * The authored NEXT-HINT for after a delivery (ready-to-deliver / done): the
 * NEXT step's clue is the natural onward hint ("now you'll need a pass…").
 * Returns undefined when there is no next step (the quest is ending) — callers
 * fall back to a generic "well done" beat.
 */
export function authoredNextHint(
  inventory: InventoryStore,
  quest: Quest,
  currentStepId: string,
): string | undefined {
  const idx = quest.steps.findIndex((s) => s.id === currentStepId)
  if (idx < 0) return undefined
  const next = quest.steps[idx + 1]
  if (!next) return undefined
  return cluesFor(inventory, quest.id, next.id)[0]
}
