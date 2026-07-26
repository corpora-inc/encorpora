// The seam between the loop and the learner model.
//
// Everything the practice loop asks of the engine goes through this interface,
// and there are exactly two implementations: the real one, and a pinned one the
// tests use when the thing under test is the *loop* rather than the selection.
//
// That split is deliberate. Before M5 the loop's tests could say "start at rung
// 4" and know exactly which problem would appear; with an adaptive scheduler
// that determinism is gone, and a test of the contrast-pair routing that also
// depends on the scheduler's mood is a test that fails for reasons it was not
// written to catch. `pinnedPlanner` restores the old determinism for those
// tests without pretending the fixed ladder still drives the app.
//
// The engine's own selection is tested where it belongs — against a
// seventy-two-skill synthetic catalog and eleven simulated children, in
// `engine/src/select.test.ts` and `engine/src/harness/`.

import {
  BATCH_SIZE,
  admissible as engineAdmissible,
  applyResult,
  newSession,
  planBatch,
  repairAllowed,
  repairCard,
  retryCard,
  type Answer,
  type ApplyResult,
  type LearnerState,
  type PlannedCard,
  type SessionContext,
} from "../../../engine/src/index.ts"
import { engineCatalog } from "./catalog.ts"
import type { MalRuleId } from "./curriculum.ts"

export type { LearnerState, PlannedCard, SessionContext }

export interface Planner {
  readonly name: string
  /**
   * Up to `count` cards to serve next. Runs during idle, never on the answer
   * path, and may return fewer — including none, when every reachable skill has
   * been benched for the session.
   */
  next(learner: LearnerState, context: SessionContext, count: number): readonly PlannedCard[]
  /** The Stage-1 VERIFY retry, or `null` when the skill is benched. */
  retry(learner: LearnerState, context: SessionContext, card: PlannedCard): PlannedCard | null
  /** The Stage-2 repair item, or `null` when nothing forces the broken step. */
  repair(
    learner: LearnerState,
    context: SessionContext,
    card: PlannedCard,
    misconception: MalRuleId,
    servedPools: readonly string[],
  ): PlannedCard | null
  /** May this planned card still be served? The plan is eight cards old by its tail. */
  admissible(
    learner: LearnerState,
    context: SessionContext,
    card: PlannedCard,
    servedPools: readonly string[],
  ): boolean
  /** Apply one answered card. This is the whole of the model's answer path. */
  apply(
    learner: LearnerState,
    context: SessionContext,
    card: PlannedCard,
    answer: Answer,
    remaining: readonly PlannedCard[],
  ): ApplyResult
  /** A fresh session, seeded from the learner's rolling window. */
  session(seed: number, day: number, learner: LearnerState): SessionContext
}

/**
 * The real planner.
 *
 * Traces are off in production: `SelectionTrace` is Developer-Mode only and must
 * not reach a shipped bundle (`A-18`). Vite substitutes `import.meta.env.DEV` to
 * `false` and the branch and everything it reaches are eliminated.
 *
 * The optional read matters: `import.meta.env` is a Vite construct and does not
 * exist under `node --experimental-strip-types --test`, which is what runs this
 * app's tests. Reading it unguarded threw at module load and took every test that
 * imports the loop with it.
 */
export const DEV_TRACES: boolean =
  // Written so Vite's static replacement of `import.meta.env.DEV` still fires:
  // the literal text has to survive to the bundler. The `typeof` guard is what
  // makes it also work under `node --experimental-strip-types --test`, where
  // `import.meta.env` does not exist and an unguarded read threw at module load
  // and took every test that imports the loop with it.
  typeof import.meta.env !== "undefined" && import.meta.env.DEV === true

export const adaptivePlanner: Planner = {
  name: "adaptive",
  // A whole batch is always planned, however few cards are wanted. A batch of one
  // or two cannot hold a confidence card at each end *and* a stretch item, and
  // `batchIntents` says so by throwing rather than quietly dropping one of the
  // three rules; the unserved tail is discarded, which is what a re-plan does
  // anyway.
  next: (learner, context, count) =>
    planBatch(engineCatalog(), learner, context, BATCH_SIZE, { traces: DEV_TRACES }).cards.slice(0, count),
  retry: (learner, context, card) => retryCard(engineCatalog(), learner, context, card),
  repair: (learner, context, card, misconception, servedPools) =>
    repairAllowed(servedPools) ? repairCard(engineCatalog(), learner, context, card, misconception) : null,
  admissible: (learner, context, card, servedPools) => engineAdmissible(learner, context, card, servedPools),
  apply: (learner, context, card, answer, remaining) =>
    applyResult(engineCatalog(), learner, context, card, answer, remaining, { devMode: DEV_TRACES }),
  session: (seed, day, learner) => newSession(seed, day, learner),
}

/**
 * A planner that serves exactly the cards it is given, for tests about the loop.
 *
 * The model still runs — `apply` is the real one — so a pinned test still
 * exercises θ, the misconception tracker and the controller. Only the *choice*
 * is pinned.
 */
export function pinnedPlanner(cards: readonly (readonly [string, number])[]): Planner {
  let cursor = 0
  const cardAt = (index: number): PlannedCard => {
    const pair = cards[index % cards.length]
    if (pair === undefined) throw new RangeError("pinnedPlanner: no cards")
    const [skillId, level] = pair
    return {
      cardId: `${skillId}#L${String(level)}#${String(index)}`,
      skillId,
      level,
      formId: "free-entry",
      seed: index + 1,
      pool: "FRONTIER",
      intent: "steady",
      pHat: 800_000 as PlannedCard["pHat"],
      operation: "sub",
      // Unique per card, so a pinned deck can hold two draws of the same class.
      // The real planner's key is the class precisely because the no-repeat
      // window compares on it; a pinned planner exists to defeat that.
      itemKey: `${skillId}#L${String(level)}#free-entry#${String(index)}`,
    }
  }
  return {
    ...adaptivePlanner,
    name: "pinned",
    next: (_learner, _context, count) => Array.from({ length: count }, () => cardAt(cursor++)),
    admissible: () => true,
  }
}
