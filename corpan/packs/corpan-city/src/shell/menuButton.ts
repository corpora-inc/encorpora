/**
 * menuButton — the always-visible on-screen Menu affordance.
 *
 * Touch, tablet AND desktop are first-class (memory: tablet+desktop first-class):
 * there is no physical ESC on a phone or tablet, so the shell ALWAYS mounts a
 * small, dignified menu button so every form factor can open the menu + reach
 * the exit. On desktop it doubles as a discoverable hint that ESC opens the same
 * menu.
 *
 * THE FIX (M0): it mounts INSIDE the game's `.wp-overlay` (the parent the shell
 * passes in), NOT on `document.body`. A body-appended button is laid out /
 * clipped relative to the Corpán host's `ContentPackHost` container when
 * embedded, so it could vanish. Living in `.wp-overlay` — the host's accepted
 * render surface — it cannot be clipped away. Its z (`--wp-z-menu-button`) sits
 * just under the menu panel inside the in-overlay band.
 *
 * It auto-hides itself while the menu (or any blocking overlay) is open — the
 * menu IS the surface then — and reappears on close. Compositor-only fade;
 * `position:absolute` from frame 0 → no layout participation.
 *
 * Placed BOTTOM-LEFT (safe-area aware): it's the player's "pack" — the hub for
 * their stuff / progress / map / quests (NOT a "pause"). It owns its own clean
 * corner so it can never overlap the minimap (which owns the bottom-RIGHT
 * corner), and stays clear of the title (top), HUD (top-right) and quest tracker
 * (top-left). Styled as a traveler's satchel in `src/styles.css`
 * (`.wp-menu-button` / `.wp-menu-icon`), the pack's single host-loaded stylesheet.
 */

export type MenuButtonOptions = {
  /** The game's `.wp-overlay` — the button mounts INSIDE this (never body). */
  parent: HTMLElement
  /** Accent color (Scene.palette.accent) so the button matches the world. */
  accent?: string
  /** Accessible label / tooltip. */
  label?: string
  /** Invoked when tapped/clicked — the shell wires this to open the menu. */
  onOpen: () => void
}

export interface MenuButtonHandle {
  /** Hide the button (while the menu / a modal is open). */
  hide(): void
  /** Show the button (after the menu closes). */
  show(): void
  dispose(): void
}

export function createMenuButton(opts: MenuButtonOptions): MenuButtonHandle {
  const btn = document.createElement("button")
  btn.type = "button"
  btn.className = "wp-menu-button"
  btn.setAttribute("aria-label", opts.label ?? "Your pack")
  btn.title = opts.label ?? "Your pack — stuff, progress, map (Esc)"
  if (opts.accent) btn.style.setProperty("--wp-menu-accent", opts.accent)
  // A traveler's SATCHEL — this button is your PACK (stuff / progress / map /
  // quests), NOT a "pause". Inline SVG so it crisps at any DPR + inherits accent.
  btn.innerHTML =
    `<svg class="wp-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
    `stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
    `<path d="M9 7V6a3 3 0 0 1 6 0v1"/>` +
    `<rect x="4" y="7" width="16" height="13" rx="3.5"/>` +
    `<path d="M4 12.5h16"/>` +
    `<path d="M11.5 12.5v3"/>` +
    `</svg>`
  // CRITICAL: the button lives INSIDE `.wp-overlay`, whose dual-joystick input
  // layer captures EVERY pointerdown that bubbles to it (host.setPointerCapture)
  // — which would steal this button's pointer and suppress its `click` (the
  // button would be dead on touch, eaten by the look/move stick). Stop the
  // pointer gesture here so the joystick never sees a press on the button.
  const swallow = (e: Event) => e.stopPropagation()
  btn.addEventListener("pointerdown", swallow)
  btn.addEventListener("pointerup", swallow)
  btn.addEventListener("click", () => {
    try {
      opts.onOpen()
    } catch (err) {
      console.error("[wp/shell/menuButton] onOpen threw:", err)
    }
  })
  opts.parent.appendChild(btn)
  // Paint the from-state first, then fade in.
  requestAnimationFrame(() => btn.classList.add("wp-menu-button--in"))

  return {
    hide() {
      btn.classList.remove("wp-menu-button--in")
      btn.setAttribute("aria-hidden", "true")
      btn.tabIndex = -1
    },
    show() {
      btn.classList.add("wp-menu-button--in")
      btn.removeAttribute("aria-hidden")
      btn.tabIndex = 0
    },
    dispose() {
      btn.remove()
    },
  }
}
