// Structure-aware answer entry.
//
// Not a text box. A text box accepts "about 3", "3 apples" and "3.0000001", and
// then something downstream has to guess what a child meant — which is exactly
// where a float, a locale bug or a false negative gets in. Entry here is a
// *typed* structure: an ordered list of fields, each accepting a declared set of
// glyphs to a declared length, converted to an exact `AnswerValue` by the model
// that owns the schema.
//
// The generalisation is the whole point of the shape below. V1 needs fractions
// (`num`/`den`/`whole`), decimals (a separator glyph), mixed numbers, the column
// grid and a closed list, and every one of those is "more fields, more glyphs"
// rather than a different component. So:
//
//   * `EntryState` is fields + focus. A fraction is two fields; a mixed number is
//     three; a four-column grid is four digits and three marks; an integer is
//     one. The renderer draws `state.fields` and never knows which it has.
//   * A field declares its own alphabet, so `pressGlyph` is the same seven lines
//     for all of them.
//   * `EntryModel.keys()` declares the keypad, and `Keypad.tsx` changes not at all.
//   * `value()` is the only place a typed string becomes an `AnswerValue`, and it
//     builds it with `BigInt`. No `parseFloat` exists on this path.
//
// All four V1 schemas now have a model. `entryModelFor` still returns `undefined`
// rather than a stub for anything it cannot draw — a stub that returns `null` is
// a card a child cannot answer — and `ladder.test.ts` asserts every rung the
// ladder can serve has a model, which is the app-side echo of gate CG-8.
// `renderers.test.ts` asserts the other direction.
//
// Nothing here compares an answer to anything: correctness is `family.check`
// (`judge.ts`), and "is `2/4` the same answer as `1/2`" is `answerAccepted` on the
// curriculum side, keyed off `schema.equivalence`. A model's whole job is to turn
// keystrokes into the exact number the child wrote.
//
// Everything here is pure — no module state, no clock, no storage — which is what
// lets the layer be tested without a browser.

import { exact, schemaDefect } from "./curriculum.ts"
import type { AnswerSchema, AnswerSchemaKind, AnswerValue, ColumnMark } from "./curriculum.ts"

/** A digit. Its own type because "the glyphs a field takes" is wider than this. */
export type Digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"

/**
 * The decimal separator: one constant, which every model that writes or reads a
 * decimal goes through. That is what makes the format→parse round trip a
 * property this file can hold rather than a coincidence between two literals.
 *
 * It is `.` because that is what `rational.toDecimalString` writes, and the
 * number layer that owns the locale's separator (ARCHITECTURE L2, gate CG-14) is
 * not built. When it lands, this becomes its lookup and nothing else moves —
 * `entryKeyFromKeyboard` already takes the comma a European layout has.
 */
export const DECIMAL_SEPARATOR = "."

/** A glyph a field can hold. */
export type Glyph = Digit | typeof DECIMAL_SEPARATOR

export const DIGITS: readonly Digit[] = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]

function isDigit(glyph: string): glyph is Digit {
  return (DIGITS as readonly string[]).includes(glyph)
}

export interface EntryField {
  /** Stable within a schema: "value", "num", "den", "whole", "d0…", "m1…". */
  readonly id: string
  readonly text: string
  readonly maxLength: number
  /**
   * Glyphs this field takes **beyond the digits**, each at most once. Only a
   * decimal field has any; the "at most once" rule is here rather than in the
   * decimal model because a number has one separator and a coordinate will have
   * one comma, and neither wants its own copy of the check.
   */
  readonly symbols?: readonly Glyph[]
}

export interface EntryState {
  readonly fields: readonly EntryField[]
  /** Index into `fields`. Multi-field schemas move it; a one-field schema never does. */
  readonly focus: number
  /**
   * Keys the field could not take, counted. A count and not a flag: the renderer
   * restarts the acknowledgement by flipping two class names on its parity, and
   * a boolean already `true` cannot say "again". A full field used to swallow the
   * key in silence — on `95 − 19` the cap is two, so 9 · 7 · 6 left "97" with
   * nothing to say the 6 had gone.
   */
  readonly rebuffed: number
}

