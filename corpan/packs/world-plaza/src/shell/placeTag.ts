/**
 * placeTag — the RIGHT anchor of the two-anchor top HUD (TOP_HUD §0, §2): the
 * DEMOTED scene name, a quiet low-contrast "luggage tag." It REPLACES today's
 * centered `.wp-title` pill: the owner said "Antigua · 1770 doesn't need to be
 * so prominent," so the place/era moves out of the center into a small,
 * de-emphasized tag in the top-right corner. The rich lore lives one tap away in
 * the LEFT capsule's expanded card; this tag is just orientation + presence.
 *
 * It carries `place · era` + an optional online-presence pip (`● N`), nothing
 * else (scores live in the pack now). Responsive (TOP_HUD §2.3 matrix):
 *   - phone-portrait  → ICON-ONLY (📍 + pip; place/era text hidden, in the lore)
 *   - phone-landscape → place abbreviated + pip
 *   - tablet          → `place · era` + pip
 *   - desktop         → `place · era` + "● N online" (count labelled)
 * Driven entirely by CSS media queries off the responsive matrix; the JS renders
 * the full content and the stylesheet reveals the right amount per form factor.
 *
 * MOUNTING (the M0 lesson): it mounts INSIDE `.wp-overlay` (the host's accepted
 * render surface), NEVER `document.body`. `position:absolute` top-right,
 * safe-area-inset aware. Its visibility is governed by the chrome state machine
 * (`chromeVisibility`) via the `data-wp-chrome` attribute — it recedes during
 * dialogue/challenge/menu like the rest of the top band.
 *
 * Localized: every string flows through the injected `Translate` (the immersion
 * resolver's `uiLocale()` picks the language). Place/era are language-neutral
 * proper nouns from the Scene; the "online" word + the SR labels localize.
 */

import type { Translate } from "../contracts/runtime"

const LOG = "[wp/placeTag]"

/** The bit of Scene the tag reads — the demoted title source (TOP_HUD §6). */
export interface PlaceSetting {
  place: string
  era: string
}

export interface PlaceTagStrings {
  /** "{n} online" (desktop labelled pip). */
  online: (n: number) => string
  /** SR label for the presence pip, e.g. "3 players nearby". */
  presenceAria: (n: number) => string
}

export interface PlaceTagOptions {
  /** The game's `.wp-overlay` element — the tag mounts INSIDE this (never body). */
  overlay: HTMLElement
  /** Initial scene setting (place · era). */
  setting: PlaceSetting
  /** Accent color (Scene.palette.accent) so the tag tints with the world. */
  accent?: string
  /**
   * Online-presence getter (Seam 3 `presenceCount`) — count of remote players in
   * the room. OPTIONAL + omit-graceful: absent or `0` → no pip (solo/offline).
   * The orchestrator can call `refresh()` when presence changes.
   */
  presenceCount?: () => number
  /** Localized copy (the i18n seam decides the language). */
  strings?: Partial<PlaceTagStrings>
  /** The locale the labels render in (immersion `uiLocale()`); for `t(key, lang)`. */
  lang?: string
  /** The string seam; defaults to the English fallbacks. */
  t?: Translate
}

export interface PlaceTagHandle {
  /** the tag root (a child of `.wp-overlay`) — register it with chromeVisibility. */
  el: HTMLElement
  /** Re-skin on scene flip (Antigua ⇄ Tokyo) — re-renders place · era + accent. */
  setScene(setting: PlaceSetting, accent?: string): void
  /** Re-read the presence count (call when net presence changes). */
  refresh(): void
  dispose(): void
}

