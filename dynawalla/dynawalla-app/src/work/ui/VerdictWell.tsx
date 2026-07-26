import { IndexMark } from "../../design/IndexMark.tsx"
import { strings } from "../../app/strings.ts"
import type { Feedback } from "../session.ts"

/**
 * The one live region on the work surface, and the only place a verdict is said.
 *
 * Extracted from `ProblemSlate` when the fraction, choice and column surfaces
 * arrived: four copies of a live region is four chances to ship one that
 * announces nothing. It has text in **both** verdict states — an `aria-hidden`
 * mark and a bare number announce "" and "2203", and `line-through` is not
 * exposed to assistive technology at all (`Q-09`, `Q-10`).
 *
 * Its row is in the layout from the first frame and holds its height empty,
 * seated or struck, so feedback never moves the keypad under a finger.
 */
export function VerdictWell({ feedback }: { feedback: Feedback | null }) {
  return (
    <div className="dw-verdict-well flex items-center justify-end gap-2 pt-1" role="status">
      {feedback?.kind === "seated" ? (
        <>
          <span className="sr-only">{strings.practice.correct}</span>
          <IndexMark className="text-seat size-4" />
        </>
      ) : null}
      {feedback?.kind === "struck" ? (
        <>
          {/* The trailing space is inside the hidden span on purpose: as a text
              node between two flex items it would be an anonymous flex item of
              its own, and this row's height is a promise. */}
          <span className="sr-only">{strings.practice.answer}{" "}</span>
          <span className="text-seat numeral">{feedback.answer}</span>
        </>
      ) : null}
    </div>
  )
}
