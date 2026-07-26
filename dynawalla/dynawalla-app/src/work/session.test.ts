// The loop's shape: what runs on the answer path, what runs in idle, and what
// the session does over a run of cards.

import { test } from "node:test"
import assert from "node:assert/strict"

import { glyphFromKey } from "./entry.ts"
import { fiveThousandOne } from "./fixtures.ts"
import { CORRECT_PER_RUNG, LADDER, RUN_LENGTH, rungAt } from "./ladder.ts"
import { writtenAnswer } from "./problem.ts"
import {
  advance,
  commit,
  committable,
  enterAction,
  generateProblem,
  prepare,
  pressKey,
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
