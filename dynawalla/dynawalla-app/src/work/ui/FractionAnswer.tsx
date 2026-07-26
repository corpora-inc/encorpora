import { strings } from "../../app/strings.ts"
import { EntryCell } from "./EntryCell.tsx"
import { FIELD_DEN, FIELD_NUM, FIELD_WHOLE } from "../entry.ts"
import type { EntryKey, EntryState } from "../entry.ts"

const LABEL: Readonly<Record<string, string>> = {
  [FIELD_WHOLE]: strings.practice.wholePart,
  [FIELD_NUM]: strings.practice.numerator,
  [FIELD_DEN]: strings.practice.denominator,
}

/**
 * A fraction, written the way it is written on paper: a numerator over a
 * denominator, on a rule, with the whole number of a mixed number standing to
 * the left of both.
 *
 * **Stacked, not `3/4`.** A solidus is how a fraction is typed, not how it is
 * read, and what a child in grades 3–6 is learning is that the number below the
 * line says how many parts the whole was cut into. Two cells over one rule says
 * that; `3/4` on one line says a division that has not been done.
 *
 * The rule between them is `border-line-strong`, a structural edge. In dark,
 * `line-cut` and `ground-sunk` are the same basalt and a bar drawn with it
 * disappears — the bug that ate the subtraction bar, visible only in a dark
 * screenshot.
 */
export function FractionAnswer({
  entry,
  onKey,
  disabled,
}: {
  entry: EntryState
  onKey: (key: EntryKey) => void
  disabled: boolean
}) {
  const whole = entry.fields.findIndex((field) => field.id === FIELD_WHOLE)
  const num = entry.fields.findIndex((field) => field.id === FIELD_NUM)
  const den = entry.fields.findIndex((field) => field.id === FIELD_DEN)
  const wholeField = entry.fields[whole]
  const numField = entry.fields[num]
  const denField = entry.fields[den]
  if (numField === undefined || denField === undefined) return null

  const cell = (index: number, field: NonNullable<(typeof entry.fields)[number]>) => (
    <EntryCell
      field={field}
      label={LABEL[field.id] ?? field.id}
      current={entry.focus === index}
      onFocus={() => {
        onKey({ kind: "focus", field: index })
      }}
      disabled={disabled}
    />
  )

  return (
    // One group, named once. Each cell says which part it is, so the whole reads
    // as "Answer, Numerator 3, Denominator 4" rather than as two loose numbers.
    <div className="flex items-center justify-center gap-3" role="group" aria-label={strings.practice.answer}>
      {wholeField === undefined ? null : cell(whole, wholeField)}
      <div className="flex flex-col items-center gap-1">
        {cell(num, numField)}
        <div className="border-line-strong w-full border-t-2" />
        {cell(den, denField)}
      </div>
    </div>
  )
}