export type EntryKey =
  | { readonly kind: "glyph"; readonly glyph: Glyph }
  | { readonly kind: "delete" }
  | { readonly kind: "clear" }
  | { readonly kind: "focus"; readonly field: number }
  /**
   * On to the next field a child writes, wrapping. Not "focus + 1" as a rule of
   * the surface: the column grid is written units-first, so "next" is a
   * statement each model makes about *writing* order.
   */
  | { readonly kind: "advance" }

/**
 * What the keypad draws, in the order it draws it. Layout is the model's
 * business — a calculator pad is not a phone pad, and a fraction pad is neither
 * — so the keypad component takes this list and does no arranging of its own.
 * `blank` is a held cell, which is how a 3-wide grid gets a centred zero.
 *
 * Commit is not here. It is an explicit, separate action, never a key.
 */
export type KeyCap =
  | { readonly kind: "glyph"; readonly glyph: Glyph }
  | { readonly kind: "delete" }
  | { readonly kind: "advance" }
  | { readonly kind: "blank" }

export interface EntryModel {
  readonly schemaKind: AnswerSchemaKind
  init(schema: AnswerSchema): EntryState
  /**
   * Pure. Rejecting a key returns the same state — so the caller needs no guard
   * — *except* where the rejection is invisible on the face of the field, which
   * bumps `rebuffed` so the surface can acknowledge it.
   */
  press(state: EntryState, key: EntryKey): EntryState
  /** May this state be committed? An empty answer is not an answer. */
  complete(state: EntryState): boolean
  keys(schema: AnswerSchema): readonly KeyCap[]
  /** The exact value, or `null` when the state is not committable. */
  value(state: EntryState, schema: AnswerSchema): AnswerValue | null
}

// ── shared field mechanics ───────────────────────────────────────────────────

function replaceField(state: EntryState, index: number, text: string): EntryState {
  const fields = state.fields.map((field, i) => (i === index ? { ...field, text } : field))
  return { ...state, fields }
}

function focused(state: EntryState): EntryField | undefined {
  return state.fields[state.focus]
}

function rebuff(state: EntryState): EntryState {
  return { ...state, rebuffed: state.rebuffed + 1 }
}

/** Focus a field by index. Out of range is a wiring bug, and is ignored. */
function focusAt(state: EntryState, index: number): EntryState {
  if (index < 0 || index >= state.fields.length || index === state.focus) return state
  return { ...state, focus: index }
}

/** Would this glyph land, if it were pressed on this field? */
function accepts(field: EntryField, glyph: Glyph): boolean {
  if (field.text.length >= field.maxLength) return false
  if (isDigit(glyph)) return true
  // A symbol, and a field holds at most one of each: a number has one separator.
  return (field.symbols ?? []).includes(glyph) && !field.text.includes(glyph)
}

/**
 * The default `press`: glyphs into the focused field, delete, clear, focus.
 *
 * A refused glyph returns a *different* state carrying the rebuff count, because
 * that rejection is the one a child can neither see nor infer. Delete and clear
 * on an empty field are visible on their face and return the identical state.
 */
function pressGlyph(state: EntryState, key: EntryKey): EntryState {
  const field = focused(state)
  if (field === undefined) return state
  switch (key.kind) {
    case "glyph":
      return accepts(field, key.glyph)
        ? replaceField(state, state.focus, field.text + key.glyph)
        : rebuff(state)
    case "delete":
      return field.text === "" ? state : replaceField(state, state.focus, field.text.slice(0, -1))
    case "clear":
      // Every field, not just the focused one. On a fraction, wiping the
      // numerator and leaving the denominator standing is a state a child did
      // not ask for and cannot read.
      return state.fields.every((f) => f.text === "")
        ? state
        : { ...state, fields: state.fields.map((f) => ({ ...f, text: "" })) }
    case "focus":
      return focusAt(state, key.field)
    case "advance":
      return state
  }
}

