import { test } from "node:test"
import assert from "node:assert/strict"

import { columnOpFamily, exact, nodeById, FORM_FREE_ENTRY } from "./curriculum.ts"
import type { Rational } from "./curriculum.ts"
import { entryModelFor } from "./entry.ts"
import { rungAt, LADDER, LADDER_FORMS, SLATE_COLUMNS } from "./ladder.ts"

// Selection moved to the learner model at M5. What is asserted here is what the
// slice table still is: an ordered list of (skill, level) pairs that the app can
// generate, draw and judge. The scheduler's own behaviour is tested against a
// 72-skill synthetic catalog in `engine/src/select.test.ts`.

test("every pair binds an active skill and a level that skill actually has", () => {
  // `rungOf` throws on construction, so importing the module is most of this
  // test. What is left is the claim that nothing was silently clamped.
  for (const rung of LADDER) {
    const node = nodeById(rung.skillId)
    assert.ok(node !== undefined, `${rung.skillId} is not in the graph`)
    assert.equal(node.status, "active")
    assert.ok(rung.level < node.generator.params.length)
  }
})

test("the slice climbs: item difficulty never goes down a step", () => {
  // `b_item` is the node's own contribution plus the generator's parameter
  // offset, and the two are not interchangeable: `sub(3,3,2,1)` has a *lower*
  // parameter offset than `sub(4,4,2,0)` and is nonetheless the harder item,
  // because borrowing through a zero belongs to a harder skill. Comparing
  // offsets alone would have ordered this ladder wrong and passed.
  let previous: Rational | null = null
  for (const rung of LADDER) {
    const node = nodeById(rung.skillId)
    assert.ok(node !== undefined)
    const b = exact.add(node.difficulty.b, columnOpFamily.difficultyOffset(rung.params))
    if (previous !== null) {
      assert.ok(
        exact.gte(b, previous),
        `rung ${rung.skillId}/${String(rung.level)} is easier than the one before it`,
      )
    }
    // The curriculum states the expected value per level; CG-9 checks it against
    // the params. Asserting against it here means a ladder built on a level the
    // graph does not actually declare fails loudly.
    assert.ok(exact.eq(b, node.difficulty.levels[rung.level] ?? b))
    previous = b
  }
})

test("the slice reaches the across-zero case it exists to test", () => {
  const top = rungAt(LADDER.length - 1)
  assert.equal(top.skillId, "dw.add.regroup.subtract-across-zero")
  assert.ok(top.params.acrossZero >= 2, "the top rung borrows through two zeros")
  assert.equal(top.params.op, "sub")
})

test("every pair the slice can serve has an entry model — the app-side CG-8", () => {
  // A curriculum row the app cannot draw is exactly what CG-8 exists to stop on
  // the curriculum side. This is the same claim from the app's side: a rung
  // whose schema has no registered entry model is a card a child cannot answer.
  for (const rung of LADDER) {
    const schema = columnOpFamily.answerSchema(rung.params, FORM_FREE_ENTRY)
    assert.ok(
      entryModelFor(schema) !== undefined,
      `${rung.skillId}/${String(rung.level)} produces a ${schema.kind} schema with no entry model`,
    )
  }
})

test("the slice asks for one form, and it is the one with a model", () => {
  assert.deepEqual(LADDER_FORMS, [FORM_FREE_ENTRY])
})

test("the slate reservation covers the widest number any pair can write", () => {
  const widest = LADDER.reduce((n, rung) => Math.max(n, rung.params.digits), 0)
  assert.equal(SLATE_COLUMNS, widest)
  assert.equal(SLATE_COLUMNS, 4, "the M2 ladder tops out at four digits")
})
