import { test } from "node:test"
import assert from "node:assert/strict"

import { answerAccepted, answerEquals, exact, fractionRational } from "./curriculum.ts"
import type { AnswerSchema, AnswerValue, ChoiceOption } from "./curriculum.ts"
import {
  choiceEntry,
  columnDigitId,
  columnDigits,
  columnEntry,
  columnMarkId,
  decimalCapacity,
  entryKeyFromKeyboard,
  entryModelFor,
  fieldText,
  fractionEntry,
  glyphFromKey,
  integerEntry,
  namedFieldText,
  DECIMAL_SEPARATOR,
  DRAWABLE_SCHEMA_KINDS,
  FIELD_DEN,
  FIELD_NUM,
  FIELD_WHOLE,
} from "./entry.ts"
import type { EntryModel, EntryState } from "./entry.ts"
import { writeDecimal, writeFraction, writeLinePosition, MIXED_GAP } from "./notation.ts"

const FOUR_DIGITS: AnswerSchema = { kind: "integer", digits: 4, decimalPlaces: 0 }

/** Type a run of characters through the keyboard path, the way a child does. */
function type(model: EntryModel, schema: AnswerSchema, text: string, from?: EntryState): EntryState {
  return text.split("").reduce((state, character) => {
    const key = entryKeyFromKeyboard(character)
    assert.ok(key !== null, `no entry key for ${JSON.stringify(character)}`)
    return model.press(state, key)
  }, from ?? model.init(schema))
}

function typed(text: string) {
  return type(integerEntry, FOUR_DIGITS, text)
}

// ── integer ─────────────────────────────────────────────────────────────────

test("digits accumulate and the field is capped at the schema's width", () => {
  assert.equal(fieldText(typed("2203")), "2203")
  assert.equal(fieldText(typed("22035")), "2203", "a fifth digit is dropped, not wrapped")
})

test("a key the field cannot take is counted, so the surface can say so", () => {
  // The one rejection a child can neither see nor infer. On `95 − 19` the cap is
  // two, so 9 · 7 · 6 left "97" and the 6 vanished. Transient status text is
  // forbidden, so the count drives a colour tick on the answer rule — a count,
  // not a flag, because a flag already `true` cannot say "again".
  const twoDigits: AnswerSchema = { kind: "integer", digits: 2, decimalPlaces: 0 }

  let state = type(integerEntry, twoDigits, "97")
  assert.equal(fieldText(state), "97")
  assert.equal(state.rebuffed, 0, "nothing was refused yet")

  const full = state
  state = type(integerEntry, twoDigits, "6", state)
  assert.equal(fieldText(state), "97", "the digit is still dropped, not wrapped")
  assert.notEqual(state, full, "the refusal returned the identical state and the slate cannot see it")
  assert.equal(state.rebuffed, 1)
  assert.equal(type(integerEntry, twoDigits, "5", state).rebuffed, 2, "consecutive refusals differ")

  // Refusals that *are* visible on the face of the field stay silent.
  const empty = integerEntry.init(twoDigits)
  assert.equal(integerEntry.press(empty, { kind: "delete" }), empty)
  assert.equal(integerEntry.press(empty, { kind: "clear" }), empty)
})

