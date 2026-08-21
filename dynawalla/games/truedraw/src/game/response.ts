// What the child said, and what the host is told they said.
//
// ── the change that this file exists to record ───────────────────────────────
//
// This game used to have ONE verb. A tap meant "that sum is right"; meaning "that
// sum is wrong" was expressed by DOING NOTHING and waiting the window out. Two
// things follow from that, and both of them were shipping:
//
//   1. A child who was certain in 300 ms still sat through the entire window on
//      every false slate. Measured, on the widest class: 14,000 ms of waiting for
//      a verdict they had reached in 300. "I've gotten 10 correct in a row fast
//      and I still get `2+0=1` and have to wait until it times out."
//
//   2. There was NO LATENCY FOR ONE OF THE TWO VERDICTS. A hold has no moment in
//      it. So the adaptive ladder could never tell a confident rejection from an
//      abandoned one, and half of every child's evidence arrived as either
//      silence or a full-window timestamp that meant nothing.
//
// Both are the same defect: a verdict expressed by absence is a verdict with no
// timestamp and no end. So there are now TWO GESTURES and they are symmetric:
//
//   swipe DOWN  keep   — "this claim is true", the slate goes into the bag
//   swipe UP    toss   — "this claim is false", the slate is thrown away
//
// and a window that closes untouched is NEITHER. It is a `lapse`: not a verdict,
// not a miss, not evidence. It is reported with `skip`, which is the SDK's third
// ending — closed on the host, recorded against nobody.
//
// ── the five outcomes ────────────────────────────────────────────────────────
//
//   bank   kept a true claim      — correct. Coins into the bag.
//   spot   tossed a false claim   — correct. Coins into the bag, and the slate
//                                   rolls itself right on the way out, which is
//                                   the best thing in the game.
//   dud    kept a false claim     — wrong. You banked a counterfeit: coins leave.
//   burn   tossed a true claim    — wrong. You threw money away: coins leave.
//   lapse  the window closed      — nothing. No coins, no shot, no report.

import type { Statement } from "./statement.ts"

/** The two gestures, as the two things they mean. */
export type Call = "keep" | "toss"

export type Outcome = "bank" | "spot" | "dud" | "burn" | "lapse"

/** Every outcome, in one place, so a table over them cannot be left short. */
export const OUTCOMES: readonly Outcome[] = ["bank", "spot", "dud", "burn", "lapse"]

export function outcomeOf(call: Call, truth: boolean): Outcome {
  if (call === "keep") return truth ? "bank" : "dud"
  return truth ? "burn" : "spot"
}

export function isCorrect(outcome: Outcome): boolean {
  return outcome === "bank" || outcome === "spot"
}

/**
 * Whether the child performed this at all.
 *
 * Four of the five are gestures. `lapse` is the window closing with the screen
 * untouched, and it is the only one nobody did.
 */
export function isVerdict(outcome: Outcome): boolean {
  return outcome !== "lapse"
}

/** A wrong verdict — a gesture that was performed and was wrong. Never a lapse. */
export function isMiss(outcome: Outcome): boolean {
  return outcome === "dud" || outcome === "burn"
}

/**
 * Whether this outcome is evidence about the child, fit to send to the ladder.
 *
 * **Four of the five now are, and that is the point of the second gesture.**
 *
 * Before, the outcome that meant "I say that sum is wrong" was indistinguishable
 * from "I am still working it out", because both of them were the window closing
 * on an untouched screen. It could not be reported — betting on the first reading
 * would demote a child who was merely deliberate — so half of the evidence the
 * ladder needed simply was not sent.
 *
 * A swipe up removes the ambiguity completely. A child who swiped up performed
 * something, at a moment, meaning one thing. So `burn` — a swipe up at a true
 * claim — is a wrong answer and is reported as one, with an honest latency on it.
 *
 * `lapse` is the only survivor of the old asymmetry and it is now the honest
 * shape of it: the child said nothing, so nothing is claimed about them. It goes
 * across as `skip` rather than as a report — see `mount.ts`. An empty `answered`
 * on `report` does NOT mean "unanswered": the SDK documents that the empty string
 * fails to parse and is filed as a MISS, which steps the ladder down for a child
 * who was still carrying the hundreds column.
 */
export function reportsToCurriculum(outcome: Outcome): boolean {
  return isVerdict(outcome)
}

/**
 * The response reported to the host, which is the only judge.
 *
 *   bank — "the answer is 72", and it is. Recorded correct.
 *   dud  — "the answer is 62". Recorded wrong, **and diagnosed**: 62 is the
 *          carry-dropped mal-rule, so keeping a false slate routes the exact
 *          misconception the child just demonstrated. This is the single best
 *          property of the format and it comes for free.
 *   spot — "the answer is not 62". A correct rejection of a mal-rule value is
 *          the thing this game is measuring, and it is credited: the answer is
 *          reported. That is a slightly generous reading of the evidence and it
 *          is the deliberate one — the alternative records a child who played
 *          perfectly as having missed.
 *   burn — "the answer is not 72", and it is. A wrong verdict, performed, with a
 *          timestamp. There is no mal-rule to name — "I do not believe
 *          47 + 25 = 72" is not a broken procedure with an output — so the value
 *          is empty and the host files a miss, which is exactly what it was.
 *   lapse — never reaches `report` at all. It reaches `skip`.
 */
export function responseFor(outcome: Outcome, statement: Statement): string {
  switch (outcome) {
    case "bank":
    case "dud":
      return statement.claimed
    case "spot":
      return statement.answer
    case "burn":
    case "lapse":
      return ""
  }
}
