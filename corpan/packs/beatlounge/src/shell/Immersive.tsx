/**
 * beatlounge — the Immersive frame: a thin header (collapse + title) over a
 * full-bleed working area, with safe-area insets on all four sides. ONE
 * immersive at a time. Exits on the collapse button, Esc, or swipe-down (a
 * downward pointer drag from the header beyond a threshold). Restores Stage
 * scroll/position is the shell's job; this frame just signals `onExit`.
 *
 * Fixed-height working area with `overflow: hidden auto` so inner grids scroll
 * without the sheet growing. transform/opacity transitions only (60fps).
 */

import { useEffect, useRef, useState, type ReactNode } from "react"
import { Glyph } from "../bl-ui"

interface Props {
  title: string
  onExit: () => void
  children: ReactNode
}

const SWIPE_DISMISS_PX = 90

export const Immersive = ({ title, onExit, children }: Props) => {
  const [dragY, setDragY] = useState(0)
  const startY = useRef<number | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        onExit()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onExit])

  // Swipe-down to dismiss, captured on the header grabber only.
  const onHeaderPointerDown = (e: React.PointerEvent) => {
    if (e.target instanceof Element && e.target.closest("button")) return
    startY.current = e.clientY
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onHeaderPointerMove = (e: React.PointerEvent) => {
    if (startY.current == null) return
    setDragY(Math.max(0, e.clientY - startY.current))
  }
  const onHeaderPointerUp = () => {
    if (startY.current != null && dragY > SWIPE_DISMISS_PX) onExit()
    startY.current = null
    setDragY(0)
  }

  return (
    <div className="bl-immersive" role="dialog" aria-modal="true" aria-label={title}>
      <div
        className="bl-immersive-sheet"
        style={dragY ? { transform: `translateY(${dragY}px)` } : undefined}
      >
        <div
          className="bl-immersive-header"
          onPointerDown={onHeaderPointerDown}
          onPointerMove={onHeaderPointerMove}
          onPointerUp={onHeaderPointerUp}
          onPointerCancel={onHeaderPointerUp}
        >
          <button
            type="button"
            className="bl-icon-btn"
            aria-label="Collapse"
            title="Collapse (Esc)"
            onClick={onExit}
          >
            <Glyph name="chevron-down" size={22} />
          </button>
          <span className="bl-immersive-title">{title}</span>
          <span className="bl-immersive-grabber" aria-hidden="true" />
        </div>
        <div className="bl-immersive-body">{children}</div>
      </div>
    </div>
  )
}
