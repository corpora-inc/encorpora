/**
 * questTracker → the Status Capsule (TOP_HUD §0–§3): the LEFT anchor of the
 * two-anchor top HUD. It EVOLVES the old quest tracker into the keystone,
 * expandable chrome element:
 *
 *   collapsed glance  = flag-pair lozenge (+ immersion pip) · quest · objective ·
 *                       "what next" hint  (today's tracker, kept — the owner said
 *                       it's good)
 *   expanded detail   = an in-overlay detail card revealing full quest progress
 *                       (step N of M), the location/era LORE, a WEALTH glance and
 *                       a FOCUS-BADGE glance — each a button that deep-links into
 *                       the pack (Wallet / Badge Case / Quest). It is idea B's
 *                       "one element that expands for more detail," realized.
 *
 * It still INFORMS, never nags (no Duolingo dark patterns): no countdowns, no
 * streak guilt. The only ambient motion is the gentle pulse on the current-
 * objective row, opted out under `prefers-reduced-motion`; expand/collapse is one
 * calm compositor-only ease.
 *
 * MOUNTING (the lesson M0 paid for): the capsule AND its expanded card mount
 * INSIDE the game's `.wp-overlay` — the host's accepted render surface — NOT
 * `document.body` (a body-fixed panel is clipped invisible when the pack is
 * embedded in Corpán). The caller passes the overlay; we `position:absolute`
 * within it, the card anchored under the glance.
 *
 * It subscribes to BOTH the `QuestEngine` and `inventory()`, so the moment the
 * required item is acquired the hint flips from "find the ferry token" to "bring
 * it to the boatman" with no caller intervention.
 *
 * CONSUMER of Seam 3 (TOP_HUD §6): every glance getter (`trackPair`,
 * `walletGlance`, `focusBadge`) and the `ImmersionResolver` / `Translate` are
 * OPTIONAL and omit-graceful — a missing getter simply omits its row, so the
 * capsule ships incrementally as each producer (economy / badges / track /
 * immersion) lands. It loads no heavy state; the pack (satchel) is the ledger.
 *
 * BACKWARD COMPATIBLE: `mountQuestTracker(parent, opts)` keeps its old shape; all
 * new capabilities are additive optional opts, so the existing call site compiles
 * unchanged and the orchestrator wires the glances/immersion/chrome edge as each
 * system arrives.
 */

import type { QuestEngine, StepState } from "./questState"
import type { InventoryStore } from "../economy/inventory"
import { requiredForStep } from "../economy/questItems"
import { getItemDef } from "../economy/inventory"
import type {
  HudGlances,
  ImmersionResolver,
  Translate,
  TrackPairGlance,
  WalletGlance,
  FocusBadgeGlance,
} from "../contracts/runtime"

const LOG = "[wp/statusCapsule]"

/** Localization-ready copy (~50 langs). The caller overrides per-locale. */
export interface QuestTrackerStrings {
  /** Heading prefix, e.g. "Quest". */
  questLabel: string
  /** Builds "find {item}" when the step needs an item. */
  findItem: (item: string) => string
  /** Builds "bring {item} to {who}" when ready to deliver. */
  deliverItem: (item: string, who: string) => string
  /** Builds "→ talk to {who}" hint when the step has a special NPC. */
  talkTo: (who: string) => string
  /** Builds "Begin the challenge with {who}" when the step is challenge-gated. */
  beginChallenge: (who: string) => string
  /** Builds "step {done} of {total}". */
  progress: (done: number, total: number) => string
  /** Shown when the quest is complete (next-level affordance). */
  complete: string
  /** The "tap for detail" affordance label (desktop pill / SR). */
  details: string
  /** Collapse affordance / SR. */
  collapse: string
  /** Immersion state line, e.g. "Immersion: reveal". */
  immersion: (level: string) => string
  /** Deep-link button labels. */
  openQuest: string
  openWallet: string
  openBadges: string
  /** Section heading for the location/era lore block. */
  location: string
}

