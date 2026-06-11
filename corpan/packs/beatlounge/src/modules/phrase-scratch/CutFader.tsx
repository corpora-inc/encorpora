/**
 * beatlounge — the single-deck CUT FADER: a throwable vertical level fader on the
 * deck (the scratch "cut"). Flick it 0→full for the fast fade-ins that real
 * scratching lives on. It controls THIS deck's output gain directly and immediately
 * — pointer-captured, big enough to flick, with keyboard + wheel for accessibility.
 *
 * It writes the cap position to a CSS var on pointer move (no per-move React churn
 * for the visual) AND reports the value up so the engine sets the gain right away.
 * Tap anywhere on the track to jump there (instant cut). Carries data-bl-nocapture
 * so it never steals the platter's drag.
 */

import { useCallback, useRef } from "react"

interface Props {
  /** Current level 0..1. */
  value: number
  /** ARIA label. */
  label: string
  /** Report a new level (drives the deck gain immediately). */
  onChange(v: number): void
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

export const CutFader = ({ value, label, onChange }: Props) => {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const dragging = useRef(false)

  // Map a clientY to a 0..1 level (top = full, bottom = 0 — a natural throw up).
  const levelFromY = useCallback((clientY: number): number => {
    const el = trackRef.current
    if (!el) return value
    const r = el.getBoundingClientRect()
    if (r.height <= 0) return value
    return clamp01(1 - (clientY - r.top) / r.height)
  }, [value])

  // Drive the cap/fill IMMEDIATELY via the CSS var (no wait for a React re-render) so
  // a fast flick tracks the finger with zero lag, AND report the value up for the gain.
  const apply = useCallback((v: number) => {
    const el = trackRef.current
    if (el) el.style.setProperty("--bl-cut", `${clamp01(v) * 100}%`)
    onChange(v)
  }, [onChange])

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button != null && e.button > 0) return
    const el = trackRef.current
    if (!el) return
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    dragging.current = true
    apply(levelFromY(e.clientY)) // instant jump-to-tap (a hard cut)
    e.preventDefault()
    e.stopPropagation()
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    apply(levelFromY(e.clientY))
    e.stopPropagation()
  }

  const end = (e: React.PointerEvent) => {
    if (!dragging.current) return
    dragging.current = false
    try {
      trackRef.current?.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    let next: number | null = null
    if (e.key === "ArrowUp" || e.key === "ArrowRight") next = clamp01(value + 0.1)
    else if (e.key === "ArrowDown" || e.key === "ArrowLeft") next = clamp01(value - 0.1)
    else if (e.key === "Home") next = 0
    else if (e.key === "End") next = 1
    if (next != null) {
      apply(next)
      e.preventDefault()
    }
  }

  const onWheel = (e: React.WheelEvent) => {
    apply(clamp01(value - Math.sign(e.deltaY) * 0.06))
  }

  return (
    <div
      ref={trackRef}
      className="bl-scr-cut"
      role="slider"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={1}
      aria-valuenow={Math.round(value * 100) / 100}
      tabIndex={0}
      data-bl-nocapture
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onKeyDown={onKeyDown}
      onWheel={onWheel}
      style={{ ["--bl-cut" as string]: `${clamp01(value) * 100}%` }}
    >
      <div className="bl-scr-cut-track" aria-hidden="true">
        <div className="bl-scr-cut-fill" />
      </div>
      <div className="bl-scr-cut-cap" aria-hidden="true" />
    </div>
  )
}