/** The calculator pad's digit rows: 7 8 9 / 4 5 6 / 1 2 3, three wide. */
function calculatorRows(): KeyCap[] {
  const glyph = (g: Glyph): KeyCap => ({ kind: "glyph", glyph: g })
  return [
    glyph("7"), glyph("8"), glyph("9"),
    glyph("4"), glyph("5"), glyph("6"),
    glyph("1"), glyph("2"), glyph("3"),
  ]
}

/** The bottom row: one cell of the model's choosing, a centred zero, delete. */
function bottomRow(left: KeyCap): KeyCap[] {
  return [left, { kind: "glyph", glyph: "0" }, { kind: "delete" }]
}

function textOf(state: EntryState, id: string): string {
  return state.fields.find((field) => field.id === id)?.text ?? ""
}

// ── integer, and the decimal that is the same schema ─────────────────────────

/**
 * How many whole-number digits an `integer` field holds, and how many after the
 * separator.
 *
 * `schema.digits` is the *total* capacity — `ColumnOpParams.digits` is "digit
 * count of the top operand, decimal digits included" — so the whole part is what
 * is left. Floored at one, because a decimal answer is written `0.75` and never
 * `.75`: two places and two digits is a three-cell field, not an unwritable one.
 */
export function decimalCapacity(schema: Extract<AnswerSchema, { kind: "integer" }>): {
  readonly whole: number
  readonly places: number
} {
  const places = Math.max(0, schema.decimalPlaces)
  return { whole: Math.max(1, schema.digits - places), places }
}

/** `"31.5"` split at the separator. The fraction part is `null` when none was typed. */
function splitDecimal(text: string): { whole: string; frac: string | null } {
  const at = text.indexOf(DECIMAL_SEPARATOR)
  if (at < 0) return { whole: text, frac: null }
  return { whole: text.slice(0, at), frac: text.slice(at + 1) }
}

/**
 * `integer` — one field, capped at the schema's field width, with the decimal
 * separator when the schema has places for it.
 *
 * The cap is the *field* width the family documents and never the width of this
 * item's answer: sizing the field to the answer would tell a child how many
 * digits it has. So the slate shows one right-aligned run of numerals.
 *
 * Leading zeros are kept as typed and ignored by `value()` — `0512` is 512, and
 * marking it wrong would be the app grading typing. `3.50` is `3.5` for the same
 * reason: both normalise to one exact `Rational`, so a round trip through the
 * number layer cannot turn a right answer into a wrong one.
 *
 * The separator is a **key**, not a position the app fills in. It used to be the
 * latter: `value()` scaled whatever was typed by `decimalPlaces`, so a child who
 * meant `3.5` had to type `35`, a child who meant thirty-five typed the same two
 * keys, and no key existed that could tell them apart.
 */
