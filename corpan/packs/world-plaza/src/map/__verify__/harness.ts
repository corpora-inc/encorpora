/**
 * Standalone verification harness for the map slice (NOT shipped). Builds a stub
 * MapView from the real plaza-grand topology + a quest with anchors that DO exist
 * in the topology + a few fake remotes, then mounts the minimap and the full map
 * inside a real `.wp-overlay`. Confirms `.wp-map` / `.wp-minimap` mount inside
 * `.wp-overlay`.
 */

import type { RoomTopology } from "@world-plaza/contracts"
import type { MapView, RemotePresence } from "../../contracts/runtime"
import type { QuestMarker } from "../../quest/questState"
import { mountMinimap } from "../minimap"
import { openFullMap, createMapSection } from "../fullMap"
import plazaGrand from "../../../content/topologies/plaza-grand.json"

const base = plazaGrand as unknown as RoomTopology

// Inject one explicitly-typed anchor of EVERY category so the redesigned marker
// system (distinct colour + shape per type) is fully exercised — the real
// plaza-grand only carries docks/gate kinds. These are deliberately spread out.
const typedAnchors: RoomTopology["anchors"] = [
  { id: "spice_stall", role: "vendor", kind: "vendor", x: -30, z: -22, facing: 0 },
  { id: "silk_stall", role: "vendor", kind: "vendor", x: 30, z: -24, facing: 0 },
  { id: "money_changer", role: "vendor", kind: "merchant", x: 34, z: 6, facing: 0 },
  { id: "scribe_desk", role: "npc_station", kind: "npc_station", x: -34, z: 4, facing: 0 },
  { id: "baker_counter", role: "npc_station", kind: "npc_station", x: -12, z: -34, facing: 0 },
  { id: "harbor_docks", role: "npc_station", kind: "docks", x: 8, z: 46, facing: 0 },
  { id: "west_gate", role: "portal", kind: "city_gate", x: -42, z: 40, facing: 0 },
  { id: "grand_fountain", role: "decor", kind: "fountain", x: 0, z: 0, facing: 0 },
  { id: "clock_tower", role: "decor", kind: "landmark", x: 22, z: 30, facing: 0 },
  // #72 — the FROZEN ANCHOR-CONTRACT venues, classified by id (these arrive from
  // generateCity as generic portal/spawn/landmark kinds). Spread out so the new
  // transit / shop / civic / park / stadium icons + the legend are all exercised.
  { id: "airport", role: "portal", kind: "portal", x: -46, z: -40, facing: 0 },
  { id: "rail_station", role: "portal", kind: "portal", x: 44, z: -42, facing: 0 },
  { id: "bus_station", role: "portal", kind: "portal", x: 46, z: 40, facing: 0 },
  { id: "station", role: "portal", kind: "portal", x: -44, z: 44, facing: 0 },
  { id: "cafe", role: "decor", x: 12, z: 8, facing: 0 },
  { id: "outfitter", role: "decor", x: -16, z: -8, facing: 0 },
  { id: "general_store", role: "decor", x: 16, z: -16, facing: 0 },
  { id: "hospital", role: "decor", kind: "landmark", x: -28, z: -24, facing: 0 },
  { id: "exchange", role: "decor", x: 28, z: 18, facing: 0 },
  { id: "central_green", role: "decor", x: -8, z: 20, facing: 0 },
  { id: "stadium", role: "decor", x: 34, z: -6, facing: 0 },
  { id: "bridge_n", role: "decor", kind: "landmark", x: 0, z: 44, facing: 0 },
]

const topology: RoomTopology = { ...base, anchors: [...base.anchors, ...typedAnchors] }

// objective → the clock tower (a clear spot, so the amber STAR reads); source
// hints at two vendors. (The player orbits the origin near the fountain.)
const markers: QuestMarker[] = [
  { anchorId: "clock_tower", kind: "objective" },
  { anchorId: "spice_stall", kind: "source-hint", itemId: "ferry-token" },
  { anchorId: "scribe_desk", kind: "source-hint", itemId: "city-gate-pass" },
]

const remotes: RemotePresence[] = [
  { playerId: "p-aiko", name: "Aiko", pos: { x: -18, z: 9, facing: 1.2 } },
  { playerId: "p-tomas", name: "Tomás", pos: { x: 22, z: -16, facing: -2.1 } },
  { playerId: "p-mira", name: "Mira", pos: { x: 4, z: 26, facing: 0.4 } },
  { playerId: "p-jun", name: "Jun", pos: { x: -8, z: 38, facing: 2.4 } },
  { playerId: "p-lena", name: "Lena", pos: { x: 38, z: 18, facing: -0.6 } },
]