const DEFAULT_STRINGS: QuestTrackerStrings = {
  questLabel: "Quest",
  findItem: (item) => `Find ${item}`,
  deliverItem: (item, who) => `Bring ${item} to ${who}`,
  talkTo: (who) => `→ talk to ${who}`,
  beginChallenge: (who) => `Begin the challenge with ${who}`,
  progress: (done, total) => `Step ${done} of ${total}`,
  complete: "Quest complete — onward!",
  details: "Details",
  collapse: "Close",
  immersion: (level) => `Immersion: ${level}`,
  openQuest: "Open quest",
  openWallet: "Wallet",
  openBadges: "Badges",
  location: "Location",
}

/** A flag emoji for a language/region code (graceful fallback to the code). */
const LANG_FLAG: Record<string, string> = {
  en: "🇬🇧", es: "🇪🇸", fr: "🇫🇷", de: "🇩🇪", it: "🇮🇹", pt: "🇵🇹", ja: "🇯🇵",
  ko: "🇰🇷", zh: "🇨🇳", ru: "🇷🇺", ar: "🇸🇦", hi: "🇮🇳", nl: "🇳🇱", sv: "🇸🇪",
  pl: "🇵🇱", tr: "🇹🇷", vi: "🇻🇳", th: "🇹🇭", id: "🇮🇩", uk: "🇺🇦", el: "🇬🇷",
}
function flagFor(code: string): string {
  const base = code.toLowerCase().split(/[-_]/)[0]
  return LANG_FLAG[base] ?? base.toUpperCase()
}

/** The location/era info the expanded card's lore block reads (TOP_HUD §3.2). */
export interface CapsulePlace {
  place: string
  era: string
  /** authored flavor line (Scene.narrativeBlurb); falls back to place · era. */
  lore?: string
}

export interface QuestTrackerOptions {
  engine: QuestEngine
  inventory: InventoryStore
  /** Resolve a special-NPC/anchor id to a friendly name ("the boatman"). */
  anchorName?: (anchorId: string) => string
  /** Accent colour (scene palette) for the objective row + lozenge tint. */
  accent?: string
  /** Localized copy. */
  strings?: Partial<QuestTrackerStrings>
  /**
   * Deep-link into a pack section (TOP_HUD §3.2). The expanded card's buttons
   * call this; falls back to `onOpenDetail` for the quest section.
   */
  openSection?: (section: "wallet" | "badges" | "quest") => void
  /** Legacy: tapping opens the menu's Quest section (kept as a fallback). */
  onOpenDetail?: () => void
  /** The glance getters (Seam 3). Each OPTIONAL → omit-graceful. */
  glances?: HudGlances
  /** The immersion resolver — picks `uiLocale()` + supplies the immersion pip. */
  immersion?: ImmersionResolver
  /** The i18n seam (the lore/labels render in `immersion.uiLocale()` / `lang`). */
  t?: Translate
  /** Locale for `t(key, lang)` when no resolver is given. */
  lang?: string
  /** Location/era for the expanded lore block (the demoted Place Tag's detail). */
  place?: CapsulePlace
}

export interface QuestTrackerHandle {
  /** the capsule root (a child of `.wp-overlay`) — register with chromeVisibility. */
  el: HTMLElement
  /** Force a re-render (rarely needed; it auto-subscribes). */
  refresh(): void
  /** Re-skin the lore block + accent on scene flip (Antigua ⇄ Tokyo). */
  setScene?(place: CapsulePlace, accent?: string): void
  /** Programmatically collapse the expanded card (e.g. when chrome recedes). */
  collapse(): void
  dispose(): void
}

/**
 * Mount the Status Capsule into `parent` (the `.wp-overlay` element). Returns a
 * handle that unsubscribes + removes the node on dispose.
 */
