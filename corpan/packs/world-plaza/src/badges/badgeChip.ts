/**
 * The HUD focus-badge chip (BADGES_PROGRESSION §4.5) — REPLACES the static
 * `✨ ${inventory().xp()}` integer. It shows the medal CLOSEST to its next tier
 * for the active Track: the family glyph + a thin radial arc + a tiny "+N" pip on
 * credit. It IS the XP readout, but as visible progress toward a NAMED mastery,
 * not an abstract number. Tapping it opens the Badge Case.
 *
 * This produces the `focusBadge()` HUD glance (Seam 3) via the store and renders
 * it as a compact chip. The chip is self-contained (mounts a small element into
 * `.wp-overlay`, scoped-inline styles) so the orchestrator drops it in beside the
 * coins readout with one call; the coins readout stays the economy's, untouched.
 */

import type { IconRenderer } from "../contracts/runtime"
import type { BadgeStore, BadgeEvent } from "./badgeStore"
import { createBadgeT, badgeName, type BadgeT } from "./badgeStrings"
import type { Translate } from "../contracts/runtime"

export interface BadgeChipOptions {
  store: BadgeStore
  renderer: IconRenderer
  t: Translate
  lang: string
  /** open the Badge Case (orchestrator: `shell.openSection("badges")`). */
  onOpen: () => void
  accent?: string
}

export interface BadgeChipHandle {
  /** the chip element to place in the HUD (a child of `.wp-overlay`). */
  el: HTMLElement
  dispose(): void
}

const TIER_METAL: Record<string, string> = {
  locked: "#9aa3a7",
  bronze: "#b87333",
  silver: "#bdc3c7",
  gold: "#d4af37",
  platinum: "#cfe6ea",
}

export function createBadgeChip(opts: BadgeChipOptions): BadgeChipHandle {
  ensureStyles()
  const bt: BadgeT = createBadgeT(opts.t, opts.lang)
  const { store, renderer } = opts
  const reduced =
    typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches

  const el = document.createElement("button")
  el.type = "button"
  el.className = "wp-focusbadge"
  el.setAttribute("aria-label", "Badges")
  if (opts.accent) el.style.setProperty("--wp-focusbadge-accent", opts.accent)

  const medal = document.createElement("span")
  medal.className = "wp-focusbadge-medal"
  el.appendChild(medal)

  const label = document.createElement("span")
  label.className = "wp-focusbadge-label"
  el.appendChild(label)

  const pip = document.createElement("span")
  pip.className = "wp-focusbadge-pip"
  el.appendChild(pip)

  el.addEventListener("click", () => {
    try {
      opts.onOpen()
    } catch (err) {
      console.error("[wp/badges] focus-chip onOpen threw:", err)
    }
  })

  const render = () => {
    const glance = store.focusBadge()
    if (!glance) {
      // No touched badges yet → a quiet "start" affordance (never blank/crash).
      medal.replaceChildren()
      const canvas = renderer.renderIcon(
        { family: "medal", palette: TIER_METAL.locked, fillArc: 0, tier: "locked" },
        { size: 36 },
      )
      canvas.style.width = canvas.style.height = "20px"
      medal.appendChild(canvas)
      label.textContent = ""
      el.classList.add("wp-focusbadge--empty")
      return
    }
    el.classList.remove("wp-focusbadge--empty")
    medal.replaceChildren()
    const canvas = renderer.renderIcon(
      {
        family: "medal",
        palette: TIER_METAL[glance.tier] ?? TIER_METAL.bronze,
        fillArc: glance.arc,
        tier: glance.tier,
        motif: glance.glyph,
        accent: opts.accent,
      },
      { size: 36 },
    )
    canvas.style.width = canvas.style.height = "20px"
    medal.appendChild(canvas)
    const def = store.catalog.get(glance.badgeId)
    label.textContent = def ? badgeName(def, bt) : ""
  }

  // Animate a "+N" pip when a deposit credits the focus badge.
  const showPip = (e: BadgeEvent) => {
    if (e.type !== "deposit" || e.touched.length === 0) return
    pip.textContent = "+"
    pip.classList.add("wp-focusbadge-pip--show")
    if (reduced) {
      window.setTimeout(() => pip.classList.remove("wp-focusbadge-pip--show"), 600)
    } else {
      window.setTimeout(() => pip.classList.remove("wp-focusbadge-pip--show"), 900)
    }
  }

  render()
  const unsub = store.subscribe((e) => {
    if (e.type === "deposit" || e.type === "grant") showPip(e)
    render()
  })

  return {
    el,
    dispose() {
      unsub()
      el.remove()
    },
  }
}

/* -------------------------------------------------- scoped-inline styles --- */

let stylesInjected = false
function ensureStyles(): void {
  if (stylesInjected) return
  if (typeof document === "undefined") return
  if (document.querySelector("style[data-wp-focusbadge]")) {
    stylesInjected = true
    return
  }
  const style = document.createElement("style")
  style.setAttribute("data-wp-focusbadge", "")
  style.textContent = CHIP_CSS
  document.head.appendChild(style)
  stylesInjected = true
}

const CHIP_CSS = `
.wp-focusbadge {
  position: relative; display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 11px 4px 6px; border: none; border-radius: var(--wp-r-pill, 999px);
  background: var(--wp-paper-chip, rgba(247,239,224,0.88)); color: var(--wp-ink, #2e261d); cursor: pointer;
  font: 700 12px/1 var(--wp-font, ui-rounded, "SF Pro Rounded", "Nunito", system-ui, sans-serif); letter-spacing: 0.01em;
  -webkit-backdrop-filter: blur(var(--wp-blur-chip, 6px)); backdrop-filter: blur(var(--wp-blur-chip, 6px));
  box-shadow: var(--wp-e1, 0 2px 8px rgba(58,47,37,0.14)), var(--wp-cut, inset 0 1px 0 rgba(255,255,255,0.55));
  max-width: 180px; -webkit-tap-highlight-color: transparent;
}
.wp-focusbadge-medal { width: 20px; height: 20px; display: grid; place-items: center; flex: 0 0 auto; }
.wp-focusbadge-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 130px; }
.wp-focusbadge--empty { opacity: 0.7; }
.wp-focusbadge-pip {
  position: absolute; top: -6px; right: -4px; min-width: 16px; height: 16px; padding: 0 3px;
  border-radius: var(--wp-r-pill, 999px); background: var(--wp-focusbadge-accent, var(--wp-accent, #c46b4a)); color: #fff7f0;
  font: 800 11px/16px var(--wp-font, ui-rounded, system-ui, sans-serif); text-align: center;
  opacity: 0; transform: translateY(2px) scale(0.7); transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.2,0.9,0.3,1.4);
  pointer-events: none;
}
.wp-focusbadge-pip--show { opacity: 1; transform: translateY(0) scale(1); }
@media (prefers-reduced-motion: reduce) { .wp-focusbadge-pip { transition: opacity 0.15s ease; transform: none; } }
`
