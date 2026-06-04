/**
 * wpConfirm — World Plaza's in-pack confirm modal.
 *
 * NEVER `window.confirm` (project rule: it silently no-ops in Tauri's WKWebView
 * and looks like a system alert anywhere it renders). This draws a real
 * paper-cutout modal over the world and resolves a `Promise<boolean>`.
 *
 * The same no-layout-shift discipline as the dialogue panel applies: the modal
 * mounts `position: fixed` from its first painted frame (it can never push the
 * canvas), and open/close is compositor-only (opacity + a small scale on the
 * card — transform/opacity, never width/height/flow). Inputs aren't focused, so
 * there is no scroll-jump surface at all.
 *
 *   ESC / backdrop tap / Cancel → false
 *   Enter / Confirm tap         → true
 *
 * Styles are injected once, scoped under `.wp-confirm-`, so this file is fully
 * self-contained (no separate .css to wire into the manifest).
 */

export type WpConfirmOpts = {
  message: string
  /** Optional title line above the message. */
  title?: string
  /** Action button label. Default "OK". */
  confirmLabel?: string
  /** Cancel button label. Default "Cancel". */
  cancelLabel?: string
  /** Tint the action button as destructive (warm red). */
  destructive?: boolean
  /**
   * Where to mount the modal. THE FIX (M0): when embedded in the Corpán host,
   * `document.body`-appended fixed children are clipped by the host's
   * `ContentPackHost` container (its own stacking context + overflow/transform),
   * so the confirm could paint invisible — exactly the bug that hid the exit.
   * Pass the game's `.wp-overlay` (the host's accepted render surface) so the
   * confirm lives in the in-overlay band and can never be clipped away. Defaults
   * to `document.body` only for standalone callers that have no overlay.
   */
  mountParent?: HTMLElement
}

const STYLE_ID = "wp-confirm-styles"

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement("style")
  style.id = STYLE_ID
  style.textContent = CSS
  document.head.appendChild(style)
}

const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  )

/**
 * Show the modal. Mounts into `opts.mountParent` (the game's `.wp-overlay` when
 * embedded — the host's accepted render surface, immune to the host clip that
 * killed the old body-fixed modals) or `document.body` for standalone callers
 * with no overlay. Removes itself after the choice — no leftover DOM on either
 * outcome.
 */
export function wpConfirm(opts: WpConfirmOpts | string): Promise<boolean> {
  const o: WpConfirmOpts = typeof opts === "string" ? { message: opts } : opts
  ensureStyles()
  const mountParent = o.mountParent ?? document.body

  return new Promise<boolean>((resolve) => {
    const root = document.createElement("div")
    root.className = "wp-confirm-root"
    root.innerHTML = `
      <div class="wp-confirm-scrim" data-wp-confirm-cancel></div>
      <div class="wp-confirm-card" role="alertdialog" aria-modal="true">
        ${o.title ? `<div class="wp-confirm-title">${escapeHtml(o.title)}</div>` : ""}
        <p class="wp-confirm-msg">${escapeHtml(o.message)}</p>
        <div class="wp-confirm-foot">
          <button class="wp-confirm-cancel" data-wp-confirm-cancel>${escapeHtml(
            o.cancelLabel ?? "Cancel",
          )}</button>
          <button class="wp-confirm-go${o.destructive ? " wp-confirm-danger" : ""}" data-wp-confirm-go>${escapeHtml(
            o.confirmLabel ?? "OK",
          )}</button>
        </div>
      </div>`
    mountParent.appendChild(root)
    // When mounted inside `.wp-overlay`, stop pointer gestures at the modal root
    // so a press on the scrim/buttons can't reach the overlay's dual-joystick
    // input (which would capture the pointer + spawn a phantom stick / leak a
    // tap to the world). Harmless when mounted on document.body.
    const swallow = (e: Event) => e.stopPropagation()
    root.addEventListener("pointerdown", swallow)
    root.addEventListener("pointerup", swallow)
    // Animate in on the next frame (so the from-state paints first).
    requestAnimationFrame(() => root.classList.add("wp-confirm-open"))

    let settled = false
    const finish = (val: boolean) => {
      if (settled) return
      settled = true
      root.classList.remove("wp-confirm-open")
      document.removeEventListener("keydown", onKey, true)
      // Wait out the fade before removing.
      window.setTimeout(() => root.remove(), 220)
      resolve(val)
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        e.stopPropagation()
        finish(false)
      } else if (e.key === "Enter") {
        e.preventDefault()
        e.stopPropagation()
        finish(true)
      }
    }
    // Capture phase so the pack's other Escape listeners don't also fire.
    document.addEventListener("keydown", onKey, true)

    root.querySelectorAll<HTMLElement>("[data-wp-confirm-cancel]").forEach((el) =>
      el.addEventListener("click", () => finish(false)),
    )
    root
      .querySelector<HTMLButtonElement>("[data-wp-confirm-go]")
      ?.addEventListener("click", () => finish(true))

    // Give the action button initial focus (preventScroll = no jump). Buttons
    // never raise the soft keyboard, so this is touch-safe.
    requestAnimationFrame(() => {
      try {
        root
          .querySelector<HTMLButtonElement>("[data-wp-confirm-go]")
          ?.focus({ preventScroll: true })
      } catch {
        /* focus is best-effort */
      }
    })
  })
}

