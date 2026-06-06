/**
 * phoneSheet — the in-world "Phone": a little PHONE SIMULATOR that is the single
 * in-game menu. The player opens it from ONE corner FAB (`phoneFab.ts`, the Corpán
 * brand mark) and lands on a HOME SCREEN: a grid of app icons. Tap an app → it
 * slides in over a single body region; a back chevron returns home. Apps = Map,
 * Things (Inventory), Quest, Badges, Music today; Mail/Calls/etc. slot in later as
 * just another `PhoneApp` in the `apps` array — the shell never changes (the seam
 * that avoids a corner-paint). The old Map|Inventory|Quest|Badges tabbed modal AND
 * the satchel FAB are retired; the phone subsumes both.
 *
 * The shell is now a real DEVICE (PHONE_DESIGN.md): a fixed-aspect slab with a
 * BEZEL, a STATUS BAR (live clock · signal · battery), the app header, the body
 * (the sole scroll region), and a HOME-INDICATOR gesture bar. Its #1 invariant is
 * CONSTANT SIZE: the device + its screen are sized ONCE per open from the host
 * VIEWPORT (not content), so switching apps NEVER resizes the frame — only the
 * content inside the screen's clip scrolls. The shell owns the FRAME only: the home
 * grid, the app header + back nav, open/close, localization threading, the "Leave
 * the Plaza" affordance, and the no-layout-shift contract. It mirrors the NPC
 * dialogue sheet (`npc/dialogueUI.ts`): a FIXED root mounted in `.wp-overlay` (never
 * document.body — the M0 host-clip lesson), compositor-only open/close (transform +
 * opacity). On tablet/desktop the device is right-anchored + as big as fits; on a
 * real phone the bezel dissolves to a near-full-bleed sheet (PHONE_DESIGN.md §4) —
 * tablet/desktop are first-class.
 *
 * Apps are MOUNTED when opened and UNMOUNTED on back / close (the menu
 * `MenuSectionView` re-run-on-open model), so each reads the LIVE native locale +
 * current state every time it appears. No window.confirm/alert/prompt anywhere
 * (they no-op in the Tauri WKWebView).
 */

import "./phone.css"
import { t, type I18nKey } from "../../i18n/strings"
import { CORPAN_MARK_DATA_URI } from "../../assets/corpanMark"
import { createStatusBar, type StatusBarHandle } from "./statusBar"
import type { PhoneApp, PhoneAppContext, PhoneAppIcon, PhoneAppInstance, PhoneT } from "./phoneApp"

const LOG = "[wp/phone]"

export interface PhoneSheetOptions {
  /** The game's `.wp-overlay` element — the phone mounts INSIDE this (never body). */
  overlay: HTMLElement
  /** Accent color (Scene.palette.accent) so the phone tints with the world. */
  accent?: string
  /** Scene paper/ink palette overrides (optional). */
  palette?: { paper?: string; ink?: string }
  /**
   * The live UI locale (the learner's NATIVE). A getter form is read LIVE on each
   * open so an immersion flip re-localizes the phone in place on the next open.
   */
  locale: string | (() => string)
  /**
   * The pluggable apps, in home-grid order. Inventory, Music, Map, Quest, Badges
   * are passed today; this is the seam future apps slot into without touching the
   * shell. MUST be non-empty.
   */
  apps: PhoneApp[]
  /**
   * "Leave the Plaza" — the exit affordance on the home screen. When omitted the
   * leave row is hidden (e.g. a host that owns its own exit). Closing the phone is
   * still always available (✕ / scrim / Escape) and is the normal "resume".
   */
  onLeave?: () => void
  /**
   * The home-screen OBJECTIVE WIDGET (PHONE_DESIGN §5.1): a pinned "what now" card
   * reading the active quest. Read LIVE on each home render. Return `null` (no
   * active quest) → the widget shows a quiet "No active quest" line; omit the
   * option entirely → no widget at all. Tapping the widget deep-links to `appId`
   * (the Quest app) when given. Single-language safe (it's content-agnostic).
   */
  objective?: () => { title: string; done: number; total: number; appId?: string } | null
  /** Called when the phone opens (orchestrator: pause world feel / recede chrome). */
  onOpen?: () => void
  /** Called when the phone closes (orchestrator: resume). */
  onClose?: () => void
}

export interface PhoneSheet {
  /** Open the phone (optionally deep-linked straight into a specific app). */
  open(appId?: string): void
  /** Close the phone. */
  close(): void
  /** Toggle open/closed. */
  toggle(): void
  isOpen(): boolean
  dispose(): void
}

