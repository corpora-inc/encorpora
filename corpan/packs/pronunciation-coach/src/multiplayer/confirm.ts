// Parlometron — small in-pack confirm dialog.
//
// `window.confirm()` doesn't render anything in Tauri's WKWebView
// without an explicit UIDelegate hook; the call returns falsy
// immediately and any guarded action becomes a no-op. This is a
// drop-in replacement that draws an actual modal on top of the
// current screen and resolves a Promise<boolean> on user choice.
//
// Used by `round.ts` and `results.ts` for the "Quit this game?"
// prompt on the round-screen X button.

import { tt } from "../i18n"

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

export type ConfirmOpts = {
  message: string
  /** Label for the action button. Default "Confirm". */
  confirmLabel?: string
  /** Label for the cancel button. Default "Cancel". */
  cancelLabel?: string
  /** Tint the action button red — for destructive prompts. */
  destructive?: boolean
}

/**
 * Show a modal confirm dialog. Returns true if the user tapped the
 * action button, false on Cancel / backdrop tap / Escape. The modal
 * is appended to `document.body` and removed after the choice; no
 * leftover DOM regardless of outcome.
 */
export const pmConfirm = (opts: ConfirmOpts): Promise<boolean> => {
  return new Promise<boolean>((resolve) => {
    const root = document.createElement("div")
    root.className = "pc-pm-confirm-root"
    root.innerHTML = `
      <div class="pc-pm-confirm-backdrop" data-pm-confirm-backdrop></div>
      <div class="pc-pm-confirm-sheet" role="alertdialog" aria-modal="true">
        <p class="pc-pm-confirm-msg">${escapeHtml(opts.message)}</p>
        <div class="pc-pm-confirm-foot">
          <button class="pc-pm-confirm-cancel" data-pm-confirm-cancel>
            ${escapeHtml(opts.cancelLabel ?? tt("cancelDefault"))}
          </button>
          <button class="pc-pm-confirm-go ${opts.destructive ? "danger" : ""}"
                  data-pm-confirm-go>
            ${escapeHtml(opts.confirmLabel ?? tt("confirmDefault"))}
          </button>
        </div>
      </div>`
    document.body.appendChild(root)
    // Animate in on the next frame.
    requestAnimationFrame(() => root.classList.add("open"))

    const finish = (val: boolean) => {
      root.classList.remove("open")
      // Wait for the fade-out before removing from DOM.
      window.setTimeout(() => {
        if (root.parentNode) root.parentNode.removeChild(root)
      }, 200)
      window.removeEventListener("keydown", onKey)
      resolve(val)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish(false)
      else if (e.key === "Enter") finish(true)
    }
    window.addEventListener("keydown", onKey)

    root
      .querySelector<HTMLElement>("[data-pm-confirm-backdrop]")
      ?.addEventListener("click", () => finish(false))
    root
      .querySelector<HTMLButtonElement>("[data-pm-confirm-cancel]")
      ?.addEventListener("click", () => finish(false))
    root
      .querySelector<HTMLButtonElement>("[data-pm-confirm-go]")
      ?.addEventListener("click", () => finish(true))
  })
}
