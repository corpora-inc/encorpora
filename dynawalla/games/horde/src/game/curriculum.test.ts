/**
 * Bots, not assertions about arithmetic.
 *
 * Every test here drives the real ledger the game drives — `openQuestion`,
 * `answer`, `closeQuestion`, the sealed cache and the rift all go through
 * `Curriculum` and nothing else in DEEPSWARM calls `host.next` or
 * `host.report`. So a bot that plays badly here is a child playing badly there.
 */

import assert from "node:assert/strict"
import { test } from "node:test"

import type { Host, Question } from "../contract.ts"
import { BASE_THINKING_SECONDS, Curriculum, MAX_DIFFICULTY } from "./curriculum.ts"

type Report = { questionId: string; correct: boolean; ms: number; answered: string }

/** A host that remembers everything it was asked and everything it was told. */
function recordingHost(): {
  host: Host
  asks: number[]
  reports: Report[]
} {
  const asks: number[] = []
  const reports: Report[] = []
  let n = 0
  const host: Host = {
    next(opts) {
      asks.push(opts?.difficulty ?? 0)
      n++
      return {
        id: `q${n}`,
        prompt: `${n} + 1`,
        answer: String(n + 1),
        distractors: [String(n), String(n + 2)],
        domain: "add",
        difficulty: 0.5,
      } satisfies Question
    },
    report(r) {
      reports.push(r)
    },
    haptic() {},
    prefersReducedMotion() {
      return false
    },
  }
  return { host, asks, reports }
}

/**
 * Eleven minutes of DEEPSWARM, roughly. A core opens every ~40 s, a sealed
 * cache lands every third level-up, and a rift asks until it is charged — call
 * it fifty questions in a long run.
 */
const LONG_RUN = 50

test("a bot that answers everything WRONG never climbs past the first rung", () => {
  const { host, asks } = recordingHost()
  const c = new Curriculum()

  for (let i = 0; i < LONG_RUN; i++) {
    const q = c.ask(host)
    c.answered(host, q, q.distractors[0]!, false, 1400)
  }

  // Three-digit addition lives high on the host ladder. This bot must not be
  // anywhere near it: it has demonstrated nothing.
  assert.equal(c.difficulty(), 1, "a run with no right answers must stay on rung 1")
  assert.deepEqual(
    [...new Set(asks)],
    [1],
    "every question in a run with no right answers must be asked at rung 1",
  )
  assert.equal(c.solved, 0)
  assert.equal(c.asked, LONG_RUN)
})

test("a bot that never answers at all never climbs either", () => {
  const { host, asks } = recordingHost()
  const c = new Curriculum()

  for (let i = 0; i < LONG_RUN; i++) {
    c.ask(host)
    c.expired()
  }

  assert.equal(c.difficulty(), 1, "surviving is not an achievement")
  assert.equal(Math.max(...asks), 1)
  assert.equal(c.unanswered, LONG_RUN)
})

test("a bot that answers everything RIGHT climbs, and reaches the top", () => {
  const { host, asks } = recordingHost()
  const c = new Curriculum()

  for (let i = 0; i < LONG_RUN; i++) {
    const q = c.ask(host)
    c.answered(host, q, q.answer, true, 1400)
  }

  assert.equal(c.difficulty(), MAX_DIFFICULTY, "a run that is all right answers must top out")
  assert.equal(asks[0], 1, "it still starts at the bottom")
  assert.ok(
    asks[asks.length - 1]! > asks[0]!,
    "the ladder has to actually move for a child who is getting them right",
  )
})

test("the ladder tracks right answers alone — the clock is not an input", () => {
  const c = new Curriculum()
  assert.equal(c.difficulty(), 1)
  // Six right answers, at whatever pace: three rungs.
  for (let i = 0; i < 6; i++) c.solved++
  assert.equal(c.difficulty(), 4)
  // Two hundred wrong answers and a hundred timeouts change nothing about it.
  c.asked += 300
  c.unanswered += 100
  assert.equal(c.difficulty(), 4, "wrong answers and timeouts must not move the rung")
})

test("a timeout reports NOTHING to the host", () => {
  const { host, reports } = recordingHost()
  const c = new Curriculum()

  const q = c.ask(host)
  c.expired()

  assert.deepEqual(
    reports,
    [],
    "a child who was still computing has told the host nothing; the host must be told nothing",
  )
  // And in particular, not the old payload.
  const filed: Report[] = reports
  assert.equal(
    filed.find((r) => r.questionId === q.id && r.answered === "" && !r.correct),
    undefined,
    "an empty answer marked incorrect is a wrong answer the child never gave",
  )
})

test("an answer — right or wrong — reports the exact payload the host expects", () => {
  const { host, reports } = recordingHost()
  const c = new Curriculum()

  const a = c.ask(host)
  c.answered(host, a, a.answer, true, 1234.6)
  const b = c.ask(host)
  c.answered(host, b, b.distractors[0]!, false, 987.2)

  assert.deepEqual(reports, [
    { questionId: a.id, correct: true, ms: 1235, answered: a.answer },
    { questionId: b.id, correct: false, ms: 987, answered: b.distractors[0]! },
  ])
})

test("the thinking window grows with the ladder and never shrinks", () => {
  const c = new Curriculum()
  const easy = c.thinkingSeconds()
  assert.equal(easy, BASE_THINKING_SECONDS)

  let previous = easy
  for (let i = 0; i < 40; i++) {
    c.solved++
    const now = c.thinkingSeconds()
    assert.ok(now >= previous, `window shrank at ${c.solved} solved: ${previous} -> ${now}`)
    previous = now
  }

  // At the top of the ladder the child has at least the p90 cadence target for
  // two-digit-with-regrouping from EXPERIENCE_DESIGN.md.
  assert.ok(previous >= 14, `top-rung window is ${previous}s, under the 14s p90`)
})

test("the rift asks below what the run has earned, never above", () => {
  const c = new Curriculum()
  for (let i = 0; i < 8; i++) c.solved++
  assert.equal(c.difficulty(), 5)
  assert.equal(c.difficulty(-1), 4)
  // ...and it cannot fall off the bottom.
  const fresh = new Curriculum()
  assert.equal(fresh.difficulty(-1), 1)
})

test("the run panel counts questions the child ANSWERED, not questions it served", () => {
  const { host } = recordingHost()
  const c = new Curriculum()

  for (let i = 0; i < 5; i++) {
    const q = c.ask(host)
    c.answered(host, q, q.answer, true, 1200)
  }
  for (let i = 0; i < 3; i++) {
    c.ask(host)
    c.expired()
  }

  assert.equal(c.asked, 8)
  assert.equal(c.answeredCount, 5, "three cores closed unanswered; they are not answers")
  assert.equal(c.solved, 5)
})