test("the field width is the schema's, never the answer's", () => {
  // Sizing the field to the answer would tell a child how many digits it has.
  // `answerDigitCapacity` is `digits` for subtraction however short this item's
  // difference is, and the entry model must not second-guess it.
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

// ── decimal, which is the integer schema plus a separator ───────────────────

const TENTHS: AnswerSchema = { kind: "integer", digits: 3, decimalPlaces: 1 }
const HUNDREDTHS: AnswerSchema = { kind: "integer", digits: 4, decimalPlaces: 2 }

test("a decimal schema splits its digit capacity, and keeps a whole column", () => {
  // `digits` is the total, decimal digits included, so the whole part is what is
  // left — floored at one, since a decimal is written `0.75` and never `.75`.
  assert.deepEqual(decimalCapacity({ kind: "integer", digits: 3, decimalPlaces: 1 }), {
    whole: 2,
    places: 1,
  })
  assert.deepEqual(decimalCapacity({ kind: "integer", digits: 2, decimalPlaces: 2 }), {
    whole: 1,
    places: 2,
  })
  assert.deepEqual(decimalCapacity({ kind: "integer", digits: 4, decimalPlaces: 0 }), {
    whole: 4,
    places: 0,
  })
})

test("the separator is a key, and a child writes 31.5 by writing 31.5", () => {
  // It used to be a position the app filled in: `value()` scaled whatever was
  // typed by `decimalPlaces`, so a child who meant `3.5` had to type `35`, one
  // who meant thirty-five typed the same two keys, and both were "right".
  const state = type(integerEntry, TENTHS, "31.5")
  assert.equal(fieldText(state), "31.5")
  assert.deepEqual(integerEntry.value(state, TENTHS), {
    kind: "integer",
    value: exact.rational(63n, 2n),
  })

  const whole = type(integerEntry, TENTHS, "35")
  assert.deepEqual(
    integerEntry.value(whole, TENTHS),
    { kind: "integer", value: exact.rational(35n) },
    "two digits with no separator is thirty-five, which is what was written",
  )
})

test("one separator, only where there are places for one", () => {
  const twice = type(integerEntry, TENTHS, "3.1.5")
  assert.equal(fieldText(twice), "3.15", "the second separator never lands")
  assert.ok(twice.rebuffed > 0, "and the refusal is counted, because it is invisible")

  // A whole-number schema has no separator at all: the field is exactly its
  // digit capacity, so a separator would have to displace a digit.
  const whole = type(integerEntry, FOUR_DIGITS, "2.3")
  assert.equal(fieldText(whole), "23")
  assert.equal(whole.rebuffed, 1)
})

test("a lone separator is not an answer", () => {
  const bare = type(integerEntry, TENTHS, ".")
  assert.equal(integerEntry.complete(bare), false)
  assert.equal(integerEntry.value(bare, TENTHS), null)
  // …but a separator with a digit after it is: `.5` is one half, written the way
  // a child writes it.
  const half = type(integerEntry, TENTHS, ".5")
  assert.equal(integerEntry.complete(half), true)
  assert.deepEqual(integerEntry.value(half, TENTHS), { kind: "integer", value: exact.rational(1n, 2n) })
  // And a trailing separator is the number in front of it.
  assert.deepEqual(integerEntry.value(type(integerEntry, TENTHS, "3."), TENTHS), {
    kind: "integer",
    value: exact.rational(3n),
  })
})

test("format → parse is the identity, over every decimal the schemas can write", () => {
  // The property the number layer will be built on, so it is asserted over a
  // table. `writeDecimal` is what a surface shows; typing what it shows must
  // produce the number it came from.
  const cases: readonly (readonly [AnswerSchema, string, number])[] = [
    [TENTHS, "31.5", 1],
    [TENTHS, "0.5", 1],
    [TENTHS, "99.9", 1],
    [HUNDREDTHS, "12.75", 2],
    [HUNDREDTHS, "0.05", 2],
    [HUNDREDTHS, "1.00", 2],
    [FOUR_DIGITS, "2203", 0],
  ]
  for (const [schema, written, places] of cases) {
    const value = integerEntry.value(type(integerEntry, schema, written), schema)
    assert.ok(value?.kind === "integer", `${written} did not parse`)
    assert.equal(writeDecimal(value.value, places), written, `${written} did not survive the round trip`)
  }
})

test("a trailing zero is notation, and both writings are the same answer", () => {
  // The one equivalence a decimal gets for free, and it is free because the
  // value is a normalised `Rational`.
  const short = integerEntry.value(type(integerEntry, HUNDREDTHS, "3.5"), HUNDREDTHS)
  const long = integerEntry.value(type(integerEntry, HUNDREDTHS, "3.50"), HUNDREDTHS)
  assert.ok(short !== null && long !== null)
  assert.ok(answerEquals(short, long))
})

test("the separator has a key on a decimal pad and no key on a whole-number one", () => {
  const decimal = integerEntry.keys(TENTHS)
  const whole = integerEntry.keys(FOUR_DIGITS)
  assert.equal(decimal.length, whole.length, "the pad does not change size between rungs")
  assert.deepEqual(
    decimal.map((cap) => (cap.kind === "glyph" ? cap.glyph : cap.kind)),
    ["7", "8", "9", "4", "5", "6", "1", "2", "3", DECIMAL_SEPARATOR, "0", "delete"],
  )
  assert.deepEqual(
    whole.map((cap) => (cap.kind === "glyph" ? cap.glyph : cap.kind)),
    ["7", "8", "9", "4", "5", "6", "1", "2", "3", "blank", "0", "delete"],
  )
})

// ── fraction ────────────────────────────────────────────────────────────────

const FRACTION: AnswerSchema = { kind: "fraction", parts: ["num", "den"] }
const MIXED: AnswerSchema = { kind: "fraction", parts: ["whole", "num", "den"] }
const LOOSE: AnswerSchema = { kind: "fraction", parts: ["num", "den"], equivalence: "any-equivalent" }

test("a fraction is two fields, a mixed number three, in writing order", () => {
  assert.deepEqual(
    fractionEntry.init(FRACTION).fields.map((field) => field.id),
    [FIELD_NUM, FIELD_DEN],
  )
  assert.deepEqual(
    fractionEntry.init(MIXED).fields.map((field) => field.id),
    [FIELD_WHOLE, FIELD_NUM, FIELD_DEN],
    "the whole number stands in front of the fraction, not after it",
  )
  // `parts` is a set, not a sequence: the other order is the same fraction.
  assert.deepEqual(
    fractionEntry.init({ kind: "fraction", parts: ["den", "num"] }).fields.map((field) => field.id),
    [FIELD_NUM, FIELD_DEN],
  )
})

test("the fraction bar key moves to the denominator, from a keyboard or the pad", () => {
  const state = type(fractionEntry, FRACTION, "3/4")
  assert.equal(namedFieldText(state, FIELD_NUM), "3")
  assert.equal(namedFieldText(state, FIELD_DEN), "4")
  assert.deepEqual(fractionEntry.value(state, FRACTION), { kind: "fraction", num: 3n, den: 4n })

  // …and the pad's key is the same key. `advance` wraps, so overshooting comes
  // back round rather than sticking at the end.
  const wrapped = fractionEntry.press(state, { kind: "advance" })
  assert.equal(wrapped.focus, 0)
})

test("a mixed number is written whole, then numerator, then denominator", () => {
  const state = type(fractionEntry, MIXED, "2/1/3")
  assert.deepEqual(fractionEntry.value(state, MIXED), { kind: "fraction", num: 1n, den: 3n, whole: 2n })
  assert.deepEqual(fractionRational({ kind: "fraction", num: 1n, den: 3n, whole: 2n }), exact.rational(7n, 3n))
})

test("a negative mixed number is two and a third *below* zero", () => {
  // The naive `whole + num/den` is right for every V1 item — elementary
  // fractions are non-negative — and silently wrong the first time integers
  // arrive. −2 1/3 is −7/3, not −5/3.
  assert.deepEqual(
    fractionRational({ kind: "fraction", num: 1n, den: 3n, whole: -2n }),
    exact.rational(-7n, 3n),
  )
})

test("a whole part left empty is the fraction, not a zero a child must write", () => {
  const state = type(fractionEntry, MIXED, "/3/4")
  assert.equal(fractionEntry.complete(state), true)
  assert.deepEqual(fractionEntry.value(state, MIXED), { kind: "fraction", num: 3n, den: 4n })
})

test("a fraction with no denominator is not a number, so it cannot be committed", () => {
  const half = type(fractionEntry, FRACTION, "1")
  assert.equal(fractionEntry.complete(half), false, "the Check plate is off, not the answer wrong")
  assert.equal(fractionEntry.value(half, FRACTION), null)
})

test("zero is refused as a denominator at the value, never at the key", () => {
  // A child part-way through typing `2/05` has a bare `0` for one keystroke, and
  // refusing the key would make the field un-typeable.
  const zero = type(fractionEntry, FRACTION, "2/0")
  assert.equal(namedFieldText(zero, FIELD_DEN), "0", "the key landed")
  assert.equal(fractionEntry.value(zero, FRACTION), null, "and 2/0 is not a number")
  const fifth = type(fractionEntry, FRACTION, "5", zero)
  assert.deepEqual(fractionEntry.value(fifth, FRACTION), { kind: "fraction", num: 2n, den: 5n })
})

test("a full field carries the next digit on; the last refuses it", () => {
  const long = type(fractionEntry, FRACTION, "12345")
  assert.equal(namedFieldText(long, FIELD_NUM), "1234")
  assert.equal(namedFieldText(long, FIELD_DEN), "5", "the fifth digit went where the hand was going")

  const full = type(fractionEntry, FRACTION, "1234/12345")
  assert.equal(namedFieldText(full, FIELD_DEN), "1234")
  assert.ok(full.rebuffed > 0, "the denominator has nowhere to pass it to, so it says so")
})

test("2/4 is written down as 2/4, and whether it counts is the schema's decision", () => {
  // Why `AnswerValue.fraction` keeps the *written* numerator and denominator:
  // simplifying here would make it impossible to teach simplifying.
  const quarters = fractionEntry.value(type(fractionEntry, FRACTION, "2/4"), FRACTION)
  const half: AnswerValue = { kind: "fraction", num: 1n, den: 2n }
  assert.deepEqual(quarters, { kind: "fraction", num: 2n, den: 4n })
  assert.ok(quarters !== null)

  assert.equal(answerAccepted(FRACTION, half, quarters), false, "as written, 2/4 is not 1/2")
  assert.equal(answerAccepted(LOOSE, half, quarters), true, "and on a skill that says so, it is")
  // Never across kinds. A fraction card draws a fraction entry, so the question
  // cannot arise from the surface, and a skill that wants both notations lists
  // the second in `alsoAccept` where the curriculum can see it.
  const decimal: AnswerValue = { kind: "integer", value: exact.rational(1n, 2n) }
  assert.equal(answerAccepted(LOOSE, half, decimal), false)
})

test("clear empties the whole fraction, not the field the focus happens to be on", () => {
  const state = type(fractionEntry, MIXED, "2/1/3")
  const cleared = fractionEntry.press(state, { kind: "clear" })
  assert.deepEqual(
    cleared.fields.map((field) => field.text),
    ["", "", ""],
    "half a cleared fraction is a state a child did not ask for and cannot read",
  )
})

// ── choice ──────────────────────────────────────────────────────────────────

const OPTIONS: readonly ChoiceOption[] = [
  { kind: "fraction", num: 1n, den: 2n },
  { kind: "fraction", num: 1n, den: 3n },
  { kind: "number", value: exact.rational(3n, 4n), decimalPlaces: 2 },
]
const CHOICE: AnswerSchema = { kind: "choice", k: 3, options: OPTIONS }

test("a choice is answered by pointing at it, and there is no keypad under it", () => {
  assert.deepEqual(choiceEntry.keys(CHOICE), [], "a numeric pad invites an answer that is not on the list")
  const state = choiceEntry.press(choiceEntry.init(CHOICE), { kind: "focus", field: 1 })
  assert.equal(choiceEntry.complete(state), true)
  assert.deepEqual(choiceEntry.value(state, CHOICE), { kind: "choice", index: 1 })
})

test("choosing again replaces it; delete unmakes it", () => {
  let state = choiceEntry.press(choiceEntry.init(CHOICE), { kind: "focus", field: 2 })
  state = choiceEntry.press(state, { kind: "focus", field: 0 })
  assert.deepEqual(choiceEntry.value(state, CHOICE), { kind: "choice", index: 0 })
  state = choiceEntry.press(state, { kind: "delete" })
  assert.equal(choiceEntry.complete(state), false)
  assert.equal(choiceEntry.value(state, CHOICE), null)
})

test("an index no option corresponds to is not an answer", () => {
  // Not reachable through the surface; reachable through a stale state and a
  // re-rendered card, and judged silently against whichever option the checker
  // happened to hold.
  const state = choiceEntry.press(choiceEntry.init(CHOICE), { kind: "focus", field: 7 })
  assert.equal(choiceEntry.value(state, CHOICE), null)
})

test("a choice schema carrying the wrong number of options is refused outright", () => {
  // `k` and the drawn list are two statements of one fact; a renderer trusting
  // `k` would draw four boxes over three options.
  assert.throws(
    () => choiceEntry.init({ kind: "choice", k: 4, options: OPTIONS }),
    /choice schema declares k=4 and carries 3/,
  )
})

test("every option can be written, and no two of a set read the same", () => {
  const written = OPTIONS.map((option) =>
    option.kind === "fraction"
      ? writeFraction(option.num, option.den, option.whole)
      : writeDecimal(option.value, option.decimalPlaces),
  )
  assert.deepEqual(written, ["1/2", "1/3", "0.75"])
  assert.equal(new Set(written).size, written.length, "two options that read alike are one option")
})

// ── columnAlgorithm ─────────────────────────────────────────────────────────

const BORROW: AnswerSchema = { kind: "columnAlgorithm", cols: 4, marks: "borrow", decimalPlaces: 0 }
const CARRY: AnswerSchema = { kind: "columnAlgorithm", cols: 3, marks: "carry", decimalPlaces: 0 }
const PLAIN: AnswerSchema = { kind: "columnAlgorithm", cols: 3, marks: "none", decimalPlaces: 0 }

test("the grid is a digit per column plus a mark above all but the units", () => {
  assert.deepEqual(
    columnEntry.init(BORROW).fields.map((field) => field.id),
    ["d0", "d1", "d2", "d3", "m1", "m2", "m3"],
  )
  assert.deepEqual(
    columnEntry.init(PLAIN).fields.map((field) => field.id),
    ["d0", "d1", "d2"],
    "a schema with no marks draws no mark row",
  )
  assert.equal(columnEntry.init(BORROW).focus, 0, "writing starts at the units column")
})

test("a digit into a full cell goes to the cell on its left, as a hand does", () => {
  // Every cell is one character wide, so without this a child writes the units,
  // reaches for the tens, and watches the key do nothing.
  const state = type(columnEntry, BORROW, "3022")
  assert.equal(columnDigits(state), "2203", "typed units-first, read most-significant-first")
  assert.deepEqual(columnEntry.value(state, BORROW), {
    kind: "columnAlgorithm",
    value: exact.rational(2203n),
    marks: [],
  })
})

test("5001 − 2798 = 2203, written into the grid", () => {
  // The program's own worked example. `3797` is smaller-from-larger and `3203`
  // is borrow-across-zero; neither is the answer, and the grid must carry it.
  const state = type(columnEntry, BORROW, "3022")
  const value = columnEntry.value(state, BORROW)
  assert.ok(value?.kind === "columnAlgorithm")
  assert.equal(exact.toString(value.value), "2203")
  assert.equal(exact.toString(exact.sub(exact.rational(5001n), exact.rational(2798n))), "2203")
})

test("a blank leading column is a shorter number; a blank inside is not a number", () => {
  const short = type(columnEntry, BORROW, "513")
  assert.equal(columnDigits(short), "315")
  assert.equal(columnEntry.complete(short), true)

  // `3 _ 5` could be 305 or 35 and the app must not pick: uncommittable, which
  // is visible, rather than silently wrong.
  const gapped = columnEntry.press(type(columnEntry, BORROW, "513"), { kind: "focus", field: 1 })
  const hole = columnEntry.press(gapped, { kind: "delete" })
  assert.equal(columnDigits(hole), null)
  assert.equal(columnEntry.complete(hole), false)
  assert.equal(columnEntry.value(hole, BORROW), null)
})

test("marks are recorded and are not a correctness condition", () => {
  // `answerEquals` compares the number and ignores the marks: a child who
  // regroups mentally and writes only the digits is right.
  const digits = type(columnEntry, BORROW, "3022")
  const markIndex = digits.fields.findIndex((field) => field.id === columnMarkId(1))
  const marked = type(columnEntry, BORROW, "9", columnEntry.press(digits, { kind: "focus", field: markIndex }))

  const withMark = columnEntry.value(marked, BORROW)
  const bare = columnEntry.value(digits, BORROW)
  assert.ok(withMark !== null && bare !== null)
  assert.deepEqual(withMark, {
    kind: "columnAlgorithm",
    value: exact.rational(2203n),
    marks: [{ column: 1, kind: "borrow", value: 9 }],
  })
  assert.ok(answerEquals(withMark, bare), "the marks are evidence, not the answer")
})

test("a carry grid marks carries and a borrow grid marks borrows", () => {
  const start = columnEntry.init(CARRY)
  const markIndex = start.fields.findIndex((field) => field.id === columnMarkId(1))
  const withMark = type(columnEntry, CARRY, "1", columnEntry.press(start, { kind: "focus", field: markIndex }))
  const withDigit = type(columnEntry, CARRY, "1", columnEntry.press(withMark, { kind: "focus", field: 0 }))
  const value = columnEntry.value(withDigit, CARRY)
  assert.ok(value?.kind === "columnAlgorithm")
  assert.deepEqual(value.marks, [{ column: 1, kind: "carry", value: 1 }])
})

test("advance walks the digit row units-first and wraps to the units", () => {
  const four = columnEntry.init(BORROW)
  const one = columnEntry.press(four, { kind: "advance" })
  assert.equal(one.focus, 1)
  const round = [0, 1, 2].reduce((state) => columnEntry.press(state, { kind: "advance" }), one)
  assert.equal(round.focus, 0, "four digit cells, and the fourth press is back at the units")

  // From a mark it lands on the units column, which is where writing starts.
  const mark = columnEntry.press(four, {
    kind: "focus",
    field: four.fields.findIndex((field) => field.id === columnMarkId(2)),
  })
  assert.equal(columnEntry.press(mark, { kind: "advance" }).focus, 0)
})

test("a decimal grid scales by its places without a float", () => {
  const tenths: AnswerSchema = { kind: "columnAlgorithm", cols: 3, marks: "borrow", decimalPlaces: 1 }
  const state = type(columnEntry, tenths, "513")
  const value = columnEntry.value(state, tenths)
  assert.ok(value?.kind === "columnAlgorithm")
  assert.deepEqual(value.value, exact.rational(63n, 2n), "d2 d1 . d0 = 31.5")
  assert.equal(typeof value.value.n, "bigint")
})

test("the column id helpers are the ones the grid draws from", () => {
  // Two spellings of a field id is a cell the keypad writes into unseen.
  assert.equal(columnDigitId(0), "d0")
  assert.equal(columnMarkId(3), "m3")
  const state = columnEntry.init(BORROW)
  for (let column = 0; column < 4; column++) {
    assert.ok(state.fields.some((field) => field.id === columnDigitId(column)))
  }
})

// ── the registry, and the keyboard ──────────────────────────────────────────

test("the registry draws all four V1 schemas, and says so once", () => {
  assert.equal(entryModelFor(FOUR_DIGITS), integerEntry)
  assert.equal(entryModelFor(FRACTION), fractionEntry)
  assert.equal(entryModelFor(CHOICE), choiceEntry)
  assert.equal(entryModelFor(BORROW), columnEntry)
  assert.deepEqual([...DRAWABLE_SCHEMA_KINDS].sort(), [
    "choice",
    "columnAlgorithm",
    "fraction",
    "integer",
  ])
})

test("no key commits — committing is a separate, explicit action", () => {
  for (const schema of [FOUR_DIGITS, TENTHS, FRACTION, CHOICE, BORROW]) {
    const model = entryModelFor(schema)
    assert.ok(model !== undefined)
    for (const cap of model.keys(schema)) {
      assert.notEqual(cap.kind, "commit")
    }
  }
})

test("every model is pure: the same state and key give the same answer", () => {
  // The layer's testability rests on this, and a module-level cache once lived
  // here that made `press` depend on which schemas had been initialised.
  for (const schema of [FOUR_DIGITS, TENTHS, FRACTION, CHOICE, BORROW]) {
    const model = entryModelFor(schema)
    assert.ok(model !== undefined)
    const start = model.init(schema)
    const key = { kind: "glyph", glyph: "7" } as const
    assert.deepEqual(model.press(start, key), model.press(start, key))
    assert.deepEqual(model.init(schema), start, "init is not carrying anything forward")
  }
})

test("the keyboard and the keypad go through one path", () => {
  assert.deepEqual(glyphFromKey("7"), "7")
  assert.equal(glyphFromKey("Enter"), null)
  assert.equal(glyphFromKey("e"), null)
  assert.equal(glyphFromKey("."), DECIMAL_SEPARATOR)
  // A European layout has a comma where a US one has a full stop.
  assert.equal(glyphFromKey(","), DECIMAL_SEPARATOR)
  assert.deepEqual(entryKeyFromKeyboard("/"), { kind: "advance" })
  assert.deepEqual(entryKeyFromKeyboard("Backspace"), { kind: "delete" })
  assert.deepEqual(entryKeyFromKeyboard("Escape"), { kind: "clear" })
  assert.equal(entryKeyFromKeyboard("Enter"), null, "Enter is the card's, not the field's")
})

test("a position on a number line is written the way the answer is", () => {
  assert.equal(writeLinePosition(0, 3, 4), "3/4")
  assert.equal(writeLinePosition(0, 4, 4), "1", "a whole number is written as one, never as 4/4")
  assert.equal(writeLinePosition(0, 7, 4), `1${MIXED_GAP}3/4`)
  assert.equal(writeLinePosition(2, 0, 3), "2")
  assert.equal(writeLinePosition(1, 5, 3), `2${MIXED_GAP}2/3`)
})
