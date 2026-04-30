import { el } from "./dom"

export type AlertOptions = {
  title: string
  body?: string
  actionLabel?: string
  onAction?: () => void
}

const ICON_WARN =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 1 21h22L12 2zm0 6 7.5 13h-15L12 8zm-1 4v4h2v-4h-2zm0 5v2h2v-2h-2z"/></svg>'

export function createAlert(opts: AlertOptions): HTMLElement {
  const root = el("div", { class: "wr-alert", role: "alert" })

  const icon = el("span", { class: "wr-alert-icon", html: ICON_WARN })
  root.appendChild(icon)

  const body = el("div", { class: "wr-alert-body" })
  body.appendChild(el("div", { class: "wr-alert-title" }, [opts.title]))
  if (opts.body) {
    body.appendChild(el("div", { class: "wr-alert-text" }, [opts.body]))
  }
  if (opts.actionLabel && opts.onAction) {
    const action = el("button", {
      class: "wr-alert-action",
      type: "button",
    }, [opts.actionLabel])
    action.addEventListener("click", () => opts.onAction?.())
    body.appendChild(action)
  }
  root.appendChild(body)
  return root
}
