import type { ReactNode } from "react"

import { ANCHOR_SEAT } from "../../design/anchors.ts"
import { strings } from "../../app/strings.ts"
import { VerdictWell } from "./VerdictWell.tsx"
import type { Feedback } from "../session.ts"
import type { Exercise } from "../curriculum.ts"
import { readProblem } from "../problem.ts"
import type { ColumnProblem } from "../problem.ts"
import { fieldText, type EntryState } from "../entry.ts"

const OPERATOR = { sub: "−", add: "+" } as const
/** The operator read aloud. The glyph is decorative; without this an item is "95 19". */
const OPERATOR_WORD = { sub: strings.practice.minus, add: strings.practice.plus } as const

/**
 * The problem, written the way it is written on paper.
 *
 * Right-aligned on a **fixed** run of numeral columns (`.dw-slate`) with tabular
 * figures, so the units column of a two-digit problem sits where the units column
 * of a four-digit one sits and the surface does not move between cards. The
 * operator sits in the reserved gutter rather than in the row: in the flow it was
 * the operator row that sized the box, the reservation was a `min-width` that
 * never bound, and the slate measured 115 px on a two-digit rung against 141 px
 * on a four-digit one.
 *
 * The verdict lands *in the slate*, where the answer goes. Its row is in the
 * layout from the first frame and holds its height empty, seated or struck, so
 * feedback never moves the keypad under the child's finger.
 *
 * Nothing here is carried by colour alone, and none of it by pixels alone: a
 * correct answer *seats* — the glyphs settle onto a solid rule in a recess that
 * was not there a frame ago — and the well says so in words a screen reader
 * reads. A wrong answer is struck through with the correct one labelled beneath.
 */
/**
 * The problem alone — no answer row and no verdict well.
 *
 * What a column-grid card wants: the item is written above, the answer is
 * written *in the grid*. Drawing the full slate there put a second, empty answer
 * rule between the subtraction bar and the grid and a second live region under
 * it — two verdict wells on one card. Only visible by looking.
 */
export function ProblemStatement({ exercise }: { exercise: Exercise }) {
  const problem = readProblem(exercise)
  if (problem === null) return null
  return (
    <SlateBox>
      <StatementRows problem={problem} />
    </SlateBox>
  )
}

export function ProblemSlate({
  exercise,
  entry,
  feedback,
}: {
  // The exercise, not the card. The slate reads two operands and an operator
  // out of `prompt.slots`; it has never had anything to say about which pool
  // the scheduler drew from, and taking the whole card meant the renderer
  // bench had to fabricate a plan to draw a problem.
  exercise: Exercise
  entry: EntryState | null
  feedback: Feedback | null
}) {
  const problem = readProblem(exercise)
  if (problem === null) return null

  const typed = entry === null ? "" : fieldText(entry)
  const struck = feedback?.kind === "struck"
  const seated = feedback?.kind === "seated"

  return (
    <SlateBox>
      <StatementRows problem={problem} />

        {/* Where the answer is written.
            The affordance is the guide line under it, brass while the surface is
            taking input and stone once it is not. A caret would have to sit to
            the right of the digits and push them off the column the problem is
            written in — and the units digit landing under the units digit is the
            entire reason this is a slate and not a form. A colour change on a
            rule that is always there costs no layout at all.

            A correct answer turns that rule solid and drops the row into a
            recess (`dw-seated`). Being right has to be the state that visibly
            happens: a surface where only being wrong produces an event teaches
            the wrong thing about where the interesting part of the app is. */}
        <div
          className={[
            // The reaction stage's `seat` anchor. It styles nothing; it is how
            // the canvas finds this row without either side importing the
            // other (`src/design/anchors.ts`).
            ANCHOR_SEAT,
            "border-b-2 py-1",
            feedback === null ? "border-index" : struck ? "border-line" : "border-seat",
            struck ? "text-strike line-through decoration-2" : seated ? "text-seat" : "text-ink",
            seated ? "dw-seated" : "",
            rebuffClass(entry),
          ].join(" ")}
        >
          {/* Labelled, not live: the verdict well below is the live region for
              the work surface. Announcing the answer line too would read every
              digit twice — once as the key pressed, once as the line it landed
              on. (The construction band has its own, for the character. They
              are both polite, so they queue rather than interrupt each other on
              the rare card where both have something to say.)

              A no-break space, not an ordinary one: an empty line box collapses
              and the row loses its height in the instant before the first digit
              lands — a layout shift on every single card. */}
          <span role="group" aria-label={strings.practice.answer}>
            {typed === "" ? " " : typed}
          </span>
        </div>

        {/* The one live region, shared with every other answer surface — see
            `VerdictWell.tsx`. Unconditional: feedback changes what is in the
            well, never whether the well exists. */}
        <VerdictWell feedback={feedback} />
    </SlateBox>
  )
}

/**
 * The fixed run of numeral columns every written item sits on.
 *
 * `.dw-slate` reserves the widest number the ladder can write, so a two-digit
 * problem and a four-digit one occupy the same box and the units column does not
 * move between cards (`Q-01`).
 */
function SlateBox({ children }: { children: ReactNode }) {
  return (
    <div className="dw-present flex justify-center">
      {/* The numeral size is the vertical scale's, not a literal: four rows of
          `text-3xl` are 222 px of a 568 px viewport, and on a short phone that
          is the difference between pressing Check and scrolling to find it. */}
      <div className="dw-slate numeral text-right text-[length:var(--dw-numeral-size)] leading-tight">
        {children}
      </div>
    </div>
  )
}

/** The item as written: the two operands, the operator, and the rule under them. */
function StatementRows({ problem }: { problem: ColumnProblem }) {
  return (
    <>
      <div className="text-ink py-1">{problem.top}</div>

      {/* The operator is `absolute` in the gutter the reservation cut for it.
          Laid out in the row it always sized the box past the reservation, so
          the units column moved between rungs — the reflow `Q-01` forbids. */}
      <div className="text-ink relative py-1">
        <span className="absolute top-1 left-0" aria-hidden="true">
          {OPERATOR[problem.op]}
        </span>
        <span className="sr-only">{OPERATOR_WORD[problem.op]}</span> {problem.bottom}
      </div>

      {/* The subtraction bar is a structural edge (`line-strong`), not the
          shadow inside a carved groove (`line-cut`). In dark, `line-cut` and
          `ground-sunk` are the same basalt — the bar disappeared entirely and
          the answer read as a third operand. Only visible in the dark
          screenshots; nothing else would have caught it. */}
      <div className="border-line-strong border-t-2" />
    </>
  )
}

/**
 * The acknowledgement for a key the field could not take. A full field swallowed
 * it silently: on `95 − 19` the cap is two, so 9 · 7 · 6 left "97" with nothing
 * to say the 6 had gone, and a child who presses a key and sees nothing assumes
 * the app is broken. Transient status text is forbidden, so the answer rule ticks
 * its colour for one beat — no layout, no string. `entry.rebuffed` is a count,
 * not a flag, so the two class names alternate and restart the animation.
 */
function rebuffClass(entry: EntryState | null): string {
  if (entry === null || entry.rebuffed === 0) return ""
  return entry.rebuffed % 2 === 1 ? "dw-rebuff-a" : "dw-rebuff-b"
}
