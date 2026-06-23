/**
 * The two premium fullscreen ENTRY surfaces, both built as plain DOM into a host
 * container (the `.wp-overlay`, mirroring the onboarding card + vignette roots):
 *
 *   - `showLanguageChooser()` — MULTI-target stacks. An elegant grid of the
 *     learner's study languages; picking one resolves the target for this
 *     session. No "skip" (a target is required to play); the host's own back/exit
 *     governs leaving the pack.
 *
 *   - `showWelcome()` — the brief, warm, hand-holdy welcome into the plaza: who
 *     you are (your paper self), where you are (Corpan City), and the language
 *     goal (learn TARGET, or — for a single-language stack — practice TARGET).
 *     One "Step into the morning light" CTA.
 *
 * On-brand: warm/understated, no AI slop, no emoji-as-UI beyond one quiet stamp.
 * Both reuse the entry stylesheet (`ensureEntryStyles`) and resolve a Promise the
 * orchestrator awaits — the same lifecycle shape as `runOnboarding`.
 */

import type { LearnerPair } from "@corpan-city/contracts"
import { ensureEntryStyles } from "./styles"
import { bilabel, langTag, nativeName, englishName } from "./languageNames"
import { isImmersion } from "./stackAdapter"
import { bindT, applyDir, type BoundT } from "../i18n"

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string,
): HTMLElementTagNameMap[K] => {
  const n = document.createElement(tag)
  if (cls) n.className = cls
  if (text !== undefined) n.textContent = text
  return n
}

export interface SurfaceOptions {
  /** Scene accent so the surface tints to the world (e.g. `scene.palette.accent`). */
  accent?: string
  /** The player's chosen plaza name, woven into the welcome copy. */
  playerName?: string
  /** The place name to anchor the welcome ("Corpan City"). */
  place?: string
  /**
   * The learner's NATIVE language (`learnerPair.native` / stack `languages[0]`).
   * ALL chrome copy renders in this language, and the surface orients RTL when it
   * is a right-to-left script. Defaults to "en" when absent (standalone dev).
   */
  native?: string
}

/** Mount the shared fullscreen root + run-in transition; returns root + a closer. */
function mountRoot(
  container: HTMLElement,
  accent?: string,
  native?: string,
): { root: HTMLElement; card: HTMLElement; close: (then: () => void) => void } {
  ensureEntryStyles()
  const root = el("div", "wp-entry-root")
  root.setAttribute("role", "dialog")
  root.setAttribute("aria-modal", "true")
  // Orient the fullscreen surface for an RTL native (Arabic, Hebrew, Farsi, Urdu).
  applyDir(root, native ?? "en")
  const card = el("div", "wp-entry-card")
  if (accent) card.style.setProperty("--wp-entry-accent", accent)
  root.appendChild(card)
  container.appendChild(root)
  requestAnimationFrame(() => root.classList.add("wp-entry-root--in"))

  const reduced =
    typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches
  const close = (then: () => void) => {
    root.classList.remove("wp-entry-root--in")
    root.classList.add("wp-entry-root--out")
    window.setTimeout(
      () => {
        root.remove()
        then()
      },
      reduced ? 180 : 420,
    )
  }
  return { root, card, close }
}

/**
 * The MULTI-target language chooser. `targets` are the study languages from the
 * stack (already excludes the primary; ordered as the stack lists them). Resolves
 * with the picked code. The chooser only appears when `targets.length > 1`, so it
 * always has a real choice to offer.
 */
