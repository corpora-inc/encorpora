/**
 * QA contact-sheet harness for the IconRenderer (CONTENT_SCALE quality gate).
 * Renders every currency / badge tier / item family at 24px AND 48px so a human
 * can confirm: premium, distinct, tasteful, zero emoji/placeholders.
 *
 * Not shipped — a dev-only verification page (qa/iconsheet/index.html).
 */
import { iconRenderer } from "../../src/items/itemArt"
import type { IconSpec, IconFinish, IconRarity } from "../../src/contracts/runtime"

const root = document.getElementById("sheet")!

function section(title: string): HTMLElement {
  const h = document.createElement("h2")
  h.textContent = title
  h.className = "sec"
  root.appendChild(h)
  const grid = document.createElement("div")
  grid.className = "grid"
  root.appendChild(grid)
  return grid
}

function cell(grid: HTMLElement, spec: IconSpec, label: string, sizes: number[]) {
  const wrap = document.createElement("div")
  wrap.className = "cell"
  const row = document.createElement("div")
  row.className = "icons"
  for (const size of sizes) {
    const c = iconRenderer.renderIcon(spec, { size })
    row.appendChild(c)
  }
  wrap.appendChild(row)
  const cap = document.createElement("div")
  cap.className = "cap"
  cap.textContent = label
  wrap.appendChild(cap)
  grid.appendChild(wrap)
}

const SIZES_24 = [24]
const SIZES_BOTH = [24, 48]

/* ---- Currencies (era/place flavored, real currency-ish art) ---- */
{
  const g = section("Currencies — coins · note-stacks · ingots · gems · shells · pouches")
  const currencies: Array<[string, IconSpec]> = [
    ["gold real (coin)", { family: "coin-round", palette: "#e8b73c", metal: "gold", motif: "castle", finish: "metal" }],
    ["piece of eight", { family: "coin-round", palette: "#d6dbe1", metal: "silver", motif: "eagle", finish: "metal" }],
    ["copper cuarto", { family: "coin-round", palette: "#e08a47", metal: "copper", motif: "sun", finish: "metal" }],
    ["yen (square hole)", { family: "coin-square-hole", palette: "#d6dbe1", metal: "silver", motif: "chrysanthemum" }],
    ["sycee ingot", { family: "ingot-bar", palette: "#d6dbe1", metal: "silver", motif: "star" }],
    ["gold ingot", { family: "ingot-bar", palette: "#e8b73c", metal: "gold", motif: "sun" }],
    ["peso bill", { family: "bill-rect", palette: "#5a8f6a", motif: "eagle", accent: "#9a3b3b" }],
    ["mark note-stack", { family: "note-stack", palette: "#8a5a8a", motif: "castle", accent: "#c79a4a" }],
    ["dollar wad", { family: "note-stack", palette: "#4a8f6a", motif: "wreath", accent: "#9a3b3b" }],
    ["cowrie shell", { family: "shell", palette: "#e7c8a8", motif: "" }],
    ["jade gem", { family: "gem-faceted", palette: "#3aa86a", motif: "" }],
    ["sapphire gem", { family: "gem-faceted", palette: "#3a6ac8", motif: "" }],
    ["coin pouch", { family: "pouch", palette: "#9a6a3a", accent: "#6a4422" }],
  ]
  for (const [label, spec] of currencies) cell(g, spec, label, SIZES_BOTH)
}

/* ---- Badge medals — every tier + a few family emblems ---- */
{
  const g = section("Badge medals — tiers (locked→platinum) × emblems × fill arc")
  const tiers: IconSpec["tier"][] = ["locked", "bronze", "silver", "gold", "platinum"]
  const arcs: Record<string, number> = { locked: 0, bronze: 0.35, silver: 0.6, gold: 0.85, platinum: 1 }
  for (const tier of tiers) {
    cell(g, { family: "medal", palette: "#c79a4a", tier, fillArc: arcs[tier!], motif: "wreath", accent: "#9a3b3b" }, `${tier} · wreath`, SIZES_BOTH)
  }
  // family emblems across tiers
  const fam: Array<[string, string]> = [
    ["travel", "compass"],
    ["social", "speech"],
    ["reading", "book"],
    ["listening", "ear"],
    ["grammar", "gear"],
    ["numbers", "star"],
  ]
  let i = 0
  for (const [name, motif] of fam) {
    const tier = (["bronze", "silver", "gold", "platinum"] as const)[i % 4]
    cell(g, { family: "medal", palette: "#c79a4a", tier, fillArc: 0.5, motif, accent: "#3a5a8a" }, `${name} · ${tier}`, SIZES_BOTH)
    i++
  }
}

