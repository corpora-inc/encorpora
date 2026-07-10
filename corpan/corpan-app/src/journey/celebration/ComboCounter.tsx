// src/journey/celebration/ComboCounter.tsx — the ambient momentum gauge
// (PREMIUM_SCROLL §3.5). NOT a shouting number: a small squared chip that
// fills and warms as the streak climbs and gently exhales on a break. The
// learner reads their own momentum off the *fill + color temperature*, never a
// counter. Fixed-position overlay — it must never jolt the layout.
//
// Reduced-motion safe: the fill still changes (state is communicated through
// design), but the milestone pulse animation is suppressed.

import { motion, useReducedMotion } from "framer-motion"
import { comboMomentum, isComboMilestone } from "../feed/cardTransition.ts"

/** 0..1 gauge fill for a combo — reuses the shared momentum curve so the gauge
 *  and the card spring breathe together. */
function comboFill(combo: number): number {
  return comboMomentum(combo)
}

export function ComboCounter(props: { combo: number }) {
  const reduced = useReducedMotion()
  // Below 2 there is no momentum to show — the gauge stays out of sight so a
  // cold start is calm and uncluttered.
  if (props.combo < 2) return null

  const fill = comboFill(props.combo)
  // Color temperature rises with the streak: a cool accent at low combo warms
  // toward a hot amber-gold as it climbs (hue 262 purple → ~40 amber).
  const hue = Math.round(262 - (262 - 40) * fill)
  const milestone = isComboMilestone(props.combo)

  return (
    <motion.div
      className="pointer-events-none flex h-6 w-1.5 flex-col justify-end overflow-hidden rounded-[3px] bg-foreground/10"
      aria-hidden
      // A single gentle pulse at a milestone — never on every card.
      animate={
        milestone && !reduced ? { scale: [1, 1.35, 1] } : { scale: 1 }
      }
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <motion.div
        className="w-full rounded-[3px]"
        style={{ backgroundColor: `hsl(${hue} 82% 58%)` }}
        initial={false}
        animate={{ height: `${Math.round(fill * 100)}%` }}
        transition={
          reduced
            ? { duration: 0 }
            : { type: "spring", stiffness: 220, damping: 26 }
        }
      />
    </motion.div>
  )
}
