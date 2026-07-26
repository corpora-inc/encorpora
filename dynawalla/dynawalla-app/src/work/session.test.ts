// The loop's shape: what runs on the answer path, what runs in idle, and what
// the session does over a run of cards.

import { test } from "node:test"
import assert from "node:assert/strict"

import { glyphFromKey } from "./entry.ts"
import { fiveThousandOne } from "./fixtures.ts"
import { CORRECT_PER_RUNG, FIRST_ACROSS_ZERO, LADDER, RUN_LENGTH, rungAt } from "./ladder.ts"
import { writtenAnswer } from "./problem.ts"
import {
  advance,
  arrivesAcrossZero,
  commit,
  committable,
  enterAction,
  generateProblem,
  prepare,
  pressKey,
  sequenceFrom,
  startSession,
  submitted,
  DECK_DEPTH,
  type SessionDeps,
  type SessionState,
} from "./session.ts"

/** Counts generator calls so "what runs where" is measured, not asserted. */
function counting(): SessionDeps & { calls: () => number } {
  let calls = 0
  return {
    generate: (rung, seed) => {
      calls += 1
      return generateProblem(rung, seed)
    },
    calls: () => calls,
  }
}

function type(state: SessionState, digits: string): SessionState {
  return digits.split("").reduce<SessionState>((next, digit) => {
    const glyph = glyphFromKey(digit)
    assert.ok(glyph !== null)
    return pressKey(next, { kind: "glyph", glyph })
  }, state)
}

/** Answer the card on screen correctly, then move on. */
function answerCorrectly(state: SessionState, deps: SessionDeps): SessionState {
  assert.ok(state.card.kind === "problem")
  const text = writtenAnswer(state.card.exercise)
  assert.ok(text !== null)
  const committed = commit(type(state, text))
  assert.equal(committed.feedback?.kind, "seated")
  return advance(prepare(committed, deps), deps)
}

test("the session's choice sequence is seeded, so a session replays exactly", () => {
  // Which effect the stage plays and which phrasing the Dynawalla reaches for
  // were both `Math.random()` at the call site, while `surface.ts` went to the
  // trouble of a deterministic integer-hash mote pool "because the committed
  // screenshot set has to be comparable frame for frame". The two things that
  // most change a screenshot were the two that were not seeded.
  const take = (cursor: number): number[] => {
    const draw = sequenceFrom(cursor)
    return Array.from({ length: 8 }, () => draw())
  }
  assert.deepEqual(take(41), take(41), "the same cursor did not replay")
  assert.notDeepEqual(take(41), take(42), "two cursors gave the same sequence")
  for (const value of take(7)) {
    assert.ok(value >= 0 && value < 1, `${String(value)} is not a draw in [0, 1)`)
  }
  // A whole session's worth without repeating itself into a pattern.
  const long = Array.from({ length: 500 }, sequenceFrom(0))
  assert.ok(new Set(long).size > 400, "the sequence is degenerate")
})

test("only a ladder card at the across-zero rungs is an arrival", () => {
  // The unit form of the bug `diagnosis.test.ts` drives end to end: a repair
  // item is served *at* `FIRST_ACROSS_ZERO` by construction, so a rule keyed on
  // the rung alone announces an arrival that has not happened.
  const deps = counting()
  const at = (rung: number, role: "ladder" | "retry" | "repair"): boolean => {
    const state = startSession({ profileId: "p1", rung, rungCorrect: 0, seedCursor: 0 }, deps)
    assert.ok(state.card.kind === "problem")
    return arrivesAcrossZero({ ...state.card, role })
  }
  assert.equal(at(FIRST_ACROSS_ZERO, "ladder"), true)
  assert.equal(at(FIRST_ACROSS_ZERO, "repair"), false)
  assert.equal(at(FIRST_ACROSS_ZERO, "retry"), false)
  assert.equal(at(FIRST_ACROSS_ZERO - 1, "ladder"), false)
  assert.equal(at(LADDER.length - 1, "ladder"), true)
})

test("commit does no generation — it cannot, and that is the signature", () => {
  const deps = counting()
  let state = startSession({ profileId: "p1", rung: 0, rungCorrect: 0, seedCursor: 0 }, deps)
  state = prepare(state, deps)

  const before = deps.calls()
  assert.ok(state.card.kind === "problem")
  const text = writtenAnswer(state.card.exercise)
  assert.ok(text !== null)
  const committed = commit(type(state, text))
  assert.equal(committed.feedback?.kind, "seated")
  assert.equal(deps.calls(), before, "the answer path generated a problem")
})

