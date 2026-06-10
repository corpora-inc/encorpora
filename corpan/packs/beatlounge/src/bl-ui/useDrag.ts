/**
 * beatlounge — pointer-capture drag hook for radial / linear controls.
 *
 * Captures the pointer on press and reports total dx/dy deltas (px) plus the
 * raw event, until release. Honors the GAME_DEV_PLAYBOOK chrome-bail guard:
 * if the press lands on a button / link / input / [role=button] /
 * [data-bl-nocapture], it does NOT capture (so taps on chrome stay taps).
 *
 * Works for mouse, touch, and pen via Pointer Events. The hook owns no React
 * state; the caller maps deltas to a value and re-renders.
 */

import { useCallback, useRef } from "react"

export interface DragHandlers {
  onPointerDown: (e: React.PointerEvent) => void
}

export interface DragCallbacks {
  /** Press began (after the chrome-bail check passes). */
  onStart?: (e: React.PointerEvent) => void
  /** Pointer moved: dx/dy are deltas from the press origin, in CSS px. */
  onMove: (delta: { dx: number; dy: number }, e: PointerEvent) => void
  /** Released. `moved` is false for a clean tap (no drag past threshold). */
  onEnd?: (moved: boolean, e: PointerEvent) => void
}

const CHROME_SELECTOR = 'button,a,input,select,textarea,[role="button"],[data-bl-nocapture]'

const isChromeTarget = (target: EventTarget | null, self: EventTarget): boolean => {
  if (!(target instanceof Element)) return false
  const hit = target.closest(CHROME_SELECTOR)
  if (hit == null || hit === self) return false
  // Only bail for chrome NESTED INSIDE the drag surface (e.g. a button inside a
  // draggable row). An ANCESTOR marked [data-bl-nocapture] — like the .bl-knob
  // wrapper around its own dial — must not cancel the control's own drag.
  return self instanceof Element ? self.contains(hit) : false
}

export const useDrag = (callbacks: DragCallbacks, moveThreshold = 3): DragHandlers => {
  const ref = useRef(callbacks)
  ref.current = callbacks

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Pointer-capture bail: never steal a press destined for chrome.
      if (isChromeTarget(e.target, e.currentTarget)) return
      // Ignore secondary buttons (right-click / multi-touch beyond the first).
      if (e.button != null && e.button > 0) return

      const el = e.currentTarget as HTMLElement
      const startX = e.clientX
      const startY = e.clientY
      let moved = false

      try {
        el.setPointerCapture(e.pointerId)
      } catch {
        /* capture may fail in tests — proceed without it */
      }
      ref.current.onStart?.(e)

      const move = (ev: PointerEvent) => {
        const dx = ev.clientX - startX
        const dy = ev.clientY - startY
        if (!moved && Math.hypot(dx, dy) > moveThreshold) moved = true
        ref.current.onMove({ dx, dy }, ev)
      }
      const up = (ev: PointerEvent) => {
        el.removeEventListener("pointermove", move)
        el.removeEventListener("pointerup", up)
        el.removeEventListener("pointercancel", up)
        try {
          el.releasePointerCapture(e.pointerId)
        } catch {
          /* ignore */
        }
        ref.current.onEnd?.(moved, ev)
      }

      el.addEventListener("pointermove", move)
      el.addEventListener("pointerup", up)
      el.addEventListener("pointercancel", up)
      e.preventDefault()
    },
    [moveThreshold]
  )

  return { onPointerDown }
}

/** Read the user's reduced-motion preference (live, not memoized). */
export const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches
