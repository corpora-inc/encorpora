// The dev harness's host has to lie about nothing, or the harness hides defects
// instead of finding them.
//
// Four properties, each matching something the real runtime does:
//
//   1. exact integer arithmetic, everywhere;
//   2. seeded and deterministic;
//   3. both difficulty scales read the way `packs/shared/game-host` reads them, and
//      `maxDifficulty` honoured as a ceiling;
//   4. distractors that are real mal-rule outputs rather than `answer ± 1` noise.

import assert from "node:assert/strict"
import { test } from "node:test"

import { createStubHost, toUnit } from "../stubHost.ts"

const SEEDS = [0x1, 0xbeef, 0x2718, 0x5eed1ce]

test("every operand, answer and distractor is an exact integer", () => {
  for (const seed of SEEDS) {
    const host = createStubHost({ seed })
    for (let i = 0; i < 400; i++) {
      const q = host.next({ difficulty: 1 + (i % 10) })
      const parts = q.prompt.split(/\s+/)
      assert.equal(parts.length, 3, `a prompt that is not "a op b": ${q.prompt}`)
      for (const side of [parts[0], parts[2]]) {
        assert.match(side ?? "", /^\d+$/, `a non-integer operand in ${q.prompt}`)
      }
      assert.match(parts[1] ?? "", /^[+−×]$/, `an unknown operator in ${q.prompt}`)
      assert.match(q.answer, /^\d+$/, `a non-integer answer: ${q.answer}`)
      const [a, op, b] = parts as [string, string, string]
      const expected =
        op === "+" ? Number(a) + Number(b) : op === "−" ? Number(a) - Number(b) : Number(a) * Number(b)
      assert.equal(Number(q.answer), expected, `${q.prompt} was answered ${q.answer}`)
      for (const d of q.distractors) {
        assert.match(d, /^\d+$/)
        assert.notEqual(d, q.answer, "a distractor equal to the answer")
      }
      assert.equal(new Set(q.distractors).size, q.distractors.length)
    }
  }
})

test("the same seed serves the same stream, forever", () => {
  const stream = (seed: number) => {
    const host = createStubHost({ seed })
    return Array.from({ length: 60 }, (_, i) => host.next({ difficulty: 1 + (i % 10) })).map(
      (q) => `${q.prompt}=${q.answer}@${q.difficulty.toFixed(3)}`,
    )
  }
  assert.deepEqual(stream(0x2718), stream(0x2718))
  assert.notDeepEqual(stream(0x2718), stream(0xbeef))
})

test("the two difficulty scales are read the way the real host reads them", () => {
  // Under 1 is a fraction; 1..10 is a ladder index; exactly 1 is the BOTTOM, which is
  // the one value the two scales disagree about.
  assert.equal(toUnit(0), 0)
  assert.equal(toUnit(0.5), 0.5)
  assert.equal(toUnit(1), 0)
  assert.equal(toUnit(10), 1)
  assert.equal(toUnit(40), 1)
  assert.equal(toUnit(Number.NaN), null)
  assert.equal(toUnit(undefined), null)
})

test("a ceiling is a ceiling: the stream never goes above it again", () => {
  const host = createStubHost({ seed: 0x1 })
  for (let i = 0; i < 20; i++) host.next({ difficulty: 10 })
  const above = host.next({ difficulty: 10 })
  assert.ok(above.difficulty > 0.9)
  // Ask for the top with a ceiling in the middle, and keep asking for the top.
  const capped = host.next({ difficulty: 10, maxDifficulty: 1 + 0.4 * 9 })
  assert.ok(capped.difficulty <= 0.4 + 1e-9, `served ${String(capped.difficulty)} under a 0.4 ceiling`)
  for (let i = 0; i < 40; i++) {
    assert.ok(host.next({ difficulty: 10 }).difficulty <= 0.4 + 1e-9, "the ceiling was forgotten")
  }
})

test("harder rungs really are harder, and the easiest rung is single digits", () => {
  const host = createStubHost({ seed: 0x2718 })
  const spread = (ladder: number) => {
    let total = 0
    for (let i = 0; i < 200; i++) total += Number(host.next({ difficulty: ladder }).answer)
    return total / 200
  }
  const easy = spread(1)
  const hard = spread(10)
  assert.ok(hard > easy * 4, `the top of the ladder averages ${hard.toFixed(0)} against ${easy.toFixed(0)}`)
  assert.ok(easy < 40, `the easiest rung averages ${easy.toFixed(0)} — that is not where a child starts`)
})

test("a distractor is a mistake a child makes, not noise around the answer", () => {
  // Not a strong claim about every value — it is a stub — but a stub whose distractors
  // were all `answer ± 1` would make any test of a board's confusability meaningless.
  const host = createStubHost({ seed: 0x5eed1ce })
  let near = 0
  let total = 0
  for (let i = 0; i < 300; i++) {
    const q = host.next({ difficulty: 6 })
    for (const d of q.distractors) {
      total++
      if (Math.abs(Number(d) - Number(q.answer)) <= 2) near++
    }
  }
  assert.ok(total > 600)
  assert.ok(near / total < 0.5, `${((100 * near) / total).toFixed(0)}% of distractors are answer ± 2`)
})

test("skip and transition are wired, because the game calls both", () => {
  const skips: string[] = []
  const transitions: string[] = []
  const host = createStubHost({
    seed: 1,
    onSkip: (id) => skips.push(id),
    onTransition: (kind) => transitions.push(kind),
  })
  host.skip?.("stub-1")
  host.transition?.("level", "consignment 1")
  assert.deepEqual(skips, ["stub-1"])
  assert.deepEqual(transitions, ["level"])
})
