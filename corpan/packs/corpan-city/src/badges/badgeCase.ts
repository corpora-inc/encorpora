/**
 * The Badge Case (BADGES_PROGRESSION §4) — the in-`.wp-overlay` mastery gallery.
 *
 * It is a MenuSectionView: a factory that renders into the menu's `.wp-menu-body`
 * (a child of `.wp-overlay`, never `document.body` — the M0 lesson) and returns
 * a cleanup. The orchestrator wires this as the menu's new "Badges" section.
 *
 * Aesthetic (§4.2): a paper-cutout display CASE, not a list. Medals sit in soft
 * embossed wells; each medal is drawn by the injected `IconRenderer` (medal
 * family, a radial fill arc toward the next tier, the tier's metal). Locked
 * badges read as a quiet debossed silhouette. Grouped + "In Progress" by default
 * (§1.5) — never a wall of 1000. Dignified, reduced-motion aware, no dark patterns.
 *
 * Styles are SCOPED-INLINE here (the slice owns `src/badges/*`, not styles.css):
 * a tiny injected `<style data-wp-badges>` keyed to `.wp-badges*` hooks, so the
 * styles.css owner can later enhance the same hooks with zero call-site churn.
 */

import type { Badge, BadgeProgress, BadgeTier } from "@corpan-city/contracts"
import type { IconRenderer, Translate } from "../contracts/runtime"
import type { BadgeStore } from "./badgeStore"
import { createBadgeT, badgeName, howToFill, type BadgeT } from "./badgeStrings"
import { arcForXp, isPlatinum, tierForXp } from "./router"

/** A MenuSectionView: render into `body`, return optional cleanup. */
export type MenuSectionView = (body: HTMLElement) => void | (() => void)

export interface BadgeCaseOptions {
  store: BadgeStore
  renderer: IconRenderer
  t: Translate
  /** the Track's native code (UI locale). */
  lang: string
  /** the Track's display label for the summary line ("Spanish"). */
  trackLabel: string
  /** accent color (Scene.palette.accent). */
  accent?: string
}

type Filter = "inProgress" | "recent" | "all"

const TIER_METAL: Record<BadgeTier, string> = {
  locked: "#9aa3a7",
  bronze: "#b87333",
  silver: "#bdc3c7",
  gold: "#d4af37",
  platinum: "#cfe6ea",
}

/**
 * Build the Badge Case section factory. Returns a `MenuSectionView` the
 * orchestrator hands to `createShell({ sections: { badges } })`.
 */
export function createBadgeCaseSection(opts: BadgeCaseOptions): MenuSectionView {
  const bt: BadgeT = createBadgeT(opts.t, opts.lang)
  return (body) => mountBadgeCase(body, opts, bt)
}

