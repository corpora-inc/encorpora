// The loop, driven through the **real** planner.
//
// Every other test of the loop pins selection, which is right for what those
// tests are about — a test of the contrast-pair routing that also depends on the
// scheduler's mood fails for reasons it was not written to catch. But a pinned
// planner hands back a unique `itemKey` and a per-index seed for every card and
// answers `admissible` with `true`, which is precisely the shape that hides the
// two defects this file exists to pin:
//
//   - the loop dropped `PlannedBatch.cursor`, so every card of a class in a
//     session was generated from the same seed. Twenty-four cards, sixteen
//     distinct problems, and the no-repeat window saw nothing because the repeat
//     was *inside* the item class, which is what the window compares on.
//   - the loop re-planned a whole batch whenever the deck fell below two and
//     served its first one or two slots, which are FRONTIER by construction. A
//     child never received a fluency burst, a review card, a planned repair or a
//     three-card debut, and the harness could not see it because the harness
//     serves whole batches.
//
// So: no pins here. The real `adaptivePlanner`, the real catalog, and assertions
// about what a child is actually served.

import { test } from "node:test"
import assert from "node:assert/strict"

import { engineCatalog, DEFAULT_GRADE } from "./catalog.ts"
import { glyphFromKey } from "./entry.ts"
import { adaptivePlanner } from "./plan.ts"
import { writtenAnswer } from "./problem.ts"
import { advance, commit, prepare, pressKey, startSession, type SessionState } from "./session.ts"
import { coldStart, newSession, FATIGUE_P_TARGET } from "../../../engine/src/index.ts"

function learner() {
  return coldStart(engineCatalog(), DEFAULT_GRADE, 0)
}

function type(state: SessionState, digits: string): SessionState {
  return digits.split("").reduce<SessionState>((next, digit) => {
    const glyph = glyphFromKey(digit)
    assert.ok(glyph !== null)
    return pressKey(next, { kind: "glyph", glyph })
  }, state)
}

type Served = {
  readonly exerciseId: string
  readonly itemKey: string
  readonly seed: number
  readonly pool: string
  readonly role: string
}

/**
 * Answer `cards` cards. `answer` decides what is typed, so a run can be all
 * correct, all wrong, or anything in between.
 */
function play(
  cards: number,
  answer: (state: SessionState, index: number) => string,
  minutes: (index: number) => number = () => 0,
): { state: SessionState; served: Served[] } {
  let state = startSession({ profileId: "loop", learner: learner(), seedCursor: 0, day: 0 })
  const served: Served[] = []
  for (let index = 0; index < cards; index++) {
    if (state.card.kind !== "problem") {
      state = advance(prepare(state))
      continue
    }
    served.push({
      exerciseId: state.card.exercise.exerciseId,
      itemKey: state.card.plan.itemKey,
      seed: state.card.plan.seed,
      pool: state.card.plan.pool,
      role: state.card.role,
    })
    state = advance(prepare(commit(type(state, answer(state, index)), 6000, minutes(index))))
  }
  return { state, served }
}

const right = (state: SessionState): string => {
  assert.ok(state.card.kind === "problem")
  return writtenAnswer(state.card.exercise) ?? "0"
}

test("a session of twenty-four cards is twenty-four different problems", () => {
  const { state, served } = play(24, right)
  assert.equal(served.length, 24)

  const distinct = new Set(served.map((card) => card.exerciseId))
  assert.equal(distinct.size, 24, `${String(distinct.size)} distinct problems in twenty-four cards`)

  // The mechanism, not just the outcome: two cards of one class must carry two
  // seeds. Without the cursor they carried the same one, which is what made the
  // no-repeat window's guarantee — "the class comes back, the problem does not" —
  // false.
  const byKey = new Map<string, Set<number>>()
  for (const card of served) {
    const seeds = byKey.get(card.itemKey) ?? new Set<number>()
    seeds.add(card.seed)
    byKey.set(card.itemKey, seeds)
  }
  const classesServedTwice = [...byKey.keys()].filter(
    (key) => served.filter((card) => card.itemKey === key).length > 1,
  )
  assert.ok(classesServedTwice.length > 0, "no item class came back; the assertion below proves nothing")
  for (const key of classesServedTwice) {
    const count = served.filter((card) => card.itemKey === key).length
    assert.equal(byKey.get(key)?.size, count, `${key} was served ${String(count)} times with a repeated seed`)
  }
  assert.ok(state.context.rngCursor > 0, "the draw cursor never moved")
})

