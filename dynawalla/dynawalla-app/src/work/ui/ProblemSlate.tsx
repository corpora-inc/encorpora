import { IndexMark } from "../../design/IndexMark.tsx"
import { strings } from "../../app/strings.ts"
import type { Card, Feedback } from "../session.ts"
import { readProblem } from "../problem.ts"
import { fieldText, type EntryState } from "../entry.ts"

const OPERATOR = { sub: "−", add: "+" } as const

/**
 * The problem, written the way it is written on paper.
 *
 * Right-aligned on a fixed run of numeral columns (`.dw-slate`) with tabular
 * figures, so the units column of a two-digit problem sits exactly where the
 * units column of a four-digit one sits and the surface does not move between
 * cards. That is not a nicety: a slate that reflows is a slate whose next
 * problem cost a layout, which is the one thing the answer path may not do.
 *
 * The verdict lands *in the slate*, in the place the answer goes — not in a
 * banner elsewhere on the screen. Its row is in the layout from the first frame
 * and holds its height whether it is empty, seated or struck, so feedback
 * appearing never moves the keypad under the child's finger.
 *
 * Nothing here is carried by colour alone: a wrong answer is struck through and
 * the correct one is written beneath it; a right answer takes the index mark.
 */
export function ProblemSlate({
  card,
  entry,
  feedback,
}: {
  card: Extract<Card, { kind: "problem" }>
  entry: EntryState | null
  feedback: Feedback | null
}) {
  const problem = readProblem(card.exercise)
  if (problem === null) return null

  const typed = entry === null ? "" : fieldText(entry)
  const struck = feedback?.kind === "struck"

  return (
    <div className="dw-present flex justify-center">
      <div className="dw-slate numeral text-right text-3xl leading-tight">
        <div className="text-ink py-1">{problem.top}</div>

        <div className="text-ink flex items-baseline justify-between gap-6 py-1">
          <span aria-hidden="true">{OPERATOR[problem.op]}</span>
          <span>{problem.bottom}</span>
        </div>

        {/* The subtraction bar is a structural edge (`line-strong`), not the
            shadow inside a carved groove (`line-cut`). In dark, `line-cut` and
            `ground-sunk` are the same basalt — the bar disappeared entirely and
            the answer read as a third operand. Only visible in the dark
            screenshots; nothing else would have caught it. */}
        <div className="border-line-strong border-t-2" />

        {/* Where the answer is written.
            The affordance is the guide line under it, brass while the surface is
            taking input and stone once it is not. A caret would have to sit to
            the right of the digits and push them off the column the problem is
            written in — and the units digit landing under the units digit is the
            entire reason this is a slate and not a form. A colour change on a
            rule that is always there costs no layout at all. */}
        <div
          className={[
            "border-b-2 py-1",
            // Brass while the surface is live; a hairline that separates a
            // struck answer from the correct one; gone when there is nothing to
            // separate. The width never changes, so neither does the layout.
            feedback === null ? "border-index" : struck ? "border-line" : "border-transparent",
            struck ? "text-strike line-through decoration-2" : "text-ink",
          ].join(" ")}
        >
          {/* Labelled, not live: the verdict well below is the one live region on
              this screen. Announcing the answer line too would read every digit
              twice — once as the key pressed, once as the line it landed on.

              A no-break space, not an ordinary one: an empty line box collapses
              and the row loses its height in the instant before the first digit
              lands — a layout shift on every single card. */}
          <span role="group" aria-label={strings.practice.answer}>
            {typed === "" ? "\u00A0" : typed}
          </span>
        </div>

        <div className="dw-verdict-well flex items-center justify-end gap-2 pt-1" role="status">
          {feedback?.kind === "seated" ? <IndexMark className="text-seat" /> : null}
          {feedback?.kind === "struck" ? <span className="text-seat">{feedback.answer}</span> : null}
        </div>
      </div>
    </div>
  )
}
