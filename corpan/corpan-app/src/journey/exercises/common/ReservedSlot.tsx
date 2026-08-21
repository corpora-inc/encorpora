// src/journey/exercises/common/ReservedSlot.tsx
//
// ── THE GLOBAL NO-REFLOW INVARIANT (feed-ux) ─────────────────────────────
// No Journey card may move or reflow its interactive region when an answer is
// committed (success OR fail). The moment a learner answers, the prompt and the
// option tiles / input must stay EXACTLY where they were. Because a card's
// content is vertically centered in FeedCardFrame, ANY change to the column's
// height re-centers the whole column and shifts the interactive region — so
// feedback that appears on answer must never add or remove flow height.
//
// Feedback may only come from:
//   (a) the celebration overlay layer (particles / haptics / chime / settle),
//   (b) an in-place state change that keeps the same box (a tile turning
//       green/red inside its OWN button),
//   (c) content that fills space ALREADY RESERVED before answering — a slot
//       that was present-but-empty and now fills IN PLACE (this component), or
//   (d) a floating overlay / toast that does not participate in layout flow
//       (see ActivityCardHost's answer-reveal toast).
//
// ReservedSlot is the sanctioned tool for (c): a container that pins a minimum
// height up-front and holds its footprint whether empty or full, so revealing
// its content (a target-text reveal, a "correct answer" line, a Continue
// button, a scaffold-hint offer) never pushes a sibling. Prefer this for small
// per-card feedback; use the celebration overlay or a bottom float for large.

import type { ReactNode } from "react"
import { reservedSlotClass } from "./reservedSlotClass.ts"

export { reservedSlotClass }

export function ReservedSlot(props: {
  children?: ReactNode
  /** Tailwind min-height utility — size it to the tallest content the slot
   *  will ever hold so filling it never grows the box. Defaults to min-h-8. */
  minH?: string
  className?: string
  testId?: string
}): JSX.Element {
  return (
    <div className={reservedSlotClass(props.minH, props.className)} data-testid={props.testId}>
      {props.children}
    </div>
  )
}
