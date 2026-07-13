// src/journey/feed/FeedCardFrame.tsx — the card frame (feed-ux §1.3/§3.1):
// settled checkmark stamp + "viewed earlier" chip in review mode.
//
// (File name: the spec calls this FeedCard.tsx; renamed to avoid colliding
// with the FeedCard TYPE in types.ts — same component, same duties.)
//
// The old long-press "why this card?" transparency popover was removed: its
// press-and-hold gesture collided with hold-to-speak (a speak card IS a long
// press), so it obscured the mic and re-summoned itself on every retry — and it
// was read-back status copy the design bans. State is shown through the card
// itself, not narrated.
//
// NO-REFLOW INVARIANT: this frame vertically centers the card column, so any
// height change to a card's content re-centers it and shifts the interactive
// region. Feedback that appears on answer must therefore be reserved-in-place
// or floated — NEVER a new flow child. The `settled` scale below is a transform
// (no layout cost) and the settled ✓ / review chip are absolute / present from
// mount. See exercises/common/ReservedSlot.tsx for the shared contract.

import { motion } from "framer-motion"
import { useTranslation } from "react-i18next"
import type { FeedCard } from "../types.ts"

export function FeedCardFrame(props: {
  card: FeedCard
  settled: boolean
  review: boolean
  /** In-flow "reviewed earlier · N/M" label for a scrolled-back card. Rendered
   *  as an in-flow chip at the top of the centered column (NOT an absolute float
   *  over the card — that overlapped the exercise on return). */
  reviewLabel?: string
  children: React.ReactNode
}) {
  const { t } = useTranslation()

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center px-5 py-6">
      <motion.div
        className="mx-auto flex w-full max-w-[40rem] flex-1 flex-col items-center justify-center"
        animate={{ scale: props.settled ? 0.98 : 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
      >
        {props.reviewLabel || props.review ? (
          <div className="mb-3 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            {props.reviewLabel ?? t("journey.exercise.reviewedEarlier")}
          </div>
        ) : null}
        {props.children}
      </motion.div>
      {/* No top-right "settled" checkmark here: the exercise already shows a
          single result stamp ("✓ Correcto") in ActivityCardHost's feedback row.
          Two green checks in different places (top-right + underneath) was
          redundant and confusing — one verdict, one place. */}
    </div>
  )
}
