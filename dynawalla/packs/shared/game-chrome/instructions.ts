/**
 * How to play, in one place, the same shape in every game.
 *
 * **Why this is shared.** Twenty-seven games each invented their own onboarding
 * or skipped it. SKY LEDGER shipped with a stats panel and the words "THE WATCH
 * IS WRITTEN DOWN" and nothing anywhere telling a child that they name a
 * coordinate on an astrolabe. Nobody can play a game they have not been taught,
 * and a child will not hunt for the rules — they will decide the game is broken
 * and leave.
 *
 * Twenty-seven bespoke panels would be twenty-seven slightly different
 * dismissals, twenty-seven type scales and twenty-seven bugs. So the *shape* is
 * here and the *content* is the game's, because "keep your side heavier" and
 * "draw only if the statement is true" are different lessons and cannot be
 * shared.
 *
 * **The two surfaces**, because one size does not fit:
 *   - `summary` — one or two lines, the splash. Enough to make the first move.
 *   - `sections` — the manual, behind a button. For games whose rules do not
 *     fit on a splash, which is most of the good ones.
 *
 * The manual stays reachable *during* play, not only before it. A child who
 * needs the rules needs them at the moment they are stuck, which is never the
 * title screen.
 */

import { safeInsets, onInsetsChange } from "./insets.ts"

export type Section = { heading: string; lines: readonly string[] }

export type InstructionsSpec = {
  /** The game's name, as the child sees it. */
  readonly title: string
  /** One or two lines. The whole point of the game, in plain words. */
  readonly summary: readonly string[]
  /** The manual. Omit for a game whose summary really is the whole rule set. */
  readonly sections?: readonly Section[]
  /** Called when the panel closes, so a game can resume. */
  readonly onClose?: () => void
  /** Skip the entrance transition. Pass `host.prefersReducedMotion()`. */
  readonly reducedMotion?: boolean
}

export type Instructions = {
  /** Open the manual. Safe to call when already open. */
  open(): void
  /** Close it. Safe to call when already closed. */
  close(): void
  readonly isOpen: boolean
  /** Remove every node and listener. Call from `unmount`. */
  destroy(): void
}

const FONT = "system-ui,-apple-system,'Segoe UI',sans-serif"

function styleSheet(reduced: boolean): string {
  // Motion is a branch, not a degradation: reduced motion still gets a
  // cross-fade so the panel does not appear without explanation, it just does
  // not travel. `EXPERIENCE_DESIGN.md` is explicit that switching animation off
  // entirely is the wrong reading.
  const enter = reduced ? "dwc-fade 160ms ease-out" : "dwc-rise 220ms cubic-bezier(.2,.8,.2,1)"
  return `
.dwc-scrim{position:absolute;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;
  background:rgba(4,6,12,.72);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);
  font-family:${FONT};color:#f2eee4;overscroll-behavior:contain}
/* The panel is hidden with the \`hidden\` attribute, and an author \`display\`
   BEATS the user agent's \`[hidden]{display:none}\` — so without this rule the
   scrim is painted over the game from the moment it mounts, at z-index 40,
   swallowing every touch. \`doClose\` cannot rescue it either: it returns early
   while \`open\` is false, so the PLAY button does nothing. Verified in headless
   Chrome: with the attribute set, computed display was \`flex\`. */
.dwc-scrim[hidden]{display:none}
.dwc-panel{position:relative;max-width:min(46rem,92vw);max-height:82vh;overflow-y:auto;overscroll-behavior:contain;
  -webkit-overflow-scrolling:touch;border-radius:18px;border:1px solid rgba(255,255,255,.14);
  background:linear-gradient(#141a26,#0d111a);box-shadow:0 24px 70px rgba(0,0,0,.6);
  padding:clamp(20px,4vw,34px);animation:${enter}}
.dwc-title{margin:0 0 .5rem;font-size:clamp(1.35rem,4.4vw,2rem);font-weight:800;letter-spacing:-.02em}
.dwc-sum{margin:0 0 1.25rem;font-size:clamp(1rem,2.9vw,1.15rem);line-height:1.55;color:#d9e2f0}
.dwc-sum p{margin:.3rem 0}
.dwc-sec{margin:1.15rem 0 0}
.dwc-h{margin:0 0 .35rem;font-size:.78rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#8fa3c4}
.dwc-l{margin:0;padding-left:1.1rem;line-height:1.6;font-size:clamp(.95rem,2.6vw,1.05rem)}
.dwc-l li{margin:.28rem 0}
.dwc-close{margin-top:1.6rem;width:100%;min-height:52px;border:0;border-radius:12px;cursor:pointer;
  font:800 1rem/1 ${FONT};letter-spacing:.03em;color:#0b1020;background:#f3d089}
.dwc-close:focus-visible{outline:3px solid #f3d089;outline-offset:3px}
.dwc-help{position:absolute;z-index:30;min-width:44px;min-height:44px;border-radius:50%;
  border:1px solid rgba(255,255,255,.2);background:rgba(10,14,22,.62);color:#f2eee4;
  font:800 1.05rem/1 ${FONT};cursor:pointer;display:flex;align-items:center;justify-content:center}
.dwc-help:focus-visible{outline:3px solid #f3d089;outline-offset:2px}
@keyframes dwc-rise{from{opacity:0;transform:translateY(14px) scale(.985)}to{opacity:1;transform:none}}
@keyframes dwc-fade{from{opacity:0}to{opacity:1}}
@media (prefers-reduced-motion:reduce){.dwc-panel{animation:dwc-fade 160ms ease-out}}
`
}