function mountBadgeCase(body: HTMLElement, opts: BadgeCaseOptions, bt: BadgeT): () => void {
  ensureStyles()
  const { store, renderer } = opts
  const reduced =
    typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches

  let filter: Filter = "inProgress"
  let detailFor: string | null = null

  const root = document.createElement("div")
  root.className = "wp-badges"
  if (opts.accent) root.style.setProperty("--wp-badges-accent", opts.accent)
  body.appendChild(root)

  const render = () => {
    root.replaceChildren()

    // Summary + filter pills live in a STICKY sub-header (FAB_POLISH §4.2): the
    // filter PINS to the top of the scroll region while the medal grid scrolls
    // under it (the owner's exact ask). The class `.wp-menu-subhead` is styled by
    // styles.css; `.wp-badges-subhead` carries the badge-local layout.
    const subhead = document.createElement("div")
    subhead.className = "wp-menu-subhead wp-badges-subhead"
    root.appendChild(subhead)

    // Summary line.
    const summary = document.createElement("div")
    summary.className = "wp-badges-summary"
    summary.textContent = bt("badges.summary", {
      track: opts.trackLabel,
      mastered: store.masteredCount(),
    })
    subhead.appendChild(summary)

    // Filter pills.
    const filters = document.createElement("div")
    filters.className = "wp-badges-filter"
    const pill = (id: Filter, label: string) => {
      const b = document.createElement("button")
      b.type = "button"
      b.className = "wp-badges-pill" + (filter === id ? " wp-badges-pill--on" : "")
      b.textContent = label
      b.addEventListener("click", () => {
        filter = id
        render()
      })
      return b
    }
    filters.appendChild(pill("inProgress", bt("badges.filter.inProgress")))
    filters.appendChild(pill("recent", bt("badges.filter.recent")))
    filters.appendChild(pill("all", bt("badges.filter.all")))
    subhead.appendChild(filters)

    // The grid.
    const grid = document.createElement("div")
    grid.className = "wp-badges-grid"
    root.appendChild(grid)

    const badges = badgesForFilter(store, filter)
    if (badges.length === 0) {
      // A premium empty-state card (FAB_POLISH §4.3), not a thin grey line: a soft
      // debossed medal glyph + the localized message, centered in the grid span.
      const empty = document.createElement("div")
      empty.className = "wp-badges-empty"
      const glyph = document.createElementNS("http://www.w3.org/2000/svg", "svg")
      glyph.setAttribute("class", "wp-badges-empty-glyph")
      glyph.setAttribute("viewBox", "0 0 24 24")
      glyph.setAttribute("fill", "none")
      glyph.setAttribute("aria-hidden", "true")
      glyph.innerHTML =
        '<circle cx="12" cy="9" r="5.2" stroke="currentColor" stroke-width="1.6"/>' +
        '<path d="M8.4 13.2 7 21l5-2.4L17 21l-1.4-7.8" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>'
      const msg = document.createElement("div")
      msg.className = "wp-badges-empty-msg"
      msg.textContent = bt("badges.empty")
      empty.append(glyph, msg)
      grid.appendChild(empty)
    }
    for (const badge of badges) {
      grid.appendChild(medalCell(badge))
    }

    // Detail slide-in (if a medal is selected).
    if (detailFor) {
      const def = store.catalog.get(detailFor)
      if (def) root.appendChild(detailPanel(def))
    }
  }

  const medalCell = (badge: Badge): HTMLElement => {
    const prog = store.progressOf(badge.id)
    const tier = prog.tier
    const arc = store.arcOf(badge.id)
    const cell = document.createElement("button")
    cell.type = "button"
    cell.className = "wp-badge-cell" + (tier === "locked" ? " wp-badge-cell--locked" : "")
    cell.setAttribute("data-badge-id", badge.id)

    const medal = document.createElement("div")
    medal.className = "wp-badge-medal"
    const canvas = renderer.renderIcon(
      {
        family: "medal",
        palette: TIER_METAL[tier],
        fillArc: arc,
        tier,
        motif: badge.glyph,
        accent: opts.accent,
      },
      { size: 64 },
    )
    canvas.className = "wp-badge-canvas"
    canvas.style.width = "56px"
    canvas.style.height = "56px"
    medal.appendChild(canvas)
    cell.appendChild(medal)

    const name = document.createElement("div")
    name.className = "wp-badge-name"
    name.textContent = badgeName(badge, bt)
    cell.appendChild(name)

    const tierLine = document.createElement("div")
    tierLine.className = "wp-badge-tier"
    tierLine.textContent = tier === "locked" ? bt("badges.locked") : bt(`tier.${tier}`)
    cell.appendChild(tierLine)

    cell.addEventListener("click", () => {
      detailFor = detailFor === badge.id ? null : badge.id
      render()
    })
    return cell
  }

  const detailPanel = (badge: Badge): HTMLElement => {
    const panel = document.createElement("div")
    panel.className = "wp-badge-detail"
    const tier = store.tierOf(badge.id)
    const platinum = isPlatinum(store.xpOf(badge.id), badge.tierScale)

    const title = document.createElement("div")
    title.className = "wp-badge-detail-title"
    title.textContent = badgeName(badge, bt)
    panel.appendChild(title)

    // Tier ladder.
    const ladder = document.createElement("div")
    ladder.className = "wp-badge-ladder"
    for (const t of ["bronze", "silver", "gold", "platinum"] as BadgeTier[]) {
      const dot = document.createElement("span")
      dot.className = "wp-badge-rung"
      dot.style.background = TIER_METAL[t]
      const reached =
        ["bronze", "silver", "gold", "platinum"].indexOf(tier) >=
        ["bronze", "silver", "gold", "platinum"].indexOf(t)
      dot.style.opacity = reached ? "1" : "0.3"
      dot.title = bt(`tier.${t}`)
      ladder.appendChild(dot)
    }
    panel.appendChild(ladder)

    // To-next / mastered.
    const status = document.createElement("div")
    status.className = "wp-badge-detail-status"
    if (platinum) {
      status.textContent = bt("badges.mastered")
    } else {
      const next = nextTierName(tier)
      status.textContent = bt("badges.toNext", {
        xp: store.toNextOf(badge.id),
        tier: bt(`tier.${next}`),
      })
    }
    panel.appendChild(status)

    // "How to fill this".
    const how = document.createElement("div")
    how.className = "wp-badge-detail-how"
    const howLabel = document.createElement("span")
    howLabel.className = "wp-badge-detail-howlabel"
    howLabel.textContent = bt("badges.howToFill") + ": "
    how.appendChild(howLabel)
    how.appendChild(document.createTextNode(howToFill(badge, bt)))
    panel.appendChild(how)

    if (!reduced) {
      panel.style.opacity = "0"
      requestAnimationFrame(() => (panel.style.opacity = "1"))
    }
    return panel
  }

  render()

  // Live updates: re-render on any badge change while the case is open.
  const unsub = store.subscribe(() => render())

  return () => {
    unsub()
    root.remove()
  }
}

/* ----------------------------------------------------------------- helpers */

function nextTierName(tier: BadgeTier): BadgeTier {
  const order: BadgeTier[] = ["locked", "bronze", "silver", "gold", "platinum"]
  const i = order.indexOf(tier)
  return order[Math.min(i + 1, order.length - 1)]
}

/** The badges shown for the active filter. */
function badgesForFilter(store: BadgeStore, filter: Filter): Badge[] {
  if (filter === "all") {
    return store.catalog.all.slice()
  }
  // In Progress + Recent both start from touched, non-platinum (closest first).
  const touched = store.touched()
  const ranked = touched
    .filter((p) => {
      const def = store.catalog.get(p.badgeId)
      if (!def) return false
      if (filter === "inProgress") return !isPlatinum(p.weightedXp, def.tierScale)
      return true // recent: include platinum too
    })
    .sort((a, b) => rankArc(store, b) - rankArc(store, a))
  return ranked
    .map((p) => store.catalog.get(p.badgeId))
    .filter((b): b is Badge => b != null)
}

function rankArc(store: BadgeStore, p: BadgeProgress): number {
  const def = store.catalog.get(p.badgeId)
  if (!def) return 0
  // closest-to-next-tier first; platinum sinks to the back.
  if (isPlatinum(p.weightedXp, def.tierScale)) return -1
  return arcForXp(p.weightedXp, def.tierScale) + 0.001 * tierRank(tierForXp(p.weightedXp, def.tierScale))
}
function tierRank(tier: BadgeTier): number {
  return ["locked", "bronze", "silver", "gold", "platinum"].indexOf(tier)
}

/* -------------------------------------------------- scoped-inline styles --- */

let stylesInjected = false
function ensureStyles(): void {
  if (stylesInjected) return
  if (typeof document === "undefined") return
  if (document.querySelector("style[data-wp-badges]")) {
    stylesInjected = true
    return
  }
  const style = document.createElement("style")
  style.setAttribute("data-wp-badges", "")
  style.textContent = BADGE_CASE_CSS
  document.head.appendChild(style)
  stylesInjected = true
}

/* The Badge Case now belongs to the SAME warm-Antigua dialog (FAB_POLISH §4.4):
   the blue-grey ink palette (#243842 / #2a4651) is retired for the menu's warm ink
   (--wp-ink* tokens, with literal fallbacks), the cells reuse the shared
   .wp-inv-cell material + the rounded font family, the medals sit in a DEBOSSED
   well, and the filter lives in a sticky sub-header (styled by styles.css). */
