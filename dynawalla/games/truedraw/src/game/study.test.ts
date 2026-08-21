// A missed slate is not flashed at the child and taken away.
//
// THE TRUE DRAW's miss beat was `TIMING.verdict.dud = 900` — a flat constant, the
// same for every child in every state — and `REVEAL_SHARE` spends the first 45%
// of it cross-fading the true value in, so the completed sum stood still for
// about half a second and then the slate slid off the street. Nothing dismissed
// it, nothing extended it, and a `lapse` showed nothing at all.
//
// "There is no reason to be like WRONG and then just rush past the
// lesson/content .. let the kid marinate on it and dismiss it or answer or move
// on in their own time."
//
// The `study` phase is that hold. `verdict` still runs the animation; `study` is
// where the finished sum stands, with no deadline on it, until a hand takes it
// down. `revealPlan` decides whether it happens at all, on a streak of correct
// calls — MONUMENT's signal, for MONUMENT's reason.
//
// Mutation-tested: each assertion's implementing line was broken and the named
// assertion is the one that fired.

import assert from "node:assert/strict"
import { test } from "node:test"

import { REVEAL_SETTLE_MS } from "../../../../packs/shared/game-pacing/index.ts"
import { isMiss } from "./response.ts"
import { Round, STUDY_STREAK, TIMING, studyIntensity } from "./round.ts"
import type { Statement } from "./statement.ts"

/** The miss beat THE TRUE DRAW shipped with, kept only to measure against. */
const OLD_MISS_MS = 900

function fixed(truth: boolean): () => Statement {
  return () => ({
    questionId: "q",
    expression: "47 + 25",
    claimed: truth ? "72" : "62",
    answer: "72",
    truth,
    text: `47 + 25 = ${truth ? "72" : "62"}`,
    windowMs: 2000,
    stillMs: 320,
    p50Ms: 6000,
  })
}

/** Wind a fresh round forward to the open window. */
function atCall(deal: () => Statement): Round {
  const round = new Round(deal, TIMING)
  round.tap()
  round.advance(TIMING.raise + 320)
  return round
}

/** Frames at 60 Hz, the way the mount does it. */
function pump(round: Round, ms: number): void {
  for (let t = 0; t < ms; t += 16) round.advance(16)
}

/**
 * Frames until the street reaches `phase`, and BOUNDED.
 *
 * The bound is the point. An unbounded `while (round.phase !== "call")` is how
 * this file first failed a mutation check by hanging for two minutes instead of
 * saying anything: a change that holds a beat forever makes the loop immortal,
 * and a test that never returns reports nothing at all.
 */
function runTo(round: Round, phase: string, ms = 30_000): void {
  for (let t = 0; t < ms && round.phase !== phase; t += 16) round.advance(16)
  assert.equal(
    round.phase,
    phase,
    `the street never reached ${phase} in ${String(ms / 1000)}s — it is stuck in ${round.phase}`,
  )
}

/** A round parked on a held miss: kept a counterfeit, animation finished. */
function atStudy(): Round {
  const round = atCall(fixed(false))
  round.verdict("keep")
  pump(round, TIMING.verdict.dud + 32)
  return round
}

test("a missed slate holds the finished sum with no deadline on it", () => {
  const round = atStudy()
  assert.equal(round.phase, "study", `a miss went to ${round.phase} instead of holding`)
  assert.equal(round.studying, true)
  assert.ok(round.outcome !== null && isMiss(round.outcome), "the slate stopped showing the miss")

  const run = round.run
  const statement = round.statement

  // A full minute. Sixty-six times the beat this used to get.
  pump(round, 60_000)

  assert.equal(round.phase, "study", "the held sum expired on its own")
  assert.equal(round.statement, statement, "a new slate was dealt while the sum was being read")
  assert.deepEqual(round.run, run, "the run moved while the child was reading")
  assert.ok(
    round.outcome !== null && isMiss(round.outcome),
    "the completed sum stopped being drawn while it was still up — `outcome` is what `scene.ts` branches on",
  )

  // …and the child's own hand still works.
  round.tap()
  assert.notEqual(round.phase, "study", "the child asked to go on and the street did not")
  pump(round, TIMING.clear + TIMING.raise + 320 + 32)
  assert.equal(round.phase, "call", "the next slate never came up")
})

