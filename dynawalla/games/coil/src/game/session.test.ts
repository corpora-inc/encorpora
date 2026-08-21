import assert from "node:assert/strict"
import test from "node:test"

import type { Question } from "../contract.ts"
import { Rng } from "../core/rng.ts"
import { aim } from "./board.ts"
import { breaksNeeded, coilOf, suffixValues } from "./place.ts"
import { COURSE, type Report, createSession } from "./session.ts"

const SEED = 0x0c011960
const MINUS = "−"

type Harness = {
  session: ReturnType<typeof createSession>
  reports: Report[]
  transitions: { kind: string; label?: string }[]
  served: number
}

function harness(questions: Question[], capacity = 96): Harness {
  const reports: Report[] = []
  const transitions: { kind: string; label?: string }[] = []
  const state = { served: 0, t: 0 }
  const session = createSession({
    nextQuestion: () => {
      const q = questions[state.served]
      state.served += 1
      return q ?? null
    },
    report: (r) => reports.push(r),
    now: () => {
      state.t += 1_000
      return state.t
    },
    capacity,
    transition: (kind, label) => transitions.push(label === undefined ? { kind } : { kind, label }),
  })
  return {
    session,
    reports,
    transitions,
    get served() {
      return state.served
    },
  }
}

function ask(prompt: string, answer: string, id = "q"): Question {
  return { id, prompt, answer, distractors: [], domain: "add", difficulty: 0 }
}

/** Park the shear where the pending piece is worth `want`, cracking as needed. */
function dial(session: ReturnType<typeof createSession>, want: number): number {
  let breaks = 0
  for (let guard = 0; guard < 64; guard++) {
    const table = suffixValues(session.board.links)
    const exact = table.indexOf(want)
    if (exact >= 0) {
      session.aim(exact)
      return breaks
    }
    let at = session.board.links.length - 1
    for (let j = session.board.links.length - 1; j >= 0; j--) {
      if ((table[j] as number) > want) {
        at = j
        break
      }
    }
    session.aim(at)
    if (!session.crack()) break
    breaks++
  }
  return breaks
}

test("a run opens on the first item it can cut", () => {
  const h = harness([ask(`72 ${MINUS} 25`, "47", "a")])
  assert.equal(h.session.round?.coil, 72)
  assert.equal(h.session.round?.demand, 25)
  assert.deepEqual(h.session.board.links, coilOf(72))
})

test("an exact cut reports the answer the machine is left holding", () => {
  const h = harness([ask(`72 ${MINUS} 25`, "47", "a")])
  const breaks = dial(h.session, 25)
  assert.equal(breaks, breaksNeeded(coilOf(72), 25))
  const outcome = h.session.commit()
  assert.equal(outcome?.severed, 25)
  assert.equal(outcome?.claimed, 47)
  assert.equal(outcome?.exact, true)
  assert.deepEqual(h.reports, [{ questionId: "a", correct: true, ms: 1_000, answered: "47" }])
})

test("a careless cut reports the number that cut is worth", () => {
  const h = harness([ask(`72 ${MINUS} 25`, "47", "a")])
  // Two tens and the two loose ones: the take that skips the borrow.
  dial(h.session, 22)
  const outcome = h.session.commit()
  assert.equal(outcome?.severed, 22)
  assert.equal(outcome?.claimed, 50)
  assert.equal(outcome?.exact, false)
  assert.equal(h.reports[0]?.answered, "50")
  assert.equal(h.reports[0]?.correct, false)
})

test("an addition welds the piece to the cradle and claims the total", () => {
  const h = harness([ask("47 + 25", "72", "a")])
  assert.equal(h.session.round?.mode, "fill")
  assert.equal(h.session.round?.ingot, 47)
  dial(h.session, 25)
  const outcome = h.session.commit()
  assert.equal(outcome?.claimed, 72)
  assert.equal(h.reports[0]?.answered, "72")
})

test("a brick records what the child made, not the piece they cut", () => {
  const take = harness([ask(`72 ${MINUS} 25`, "47", "a")])
  dial(take.session, 25)
  take.session.commit()
  assert.deepEqual([...take.session.wall], [{ value: 47, mode: "take", course: 0 }])

  const fill = harness([ask("47 + 25", "72", "b")])
  dial(fill.session, 25)
  fill.session.commit()
  assert.deepEqual([...fill.session.wall], [{ value: 72, mode: "fill", course: 0 }])
})

test("one report per item, however many times the lever is pulled", () => {
  const h = harness([ask(`72 ${MINUS} 25`, "47", "a")])
  dial(h.session, 25)
  h.session.commit()
  h.session.commit()
  h.session.commit()
  assert.equal(h.reports.length, 1)
})

test("the coil the child is holding is the coil the shear left", () => {
  const h = harness([ask(`72 ${MINUS} 25`, "47", "a")])
  dial(h.session, 25)
  const outcome = h.session.commit()
  assert.equal(h.session.debugCoilValue(), 47)
  assert.deepEqual([...(outcome?.rest ?? [])], h.session.board.links)
})