const BADGE_CASE_CSS = `
.wp-badges {
  display: flex; flex-direction: column; gap: 12px;
  --wp-badges-accent: var(--wp-accent, #c46b4a);
  font-family: var(--wp-font, ui-rounded, "SF Pro Rounded", "Nunito", system-ui, sans-serif);
}
.wp-badges-subhead { display: flex; flex-direction: column; gap: 10px; }
.wp-badges-summary {
  font: 600 14px/1.3 var(--wp-font, ui-rounded, system-ui, sans-serif);
  color: var(--wp-ink-2, #4a3c2e); opacity: 0.95;
}
.wp-badges-filter { display: flex; gap: 8px; flex-wrap: wrap; }
.wp-badges-pill {
  border: 1px solid var(--wp-hairline, rgba(120,100,70,0.18)); background: rgba(255,255,255,0.5);
  color: var(--wp-ink-3, #7a6a52); border-radius: var(--wp-r-pill, 999px); padding: 7px 14px; min-height: 36px;
  font: 700 13px/1 var(--wp-font, ui-rounded, system-ui, sans-serif); cursor: pointer;
  -webkit-tap-highlight-color: transparent; transition: background 0.15s ease, color 0.15s ease;
}
.wp-badges-pill--on {
  background: color-mix(in srgb, var(--wp-badges-accent) 88%, white);
  color: #fff7f0; border-color: transparent;
  box-shadow: 0 2px 8px color-mix(in srgb, var(--wp-badges-accent) 40%, transparent);
}
.wp-badges-pill:focus-visible { outline: 2px solid var(--wp-badges-accent); outline-offset: 2px; }
.wp-badges-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(86px, 1fr));
  gap: 12px; padding: 4px 0;
}
@media (min-width: 700px) {
  .wp-badges-grid { grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 16px; }
}
/* Premium empty-state card — glyph + message, not a thin grey line. */
.wp-badges-empty {
  grid-column: 1 / -1; min-height: 180px; display: grid; place-content: center; justify-items: center;
  gap: 10px; text-align: center; padding: 24px 12px;
}
.wp-badges-empty-glyph {
  width: 44px; height: 44px;
  color: color-mix(in srgb, var(--wp-badges-accent) 55%, #b6a489);
  opacity: 0.9; filter: drop-shadow(0 1px 0 rgba(255,255,255,0.6));
}
.wp-badges-empty-msg {
  font: 500 13.5px/1.45 var(--wp-font, ui-rounded, system-ui, sans-serif);
  color: var(--wp-ink-3, #7a6a52); max-width: 26ch;
}
.wp-badge-cell {
  display: flex; flex-direction: column; align-items: center; gap: 5px;
  background: linear-gradient(180deg, rgba(255,255,255,0.55), rgba(247,238,222,0.45));
  border: 1px solid var(--wp-hairline, rgba(120,100,70,0.14)); border-radius: var(--wp-r-chip, 14px);
  padding: 10px 6px 8px; cursor: pointer;
  box-shadow: var(--wp-cut, inset 0 1px 0 rgba(255,255,255,0.6)), var(--wp-e1, 0 2px 6px rgba(58,47,37,0.10));
  -webkit-tap-highlight-color: transparent; transition: transform 0.1s ease, box-shadow 0.15s ease;
}
.wp-badge-cell:hover { box-shadow: var(--wp-cut, inset 0 1px 0 rgba(255,255,255,0.6)), var(--wp-e2, 0 4px 12px rgba(58,47,37,0.16)); }
.wp-badge-cell:active { transform: scale(0.97); }
.wp-badge-cell:focus-visible { outline: 2px solid var(--wp-badges-accent); outline-offset: 2px; }
.wp-badge-cell--locked { opacity: 0.55; filter: grayscale(0.5); }
/* A debossed WELL behind each medal so it reads as set into the paper. */
.wp-badge-medal {
  width: 56px; height: 56px; display: grid; place-items: center; border-radius: 50%;
  box-shadow: inset 0 1px 2px rgba(58,47,37,0.18), inset 0 -1px 0 rgba(255,255,255,0.4);
}
.wp-badge-canvas { image-rendering: auto; }
.wp-badge-name {
  font: 600 11px/1.2 var(--wp-font, ui-rounded, system-ui, sans-serif); color: var(--wp-ink, #2e261d);
  text-align: center; max-width: 92px; overflow: hidden; text-overflow: ellipsis;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
}
.wp-badge-tier {
  font: 700 10px/1 var(--wp-font, ui-rounded, system-ui, sans-serif);
  color: var(--wp-ink-head, #9a8868); letter-spacing: 0.06em; text-transform: uppercase;
}
.wp-badge-detail {
  background: rgba(255,255,255,0.7); border: 1px solid var(--wp-hairline, rgba(120,100,70,0.16));
  border-radius: var(--wp-r-card, 14px); padding: 12px 14px; display: flex; flex-direction: column; gap: 8px;
  box-shadow: var(--wp-cut, inset 0 1px 0 rgba(255,255,255,0.6)), var(--wp-e1, 0 2px 6px rgba(58,47,37,0.10));
  transition: opacity 0.2s ease;
}
.wp-badge-detail-title { font: 800 15px/1.2 var(--wp-font, ui-rounded, system-ui, sans-serif); color: var(--wp-ink, #2e261d); }
.wp-badge-ladder { display: flex; gap: 8px; }
.wp-badge-rung { width: 14px; height: 14px; border-radius: 50%; box-shadow: inset 0 0 0 1px rgba(58,47,37,0.18); }
.wp-badge-detail-status { font: 700 13px/1.3 var(--wp-font, ui-rounded, system-ui, sans-serif); color: var(--wp-ink-2, #4a3c2e); }
.wp-badge-detail-how { font: 400 13px/1.4 var(--wp-font, ui-rounded, system-ui, sans-serif); color: var(--wp-ink-3, #7a6a52); }
.wp-badge-detail-howlabel { font-weight: 700; color: var(--wp-ink-2, #4a3c2e); }
@media (prefers-reduced-motion: reduce) { .wp-badge-detail, .wp-badge-cell { transition: none; } }
`