function elt(tag: string, cls?: string): HTMLElement {
  const n = document.createElement(tag)
  if (cls) n.className = cls
  return n
}

/** Paint a `PhoneAppIcon` (SVG string / `<img>` html / node builder) into `tile`. */
function paintIcon(tile: HTMLElement, icon: PhoneAppIcon, accent?: string): void {
  try {
    const out = typeof icon === "function" ? icon(accent) : icon
    if (typeof out === "string") tile.innerHTML = out
    else tile.appendChild(out)
  } catch (err) {
    console.error(`${LOG} icon paint threw:`, err)
  }
}

/** The brand-mark `<img>` for the home grid / app header (the same mark the FAB uses). */
function markImg(cls: string): string {
  return `<img class="${cls}" src="${CORPAN_MARK_DATA_URI}" alt="" aria-hidden="true" draggable="false" />`
}

/* A back chevron + a leave/exit glyph — inline so they inherit the ink color. */
const ICON_BACK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>'
const ICON_LEAVE =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M10 8l-4 4 4 4"/><path d="M6 12h10"/></svg>'

export function createPhoneSheet(opts: PhoneSheetOptions): PhoneSheet {
  const apps = opts.apps.slice()
  if (apps.length === 0) {
    // Loud, never silent — a phone with no apps is a wiring bug.
    console.error(`${LOG} created with no apps — the phone home will be empty`)
  }

  const resolveLocale = (): string =>
    typeof opts.locale === "function" ? opts.locale() : opts.locale
  // Bind `t` live each open so an immersion flip re-localizes on the next open.
  const boundT = (): PhoneT => {
    const loc = resolveLocale()
    return (key: I18nKey, params?: Record<string, string | number>) => t(key, loc, params)
  }

  let opened = false
  /** null = the home screen; an app id = that app is open. */
  let activeId: string | null = null
  let activeInstance: PhoneAppInstance | null = null

  /* ------------------------------- frame DOM ------------------------------- */
  const root = elt("div", "wp-phone-root")
  root.setAttribute("role", "dialog")
  root.setAttribute("aria-modal", "false")
  if (opts.accent) root.style.setProperty("--wp-phone-accent", opts.accent)
  if (opts.palette?.paper) root.style.setProperty("--wp-phone-paper", opts.palette.paper)
  if (opts.palette?.ink) root.style.setProperty("--wp-phone-ink", opts.palette.ink)

  const scrim = elt("div", "wp-phone-scrim")
  scrim.setAttribute("aria-hidden", "true")

  // THE DEVICE — the fixed-size slab (bezel). It keeps the legacy `.wp-phone-panel`
  // class too so the proven off-screen / open transform + the sheet-offscreen
  // regression harness still apply; `.wp-phone-device` carries the bezel + the
  // viewport-computed fixed sizing (PHONE_DESIGN.md §2).
  const panel = elt("section", "wp-phone-device wp-phone-panel")
  // Guarantee the first painted frame is off-screen even before phone.css parses.
  // The device is taller than the panel was, so the closed transform must clear the
  // whole slab; the CSS uses the same `120%` rule.
  panel.style.transform = "translateY(120%)"

  // THE SCREEN — the clipped inner rectangle (everything lives here). `overflow:
  // hidden` is what makes the body the sole scroller and the frame constant-size.
  const screen = elt("div", "wp-phone-screen")

  // STATUS BAR — live clock · signal · battery (the "real device" tell).
  const statusBar: StatusBarHandle = createStatusBar()

  // Header — a back chevron (app screen only) + the title + a close button.
  const head = elt("header", "wp-phone-head")
  const backBtn = document.createElement("button")
  backBtn.type = "button"
  backBtn.className = "wp-phone-back"
  backBtn.innerHTML = ICON_BACK
  const title = elt("div", "wp-phone-title")
  const closeBtn = document.createElement("button")
  closeBtn.type = "button"
  closeBtn.className = "wp-phone-close"
  closeBtn.innerHTML = "&#10005;" // ✕
  head.append(backBtn, title, closeBtn)

  // Body — a single region that holds EITHER the home grid OR the open app.
  const body = elt("div", "wp-phone-body")

  // HOME INDICATOR — the bottom gesture bar (also the bottom-sheet grab on a real
  // phone). Tapping it backs out: app → home, else close (a real device's gesture).
  // Keeps a generous 44px hit zone via its wrapper (the canonical handle pattern).
  const homeInd = elt("div", "wp-phone-home-ind")
  homeInd.setAttribute("role", "button")
  homeInd.setAttribute("tabindex", "0")
  homeInd.append(elt("div", "wp-phone-home-ind-bar"))

  screen.append(statusBar.el, head, body, homeInd)
  panel.append(screen)
  root.append(scrim, panel)
  opts.overlay.appendChild(root)

  // Swallow pointer so the dual-joystick layer under `.wp-overlay` can't steal
  // taps on the phone (the trap menuButton/minimap guard against).
  const swallow = (e: Event) => e.stopPropagation()
  panel.addEventListener("pointerdown", swallow)
  panel.addEventListener("pointerup", swallow)

  backBtn.addEventListener("click", () => goHome())
  closeBtn.addEventListener("click", () => close())
  scrim.addEventListener("click", () => close())
  // Home-indicator gesture: app → home, else close.
  const onHomeInd = () => {
    if (activeId !== null) goHome()
    else close()
  }
  homeInd.addEventListener("click", onHomeInd)
  homeInd.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      onHomeInd()
    }
  })

  /* ------------------------------- app mount ------------------------------- */
  const unmountActive = () => {
    if (activeInstance) {
      try {
        activeInstance.dispose()
      } catch (err) {
        console.error(`${LOG} app "${activeId}" dispose threw:`, err)
      }
      activeInstance = null
    }
    body.replaceChildren()
  }

  /* ------------------------------ home screen ------------------------------ */
  /** Render the HOME SCREEN: the app grid + the "Leave the Plaza" row. */
  const renderHome = () => {
    unmountActive()
    activeId = null
    const tr = boundT()

    // The home top-bar reads as the device's springboard header: the brand wordmark
    // ("Corpan City") instead of a generic "Phone" title. The brand mark sits before
    // it (home only); it's removed when an app opens.
    title.textContent = tr("phone.home.city")
    title.classList.add("wp-phone-title--home")
    head.querySelector(".wp-phone-head-mark")?.remove()
    const brand = elt("span", "wp-phone-head-mark")
    brand.innerHTML = markImg("wp-phone-head-mark-img")
    brand.setAttribute("aria-hidden", "true")
    head.insertBefore(brand, title)
    backBtn.style.display = "none"
    backBtn.setAttribute("aria-hidden", "true")
    backBtn.tabIndex = -1
    root.classList.remove("wp-phone-in-app")

    const home = elt("div", "wp-phone-home")
    const grid = elt("div", "wp-phone-grid")
    for (const app of apps) {
      const cell = document.createElement("button")
      cell.type = "button"
      cell.className = "wp-phone-app"
      cell.dataset.appId = app.id
      const label = app.title(tr)
      cell.setAttribute("aria-label", label)
      const tile = elt("span", "wp-phone-app-icon")
      if (app.tileAccent) tile.style.setProperty("--wp-phone-tile", app.tileAccent)
      paintIcon(tile, app.icon, opts.accent)
      const name = elt("span", "wp-phone-app-name")
      name.textContent = label
      cell.append(tile, name)
      cell.addEventListener("click", () => openApp(app.id))
      grid.append(cell)
    }
    home.append(grid)

    // OBJECTIVE WIDGET — a pinned "what now" card reading the active quest (§5.1).
    // Live-read each home render; omit-graceful (no option → no widget). Tapping it
    // deep-links to the given app (the Quest app).
    if (opts.objective) {
      let obj: { title: string; done: number; total: number; appId?: string } | null = null
      try {
        obj = opts.objective()
      } catch (err) {
        console.error(`${LOG} objective() threw:`, err)
      }
      const widget = document.createElement("button")
      widget.type = "button"
      widget.className = "wp-phone-objective"
      if (obj) {
        widget.innerHTML =
          '<span class="wp-phone-objective-dot" aria-hidden="true"></span>' +
          `<span class="wp-phone-objective-text">${escapeText(
            tr("phone.objective.widget", {
              title: obj.title,
              done: obj.done,
              total: obj.total,
            }),
          )}</span>`
        const target = obj.appId
        if (target) widget.addEventListener("click", () => openApp(target))
        else widget.disabled = true
      } else {
        // Quiet "no active quest" state — still a tidy card, not a gap.
        widget.classList.add("wp-phone-objective--empty")
        widget.disabled = true
        widget.innerHTML = `<span class="wp-phone-objective-text">${escapeText(
          tr("phone.objective.none"),
        )}</span>`
      }
      home.append(widget)
    }

    // "Leave the Plaza" — the quiet, dignified exit, homed on the phone (no longer
    // a button buried in a retired modal). Closing the phone is the normal resume;
    // this is the deliberate "I'm done" path.
    if (opts.onLeave) {
      const leave = document.createElement("button")
      leave.type = "button"
      leave.className = "wp-phone-leave"
      leave.innerHTML = `${ICON_LEAVE}<span>${escapeText(tr("phone.leave"))}</span>`
      leave.addEventListener("click", () => {
        try {
          opts.onLeave?.()
        } catch (err) {
          console.error(`${LOG} onLeave threw:`, err)
        }
      })
      home.append(leave)
    }

    body.replaceChildren(home)
  }

  /** Open an app over the home screen (back chevron returns home). */
  const openApp = (id: string) => {
    const app = apps.find((a) => a.id === id)
    if (!app) {
      console.warn(`${LOG} no app "${id}" — staying home`)
      return
    }
    unmountActive()
    activeId = app.id
    const tr = boundT()

    // Leaving the springboard: drop the brand wordmark + home title styling.
    head.querySelector(".wp-phone-head-mark")?.remove()
    title.classList.remove("wp-phone-title--home")
    title.textContent = app.title(tr)
    backBtn.style.display = ""
    backBtn.removeAttribute("aria-hidden")
    backBtn.tabIndex = 0
    backBtn.setAttribute("aria-label", tr("phone.back"))
    backBtn.title = tr("phone.back")
    root.classList.add("wp-phone-in-app")

    const stage = elt("div", "wp-phone-app-stage")
    body.replaceChildren(stage)
    const ctx: PhoneAppContext = {
      t: tr,
      accent: opts.accent,
      goHome: () => goHome(),
      closePhone: () => close(),
    }
    try {
      activeInstance = app.mount(stage, ctx)
    } catch (err) {
      console.error(`${LOG} app "${app.id}" mount threw:`, err)
      activeInstance = null
    }
  }

  /** Back out of the open app to the home screen. */
  const goHome = () => {
    if (activeId === null) return
    renderHome()
  }

  /* ------------------------------ open/close ------------------------------- */
  function open(appId?: string) {
    if (opened) {
      if (appId) openApp(appId)
      return
    }
    opened = true
    // Always (re)build the chrome labels + the requested screen on open.
    closeBtn.setAttribute("aria-label", boundT()("phone.close"))
    closeBtn.title = boundT()("phone.close")
    // Re-read the wall clock so the status bar shows "now" each time it appears.
    statusBar.refresh()
    if (appId && apps.some((a) => a.id === appId)) openApp(appId)
    else renderHome()

    try {
      opts.onOpen?.()
    } catch (err) {
      console.error(`${LOG} onOpen threw:`, err)
    }

    // Capture so the phone's ESC resolves BEFORE the shell's ESC (which would
    // otherwise open the menu underneath the phone).
    document.addEventListener("keydown", onKey, true)
    requestAnimationFrame(() => {
      panel.style.transform = ""
      root.classList.add("wp-phone-open")
    })
  }

  function close() {
    if (!opened) return
    opened = false
    root.classList.remove("wp-phone-open")
    document.removeEventListener("keydown", onKey, true)
    // Keep the screen mounted through the slide-out so content doesn't vanish
    // before the panel leaves; unmount + reset to home AFTER the transition.
    window.setTimeout(() => {
      if (!opened) {
        unmountActive()
        activeId = null
      }
    }, 360)
    try {
      opts.onClose?.()
    } catch (err) {
      console.error(`${LOG} onClose threw:`, err)
    }
  }

  // Escape backs out one level: app → home → close (a real phone's back stack).
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "Escape" || !opened) return
    e.stopPropagation()
    if (activeId !== null) goHome()
    else close()
  }

  return {
    open,
    close,
    toggle: () => (opened ? close() : open()),
    isOpen: () => opened,
    dispose: () => {
      close()
      unmountActive() // teardown is synchronous — don't wait out the slide-out
      statusBar.dispose()
      root.remove()
    },
  }
}

/** Minimal text escaper for the few innerHTML spots (leave label). */
function escapeText(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  )
}

/** Re-export so callers building grid apps can reference the brand mark img helper. */
export { markImg }
