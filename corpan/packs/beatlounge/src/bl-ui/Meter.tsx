/**
 * beatlounge — segmented level Meter. `level` 0..1 lights N of `segments` bars;
 * the top fifth glows warm (headroom warning). Purely visual; the shell feeds
 * it a smoothed value (Wave 1 derives a synthetic pulse from the playhead until
 * the real engine reports RMS). Honors reduced-motion via CSS.
 */

import { memo } from "react"

export interface MeterProps {
  level: number
  segments?: number
  orientation?: "vertical" | "horizontal"
  label?: string
}

export const Meter = memo(function Meter({
  level,
  segments = 12,
  orientation = "vertical",
  label,
}: MeterProps) {
  const clamped = Math.max(0, Math.min(1, level))
  const lit = Math.round(clamped * segments)
  const cells = Array.from({ length: segments }, (_, i) => {
    // Bottom-up for vertical; index 0 = lowest.
    const idx = orientation === "vertical" ? segments - 1 - i : i
    const on = idx < lit
    const hot = idx >= segments - Math.ceil(segments / 5)
    return (
      <span
        key={i}
        className={`bl-meter-seg${on ? " is-on" : ""}${hot ? " is-hot" : ""}`}
      />
    )
  })
  return (
    <div
      className={`bl-meter bl-meter--${orientation}`}
      role="meter"
      aria-label={label ?? "Level"}
      aria-valuemin={0}
      aria-valuemax={1}
      aria-valuenow={Number(clamped.toFixed(2))}
    >
      {cells}
    </div>
  )
})