/* ---- Item families × a sampling of finishes/rarities ---- */
{
  const g = section("Item families — token · seal · letter · scroll · garment · foodstuff · vessel · tool · key · charm · cloth")
  const items: Array<[string, IconSpec]> = [
    ["token (ferry)", { family: "token", palette: "#b8894a", motif: "compass", finish: "metal", rarity: "rare" }],
    ["seal (wax)", { family: "seal", palette: "#9a3b3b", motif: "castle", rarity: "common" }],
    ["letter (sealed)", { family: "letter", palette: "#efe4cf", motif: "star", accent: "#9a3b3b", rarity: "common" }],
    ["scroll (market list)", { family: "scroll", palette: "#e8d6a8", accent: "#8a5a2a", rarity: "common" }],
    ["scroll (song · rare)", { family: "scroll", palette: "#d8c8e8", accent: "#6a4a8a", rarity: "rare" }],
    ["garment (linen shirt)", { family: "garment", palette: "#dcd0b8", finish: "woven", rarity: "common" }],
    ["garment (coat · epic)", { family: "garment", palette: "#4a5a7a", finish: "glazed", rarity: "epic" }],
    ["foodstuff (bread)", { family: "foodstuff", palette: "#cf8a4a", accent: "#7a5a2a", rarity: "common" }],
    ["foodstuff (fruit)", { family: "foodstuff", palette: "#c83a4a", accent: "#6a8a3a", rarity: "common" }],
    ["vessel (clay pot)", { family: "vessel", palette: "#b06a4a", finish: "matte", rarity: "common" }],
    ["vessel (flask · glazed)", { family: "vessel", palette: "#3a8a9a", finish: "glazed", rarity: "common" }],
    ["tool (quill)", { family: "tool", palette: "#dcd0b8", accent: "#5a3a1a", rarity: "common" }],
    ["tool (lantern · metal)", { family: "tool", palette: "#c79a4a", finish: "metal", accent: "#5a3a1a", rarity: "rare" }],
    ["key (cathedral · epic)", { family: "key", palette: "#c79a4a", metal: "gold", rarity: "epic" }],
    ["key (iron)", { family: "key", palette: "#8a8a8a", metal: "silver", rarity: "common" }],
    ["charm (lucky · rare)", { family: "charm", palette: "#6a8aaa", motif: "star", metal: "gold", rarity: "rare" }],
    ["charm (jade bead · epic)", { family: "charm", palette: "#3aa86a", metal: "patina", rarity: "epic" }],
    ["cloth (woven)", { family: "cloth", palette: "#a05a7a", accent: "#e8c25a", rarity: "common" }],
    ["cloth (festival · seasonal)", { family: "cloth", palette: "#7a3a9a", accent: "#e8c25a", rarity: "seasonal" }],
  ]
  for (const [label, spec] of items) cell(g, spec, label, SIZES_BOTH)
}

/* ---- Rarity-frame legibility row (same family, all four frames) ---- */
{
  const g = section("Rarity frames — common · rare · epic · seasonal (legible at a glance)")
  const rarities: IconRarity[] = ["common", "rare", "epic", "seasonal"]
  for (const rarity of rarities) {
    cell(g, { family: "token", palette: "#b8894a", motif: "sun", finish: "metal", rarity }, rarity, SIZES_BOTH)
  }
}

/* ---- Finish legibility row ---- */
{
  const g = section("Finishes — matte · glazed · metal · woven")
  const finishes: IconFinish[] = ["matte", "glazed", "metal", "woven"]
  for (const finish of finishes) {
    cell(g, { family: "vessel", palette: "#b06a4a", finish }, finish, SIZES_BOTH)
  }
}

// signal ready for the screenshotter
;(window as unknown as { __iconsheetReady?: boolean }).__iconsheetReady = true
document.title = "ready"
console.log("[iconsheet] rendered")
