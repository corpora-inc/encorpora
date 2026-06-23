/**
 * beatlounge — Knob: a radial value control with a DAW-grade input set.
 *
 *   • vertical drag (up = increase), pointer-captured, fine with Shift
 *   • mouse wheel (one detent = one step)
 *   • arrow keys (←/↓ down, →/↑ up; PageUp/Down = coarse) when focused
 *   • double-tap / double-click → snap to `defaultValue`
 *
 * Renders an SVG arc + a mono readout. ARIA slider role with value text. The
 * useDrag hook applies the chrome-bail guard automatically. Reduced-motion is
 * handled by CSS (transitions disabled globally).
 */

import { useCallback, useRef } from "react"
import { useDrag } from "./useDrag"

export interface KnobProps {
  value: number
  min: number
  max: number
  step?: number
  defaultValue?: number
  label: string
  /** Format the readout (e.g. `(v) => v.toFixed(0)`). */
  format?: (v: number) => string
  unit?: string
  /** Live preview during drag; commit on release if provided separately. */
  onChange: (v: number) => void
  /** Called once on release (good for a single undo step). */
  onCommit?: (v: number) => void
  size?: number
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const TAU = Math.PI * 2
// Sweep from -135° to +135° (270° arc, gap at the bottom).
const A0 = (-135 * Math.PI) / 180
const A1 = (135 * Math.PI) / 180

const polar = (cx: number, cy: number, r: number, a: number) => ({
  x: cx + r * Math.cos(a),
  y: cy + r * Math.sin(a),
})

const arcPath = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  const s = polar(cx, cy, r, a0)
  const e = polar(cx, cy, r, a1)
  const large = a1 - a0 > Math.PI ? 1 : 0
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`
}

export const Knob = ({
  value,
  min,
  max,
  step = (max - min) / 100,
  defaultValue,
  label,
  format,
  unit,
  onChange,
  onCommit,
  size = 56,
}: KnobProps) => {
  const startVal = useRef(value)
  const range = max - min || 1
  const norm = clamp((value - min) / range, 0, 1)

  const apply = useCallback(
    (v: number) => onChange(clamp(v, min, max)),
    [onChange, min, max]
  )

  const drag = useDrag({
    onStart: () => {
      startVal.current = value
    },
    onMove: ({ dy }, e) => {
      // Up = increase. 180px of travel sweeps the whole range; Shift = fine.
      const fine = e.shiftKey ? 0.25 : 1
      const next = startVal.current - (dy / 180) * range * fine
      apply(next)
    },
    onEnd: () => onCommit?.(clamp(value, min, max)),
  })

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const dir = e.deltaY > 0 ? -1 : 1
    const next = clamp(value + dir * step, min, max)
    onChange(next)
    onCommit?.(next)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    let delta = 0
    if (e.key === "ArrowUp" || e.key === "ArrowRight") delta = step
    else if (e.key === "ArrowDown" || e.key === "ArrowLeft") delta = -step
    else if (e.key === "PageUp") delta = step * 10
    else if (e.key === "PageDown") delta = -step * 10
    else if (e.key === "Home") {
      e.preventDefault()
      onChange(min)
      onCommit?.(min)
      return
    } else if (e.key === "End") {
      e.preventDefault()
      onChange(max)
      onCommit?.(max)
      return
    } else return
    e.preventDefault()
    const next = clamp(value + delta, min, max)
    onChange(next)
    onCommit?.(next)
  }

  const resetToDefault = () => {
    if (defaultValue == null) return
    onChange(clamp(defaultValue, min, max))
    onCommit?.(clamp(defaultValue, min, max))
  }

  const r = size / 2 - 5
  const cx = size / 2
  const cy = size / 2
  const angle = A0 + norm * (A1 - A0)
  const dot = polar(cx, cy, r - 3, angle)
  const readout = (format ? format(value) : String(Math.round(value))) + (unit ?? "")

  return (
    <div className="bl-knob" data-bl-nocapture>
      <div
        className="bl-knob-dial"
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={readout}
        onPointerDown={drag.onPointerDown}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
        onDoubleClick={resetToDefault}
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
          <path className="bl-knob-track" d={arcPath(cx, cy, r, A0, A1)} fill="none" />
          {norm > 0.001 && (
            <path className="bl-knob-fill" d={arcPath(cx, cy, r, A0, angle)} fill="none" />
          )}
          <line
            className="bl-knob-needle"
            x1={cx}
            y1={cy}
            x2={dot.x.toFixed(2)}
            y2={dot.y.toFixed(2)}
          />
        </svg>
      </div>
      <div className="bl-knob-readout" aria-hidden="true">
        {readout}
      </div>
      <div className="bl-knob-label">{label}</div>
    </div>
  )
}

void TAU
