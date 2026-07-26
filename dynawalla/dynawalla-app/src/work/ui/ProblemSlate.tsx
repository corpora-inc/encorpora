import { ANCHOR_SEAT } from "../../design/anchors.ts"
import { IndexMark } from "../../design/IndexMark.tsx"
import { strings } from "../../app/strings.ts"
import type { Card, Feedback } from "../session.ts"
import { readProblem } from "../problem.ts"
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
  const seated = feedback?.kind === "seated"

  return (
    <div className="dw-present flex justify-center">
      <div className="dw-slate numeral text-right text-3xl leading-tight">
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

        {/* The one live region. It has text in **both** verdict states: an
            `aria-hidden` mark and a bare number announce nothing and "wrong" is
            then carried by `line-through`, which assistive technology does not
            expose at all (`Q-09`, `Q-10`). */}
        <div className="dw-verdict-well flex items-center justify-end gap-2 pt-1" role="status">
          {seated ? (
            <>
              <span className="sr-only">{strings.practice.correct}</span>
              <IndexMark className="text-seat size-4" />
            </>
          ) : null}
          {feedback?.kind === "struck" ? (
            <>
              {/* The trailing space is inside the hidden span on purpose: as a
                  text node between two flex items it would be an anonymous
                  flex item of its own, and this row's height is a promise. */}
              <span className="sr-only">{strings.practice.answer}{" "}</span>
              <span className="text-seat">{feedback.answer}</span>
            </>
          ) : null}
        </div>
      </div>
    </div>
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
