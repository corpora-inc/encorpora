/**
 * beatlounge — Fader: a vertical (or horizontal) linear control. Drag the cap,
 * wheel, arrow keys, double-tap → default. Pointer-captured via useDrag with
 * the chrome-bail guard. ARIA slider. Mono readout under the track.
 */

import { useCallback, useRef } from "react"
import { useDrag } from "./useDrag"

export interface FaderProps {
  value: number
  min?: number
  max?: number
  step?: number
  defaultValue?: number
  label: string
  orientation?: "vertical" | "horizontal"
  format?: (v: number) => string
  onChange: (v: number) => void
  onCommit?: (v: number) => void
  length?: number
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export const Fader = ({
  value,
  min = 0,
  max = 1,
  step = 0.01,
  defaultValue,
  label,
  orientation = "vertical",
  format,
  onChange,
  onCommit,
  length = 120,
}: FaderProps) => {
  const vertical = orientation === "vertical"
  const range = max - min || 1
  const norm = clamp((value - min) / range, 0, 1)
  const start = useRef(value)

  const apply = useCallback(
    (v: number) => onChange(clamp(v, min, max)),
    [onChange, min, max]
  )

  const drag = useDrag({
    onStart: () => {
      start.current = value
    },
    onMove: ({ dx, dy }, e) => {
      const fine = e.shiftKey ? 0.3 : 1
      // Vertical: up increases. Horizontal: right increases.
      const travel = vertical ? -dy : dx
      apply(start.current + (travel / length) * range * fine)
    },
    onEnd: () => onCommit?.(clamp(value, min, max)),
  })

  const onKeyDown = (e: React.KeyboardEvent) => {
    let d = 0
    if (e.key === "ArrowUp" || e.key === "ArrowRight") d = step
    else if (e.key === "ArrowDown" || e.key === "ArrowLeft") d = -step
    else return
    e.preventDefault()
    const next = clamp(value + d, min, max)
    onChange(next)
    onCommit?.(next)
  }

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const next = clamp(value + (e.deltaY > 0 ? -step : step), min, max)
    onChange(next)
    onCommit?.(next)
  }

  const fillPct = `${(norm * 100).toFixed(1)}%`
  const readout = format ? format(value) : value.toFixed(2)

  return (
    <div className={`bl-fader bl-fader--${orientation}`} data-bl-nocapture>
      <div
        className="bl-fader-track"
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-orientation={orientation}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={readout}
        onPointerDown={drag.onPointerDown}
        onKeyDown={onKeyDown}
        onWheel={onWheel}
        onDoubleClick={() => {
          if (defaultValue == null) return
          onChange(clamp(defaultValue, min, max))
          onCommit?.(clamp(defaultValue, min, max))
        }}
        style={vertical ? { height: length } : { width: length }}
      >
        <span
          className="bl-fader-fill"
          style={vertical ? { height: fillPct } : { width: fillPct }}
        />
        <span
          className="bl-fader-cap"
          style={vertical ? { bottom: fillPct } : { left: fillPct }}
        />
      </div>
      <span className="bl-fader-readout" aria-hidden="true">
        {readout}
      </span>
    </div>
  )
}
