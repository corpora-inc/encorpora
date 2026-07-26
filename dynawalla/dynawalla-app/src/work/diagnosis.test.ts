// The behaviour the slice exists to prove.
//
// `P-03`: on `5001 − 2798` answered `3203`, the app identifies
// `mis.add.borrow-across-zero` and serves the counting-board contrast pair within
// three cards. The same problem answered `3797` identifies
// `mis.add.smaller-from-larger` instead — "a wrong rule-to-answer mapping passes
// CG-12 and fails here", which is exactly what these tests are for.
//
// Every assertion below runs against a real generated exercise (see
// `fixtures.ts`) and the real judging path the screen calls.

import { test } from "node:test"
import assert from "node:assert/strict"

import {
  columnOpFamily,
  exact,
  MIS_BORROW_ACROSS_ZERO,
  MIS_SMALLER_FROM_LARGER,
  REP_COUNTING_BOARD,
} from "./curriculum.ts"
import { countingBoard } from "./contrast.ts"
import { glyphFromKey } from "./entry.ts"
import {
  ACROSS_ZERO_RUNG,
  CARRY_SURPLUS_RUNG,
  answerOf,
  fiveThousandOne,
  nineHundredThree,
} from "./fixtures.ts"
import { judge } from "./judge.ts"
import { readProblem } from "./problem.ts"
import { repairRung, rungAt, FIRST_ACROSS_ZERO, LADDER, LADDER_FORMS } from "./ladder.ts"
import {
  advance,
  arrivesAcrossZero,
  commit,
  contrastDistance,
  prepare,
  pressKey,
  startSession,
  type SessionDeps,
  type SessionState,
} from "./session.ts"

test("2203 is judged correct, exactly", () => {
  const { exercise } = fiveThousandOne()
  assert.deepEqual(judge(exercise, answerOf(2203n)), { kind: "seated" })
})

test("3203 identifies borrow-across-zero and routes to the counting board", () => {
  const { exercise } = fiveThousandOne()
  const verdict = judge(exercise, answerOf(3203n))
  assert.equal(verdict.kind, "struck")
  assert.ok(verdict.kind === "struck")
  assert.equal(verdict.diagnosis?.misconception, MIS_BORROW_ACROSS_ZERO)
  assert.equal(verdict.diagnosis?.contrast, REP_COUNTING_BOARD)
})

test("3797 identifies smaller-from-larger and does NOT get the counting board", () => {
  // The mapping error the program has already made once. Both rules are valid,
  // both diverge from the correct answer on ≥95% of seeds, and CG-12 cannot tell
  // them apart — so it is asserted here, on the answer, not on the rule table.
  const { exercise } = fiveThousandOne()
  const verdict = judge(exercise, answerOf(3797n))
  assert.ok(verdict.kind === "struck")
  assert.equal(verdict.diagnosis?.misconception, MIS_SMALLER_FROM_LARGER)
  assert.equal(
    verdict.diagnosis?.contrast,
    null,
    "smaller-from-larger's contradiction is the number line, not the counting board",
  )
})

test("an unexplained wrong answer gets no diagnosis rather than a guessed one", () => {
  const { exercise } = fiveThousandOne()
  const verdict = judge(exercise, answerOf(4444n))
  assert.ok(verdict.kind === "struck")
  assert.equal(verdict.diagnosis, null)
})

test("the counting board holds the contradiction, in exact whole counters", () => {
  const { exercise } = fiveThousandOne()
  const board = countingBoard(exercise, answerOf(3203n))
  assert.ok(board !== null)

  assert.equal(board.minuend, "5001")
  assert.equal(board.subtrahend, "2798")

  // One column set, shared: the hundreds of one plate sit under the hundreds of
  // the other, which is the only way "side by side" is a comparison at all.
  assert.deepEqual([...board.places], [3, 2, 1, 0])
  assert.equal(board.correct.columns.length, board.places.length)
  assert.equal(board.yours.columns.length, board.places.length)

  // The correct answer closes the board.
  assert.equal(board.correct.addend, "2203")
  assert.equal(board.correct.sum, "5001")
  assert.equal(board.correct.rebuilds, true)
  assert.ok(board.correct.columns.every((c) => c.seated === c.sockets && c.spare === 0))

  // The child's does not, and the surplus is exactly one counter in the
  // thousands column — the thousand that was borrowed and never given up.
  assert.equal(board.yours.addend, "3203")
  assert.equal(board.yours.sum, "6001")
  assert.equal(board.yours.rebuilds, false)
  const thousands = board.yours.columns.find((c) => c.place === 3)
  assert.deepEqual(thousands, { place: 3, sockets: 5, seated: 5, spare: 1 })
  assert.equal(
    board.yours.columns.reduce((n, c) => n + c.spare, 0),
    1,
    "one counter over, not a scattering",
  )
})

