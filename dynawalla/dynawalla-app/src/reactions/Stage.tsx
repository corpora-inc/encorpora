import { useEffect, useRef } from "react"

import { mountStage } from "./live.ts"

/**
 * The reaction canvas: one element, over everything, catching nothing.
 *
 * `pointer-events: none` and `aria-hidden`, because it carries no information
 * and no affordance. Everything the child needs to know — right, wrong, what
 * the correct answer was, what got built — is in the markup underneath, which
 * is what makes it safe to clear this surface at any instant (`settleNow`) and
 * to draw almost nothing on it under reduced motion. No information is conveyed
 * by animation alone, from the first frame.
 *
 * One canvas for the whole app rather than one per screen: a second would mean
 * a second stage, a second once-a-session budget, and two things to settle on a
 * keystroke.
 */
export function ReactionStage() {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const element = canvas.current
    if (element === null) return
    return mountStage(element)
  }, [])

  return (
    <canvas
      ref={canvas}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[var(--z-sticky)] h-full w-full"
    />
  )
}