test("the deck is filled ahead and never starves in ordinary play", () => {
  const deps = counting()
  let state = startSession({ profileId: "p1", rung: 0, rungCorrect: 0, seedCursor: 0 }, deps)
  state = prepare(state, deps)
  assert.equal(state.deck.length, DECK_DEPTH)

  for (let i = 0; i < 30; i++) state = answerCorrectly(state, deps)
  assert.equal(state.starved, 0, "advance had to generate inline; the idle pass is not keeping up")
})

test("prepare is idempotent and returns the same state when there is nothing to do", () => {
  const deps = counting()
  const state = prepare(startSession({ profileId: "p1", rung: 0, rungCorrect: 0, seedCursor: 0 }, deps), deps)
  const calls = deps.calls()
  assert.equal(prepare(state, deps), state)
  assert.equal(deps.calls(), calls)
})

test("seeds never repeat, so a relaunch does not re-serve the same problem", () => {
  const deps = counting()
  let state = startSession({ profileId: "p1", rung: 0, rungCorrect: 0, seedCursor: 0 }, deps)
  const ids = new Set<string>()
  for (let i = 0; i < 20; i++) {
    assert.ok(state.card.kind === "problem")
    ids.add(state.card.exercise.exerciseId)
    state = answerCorrectly(state, deps)
  }
  assert.equal(ids.size, 20)
  assert.ok(state.seedCursor >= 20)
})

test("the ladder is climbed by correct answers on ladder cards only", () => {
  const deps = counting()
  let state = startSession({ profileId: "p1", rung: 0, rungCorrect: 0, seedCursor: 0 }, deps)
  for (let i = 0; i < CORRECT_PER_RUNG; i++) state = answerCorrectly(state, deps)
  assert.equal(state.rung, 1)
})

test("a correct answer on a retry card does not promote", () => {
  const deps = counting()
  let state = startSession({ profileId: "p1", rung: 3, rungCorrect: 3, seedCursor: 0 }, deps)

  // Wrong, unexplained → Stage 1 → a retry card one rung easier.
  state = commit(type(state, "1"))
  assert.equal(state.rung, 3)
  state = advance(prepare(state, deps), deps)
  assert.ok(state.card.kind === "problem")
  assert.equal(state.card.role, "retry")

  const before = state.rung
  state = answerCorrectly(state, deps)
  assert.equal(state.rung, before, "the easier retry promoted the child")
})

test("an entry that is empty cannot be committed", () => {
  const deps = counting()
  const state = startSession({ profileId: "p1", rung: 0, rungCorrect: 0, seedCursor: 0 }, deps)
  assert.equal(committable(state), false)
  assert.equal(submitted(state), null)
  assert.equal(commit(state), state)
})

test("Enter commits an answerable card and moves on from everything else", () => {
  const deps: SessionDeps = { generate: () => fiveThousandOne().exercise }
  let state = startSession({ profileId: "p1", rung: LADDER.length - 1, rungCorrect: 0, seedCursor: 0 }, deps)
  assert.equal(enterAction(state), "commit")

  state = commit(type(state, "3203"))
  assert.equal(enterAction(state), "next", "a verdict is up; Enter must not re-commit")

  state = advance(state, deps)
  assert.equal(state.card.kind, "locate")
  assert.equal(
    enterAction(state),
    "next",
    "the contrast card has no entry — committing it does nothing and traps the keyboard",
  )
})

test("input is ignored once a verdict is up", () => {
  const deps = counting()
  let state = startSession({ profileId: "p1", rung: 0, rungCorrect: 0, seedCursor: 0 }, deps)
  state = commit(type(state, "1"))
  assert.equal(pressKey(state, { kind: "glyph", glyph: "9" }), state)
})

