/**
 * Standalone verification harness for the FAB / floating-chrome slice (NOT
 * shipped). It mounts the REAL chrome surfaces — Place Tag, Pack button, the
 * unified Menu panel (with the live Badges section + a stub Map section + premium
 * empty-state Inventory/Quest tabs), and the corner Minimap — inside a real
 * `.wp-overlay`, all governed by the REAL `chromeVisibility` state machine.
 *
 * It exists so a headless WebKit driver can screenshot the HUD + menu at phone /
 * tablet / desktop widths and in every chrome state (world / focused / dialogue /
 * menu), confirming the FAB_POLISH P0/P1 work:
 *   - the minimap now RECEDES with the rest of the chrome (it's registered),
 *   - the Badges tab is real + warm-palette + sticky-subhead,
 *   - the empty-state cards, scroll fades, and shared material all render.
 *
 * `?w=…` query (set by the driver via viewport) only affects layout via CSS; the
 * harness exposes `window.__wpChrome` with `set(state)` + `openMenu(section)` so
 * the driver can flip states and tabs. No Babylon, no host — DOM only.
 */

import "../../styles.css"
import { mountPlaceTag } from "../placeTag"
import { createMenuButton } from "../menuButton"
import { createMenuPanel } from "../menuPanel"
import { createChromeVisibility, type ChromeState } from "../chromeVisibility"
import { mountMinimap } from "../../map/minimap"
import { openFullMap, createMapSection } from "../../map/fullMap"
import type { MapView, RemotePresence } from "../../contracts/runtime"
import type { QuestMarker } from "../../quest/questState"
import plazaGrand from "../../../content/topologies/plaza-grand.json"
import type { RoomTopology } from "@corpan-city/contracts"
import { buildEsB0Catalog, createBadgeStore } from "../../badges"
import { memTrackStore, bindingFor, stubIconRenderer, stubTranslate } from "../../badges"
import { createBadgeCaseSection } from "../../badges"
import type { BadgeDeposit } from "@corpan-city/contracts"

const accent = "#c46b4a"

/* -------------------------------------------------- host DOM (game.ts shape) */
const root = document.createElement("div")
root.className = "wp-root"
root.style.cssText = "position:fixed;inset:0;background:#bfe0e8;"
const overlay = document.createElement("div")
overlay.className = "wp-overlay"
overlay.style.cssText = "position:absolute;inset:0;z-index:10;"
root.appendChild(overlay)
document.body.appendChild(root)

/* -------------------------------------------------- a stub MapView */
const base = plazaGrand as unknown as RoomTopology
const typedAnchors: RoomTopology["anchors"] = [
  { id: "spice_stall", role: "vendor", kind: "vendor", x: -30, z: -22, facing: 0 },
  { id: "money_changer", role: "vendor", kind: "merchant", x: 34, z: 6, facing: 0 },
  { id: "scribe_desk", role: "npc_station", kind: "npc_station", x: -34, z: 4, facing: 0 },
  { id: "harbor_docks", role: "npc_station", kind: "docks", x: 8, z: 46, facing: 0 },
  { id: "clock_tower", role: "decor", kind: "landmark", x: 22, z: 30, facing: 0 },
]
const topology: RoomTopology = { ...base, anchors: [...base.anchors, ...typedAnchors] }
const markers: QuestMarker[] = [
  { anchorId: "clock_tower", kind: "objective" },
  { anchorId: "spice_stall", kind: "source-hint", itemId: "ferry-token" },
]
const remotes: RemotePresence[] = [
  { playerId: "p-aiko", name: "Aiko", pos: { x: -18, z: 9, facing: 1.2 } },
  { playerId: "p-tomas", name: "Tomás", pos: { x: 22, z: -16, facing: -2.1 } },
]
let t = 0
const view: MapView = {
  topology,
  getPlayerPos: () => ({ x: 6 * Math.cos(t / 60), z: 6 * Math.sin(t / 60), facing: t / 60 }),
  getRemotePositions: () => remotes,
  getQuestMarkers: () => markers,
}
const anchorName = (id: string) =>
  id.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
const itemName = (id: string) => id
const mapOpts = { view, accent, lang: "en", anchorName, itemName }

/* -------------------------------------------------- a SEEDED badge store */
const cat = buildEsB0Catalog()
const badgeStore = createBadgeStore({ catalog: cat, binding: bindingFor("en:es", memTrackStore) })
const dep = (amount: number, domain: string, level: string): BadgeDeposit => ({
  amount,
  trackKey: "en:es",
  source: "challenge",
  domain,
  toolId: "fast-translate",
  level,
  entryIds: [1008],
  score: 1,
})
// Seed a few medals at varied tiers so the warm grid + debossed wells + arcs show.
badgeStore.applyDeposit(dep(900, "travel", "A2"))
badgeStore.applyDeposit(dep(260, "travel", "A1"))
badgeStore.applyDeposit(dep(120, "food", "A2"))
const badgesSection = createBadgeCaseSection({
  store: badgeStore,
  renderer: stubIconRenderer,
  t: stubTranslate,
  lang: "en",
  trackLabel: "Spanish",
  accent,
})

