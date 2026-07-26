// Structure-aware answer entry.
//
// Not a text box. A text box accepts "about 3", "3 apples" and "3.0000001", and
// then something downstream has to guess what a child meant — which is exactly
// where a float, a locale bug or a false negative gets in. Entry here is a
// *typed* structure: an ordered list of fields, each accepting a declared set of
// glyphs to a declared length, converted to an exact `AnswerValue` by the model
// that owns the schema.
//
// The generalisation is deliberate and it is the whole point of the shape below.
// V1 needs fractions (`num`/`den`/`whole`), decimals (a `.` glyph), mixed
// numbers, units and coordinates. Every one of those is "more fields, more
// glyphs" — not a different component. So:
//
//   * `EntryState` is fields + focus. A fraction is two fields; a coordinate is
//     two fields; an integer is one. The renderer draws `state.fields` and never
//     knows which it has.
//   * `EntryModel.keys()` declares the keypad. A fraction model adds `/`, a
//     decimal model adds the locale's separator, and `Keypad.tsx` changes not at
//     all.
//   * `value()` is the only place a typed string becomes an `AnswerValue`, and
//     it builds it with `BigInt`. No `parseFloat` exists on this path.
//
// M2 registers exactly one model. The others are not stubbed, because a stub
// that returns `null` is a card a child cannot answer; `entryModelFor` returns
// `undefined` and `ladder.test.ts` asserts every rung the ladder can serve has a
// model, which is the app-side echo of gate CG-8.

import { exact } from "./curriculum.ts"
import type { AnswerSchema, AnswerSchemaKind, AnswerValue } from "./curriculum.ts"

/** A glyph a field can hold. Digits now; `.` and `/` when their models land. */
export type Glyph = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"

export const DIGITS: readonly Glyph[] = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]

export interface EntryField {
  /** Stable within a schema: "value", later "num" / "den" / "whole" / "x" / "y". */
  readonly id: string
  readonly text: string
  readonly maxLength: number
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

function replaceField(state: EntryState, index: number, text: string): EntryState {
  const fields = state.fields.map((field, i) => (i === index ? { ...field, text } : field))
  return { ...state, fields }
}

function focused(state: EntryState): EntryField | undefined {
  return state.fields[state.focus]
}

/**
 * `integer` — one field, digits only, capped at the schema's field width.
 *
 * The cap is `schema.digits`, which the family documents as the *field* width and
 * never the width of this item's answer: sizing the field to the answer would
 * tell a child how many digits it has. So the slate shows one right-aligned run
 * of numerals, not a row of empty boxes.
 *
 * Leading zeros are kept as typed and ignored by `value()`. `0512` is 512 —
 * marking it wrong would be the app grading typing, not arithmetic.
 */
export const integerEntry: EntryModel = {
  schemaKind: "integer",

  init(schema: AnswerSchema): EntryState {
    // `entryModelFor` dispatches on the kind, so a mismatch here is a wiring
    // bug. Failing loudly beats returning a state that renders as an empty,
    // uncommittable slate a child can only stare at.
    if (schema.kind !== "integer") throw new TypeError(`integerEntry: not an integer schema: ${schema.kind}`)
    return {
      fields: [{ id: "value", text: "", maxLength: schema.digits + schema.decimalPlaces }],
      focus: 0,
      rebuffed: 0,
    }
  },

  press(state: EntryState, key: EntryKey): EntryState {
    const field = focused(state)
    if (field === undefined) return state
    switch (key.kind) {
      case "glyph": {
        // The one rejection a child can neither see nor infer: the field looks
        // the same and holds a plausible number. So it returns a *different*
        // state carrying the count the slate acknowledges it with. The others
        // below are visible on their face and return the same state.
        if (field.text.length >= field.maxLength) return { ...state, rebuffed: state.rebuffed + 1 }
        return replaceField(state, state.focus, field.text + key.glyph)
      }
      case "delete":
        return field.text === "" ? state : replaceField(state, state.focus, field.text.slice(0, -1))
      case "clear":
        return field.text === "" ? state : replaceField(state, state.focus, "")
      case "focus":
        // One field: focus has nowhere to go. Multi-field models move it.
        return state
    }
  },

  complete(state: EntryState): boolean {
    return (focused(state)?.text.length ?? 0) > 0
  },

  keys(): readonly KeyCap[] {
    // Calculator order, three wide: 7 8 9 / 4 5 6 / 1 2 3 / _ 0 ⌫. A child who
    // has used a number pad anywhere else already knows where 7 is, and delete
    // sits under the thumb rather than next to the digits it undoes.
    const glyph = (g: Glyph): KeyCap => ({ kind: "glyph", glyph: g })
    return [
      glyph("7"), glyph("8"), glyph("9"),
      glyph("4"), glyph("5"), glyph("6"),
      glyph("1"), glyph("2"), glyph("3"),
      { kind: "blank" }, glyph("0"), { kind: "delete" },
    ]
  },

  value(state: EntryState, schema: AnswerSchema): AnswerValue | null {
    if (schema.kind !== "integer") return null
    const text = state.fields[0]?.text ?? ""
    if (text === "") return null
    // `BigInt` on a digits-only string is exact at any length. `Number` is not,
    // and neither is anything that goes through a float on the way.
    return { kind: "integer", value: exact.fromScaled(BigInt(text), schema.decimalPlaces) }
  },
}

const MODELS: readonly EntryModel[] = [integerEntry]

/** The model that owns a schema, or `undefined` when the app cannot draw it yet. */
export function entryModelFor(schema: AnswerSchema): EntryModel | undefined {
  return MODELS.find((model) => model.schemaKind === schema.kind)
}

/** The glyph a keyboard event carries, or `null`. Keyboard and keypad share one path. */
export function glyphFromKey(key: string): Glyph | null {
  return (DIGITS as readonly string[]).includes(key) ? (key as Glyph) : null
}

/** What one field currently reads as. Rendered right-aligned on the slate. */
export function fieldText(state: EntryState, index = 0): string {
  return state.fields[index]?.text ?? ""
}
