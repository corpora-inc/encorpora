import { test } from "node:test"
import assert from "node:assert/strict"

import { Rng } from "../core/rng.ts"
import { createStubHost } from "../stubHost.ts"
import { buildCore, columnMalRules, reverseDigits, type CoreSource } from "../sim/core.ts"
import { beamDivisors, resonates, usableCoreValue } from "../sim/lattice.ts"

const BEAMS = 5

function harvest(seed: number, n: number) {
  const rng = new Rng(seed)
  const host = createStubHost({ seed: seed ^ 0x5151, reducedMotion: false })
  const waves = []
  let attempts = 0
  while (waves.length < n && attempts < n * 20) {
    attempts++
    const q = host.next({ difficulty: 1 + (attempts % 10) })
    const built = buildCore(
      { id: q.id, prompt: q.prompt, answer: q.answer, distractors: q.distractors },
      BEAMS,
      () => rng.next(),
    )
    if (built) waves.push({ q, built })
  }
  return waves
}

test("every wave the game builds can be answered on the lattice it was built with", () => {
  const waves = harvest(0xc0de, 1500)
  assert.ok(waves.length >= 1500, `only built ${waves.length} waves`)
  for (const { q, built } of waves) {
    assert.equal(built.beams.length, BEAMS)
    assert.equal(new Set(built.beams).size, BEAMS)
    assert.equal(String(built.answer), q.answer, "the canonical value came from the host, unchanged")
    // THE POINT: the answer is always killable. A question you cannot hand in
    // is not a question, and this is the invariant that makes the divisibility
    // gate a lock on the trigger rather than a wall.
    assert.ok(
      built.beams.some((b) => resonates(b, built.answer)),
      `no beam in ${built.beams.join(",")} divides the answer ${built.answer}`,
    )
  }
})

test("every candidate on screen is killable, and only from a beam that divides it", () => {
  for (const { built } of harvest(0xfeed, 1200)) {
    for (const c of built.candidates) {
      const valid = built.beams.filter((b) => resonates(b, c.value))
      assert.ok(valid.length > 0, `candidate ${c.value} cannot be taken from any beam`)
      for (const b of built.beams) {
        assert.equal(
          valid.includes(b),
          c.value % b === 0,
          `beam ${b} vs candidate ${c.value}: the kill rule was not the whole story`,
        )
      }
    }
  }
})

test("exactly one candidate is canonical, and it is the host's value", () => {
  for (const { built } of harvest(0xbeef, 1200)) {
    const correct = built.candidates.filter((c) => c.correct)
    assert.equal(correct.length, 1, `${built.prompt} produced ${correct.length} correct candidates`)
    assert.equal((correct[0] as { value: number }).value, built.answer)
    const values = built.candidates.map((c) => c.value)
    assert.equal(new Set(values).size, values.length, "duplicate candidates")
    assert.ok(values.length >= 2, "a single candidate is not a choice")
    assert.ok(values.length <= 4, "more than four candidates does not fit the lattice")
  }
})

test("no beam label prints a candidate's number back at the child", () => {
  for (const { built } of harvest(0x1234, 1500)) {
    for (const c of built.candidates) {
      assert.ok(
        !built.beams.includes(c.value),
        `beam ${c.value} is also a candidate — that is glyph matching, not division`,
      )
    }
  }
})

test("the answer is not always in the same place", () => {
  const waves = harvest(0x777, 900)
  const at = [0, 0, 0, 0]
  for (const { built } of waves) {
    const i = built.candidates.findIndex((c) => c.correct)
    at[i] = (at[i] as number) + 1
  }
  assert.ok((at[0] as number) / waves.length < 0.45, "the answer sits first too often")
  assert.ok((at[1] as number) > 0 && (at[2] as number) > 0, "the answer never reaches the later slots")
})

test("an item whose answer no readable beam divides is passed over, not faked", () => {
  const rng = new Rng(3)
  for (const prime of ["83", "97", "101", "211", "169", "221"]) {
    const src: CoreSource = {
      id: "q",
      prompt: `x + y`,
      answer: prime,
      distractors: ["84", "96", "100"],
    }
    assert.equal(buildCore(src, BEAMS, () => rng.next()), null, `${prime} should be passed over`)
    assert.equal(usableCoreValue(Number(prime)), false)
  }
})

test("a malformed item never becomes a wave", () => {
  const rng = new Rng(11)
  for (const answer of ["", "abc", "0", "1", "-12", "4.5", "12345"]) {
    const src: CoreSource = { id: "q", prompt: "p", answer, distractors: ["84", "96"] }
    assert.equal(buildCore(src, BEAMS, () => rng.next()), null, `answer "${answer}"`)
  }
})

test("thin distractor sets are topped up with mal-rules, never with noise", () => {
  // Every host distractor here is prime, so none of them survives the lattice
  // and the top-up path is the only thing that can produce a second candidate.
  const rng = new Rng(0x5150)
  const built = buildCore(
    { id: "q", prompt: "40 + 44", answer: "84", distractors: ["83", "97", "101"] },
    BEAMS,
    () => rng.next(),
  )
  assert.ok(built, "a wave should still have been built")
  assert.ok(built.candidates.length >= 2)
  const wrong = built.candidates.filter((c) => !c.correct).map((c) => c.value)
  const legal = new Set(columnMalRules(84))
  for (const v of wrong) {
    assert.ok(legal.has(v), `${v} is not a column-arithmetic mal-rule output`)
    // And in particular: never the off-by-one that teaches nothing.
    assert.notEqual(Math.abs(v - 84), 1)
  }
})

test("the mal-rules are the procedures children actually run", () => {
  assert.deepEqual(columnMalRules(342), [332, 352, 242, 442, 243])
  assert.equal(reverseDigits(63), 36)
  assert.equal(reverseDigits(100), 1)
  assert.equal(reverseDigits(7), 7)
})

test("a wave is deterministic for a seed", () => {
  const src: CoreSource = {
    id: "q1",
    prompt: "247 + 158",
    answer: "405",
    distractors: ["395", "415", "504"],
  }
  const ra = new Rng(99)
  const rb = new Rng(99)
  assert.deepEqual(
    buildCore(src, BEAMS, () => ra.next()),
    buildCore(src, BEAMS, () => rb.next()),
  )
})

test("the drop rate is small enough that the child is never left waiting", () => {
  // The game draws up to eight items looking for one the lattice can be tuned
  // to. If the pass-over rate were high that budget would run out on screen.
  const rng = new Rng(0xaaa)
  const host = createStubHost({ seed: 0xbbb })
  let ok = 0
  const N = 4000
  for (let i = 0; i < N; i++) {
    const q = host.next({ difficulty: 1 + (i % 10) })
    const built = buildCore(
      { id: q.id, prompt: q.prompt, answer: q.answer, distractors: q.distractors },
      BEAMS,
      () => rng.next(),
    )
    if (built) ok++
  }
  const rate = ok / N
  assert.ok(rate > 0.7, `only ${(rate * 100).toFixed(1)}% of items could be put on a lattice`)
  // Eight independent draws at this rate miss less than once in a million.
  assert.ok(Math.pow(1 - rate, 8) < 1e-4)
})

test("every value a wave puts on screen has a divisor in the readable range", () => {
  for (const { built } of harvest(0x2468, 800)) {
    for (const c of built.candidates) {
      assert.ok(beamDivisors(c.value).length > 0, `${c.value} is unreachable on any lattice`)
    }
  }
})
