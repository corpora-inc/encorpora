// The stub host's three promises, which the real runtime also has to keep.

import assert from "node:assert/strict"
import { test } from "node:test"

import { createStubHost } from "../stubHost.ts"

test("the stream is seeded and deterministic, forever", () => {
  const a = createStubHost({ seed: 0x1a771ce })
  const b = createStubHost({ seed: 0x1a771ce })
  for (let i = 0; i < 500; i++) {
    const x = a.next()
    const y = b.next()
    assert.deepEqual(x, y, `question ${i} diverged`)
  }
  const c = createStubHost({ seed: 0x1a771cf })
  assert.notDeepEqual(c.next().prompt, createStubHost({ seed: 0x1a771ce }).next().prompt)
})

test("every operand, answer and distractor is an exact integer", () => {
  for (let seed = 1; seed <= 12; seed++) {
    const host = createStubHost({ seed: seed * 7919 })
    for (let i = 0; i < 400; i++) {
      const q = host.next({ difficulty: 1 + (i % 10) })
      const answer = Number(q.answer)
      assert.ok(Number.isInteger(answer), `${q.prompt} = ${q.answer} is not an integer`)
      assert.equal(String(answer), q.answer, `${q.answer} round-trips badly`)
      for (const d of q.distractors) {
        const value = Number(d)
        assert.ok(Number.isInteger(value), `distractor ${d} for ${q.prompt} is not an integer`)
        assert.notEqual(value, answer, `a distractor for ${q.prompt} equals the answer`)
        assert.ok(value >= 2 && value <= 9999, `distractor ${d} is out of range`)
      }
      // And the prompt says what it means: the operands and the glyph.
      const match = /^(\d+) ([+−]) (\d+)$/.exec(q.prompt)
      assert.ok(match, `unreadable prompt ${q.prompt}`)
      const a = Number(match[1])
      const b = Number(match[3])
      assert.equal(match[2] === "+" ? a + b : a - b, answer, `${q.prompt} ≠ ${q.answer}`)
    }
  }
})

test("distractors are mal-rule outputs, not answer ± 1 noise", () => {
  // The point of a distractor is that a child with a specific broken procedure
  // actually writes it down, so a wrong resonance tells the host *which*
  // mistake. A stream where most distractors sit next to the answer would be
  // noise dressed as diagnosis.
  const host = createStubHost({ seed: 0xd15 })
  let adjacent = 0
  let total = 0
  for (let i = 0; i < 600; i++) {
    const q = host.next()
    const answer = Number(q.answer)
    for (const d of q.distractors) {
      total += 1
      if (Math.abs(Number(d) - answer) === 1) adjacent += 1
    }
  }
  assert.ok(total > 800, `only ${total} distractors in 600 questions`)
  assert.ok(adjacent / total < 0.06, `${adjacent}/${total} distractors were answer ± 1`)
})

test("a dropped carry is actually in there", () => {
  // 27 + 15 with every carry dropped is 32. Whatever else the stub produces,
  // this specific misconception has to be reachable or the diagnosis is empty.
  // Named on the ladder, because a carry needs two columns and the bottom of the
  // ladder is single-digit facts — the very thing THE LATTICE was stuck on.
  const host = createStubHost({ seed: 0xca771, difficulty: 30 / 65 })
  let found = false
  for (let i = 0; i < 3000 && !found; i++) {
    const q = host.next()
    const match = /^(\d+) \+ (\d+)$/.exec(q.prompt)
    if (!match) continue
    const a = Number(match[1])
    const b = Number(match[2])
    if (a % 10 + (b % 10) < 10) continue // no carry to drop
    const dropped = ((a % 10) + (b % 10)) % 10 + (Math.floor(a / 10) + Math.floor(b / 10)) % 10 * 10
    if (q.distractors.includes(String(dropped))) found = true
  }
  assert.ok(found, "no dropped-carry distractor appeared in 3000 questions")
})

test("transition is present only when someone is watching for it", () => {
  // The contract has it optional and the game feature-detects it, so a host
  // without one must be a host the game does not fall over on.
  const bare = createStubHost({ seed: 1 })
  assert.equal(bare.transition, undefined)
  const kinds: string[] = []
  const watched = createStubHost({ seed: 1, onTransition: (k) => kinds.push(k) })
  assert.equal(typeof watched.transition, "function")
  watched.transition?.("level", "resonance")
  assert.deepEqual(kinds, ["level"])
})

test("reduced motion is whatever the host says it is", () => {
  assert.equal(createStubHost({ reducedMotion: true }).prefersReducedMotion(), true)
  assert.equal(createStubHost({ reducedMotion: false }).prefersReducedMotion(), false)
})
