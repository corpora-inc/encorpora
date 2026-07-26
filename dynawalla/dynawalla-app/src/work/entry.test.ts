import { test } from "node:test"
import assert from "node:assert/strict"

import { exact } from "./curriculum.ts"
import type { AnswerSchema } from "./curriculum.ts"
import { entryModelFor, fieldText, glyphFromKey, integerEntry } from "./entry.ts"

const FOUR_DIGITS: AnswerSchema = { kind: "integer", digits: 4, decimalPlaces: 0 }

function typed(text: string) {
  return text.split("").reduce((state, ch) => {
    const glyph = glyphFromKey(ch)
    assert.ok(glyph !== null)
    return integerEntry.press(state, { kind: "glyph", glyph })
  }, integerEntry.init(FOUR_DIGITS))
}

test("digits accumulate and the field is capped at the schema's width", () => {
  assert.equal(fieldText(typed("2203")), "2203")
  assert.equal(fieldText(typed("22035")), "2203", "a fifth digit is dropped, not wrapped")
})

test("the field width is the schema's, never the answer's", () => {
  // Sizing the field to the answer would tell a child how many digits it has.
  // `answerDigitCapacity` is `digits` for subtraction regardless of whether this
  // item's difference is shorter, and the entry model must not second-guess it.
  const state = integerEntry.init(FOUR_DIGITS)
  assert.equal(state.fields[0]?.maxLength, 4)
})

test("delete removes one digit; clear removes all; neither goes below empty", () => {
  const four = typed("2203")
  assert.equal(fieldText(integerEntry.press(four, { kind: "delete" })), "220")
  assert.equal(fieldText(integerEntry.press(four, { kind: "clear" })), "")
  const empty = integerEntry.init(FOUR_DIGITS)
  assert.equal(integerEntry.press(empty, { kind: "delete" }), empty, "returns the same state, not a copy")
  assert.equal(integerEntry.press(empty, { kind: "clear" }), empty)
})

test("an empty field is not committable; one digit is", () => {
  assert.equal(integerEntry.complete(integerEntry.init(FOUR_DIGITS)), false)
  assert.equal(integerEntry.complete(typed("0")), true)
})

test("the value is exact, and leading zeros are typing rather than arithmetic", () => {
  const value = integerEntry.value(typed("2203"), FOUR_DIGITS)
  assert.deepEqual(value, { kind: "integer", value: exact.rational(2203n) })
  assert.deepEqual(integerEntry.value(typed("0512"), FOUR_DIGITS), {
    kind: "integer",
    value: exact.rational(512n),
  })
  assert.equal(integerEntry.value(integerEntry.init(FOUR_DIGITS), FOUR_DIGITS), null)
})

test("nothing on the entry path is a JavaScript number", () => {
  const value = integerEntry.value(typed("9999"), FOUR_DIGITS)
  assert.ok(value?.kind === "integer")
  assert.equal(typeof value.value.n, "bigint")
  assert.equal(typeof value.value.d, "bigint")
})

test("decimal places ride on the schema and scale the value, without a float", () => {
  // The `decimal` schema is `integer` + the number layer, which is why the model
  // already handles `decimalPlaces` even though no active skill uses it yet.
  const tenths: AnswerSchema = { kind: "integer", digits: 3, decimalPlaces: 1 }
  const state = ["3", "5"].reduce(
    (s, ch) => integerEntry.press(s, { kind: "glyph", glyph: glyphFromKey(ch)! }),
    integerEntry.init(tenths),
  )
  assert.deepEqual(integerEntry.value(state, tenths), {
    kind: "integer",
    value: exact.rational(7n, 2n),
  })
})

test("the keypad layout comes from the model, in calculator order", () => {
  const caps = integerEntry.keys(FOUR_DIGITS)
  assert.equal(caps.length, 12, "three columns, four rows")
  assert.deepEqual(
    caps.map((cap) => (cap.kind === "glyph" ? cap.glyph : cap.kind)),
    ["7", "8", "9", "4", "5", "6", "1", "2", "3", "blank", "0", "delete"],
  )
})

test("no key commits — committing is a separate, explicit action", () => {
  for (const cap of integerEntry.keys(FOUR_DIGITS)) {
    assert.notEqual(cap.kind, "commit")
  }
})

test("the registry knows what it can draw, and admits what it cannot", () => {
  assert.equal(entryModelFor(FOUR_DIGITS), integerEntry)
  assert.equal(
    entryModelFor({ kind: "columnAlgorithm", cols: 4, marks: "borrow", decimalPlaces: 0 }),
    undefined,
    "the borrow grid is PR-2.4; claiming it here would serve an unanswerable card",
  )
  assert.equal(entryModelFor({ kind: "fraction", parts: ["num", "den"] }), undefined)
  assert.equal(entryModelFor({ kind: "choice", k: 4 }), undefined)
})

test("the keyboard and the keypad go through one path", () => {
  assert.deepEqual(glyphFromKey("7"), "7")
  assert.equal(glyphFromKey("Enter"), null)
  assert.equal(glyphFromKey("e"), null)
  assert.equal(glyphFromKey("."), null)
})
