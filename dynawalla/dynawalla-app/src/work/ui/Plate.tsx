import type { ReactNode } from "react"

/**
 * A cut plate: the one control shape this surface has.
 *
 * There is exactly one, and that is the point. `P-10` requires "Done" and "Keep
 * going" to be equal-weight at every designed stopping point, and the only way to
 * make that structurally true rather than a thing someone checks in a screenshot
 * is for there to be no emphasised variant to reach for. No `primary`, no
 * `accent`, no size prop. `stopping.test.ts` reads this file and the screen that
 * uses it and asserts the pair renders through it with nothing added.
 *
 * Squared off — 4 px chamfers, not pills. Minimum 3rem tall so a child's finger
 * lands on it, and `touch-action: manipulation` inherited from the body so a
 * double tap never zooms the work surface.
 */
export function Plate({
  children,
  onPress,
  disabled = false,
}: {
  children: ReactNode
  onPress: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      // `pointerdown`, not `click`: EXPERIENCE_DESIGN binds every keypress on
      // pointer-down so the visual acknowledgement lands in the same frame as
      // the finger, rather than ~100 ms later when the tap resolves.
      onPointerDown={(event) => {
        if (disabled) return
        // Keeps focus where it is and stops the synthetic click that follows.
        event.preventDefault()
        onPress()
      }}
      // Keyboards do not send pointer events. Enter and Space arrive as clicks.
      onClick={(event) => {
        if (event.detail !== 0 || disabled) return
        onPress()
      }}
      className="border-line-strong rounded-cut-md bg-ground-raised text-ink inscription hover:bg-ground-sunk flex min-h-12 flex-1 items-center justify-center border px-5 text-lg tracking-wide transition-colors duration-[var(--dw-motion-quick)] disabled:opacity-40"
    >
      {children}
    </button>
  )
}
