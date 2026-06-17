/**
 * beatlounge — StepCell: one rounded square in a step grid.
 *
 * States, composable: off / on (glowing), playhead (column live), beat-marker
 * (downbeat accent). Tap toggles; drag-paint is coordinated by the parent grid
 * (the cell reports enter/down to a shared paint controller via callbacks, so a
 * single pointer stroke paints many cells). Velocity drives the on-cell's glow
 * intensity. Pointer-driven, ≥ the grid's min cell size, role="gridcell".
 */

import { memo } from "react"

export interface StepCellProps {
  on: boolean
  /** Column under the playhead right now. */
  active?: boolean
  /** Downbeat / accent column (every N steps). */
  beat?: boolean
  /** 0..1 — scales the on-cell glow. */
  velocity?: number
  label?: string
  /** Tap / paint origin: the parent decides toggle vs paint. */
  onCellDown?: () => void
  /** Pointer dragged into this cell during a paint stroke. */
  onCellEnter?: () => void
}

export const StepCell = memo(function StepCell({
  on,
  active = false,
  beat = false,
  velocity = 0.9,
  label,
  onCellDown,
  onCellEnter,
}: StepCellProps) {
  const cls =
    "bl-cell" +
    (on ? " is-on" : "") +
    (active ? " is-active" : "") +
    (beat ? " is-beat" : "")

  return (
    <button
      type="button"
      role="gridcell"
      aria-pressed={on}
      aria-label={label}
      className={cls}
      data-bl-nocapture
      style={on ? ({ "--bl-cell-vel": String(0.45 + velocity * 0.55) } as React.CSSProperties) : undefined}
      onPointerDown={(e) => {
        // Primary pointer only; let the parent run the paint stroke.
        if (e.button != null && e.button > 0) return
        onCellDown?.()
      }}
      onPointerEnter={(e) => {
        // Buttons mask is 1 while a primary button is held during the move.
        if (e.buttons & 1) onCellEnter?.()
      }}
    >
      <span className="bl-cell-core" />
    </button>
  )
})
