/**
 * phoneFab — the SINGLE always-visible launcher for the Phone simulator.
 *
 * It is THE CORPÁN APP LOGO (the "all-hearing ear" atop the stepped plaza) — the
 * real brand mark, exactly like the app's icon on a real phone's home screen, NOT
 * a hand-drawn glyph (owner direction, corpan-city-phone-os). The mark is inlined
 * as a data URI (`assets/corpanMark.ts`) so it ships inside the single-file pack.
 *
 * This is now the ONLY bottom-left FAB: the old satchel "pack" button is retired
 * and the phone subsumes the menu, so the owner's "allergic to multiple FABs in
 * one place" is honoured — one logo FAB → the phone.
 *
 * Like the retired pack button it mounts INSIDE `.wp-overlay` (never document.body
 * — the M0 host-clip fix) and STOPS the pointer gesture so the dual-joystick layer
 * can't steal its tap (the joystick-steals-taps trap). It owns the bottom-LEFT
 * corner outright. It is a `pack`-role chrome surface, so it recedes with the rest
 * of the chrome under focus/dialogue/challenge (one cohesive breath).
 */

import { CORPAN_MARK_DATA_URI } from "../../assets/corpanMark"

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

// The Corpán brand mark — the real app logo (data URI, see assets/corpanMark.ts).
const MARK_IMG =
  `<img class="wp-phone-fab-mark" src="${CORPAN_MARK_DATA_URI}" alt="" aria-hidden="true" draggable="false" />`

export function createPhoneFab(opts: PhoneFabOptions): PhoneFabHandle {
  const btn = document.createElement("button")
  btn.type = "button"
  btn.className = "wp-phone-fab"
  btn.setAttribute("aria-label", opts.label ?? "Phone")
  btn.title = opts.label ?? "Phone"
  if (opts.accent) btn.style.setProperty("--wp-phone-fab-accent", opts.accent)
  btn.innerHTML = MARK_IMG

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