test("the wall never regresses, whatever the run does", () => {
  const rng = new Rng(SEED ^ 0xbb)
  const questions: Question[] = []
  for (let i = 0; i < 60; i++) {
    const a = rng.int(30, 9_999)
    const b = rng.int(1, a - 1)
    questions.push(ask(`${String(a)} ${MINUS} ${String(b)}`, String(a - b), `q${String(i)}`))
  }
  const h = harness(questions)
  let height = 0
  for (let i = 0; i < 50; i++) {
    const round = h.session.round
    if (!round) break
    dial(h.session, rng.chance(0.55) ? round.demand : Math.max(1, round.demand - rng.int(1, 9)))
    h.session.commit()
    assert.ok(h.session.wall.length >= height, "no brick is ever taken back out")
    height = h.session.wall.length
    h.session.advance()
  }
  assert.ok(height > 0)
  assert.equal(h.session.wall.length, h.session.exactCuts)
})

test("a course closing is a stopping point, and a miss never is", () => {
  const questions: Question[] = []
  for (let i = 0; i < COURSE + 2; i++) {
    questions.push(ask(`90 ${MINUS} 40`, "50", `q${String(i)}`))
  }
  const h = harness(questions)
  for (let i = 0; i < COURSE; i++) {
    dial(h.session, 40)
    h.session.commit()
    h.session.advance()
  }
  assert.equal(h.transitions.length, 1)
  assert.equal(h.transitions[0]?.kind, "level")
  assert.equal(h.transitions[0]?.label, "course 1")

  // Now miss, repeatedly. Nothing fires.
  const before = h.transitions.length
  for (let i = 0; i < 2; i++) {
    dial(h.session, 30)
    h.session.commit()
    h.session.advance()
  }
  assert.equal(h.transitions.length, before)
})

test("an item the game cannot cut is skipped and never reported", () => {
  const h = harness([
    ask("1/2 + 1/4", "3/4", "frac"),
    ask("2.5 + 1.5", "4.0", "dec"),
    ask(`72 ${MINUS} 25`, "47", "good"),
  ])
  assert.equal(h.session.round?.questionId, "good")
  dial(h.session, 25)
  h.session.commit()
  assert.equal(h.reports.length, 1)
  assert.equal(h.reports[0]?.questionId, "good")
})

test("a host with nothing to serve leaves a quiet alley, not a crash", () => {
  const h = harness([])
  assert.equal(h.session.round, null)
  assert.equal(h.session.commit(), null)
  assert.equal(h.session.advance(), false)
  assert.deepEqual(h.reports, [])
})

test("the furnace costs a coil and no record", () => {
  const h = harness([ask(`72 ${MINUS} 25`, "47", "a"), ask(`93 ${MINUS} 47`, "46", "b")])
  h.session.board.slag = 6
  assert.equal(h.session.stoke(), true)
  assert.equal(h.session.board.slag, 0)
  assert.equal(h.session.round?.questionId, "b")
  assert.deepEqual(h.reports, [], "nothing is recorded for a coil that was melted")
})

test("resizing the lane keeps the shear where the child left it", () => {
  const h = harness([ask(`9999 ${MINUS} 1234`, "8765", "a")], 96)
  h.session.aim(20)
  const value = suffixValues(h.session.board.links)[20]
  h.session.resize(40)
  h.session.resize(96)
  assert.equal(suffixValues(h.session.board.links)[h.session.board.cut], value)
})

test("a full run stays exact: every claim is an integer string", () => {
  const rng = new Rng(SEED ^ 0xcc)
  const questions: Question[] = []
  for (let i = 0; i < 40; i++) {
    const add = rng.chance(0.5)
    const a = rng.int(20, 4_999)
    const b = rng.int(1, add ? 999 : a - 1)
    questions.push(
      ask(
        `${String(a)} ${add ? "+" : MINUS} ${String(b)}`,
        String(add ? a + b : a - b),
        `q${String(i)}`,
      ),
    )
  }
  const h = harness(questions)
  for (let i = 0; i < 40; i++) {
    const round = h.session.round
    if (!round) break
    dial(h.session, round.demand)
    h.session.commit()
    h.session.advance()
  }
  assert.equal(h.reports.length, 40)
  for (const r of h.reports) {
    assert.match(r.answered, /^\d+$/)
    assert.equal(r.correct, true)
  }
  assert.equal(h.session.exactCuts, 40)
})

test("aim is free and never reaches the host", () => {
  const h = harness([ask(`403 ${MINUS} 87`, "316", "a")])
  for (let i = 0; i < 50; i++) aim(h.session.board, i % 7)
  h.session.crack()
  h.session.crack()
  assert.deepEqual(h.reports, [])
  assert.equal(h.session.answered, 0)
})