export const integerEntry: EntryModel = {
  schemaKind: "integer",

  init(schema: AnswerSchema): EntryState {
    // `entryModelFor` dispatches on the kind, so a mismatch here is a wiring
    // bug. Failing loudly beats returning a state that renders as an empty,
    // uncommittable slate a child can only stare at.
    if (schema.kind !== "integer") throw new TypeError(`integerEntry: not an integer schema: ${schema.kind}`)
    const defect = schemaDefect(schema)
    if (defect !== null) throw new TypeError(`integerEntry: ${defect}`)
    const { whole, places } = decimalCapacity(schema)
    return {
      fields: [
        {
          id: "value",
          text: "",
          // One separator's worth of room on top of the digits, and only when
          // there is a separator to type.
          maxLength: whole + places + (places > 0 ? 1 : 0),
          ...(places > 0 ? { symbols: [DECIMAL_SEPARATOR] as const } : {}),
        },
      ],
      focus: 0,
      rebuffed: 0,
    }
  },

  press: pressGlyph,

  complete(state: EntryState): boolean {
    // A lone separator is not an answer. At least one digit, wherever it sits.
    return /\d/.test(focused(state)?.text ?? "")
  },

  keys(schema: AnswerSchema): readonly KeyCap[] {
    // Calculator order, three wide. A child who has used a number pad already
    // knows where 7 is, and delete sits under the thumb. The bottom-left cell is
    // the separator on a decimal item and held blank on a whole-number one, so
    // the zero stays centred and the pad never changes shape between cards.
    const places = schema.kind === "integer" ? decimalCapacity(schema).places : 0
    return [
      ...calculatorRows(),
      ...bottomRow(places > 0 ? { kind: "glyph", glyph: DECIMAL_SEPARATOR } : { kind: "blank" }),
    ]
  },

  value(state: EntryState, schema: AnswerSchema): AnswerValue | null {
    if (schema.kind !== "integer") return null
    const text = state.fields[0]?.text ?? ""
    if (!/\d/.test(text)) return null
    const { whole, frac } = splitDecimal(text)
    // `BigInt` on a digits-only string is exact at any length. `Number` is not,
    // and neither is anything that goes through a float on the way. `"3."` is 3
    // and `".5"` is one half: both are things a child types, and neither is
    // ambiguous.
    const digits = `${whole === "" ? "0" : whole}${frac ?? ""}`
    if (!/^\d+$/.test(digits)) return null
    return { kind: "integer", value: exact.fromScaled(BigInt(digits), frac?.length ?? 0) }
  },
}

// ── fraction, and the mixed number that is the same schema ───────────────────

export const FIELD_WHOLE = "whole"
export const FIELD_NUM = "num"
export const FIELD_DEN = "den"

/** Four digits each. A fraction a child writes by hand does not run to five. */
const FRACTION_FIELD_WIDTH = 4

/**
 * The fields a fraction schema asks for, in **writing order**: whole, then
 * numerator, then denominator.
 *
 * `schema.parts` is a set, not a sequence — a schema listing `den` before `num`
 * still means the same fraction — so the order is fixed here and the schema is
 * only asked *which* parts exist.
 */
function fractionFields(schema: Extract<AnswerSchema, { kind: "fraction" }>): EntryField[] {
  const fields: EntryField[] = []
  if (schema.parts.includes("whole")) {
    fields.push({ id: FIELD_WHOLE, text: "", maxLength: FRACTION_FIELD_WIDTH })
  }
  fields.push({ id: FIELD_NUM, text: "", maxLength: FRACTION_FIELD_WIDTH })
  fields.push({ id: FIELD_DEN, text: "", maxLength: FRACTION_FIELD_WIDTH })
  return fields
}

/**
 * `fraction` — a numerator over a denominator, with a whole number in front of
 * it when the schema says mixed numbers. Three decisions worth stating.
 *
 * **The denominator is never optional.** A fraction with an empty denominator is
 * not a number, so `complete` is false and `value` is `null` — the Check plate
 * is disabled rather than the app inventing a 1.
 *
 * **Zero is not a denominator.** `2/0` is refused at `value()`, not at the
 * keypad: a child part-way through typing `2/05` has a bare `0` in the field for
 * one keystroke, and refusing the key would make the field un-typeable.
 *
 * **`2/4` is not silently `1/2`.** The value carries what the child *wrote*;
 * whether an unsimplified equivalent counts is
 * `AnswerSchema.fraction.equivalence`, applied by `answerAccepted`. Simplifying
 * here would make it impossible to teach simplifying.
 */
