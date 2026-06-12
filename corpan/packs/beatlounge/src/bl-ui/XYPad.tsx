/**
 * beatlounge — XYPad: a 2D X/Y control surface mapping two axes to two params
 * (e.g. filter cutoff × resonance, delay time × feedback, two mod depths).
 *
 *   • tap-to-jump + drag, pointer-captured (mouse / touch / pen), Shift = fine
 *   • Y axis inverted visually (up = increase, like a hardware pad)
 *   • arrow keys move the puck when focused (Shift = fine), Home/End jump corner
 *   • faint grid, glowing puck, axis labels + live mono readout
 *
 * Mirrors the Knob/Fader idiom: a headless `useDrag` (chrome-bail guard +
 * pointer capture) drives a themed SVG/CSS skin. The pointer→value mapping is
 * factored into the pure `mapPointerToValues` helper so it's testable without a
 * DOM. `onChange` fires live during the gesture; `onCommit` once on release
 * (one undo step). Reduced-motion is handled globally by CSS.
 */

import { useCallback, useRef } from "react"
import { useDrag } from "./useDrag"
import "./XYPad.css"

export interface XYAxis {
  value: number
  min: number
  max: number
  label: string
  format?: (v: number) => string
  unit?: string
}

export interface XYPadProps {
  x: XYAxis
  y: XYAxis
  /** Live preview during the gesture. */
  onChange: (x: number, y: number) => void
  /** Called once on release (good for a single undo step). */
  onCommit?: (x: number, y: number) => void
  /** Square-ish size in px. Omit to fill the container (responsive). */
  size?: number
  label?: string
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** Map a 0..1 normalized position along an axis to its value range. */
const denorm = (n: number, axis: XYAxis): number =>
  axis.min + clamp(n, 0, 1) * (axis.max - axis.min || 0)

/** Map an axis value back to its 0..1 normalized position. */
const normOf = (axis: XYAxis): number => {
  const range = axis.max - axis.min || 1
  return clamp((axis.value - axis.min) / range, 0, 1)
}

/**
 * Pure pointer→values mapping (no DOM): given the pad's bounding rect and a
 * pointer client position, return the clamped {x, y} axis values. X maps
 * left→right (min→max); Y is INVERTED (top = max, bottom = min) to match
 * hardware. Exported so the mapping can be unit-tested without rendering.
 */
export const mapPointerToValues = (
  rect: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number,
  xAxis: XYAxis,
  yAxis: XYAxis
): { x: number; y: number } => {
  const nx = rect.width > 0 ? (clientX - rect.left) / rect.width : 0
  // Invert Y: top of the pad = max value.
  const nyTop = rect.height > 0 ? (clientY - rect.top) / rect.height : 0
  const ny = 1 - nyTop
  return {
    x: denorm(nx, xAxis),
    y: denorm(ny, yAxis),
  }
}

const readoutOf = (axis: XYAxis): string =>
  (axis.format ? axis.format(axis.value) : String(Math.round(axis.value))) +
  (axis.unit ?? "")

export const XYPad = ({ x, y, onChange, onCommit, size, label }: XYPadProps) => {
  // The pad rect captured at press time (so we can map ABSOLUTE pointer pos,
  // not cumulative deltas — an XY pad wants position, not travel).
  const rectRef = useRef<DOMRect | null>(null)
  // Latest committed values, so onEnd/keys read fresh state without re-binding.
  const latest = useRef({ x: x.value, y: y.value })
  latest.current = { x: x.value, y: y.value }

  const nx = normOf(x)
  const ny = normOf(y)

  const applyFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const rect = rectRef.current
      if (!rect) return
      const v = mapPointerToValues(rect, clientX, clientY, x, y)
      onChange(v.x, v.y)
    },
    [onChange, x, y]
  )

  const drag = useDrag({
    onStart: (e) => {
      rectRef.current = (e.currentTarget as HTMLElement).getBoundingClientRect()
      // Tap-to-jump: the press itself sets the puck.
      applyFromPointer(e.clientX, e.clientY)
    },
    onMove: (_d, e) => applyFromPointer(e.clientX, e.clientY),
    onEnd: () => onCommit?.(latest.current.x, latest.current.y),
  })

  const onKeyDown = (e: React.KeyboardEvent) => {
    const fine = e.shiftKey ? 0.01 : 0.04
    const dxStep = (x.max - x.min) * fine
    const dyStep = (y.max - y.min) * fine
    let dx = 0
    let dy = 0
    if (e.key === "ArrowLeft") dx = -dxStep
    else if (e.key === "ArrowRight") dx = dxStep
    else if (e.key === "ArrowUp") dy = dyStep
    else if (e.key === "ArrowDown") dy = -dyStep
    else if (e.key === "Home") {
      e.preventDefault()
      const vx = x.min
      const vy = y.min
      onChange(vx, vy)
      onCommit?.(vx, vy)
      return
    } else if (e.key === "End") {
      e.preventDefault()
      const vx = x.max
      const vy = y.max
      onChange(vx, vy)
      onCommit?.(vx, vy)
      return
    } else return
    e.preventDefault()
    const vx = clamp(x.value + dx, x.min, x.max)
    const vy = clamp(y.value + dy, y.min, y.max)
    onChange(vx, vy)
    onCommit?.(vx, vy)
  }

  const puckLeft = `${(nx * 100).toFixed(2)}%`
  // Visual Y is inverted: high value sits near the top.
  const puckTop = `${((1 - ny) * 100).toFixed(2)}%`
  const xReadout = readoutOf(x)
  const yReadout = readoutOf(y)
  const groupLabel = label ?? `${x.label} / ${y.label}`

  return (
    <div className="bl-xypad" data-bl-nocapture>
      {label && <div className="bl-xypad-label">{label}</div>}
      <div
        className="bl-xypad-surface"
        role="application"
        tabIndex={0}
        aria-label={`${groupLabel}. ${x.label} ${xReadout}, ${y.label} ${yReadout}. Arrow keys to adjust.`}
        aria-roledescription="2D control pad"
        onPointerDown={drag.onPointerDown}
        onKeyDown={onKeyDown}
        style={size ? { width: size, height: size } : undefined}
      >
        <svg
          className="bl-xypad-grid"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <line className="bl-xypad-gridline" x1="50" y1="0" x2="50" y2="100" />
          <line className="bl-xypad-gridline" x1="0" y1="50" x2="100" y2="50" />
          <line className="bl-xypad-gridline is-faint" x1="25" y1="0" x2="25" y2="100" />
          <line className="bl-xypad-gridline is-faint" x1="75" y1="0" x2="75" y2="100" />
          <line className="bl-xypad-gridline is-faint" x1="0" y1="25" x2="100" y2="25" />
          <line className="bl-xypad-gridline is-faint" x1="0" y1="75" x2="100" y2="75" />
        </svg>

        {/* Crosshair guides that track the puck. */}
        <span className="bl-xypad-crosshair is-v" style={{ left: puckLeft }} aria-hidden="true" />
        <span className="bl-xypad-crosshair is-h" style={{ top: puckTop }} aria-hidden="true" />

        <span
          className="bl-xypad-puck"
          style={{ left: puckLeft, top: puckTop }}
          aria-hidden="true"
        />

        <span className="bl-xypad-axis is-x" aria-hidden="true">
          {x.label}
        </span>
        <span className="bl-xypad-axis is-y" aria-hidden="true">
          {y.label}
        </span>
      </div>

      <div className="bl-xypad-readouts" aria-hidden="true">
        <span className="bl-xypad-readout">
          <span className="bl-xypad-readout-key">{x.label}</span>
          <span className="bl-xypad-readout-val">{xReadout}</span>
        </span>
        <span className="bl-xypad-readout">
          <span className="bl-xypad-readout-key">{y.label}</span>
          <span className="bl-xypad-readout-val">{yReadout}</span>
        </span>
      </div>
    </div>
  )
}
