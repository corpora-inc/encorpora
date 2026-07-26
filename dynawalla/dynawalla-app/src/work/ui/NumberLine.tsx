import { Fragment } from "react"

import { fill, strings } from "../../app/strings.ts"
import { writeLinePosition } from "../notation.ts"
import type { RepSpec } from "../curriculum.ts"
import { repSpecDefect, REP_NUMBER_LINE } from "../curriculum.ts"

/**
 * The number line: magnitude, fractions and comparison, on one rule.
 *
 * `{ from, to, denominator, mark }`, all integers. The line runs `from`..`to` in
 * whole units, each unit cut into `denominator` parts, with the index standing at
 * `mark` parts from the left end. Three quarters is `{ from: 0, to: 1,
 * denominator: 4, mark: 3 }` — exact, with nothing on the path that could become
 * `0.7500000001`.
 *
 * **The intervals are flex, not percentages.** Every interval is one `flex-1`
 * spacer between two zero-width tick columns, so a fifteenth of a line is a
 * fifteenth of a line and the browser does the division. Where a number *sits*
 * is the whole thing this representation teaches, and a tick two pixels off its
 * label teaches the opposite; the ticks are `w-0` for the same reason, since a
 * tick with width pushes its neighbours and shortens the last interval.
 *
 * **Whole ticks are taller than the parts, and the index is a shape.** A line
 * where every tick is the same height is a ruler with no units on it. Height and
 * shape, never colour (CG-18). The text alternative says where the index is, in
 * the notation the answer is written in — "Marked at 3/4", not a description of
 * a picture.
 *
 * No inline style anywhere: the CSP is `style-src 'self'`, so the one shape a
 * utility cannot express — the index's triangle — is `.dw-line-index`.
 */
export function NumberLine({ spec }: { spec: RepSpec }) {
  const defect = repSpecDefect(REP_NUMBER_LINE, spec.params)
  // A spec this component cannot draw honestly draws nothing. The gate is
  // `representation.test.ts`; a mis-drawn line on a child's screen is worse than
  // an absent one, because they would read it.
  if (defect !== null) return null

  const from = spec.params["from"] ?? 0
  const to = spec.params["to"] ?? 1
  const denominator = spec.params["denominator"] ?? 1
  const mark = spec.params["mark"] ?? 0
  const intervals = (to - from) * denominator

  const label = fill(strings.practice.lineAlt, {
    from,
    to,
    parts: denominator,
    at: writeLinePosition(from, mark, denominator),
  })

  return (
    <div
      // One picture, one alternative. Its parts are ticks and numerals with no
      // meaning apart from their positions, and read one by one they are a list
      // of numbers in an order nobody asked for.
      role="img"
      aria-label={label}
      className="dw-present relative h-20 w-full px-5"
    >
      {/* The rule. `border-line-strong` is a structural edge — `line-cut` is the
          shadow inside a groove and is the same basalt as `ground-sunk` in dark,
          which is how the subtraction bar once disappeared entirely. */}
      <div className="border-line-strong absolute top-8 right-5 left-5 border-t-2" />

      <div className="absolute top-8 right-5 left-5 flex">
        {Array.from({ length: intervals + 1 }, (_, i) => {
          const whole = i % denominator === 0
          return (
            <Fragment key={`t${String(i)}`}>
              <span className="relative w-0">
                <span
                  className={[
                    "absolute top-0 left-0 block -translate-x-1/2",
                    whole ? "bg-line-strong h-3 w-0.5" : "bg-line-strong h-1.5 w-px",
                  ].join(" ")}
                />
                {/* Only the whole numbers are labelled. Labelling every fifteenth
                    turns the line into a wall of numerals at 320 px and buries
                    the thing being taught — where this number sits between two
                    whole ones. */}
                {whole ? (
                  <span className="numeral text-ink-muted absolute top-4 left-0 -translate-x-1/2 text-xs">
                    {String(from + i / denominator)}
                  </span>
                ) : null}
                {i === mark ? (
                  <span className="dw-line-index absolute bottom-1 left-0 block -translate-x-1/2" />
                ) : null}
              </span>
              {i < intervals ? <span className="flex-1" /> : null}
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}
