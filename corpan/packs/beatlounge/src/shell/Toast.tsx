/**
 * beatlounge — the toast layer. Dignified, transient messages (noisy-not-
 * silent), optionally with a single Undo affordance. One toast at a time;
 * a new toast replaces the current. Auto-dismisses after a fixed window AND
 * can be closed by hand (the × on the left). Sits on --bl-z-toast.
 */

import { useEffect, useRef } from "react"

export interface ToastState {
  id: number
  message: string
  undo?: () => void
}

/** Auto-dismiss window. Long enough to read + reach Undo, then it goes. */
const DISMISS_MS = 10000

export const Toast = ({
  toast,
  onDismiss,
}: {
  toast: ToastState | null
  onDismiss: () => void
}) => {
  // Hold the LATEST onDismiss in a ref so the dismiss timer does NOT depend on
  // its identity. The Shell re-creates onDismiss every render and re-renders
  // often (playhead/doc), so depending on it reset the timer every frame and the
  // toast never dismissed. Key the timer on the toast id alone.
  const dismissRef = useRef(onDismiss)
  dismissRef.current = onDismiss

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => dismissRef.current(), DISMISS_MS)
    return () => clearTimeout(t)
  }, [toast?.id])

  if (!toast) return null

  return (
    <div className="bl-toast-layer" aria-live="polite">
      <div className="bl-toast" role="status" key={toast.id}>
        <button
          type="button"
          className="bl-toast-close"
          aria-label="Dismiss"
          onClick={onDismiss}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path
              d="M3 3l8 8M11 3l-8 8"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        </button>
        <span className="bl-toast-msg">{toast.message}</span>
        {toast.undo && (
          <button
            type="button"
            className="bl-toast-undo"
            onClick={() => {
              toast.undo?.()
              onDismiss()
            }}
          >
            Undo
          </button>
        )}
      </div>
    </div>
  )
}
