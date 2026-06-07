/**
 * Standalone Badge Case + focus-chip verify harness (WebKit/Playwright). Mounts
 * the badges runtime into a mimicked `.wp-overlay` / `.wp-menu-body`, seeds an
 * identity Track, fans a couple of challenge deposits through the router → store
 * (driving a real tier-up), and renders the Badge Case + HUD chip. Drives the
 * SAME public surface (`createBadgesRuntime`) the orchestrator wires into game.ts.
 *
 * Exposes `window.__wpBadges` so the Playwright driver can trigger a tier-up and
 * read the focusBadge glance.
 */

import { createBadgesRuntime } from "../src/badges"
import type { BadgeDeposit } from "@corpan-city/contracts"

const overlay = document.querySelector<HTMLElement>(".wp-overlay")!
const menuBody = document.querySelector<HTMLElement>(".wp-menu-body")!
const hudStage = document.querySelector<HTMLElement>(".wp-hud-stage")!

// A fresh Track each run so the verify is deterministic.
const trackKey = "en:es"
try {
  localStorage.removeItem(`wp:track:${trackKey}:badges`)
} catch {
  /* ignore */
}

const rt = createBadgesRuntime({
  trackKey,
  lang: "en",
  trackLabel: "Spanish",
  accent: "#c79a4a",
  openCase: () => console.log("[verify] open Badge Case"),
})

// Mount the Badge Case section into the menu body.
rt.section(menuBody)
// Place the HUD focus chip.
hudStage.appendChild(rt.chip.el)

// Seed a few deposits so badges have visible progress (and one tier-up).
const seed = (amount: number, score = 1, level = "A2"): BadgeDeposit => ({
  amount, trackKey, source: "challenge",
  domain: "travel", toolId: "fast-translate", level, entryIds: [1008], score,
})
rt.store.applyDeposit(seed(120, 0.9))
rt.store.applyDeposit(seed(60, 0.8, "A1"))
rt.store.applyDeposit({
  amount: 90, trackKey, source: "challenge",
  domain: "social", toolId: "listen-choose", level: "A1", entryIds: [1], score: 1,
})

// Expose hooks for the driver.
;(window as unknown as { __wpBadges?: unknown }).__wpBadges = {
  tierUp() {
    // A big travel·vocab deposit to push a badge across a tier (toast/medal fill).
    rt.store.applyDeposit(seed(600, 1))
  },
  focus() {
    return rt.store.focusBadge()
  },
  mastered() {
    return rt.store.masteredCount()
  },
}

void overlay