/* -------------------------------------------------- chrome surfaces */
const fullMapModal = openFullMap(overlay, { ...mapOpts, onClose: () => {} })
const minimap = mountMinimap(overlay, { ...mapOpts, onExpand: () => fullMapModal.open() })

const placeTag = mountPlaceTag({
  overlay,
  setting: { place: "Antigua", era: "1770" },
  accent,
  lang: "en",
  presenceCount: () => remotes.length,
})

const chrome = createChromeVisibility("world")

const menu = createMenuPanel({
  parent: overlay,
  accent,
  strings: { title: "Plaza" },
  onOpen: () => chrome.set("menu"),
  onClose: () => chrome.set("world"),
  onLeave: () => {},
  sections: {
    map: createMapSection(mapOpts),
    badges: badgesSection,
    // inventory + quest left unwired on purpose → premium empty-state card.
  },
})

const packButton = createMenuButton({
  parent: overlay,
  accent,
  label: "Your pack",
  onOpen: () => menu.open("quest"),
})

// Register all three roles with the REAL state machine (mirrors game.ts).
chrome.register({ el: placeTag.el, role: "band" })
chrome.register({ el: minimap.el, role: "map" })
const packBtnEl = overlay.querySelector<HTMLElement>(".wp-menu-button")
if (packBtnEl) chrome.register({ el: packBtnEl, role: "pack" })

/* -------------------------------------------------- a fake "Talk" CTA (focused) */
const talk = document.createElement("button")
talk.className = "wp-interact"
talk.innerHTML = '<span class="wp-interact-ico">◇</span> Talk'
talk.style.display = "none"
overlay.appendChild(talk)

/* -------------------------------------------------- frame loop (minimap) */
function loop() {
  t += 1
  minimap.tick()
  requestAnimationFrame(loop)
}
requestAnimationFrame(loop)

/* -------------------------------------------------- driver API + control bar */
function setState(state: ChromeState): void {
  chrome.set(state)
  talk.style.display = state === "focused" ? "" : "none"
  if (state === "dialogue") {
    // A faux dialogue surface so the receded chrome is visible against something.
    if (!document.querySelector(".wp-fake-dialogue")) {
      const d = document.createElement("div")
      d.className = "wp-fake-dialogue"
      d.style.cssText =
        "position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:min(560px,100%-24px);height:min(46%,360px);z-index:40;background:linear-gradient(180deg,#f7efe0,#efe3cd);border-radius:22px 22px 0 0;box-shadow:0 -18px 48px rgba(40,28,12,.4);padding:20px;font:600 15px/1.4 ui-rounded,system-ui,sans-serif;color:#3a2f25;"
      d.textContent =
        "“Buenos días, viajero. ¿Buscas el reloj de la plaza?” — the chrome should be RECEDED behind this, minimap included."
      overlay.appendChild(d)
    }
  } else {
    document.querySelector(".wp-fake-dialogue")?.remove()
  }
}

;(window as unknown as { __wpChrome?: unknown }).__wpChrome = {
  set: setState,
  openMenu: (section?: string) => menu.open(section as never),
  closeMenu: () => menu.close(),
  state: () => chrome.current(),
}

const bar = document.createElement("div")
bar.style.cssText =
  "position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:300;display:flex;gap:6px;font:12px sans-serif;"
const mkBtn = (label: string, fn: () => void) => {
  const b = document.createElement("button")
  b.textContent = label
  b.style.cssText =
    "padding:5px 9px;border-radius:8px;border:none;background:#5a4a32;color:#fff;cursor:pointer;"
  b.onclick = fn
  bar.appendChild(b)
}
mkBtn("world", () => setState("world"))
mkBtn("focused", () => setState("focused"))
mkBtn("dialogue", () => setState("dialogue"))
mkBtn("menu→Badges", () => menu.open("badges"))
mkBtn("menu→Inventory", () => menu.open("inventory"))
mkBtn("map", () => fullMapModal.open())
document.body.appendChild(bar)

requestAnimationFrame(() => {
  console.log("[verify] minimap in .wp-overlay:", minimap.el.parentElement === overlay)
  console.log("[verify] placeTag in .wp-overlay:", placeTag.el.parentElement === overlay)
  console.log("[verify] pack registered:", !!packBtnEl)
  console.log("[verify] ready")
  ;(window as unknown as { __wpVerifyReady?: boolean }).__wpVerifyReady = true
})

void packButton
