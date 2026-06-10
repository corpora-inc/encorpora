/**
 * beatlounge — the toast layer. Dignified, transient messages (noisy-not-
 * silent), optionally with a single Undo affordance. One toast at a time;
 * a new toast replaces the current. Auto-dismisses; sits on --bl-z-toast.
 */

import { useEffect } from "react"

export interface ToastState {
  id: number
  message: string
  undo?: () => void
}

export const Toast = ({
  toast,
  onDismiss,
}: {
  toast: ToastState | null
  onDismiss: () => void
}) => {
  useEffect(() => {
    if (!toast) return
    const ms = toast.undo ? 5200 : 2600
    const t = setTimeout(onDismiss, ms)
    return () => clearTimeout(t)
  }, [toast, onDismiss])

  if (!toast) return null

  return (
    <div className="bl-toast-layer" aria-live="polite">
      <div className="bl-toast" role="status" key={toast.id}>
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