test("the hold outlasts the beat THE TRUE DRAW used to give a miss", () => {
  const round = atCall(fixed(false))
  round.verdict("keep")
  pump(round, OLD_MISS_MS * 4)
  assert.equal(
    round.phase,
    "study",
    `the slate was gone ${String(OLD_MISS_MS * 4)}ms after the miss — the old timer is still in there`,
  )
})

test("the flick that made the reveal cannot also dismiss it", () => {
  const round = atStudy()
  // The follow-through, landing in the same breath as the verdict.
  round.tap()
  assert.equal(round.phase, "study", "an in-flight touch took the lesson down inside its own beat")
  assert.equal(round.dismissible, false, "a reveal one frame old is already dismissible")

  // Up to one frame short of the floor, measured rather than guessed: the phase
  // carries a few ms in from the verdict it followed.
  while (round.elapsedMs < REVEAL_SETTLE_MS - 16) round.advance(16)
  assert.ok(round.elapsedMs < REVEAL_SETTLE_MS, "the walk overshot the settle floor")
  round.tap()
  assert.equal(
    round.phase,
    "study",
    `a touch ${String(Math.round(round.elapsedMs))}ms into a ${String(REVEAL_SETTLE_MS)}ms floor was honoured`,
  )

  pump(round, 64)
  assert.equal(round.dismissible, true, "the settle floor never expired")
  round.tap()
  assert.equal(round.phase, "clear", "the settle floor never let go")
})

test("a correct call is never held — the street is not a queue of dismissals", () => {
  for (const truth of [true, false]) {
    // `keep` on a true slate banks it; `toss` on a false one spots it. Both right.
    const round = atCall(fixed(truth))
    round.verdict(truth ? "keep" : "toss")
    assert.equal(round.phase, "verdict")
    pump(round, TIMING.verdict.spot + TIMING.clear + TIMING.raise + 320 + 64)
    assert.notEqual(round.phase, "study", "a correct call held the child for a receipt")
    assert.equal(round.phase, "call", "a correct call needed a touch to move on")
    // …and it keeps doing so, unattended, for slate after slate.
    for (let i = 0; i < 5; i++) {
      round.verdict(truth ? "keep" : "toss")
      runTo(round, "call", 8_000)
    }
  }
})

test("a lapse is not held either — there is nothing on the slate to study yet", () => {
  // Documented rather than asserted as desirable: `scene.ts` draws no reveal on a
  // lapse (`flourish` is null on one), so holding it would hold a blank correction.
  // Building that reveal is the next piece of work, not this one.
  const round = atCall(fixed(true))
  pump(round, 2000 + TIMING.verdict.lapse + TIMING.clear + 64)
  assert.equal(round.run.lapses, 1, "the window never lapsed")
  assert.notEqual(round.phase, "study")
})

test("a child on a run of true calls is not held for a sum they plainly know", () => {
  assert.equal(studyIntensity(0), 0, "a standing start must get the whole of the patience")
  assert.equal(studyIntensity(STUDY_STREAK), 1, "a full streak must reach the top of the curve")
  assert.ok(studyIntensity(3) > 0 && studyIntensity(3) < 1)

  // Eight true slates called correctly in a row, then one missed.
  const round = new Round(fixed(true), TIMING)
  round.tap()
  for (let i = 0; i < STUDY_STREAK; i++) {
    runTo(round, "call", 8_000)
    round.verdict("keep")
    assert.equal(round.phase, "verdict", `call ${String(i)} was not banked`)
    pump(round, TIMING.verdict.bank + TIMING.clear + 32)
  }
  assert.equal(round.streak, STUDY_STREAK, `only ${String(round.streak)} correct calls in a row`)

  // …and now a miss. No hold: skipping the ceremony is the reward for mastery.
  runTo(round, "call", 8_000)
  round.verdict("toss")
  pump(round, TIMING.verdict.burn + 32)
  assert.notEqual(round.phase, "study", "a child eight true calls into a run was held for a reveal")

  // The streak is not one-way: it is gone the moment they slip.
  assert.equal(round.streak, 0, "a miss did not clear the streak — patience would never come back")
})