let t = 0
const view: MapView = {
  topology,
  getPlayerPos: () => ({ x: 6 * Math.cos(t / 60), z: 6 * Math.sin(t / 60), facing: t / 60 }),
  getRemotePositions: () => remotes,
  getQuestMarkers: () => markers,
}

const accent = "#c46b4a"

// Build the host DOM exactly like game.ts: .wp-root > .wp-overlay.
const root = document.createElement("div")
root.className = "wp-root"
root.style.cssText = "position:fixed;inset:0;background:#bfe0e8;"
const overlay = document.createElement("div")
overlay.className = "wp-overlay"
overlay.style.cssText = "position:absolute;inset:0;z-index:10;"
root.appendChild(overlay)
document.body.appendChild(root)

// Anchor-name resolver (so the full map labels read nicely).
const NAMES: Record<string, string> = {
  grand_fountain: "Grand Fountain",
  spice_stall: "Spice Stall",
  silk_stall: "Silk Stall",
  money_changer: "Money-changer",
  scribe_desk: "Serafina",
  baker_counter: "The Baker",
  harbor_docks: "Harbor Docks",
  west_gate: "West Gate",
  clock_tower: "Clock Tower",
}
const anchorName = (id: string) =>
  NAMES[id] ?? id.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
const ITEMS: Record<string, string> = { "ferry-token": "the ferry token", "city-gate-pass": "the gate pass" }
const itemName = (id: string) => ITEMS[id] ?? id

// Mock nav so the verify map exercises the #111 popover Route/Go + no-quest toggle.
let mockCourse: string | null = null
let mockQuestActive = true
const nav = {
  setCourse: (id: string) => {
    mockCourse = id
  },
  clearCourse: () => {
    mockCourse = null
  },
  getCourse: () => mockCourse,
  isQuestActive: () => mockQuestActive,
  setQuestActive: (a: boolean) => {
    mockQuestActive = a
  },
}
const fullMapOpts = { view, accent, lang: "en", anchorName, itemName, nav }

const minimap = mountMinimap(overlay, {
  view,
  accent,
  lang: "en",
  onExpand: () => modal.open(),
})
const modal = openFullMap(overlay, fullMapOpts)

// Frame loop drives the minimap + the player motion.
function loop() {
  t += 1
  minimap.tick()
  requestAnimationFrame(loop)
}
requestAnimationFrame(loop)

// Expose a tiny control bar for manual + screenshot verification.
const bar = document.createElement("div")
bar.style.cssText =
  "position:fixed;top:8px;left:8px;z-index:200;display:flex;gap:8px;font:13px sans-serif;"
const mkBtn = (label: string, fn: () => void) => {
  const b = document.createElement("button")
  b.textContent = label
  b.style.cssText = "padding:6px 10px;border-radius:8px;border:none;background:#c46b4a;color:#fff;cursor:pointer;"
  b.onclick = fn
  bar.appendChild(b)
  return b
}
mkBtn("Open full map", () => modal.open())
mkBtn("Open as menu section", () => openMenuMock())
document.body.appendChild(bar)

// Mock the menu body so we can verify the MenuSectionView factory in isolation.
function openMenuMock() {
  const existing = document.querySelector(".mock-menu")
  if (existing) existing.remove()
  const menu = document.createElement("div")
  menu.className = "mock-menu"
  menu.style.cssText =
    "position:absolute;inset:24px;z-index:90;background:linear-gradient(180deg,#f7efe0,#efe3cd);border-radius:18px;padding:16px;display:flex;flex-direction:column;box-shadow:0 18px 48px rgba(40,28,12,.4);"
  const body = document.createElement("div")
  body.style.cssText = "flex:1 1 auto;display:flex;flex-direction:column;min-height:0;"
  const close = document.createElement("button")
  close.textContent = "Close section"
  close.style.cssText = "align-self:flex-end;margin-bottom:8px;padding:4px 10px;border:none;border-radius:8px;background:#5a4a32;color:#fff;cursor:pointer;"
  menu.append(close, body)
  overlay.appendChild(menu)
  const section = createMapSection(fullMapOpts)
  const cleanup = section(body)
  close.onclick = () => {
    cleanup?.()
    menu.remove()
  }
}

// Verification assertions logged to console (read by the screenshot driver).
requestAnimationFrame(() => {
  const mm = overlay.querySelector(".wp-minimap")
  console.log("[verify] minimap in .wp-overlay:", mm?.parentElement === overlay)
  modal.open()
  requestAnimationFrame(() => {
    const fm = overlay.querySelector(".wp-map")
    console.log("[verify] fullMap .wp-map in .wp-overlay:", fm?.parentElement === overlay)
    console.log("[verify] ready")
    ;(window as unknown as { __wpVerifyReady?: boolean }).__wpVerifyReady = true
  })
})