test("903 − 778 answered 225: one hundred over, and nine hundreds still seated", () => {
  // The shape that broke the first version, and why it was rewritten.
  // `903 − 778 = 125` (778 + 125 = 903). The buggy procedure regroups through
  // the zero and never decrements the 9: units 13−8=5, tens 9−7=2, hundreds
  // 9−7=2 → 225 = 125 + 100. Putting it back gives 225 + 778 = 1003 against a
  // board carved for 903. Comparing the *digits* of 1003 with those of 903 said
  // nine empty hundreds sockets and a counter in a thousands column the correct
  // plate did not have: true of the digits, false of the board (1003 in counters
  // fills all nine hundreds and leaves one over), and what a child saw read "you
  // lost all nine hundreds" on the screen meant to repair regrouping.
  assert.equal(903n - 778n, 125n)
  assert.equal(778n + 125n, 903n)
  assert.equal(125n + 100n, 225n)
  assert.equal(225n + 778n, 1003n)

  const board = countingBoard(nineHundredThree().exercise, answerOf(225n))
  assert.ok(board !== null)
  assert.deepEqual([...board.places], [3, 2, 1, 0])

  assert.deepEqual([...board.correct.columns], [
    { place: 3, sockets: 0, seated: 0, spare: 0 },
    { place: 2, sockets: 9, seated: 9, spare: 0 },
    { place: 1, sockets: 0, seated: 0, spare: 0 },
    { place: 0, sockets: 3, seated: 3, spare: 0 },
  ])
  assert.deepEqual([...board.yours.columns], [
    { place: 3, sockets: 0, seated: 0, spare: 0 },
    // Nine hundreds seated, exactly as on the plate above, and one over.
    { place: 2, sockets: 9, seated: 9, spare: 1 },
    { place: 1, sockets: 0, seated: 0, spare: 0 },
    { place: 0, sockets: 3, seated: 3, spare: 0 },
  ])
})

test("no contrast card ever draws a hole the other plate fills", () => {
  // Over every rung the diagnosis reaches. The old digit-wise model failed this
  // on 11–16% of contrast cards per rung; every test and both drivers used
  // `5001 − 2798` or `606 − 199`, the shapes where the surplus does not carry.
  const SEEDS = 1000
  let cards = 0

  for (let rung = 0; rung < LADDER.length; rung++) {
    const at = rungAt(rung)
    for (let seed = 0; seed < SEEDS; seed++) {
      const exercise = columnOpFamily.generate({
        skillId: at.skillId,
        level: at.level,
        seed,
        params: at.params,
        forms: LADDER_FORMS,
      })
      const problem = readProblem(exercise)
      const canonical = exercise.answer.canonical
      if (problem === null || canonical.kind !== "integer") continue
      const right = exact.toScaled(canonical.value, 0)
      if (right === null) continue

      for (let place = 1; place <= 4; place++) {
        const wrong = answerOf(right + 10n ** BigInt(place))
        const verdict = judge(exercise, wrong)
        if (verdict.kind !== "struck" || verdict.diagnosis?.contrast == null) continue
        const board = countingBoard(exercise, wrong)
        if (board === null) continue
        cards += 1

        const where = `rung ${String(rung)} seed ${String(seed)}: ${problem.top} − ${problem.bottom}`
        for (const plate of [board.correct, board.yours] as const) {
          assert.equal(plate.columns.length, board.places.length, `${where}: plates disagree on columns`)
          for (const column of plate.columns) {
            assert.equal(column.seated, column.sockets, `${where}: an empty socket at 10^${String(column.place)}`)
          }
        }
        // The child's plate holds exactly their own check, no more and no less.
        const drawn = board.yours.columns.reduce(
          (total, c) => total + BigInt(c.seated + c.spare) * 10n ** BigInt(c.place),
          0n,
        )
        assert.equal(drawn.toString(), board.yours.sum, `${where}: the plate is not the child's sum`)
        assert.equal(board.correct.columns.every((c) => c.spare === 0), true, `${where}: the correct plate spills`)
        assert.equal(board.correct.rebuilds, true)
        assert.equal(board.yours.rebuilds, false)
        break
      }
    }
  }

  assert.ok(cards > 2000, `only ${String(cards)} contrast cards exercised`)
})