const CSS = `
.wp-confirm-root {
  position: absolute;
  inset: 0;
  /* TOP of the in-overlay band (styles.css :root) — above the menu panel (which
   * may be open behind it) and all in-world chrome. ABSOLUTE (not fixed) so it
   * fills the .wp-overlay it mounts into and inherits the host's accepted
   * render surface — structurally immune to the host clip that killed the old
   * body-fixed modals. Literal fallback keeps it on top if the var is absent. */
  z-index: var(--wp-z-confirm, 80);
  display: grid;
  place-items: center;
  pointer-events: none;
  font-family: ui-rounded, "SF Pro Rounded", "Nunito", system-ui, -apple-system, sans-serif;
  color: #3a2f25;
}
.wp-confirm-scrim {
  position: absolute;
  inset: 0;
  background: radial-gradient(120% 100% at 50% 50%, rgba(30, 22, 14, 0.42), rgba(30, 22, 14, 0.18));
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: auto;
}
.wp-confirm-root.wp-confirm-open .wp-confirm-scrim { opacity: 1; }
.wp-confirm-card {
  position: relative;
  pointer-events: auto;
  width: min(360px, calc(100vw - 48px));
  margin: 0 24px;
  padding: 22px 22px 16px;
  background: linear-gradient(180deg, #f7efe0, #efe3cd);
  border-radius: 22px;
  box-shadow: 0 20px 60px rgba(58, 47, 37, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.6);
  text-align: center;
  opacity: 0;
  transform: scale(0.94) translateY(8px);
  transition: opacity 0.2s ease, transform 0.24s cubic-bezier(0.22, 1, 0.36, 1);
  will-change: transform, opacity;
}
.wp-confirm-root.wp-confirm-open .wp-confirm-card {
  opacity: 1;
  transform: scale(1) translateY(0);
}
.wp-confirm-title {
  font-weight: 800;
  font-size: 18px;
  margin-bottom: 6px;
}
.wp-confirm-msg {
  margin: 0 0 18px;
  font-size: 15.5px;
  line-height: 1.45;
  color: #4a3c2e;
}
.wp-confirm-foot {
  display: flex;
  gap: 10px;
  justify-content: center;
}
.wp-confirm-foot button {
  flex: 1 1 0;
  min-height: 46px;
  padding: 12px 16px;
  border-radius: 14px;
  border: none;
  font: 700 15px/1 inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: transform 0.1s ease, filter 0.15s ease, background 0.15s ease;
}
.wp-confirm-cancel {
  background: rgba(122, 106, 85, 0.16);
  color: #4a3c2e;
}
.wp-confirm-cancel:hover { background: rgba(122, 106, 85, 0.26); }
.wp-confirm-go {
  background: linear-gradient(180deg, #d6855f, #c46b4a);
  color: #fff7f0;
  box-shadow: 0 4px 14px rgba(196, 107, 74, 0.4);
}
.wp-confirm-go.wp-confirm-danger {
  background: linear-gradient(180deg, #d75a4a, #b8402f);
  box-shadow: 0 4px 14px rgba(184, 64, 47, 0.45);
}
.wp-confirm-foot button:active { transform: scale(0.96); }
.wp-confirm-foot button:focus-visible { outline: 2px solid #c46b4a; outline-offset: 2px; }

@media (hover: none) {
  .wp-confirm-cancel:hover { background: rgba(122, 106, 85, 0.16); }
}
@media (prefers-reduced-motion: reduce) {
  .wp-confirm-scrim, .wp-confirm-card { transition: opacity 0.16s ease; }
  .wp-confirm-card { transform: none; }
  .wp-confirm-root.wp-confirm-open .wp-confirm-card { transform: none; }
}
`
