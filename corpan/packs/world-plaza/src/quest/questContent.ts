/**
 * questContent — resolve the CONTENT a quest step's challenge should drill, so
 * the micro-game teaches the EXACT words the step is about (COHESION_ITERATION
 * §3.4 / §6). This is the data binding that answers "how does the challenge
 * relate to the quest?": the challenge's `entryIds`/`domain` come from the
 * current step, not random vocab.
 *
 * Resolution (priority order):
 *   1. The step's authored `entryIds` (the designer pinned exact corpus rows).
 *   2. Else the quest's `promptProgram.contentSelector` (levels/domains/langs)
 *      — used by `runChallenge` to draw THEMED corpus rows. We surface the
 *      selector so game.ts can pass `domain` + (when present) entryIds into the
 *      `ChallengeContext` the tool builds its spec from.
 *
 * Pure + dependency-light: no host calls here (the actual corpus fetch by id is
 * the challenge host's job). This just decides WHAT to ask for.
 */

import type { Quest, QuestStep } from "@world-plaza/contracts"

/** What a step's challenge should be fed: pinned ids and/or a themed selector. */
export interface StepChallengeContent {
  /** Exact corpus rows to drill (step override). Empty ⇒ fall back to selector. */
  entryIds: number[]
  /** Domain to theme the challenge ("travel"), from the quest. */
  domain: string
  /** CEFR levels the quest targets (first one used as the spec `level` hint). */
  levels: string[]
  /** Target language codes the quest constrains content to. */
  languageCodes: string[]
}

/**
 * Resolve the content for a specific quest step. `step` may be null (no active
 * step) — then only the quest-level selector applies (no pinned ids).
 */
export function resolveStepContent(quest: Quest, step: QuestStep | null): StepChallengeContent {
  const sel = quest.promptProgram.contentSelector
  return {
    entryIds: step?.entryIds ?? [],
    domain: quest.domain,
    levels: sel.levels ?? [],
    languageCodes: sel.languageCodes ?? [],
  }
}

/**
 * Whether a challenge RESULT should advance the given step: the step is
 * challenge-gated (has a `toolId`), the tool that ran matches it, and the score
 * cleared the pass threshold. This is the DETERMINISTIC check game.ts uses
 * before calling `QuestEngine.advance` on a challenge step (§6.4) — the model
 * never decides progression.
 */
export function challengeSatisfiesStep(
  step: QuestStep,
  ranToolId: string,
  score: number,
  threshold = 0.6,
): boolean {
  if (!step.toolId) return false
  if (step.toolId !== ranToolId) return false
  return score >= threshold
}