test("a run reaches a designed stopping point, and it is not a wall", () => {
  const deps = counting()
  let state = startSession({ profileId: "p1", rung: 0, rungCorrect: 0, seedCursor: 0 }, deps)
  for (let i = 0; i < RUN_LENGTH - 1; i++) {
    assert.ok(state.card.kind === "problem")
    const text = writtenAnswer(state.card.exercise)
    assert.ok(text !== null)
    const committed = commit(type(state, text))
    assert.equal(committed.stopping, false)
    state = advance(prepare(committed, deps), deps)
  }
  assert.ok(state.card.kind === "problem")
  const last = writtenAnswer(state.card.exercise)
  assert.ok(last !== null)
  state = commit(type(state, last))
  assert.equal(state.answered, RUN_LENGTH)
  assert.equal(state.stopping, true)

  // "Keep going" is just `advance`. Nothing is gated behind stopping.
  const kept = advance(prepare(state, deps), deps)
  assert.equal(kept.stopping, false)
  assert.equal(kept.card.kind, "problem")
})

test("a stopping point is never offered in the middle of a repair sequence", () => {
  const deps: SessionDeps = { generate: () => fiveThousandOne().exercise }
  let state = startSession(
    { profileId: "p1", rung: LADDER.length - 1, rungCorrect: 0, seedCursor: 0 },
    deps,
  )
  for (let i = 0; i < RUN_LENGTH - 1; i++) {
    state = advance(commit(type(state, "2203")), deps)
  }
  state = commit(type(state, "3203"))
  assert.equal(state.answered, RUN_LENGTH)
  assert.equal(state.stopping, false, "a repair sequence was interrupted by a stopping point")
})

test("the way out is offered on cards done, not on cards done right", () => {
  // Computed only on the seated branch, answering card 12 wrong pushed the offer
  // to card 24 and a run of wrong answers suppressed it altogether: withheld
  // from the child having the worst time, which is ADR-0009 inverted.
  const deps = counting()
  let state = startSession({ profileId: "p1", rung: 0, rungCorrect: 0, seedCursor: 0 }, deps)
  for (let i = 0; i < RUN_LENGTH - 1; i++) state = answerCorrectly(state, deps)

  assert.ok(state.card.kind === "problem")
  const wrong = commit(type(state, "1"))
  assert.equal(wrong.answered, RUN_LENGTH)
  assert.equal(wrong.feedback?.kind, "struck")
  assert.equal(wrong.stopping, true, "a wrong answer at the run boundary withheld the offer")

  // …and "Keep going" still leads into the retry the wrong answer earned.
  const kept = advance(prepare(wrong, deps), deps)
  assert.equal(kept.stopping, false)
  assert.ok(kept.card.kind === "problem")
  assert.equal(kept.card.role, "retry")
})

test("the same board is never served twice in one session", () => {
  // The repair loop had no floor: the same bug brought the identical board back
  // with `stopping` suppressed throughout, so the way out was withheld for as
  // long as the child was stuck. ADAPTIVE_LEARNING sends repeated failure to
  // Stage 3, which M2 has not built; Stage 1 is its stand-in.
  const deps: SessionDeps = { generate: () => fiveThousandOne().exercise }
  let state = startSession({ profileId: "p1", rung: LADDER.length - 1, rungCorrect: 0, seedCursor: 0 }, deps)

  state = commit(type(state, "3203"))
  assert.ok(state.feedback?.kind === "struck")
  assert.equal(state.feedback.stage, "locate")

  state = advance(prepare(state, deps), deps)
  assert.equal(state.card.kind, "locate")
  state = advance(state, deps)
  assert.ok(state.card.kind === "problem")
  assert.equal(state.card.role, "repair")

  // The same bug on the repair item. The diagnosis is still made — progress
  // still counts it — but the card that follows is a quiet Stage 1, not the
  // board a third time.
  state = commit(type(state, "3203"))
  assert.ok(state.feedback?.kind === "struck")
  assert.equal(state.feedback.stage, "verify")
  assert.equal(
    state.log.filter((entry) => entry.kind === "diagnosed").length,
    2,
    "the second diagnosis was dropped rather than routed",
  )
  state = advance(prepare(state, deps), deps)
  assert.ok(state.card.kind === "problem")
  assert.equal(state.card.role, "retry")
})

test("nothing lowers the ladder or the totals", () => {
  const deps = counting()
  let state = startSession({ profileId: "p1", rung: 4, rungCorrect: 2, seedCursor: 0 }, deps)
  const rung = state.rung
  const correct = state.correct
  for (let i = 0; i < 6; i++) {
    state = advance(prepare(commit(type(state, "1")), deps), deps)
  }
  assert.ok(state.rung >= rung, "a wrong answer moved the ladder down")
  assert.ok(state.correct >= correct)
  assert.equal(rungAt(state.rung).skillId, rungAt(rung).skillId)
})