test("the board is never built for the misconception it does not explain", () => {
  // 3797 + 2798 = 6595, which is not 5001 either — but it is not a *place-value*
  // surplus, so a counting board would show two unrelated numbers rather than a
  // contradiction. `judge` is what stops it; this asserts the numbers, so the
  // reason is on the record rather than only the routing.
  assert.equal(3797n + 2798n, 6595n)
  assert.notEqual(6595n - 5001n, 1000n)
})

// ── The loop-level criterion ────────────────────────────────────────────────

/** Every problem this session serves is the `5001 − 2798` fixture. */
const fixtureDeps: SessionDeps = { generate: () => fiveThousandOne().exercise }

function fixtureSession(): SessionState {
  return startSession({ profileId: "p1", rung: ACROSS_ZERO_RUNG, rungCorrect: 0, seedCursor: 0 }, fixtureDeps)
}

/** Type digits the way a child does — through the same key path the keypad uses. */
function type(state: SessionState, digits: string): SessionState {
  return digits.split("").reduce<SessionState>((next, digit) => {
    const glyph = glyphFromKey(digit)
    assert.ok(glyph !== null)
    return pressKey(next, { kind: "glyph", glyph })
  }, state)
}

test("3203 puts the counting board on the very next card — one, not three", () => {
  let state = fixtureSession()
  state = type(state, "3203")
  state = commit(state)

  assert.equal(state.feedback?.kind, "struck")
  assert.ok(state.feedback?.kind === "struck")
  assert.equal(state.feedback.stage, "locate")
  assert.equal(state.feedback.answer, "2203", "the correct answer is seated beside the strike")

  state = prepare(state, fixtureDeps)
  state = advance(state, fixtureDeps)

  assert.equal(state.card.kind, "locate")
  assert.ok(state.card.kind === "locate")
  assert.equal(state.card.misconception, MIS_BORROW_ACROSS_ZERO)
  assert.equal(state.card.representation, REP_COUNTING_BOARD)
  assert.equal(state.card.board.yours.sum, "6001")

  const distance = contrastDistance(state.log, MIS_BORROW_ACROSS_ZERO)
  assert.equal(distance, 1)
  assert.ok(distance !== null && distance <= 3, "P-03 allows three cards; this takes one")
})

test("the contrast pair is followed by a repair item that cannot avoid the step", () => {
  // "A targeted follow-up that isolates the misunderstanding." The card after
  // the board comes from a rung whose *parameters* demand a borrow through a
  // zero — not from wherever the child was standing, which for the multidigit
  // rungs would usually be a problem with no zero in it at all.
  let state = fixtureSession()
  state = commit(type(state, "3203"))
  state = advance(prepare(state, fixtureDeps), fixtureDeps)
  state = advance(state, fixtureDeps)

  assert.ok(state.card.kind === "problem")
  assert.equal(state.card.role, "repair")
  assert.ok(rungAt(state.card.rung).params.acrossZero >= 1)
  assert.equal(rungAt(state.card.rung).skillId, "dw.add.regroup.subtract-across-zero")
})

