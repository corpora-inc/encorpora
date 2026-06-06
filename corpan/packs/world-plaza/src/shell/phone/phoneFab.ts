/**
 * phoneFab — the always-visible launcher for the Phone overlay.
 *
 * It is the Corpán "all-hearing ear": thematically the ear opens the world
 * radio/music (and the rest of the phone). A clean inline-SVG ear glyph (stroke
 * currentColor, accent-inheriting) reads crisply at FAB size where the detailed
 * hi-fi mesh logo would muddy — the ear MOTIF, drawn for 22px.
 *
 * Like the pack button (`menuButton.ts`) it mounts INSIDE `.wp-overlay` (never
 * document.body — the M0 host-clip fix) and STOPS the pointer gesture so the
 * dual-joystick layer can't steal its tap (the joystick-steals-taps trap). It
 * lives in the bottom-LEFT corner STACKED ABOVE the pack button: its CSS offset
 * is `pack-size + gap` (FAB_POLISH §2.3 — two FABs share a corner only when offset
 * by tokens, never an eyeballed guess), so they can never overlap at any
 * breakpoint. It is a `pack`-role chrome surface, so it recedes with the rest of
 * the chrome under focus/dialogue/challenge/menu (one cohesive breath).
 */

export type PhoneFabOptions = {
  /** The game's `.wp-overlay` — the FAB mounts INSIDE this (never body). */
  parent: HTMLElement
  /** Accent color (Scene.palette.accent) so the FAB matches the world. */
  accent?: string
  /** Accessible label / tooltip (localized "Phone"). */
  label?: string
  /** Invoked when tapped/clicked — wired to open the phone. */
  onOpen: () => void
}

export interface PhoneFabHandle {
  /** The button element (so chromeVisibility can govern it). */
  readonly el: HTMLElement
  /** Hide the FAB (while the phone / a blocking surface is open). */
  hide(): void
  /** Show the FAB. */
  show(): void
  /** Relocalize the aria-label/title (immersion flip → new UI locale). */
  setLabel(label: string): void
  dispose(): void
}

// The "all-hearing ear" — a stylized listening ear: the outer helix curls down
// from the top to the lobe; the inner concha is a small open curl at its center.
// Stroke currentColor so it inherits the accent; tuned to read at 22px.
const ICON_EAR =
  '<svg class="wp-phone-fab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
  'stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  // Outer helix: a big curl (top-right round to the left), tailing down to the lobe.
  '<path d="M16.5 9.5a4.5 4.5 0 1 0-9 0c0 2.2 1.3 3.3 2.4 4.4 1 1 1.6 1.8 1.6 3.1' +
  'A2.5 2.5 0 0 1 9 19.5a2.5 2.5 0 0 1-2.5-2.5" />' +
  // Inner concha: a small open listening curl at the ear canal.
  '<path d="M12.5 9.7a2 2 0 0 0-2 2c0 1 .6 1.5 1.2 2" />' +
  '</svg>'

export function createPhoneFab(opts: PhoneFabOptions): PhoneFabHandle {
  const btn = document.createElement("button")
  btn.type = "button"
  btn.className = "wp-phone-fab"
  btn.setAttribute("aria-label", opts.label ?? "Phone")
  btn.title = opts.label ?? "Phone"
  if (opts.accent) btn.style.setProperty("--wp-phone-fab-accent", opts.accent)
  btn.innerHTML = ICON_EAR

  // CRITICAL (joystick-steals-taps trap): the FAB lives inside `.wp-overlay`,
  // whose input layer captures every bubbling pointerdown — which would suppress
  // this button's click. Stop the gesture here so no stick spawns on a press.
  const swallow = (e: Event) => e.stopPropagation()
  btn.addEventListener("pointerdown", swallow)
  btn.addEventListener("pointerup", swallow)
  btn.addEventListener("click", () => {
    try {
      opts.onOpen()
    } catch (err) {
      console.error("[wp/shell/phoneFab] onOpen threw:", err)
    }
  })
  opts.parent.appendChild(btn)
  // Paint the from-state first, then fade in.
  requestAnimationFrame(() => btn.classList.add("wp-phone-fab--in"))

  return {
    el: btn,
    hide() {
      btn.classList.remove("wp-phone-fab--in")
      btn.setAttribute("aria-hidden", "true")
      btn.tabIndex = -1
    },
    show() {
      btn.classList.add("wp-phone-fab--in")
      btn.removeAttribute("aria-hidden")
      btn.tabIndex = 0
    },
    setLabel(label: string) {
      btn.setAttribute("aria-label", label)
      btn.title = label
    },
    dispose() {
      btn.remove()
    },
  }
}