/**
 * Mount the instructions surface into `root`.
 *
 * Adds a persistent help button positioned inside the safe area, and a panel it
 * opens. The button is 44px minimum in both axes — the smallest target a child
 * reliably hits, and the platform floor.
 */
export function createInstructions(root: HTMLElement, spec: InstructionsSpec): Instructions {
  const reduced = spec.reducedMotion === true
  const style = document.createElement("style")
  style.textContent = styleSheet(reduced)
  root.appendChild(style)

  const help = document.createElement("button")
  help.type = "button"
  help.className = "dwc-help"
  help.textContent = "?"
  help.setAttribute("aria-label", `How to play ${spec.title}`)

  const scrim = document.createElement("div")
  scrim.className = "dwc-scrim"
  scrim.hidden = true

  const panel = document.createElement("div")
  panel.className = "dwc-panel"
  panel.setAttribute("role", "dialog")
  panel.setAttribute("aria-modal", "true")
  panel.setAttribute("aria-label", `How to play ${spec.title}`)
  panel.tabIndex = -1

  const h = document.createElement("h2")
  h.className = "dwc-title"
  h.textContent = spec.title
  panel.appendChild(h)

  const sum = document.createElement("div")
  sum.className = "dwc-sum"
  for (const line of spec.summary) {
    const p = document.createElement("p")
    p.textContent = line
    sum.appendChild(p)
  }
  panel.appendChild(sum)

  for (const sec of spec.sections ?? []) {
    const wrap = document.createElement("section")
    wrap.className = "dwc-sec"
    const sh = document.createElement("h3")
    sh.className = "dwc-h"
    sh.textContent = sec.heading
    const ul = document.createElement("ul")
    ul.className = "dwc-l"
    for (const line of sec.lines) {
      const li = document.createElement("li")
      li.textContent = line
      ul.appendChild(li)
    }
    wrap.append(sh, ul)
    panel.appendChild(wrap)
  }

  const close = document.createElement("button")
  close.type = "button"
  close.className = "dwc-close"
  close.textContent = "PLAY"
  panel.appendChild(close)
  scrim.appendChild(panel)
  root.append(help, scrim)

  // The help button sits inside the safe area, not merely inside the canvas.
  // Top-right is the one corner no game here puts a primary control in.
  const place = (): void => {
    const i = safeInsets()
    help.style.top = `${i.top + 10}px`
    help.style.right = `${i.right + 10}px`
  }
  place()
  const stopInsets = onInsetsChange(place)

  let open = false
  let restore: HTMLElement | null = null

  const doOpen = (): void => {
    if (open) return
    open = true
    restore = (document.activeElement as HTMLElement) ?? null
    scrim.hidden = false
    help.setAttribute("aria-expanded", "true")
    panel.scrollTop = 0
    panel.focus()
  }

  const doClose = (): void => {
    if (!open) return
    open = false
    scrim.hidden = true
    help.setAttribute("aria-expanded", "false")
    restore?.focus?.()
    restore = null
    spec.onClose?.()
  }

  // A tap on the scrim closes; a tap inside the panel must not. Children tap
  // the background constantly and being thrown out of the rules mid-read is
  // worse than having to find the button.
  const onScrim = (e: Event): void => {
    if (e.target === scrim) doClose()
  }
  const onKey = (e: KeyboardEvent): void => {
    if (!open) return
    if (e.key === "Escape") {
      e.preventDefault()
      doClose()
      return
    }
    // Keep focus in the dialog while it is modal.
    if (e.key === "Tab") {
      e.preventDefault()
      close.focus()
    }
  }

  help.addEventListener("click", doOpen)
  close.addEventListener("click", doClose)
  scrim.addEventListener("pointerdown", onScrim)
  globalThis.addEventListener("keydown", onKey)

  return {
    open: doOpen,
    close: doClose,
    get isOpen(): boolean {
      return open
    },
    destroy(): void {
      stopInsets()
      globalThis.removeEventListener("keydown", onKey)
      help.removeEventListener("click", doOpen)
      close.removeEventListener("click", doClose)
      scrim.removeEventListener("pointerdown", onScrim)
      help.remove()
      scrim.remove()
      style.remove()
    },
  }
}