export function mountQuestTracker(
  parent: HTMLElement,
  opts: QuestTrackerOptions,
): QuestTrackerHandle {
  ensureStyles()
  // `let` (not const) so `relocalize` can swap the localized copy in place when the
  // immersion toggle flips the UI locale without a world rebuild (IMMERSION_TOGGLE).
  let strings: QuestTrackerStrings = { ...DEFAULT_STRINGS, ...(opts.strings ?? {}) }
  const anchorName = opts.anchorName ?? ((a: string) => prettyAnchor(a))
  const reduced =
    typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches
  let place = opts.place
  let expanded = false

  /* ---- root + collapsed glance ------------------------------------------- */

  const root = document.createElement("div")
  root.className = "wp-status"
  root.setAttribute("role", "status")
  root.setAttribute("aria-live", "polite")
  if (opts.accent) root.style.setProperty("--wp-status-accent", opts.accent)

  const glance = document.createElement("div")
  glance.className = "wp-status-glance"

  const head = document.createElement("div")
  head.className = "wp-status-head"
  // Flag-pair lozenge (TrackPairGlance) — prefixes the head; hidden if no track.
  const lozenge = document.createElement("span")
  lozenge.className = "wp-status-lozenge"
  lozenge.hidden = true
  const titleEl = document.createElement("div")
  titleEl.className = "wp-status-title"
  // The "Details ▸" affordance (a visible pill on desktop; the trailing ▸ chevron
  // elsewhere). It is the expand trigger's visual cue.
  const detailsCue = document.createElement("span")
  detailsCue.className = "wp-status-cue"
  detailsCue.setAttribute("aria-hidden", "true")
  detailsCue.textContent = "▸"
  head.append(lozenge, titleEl, detailsCue)

  const objectiveEl = document.createElement("div")
  objectiveEl.className = "wp-status-objective"
  const hintEl = document.createElement("div")
  hintEl.className = "wp-status-hint"

  glance.append(head, objectiveEl, hintEl)
  root.appendChild(glance)

  /* ---- expanded detail card (in-overlay, M0) ----------------------------- */

  const card = document.createElement("div")
  card.className = "wp-status-detail"
  card.hidden = true
  card.setAttribute("role", "group")

  const cardHead = document.createElement("div")
  cardHead.className = "wp-status-detail-head"
  const cardImmersion = document.createElement("span")
  cardImmersion.className = "wp-status-immersion"
  const closeBtn = document.createElement("button")
  closeBtn.type = "button"
  closeBtn.className = "wp-status-close"
  closeBtn.textContent = "✕"
  cardHead.append(cardImmersion, closeBtn)

  // Quest detail: title + progress bar + step list.
  const questBlock = document.createElement("div")
  questBlock.className = "wp-status-block wp-status-quest"
  const questTitle = document.createElement("div")
  questTitle.className = "wp-status-detail-title"
  const progressRow = document.createElement("div")
  progressRow.className = "wp-status-progress"
  const progressBar = document.createElement("div")
  progressBar.className = "wp-status-bar"
  const progressFill = document.createElement("div")
  progressFill.className = "wp-status-bar-fill"
  progressBar.appendChild(progressFill)
  const stepList = document.createElement("ol")
  stepList.className = "wp-status-steps"
  const questLink = linkButton(strings.openQuest, () => deepLink("quest"))
  questBlock.append(questTitle, progressRow, progressBar, stepList, questLink)

  // Location / era lore block (the demoted Place Tag's detail surfaces here).
  const loreBlock = document.createElement("div")
  loreBlock.className = "wp-status-block wp-status-lore"
  const loreHead = document.createElement("div")
  loreHead.className = "wp-status-lore-head"
  const loreText = document.createElement("div")
  loreText.className = "wp-status-lore-text"
  loreBlock.append(loreHead, loreText)

  // Glance bridges: wealth + focus-badge, each a deep-link button. Omit-graceful.
  const bridges = document.createElement("div")
  bridges.className = "wp-status-bridges"
  const walletBtn = bridgeButton("wp-status-wallet", () => deepLink("wallet"))
  const badgeBtn = bridgeButton("wp-status-badge", () => deepLink("badges"))
  bridges.append(walletBtn.el, badgeBtn.el)

  card.append(cardHead, questBlock, loreBlock, bridges)
  root.appendChild(card)

  parent.appendChild(root)

  /* ---- expand / collapse ------------------------------------------------- */

  function deepLink(section: "wallet" | "badges" | "quest"): void {
    try {
      if (opts.openSection) opts.openSection(section)
      else if (section === "quest") opts.onOpenDetail?.()
    } catch (err) {
      console.error(`${LOG} deep-link ${section} threw:`, err)
    }
  }

  function setExpanded(next: boolean): void {
    if (next === expanded) return
    expanded = next
    root.classList.toggle("wp-status--expanded", expanded)
    root.setAttribute("aria-expanded", expanded ? "true" : "false")
    if (expanded) {
      renderDetail()
      card.hidden = false
      // Paint hidden→shown next frame so the transition runs (unless reduced).
      if (!reduced) {
        card.classList.remove("wp-status-detail--in")
        requestAnimationFrame(() => card.classList.add("wp-status-detail--in"))
      } else {
        card.classList.add("wp-status-detail--in")
      }
      closeBtn.focus()
    } else {
      card.classList.remove("wp-status-detail--in")
      if (reduced) {
        card.hidden = true
      } else {
        window.setTimeout(() => {
          if (!expanded) card.hidden = true
        }, 220)
      }
    }
  }

  const isInteractive = Boolean(opts.openSection || opts.onOpenDetail || opts.glances || opts.place)
  if (isInteractive) {
    root.classList.add("wp-status--tappable")
    glance.tabIndex = 0
    glance.setAttribute("role", "button")
    glance.setAttribute("aria-expanded", "false")
    glance.setAttribute("aria-label", `${strings.questLabel} — ${strings.details}`)
    const toggle = () => setExpanded(!expanded)
    glance.addEventListener("click", toggle)
    glance.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        toggle()
      } else if (e.key === "Escape" && expanded) {
        e.preventDefault()
        setExpanded(false)
        glance.focus()
      }
    })
    // Desktop hover-peek (fine pointer): auto-expand on hover, click pins.
    const finePointer =
      typeof matchMedia === "function" && matchMedia("(hover: hover) and (pointer: fine)").matches
    if (finePointer) {
      let pinned = false
      glance.addEventListener("click", () => {
        pinned = expanded
      })
      root.addEventListener("mouseenter", () => {
        if (!expanded) setExpanded(true)
      })
      root.addEventListener("mouseleave", () => {
        if (!pinned) setExpanded(false)
      })
    }
  }

  closeBtn.addEventListener("click", () => {
    setExpanded(false)
    glance.focus()
  })
  closeBtn.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault()
      setExpanded(false)
      glance.focus()
    }
  })

  /* ---- helpers ----------------------------------------------------------- */

  function itemLabel(id: string): string {
    return getItemDef(id)?.name ?? id
  }

  function trackPair(): TrackPairGlance | null {
    try {
      return opts.glances?.trackPair?.() ?? null
    } catch (err) {
      console.error(`${LOG} trackPair threw:`, err)
      return null
    }
  }
  function walletGlance(): WalletGlance | null {
    try {
      return opts.glances?.walletGlance?.() ?? null
    } catch (err) {
      console.error(`${LOG} walletGlance threw:`, err)
      return null
    }
  }
  function focusBadge(): FocusBadgeGlance | null {
    try {
      return opts.glances?.focusBadge?.() ?? null
    } catch (err) {
      console.error(`${LOG} focusBadge threw:`, err)
      return null
    }
  }

  /* ---- render: collapsed glance ------------------------------------------ */

  function renderLozenge(): void {
    const pair = trackPair()
    if (!pair) {
      lozenge.hidden = true
      return
    }
    lozenge.hidden = false
    const pip =
      pair.immersion === "on" ? "●" : pair.immersion === "reveal" ? "◐" : ""
    lozenge.textContent = `${flagFor(pair.native)}→${flagFor(pair.target)}${pip}`
    lozenge.setAttribute(
      "aria-label",
      `${pair.native} to ${pair.target}, immersion ${pair.immersion}`,
    )
    lozenge.classList.toggle("wp-status-lozenge--immersion", pair.immersion !== "off")
  }

  function render(): void {
    try {
      const quest = opts.engine.quest()
      const steps = quest.steps
      const state = opts.engine.state()
      const doneCount = steps.filter((s) => state.stepDone[s.id]).length

      renderLozenge()
      titleEl.textContent = quest.title

      if (state.complete) {
        objectiveEl.textContent = strings.complete
        hintEl.textContent = ""
        hintEl.hidden = true
        root.classList.remove("wp-status--active")
        root.classList.add("wp-status--complete")
        if (expanded) renderDetail()
        return
      }
      root.classList.remove("wp-status--complete")

      const step = opts.engine.currentStep()
      if (!step) {
        objectiveEl.textContent = ""
        hintEl.hidden = true
        if (expanded) renderDetail()
        return
      }

      objectiveEl.textContent = step.label || step.id

      const st: StepState = opts.engine.stepState(step.id)
      const who = step.anchorId ? anchorName(step.anchorId) : null
      const requiredIds = requiredForStep(quest.id, step.id)
      const needed = requiredIds.find((id) => !opts.inventory.has(id))
      const held = requiredIds.find((id) => opts.inventory.has(id))

      let hint = ""
      if (step.kind === "traverse" || step.kind === "find") {
        // TRAVERSE / FIND (#26): completion = WALK to the spot. The label is
        // already an imperative cue ("Cross the river bridge") — hand-hold with it
        // plus a directional arrow so it reads as "go here", not "talk to someone".
        hint = `${step.label} →`
      } else if (st === "needs-item" && needed) {
        hint = strings.findItem(itemLabel(needed))
      } else if (st === "ready-to-deliver" && held && who) {
        hint = strings.deliverItem(itemLabel(held), who)
      } else if (st === "needs-challenge" && who) {
        // Challenge-gated step (no item rule) → hand-hold to the Begin affordance.
        hint = strings.beginChallenge(who)
      } else if (who) {
        hint = strings.talkTo(who)
      }
      hintEl.textContent = hint
      hintEl.hidden = hint.length === 0

      void doneCount
      root.classList.add("wp-status--active")
      if (expanded) renderDetail()
    } catch (err) {
      console.error(`${LOG} render failed:`, err)
    }
  }

  /* ---- render: expanded detail card -------------------------------------- */

  function renderDetail(): void {
    try {
      const quest = opts.engine.quest()
      const steps = quest.steps
      const state = opts.engine.state()
      const doneCount = steps.filter((s) => state.stepDone[s.id]).length
      const activeStep = opts.engine.currentStep()

      // Immersion line (read-only state).
      const level = opts.immersion?.level()
      if (level) {
        cardImmersion.textContent = strings.immersion(level)
        cardImmersion.hidden = false
      } else {
        cardImmersion.hidden = true
      }

      // Quest detail.
      questTitle.textContent = quest.title
      progressRow.textContent = strings.progress(doneCount, steps.length)
      const pct = steps.length ? Math.round((doneCount / steps.length) * 100) : 0
      progressFill.style.width = `${pct}%`
      stepList.replaceChildren()
      for (const s of steps) {
        const li = document.createElement("li")
        const done = Boolean(state.stepDone[s.id])
        const active = !done && activeStep?.id === s.id
        li.className =
          "wp-status-step" +
          (done ? " wp-status-step--done" : active ? " wp-status-step--active" : "")
        li.textContent = s.label || s.id
        stepList.appendChild(li)
      }

      // Location / era lore.
      if (place) {
        loreHead.textContent = `${strings.location}: ${place.place} · ${place.era}`
        const lore = place.lore && place.lore.trim().length ? place.lore : `${place.place} · ${place.era}`
        loreText.textContent = lore
        loreBlock.hidden = false
      } else {
        loreBlock.hidden = true
      }

      // Wealth glance bridge (omit if absent).
      const wallet = walletGlance()
      if (wallet) {
        walletBtn.setLabel(wallet.major, strings.openWallet)
        walletBtn.setIcon(wallet.icon ? null : "💵")
        walletBtn.el.hidden = false
      } else {
        walletBtn.el.hidden = true
      }

      // Focus-badge glance bridge (replaces the ✨ integer; omit if absent).
      const badge = focusBadge()
      if (badge) {
        const arcPct = Math.round((badge.arc ?? 0) * 100)
        badgeBtn.setLabel(`${badge.glyph} ${badge.tier} ${arcPct}%`, strings.openBadges)
        badgeBtn.setIcon("🏅")
        badgeBtn.el.hidden = false
      } else {
        badgeBtn.el.hidden = true
      }

      bridges.hidden = walletBtn.el.hidden && badgeBtn.el.hidden
    } catch (err) {
      console.error(`${LOG} renderDetail failed:`, err)
    }
  }

  render()
  const unsubEngine = opts.engine.subscribe(() => render())
  const unsubInv = opts.inventory.subscribe(() => render())

  return {
    el: root,
    refresh: render,
    setScene(next: CapsulePlace, accent?: string): void {
      place = next
      if (accent) root.style.setProperty("--wp-status-accent", accent)
      if (expanded) renderDetail()
    },
    collapse(): void {
      setExpanded(false)
    },
    dispose(): void {
      try {
        unsubEngine()
        unsubInv()
        root.remove()
      } catch (err) {
        console.error(`${LOG} dispose failed:`, err)
      }
    },
  }
}

