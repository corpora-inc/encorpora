/**
 * traversalTrigger — makes TRAVERSE / FIND quest steps completable by WALKING.
 *
 * THE #26 BUG: "Cross the river bridge" was a step with no completable action —
 * the player walked to the bridge, talked to the NPC, and nothing happened,
 * because nothing watched for arrival. A talk-challenge step advances on a won
 * challenge; a traverse/find step has no challenge, so SOMETHING must fire its
 * completion when the player reaches the spot. That's this: a tiny per-frame
 * proximity check the orchestrator ticks.
 *
 * When the ACTIVE step is `kind:"traverse"` or `kind:"find"` and the player comes
 * within `radius` of the step's anchor, it fires `onReach(stepId)` ONCE (the
 * orchestrator then `markStepBeaten` + `advance`s — the same deterministic gate
 * the challenge path uses). Talk steps are ignored (they advance via the
 * challenge). Pure consumer (mirrors roadArrow/objectiveBeacon): injected getters
 * + `update(dt)`, no world/engine coupling beyond the two callbacks.
 */

import type { QuestStep } from "@corpan-city/contracts"

export interface TraversalTriggerOptions {
  /** The live player ground position. */
  getPlayer: () => { x: number; z: number }
  /** The active step (or null when the quest is complete / between quests). */
  currentStep: () => QuestStep | null
  /** The world point of a step's anchor, or null when unknown. */
  anchorPoint: (anchorId: string) => { x: number; z: number } | null
  /**
   * OPTIONAL per-step COMPLETION point, distinct from the step's anchor. When it
   * returns a point, the proximity check fires there instead of at `anchorId`.
   * This is the "actually crossed" seam: a "Cross the bridge" traverse keeps its
   * anchor at the NEAR foot (keeper + beacon + focus live there — you talk to the
   * keeper to get the mission), but only COMPLETES when the player reaches the FAR
   * end of the deck. Returning null falls back to the anchor point (the default —
   * a "find the spot" step completes AT the spot). Additive + optional.
   */
  completionPoint?: (step: QuestStep) => { x: number; z: number } | null
  /**
   * The player reached a traverse/find step's completion point. The orchestrator
   * marks it beaten + advances (and plays a juicy "✓ crossed!" beat). Fired AT
   * MOST ONCE per step id (the trigger latches until the active step changes).
   */
  onReach: (stepId: string) => void
  /** Arrival radius in world units. Default 4 (a comfortable "you're here"). */
  radius?: number
}

export interface TraversalTriggerHandle {
  /** Tick from the frame loop. Fires `onReach` once when the player arrives. */
  update: (dt: number) => void
  /** True iff the active step is a traverse/find step (for the on-screen cue). */
  isActive: () => boolean
}

/** A step the player completes by REACHING it (no challenge). */
function isTraversalStep(step: QuestStep | null): step is QuestStep {
  return !!step && (step.kind === "traverse" || step.kind === "find")
}

export function createTraversalTrigger(opts: TraversalTriggerOptions): TraversalTriggerHandle {
  const radius = opts.radius ?? 4
  const r2 = radius * radius
  // Latch the step ids we've already fired for, so `onReach` runs exactly once
  // per step even though the player lingers in the radius for many frames.
  const fired = new Set<string>()

  const isActive = (): boolean => isTraversalStep(opts.currentStep())

  const update = (_dt: number): void => {
    const step = opts.currentStep()
    if (!isTraversalStep(step) || !step.anchorId) return
    if (fired.has(step.id)) return
    // Prefer an explicit per-step completion point (e.g. the bridge's FAR end) so
    // "cross the bridge" finishes only once you've actually crossed; otherwise the
    // anchor doubles as the completion point ("reach the spot").
    const target = opts.completionPoint?.(step) ?? opts.anchorPoint(step.anchorId)
    if (!target) return
    const p = opts.getPlayer()
    const dx = p.x - target.x
    const dz = p.z - target.z
    if (dx * dx + dz * dz <= r2) {
      fired.add(step.id)
      try {
        opts.onReach(step.id)
      } catch (err) {
        console.error("[corpan-city] traversal onReach threw:", err)
      }
    }
  }

  return { update, isActive }
}
