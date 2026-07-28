// What the child said, and what the host is told they said.
//
// Four outcomes, and the asymmetry between them is the design:
//
//   hit   drew on a true statement    — the slate is struck and the claim seats
//   bow   held on a false statement   — the caller bows, the slate corrects itself
//   wild  drew on a false statement   — nothing happens at all
//   slow  held on a true statement    — the caller draws
//
// `wild` is the one that matters. A wrong draw is not buzzed, not shaken, not
// flashed red. The world simply does not acknowledge it: the slate stays wrong,
// the caller does not move, no sound plays. A shot goes dark and the round ends
// in the same silence it began in. Being ignored is the punishment.

import type { Statement } from "./statement.ts"

export type Call = "draw" | "hold"
export type Outcome = "hit" | "bow" | "wild" | "slow"

export function outcomeOf(call: Call, truth: boolean): Outcome {
  if (call === "draw") return truth ? "hit" : "wild"
  return truth ? "slow" : "bow"
}

export function isCorrect(outcome: Outcome): boolean {
  return outcome === "hit" || outcome === "bow"
}

/**
 * The response reported to the host, which is the only judge.
 *
 * The host records value-answers, so a classification has to be expressed as
 * one. Each mapping below is the honest reading of what the child asserted:
 *
 *   hit  — "the answer is 72", and it is. Recorded correct.
 *   wild — "the answer is 62". Recorded wrong, **and diagnosed**: 62 is the
 *          carry-dropped mal-rule, so drawing at a false slate routes the exact
 *          misconception the child just demonstrated. This is the single best
 *          property of the format and it comes for free.
 *   bow  — "the answer is not 62". A correct rejection of a mal-rule value is
 *          the thing this game is measuring, and it is credited: the answer is
 *          reported. That is a slightly generous reading of the evidence, and it
 *          is the deliberate one — the alternative records a child who played
 *          perfectly as having missed, which would demote them down the ladder
 *          for being right.
 *   slow — "the answer is not 72", and it is. Nothing a child could have written
 *          expresses that, so nothing is: the empty response is unparseable, the
 *          host records a miss, and no mal-rule is named. Refusing a true
 *          sentence is not a misconception with a name.
 */
export function responseFor(outcome: Outcome, statement: Statement): string {
  switch (outcome) {
    case "hit":
    case "wild":
      return statement.claimed
    case "bow":
      return statement.answer
    case "slow":
      return ""
  }
}
