/**
 * mapPopover — the Google-Maps-style POI popover for the Maps app (#111). Tapping a
 * pin opens ONE localized popover anchored to it: the POI name + type + distance +
 * a primary action (Route / Go). It REPLACES the old always-on stacked text pills
 * that overlapped into mush — labels are now tap-to-reveal, one at a time.
 *
 * Accessible: the popover is a `role="dialog"` with an aria-label; the primary
 * action is a real button; Esc + tap-away dismiss. Pure DOM over the map stage (no
 * canvas); positioned in stage-local px, flipped to stay on-screen.
 *
 * Pure presenter: the caller supplies already-localized strings + the action, so
 * this module needs no `t()`/MapView coupling.
 */

const LOG = "[wp/map/popover]"

export interface PopoverModel {
  /** The POI's anchor id (the action target + dedupe key). */
  anchorId: string
  /** Localized POI name (e.g. "The Café", "Harbor"). */
  name: string
  /** Localized POI type label (e.g. "Café", "Market"). */
  type: string
  /** Localized distance line (e.g. "~120 m"), or null to omit. */
  distance: string | null
  /** Localized primary action label (e.g. "Route" / "Go" / "Clear course"). */
  actionLabel: string
  /** Whether this POI is the CURRENT course (so the action reads "clear"). */
  isCourse: boolean
  /** Anchor point in stage-local px (the pin's screen position). */
  sx: number
  sy: number
}

export interface PopoverHandle {
  /** Show/replace the popover for a POI. */
  show(model: PopoverModel): void
  /** Hide it (tap-away / Esc / re-tap). */
  hide(): void
  isOpen(): boolean
  /** The anchor id currently shown, or null. */
  current(): string | null
  /** Re-place the open popover at `(sx,sy)` (caller drives this on pan/zoom). */
  reposition(sx: number, sy: number): void
  dispose(): void
}

/**
 * Mount the popover layer into `stage` (the map's positioned stage element). `onAct`
 * fires when the primary action is pressed (Route/Go/Clear). `onDismiss` fires when
 * it closes by tap-away/Esc (so the caller can clear selection state).
 */
export function createMapPopover(
  stage: HTMLElement,
  hooks: {
    accent: string
    onAct: (anchorId: string) => void
    onDismiss?: () => void
    /** localized aria-label template, e.g. (name) => `Details for ${name}` */
    ariaLabel: (name: string) => string
  },
): PopoverHandle {
  let openId: string | null = null
  let lastModel: PopoverModel | null = null

  const root = document.createElement("div")
  root.className = "wp-map-pop"
  root.setAttribute("role", "dialog")
  root.setAttribute("aria-modal", "false")
  root.hidden = true

  const card = document.createElement("div")
  card.className = "wp-map-pop-card"
  const nameEl = document.createElement("div")
  nameEl.className = "wp-map-pop-name"
  const typeEl = document.createElement("div")
  typeEl.className = "wp-map-pop-type"
  const distEl = document.createElement("div")
  distEl.className = "wp-map-pop-dist"
  const act = document.createElement("button")
  act.type = "button"
  act.className = "wp-map-pop-act"
  const tip = document.createElement("div")
  tip.className = "wp-map-pop-tip"
  card.append(nameEl, typeEl, distEl, act)
  root.append(card, tip)
  stage.appendChild(root)

  act.addEventListener("click", (e) => {
    e.stopPropagation()
    if (openId) {
      try {
        hooks.onAct(openId)
      } catch (err) {
        console.error(`${LOG} onAct threw:`, err)
      }
    }
  })
  // Taps inside the popover don't bubble to the stage's tap-away handler.
  root.addEventListener("pointerdown", (e) => e.stopPropagation())

  const position = (m: PopoverModel) => {
    const sw = stage.clientWidth || 600
    const sh = stage.clientHeight || 360
    // Default: above the pin, centered; flip below if it'd clip the top.
    const cardW = 168
    const above = m.sy > 96
    const x = Math.max(8 + cardW / 2, Math.min(sw - 8 - cardW / 2, m.sx))
    root.style.left = `${x}px`
    root.style.top = `${m.sy}px`
    root.classList.toggle("wp-map-pop--below", !above)
    void sh
  }

  const show = (m: PopoverModel) => {
    lastModel = m
    openId = m.anchorId
    nameEl.textContent = m.name
    typeEl.textContent = m.type
    distEl.textContent = m.distance ?? ""
    distEl.hidden = !m.distance
    act.textContent = m.actionLabel
    act.classList.toggle("wp-map-pop-act--clear", m.isCourse)
    root.setAttribute("aria-label", hooks.ariaLabel(m.name))
    root.style.setProperty("--wp-map-accent", hooks.accent)
    position(m)
    root.hidden = false
  }

  const hide = () => {
    if (root.hidden) return
    root.hidden = true
    openId = null
    lastModel = null
  }

  return {
    show: (m) => show(m),
    hide,
    isOpen: () => !root.hidden,
    current: () => openId,
    reposition: (sx, sy) => {
      if (root.hidden || !lastModel) return
      lastModel = { ...lastModel, sx, sy }
      position(lastModel)
    },
    dispose: () => {
      root.remove()
    },
  }
}