/* -------------------------------------------------- small DOM builders ----- */

function linkButton(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button")
  b.type = "button"
  b.className = "wp-status-link"
  b.textContent = `${label} ▸`
  b.addEventListener("click", (e) => {
    e.stopPropagation()
    onClick()
  })
  return b
}

interface BridgeButton {
  el: HTMLButtonElement
  setLabel(value: string, action: string): void
  setIcon(glyph: string | null): void
}
function bridgeButton(cls: string, onClick: () => void): BridgeButton {
  const b = document.createElement("button")
  b.type = "button"
  b.className = `wp-status-bridge ${cls}`
  const icon = document.createElement("span")
  icon.className = "wp-status-bridge-icon"
  icon.setAttribute("aria-hidden", "true")
  const value = document.createElement("span")
  value.className = "wp-status-bridge-value"
  const action = document.createElement("span")
  action.className = "wp-status-bridge-action"
  b.append(icon, value, action)
  b.addEventListener("click", (e) => {
    e.stopPropagation()
    onClick()
  })
  return {
    el: b,
    setLabel(v, a) {
      value.textContent = v
      action.textContent = `${a} ▸`
    },
    setIcon(glyph) {
      icon.textContent = glyph ?? ""
      icon.hidden = !glyph
    },
  }
}

/** "city_gate" → "City Gate" — a readable fallback when no name resolver given. */
function prettyAnchor(id: string): string {
  return id
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

/* -------------------------------------------------- scoped-inline styles --- */

let stylesInjected = false
function ensureStyles(): void {
  if (stylesInjected) return
  if (typeof document === "undefined") return
  if (document.querySelector("style[data-wp-status]")) {
    stylesInjected = true
    return
  }
  const style = document.createElement("style")
  style.setAttribute("data-wp-status", "")
  style.textContent = STATUS_CSS
  document.head.appendChild(style)
  stylesInjected = true
}

const STATUS_CSS = `
.wp-status {
  --wp-status-accent: #c46b4a;
  position: absolute;
  top: calc(8px + env(safe-area-inset-top, 0px));
  left: calc(10px + env(safe-area-inset-left, 0px));
  z-index: var(--wp-z-status, var(--wp-z-tracker, 12));
  width: min(70vw, 300px);
  max-width: min(70vw, 300px);
  font-family: ui-rounded, "SF Pro Rounded", "Nunito", system-ui, -apple-system, sans-serif;
  color: #3a2f25;
  opacity: 0;
  transform: translateY(-4px);
  animation: wp-status-in 0.3s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}
@keyframes wp-status-in { to { opacity: 1; transform: translateY(0); } }

/* The chrome state machine recedes the whole top band during dialogue/menu. */
.wp-status[data-wp-chrome="hidden"] {
  opacity: 0 !important;
  transform: translateY(-6px);
  pointer-events: none;
}

.wp-status-glance {
  padding: 9px 12px 10px;
  border-radius: 14px;
  background: rgba(247, 239, 224, 0.86);
  -webkit-backdrop-filter: blur(6px) saturate(1.05);
  backdrop-filter: blur(6px) saturate(1.05);
  box-shadow: 0 4px 14px rgba(58, 47, 37, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.6);
  pointer-events: none;
  -webkit-tap-highlight-color: transparent;
}
.wp-status--tappable .wp-status-glance { pointer-events: auto; cursor: pointer; }
@media (hover: hover) and (pointer: fine) {
  .wp-status--tappable:hover .wp-status-glance { background: rgba(247, 239, 224, 0.98); }
}
.wp-status--tappable .wp-status-glance:focus-visible {
  outline: 2px solid var(--wp-status-accent);
  outline-offset: 2px;
}

.wp-status-head { display: flex; align-items: center; gap: 6px; }
.wp-status-lozenge {
  flex: 0 0 auto;
  display: inline-flex; align-items: center;
  padding: 1px 6px; border-radius: 8px;
  background: color-mix(in srgb, var(--wp-status-accent) 16%, transparent);
  font-size: 12px; font-weight: 700; letter-spacing: 0.02em; line-height: 1.4;
}
.wp-status-lozenge--immersion {
  background: color-mix(in srgb, var(--wp-status-accent) 26%, transparent);
}
.wp-status-title {
  font-size: 12.5px; font-weight: 700; letter-spacing: 0.01em; color: #6b5a44;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  flex: 1 1 auto; min-width: 0;
}
.wp-status-cue {
  flex: 0 0 auto; color: var(--wp-status-accent); font-size: 12px; font-weight: 800;
  opacity: 0.7; transition: transform 0.2s ease;
}
.wp-status--expanded .wp-status-cue { transform: rotate(90deg); }

.wp-status-objective {
  margin-top: 3px; font-size: 14.5px; font-weight: 700; line-height: 1.25;
  color: #2e261d; display: flex; align-items: baseline; gap: 7px;
}
.wp-status-objective::before {
  content: ""; flex: 0 0 auto; width: 8px; height: 8px; border-radius: 50%;
  background: var(--wp-status-accent); align-self: center;
  box-shadow: 0 0 0 0 var(--wp-status-accent);
}
.wp-status--active .wp-status-objective::before {
  animation: wp-status-pulse 2.4s ease-in-out infinite;
}
.wp-status--complete .wp-status-objective::before { background: #5a8a4a; animation: none; }
@keyframes wp-status-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(196, 107, 74, 0.45); }
  50% { box-shadow: 0 0 0 5px rgba(196, 107, 74, 0); }
}
.wp-status-hint { margin-top: 4px; font-size: 12.5px; line-height: 1.3; color: #7a6a52; }

/* ---- expanded detail card ---- */
.wp-status-detail {
  margin-top: 7px;
  padding: 11px 13px 12px;
  border-radius: 14px;
  background: rgba(247, 239, 224, 0.95);
  -webkit-backdrop-filter: blur(8px) saturate(1.06);
  backdrop-filter: blur(8px) saturate(1.06);
  box-shadow: 0 8px 22px rgba(58, 47, 37, 0.26), inset 0 1px 0 rgba(255, 255, 255, 0.6);
  z-index: var(--wp-z-status-detail, 13);
  max-height: min(60vh, 420px);
  /* overflow: hidden auto (NOT bare overflow-y: auto): a non-visible value on one
   * axis makes the OTHER axis compute to auto too, so a child even 1px too wide
   * spawns an unwanted horizontal scrollbar (it did — the content clipped on the
   * left). Pin overflow-x to hidden so only vertical scrolling is possible. */
  overflow: hidden auto;
  overscroll-behavior: contain;
  box-sizing: border-box;
  pointer-events: auto;
  opacity: 0; transform: translateY(-6px) scale(0.985);
  transition: opacity 0.22s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.22s cubic-bezier(0.22, 1, 0.36, 1);
}
.wp-status-detail--in { opacity: 1; transform: translateY(0) scale(1); }
.wp-status-detail-head {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  margin-bottom: 8px;
}
.wp-status-immersion {
  font-size: 11px; font-weight: 700; letter-spacing: 0.02em; text-transform: uppercase;
  color: var(--wp-status-accent);
}
.wp-status-close {
  flex: 0 0 auto; width: 26px; height: 26px; border: none; border-radius: 8px;
  background: rgba(58, 47, 37, 0.08); color: #6b5a44; cursor: pointer;
  font-size: 13px; line-height: 1;
}
.wp-status-close:hover { background: rgba(58, 47, 37, 0.14); }
.wp-status-close:focus-visible { outline: 2px solid var(--wp-status-accent); outline-offset: 2px; }

.wp-status-block { padding: 8px 0; border-top: 1px solid rgba(120, 100, 70, 0.16); }
.wp-status-block:first-of-type { border-top: none; padding-top: 0; }
.wp-status-detail-title { font-size: 13.5px; font-weight: 800; color: #2e261d; }
.wp-status-progress {
  margin-top: 4px; font-size: 11px; font-weight: 600; letter-spacing: 0.02em;
  text-transform: uppercase; color: #9a8868;
}
.wp-status-bar {
  margin-top: 5px; height: 5px; border-radius: 3px; overflow: hidden;
  background: rgba(120, 100, 70, 0.18);
}
.wp-status-bar-fill {
  height: 100%; border-radius: 3px; background: var(--wp-status-accent);
  transition: width 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}
.wp-status-steps { list-style: none; margin: 8px 0 0; padding: 0; }
.wp-status-step {
  font-size: 12.5px; line-height: 1.4; color: #7a6a52; padding-left: 16px; position: relative;
}
.wp-status-step::before {
  content: "○"; position: absolute; left: 0; color: #b7a888; font-size: 11px;
}
.wp-status-step--done { color: #5a8a4a; text-decoration: line-through; text-decoration-color: rgba(90,138,74,0.5); }
.wp-status-step--done::before { content: "✓"; color: #5a8a4a; }
.wp-status-step--active { color: #2e261d; font-weight: 700; }
.wp-status-step--active::before { content: "●"; color: var(--wp-status-accent); }

.wp-status-lore-head { font-size: 12px; font-weight: 700; color: #6b5a44; }
.wp-status-lore-text { margin-top: 3px; font-size: 12.5px; line-height: 1.4; color: #7a6a52; font-style: italic; }

.wp-status-link {
  margin-top: 8px; padding: 4px 10px; border: none; border-radius: 8px;
  background: color-mix(in srgb, var(--wp-status-accent) 14%, transparent);
  color: var(--wp-status-accent); font: 700 12px/1 inherit; cursor: pointer;
}
.wp-status-link:hover { background: color-mix(in srgb, var(--wp-status-accent) 22%, transparent); }
.wp-status-link:focus-visible { outline: 2px solid var(--wp-status-accent); outline-offset: 2px; }

.wp-status-bridges { display: flex; flex-direction: column; gap: 6px; padding-top: 8px; border-top: 1px solid rgba(120,100,70,0.16); }
.wp-status-bridge {
  display: flex; align-items: center; gap: 8px; width: 100%;
  /* border-box so width:100% INCLUDES the 10px side padding — otherwise the row
   * is 20px wider than the card and triggers the horizontal scrollbar above. */
  box-sizing: border-box;
  padding: 7px 10px; border: none; border-radius: 10px;
  background: rgba(255, 255, 255, 0.55); color: #2e261d; cursor: pointer;
  font: 700 12.5px/1.2 inherit; text-align: left;
}
.wp-status-bridge:hover { background: rgba(255, 255, 255, 0.8); }
.wp-status-bridge:focus-visible { outline: 2px solid var(--wp-status-accent); outline-offset: 2px; }
.wp-status-bridge-icon { flex: 0 0 auto; font-size: 15px; }
.wp-status-bridge-value { flex: 1 1 auto; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.wp-status-bridge-action { flex: 0 0 auto; font-weight: 700; font-size: 11.5px; color: var(--wp-status-accent); }

/* ---- responsive matrix (TOP_HUD §2.3) ---- */

/* Phone-portrait: keep all 3 rows, the cue is just the ▸ chevron. */
@media (max-width: 540px) and (orientation: portrait) {
  .wp-status { width: min(70vw, 300px); }
}
/* Phone-landscape (short height): narrow + drop the quest TITLE row (objective +
 * hint only); the expanded card becomes a height-capped popover. */
@media (max-width: 900px) and (orientation: landscape) and (max-height: 480px) {
  .wp-status { width: min(52vw, 320px); }
  .wp-status-title { display: none; }
  .wp-status-detail { max-height: 80vh; }
}
/* Tablet: roomier capsule. */
@media (min-width: 541px) and (max-width: 1024px) {
  .wp-status { width: min(46vw, 360px); }
  .wp-status-objective { font-size: 15px; }
}
/* Desktop (fine pointer): larger, the cue becomes a visible "Details" pill. */
@media (hover: hover) and (pointer: fine) and (min-width: 1025px) {
  .wp-status { width: clamp(320px, 26vw, 420px); }
  .wp-status-objective { font-size: 15px; }
  .wp-status-cue {
    padding: 1px 7px; border-radius: 7px; font-size: 11px; opacity: 1;
    background: color-mix(in srgb, var(--wp-status-accent) 14%, transparent);
  }
  .wp-status-bridges { display: grid; grid-template-columns: 1fr 1fr; }
}

@media (prefers-reduced-motion: reduce) {
  .wp-status { animation: none; opacity: 1; transform: none; }
  .wp-status--active .wp-status-objective::before { animation: none; }
  .wp-status-detail { transition: none; }
  .wp-status-cue { transition: none; }
  .wp-status-bar-fill { transition: none; }
}
`
