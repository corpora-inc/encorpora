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
 *          expresses that, so nothing is: the empty response is unparseable and
 *          no mal-rule is named. Refusing a true sentence is not a misconception
 *          with a name — and, per `reportsToCurriculum`, it is not sent at all.
 */
/**
 * Whether this outcome is evidence about the child, fit to send to the ladder.
 *
 * Three of the four are. `slow` is not, and this is the one asymmetry in the
 * file that is about the child rather than about the street.
 *
 * `slow` is the only outcome nobody performed. A `hit`, a `bow` and a `wild` are
 * all things a child *did* — a press, at a moment, meaning something. A `slow`
 * is the window closing with the screen untouched, and there is no way from
 * inside this game to tell "I say that sum is wrong" apart from "I am still
 * working it out". Reporting it as a wrong answer bets on the first reading and
 * demotes the child down the ladder when the second is true. A child who was
 * still computing is not a child who does not know the skill, and the ladder is
 * the one place that mistake compounds: it would feed them easier items, which
 * is precisely the wrong medicine for somebody who is merely deliberate.
 *
 * The shot still goes dark — inside the run a hold is a call like any other, and
 * a timeout costs exactly what an honest wrong draw costs, never less. What
 * changes is only what crosses the wire.
 *
 * The obvious hole — hold at everything, be reported correct on every false
 * slate and reported not at all on every true one — is closed by the shot
 * budget, not by the wire: holding at everything is wrong half the time, and
 * half is three calls (`run.ts`). A passive holder gets about six rounds before
 * the street clears, every time, forever.
 */
export function reportsToCurriculum(outcome: Outcome): boolean {
  return outcome !== "slow"
}

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