export function mountPlaceTag(opts: PlaceTagOptions): PlaceTagHandle {
  ensureStyles()

  const strings = resolveStrings(opts)
  let setting = opts.setting

  const root = document.createElement("div")
  root.className = "wp-placetag"
  if (opts.accent) root.style.setProperty("--wp-placetag-accent", opts.accent)

  // The pin glyph (shown phone-portrait icon-only; decorative elsewhere). Inline
  // SVG, NOT the 📍 emoji (FAB_POLISH §3.5: zero emoji in a premium surface — and
  // emoji pins don't render on Windows). Stroke inherits the tag's accent.
  const pin = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  pin.setAttribute("class", "wp-placetag-pin")
  pin.setAttribute("viewBox", "0 0 24 24")
  pin.setAttribute("fill", "none")
  pin.setAttribute("aria-hidden", "true")
  pin.innerHTML =
    '<path d="M12 21s-6.5-5.4-6.5-10.2A6.5 6.5 0 0 1 12 4a6.5 6.5 0 0 1 6.5 6.8C18.5 15.6 12 21 12 21Z" ' +
    'stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>' +
    '<circle cx="12" cy="10.6" r="2.3" fill="currentColor"/>'

  // place · era text (revealed by CSS per breakpoint).
  const placeEl = document.createElement("span")
  placeEl.className = "wp-placetag-place"
  const eraEl = document.createElement("span")
  eraEl.className = "wp-placetag-era"

  // Presence pip (`● N` / "● N online"). Hidden when solo/offline.
  const pip = document.createElement("span")
  pip.className = "wp-placetag-pip"
  pip.hidden = true
  const pipDot = document.createElement("span")
  pipDot.className = "wp-placetag-pip-dot"
  pipDot.setAttribute("aria-hidden", "true")
  const pipCount = document.createElement("span")
  pipCount.className = "wp-placetag-pip-count"
  const pipWord = document.createElement("span")
  pipWord.className = "wp-placetag-pip-word" // "online" — desktop only (CSS-revealed)
  pip.append(pipDot, pipCount, pipWord)

  const text = document.createElement("span")
  text.className = "wp-placetag-text"
  text.append(placeEl, eraEl)

  root.append(pin, text, pip)
  opts.overlay.appendChild(root)

  function renderSetting(): void {
    placeEl.textContent = setting.place
    eraEl.textContent = setting.era
    // A full SR label so the tag reads cleanly even when text is CSS-hidden.
    root.setAttribute("aria-label", `${setting.place} · ${setting.era}`)
  }

  function renderPresence(): void {
    let n = 0
    try {
      n = opts.presenceCount ? Math.max(0, Math.floor(opts.presenceCount())) : 0
    } catch (err) {
      console.error(`${LOG} presenceCount threw:`, err)
      n = 0
    }
    if (n <= 0) {
      pip.hidden = true
      pip.removeAttribute("aria-label")
      pipCount.textContent = ""
      pipWord.textContent = ""
      return
    }
    pip.hidden = false
    pipCount.textContent = String(n)
    pipWord.textContent = strings.online(n).replace(String(n), "").trim() || "online"
    pip.setAttribute("aria-label", strings.presenceAria(n))
  }

  renderSetting()
  renderPresence()
  // Paint the from-state, then fade in (compositor-only; reduced-motion-gated CSS).
  requestAnimationFrame(() => root.classList.add("wp-placetag--in"))

  return {
    el: root,
    setScene(next: PlaceSetting, accent?: string): void {
      setting = next
      if (accent) root.style.setProperty("--wp-placetag-accent", accent)
      renderSetting()
    },
    refresh: renderPresence,
    dispose(): void {
      try {
        root.remove()
      } catch (err) {
        console.error(`${LOG} dispose failed:`, err)
      }
    },
  }
}

/* -------------------------------------------------- strings ---------------- */

function resolveStrings(opts: PlaceTagOptions): PlaceTagStrings {
  const t = opts.t
  const lang = opts.lang ?? "en"
  const tr = (key: string, fallback: string, params?: Record<string, string | number>): string => {
    if (!t) return interpolate(fallback, params)
    const out = t(key, lang, params)
    return out && out !== key ? out : interpolate(fallback, params)
  }
  const defaults: PlaceTagStrings = {
    online: (n) => tr("wp.placetag.online", "{n} online", { n }),
    presenceAria: (n) =>
      tr("wp.placetag.presenceAria", n === 1 ? "1 player nearby" : "{n} players nearby", { n }),
  }
  return { ...defaults, ...(opts.strings ?? {}) }
}

function interpolate(s: string, params?: Record<string, string | number>): string {
  if (!params) return s
  return s.replace(/\{(\w+)\}/g, (_, k) => (k in params ? String(params[k]) : `{${k}}`))
}

/* -------------------------------------------------- scoped-inline styles --- */

let stylesInjected = false
function ensureStyles(): void {
  if (stylesInjected) return
  if (typeof document === "undefined") return
  if (document.querySelector("style[data-wp-placetag]")) {
    stylesInjected = true
    return
  }
  const style = document.createElement("style")
  style.setAttribute("data-wp-placetag", "")
  style.textContent = PLACETAG_CSS
  document.head.appendChild(style)
  stylesInjected = true
}

