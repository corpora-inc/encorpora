/**
 * menuPanel — the UNIFIED in-overlay menu for Corpan City (COHESION §2, M0).
 *
 * THE FIX (structural, not a bigger z-index): this panel mounts INSIDE the
 * game's `.wp-overlay` element — the surface the Corpán host actually paints —
 * NOT on `document.body`. The retired `pause.ts` mounted a `position:fixed`
 * modal on `document.body` at z≈2.1 billion; under embedding the host's
 * `ContentPackHost` container forms its own stacking context and clips with
 * overflow/transform/contain, so a body-fixed child painted INSIDE the host's
 * clip region → invisible. The HUD/dialogue/challenge overlays render fine
 * because they live in `.wp-overlay`. So the menu lives there too: a
 * `position:absolute; inset:0` panel at `--wp-z-menu` (the TOP of the in-overlay
 * band), structurally immune to the clip that killed the body-fixed modal.
 *
 * Contents (a dignified, on-brand warm-Antigua panel):
 *   - Resume (primary, closes the menu),
 *   - Map · Inventory · Quest tabs (M0 = "Coming soon" placeholders),
 *   - Leave the Plaza (quiet/destructive → wpConfirm → the proven exit handshake).
 *
 * Premium polish: compositor-only open/close (opacity + a small scale on the
 * panel; `position:absolute` from frame 0 → no layout jank), dimmed backdrop,
 * focus trap, ESC-to-close (driven by the shell's handleKey chain), backdrop-tap
 * to close, ≥50px touch targets, reduced-motion path. Same no-focused-input
 * discipline as the rest of the shell → no scroll-jump surface.
 *
 * Styles live in `src/styles.css` (`.wp-menu*`), so they share the pack's single
 * stylesheet (which the host loads) — no per-module injected <style> that could
 * be missed under embedding.
 */

const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  )

export type MenuSectionId = "map" | "inventory" | "quest" | "badges"

export type MenuStrings = {
  title: string
  resume: string
  leave: string
  /** aria/close-button label. */
  close: string
  tabs: Record<MenuSectionId, string>
  /** Placeholder body copy for the M0 "coming soon" sections. */
  comingSoon: string
}

export const DEFAULT_MENU_STRINGS: MenuStrings = {
  title: "Plaza",
  resume: "Resume",
  leave: "Leave the Plaza",
  close: "Resume",
  tabs: { map: "Map", inventory: "Inventory", quest: "Quest", badges: "Badges" },
  comingSoon: "Coming soon.",
}

/**
 * A section renderer. M0 sections are placeholders; later milestones pass real
 * factories (e.g. the inventory panel, the full map, the quest detail) that
 * render into the provided body element and return an optional cleanup.
 */
export type MenuSectionView = (body: HTMLElement) => void | (() => void)

export type MenuPanelOptions = {
  /** The game's `.wp-overlay` — the panel mounts INSIDE this (never body). */
  parent: HTMLElement
  /** Accent color (Scene.palette.accent) so the panel matches the world. */
  accent?: string
  strings?: Partial<MenuStrings>
  /** Halt the sim + free the LLM (orchestrator: setWorldActive(false), broker.onBackground()). */
  onOpen?: () => void
  /** Restore the sim (orchestrator: setWorldActive(true)). */
  onClose?: () => void
  /** Tapped "Leave the Plaza" → the shell routes this to confirmAndExit. */
  onLeave?: () => void
  /** Section view factories — M0 omits these → graceful "coming soon" placeholder. */
  sections?: Partial<Record<MenuSectionId, MenuSectionView>>
}

export interface MenuPanelHandle {
  isOpen(): boolean
  open(section?: MenuSectionId): void
  /** Close via the resume path (fires onClose). */
  close(): void
  /** Toggle: open if closed, close if open. Returns the new open state. */
  toggle(): boolean
  /** Switch the active section (opens the menu if closed). */
  showSection(section: MenuSectionId): void
  /**
   * Swap the localized copy in place (immersion toggle → new UI locale). If the
   * panel is open it re-renders immediately; otherwise the next open uses it.
   */
  setStrings(strings: Partial<MenuStrings>): void
  dispose(): void
}

