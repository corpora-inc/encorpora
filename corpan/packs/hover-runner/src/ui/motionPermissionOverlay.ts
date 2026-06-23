/**
 * First-run motion-permission overlay.
 *
 * iOS WKWebView refuses to honour `DeviceOrientationEvent.requestPermission()`
 * from any listener except one attached directly to a real `<button>`
 * the user explicitly taps — every other gesture surface in the pack
 * (canvas pointerdown, root capture-phase, etc.) gets its activation
 * eaten by other handlers (audio unlock, Babylon's own pointer wiring)
 * before our call lands. So we put a real button in the user's path.
 *
 * The overlay is state-driven and PERSISTS through denial/error so
 * the user always sees a clear outcome. States:
 *
 *   - "pristine"      — initial; show title + body + Enable Motion + Use touch
 *   - "requesting"    — Enable was tapped; button disabled, "Asking iOS…" hint
 *   - "denied"        — fresh deny (user saw the prompt and tapped Don't Allow)
 *   - "error"         — requestPermission threw or rejected with non-deny
 *
 * The overlay closes automatically only on grant. In denial/error
 * states the caller (game.ts) can drive a retry by tapping Try Again,
 * which fires onAllow again.
 */

import { t, onChange as onLangChange } from "../i18n"
import type { TiltState } from "../systems/input"

export type MotionOverlayUiState =
  | "pristine"
  | "requesting"
  | "denied"
  | "error"

export type MotionPermissionOverlayOpts = {
  parent: HTMLElement
  onAllow: () => void
  onDismiss: () => void
}

export type MotionPermissionOverlay = {
  hide: () => void
  /** Drive overlay UI from the input layer's TiltState. */
  setTiltState: (state: TiltState) => void
  dispose: () => void
}

export function createMotionPermissionOverlay(
  opts: MotionPermissionOverlayOpts,
): MotionPermissionOverlay {
  let uiState: MotionOverlayUiState = "pristine"

  const backdrop = document.createElement("div")
  backdrop.className = "hr-motion-overlay"

  const card = document.createElement("div")
  card.className = "hr-motion-overlay-card"
  card.setAttribute("role", "dialog")
  card.setAttribute("aria-modal", "true")

  const glyph = document.createElement("div")
  glyph.className = "hr-motion-overlay-glyph"
  glyph.setAttribute("aria-hidden", "true")
  glyph.innerHTML = `
    <svg viewBox="0 0 64 64" width="48" height="48">
      <defs>
        <radialGradient id="hr-mo-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="rgba(127, 214, 255, 0.45)"/>
          <stop offset="100%" stop-color="rgba(127, 214, 255, 0)"/>
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill="url(#hr-mo-glow)"/>
      <g transform="rotate(-12 32 32)">
        <rect x="20" y="10" width="24" height="44" rx="4" ry="4"
          fill="none" stroke="#7fd6ff" stroke-width="1.6"/>
        <rect x="24" y="14" width="16" height="32" rx="1.5"
          fill="rgba(127, 214, 255, 0.12)"/>
        <circle cx="32" cy="50" r="1.6" fill="#7fd6ff"/>
      </g>
      <path d="M14 36 Q32 30 50 36" fill="none"
        stroke="rgba(127, 214, 255, 0.55)" stroke-width="1.2"
        stroke-dasharray="2 3" stroke-linecap="round"/>
    </svg>
  `

  const title = document.createElement("h2")
  title.className = "hr-motion-overlay-title"

  const body = document.createElement("p")
  body.className = "hr-motion-overlay-body"

  // Primary action — Enable / Try Again — keep as ONE button. Its
  // click handler is the user-gesture surface iOS requires; it must
  // call onAllow synchronously, with no awaits or microtask gaps.
  const allowBtn = document.createElement("button")
  allowBtn.className = "hr-motion-overlay-allow"
  allowBtn.type = "button"
  allowBtn.dataset.hrMotionPermissionTrigger = "true"
  allowBtn.addEventListener("pointerdown", (event) => {
    event.stopPropagation()
  })
  allowBtn.addEventListener("click", () => {
    if (uiState === "requesting") return
    setUiState("requesting")
    opts.onAllow()
  })

  const dismissBtn = document.createElement("button")
  dismissBtn.className = "hr-motion-overlay-dismiss"
  dismissBtn.type = "button"
  dismissBtn.addEventListener("click", () => {
    opts.onDismiss()
    hide()
  })

  card.append(glyph, title, body, allowBtn, dismissBtn)
  backdrop.appendChild(card)
  opts.parent.appendChild(backdrop)

  function strings(state: MotionOverlayUiState): {
    title: string
    body: string
    allow: string
    dismiss: string
  } {
    switch (state) {
      case "pristine":
        return {
          title: t("motion.overlay.title"),
          body: t("motion.overlay.body"),
          allow: t("motion.overlay.allow"),
          dismiss: t("motion.overlay.dismiss"),
        }
      case "requesting":
        return {
          title: t("motion.overlay.title"),
          body: t("motion.overlay.requesting"),
          allow: t("motion.overlay.allow"),
          dismiss: t("motion.overlay.dismiss"),
        }
      case "denied":
        return {
          title: t("motion.overlay.denied_title"),
          body: t("motion.overlay.denied_body"),
          allow: t("motion.overlay.retry"),
          dismiss: t("motion.overlay.dismiss"),
        }
      case "error":
        return {
          title: t("motion.overlay.error_title"),
          body: t("motion.overlay.error_body"),
          allow: t("motion.overlay.retry"),
          dismiss: t("motion.overlay.dismiss"),
        }
    }
  }

  function paint() {
    const s = strings(uiState)
    title.textContent = s.title
    body.textContent = s.body
    allowBtn.textContent = s.allow
    dismissBtn.textContent = s.dismiss
    allowBtn.disabled = uiState === "requesting"
    card.dataset.state = uiState
    backdrop.dataset.state = uiState
  }

  function setUiState(next: MotionOverlayUiState) {
    if (uiState === next) return
    uiState = next
    paint()
  }

  paint()

  // Trigger the entrance animation on the next frame.
  requestAnimationFrame(() => {
    backdrop.classList.add("hr-motion-overlay--shown")
  })

  const unsubLang = onLangChange(() => paint())

  let hidden = false
  function hide() {
    if (hidden) return
    hidden = true
    backdrop.classList.remove("hr-motion-overlay--shown")
    backdrop.classList.add("hr-motion-overlay--hiding")
    window.setTimeout(() => {
      backdrop.remove()
      unsubLang()
    }, 280)
  }

  function setTiltState(state: TiltState) {
    if (hidden) return
    switch (state) {
      case "waiting":
      case "active":
        // Permission was granted and the listener is live. Don't make
        // the player wiggle the device just to dismiss the invite.
        hide()
        return
      case "denied":
        setUiState("denied")
        return
      case "error":
        setUiState("error")
        return
      case "pending":
        setUiState("requesting")
        return
      case "off":
        // No change; keep current overlay state.
        return
    }
  }

  return {
    hide,
    setTiltState,
    dispose: () => {
      unsubLang()
      backdrop.remove()
    },
  }
}
