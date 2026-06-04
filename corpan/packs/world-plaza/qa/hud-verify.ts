/**
 * Standalone Top-HUD verify harness (WebKit/Playwright). Mounts the SLICE 2
 * public surfaces — `mountQuestTracker` (the Status Capsule), `mountPlaceTag`,
 * and the `createChromeVisibility` state machine — into a mimicked `.wp-overlay`,
 * exactly as the orchestrator will wire them into game.ts. Drives the real
 * QuestEngine + inventory, feeds STUB glances (trackPair/walletGlance/focusBadge/
 * presenceCount) + a stub off-immersion resolver, and registers a stub "pack"
 * button so the chrome state machine can recede the band + the pack together.
 *
 * Exposes `window.__wpHud` so the Playwright driver can drive chrome states and
 * assert the band + pack RECEDE during dialogue/challenge/menu.
 */

import { Quest } from "@world-plaza/contracts"
import questJson from "../content/quests/es-guadalajara.json"
import sceneJson from "../content/scenes/antigua-grand.json"
import { inventory } from "../src/economy/inventory"
import { createQuestEngine } from "../src/quest/questState"
import { mountQuestTracker } from "../src/quest/questTracker"
import { mountPlaceTag } from "../src/shell/placeTag"
import { createChromeVisibility, type ChromeState } from "../src/shell/chromeVisibility"
import type { HudGlances, ImmersionResolver } from "../src/contracts/runtime"

const overlay = document.querySelector<HTMLElement>(".wp-overlay")!
const fauxDialogue = document.querySelector<HTMLElement>(".faux-dialogue")!

const quest = Quest.parse(questJson)
const scene = sceneJson as { setting: { place: string; era: string }; narrativeBlurb?: string; palette?: Record<string, string> }
const accent = scene.palette?.accent ?? "#c46b4a"

// Real engine + inventory (work standalone — deterministic per run).
const questEngine = createQuestEngine({
  quest,
  inventory: inventory(),
  playerId: "player-verify",
})

// ── Stub glances (Seam 3) — all omit-graceful; here we provide them all so the
// expanded card shows the wealth + focus-badge bridges + flag-pair + presence. ──
const glances: HudGlances = {
  trackPair: () => ({ native: "en", target: "es", immersion: "reveal" }),
  walletGlance: () => ({ topCurrency: "real" as never, major: "R 18.40" }),
  focusBadge: () => ({ badgeId: "F:travel:vocab:A2" as never, glyph: "☕", tier: "bronze", arc: 0.6 }),
  presenceCount: () => 3,
}

// Off-immersion resolver stub (shows native; reports the level for the pip/line).
const immersion: ImmersionResolver = {
  level: () => "reveal",
  hideNative: () => true,
  offerReveal: () => true,
  proactiveReveal: () => true,
  uiLocale: () => "en",
  challengeNativeLanguage: () => "en",
  languageDiscipline: (t, n) => `Reply in ${t} ONLY (one tiny (${n}) gloss).`,
  resolveStrings: (n) => n,
}

// LEFT — the Status Capsule.
const capsule = mountQuestTracker(overlay, {
  engine: questEngine,
  inventory: inventory(),
  accent,
  glances,
  immersion,
  place: {
    place: scene.setting.place,
    era: scene.setting.era,
    lore: scene.narrativeBlurb ?? `${scene.setting.place} · ${scene.setting.era}`,
  },
  openSection: (s) => console.log("[verify] deep-link →", s),
})

// RIGHT — the demoted Place Tag.
const placeTag = mountPlaceTag({
  overlay,
  setting: { place: scene.setting.place, era: scene.setting.era },
  accent,
  presenceCount: glances.presenceCount,
})

// A STUB pack button (the satchel) so the chrome machine recedes it with the band.
const packBtn = document.createElement("button")
packBtn.className = "wp-menu-button wp-menu-button--in"
packBtn.textContent = "🎒"
packBtn.style.cssText =
  "position:absolute;right:16px;bottom:16px;width:50px;height:50px;border:none;border-radius:14px;" +
  "background:rgba(247,239,224,0.92);box-shadow:0 4px 14px rgba(58,47,37,0.24);font-size:22px;z-index:38;" +
  "transition:opacity 0.2s ease;"
overlay.appendChild(packBtn)

// The chrome visibility owner — register the band (capsule + tag) + the pack.
const chrome = createChromeVisibility("world")
chrome.register({ el: capsule.el, role: "band" })
chrome.register({ el: placeTag.el, role: "band" })
chrome.register({ el: packBtn, role: "pack" })

// Pack receding via the data-attr (the real CSS lives in styles.css; here a tiny rule).
const packStyle = document.createElement("style")
packStyle.textContent =
  `.wp-menu-button[data-wp-chrome="hidden"]{opacity:0 !important;pointer-events:none;}` +
  `.wp-menu-button[data-wp-chrome="dim"]{opacity:0.4;}`
document.head.appendChild(packStyle)

// Expose driver hooks.
;(window as unknown as { __wpHud?: unknown }).__wpHud = {
  setChromeState(state: ChromeState) {
    chrome.set(state)
    fauxDialogue.classList.toggle("show", state === "dialogue")
  },
  chromeState: () => chrome.current(),
  expand() {
    overlay.querySelector<HTMLElement>(".wp-status-glance")?.click()
  },
  collapse() {
    capsule.collapse()
  },
  // Read the receded-visibility of each surface for assertions.
  visibility() {
    return {
      capsule: capsule.el.getAttribute("data-wp-chrome"),
      placeTag: placeTag.el.getAttribute("data-wp-chrome"),
      pack: packBtn.getAttribute("data-wp-chrome"),
    }
  },
  inOverlay() {
    return {
      capsule: overlay.contains(capsule.el),
      placeTag: overlay.contains(placeTag.el),
    }
  },
}