// Map · Inventory · Quest · Badges — Badges is a real 4th tab (FAB_POLISH §4.1),
// not a deep-link-only section. At 4 tabs the segmented control still fits ≥320px;
// the strip scroll-snaps on the very narrowest phones (CSS, ≤360px).
const SECTION_ORDER: MenuSectionId[] = ["map", "inventory", "quest", "badges"]

export function createMenuPanel(opts: MenuPanelOptions): MenuPanelHandle {
  // `let` (not const) so `setStrings` can swap the localized copy in place when the
  // immersion toggle flips the UI locale; the panel rebuilds its DOM each open, so
  // updating `s` (and re-rendering if currently open) re-localizes without a remount.
  let s: MenuStrings = {
    ...DEFAULT_MENU_STRINGS,
    ...(opts.strings ?? {}),
    tabs: { ...DEFAULT_MENU_STRINGS.tabs, ...(opts.strings?.tabs ?? {}) },
  }

  let root: HTMLElement | null = null
  let open = false
  let disposed = false
  let active: MenuSectionId = "quest"
  let sectionCleanup: (() => void) | null = null
  let trapKey: ((e: KeyboardEvent) => void) | null = null
  let removeTimer = 0

  /** Keep Tab focus inside the panel while it's open (a real modal focus trap). */
  function installTrap(el: HTMLElement): void {
    trapKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return
      const focusables = el.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const activeEl = document.activeElement as HTMLElement | null
      if (e.shiftKey && (activeEl === first || !el.contains(activeEl))) {
        e.preventDefault()
        last.focus({ preventScroll: true })
      } else if (!e.shiftKey && (activeEl === last || !el.contains(activeEl))) {
        e.preventDefault()
        first.focus({ preventScroll: true })
      }
    }
    // Capture phase so we win Tab before anything in the world does.
    document.addEventListener("keydown", trapKey, true)
  }

  function removeTrap(): void {
    if (trapKey) {
      document.removeEventListener("keydown", trapKey, true)
      trapKey = null
    }
  }

  function renderSection(el: HTMLElement): void {
    // Tear down the previous section's view, if any.
    try {
      sectionCleanup?.()
    } catch (err) {
      console.error("[wp/shell/menuPanel] section cleanup threw:", err)
    }
    sectionCleanup = null

    const body = el.querySelector<HTMLElement>(".wp-menu-body")
    if (!body) return
    body.replaceChildren()

    // Reflect the active tab.
    el.querySelectorAll<HTMLButtonElement>("[data-wp-menu-tab]").forEach((b) =>
      b.classList.toggle("wp-menu-tab--on", b.getAttribute("data-wp-menu-tab") === active),
    )

    // Cross-fade the inner content on a tab swap (FAB_POLISH §4.5): the FIXED
    // frame never resizes — only the content fades 0→1 over 140ms. The fade
    // wrapper carries `.wp-menu-fade`; reduced-motion is handled in CSS.
    const fade = document.createElement("div")
    fade.className = "wp-menu-fade"
    fade.style.opacity = "0"
    body.appendChild(fade)

    const factory = opts.sections?.[active]
    if (factory) {
      try {
        const cleanup = factory(fade)
        if (typeof cleanup === "function") sectionCleanup = cleanup
      } catch (err) {
        console.error(`[wp/shell/menuPanel] section "${active}" view threw:`, err)
        fade.replaceChildren()
        fade.appendChild(emptyCard(s.comingSoon))
      }
    } else {
      // No factory wired yet → a premium empty-state card, never a dead-end/crash.
      fade.appendChild(emptyCard(s.comingSoon))
    }

    // Paint at opacity 0, then rAF → 1 so the swap reads as a gentle fade.
    requestAnimationFrame(() => {
      fade.style.opacity = "1"
    })
  }

  /**
   * A premium empty-state card (FAB_POLISH §4.3): a soft debossed glyph + a one-
   * line message, centered in the fixed frame so a short tab never reads as an
   * unfinished void. Used for not-yet-wired sections (and a section view that
   * throws). A section view that has its OWN empty state renders that instead.
   */
  function emptyCard(text: string): HTMLElement {
    const card = document.createElement("div")
    card.className = "wp-menu-empty"
    const glyph = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    glyph.setAttribute("class", "wp-menu-empty-glyph")
    glyph.setAttribute("viewBox", "0 0 24 24")
    glyph.setAttribute("fill", "none")
    glyph.setAttribute("aria-hidden", "true")
    // A small compass/star — "nothing here yet, explore on."
    glyph.innerHTML =
      '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6"/>' +
      '<path d="M12 7.5l1.6 3.3 3.4.4-2.5 2.3.7 3.4L12 18.6l-3.7 1.3.7-3.4-2.5-2.3 3.4-.4z" fill="currentColor" opacity="0.85"/>'
    const title = document.createElement("div")
    title.className = "wp-menu-empty-title"
    title.textContent = text
    card.append(glyph, title)
    return card
  }

  function build(): HTMLElement {
    const el = document.createElement("div")
    el.className = "wp-menu"
    if (opts.accent) el.style.setProperty("--wp-menu-accent", opts.accent)
    const tabsHtml = SECTION_ORDER.map(
      (id) =>
        `<button class="wp-menu-tab" type="button" data-wp-menu-tab="${id}">${escapeHtml(
          s.tabs[id],
        )}</button>`,
    ).join("")
    el.innerHTML = `
      <div class="wp-menu-scrim" data-wp-menu-close></div>
      <div class="wp-menu-panel" role="dialog" aria-modal="true" aria-label="${escapeHtml(s.title)}">
        <div class="wp-menu-head">
          <div class="wp-menu-title">${escapeHtml(s.title)}</div>
          <button class="wp-menu-close" type="button" data-wp-menu-close aria-label="${escapeHtml(
            s.close,
          )}">✕</button>
        </div>
        <div class="wp-menu-tabs" role="tablist">${tabsHtml}</div>
        <div class="wp-menu-body"></div>
        <div class="wp-menu-foot">
          <button class="wp-menu-resume" type="button" data-wp-menu-resume>${escapeHtml(
            s.resume,
          )}</button>
          <button class="wp-menu-leave" type="button" data-wp-menu-leave>${escapeHtml(
            s.leave,
          )}</button>
        </div>
      </div>`

    // The panel lives INSIDE `.wp-overlay`, whose dual-joystick input captures
    // any pointerdown that bubbles to it. While the menu is open the sim is
    // halted (onOpen → setWorldActive(false)), so the joystick is inert — but
    // stop pointer gestures at the menu root anyway so a press on the scrim/
    // tabs/buttons can never spawn a phantom stick or leak a tap to the world.
    const swallow = (e: Event) => e.stopPropagation()
    el.addEventListener("pointerdown", swallow)
    el.addEventListener("pointerup", swallow)

    el.querySelectorAll<HTMLElement>("[data-wp-menu-close], [data-wp-menu-resume]").forEach((b) =>
      b.addEventListener("click", () => handle.close()),
    )
    el.querySelector<HTMLButtonElement>("[data-wp-menu-leave]")?.addEventListener("click", () => {
      try {
        opts.onLeave?.()
      } catch (err) {
        console.error("[wp/shell/menuPanel] onLeave threw:", err)
      }
    })
    el.querySelectorAll<HTMLButtonElement>("[data-wp-menu-tab]").forEach((b) =>
      b.addEventListener("click", () => {
        const id = b.getAttribute("data-wp-menu-tab") as MenuSectionId | null
        if (id) handle.showSection(id)
      }),
    )
    return el
  }

  const handle: MenuPanelHandle = {
    isOpen: () => open,

    open(section?: MenuSectionId) {
      if (disposed) return
      if (section) active = section
      if (open) {
        // Already open — just make sure the requested section shows.
        if (root && section) renderSection(root)
        return
      }
      open = true
      if (removeTimer) {
        window.clearTimeout(removeTimer)
        removeTimer = 0
      }
      root = build()
      opts.parent.appendChild(root)
      renderSection(root)
      installTrap(root)
      // Paint the from-state first, then animate in (compositor-only).
      requestAnimationFrame(() => root?.classList.add("wp-menu--open"))
      requestAnimationFrame(() => {
        try {
          root?.querySelector<HTMLButtonElement>(".wp-menu-resume")?.focus({ preventScroll: true })
        } catch {
          /* best-effort */
        }
      })
      try {
        opts.onOpen?.()
      } catch (err) {
        console.error("[wp/shell/menuPanel] onOpen threw:", err)
      }
    },

    close() {
      if (!open) return
      open = false
      removeTrap()
      try {
        sectionCleanup?.()
      } catch (err) {
        console.error("[wp/shell/menuPanel] section cleanup (close) threw:", err)
      }
      sectionCleanup = null
      try {
        opts.onClose?.()
      } catch (err) {
        console.error("[wp/shell/menuPanel] onClose threw:", err)
      }
      const el = root
      root = null
      el?.classList.remove("wp-menu--open")
      removeTimer = window.setTimeout(() => {
        el?.remove()
        removeTimer = 0
      }, 240)
    },

    toggle() {
      if (open) {
        handle.close()
        return false
      }
      handle.open()
      return true
    },

    showSection(section: MenuSectionId) {
      active = section
      if (!open) {
        handle.open(section)
        return
      }
      if (root) renderSection(root)
    },

    setStrings(next: Partial<MenuStrings>) {
      s = {
        ...DEFAULT_MENU_STRINGS,
        ...next,
        tabs: { ...DEFAULT_MENU_STRINGS.tabs, ...(next.tabs ?? {}) },
      }
      // If the panel is on screen, refresh the chrome text in place (the section
      // body re-renders separately). The next open rebuilds from `s` regardless.
      if (root) {
        const set = (sel: string, text: string) => {
          const elx = root!.querySelector<HTMLElement>(sel)
          if (elx) elx.textContent = text
        }
        set(".wp-menu-title", s.title)
        set(".wp-menu-resume", s.resume)
        set(".wp-menu-leave", s.leave)
        root.querySelectorAll<HTMLElement>("[data-wp-menu-tab]").forEach((b) => {
          const id = b.getAttribute("data-wp-menu-tab") as MenuSectionId | null
          if (id) b.textContent = s.tabs[id]
        })
        const close = root.querySelector<HTMLElement>(".wp-menu-close")
        if (close) close.setAttribute("aria-label", s.close)
        // Re-render the OPEN section so its body (which may read a live UI locale
        // via a lazy `strings` getter) re-localizes too — not just the chrome.
        renderSection(root)
      }
    },

    dispose() {
      disposed = true
      removeTrap()
      if (removeTimer) {
        window.clearTimeout(removeTimer)
        removeTimer = 0
      }
      if (open) {
        // Restore the sim before yanking the panel (don't leave it paused).
        try {
          sectionCleanup?.()
        } catch (err) {
          console.error("[wp/shell/menuPanel] section cleanup (dispose) threw:", err)
        }
        try {
          opts.onClose?.()
        } catch (err) {
          console.error("[wp/shell/menuPanel] onClose (dispose) threw:", err)
        }
      }
      sectionCleanup = null
      open = false
      root?.remove()
      root = null
    },
  }
  return handle
}