test("a repair item is not an arrival: the Dynawalla stays quiet through it", () => {
  // The bug this is written against. `FIRST_ACROSS_ZERO` and the rung a
  // `borrow-across-zero` repair comes from are *the same index* — both are
  // "the lowest rung whose parameters guarantee the step" — so a rule that
  // watched the rung number climb announced "the ladder has reached the
  // problems with a zero in the middle" the first time a child at rung 2 fired
  // the mal-rule and was handed the repair card. The ladder had not moved. It
  // then latched for the session, so when the child genuinely reached rung 4 by
  // promotion he said nothing, and one of his four utterances had been spent on
  // a card the child got *wrong* — stacked onto the strike and the contrast
  // pair, at the moment they are most loaded.
  assert.equal(repairRung(MIS_BORROW_ACROSS_ZERO, CARRY_SURPLUS_RUNG), FIRST_ACROSS_ZERO)

  // `903 − 778` on `subtract-multidigit` level 2, answered 225: the across-zero
  // procedure run at a rung three below where it is taught.
  const deps: SessionDeps = { generate: () => nineHundredThree().exercise }
  let state = startSession(
    { profileId: "p1", rung: CARRY_SURPLUS_RUNG, rungCorrect: 0, seedCursor: 0 },
    deps,
  )
  assert.ok(CARRY_SURPLUS_RUNG < FIRST_ACROSS_ZERO)
  assert.equal(arrivesAcrossZero(state.card), false, "the first card is an arrival")

  state = commit(type(state, "225"))
  assert.equal(state.plan.kind, "locate")

  state = advance(prepare(state, deps), deps)
  assert.equal(state.card.kind, "locate")
  assert.equal(arrivesAcrossZero(state.card), false, "the contrast pair is an arrival")

  state = advance(state, deps)
  assert.ok(state.card.kind === "problem")
  assert.equal(state.card.role, "repair")
  assert.equal(state.card.rung, FIRST_ACROSS_ZERO, "the repair is served at the arrival rung")
  assert.equal(arrivesAcrossZero(state.card), false, "the repair card announced an arrival")

  // …and the real thing still does. A `ladder` card at that rung is the ladder
  // having got there.
  assert.equal(arrivesAcrossZero({ ...state.card, role: "ladder" }), true)
  assert.equal(arrivesAcrossZero({ ...state.card, role: "ladder", rung: FIRST_ACROSS_ZERO - 1 }), false)
})

test("a diagnosis on an easy rung still repairs with a guaranteed across-zero item", () => {
  // The case that made this necessary: `subtract-multidigit` level 2 asks for
  // two regroupings and no zeros, and a drawn zero fires this diagnosis anyway.
  // Repairing at that rung hands back a problem with no zero in it.
  const easyRung = 2
  assert.equal(rungAt(easyRung).params.acrossZero, 0)
  assert.ok(rungAt(repairRung(MIS_BORROW_ACROSS_ZERO, easyRung)).params.acrossZero >= 1)
  // A rule with no bound structure keeps the child where they were.
  assert.equal(repairRung(MIS_SMALLER_FROM_LARGER, easyRung), easyRung)
})

test("3797 gets Stage 1, not the board: a strike, the answer, one easier retry", () => {
  let state = fixtureSession()
  state = commit(type(state, "3797"))

  assert.ok(state.feedback?.kind === "struck")
  assert.equal(state.feedback.stage, "verify")
  assert.equal(state.feedback.answer, "2203")

  state = advance(prepare(state, fixtureDeps), fixtureDeps)
  assert.equal(state.card.kind, "problem")
  assert.ok(state.card.kind === "problem")
  assert.equal(state.card.role, "retry")
  assert.equal(state.card.rung, ACROSS_ZERO_RUNG - 1, "one rung easier, never lower than the bottom")

  assert.equal(
    contrastDistance(state.log, MIS_SMALLER_FROM_LARGER),
    null,
    "no contrast exists for this rule in this build, and none is claimed",
  )
})

test("a child who taps straight through still gets the contrast pair", () => {
  // The follow-up must not depend on the idle pass having run. A fast tap
  // between commit and idle is the ordinary case on a fast device.
  let state = fixtureSession()
  state = commit(type(state, "3203"))
  state = advance(state, fixtureDeps) // no `prepare` in between
  assert.equal(state.card.kind, "locate")
})
