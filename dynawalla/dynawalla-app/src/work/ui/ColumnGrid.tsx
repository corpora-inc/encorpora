import { Fragment } from "react"

import { strings } from "../../app/strings.ts"
import { EntryCell } from "./EntryCell.tsx"
import { columnDigitId, columnMarkId } from "../entry.ts"
import type { EntryKey, EntryState } from "../entry.ts"
import type { AnswerSchema } from "../curriculum.ts"

/** The place a column holds, written as the unit it holds: 1, 10, 100, 1000. */
function placeLabel(column: number, decimalPlaces: number): string {
  const power = column - decimalPlaces
  if (power >= 0) return `1${"0".repeat(power)}`
  // A decimal column: hundredths is `1/100`. Written as a fraction rather than
  // as `0.01`, because the label is read aloud and "one one-hundredth" is the
  // place, where "zero point zero one" is a number that happens to be it.
  return `1/1${"0".repeat(-power)}`
}

/**
 * The carry/borrow grid: the written procedure as the answer, not just its
 * result.
 *
 * One column per place, units on the right, with a row above for the regrouping
 * a child writes and a row below for the digit they land on. `answerEquals`
 * compares the number and ignores the marks — a child who regroups mentally and
 * writes only the digits is right — so the mark row is drawn lighter and sits
 * off the writing path: `advance` walks the digit row and nothing else, and the
 * marks are reached by pointing at them or by Tab.
 *
 * **Right to left.** Cells are laid out most-significant-first because that is
 * how a number is written, and the *focus* starts at the units column because
 * that is where the algorithm starts. Typing into a full cell passes the digit
 * to the cell on the left, the hand's own movement; without it a child writes
 * the units, reaches for the tens, and watches the key do nothing.
 *
 * **The two rows share one column table.** `columnCells` builds both, so a mark
 * is over the column it belongs to by construction. Built twice at first, the
 * marks sat half a cell left of the digits they annotate — a picture of the
 * wrong procedure, and visible only by looking.
 *
 * At 320 px a six-column grid with a mark row is 180 px inside a 288 px frame,
 * so nothing scrolls. `overflow-x-auto` anyway: a grid that grows must scroll
 * inside its own box rather than push the page sideways.
 */
export function ColumnGrid({
  schema,
  entry,
  onKey,
  disabled,
}: {
  schema: Extract<AnswerSchema, { kind: "columnAlgorithm" }>
  entry: EntryState
  onKey: (key: EntryKey) => void
  disabled: boolean
}) {
  return (
    <div className="overflow-x-auto">
      <div className="mx-auto flex w-fit flex-col items-stretch">
        {schema.marks === "none" ? null : (
          <div className="flex" role="group" aria-label={strings.practice.regroup}>
            {columnCells(schema, entry, onKey, disabled, "mark")}
          </div>
        )}
        <div className="flex" role="group" aria-label={strings.practice.answer}>
          {columnCells(schema, entry, onKey, disabled, "answer")}
        </div>
      </div>
    </div>
  )
}

/**
 * One row of the grid, most significant column first.
 *
 * Both rows come from here, so their columns are the same columns: same width,
 * same order, same decimal gap. The units column has nothing to its right that
 * could have sent it a regrouping, so its mark slot is a held cell rather than a
 * control that does nothing — and holding it is what keeps the row aligned.
 */
function columnCells(
  schema: Extract<AnswerSchema, { kind: "columnAlgorithm" }>,
  entry: EntryState,
  onKey: (key: EntryKey) => void,
  disabled: boolean,
  row: "mark" | "answer",
) {
  const nodes = []
  for (let column = schema.cols - 1; column >= 0; column--) {
    const id = row === "mark" ? columnMarkId(column) : columnDigitId(column)
    const index = entry.fields.findIndex((field) => field.id === id)
    const field = entry.fields[index]
    nodes.push(
      <Fragment key={`${row}${String(column)}`}>
        <div className="flex w-[var(--dw-cell-width)] items-end justify-center">
          {field === undefined ? (
            <span aria-hidden="true" className="block min-h-8" />
          ) : (
            <EntryCell
              field={field}
              label={placeLabel(column, schema.decimalPlaces)}
              current={entry.focus === index}
              onFocus={() => {
                onKey({ kind: "focus", field: index })
              }}
              disabled={disabled}
              tone={row === "mark" ? "mark" : "answer"}
            />
          )}
        </div>
        {/* The decimal point sits *between* two columns, never inside one — a
            point in a cell makes that column wider than its neighbours and the
            row stops lining up. Both rows reserve the same gap, or the marks
            drift off their columns at the point. */}
        {schema.decimalPlaces > 0 && column === schema.decimalPlaces ? (
          <span
            aria-hidden="true"
            className="numeral text-ink flex w-2 items-end justify-center text-xl leading-none"
          >
            {row === "answer" ? "." : " "}
          </span>
        ) : null}
      </Fragment>,
    )
  }
  return nodes
}