export const fractionEntry: EntryModel = {
  schemaKind: "fraction",

  init(schema: AnswerSchema): EntryState {
    if (schema.kind !== "fraction") throw new TypeError(`fractionEntry: not a fraction schema: ${schema.kind}`)
    const defect = schemaDefect(schema)
    if (defect !== null) throw new TypeError(`fractionEntry: ${defect}`)
    return { fields: fractionFields(schema), focus: 0, rebuffed: 0 }
  },

  press(state: EntryState, key: EntryKey): EntryState {
    if (key.kind === "advance") return focusAt(state, (state.focus + 1) % state.fields.length)
    // A full field passes the key on rather than refusing it, but only on the
    // way *down* the fraction: a fifth digit in a four-wide numerator is a child
    // who has finished the numerator, and carrying them on is what the `/` key
    // would have done. The denominator has nowhere to go, so it rebuffs.
    if (key.kind === "glyph") {
      const field = focused(state)
      if (
        field !== undefined &&
        !accepts(field, key.glyph) &&
        field.text.length >= field.maxLength &&
        state.focus < state.fields.length - 1
      ) {
        return pressGlyph(focusAt(state, state.focus + 1), key)
      }
    }
    return pressGlyph(state, key)
  },

  complete(state: EntryState): boolean {
    // Numerator and denominator both written. The whole part of a mixed number
    // may be left empty — "three quarters" is a legal answer to a mixed-number
    // item, and making a child write `0 3/4` is the app grading notation.
    return textOf(state, FIELD_NUM) !== "" && textOf(state, FIELD_DEN) !== ""
  },

  keys(): readonly KeyCap[] {
    return [...calculatorRows(), ...bottomRow({ kind: "advance" })]
  },

  value(state: EntryState, schema: AnswerSchema): AnswerValue | null {
    if (schema.kind !== "fraction") return null
    const num = textOf(state, FIELD_NUM)
    const den = textOf(state, FIELD_DEN)
    if (num === "" || den === "") return null
    const denominator = BigInt(den)
    // Not a number. Refused here rather than at the keypad — see above.
    if (denominator === 0n) return null
    const whole = textOf(state, FIELD_WHOLE)
    const hasWhole = state.fields.some((field) => field.id === FIELD_WHOLE)
    return {
      kind: "fraction",
      num: BigInt(num),
      den: denominator,
      // `whole` rides on the value only when the schema has the field and the
      // child wrote in it. An absent whole and a written zero are the same
      // number, and `answerEquals` already treats them as one.
      ...(hasWhole && whole !== "" ? { whole: BigInt(whole) } : {}),
    }
  },
}

// ── choice ──────────────────────────────────────────────────────────────────

export const FIELD_CHOICE = "choice"

/**
 * `choice` — one field holding the ordinal of the option that is selected.
 *
 * It is a field like any other, so the surface, the keyboard and `complete` need
 * no special case; what makes it a choice is that the only thing which writes to
 * it is `{ kind: "focus" }`, which the option controls send. Digit keys select by
 * ordinal — `2` picks the second option — which is free keyboard operation and
 * costs nothing, but it is not the taught path and no string mentions it.
 *
 * There is no keypad. A closed list is answered by pointing at it, and a numeric
 * pad under four options invites typing an answer that is not one of them.
 */