export function showLanguageChooser(
  container: HTMLElement,
  targets: string[],
  opts: SurfaceOptions = {},
): Promise<string> {
  return new Promise<string>((resolve) => {
    const { card, close } = mountRoot(container, opts.accent, opts.native)
    const t: BoundT = bindT(opts.native ?? "en")

    card.appendChild(el("div", "wp-entry-stamp", "✦"))
    card.appendChild(el("div", "wp-entry-eyebrow", t("chooser.eyebrow")))
    card.appendChild(el("h1", "wp-entry-title", t("chooser.title")))
    card.appendChild(el("p", "wp-entry-sub", t("chooser.sub")))

    const grid = el("div", "wp-entry-langs")
    let settled = false
    targets.forEach((code) => {
      const btn = el("button", "wp-entry-lang")
      btn.type = "button"
      const lb = bilabel(code)
      btn.setAttribute("aria-label", t("chooser.playIn", { lang: englishName(code) }))
      btn.appendChild(el("span", "wp-entry-lang__tag", langTag(code)))
      const body = el("div", "wp-entry-lang__body")
      body.appendChild(el("span", "wp-entry-lang__native", lb.primary))
      if (lb.secondary) body.appendChild(el("span", "wp-entry-lang__en", lb.secondary))
      btn.appendChild(body)
      btn.appendChild(el("span", "wp-entry-lang__chev", "›"))
      btn.onclick = () => {
        if (settled) return
        settled = true
        close(() => resolve(code))
      }
      grid.appendChild(btn)
    })
    card.appendChild(grid)
  })
}

/**
 * The premium welcome interlude. Sets the player up: their paper self, the place,
 * and the language goal. For a single-language (immersion) stack the goal line
 * reads "practice" rather than "learn X from Y". Resolves when the player taps the
 * single CTA.
 */
export function showWelcome(
  container: HTMLElement,
  pair: LearnerPair,
  opts: SurfaceOptions = {},
): Promise<void> {
  return new Promise<void>((resolve) => {
    // The native locale ALL welcome copy renders in: the option overrides, else
    // the pair's native (the language the learner knows). RTL-orients the surface.
    const native = opts.native ?? pair.native
    const { card, close } = mountRoot(container, opts.accent, native)
    const t: BoundT = bindT(native)
    const place = opts.place ?? "Corpan City"
    const target = nativeName(pair.target)
    const immersion = isImmersion(pair)
    // Bold the interpolated name/place/target inside a fact body. The fact body
    // is built as innerHTML, so we pass the value ALREADY escaped + wrapped in
    // <strong> as the token; t(...) interpolates it into the (trusted, code-
    // authored) localized sentence. Word order is per-language — the emphasis
    // lands wherever that locale places the token. Safe: the only HTML in the
    // result is our own <strong> around an escaped value.
    const strongValue = (key: Parameters<BoundT>[0], token: string, value: string): string =>
      t(key, { [token]: `<strong>${escapeHtml(value)}</strong>` })

    card.appendChild(el("div", "wp-entry-stamp", "☼"))
    card.appendChild(el("div", "wp-entry-eyebrow", t("welcome.eyebrow")))
    card.appendChild(
      el(
        "h1",
        "wp-entry-title",
        opts.playerName
          ? t("welcome.titleNamed", { name: opts.playerName })
          : t("welcome.title"),
      ),
    )
    card.appendChild(el("p", "wp-entry-sub", t("welcome.sub")))

    const facts = el("div", "wp-entry-facts")
    facts.appendChild(
      fact(
        "☻",
        t("welcome.you.title"),
        opts.playerName
          ? strongValue("welcome.you.bodyNamed", "name", opts.playerName)
          : t("welcome.you.body"),
      ),
    )
    facts.appendChild(
      fact("⌂", t("welcome.where.title"), strongValue("welcome.where.body", "place", place)),
    )
    facts.appendChild(
      fact(
        "✎",
        immersion ? t("welcome.practice.title") : t("welcome.goal.title"),
        immersion
          ? strongValue("welcome.practice.body", "lang", target)
          : strongValue("welcome.goal.body", "lang", target),
      ),
    )
    card.appendChild(facts)

    const go = el("button", "wp-entry-btn", t("welcome.cta"))
    go.type = "button"
    let settled = false
    go.onclick = () => {
      if (settled) return
      settled = true
      close(() => resolve())
    }
    card.appendChild(go)
  })
}

function fact(glyph: string, title: string, subHtml: string): HTMLElement {
  const row = el("div", "wp-entry-fact")
  row.appendChild(el("span", "wp-entry-fact__glyph", glyph))
  const body = el("div", "wp-entry-fact__body")
  body.appendChild(el("div", "wp-entry-fact__title", title))
  const sub = el("div", "wp-entry-fact__sub")
  sub.innerHTML = subHtml // only ever built from escapeHtml'd values above
  body.appendChild(sub)
  row.appendChild(body)
  return row
}

/** Minimal HTML escape for the few interpolated names in the welcome facts. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