const PLACETAG_CSS = `
.wp-placetag {
  --wp-placetag-accent: #c46b4a;
  position: absolute;
  top: calc(10px + env(safe-area-inset-top, 0px));
  right: calc(12px + env(safe-area-inset-right, 0px));
  z-index: var(--wp-z-placetag, var(--wp-z-hud, 11));
  display: inline-flex;
  align-items: center;
  gap: 7px;
  /* Top-band horizontal reservation (FAB_POLISH §2.3): cap the tag so the capsule
     (≤58vw) + this tag (≤34vw) leave a center gutter — they can never collide. */
  max-width: min(34vw, 240px);
  padding: 5px 11px;
  border-radius: var(--wp-r-chip, 12px);
  /* The QUIETEST paper chip — a luggage tag. Raised 0.62→0.74 so it clears the
     contrast floor over a bright sky / neon Tokyo night while staying the quietest
     surface (FAB_POLISH §3.1). Shared cut-paper highlight + e1 elevation. */
  background: var(--wp-paper-quiet, rgba(244, 234, 212, 0.74));
  -webkit-backdrop-filter: blur(var(--wp-blur-chip, 6px)) saturate(1.02);
  backdrop-filter: blur(var(--wp-blur-chip, 6px)) saturate(1.02);
  box-shadow: var(--wp-e1, 0 2px 9px rgba(58, 47, 37, 0.14)), var(--wp-cut, inset 0 1px 0 rgba(255, 255, 255, 0.55));
  font-family: var(--wp-font, ui-rounded, "SF Pro Rounded", "Nunito", system-ui, -apple-system, sans-serif);
  color: #6b5a44;
  pointer-events: none; /* passive orientation chip */
  -webkit-tap-highlight-color: transparent;
  opacity: 0;
  transform: translateY(-4px);
  transition: opacity 0.22s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.22s cubic-bezier(0.22, 1, 0.36, 1);
}
.wp-placetag--in { opacity: 1; transform: translateY(0); }

/* The chrome state machine governs the whole top band. On the focused state the
   band STEPS BACK to .7 (still readable — the Talk CTA is the hero, FAB_POLISH
   §7.2); during dialogue/challenge/menu it recedes fully. One cohesive breath. */
.wp-placetag[data-wp-chrome="dim"] {
  opacity: 0.7;
  filter: saturate(0.95);
}
.wp-placetag[data-wp-chrome="hidden"] {
  opacity: 0 !important;
  transform: translateY(-6px);
  pointer-events: none;
}

.wp-placetag-pin {
  width: 15px; height: 15px; flex: none; display: none;
  color: var(--wp-placetag-accent, #c46b4a);
}
.wp-placetag-text {
  display: inline-flex; align-items: baseline; gap: 6px; min-width: 0;
}
.wp-placetag-place {
  font-size: 12.5px; font-weight: 700; letter-spacing: 0.01em; color: #5a4a38;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.wp-placetag-era {
  font-size: 11.5px; font-weight: 600; color: #9a8868;
  white-space: nowrap;
}
.wp-placetag-era::before { content: "· "; color: #b7a888; }

.wp-placetag-pip {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 11px; font-weight: 700; color: #5a8a4a;
}
.wp-placetag-pip-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: #5a8a4a; box-shadow: 0 0 0 2px rgba(90, 138, 74, 0.18);
}
.wp-placetag-pip-word { display: none; color: #6b8a5c; font-weight: 600; }

/* ---- Responsive matrix (TOP_HUD §2.3) ---- */

/* Phone-portrait: ICON-ONLY — pin + pip; place/era hidden (lives in the lore). */
@media (max-width: 540px) and (orientation: portrait) {
  .wp-placetag { gap: 5px; padding: 5px 9px; }
  .wp-placetag-pin { display: block; }
  .wp-placetag-text { display: none; }
}

/* Phone-landscape (short height): place abbreviated (era hidden) + pip. */
@media (max-width: 900px) and (orientation: landscape) and (max-height: 480px) {
  .wp-placetag-era { display: none; }
  .wp-placetag-place { max-width: 22vw; }
}

/* Desktop (fine pointer): label the pip ("N online"). */
@media (hover: hover) and (pointer: fine) and (min-width: 1025px) {
  .wp-placetag-pip-count + .wp-placetag-pip-word { display: inline; }
}

@media (prefers-reduced-motion: reduce) {
  .wp-placetag { transition: none; opacity: 1; transform: none; }
  .wp-placetag--in { transform: none; }
  .wp-placetag[data-wp-chrome="hidden"] { transform: none; }
}
`