test("the batch the engine planned is the batch the child is served, in slot order", () => {
  // `slotPools` puts FRONTIER in the leading slots and everything else — the
  // debut block, DUE_FACT, REPAIR, PREREQ, FLUENCY, REVIEW_SKILL — behind it. A
  // loop that re-plans per deck top-up therefore serves FRONTIER for ever.
  const planned = adaptivePlanner.next(learner(), newSession(0, 0, learner()))
  const pools = planned.cards.map((card) => card.pool)
  assert.ok(pools.includes("NEW"), `the first batch of a child's life has no debut: ${pools.join(",")}`)

  const { served } = play(24, right)
  const first = served.slice(0, planned.cards.length).map((card) => card.pool)
  assert.deepEqual(first, pools, "the served pools are not the planned batch's slot order")

  // A pool the old loop could never reach: everything after the leading FRONTIER
  // slots was planned and thrown away. What arrives here is the debut and, later
  // in the session, a fluency burst.
  const reached = new Set(served.map((card) => card.pool))
  assert.ok(reached.size > 1, `every card came from one pool: ${[...reached].join(",")}`)
  assert.ok(served.some((card) => card.pool === "NEW"), "the debut was planned and never served")

  // What is *not* asserted, and why: `poolQuota` allocates three NEW slots and
  // the batch above carries one. That is a known engine gap recorded at
  // `poolQuota` — a debut card is pinned to level 0, so the second and third NEW
  // slots are rejected as in-batch duplicates. It is not the loop's doing: the
  // loop now serves every slot the engine planned, which is what the assertion
  // above measures.
  assert.equal(pools.filter((pool) => pool === "NEW").length, 1, "the debut gap at poolQuota has changed — re-check A-13 and A-05 at pilot scale")
})

test("every retry in a session is a different problem", () => {
  // `retryCard` draws at `rngCursor + 977`, so a frozen cursor made every retry
  // in a session the identical problem — handed to the child who had just got
  // that exact problem wrong, as relief.
  const { served } = play(16, (state, index) => (index % 2 === 0 ? "1" : right(state)))
  const retries = served.filter((card) => card.role === "retry")
  assert.ok(retries.length >= 3, `${String(retries.length)} retries in a session of alternating errors`)
  assert.equal(
    new Set(retries.map((card) => card.exerciseId)).size,
    retries.length,
    "two retries in one session were the identical problem",
  )
  assert.equal(
    new Set(served.map((card) => card.exerciseId)).size,
    served.length,
    "a session with retries served the same problem twice",
  )
})

test("a session of rising latency and falling accuracy is detected as fatigue", () => {
  // The detector was called from the simulation harness and nowhere else, so
  // `context.fatigued` was permanently false in the loop a child uses — and with
  // it the halved evidence weight, the frozen mastery level, the 0.90 hold, and
  // the suppression of new skills and repair.
  const { state } = play(
    18,
    (current, index) => (index < 6 ? right(current) : "1"),
    (index) => (index < 6 ? 1 : 12),
  )
  assert.equal(state.context.fatigued, true, "a tired session was not detected")

  // What the verdict is *for*, at the one place the loop can observe it: the
  // controller stops chasing a tired child's accuracy downward and holds at
  // `FATIGUE_P_TARGET`. Without the detector wired, eighteen answers of which
  // twelve are wrong drive `pTarget` to its ceiling instead.
  assert.equal(state.learner.pTarget, FATIGUE_P_TARGET, "the controller was still chasing a tired child")
})

test("an ordinary session does not report fatigue", () => {
  const { state } = play(18, right, () => 1)
  assert.equal(state.context.fatigued, false, "a child answering well was declared tired")
})
