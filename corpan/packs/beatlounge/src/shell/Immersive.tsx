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

import { useEffect, useRef, type ReactNode } from "react"
import { Glyph, Transport } from "../bl-ui"
import { ct } from "../i18n/strings"

interface Props {
  title: string
  onExit: () => void
  children: ReactNode
  /** Global transport — present so you can stop/start the song from any screen. */
  playing?: boolean
  onToggleTransport?: () => void
}

const SWIPE_DISMISS_PX = 90

export const Immersive = ({ title, onExit, children, playing, onToggleTransport }: Props) => {
  const sheetRef = useRef<HTMLDivElement>(null)
  const startY = useRef<number | null>(null)
  const dragY = useRef(0)

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

  // Swipe-down to dismiss. We write the transform DIRECTLY to the node (no React
  // re-render per frame) and kill the CSS transition while dragging, so the
  // sheet tracks the finger 1:1 instead of lagging behind it (the "two copies"
  // jitter). The transition is restored on release for the snap-back.
  const onHeaderPointerDown = (e: React.PointerEvent) => {
    if (e.target instanceof Element && e.target.closest("button")) return
    startY.current = e.clientY
    dragY.current = 0
    const sheet = sheetRef.current
    if (sheet) sheet.style.transition = "none"
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onHeaderPointerMove = (e: React.PointerEvent) => {
    if (startY.current == null) return
    dragY.current = Math.max(0, e.clientY - startY.current)
    const sheet = sheetRef.current
    if (sheet) sheet.style.transform = `translateY(${dragY.current}px)`
  }
  const onHeaderPointerUp = () => {
    const dismissed = startY.current != null && dragY.current > SWIPE_DISMISS_PX
    startY.current = null
    const sheet = sheetRef.current
    if (sheet) {
      sheet.style.transition = ""
      sheet.style.transform = ""
    }
    dragY.current = 0
    if (dismissed) onExit()
  }

  return (
    <div className="bl-immersive" role="dialog" aria-modal="true" aria-label={title}>
      <div className="bl-immersive-sheet" ref={sheetRef}>
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
            aria-label={ct("shell.collapse")}
            title={ct("shell.collapseHint")}
            onClick={onExit}
          >
            <Glyph name="chevron-down" size={22} />
          </button>
          <span className="bl-immersive-title">{title}</span>
          <span className="bl-immersive-grabber" aria-hidden="true" />
          {onToggleTransport && (
            <Transport
              playing={!!playing}
              onToggle={onToggleTransport}
              spaceToToggle={false}
            />
          )}
        </div>
        <div className="bl-immersive-body">{children}</div>
      </div>
    </div>
  )
}