export const choiceEntry: EntryModel = {
  schemaKind: "choice",

  init(schema: AnswerSchema): EntryState {
    if (schema.kind !== "choice") throw new TypeError(`choiceEntry: not a choice schema: ${schema.kind}`)
    const defect = schemaDefect(schema)
    if (defect !== null) throw new TypeError(`choiceEntry: ${defect}`)
    return { fields: [{ id: FIELD_CHOICE, text: "", maxLength: 2 }], focus: 0, rebuffed: 0 }
  },

  press(state: EntryState, key: EntryKey): EntryState {
    switch (key.kind) {
      case "focus":
        // The option's ordinal, not a field index: there is exactly one field.
        return key.field < 0 ? state : replaceField(state, 0, String(key.field))
      case "glyph": {
        const ordinal = isDigit(key.glyph) ? Number(key.glyph) : 0
        return ordinal < 1 ? state : replaceField(state, 0, String(ordinal - 1))
      }
      case "delete":
      case "clear":
        return textOf(state, FIELD_CHOICE) === "" ? state : replaceField(state, 0, "")
      case "advance":
        return state
    }
  },

  complete(state: EntryState): boolean {
    return textOf(state, FIELD_CHOICE) !== ""
  },

  keys(): readonly KeyCap[] {
    return []
  },

  value(state: EntryState, schema: AnswerSchema): AnswerValue | null {
    if (schema.kind !== "choice") return null
    const text = textOf(state, FIELD_CHOICE)
    if (text === "") return null
    const index = Number(text)
    // An index nothing on the screen corresponds to is not an answer. It cannot
    // happen through the surface; it can happen through a stale state and a
    // re-rendered card, and an out-of-range index judged silently would be
    // judged against whichever option the checker happened to hold.
    if (!Number.isInteger(index) || index < 0 || index >= schema.options.length) return null
    return { kind: "choice", index }
  },
}

// ── columnAlgorithm ─────────────────────────────────────────────────────────

/** The digit cell for column `i`, units = 0. */
export function columnDigitId(column: number): string {
  return `d${String(column)}`
}

/** The regrouping mark written above column `i`. */
export function columnMarkId(column: number): string {
  return `m${String(column)}`
}

function isDigitField(field: EntryField): boolean {
  return field.id.startsWith("d")
}

/**
 * The cells of a column grid, in the order a child writes them: digits
 * units-first, then the marks. `advance` therefore walks the digits right to
 * left — the written procedure — and the marks sit off that path, reached by
 * pointing or by Tab, because a child who regroups in their head has answered.
 */
function columnFields(schema: Extract<AnswerSchema, { kind: "columnAlgorithm" }>): EntryField[] {
  const fields: EntryField[] = []
  for (let column = 0; column < schema.cols; column++) {
    fields.push({ id: columnDigitId(column), text: "", maxLength: 1 })
  }
  if (schema.marks !== "none") {
    // A mark belongs above the column it changes, and the units column has
    // nothing to its right that could have sent it one.
    for (let column = 1; column < schema.cols; column++) {
      // Two characters: a borrowed column is written `13`, not `3`.
      fields.push({ id: columnMarkId(column), text: "", maxLength: 2 })
    }
  }
  return fields
}

/**
 * The written digits, most significant first, or `null` when the row is not a
 * number.
 *
 * Leading cells may be blank — a three-digit answer in a four-column grid is
 * what the grid is for. A blank *inside* the number is not a number: `3 _ 5`
 * could be 305 or 35 and the app must not pick, so it is uncommittable (the
 * Check plate is off) rather than wrong.
 */
export function columnDigits(state: EntryState): string | null {
  // Stored units-first; read the other way, which is how it is written.
  const written = state.fields
    .filter(isDigitField)
    .map((field) => field.text)
    .reverse()
  const first = written.findIndex((text) => text !== "")
  if (first < 0) return null
  const body = written.slice(first)
  if (body.some((text) => text === "")) return null
  return body.join("")
}

/**
 * `columnAlgorithm` — the carry/borrow grid, where the written procedure is the
 * answer rather than only its result.
 *
 * `answerEquals` compares the number and ignores the marks, and that is the
 * contract this model is built to. The marks are recorded because they are the
 * process evidence a diagnosis is made of, never because they are graded.
 */
