// The one place a settled round crosses the wire.
//
// It is a module rather than four lines inside `mount.ts` for a reason that is not
// tidiness: **the branch in here is the single most consequential line in the pack,
// and inside the mount it could not be tested against a host.** A harness that
// drives `Round` never touches a `Host`, so the only guard on the routing was a
// source-text assertion that `mount.ts` still contained the right shape — which is
// a test of the spelling, not of the behaviour. Out here it takes a `Host` and can
// be played against a stub for a whole run.
//
// ── the branch ───────────────────────────────────────────────────────────────
//
// Four of the five outcomes are things the child DID: a flick, at a moment, meaning
// one thing. They go to `report`, with the value the child effectively asserted —
// and on a wrong keep that value is the item's own mal-rule output, so the
// misconception routes itself with no extra wiring.
//
// The fifth is `lapse`: the window closed on an untouched screen. It goes to
// `skip`, and the reason it must not go to `report` is stated by the SDK itself:
// `report({ correct: false, answered: "" })` is NOT filed as "unanswered". The
// empty string fails to parse, the learner model takes a wrong attempt, and the
// ladder steps DOWN — for a child who was still carrying the hundreds column. This
// pack is one of the six the SDK names for having done exactly that.
//
// `skip` is feature-detected because a host shipped before it existed does not have
// it. On such a host the item is left open, which is worse than closed and much
// better than recorded as a miss.

import type { Host } from "../contract.ts"
import { isCorrect, reportsToCurriculum, responseFor, type Outcome } from "./response.ts"
import type { Statement } from "./statement.ts"

export type Settled = {
  readonly outcome: Outcome
  readonly statement: Statement
  readonly reactionMs: number
}

export function reportSettled(host: Host, event: Settled): void {
  const questionId = event.statement.questionId
  if (reportsToCurriculum(event.outcome)) {
    host.report({
      questionId,
      correct: isCorrect(event.outcome),
      ms: event.reactionMs,
      answered: responseFor(event.outcome, event.statement),
    })
    return
  }
  host.skip?.(questionId)
}
