import { test } from "node:test"
import assert from "node:assert/strict"
import { createStubHost } from "./stubHost.ts"

const DOMAINS = ["compare", "add", "multiply", "subtract", "multiples", "divide", "factors"]

test("the stub host is deterministic for a seed", () => {
  const a = createStubHost({ seed: 4242 })
  const b = createStubHost({ seed: 4242 })
  for (let i = 0; i < 200; i++) {
    const qa = a.next({ difficulty: 1 + (i % 10) })
    const qb = b.next({ difficulty: 1 + (i % 10) })
    assert.deepEqual(qa, qb)
  }
})

test("every answer is an exact integer and no float ever reaches a question", () => {
  const h = createStubHost({ seed: 7 })
  for (let i = 0; i < 4000; i++) {
    const q = h.next({ difficulty: 1 + (i % 10) })
    const n = Number(q.answer)
    assert.ok(Number.isInteger(n), `answer "${q.answer}" is not an integer (${q.prompt})`)
    assert.ok(n > 0, `answer "${q.answer}" is not positive (${q.prompt})`)
    assert.equal(String(n), q.answer, "the answer string must be the canonical integer")
    for (const d of q.distractors) {
      const dn = Number(d)
      assert.ok(Number.isInteger(dn), `distractor "${d}" is not an integer (${q.prompt})`)
      assert.equal(String(dn), d)
    }
  }
})

test("a question always offers exactly three distinct wrong answers", () => {
  const h = createStubHost({ seed: 11 })
  for (let i = 0; i < 4000; i++) {
    const q = h.next({ difficulty: 1 + (i % 10) })
    assert.equal(q.distractors.length, 3, `wrong distractor count for ${q.prompt}`)
    const set = new Set(q.distractors)
    assert.equal(set.size, 3, `duplicate distractors for ${q.prompt}: ${q.distractors.join(",")}`)
    assert.ok(!set.has(q.answer), `the answer appeared as a distractor for ${q.prompt}`)
  }
})

test("the arithmetic in every prompt actually checks out", () => {
  const h = createStubHost({ seed: 13 })
  for (let i = 0; i < 4000; i++) {
    const q = h.next({ difficulty: 1 + (i % 10) })
    const a = Number(q.answer)
    let m: RegExpMatchArray | null
    if ((m = q.prompt.match(/^(\d+) × (\d+)$/))) {
      assert.equal(a, Number(m[1]) * Number(m[2]), q.prompt)
    } else if ((m = q.prompt.match(/^(\d+) \+ (\d+)$/))) {
      assert.equal(a, Number(m[1]) + Number(m[2]), q.prompt)
    } else if ((m = q.prompt.match(/^(\d+) − (\d+)$/))) {
      assert.equal(a, Number(m[1]) - Number(m[2]), q.prompt)
    } else if ((m = q.prompt.match(/^(\d+) ÷ (\d+)$/))) {
      const x = Number(m[1])
      const y = Number(m[2])
      assert.equal(x % y, 0, `${q.prompt} is not an exact division`)
      assert.equal(a, x / y, q.prompt)
    } else if ((m = q.prompt.match(/^factor of (\d+)$/))) {
      assert.equal(Number(m[1]) % a, 0, `${a} is not a factor of ${m[1]}`)
      for (const d of q.distractors) {
        assert.notEqual(Number(m[1]) % Number(d), 0, `${d} IS a factor of ${m[1]} but is a distractor`)
      }
    } else if ((m = q.prompt.match(/^multiple of (\d+)$/))) {
      assert.equal(a % Number(m[1]), 0, `${a} is not a multiple of ${m[1]}`)
      for (const d of q.distractors) {
        assert.notEqual(Number(d) % Number(m[1]), 0, `${d} IS a multiple of ${m[1]} but is a distractor`)
      }
    } else if ((m = q.prompt.match(/^less than (\d+)$/))) {
      assert.ok(a < Number(m[1]), `${a} is not less than ${m[1]}`)
      for (const d of q.distractors) {
        assert.ok(Number(d) >= Number(m[1]), `${d} IS less than ${m[1]} but is a distractor`)
      }
    } else {
      assert.fail(`unrecognised prompt shape: ${q.prompt}`)
    }
  }
})

test("distractors are mal-rule outputs, not noise — they cluster near the answer", () => {
  const h = createStubHost({ seed: 17 })
  let near = 0
  let total = 0
  for (let i = 0; i < 2000; i++) {
    const q = h.next({ difficulty: 5 })
    const a = Number(q.answer)
    for (const d of q.distractors) {
      total++
      // A real procedural bug lands in the neighbourhood of the right answer.
      // Random noise does not.
      if (Math.abs(Number(d) - a) <= Math.max(12, a * 0.6)) near++
    }
  }
  assert.ok(near / total > 0.75, `only ${((near / total) * 100).toFixed(0)}% of distractors were plausible`)
})

test("difficulty widens the pool and is clamped to 1..10", () => {
  const h = createStubHost({ seed: 23 })
  const easy = new Set<string>()
  const hard = new Set<string>()
  for (let i = 0; i < 800; i++) easy.add(h.next({ difficulty: -99 }).domain)
  for (let i = 0; i < 800; i++) hard.add(h.next({ difficulty: 999 }).domain)
  assert.ok(easy.size < hard.size, "a higher difficulty should unlock more domains")
  for (const d of hard) assert.ok(DOMAINS.includes(d), `unknown domain ${d}`)
})

test("a requested domain is honoured", () => {
  const h = createStubHost({ seed: 29 })
  for (const domain of DOMAINS) {
    for (let i = 0; i < 60; i++) {
      assert.equal(h.next({ domain, difficulty: 8 }).domain, domain)
    }
  }
})

test("haptics and reduced-motion are silent no-ops without a platform", () => {
  const h = createStubHost({ seed: 31 })
  assert.doesNotThrow(() => h.haptic("success"))
  assert.doesNotThrow(() => h.haptic("failure"))
  assert.equal(typeof h.prefersReducedMotion(), "boolean")
})
