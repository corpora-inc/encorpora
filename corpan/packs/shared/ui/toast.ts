/**
 * Lightweight toast — single function, no framework, no deps.
 *
 * Themed via the existing `--catalog-*` CSS custom properties so it inherits
 * earthgate / stargate looks automatically. Tap to dismiss, otherwise auto-
 * dismisses after `duration`.
 *
 * Used for surface of install / purchase failures where a silent red button
 * would leave the user (and us) guessing.
 */

import "./toast.css"

export type ToastKind = "info" | "error" | "success"

export type ToastOptions = {
  kind?: ToastKind
  /** Optional technical detail — rendered smaller, under the primary message. */
  detail?: string
  /** ms before auto-dismiss. Defaults: 4500 for info/success, 8000 for error. */
  duration?: number
}

export function showToast(message: string, opts: ToastOptions = {}): void {
  const kind = opts.kind ?? "info"
  const duration =
    opts.duration ?? (kind === "error" ? 8000 : 4500)

  const toast = document.createElement("div")
  toast.className = `corpan-toast corpan-toast--${kind}`

  const msg = document.createElement("div")
  msg.className = "corpan-toast-message"
  msg.textContent = message
  toast.appendChild(msg)

  if (opts.detail) {
    const det = document.createElement("div")
    det.className = "corpan-toast-detail"
    det.textContent = opts.detail
    toast.appendChild(det)
  }

  document.body.appendChild(toast)
  requestAnimationFrame(() => toast.classList.add("corpan-toast--visible"))

  let timer: ReturnType<typeof setTimeout> | null = setTimeout(dismiss, duration)
  toast.addEventListener("click", dismiss)

  function dismiss() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    toast.classList.remove("corpan-toast--visible")
    setTimeout(() => toast.remove(), 200)
  }
}
