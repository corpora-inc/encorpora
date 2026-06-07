/**
 * Immersion toggle control (IMMERSION_TOGGLE §5.1) — the dignified, opt-in segmented
 * switch the learner uses to turn TOTAL IMMERSION on/off for the current Track.
 *
 * OFF = native help everywhere; ON = target language EVERYWHERE (the whole UI flips
 * to the target, the LLM goes target-only, challenges drop their native gloss). It
 * is a presentation choice, never a content gate, and never nags (no streak guilt).
 *
 * Self-contained: plain DOM + one idempotent injected stylesheet (the badgeStrings
 * convention), mounts INSIDE whatever host the caller passes (the menu's Quest
 * section, itself inside `.wp-overlay` — never `document.body`). For a single-
 * language Track the control is not rendered at all (no native to hide); the caller
 * checks `immersionToggleApplies(pair)` first.
 *
 * Localized: its own label/explainer render in the resolver's `uiLocale()` (so under
 * immersion the toggle itself reads in target — consistent), via the injected `t`.
 */

import type { Immersion } from "./immersion"
import type { BoundT } from "../i18n"

export interface ImmersionToggleOptions {
  /** Current level (the store's value for this Track, forced "on" if single-lang). */
  level: Immersion
  /** Accent colour (scene palette) so the control tints to the world. */
  accent?: string
  /** Called when the user flips the switch. The caller persists + re-renders. */
  onChange: (next: Immersion) => void
  /** Localized copy, bound to the UI locale (resolver's `uiLocale()`). */
  t: BoundT
}

export interface ImmersionToggleHandle {
  el: HTMLElement
  /** Reflect a new level (e.g. after an external store change). */
  setLevel(level: Immersion): void
  dispose(): void
}

export function mountImmersionToggle(
  host: HTMLElement,
  opts: ImmersionToggleOptions,
): ImmersionToggleHandle {
  ensureStyles()
  const { t } = opts
  let level: Immersion = opts.level

  const root = document.createElement("div")
  root.className = "wp-immersion"
  if (opts.accent) root.style.setProperty("--wp-immersion-accent", opts.accent)

  const head = document.createElement("div")
  head.className = "wp-immersion-head"
  const label = document.createElement("div")
  label.className = "wp-immersion-label"
  label.textContent = t("immersion.toggle.label")
  const sub = document.createElement("div")
  sub.className = "wp-immersion-sub"
  head.append(label, sub)

  // A two-state segmented switch (Off · On). `reveal` is collapsed to the nearer
  // endpoint for this MVP control (the reveal middle-tier ships in a later phase).
  const seg = document.createElement("div")
  seg.className = "wp-immersion-seg"
  seg.setAttribute("role", "group")
  const offBtn = segButton(t("immersion.toggle.off"))
  const onBtn = segButton(t("immersion.toggle.on"))
  seg.append(offBtn, onBtn)

  root.append(head, seg)
  host.appendChild(root)

  function reflect(): void {
    const on = level !== "off"
    offBtn.classList.toggle("wp-immersion-seg-btn--on", !on)
    onBtn.classList.toggle("wp-immersion-seg-btn--on", on)
    offBtn.setAttribute("aria-pressed", String(!on))
    onBtn.setAttribute("aria-pressed", String(on))
    sub.textContent = on
      ? t("immersion.toggle.subOn")
      : t("immersion.toggle.subOff")
  }

  const pick = (next: Immersion) => {
    if (next === level) return
    level = next
    reflect()
    try {
      opts.onChange(next)
    } catch (err) {
      console.error("[wp/immersion] onChange threw:", err)
    }
  }
  offBtn.addEventListener("click", () => pick("off"))
  onBtn.addEventListener("click", () => pick("on"))

  reflect()

  return {
    el: root,
    setLevel(next: Immersion): void {
      level = next
      reflect()
    },
    dispose(): void {
      try {
        root.remove()
      } catch (err) {
        console.error("[wp/immersion] toggle dispose failed:", err)
      }
    },
  }
}

function segButton(text: string): HTMLButtonElement {
  const b = document.createElement("button")
  b.type = "button"
  b.className = "wp-immersion-seg-btn"
  b.textContent = text
  return b
}

/* -------------------------------------------------- scoped-inline styles --- */

let stylesInjected = false
function ensureStyles(): void {
  if (stylesInjected) return
  if (typeof document === "undefined") return
  if (document.querySelector("style[data-wp-immersion]")) {
    stylesInjected = true
    return
  }
  const style = document.createElement("style")
  style.setAttribute("data-wp-immersion", "")
  style.textContent = CSS
  document.head.appendChild(style)
  stylesInjected = true
}

const CSS = `
.wp-immersion {
  --wp-immersion-accent: #c46b4a;
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  margin: 0 0 12px; padding: 11px 13px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid rgba(120, 100, 70, 0.16);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.55);
  font-family: ui-rounded, "SF Pro Rounded", "Nunito", system-ui, -apple-system, sans-serif;
}
.wp-immersion-head { min-width: 0; }
.wp-immersion-label { font-size: 13px; font-weight: 800; color: #2e261d; }
.wp-immersion-sub { margin-top: 2px; font-size: 11.5px; line-height: 1.3; color: #7a6a52; }
.wp-immersion-seg {
  flex: 0 0 auto; display: inline-flex; padding: 3px; gap: 2px;
  border-radius: 11px; background: rgba(120, 100, 70, 0.14);
}
.wp-immersion-seg-btn {
  appearance: none; border: 0; cursor: pointer;
  padding: 6px 13px; min-height: 32px; border-radius: 9px;
  background: transparent; color: #6b5a44;
  font: 700 12.5px/1 inherit; transition: background 0.15s ease, color 0.15s ease;
}
.wp-immersion-seg-btn--on {
  background: linear-gradient(180deg,
    color-mix(in srgb, var(--wp-immersion-accent) 78%, #fff),
    var(--wp-immersion-accent));
  color: #fff; box-shadow: 0 2px 6px rgba(58, 47, 37, 0.18);
}
.wp-immersion-seg-btn:focus-visible {
  outline: 2px solid var(--wp-immersion-accent); outline-offset: 2px;
}
@media (prefers-reduced-motion: reduce) {
  .wp-immersion-seg-btn { transition: none; }
}
`
