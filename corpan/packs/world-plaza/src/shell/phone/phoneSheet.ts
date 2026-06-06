/**
 * phoneSheet — the in-world "Phone": a tiny extensible app-shell (a phone "OS")
 * the player opens from a corner FAB (`phoneFab.ts`). It hosts pluggable APPS
 * (`PhoneApp`); Inventory ("Things") + Music/Radio ship first, but Mail, Calls,
 * and a Quest app can slot in later as just another entry in the `apps` array —
 * the shell never needs to change (that's the seam that avoids a corner-paint).
 *
 * The shell owns the FRAME only: header, the tab strip, the single scrolling body
 * region, open/close, localization threading, and the no-layout-shift contract.
 * It mirrors the NPC dialogue sheet (`npc/dialogueUI.ts`): a FIXED root mounted in
 * `.wp-overlay` (never document.body — the M0 host-clip lesson), compositor-only
 * open/close (transform + opacity). On phones it's a bottom sheet; on tablet/
 * desktop a docked card (FAB_POLISH §6 — tablet/desktop are first-class).
 *
 * Apps are MOUNTED on open / tab-switch and UNMOUNTED on close / switch (the menu
 * `MenuSectionView` re-run-on-open model), so each reads the LIVE native locale +
 * current state every time it appears. No window.confirm/alert/prompt anywhere
 * (they no-op in the Tauri WKWebView).
 */

import "./phone.css"
import { t, type I18nKey } from "../../i18n/strings"
import type { PhoneApp, PhoneAppContext, PhoneAppInstance, PhoneT } from "./phoneApp"

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
   * The pluggable apps, in tab order. Inventory + Music are passed today; this is
   * the seam future apps (Mail/Calls/Quest) slot into without touching the shell.
   * MUST be non-empty.
   */
  apps: PhoneApp[]
  /** Called when the phone opens (orchestrator: pause world feel / recede chrome). */
  onOpen?: () => void
  /** Called when the phone closes (orchestrator: resume). */
  onClose?: () => void
}

export interface PhoneSheet {
  /** Open the phone (optionally on a specific app id). */
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

export function createPhoneSheet(opts: PhoneSheetOptions): PhoneSheet {
  const apps = opts.apps.slice()
  if (apps.length === 0) {
    // Loud, never silent — a phone with no apps is a wiring bug.
    console.error(`${LOG} created with no apps — the phone will be empty`)
  }

  const resolveLocale = (): string =>
    typeof opts.locale === "function" ? opts.locale() : opts.locale
  // Bind `t` live each open so an immersion flip re-localizes on the next open.
  const boundT = (): PhoneT => {
    const loc = resolveLocale()
    return (key: I18nKey, params?: Record<string, string | number>) => t(key, loc, params)
  }

  let opened = false
  let activeId: string = apps[0]?.id ?? "things"
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
  const panel = elt("section", "wp-phone-panel")
  // Guarantee the first painted frame is off-screen even before phone.css parses.
  panel.style.transform = "translateY(105%)"

  // Handle (generous 44px hit zone, not a bare pill — the canonical pattern).
  const handle = elt("div", "wp-phone-handle")
  handle.setAttribute("aria-hidden", "true")
  handle.append(elt("div", "wp-phone-handle-bar"))

  // Header.
  const head = elt("header", "wp-phone-head")
  const title = elt("div", "wp-phone-title")
  const closeBtn = document.createElement("button")
  closeBtn.type = "button"
  closeBtn.className = "wp-phone-close"
  closeBtn.innerHTML = "&#10005;" // ✕
  head.append(title, closeBtn)

  // Tab strip — one button per app (built once; labels relocalized per open).
  const tabs = elt("div", "wp-phone-tabs")
  const tabButtons = new Map<string, HTMLButtonElement>()
  for (const app of apps) {
    const b = document.createElement("button")
    b.type = "button"
    b.className = "wp-phone-tab"
    b.dataset.appId = app.id
    b.addEventListener("click", () => setApp(app.id))
    tabs.append(b)
    tabButtons.set(app.id, b)
  }
  // A single-app phone needs no tab strip — hide it (still a valid phone OS).
  if (apps.length <= 1) tabs.style.display = "none"

  // Body (sole scroll region) — the active app mounts here.
  const body = elt("div", "wp-phone-body")

  panel.append(handle, head, tabs, body)
  root.append(scrim, panel)
  opts.overlay.appendChild(root)

  // Swallow pointer so the dual-joystick layer under `.wp-overlay` can't steal
  // taps on the phone (the trap menuButton/minimap guard against).
  const swallow = (e: Event) => e.stopPropagation()
  panel.addEventListener("pointerdown", swallow)
  panel.addEventListener("pointerup", swallow)

  closeBtn.addEventListener("click", () => close())
  scrim.addEventListener("click", () => close())

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

  /** Mount the app with id `id` (unmounting any current one). */
  const mountApp = (id: string) => {
    const app = apps.find((a) => a.id === id) ?? apps[0]
    if (!app) return
    activeId = app.id
    unmountActive()
    const ctx: PhoneAppContext = {
      t: boundT(),
      accent: opts.accent,
      closePhone: () => close(),
    }
    try {
      activeInstance = app.mount(body, ctx)
    } catch (err) {
      console.error(`${LOG} app "${app.id}" mount threw:`, err)
      activeInstance = null
    }
    // Reflect selection on the tab strip.
    for (const [tid, b] of tabButtons) b.setAttribute("aria-selected", String(tid === activeId))
  }

  /** Switch tabs (only re-mounts when the id actually changes). */
  const setApp = (id: string) => {
    if (id === activeId && activeInstance) return
    mountApp(id)
  }

  const relocalizeChrome = () => {
    const tr = boundT()
    title.textContent = tr("phone.title")
    closeBtn.setAttribute("aria-label", tr("phone.close"))
    closeBtn.title = tr("phone.close")
    for (const app of apps) {
      const b = tabButtons.get(app.id)
      if (b) b.textContent = app.tabLabel(tr)
    }
  }

  /* ------------------------------ open/close ------------------------------- */
  function open(appId?: string) {
    if (opened) {
      if (appId) setApp(appId)
      return
    }
    opened = true
    relocalizeChrome()
    mountApp(appId ?? activeId)

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
    // Keep the app mounted through the slide-out so content doesn't vanish before
    // the panel leaves; unmount AFTER the transition (unless reopened meanwhile).
    window.setTimeout(() => {
      if (!opened) unmountActive()
    }, 360)
    try {
      opts.onClose?.()
    } catch (err) {
      console.error(`${LOG} onClose threw:`, err)
    }
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape" && opened) {
      e.stopPropagation()
      close()
    }
  }

  return {
    open,
    close,
    toggle: () => (opened ? close() : open()),
    isOpen: () => opened,
    dispose: () => {
      close()
      unmountActive() // teardown is synchronous — don't wait out the slide-out
      root.remove()
    },
  }
}