export const columnEntry: EntryModel = {
  schemaKind: "columnAlgorithm",

  init(schema: AnswerSchema): EntryState {
    if (schema.kind !== "columnAlgorithm") {
      throw new TypeError(`columnEntry: not a columnAlgorithm schema: ${schema.kind}`)
    }
    const defect = schemaDefect(schema)
    if (defect !== null) throw new TypeError(`columnEntry: ${defect}`)
    return { fields: columnFields(schema), focus: 0, rebuffed: 0 }
  },

  press(state: EntryState, key: EntryKey): EntryState {
    const digits = state.fields.filter(isDigitField).length
    if (key.kind === "advance") {
      // Wraps within the digit row. From a mark it lands on the units column,
      // which is where writing starts.
      return focusAt(state, state.focus >= digits ? 0 : (state.focus + 1) % digits)
    }
    if (key.kind === "glyph") {
      const field = focused(state)
      // A one-digit cell that already holds a digit passes the new one to the
      // cell on its left, the way a hand does. Without this a child writes the
      // units, reaches for the tens, and watches the key do nothing.
      if (field !== undefined && isDigitField(field) && !accepts(field, key.glyph)) {
        if (state.focus + 1 < digits) return pressGlyph(focusAt(state, state.focus + 1), key)
        return rebuff(state)
      }
    }
    return pressGlyph(state, key)
  },

  complete(state: EntryState): boolean {
    return columnDigits(state) !== null
  },

  keys(): readonly KeyCap[] {
    return [...calculatorRows(), ...bottomRow({ kind: "advance" })]
  },

  value(state: EntryState, schema: AnswerSchema): AnswerValue | null {
    if (schema.kind !== "columnAlgorithm") return null
    const digits = columnDigits(state)
    if (digits === null) return null

    const kind: ColumnMark["kind"] = schema.marks === "carry" ? "carry" : "borrow"
    const marks: ColumnMark[] = []
    if (schema.marks !== "none") {
      for (let column = 1; column < schema.cols; column++) {
        const text = textOf(state, columnMarkId(column))
        if (text === "") continue
        marks.push({ column, kind, value: Number(text) })
      }
    }
    return {
      kind: "columnAlgorithm",
      value: exact.fromScaled(BigInt(digits), schema.decimalPlaces),
      marks,
    }
  },
}

// ── the registry ────────────────────────────────────────────────────────────

const MODELS: readonly EntryModel[] = [integerEntry, fractionEntry, choiceEntry, columnEntry]

/** The model that owns a schema, or `undefined` when the app cannot draw it yet. */
export function entryModelFor(schema: AnswerSchema): EntryModel | undefined {
  return MODELS.find((model) => model.schemaKind === schema.kind)
}

/** Every schema kind this bundle can draw. Read by `renderers.test.ts`. */
export const DRAWABLE_SCHEMA_KINDS: readonly AnswerSchemaKind[] = MODELS.map((model) => model.schemaKind)

/**
 * The `EntryKey` a hardware keyboard press means, or `null`.
 *
 * One path for keyboard and keypad, so there is nothing to keep in step. `,` is
 * the separator on a European layout and `/` is the fraction bar everywhere,
 * which is why both arrive here rather than in the screen's key handler.
 */
export function entryKeyFromKeyboard(key: string): EntryKey | null {
  if (isDigit(key)) return { kind: "glyph", glyph: key }
  if (key === "." || key === ",") return { kind: "glyph", glyph: DECIMAL_SEPARATOR }
  if (key === "/") return { kind: "advance" }
  if (key === "Backspace") return { kind: "delete" }
  if (key === "Escape") return { kind: "clear" }
  return null
}

/** The glyph a keyboard event carries, or `null`. */
export function glyphFromKey(key: string): Glyph | null {
  const entry = entryKeyFromKeyboard(key)
  return entry !== null && entry.kind === "glyph" ? entry.glyph : null
}

/** What one field currently reads as. Rendered right-aligned on the slate. */
export function fieldText(state: EntryState, index = 0): string {
  return state.fields[index]?.text ?? ""
}

/** What the field with this id reads as. Multi-field models are keyed, not indexed. */
export function namedFieldText(state: EntryState, id: string): string {
  return textOf(state, id)
}
