/**
 * beatlounge — the inline HEADER STATUS line: a non-blocking, LLM-stream-style
 * status that types itself out right in the track-editor header (next to the
 * track's coloured light), REPLACING the floating toast on these panes. Floating
 * toasts overlapped the controls and got in the way of rapid +/- density taps;
 * this lives in the header chrome, never covers a button, and never reflows the
 * layout (it's a single clipped line).
 *
 * `useHeaderStatus()` hands the pane a `notify(text, undo?)` — wire it where you'd
 * call `host.toast`, or wrap the host with `withHeaderToast` so EVERY toast from
 * the pane (incl. embedded panels like Grooves) streams here instead. The reveal
 * is a cheap per-char timer (transform/opacity only); rapid notifies just replace
 * the target, so hammering +/- keeps one tidy streaming line.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import type { BeatloungeHost } from "../../contracts/module"
import { Glyph } from "../../bl-ui"

interface StatusState {
  id: number
  text: string
  undo?: () => void
}

export interface HeaderStatusController {
  notify: (text: string, undo?: () => void) => void
  dismiss: () => void
  status: StatusState | null
  shownLen: number
}

export const useHeaderStatus = (): HeaderStatusController => {
  const [status, setStatus] = useState<StatusState | null>(null)
  const [shownLen, setShownLen] = useState(0)
  const idRef = useRef(0)

  const notify = useCallback((text: string, undo?: () => void) => {
    const trimmed = text.trim()
    if (!trimmed) return
    idRef.current += 1
    setStatus({ id: idRef.current, text: trimmed, undo })
    setShownLen(0)
  }, [])

  const dismiss = useCallback(() => setStatus(null), [])

  // Typewriter reveal, then auto-dismiss. Each step is one setState of an index;
  // a fresh notify resets it. (No interval — a self-rescheduling timeout so a new
  // message cleanly interrupts.)
  useEffect(() => {
    if (!status) return
    if (shownLen < status.text.length) {
      const t = setTimeout(() => setShownLen((n) => n + 1), 20)
      return () => clearTimeout(t)
    }
    const t = setTimeout(
      () => setStatus((s) => (s && s.id === status.id ? null : s)),
      status.undo ? 4200 : 2400
    )
    return () => clearTimeout(t)
  }, [status, shownLen])

  return { notify, dismiss, status, shownLen }
}

/** Render the streaming line. Place it inside the header's `.bl-grid-title`,
 *  right after the track dot. Renders nothing when idle. */
export const HeaderStatusLine = ({ ctl }: { ctl: HeaderStatusController }) => {
  const { status, shownLen } = ctl
  if (!status) return null
  const shown = status.text.slice(0, shownLen)
  const streaming = shownLen < status.text.length
  return (
    <span className="bl-hstatus" role="status" aria-live="polite">
      <span className="bl-hstatus-text">{shown}</span>
      {streaming && <span className="bl-hstatus-caret" aria-hidden="true" />}
      {!streaming && status.undo && (
        <button
          type="button"
          className="bl-hstatus-undo"
          aria-label="Undo"
          title="Undo"
          onClick={() => {
            status.undo?.()
            ctl.dismiss()
          }}
        >
          <Glyph name="undo" size={13} />
        </button>
      )}
    </span>
  )
}

/** Wrap a host so its `toast` streams into the header instead of floating. Every
 *  other host capability passes straight through (Proxy keeps `this`). */
export const withHeaderToast = (
  host: BeatloungeHost,
  notify: (text: string, undo?: () => void) => void
): BeatloungeHost =>
  new Proxy(host, {
    get(target, prop, recv) {
      if (prop === "toast") {
        return (message: string, opts?: { undo?: () => void }) =>
          notify(message, opts?.undo)
      }
      const value = Reflect.get(target, prop, recv)
      return typeof value === "function" ? value.bind(target) : value
    },
  })
