/**
 * mapCore — shared geometry, theming, and a tiny localization helper for the
 * World Plaza map surfaces (COHESION_ITERATION §4). Both `minimap.ts` and
 * `fullMap.ts` are PURE consumers of the `MapView` bundle (Seam 4):
 *   { topology, getPlayerPos(), getRemotePositions(), getQuestMarkers() }
 * — they never touch another slice's internals.
 *
 * This module owns the world→canvas projection (fit-to-bounds, Y-up world z
 * mapped to screen down), the warm-Antigua paper palette, the anchor
 * classification (prefer `Anchor.kind`, else map the coarse `role`), and the
 * `MapT` helper that wraps the injected `Translate` seam with a per-key English
 * fallback so a bare `(key)=>key` stub never paints blank.
 *
 * Scoped-inline CSS (the slice owns `src/map/*`, NOT styles.css): a single
 * injected `<style data-wp-map>` keyed to `.wp-map*` / `.wp-minimap*` hooks, so
 * the styles.css owner can later enhance the same hooks with zero call-site
 * churn (the same discipline the badges slice uses).
 */

import type { RoomTopology, Anchor, PlayerPosition } from "@world-plaza/contracts"
import type { Translate } from "../contracts/runtime"
import type { QuestMarker } from "../quest/questState"
import { MAP_CSS } from "./mapStyles"

export const LOG = "[wp/map]"

/* --------------------------------------------------- localization helper --- */

/** Per-key English fallback so a bare `(key)=>key` stub never paints blank. */
const EN: Record<string, string> = {
  "map.title": "Map",
  "map.legend": "Legend",
  "map.you": "You",
  "map.players": "Travellers",
  "map.objective": "Your goal",
  "map.hint": "Item nearby",
  "map.vendor": "Market",
  "map.merchant": "Money-changer",
  "map.npc": "Townsfolk",
  "map.docks": "Harbor",
  "map.gate": "City gate",
  "map.fountain": "Fountain",
  "map.portal": "Doorway",
  "map.bench": "Bench",
  "map.landmark": "Landmark",
  "map.spawn": "Start",
  "map.decor": "Dressing",
  // Transit (#72 — the airport/rail/bus/taxi the owner couldn't find).
  "map.airport": "Airport",
  "map.rail": "Train station",
  "map.bus": "Bus terminal",
  "map.taxi": "Taxi rank",
  // Shops + café.
  "map.cafe": "Café",
  "map.outfitter": "Outfitter",
  "map.store": "General store",
  // Civic + landmarks.
  "map.hospital": "Hospital",
  "map.cityhall": "Exchange",
  "map.park": "Central green",
  "map.stadium": "Stadium",
  "map.bridge": "Bridge",
  "map.transit": "Transit",
  "map.shops": "Shops",
  "map.close": "Close",
  "map.open": "Open map",
  "map.empty": "Nothing marked here yet.",
  "map.solo": "You're the only traveller here.",
  "map.findItem": "Find {item}",
  "map.goHere": "Go here",
  // Maps-app chrome (PHONE_DESIGN §6): search + category chips + recenter + route.
  "map.search.placeholder": "Search the city…",
  "map.filter.all": "All",
  "map.filter.shops": "Shops",
  "map.filter.transit": "Transit",
  "map.filter.food": "Food",
  "map.filter.people": "People",
  "map.filter.landmarks": "Landmarks",
  "map.recenter": "Recenter on me",
  "map.route": "Route to {place}",
  "map.route.distance": "~{dist} m",
  "map.route.go": "Go",
}

export type MapT = (key: string, params?: Record<string, string | number>) => string

function interpolate(tpl: string, params: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`))
}

/** Wrap the injected `Translate` with a bundled English fallback (never blank). */
export function createMapT(t: Translate | undefined, lang: string): MapT {
  return (key, params) => {
    let s = t ? t(key, lang, params) : key
    if (s === key || s == null || s === "") {
      const en = EN[key]
      if (en != null) s = params ? interpolate(en, params) : en
      else s = key
    } else if (params && /\{\w+\}/.test(s)) {
      s = interpolate(s, params)
    }
    return s
  }
}

/* ------------------------------------------------------ anchor semantics --- */

/**
 * The schematic POI categories the map draws + legends. We prefer the typed
 * `Anchor.kind` (Seam 6) and fall back to the coarse render `role` when a
 * hand-authored topology lacks `kind`.
 */
export type PoiCategory =
  | "vendor"
  | "merchant"
  | "npc"
  | "docks"
  | "gate"
  | "fountain"
  | "portal"
  | "bench"
  | "landmark"
  | "spawn"
  | "decor"
  // ── #72 contract venues the map MUST surface (the owner: "none of those are on
  // the map so I don't know where to go"). The city generator emits these as
  // generic `portal`/`spawn`/`landmark` kinds, so we classify them by their
  // FROZEN ANCHOR-CONTRACT id (the world guarantees the ids) → a distinct icon.
  | "airport"
  | "rail"
  | "bus"
  | "taxi"
  | "cafe"
  | "outfitter"
  | "store"
  | "hospital"
  | "cityhall"
  | "park"
  | "stadium"
  | "bridge"

/**
 * The FROZEN ANCHOR-CONTRACT venue ids → their map category. Keyed by id because
 * the city generator collapses transit/shops/civic into coarse `portal`/`spawn`/
 * `landmark` kinds (so they'd vanish from the map). The WORLD agent guarantees
 * these ids exist; classifying by id is the reliable way to plot every venue
 * with a legible, distinct icon — and to answer the owner's "are they in another
 * district?" (they show wherever the world places them).
 */
const VENUE_BY_ID: Record<string, PoiCategory> = {
  // transit
  airport: "airport",
  rail_station: "rail",
  bus_station: "bus",
  station: "taxi", // the central "station" anchor is the taxi rank
  // shops + café (cafe/outfitter sit on generic anchors; classify by id)
  cafe: "cafe",
  outfitter: "outfitter",
  general_store: "store",
  general: "store",
  // civic
  hospital: "hospital",
  exchange: "cityhall",
  city_hall: "cityhall",
  cityhall: "cityhall",
  // landmarks
  market: "vendor",
  harbor: "docks",
  fountain: "fountain",
  plaza: "fountain", // the grand plaza reads as a civic centre dot, not a bare start tick
  central_green: "park",
  "central-green": "park",
  stadium: "stadium",
  bridge: "bridge",
  bridge_n: "bridge",
  bridge_s: "bridge",
}

/** Resolve an anchor to its schematic category (id-first, then kind, then role). */
export function categoryOf(a: Anchor): PoiCategory {
  // #72: the contract-venue id wins — a `portal`/`spawn`/`landmark` anchor whose
  // id is a known venue gets that venue's distinct icon, so the airport/rail/bus/
  // taxi/café/shops/park/stadium are never lost to a generic faint tick.
  const byId = VENUE_BY_ID[a.id]
  if (byId) return byId
  switch (a.kind) {
    case "vendor":
      return "vendor"
    case "merchant":
      return "merchant"
    case "npc_station":
      return "npc"
    case "docks":
      return "docks"
    case "city_gate":
      return "gate"
    case "fountain":
      return "fountain"
    case "portal":
      return "portal"
    case "bench":
      return "bench"
    case "landmark":
      return "landmark"
    case "spawn":
      return "spawn"
    case "decor":
      return "decor"
  }
  // No typed kind → map the coarse render role.
  switch (a.role) {
    case "vendor":
      return "vendor"
    case "npc_station":
      return "npc"
    case "portal":
      return "portal"
    case "bench":
      return "bench"
    case "spawn":
      return "spawn"
    case "decor":
    default:
      return "decor"
  }
}

/** Categories worth a labelled dot on the map (decor/portals/benches stay faint). */
export const SIGNIFICANT: ReadonlySet<PoiCategory> = new Set<PoiCategory>([
  "vendor",
  "merchant",
  "npc",
  "docks",
  "gate",
  "fountain",
  "landmark",
  // #72 contract venues — every one gets a plotted marker so the city is findable.
  "airport",
  "rail",
  "bus",
  "taxi",
  "cafe",
  "outfitter",
  "store",
  "hospital",
  "cityhall",
  "park",
  "stadium",
  "bridge",
])

/** Warm-Antigua paper palette (matches the menu / tracker brand). */
export const PALETTE = {
  paper: "#f4ead4",
  paperEdge: "#e7d8b6",
  ground: "#efe1c2",
  groundLine: "#d8c6a0",
  blocker: "#cdb98f",
  blockerEdge: "#bda981",
  ink: "#5a4a32",
  inkSoft: "#8a785c",
  // open water on the map (#35) — a calm slate-blue that reads as river/coast.
  water: "#8fb8cc",
  waterEdge: "#6f9cb4",
} as const

/* ------------------------------------------------------- marker design ----- */
/**
 * THE marker system (the owner's critique: "7 types in basically 2 colours").
 * Every thing the map can plot is one `MarkerType`, and each type gets a
 * CLEARLY distinct COLOUR *and* SHAPE (+ a tiny glyph for the named specials),
 * so player / traveller / townsfolk / vendor / money-changer / quest-special /
 * docks / gate / fountain / landmark are told apart at a glance — not by hue
 * alone (colour-blind safe: shape carries the meaning too).
 *
 * Shapes are drawn by `schematic.drawMarker`. The full palette is deliberately
 * saturated against the warm paper ground so the categories separate; the paper
 * frame/labels stay warm and understated.
 */
export type MarkerType =
  | "player" // you (heading wedge, accent) — drawn separately
  | "traveller" // a real remote player (Colyseus presence)
  | "objective" // the current quest objective (a quest-special anchor)
  | "source-hint" // where to find a needed item
  | "vendor" // market stall
  | "merchant" // money-changer / trade floor
  | "npc" // townsfolk station
  | "docks" // boat crossing
  | "gate" // city gate
  | "fountain" // plaza centrepiece
  | "landmark" // signature POI
  // ── #72 contract venues — each a distinct, legible icon.
  | "airport" // air travel
  | "rail" // train station
  | "bus" // bus terminal
  | "taxi" // taxi rank (the central "station")
  | "cafe" // café
  | "outfitter" // outfitter / tailor
  | "store" // general store
  | "hospital" // hospital (civic)
  | "cityhall" // exchange / city hall (civic)
  | "park" // central green
  | "stadium" // stadium
  | "bridge" // bridge crossing

/** Distinct geometric form per marker type (shape carries meaning, not just hue). */
export type MarkerShape =
  | "circle"
  | "diamond"
  | "triangle"
  | "square"
  | "star"
  | "pin"
  | "droplet"
  | "wedge" // the player heading wedge (drawn bespoke)

export interface MarkerStyle {
  /** strong fill colour (saturated against the paper ground). */
  color: string
  /** the geometric form (shape, not hue, is the primary differentiator). */
  shape: MarkerShape
  /** an optional single-glyph hint drawn on bigger markers (full map). */
  glyph?: string
  /** legend i18n key. */
  labelKey: string
}

/**
 * ONE source of truth for every marker's colour + shape + glyph + legend label.
 * The schematic, the legend, and the labels all read from here so they can
 * never drift (the old bug: the legend hand-mirrored the dot colours).
 */
export const MARKER_STYLES: Record<MarkerType, MarkerStyle> = {
  // YOU — warm accent wedge (the heading arrow). Drawn bespoke in drawPlayer.
  player: { color: "#c64a2e", shape: "wedge", labelKey: "map.you" },
  // TRAVELLERS — real remote players. Cool indigo circle (clearly "people, not me").
  traveller: { color: "#3b5bdb", shape: "circle", glyph: "•", labelKey: "map.players" },
  // QUEST OBJECTIVE — vivid amber STAR (the one place to go; unmistakable).
  objective: { color: "#e8930c", shape: "star", glyph: "★", labelKey: "map.objective" },
  // SOURCE HINT — a hollow leaf-green DROPLET ("where to find the item").
  "source-hint": { color: "#2f9e44", shape: "droplet", glyph: "?", labelKey: "map.hint" },
  // VENDOR — market stall. Pumpkin SQUARE (a stall = a box).
  vendor: { color: "#d9480f", shape: "square", glyph: "$", labelKey: "map.vendor" },
  // MERCHANT — money-changer. Gold DIAMOND (coin/gem).
  merchant: { color: "#b8860b", shape: "diamond", glyph: "¤", labelKey: "map.merchant" },
  // TOWNSFOLK — npc station. Plum TRIANGLE (a person at a post).
  npc: { color: "#9c36b5", shape: "triangle", glyph: "", labelKey: "map.npc" },
  // DOCKS — boat crossing. Deep teal PIN (anchored at the water's edge).
  docks: { color: "#0c8599", shape: "pin", glyph: "⚓", labelKey: "map.docks" },
  // CITY GATE — walled-town gate. Slate-blue PIN (a gateway out).
  gate: { color: "#3b4a6b", shape: "pin", glyph: "⌂", labelKey: "map.gate" },
  // FOUNTAIN — plaza centrepiece. Sky CIRCLE with a ring (water).
  fountain: { color: "#1098ad", shape: "circle", glyph: "≈", labelKey: "map.fountain" },
  // LANDMARK — signature POI. Magenta DIAMOND.
  landmark: { color: "#c2255c", shape: "diamond", glyph: "✦", labelKey: "map.landmark" },

  // ── #72 TRANSIT — the cluster the owner couldn't find. A cool blue family,
  // told apart by SHAPE + a clear mode glyph (plane / train / coach / taxi).
  airport: { color: "#1c7ed6", shape: "triangle", glyph: "✈", labelKey: "map.airport" },
  rail: { color: "#4263eb", shape: "square", glyph: "≣", labelKey: "map.rail" },
  bus: { color: "#1971c2", shape: "square", glyph: "▥", labelKey: "map.bus" },
  taxi: { color: "#f59f00", shape: "diamond", glyph: "T", labelKey: "map.taxi" },

  // ── SHOPS + CAFÉ — warm earthy family, distinct glyphs.
  cafe: { color: "#9c6644", shape: "circle", glyph: "☕", labelKey: "map.cafe" },
  outfitter: { color: "#7048e8", shape: "square", glyph: "✂", labelKey: "map.outfitter" },
  store: { color: "#5c940d", shape: "square", glyph: "▦", labelKey: "map.store" },

  // ── CIVIC — hospital (red cross) + exchange/city hall (indigo pin).
  hospital: { color: "#e03131", shape: "pin", glyph: "✚", labelKey: "map.hospital" },
  cityhall: { color: "#3b5bdb", shape: "pin", glyph: "§", labelKey: "map.cityhall" },

  // ── GREEN LANDMARKS — park (leafy circle), stadium (ring), bridge (span).
  park: { color: "#2f9e44", shape: "circle", glyph: "♣", labelKey: "map.park" },
  stadium: { color: "#1864ab", shape: "circle", glyph: "◎", labelKey: "map.stadium" },
  bridge: { color: "#7c6f5a", shape: "triangle", glyph: "⌒", labelKey: "map.bridge" },
}

/** A POI category's marker style (the schematic POI categories are a subset). */
export function markerStyleForCat(cat: PoiCategory): MarkerStyle {
  switch (cat) {
    case "vendor":
      return MARKER_STYLES.vendor
    case "merchant":
      return MARKER_STYLES.merchant
    case "npc":
      return MARKER_STYLES.npc
    case "docks":
      return MARKER_STYLES.docks
    case "gate":
      return MARKER_STYLES.gate
    case "fountain":
      return MARKER_STYLES.fountain
    case "landmark":
      return MARKER_STYLES.landmark
    // #72 contract venues.
    case "airport":
      return MARKER_STYLES.airport
    case "rail":
      return MARKER_STYLES.rail
    case "bus":
      return MARKER_STYLES.bus
    case "taxi":
      return MARKER_STYLES.taxi
    case "cafe":
      return MARKER_STYLES.cafe
    case "outfitter":
      return MARKER_STYLES.outfitter
    case "store":
      return MARKER_STYLES.store
    case "hospital":
      return MARKER_STYLES.hospital
    case "cityhall":
      return MARKER_STYLES.cityhall
    case "park":
      return MARKER_STYLES.park
    case "stadium":
      return MARKER_STYLES.stadium
    case "bridge":
      return MARKER_STYLES.bridge
    default:
      // portal/bench/spawn/decor are faint ticks, not categorical markers.
      return { color: "#9a7a4a", shape: "circle", labelKey: "map.decor" }
  }
}

/** A category's dot colour on the schematic (kept for any colour-only callers). */
export function poiColor(cat: PoiCategory): string {
  return markerStyleForCat(cat).color
}

/* --------------------------------------------------- world→canvas project --- */

export interface Projection {
  /** project a world ground point (x,z) to canvas px. */
  toScreen(x: number, z: number): { x: number; y: number }
  /** world units → canvas px scale (uniform). */
  scale: number
  /** the drawable inset rect in canvas px. */
  inset: { x: number; y: number; w: number; h: number }
}

/**
 * The square world extent the map actually fits to. Many topologies declare a
 * huge nominal `bounds` (e.g. ±120) while all anchors/blockers live near the
 * centre (±45). Fitting the nominal bounds zooms the schematic to a tiny,
 * label-colliding speck — so we fit a SQUARE extent over the real content
 * (anchors + blockers), margin-padded and clamped INSIDE bounds. A square keeps
 * the player's heading + relative directions undistorted.
 */
export function contentExtent(topology: RoomTopology): {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
} {
  const b = topology.bounds
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  const acc = (x: number, z: number) => {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (z < minZ) minZ = z
    if (z > maxZ) maxZ = z
  }
  for (const a of topology.anchors) acc(a.x, a.z)
  for (const blk of topology.blockers) {
    acc(blk.x - blk.w / 2, blk.z - blk.d / 2)
    acc(blk.x + blk.w / 2, blk.z + blk.d / 2)
  }
  for (const s of topology.spawns) acc(s.x, s.z)
  // No content → fall back to the nominal bounds.
  if (!isFinite(minX)) return { minX: b.minX, maxX: b.maxX, minZ: b.minZ, maxZ: b.maxZ }
  // Margin so dots/labels near the edge aren't flush against the frame.
  const span = Math.max(maxX - minX, maxZ - minZ, 1)
  const margin = span * 0.08 + 2
  minX -= margin
  maxX += margin
  minZ -= margin
  maxZ += margin
  // Square it (centred) so x/z scale uniformly without distortion.
  const cx = (minX + maxX) / 2
  const cz = (minZ + maxZ) / 2
  const half = Math.max(maxX - minX, maxZ - minZ) / 2
  // Clamp inside the declared bounds (never project outside the room).
  return {
    minX: Math.max(b.minX, cx - half),
    maxX: Math.min(b.maxX, cx + half),
    minZ: Math.max(b.minZ, cz - half),
    maxZ: Math.min(b.maxZ, cz + half),
  }
}

/**
 * Fit-to-content projection: maps the content extent (anchors/blockers, clamped
 * to bounds) into the canvas with a uniform scale + padding, world +z → screen
 * down (north-up reads naturally).
 */
export function fitProjection(
  topology: RoomTopology,
  canvasW: number,
  canvasH: number,
  pad: number,
): Projection {
  const ext = contentExtent(topology)
  const worldW = Math.max(1e-3, ext.maxX - ext.minX)
  const worldH = Math.max(1e-3, ext.maxZ - ext.minZ)
  const availW = Math.max(1, canvasW - pad * 2)
  const availH = Math.max(1, canvasH - pad * 2)
  const scale = Math.min(availW / worldW, availH / worldH)
  const drawW = worldW * scale
  const drawH = worldH * scale
  const offX = (canvasW - drawW) / 2
  const offY = (canvasH - drawH) / 2
  return {
    scale,
    inset: { x: offX, y: offY, w: drawW, h: drawH },
    toScreen(x, z) {
      return {
        x: offX + (x - ext.minX) * scale,
        // TRUE north-up: world +z → screen UP (top). The old `(z - minZ)` put +z
        // at the BOTTOM, so the player's forward (+z at facing 0) and the heading
        // wedge read BACKWARDS vs the camera. Flipping z fixes the compass.
        y: offY + (ext.maxZ - z) * scale,
      }
    },
  }
}

/**
 * A PLAYER-CENTRED projection (north-up): a fixed world window of ±`halfSpan`
 * units around `(cx,cz)`, mapped to the canvas with the player at the centre.
 * The minimap uses this each tick so it FOLLOWS the player — you're always at the
 * middle and never walk off the edge (the old fit-to-content projection showed a
 * fixed central region of a 760u city, so you'd quickly leave it). Same +z → up
 * convention as `fitProjection` so the heading wedge matches.
 */
export function centeredProjection(
  cx: number,
  cz: number,
  halfSpan: number,
  canvasW: number,
  canvasH: number,
  pad: number,
): Projection {
  const avail = Math.max(1, Math.min(canvasW, canvasH) - pad * 2)
  const scale = avail / (Math.max(1, halfSpan) * 2)
  const ccx = canvasW / 2
  const ccy = canvasH / 2
  return {
    scale,
    inset: { x: pad, y: pad, w: canvasW - pad * 2, h: canvasH - pad * 2 },
    toScreen(x, z) {
      return {
        x: ccx + (x - cx) * scale,
        y: ccy - (z - cz) * scale, // +z → up (north-up)
      }
    },
  }
}

/* ----------------------------------------------------------- marker coords --- */

/** A quest marker resolved to canvas-drawable world coords (skips unknown anchors). */
export interface PlottedMarker {
  marker: QuestMarker
  anchor: Anchor
}

/** Resolve quest markers to topology anchors; drop markers with no matching anchor. */
export function plotMarkers(topology: RoomTopology, markers: QuestMarker[]): PlottedMarker[] {
  const byId = new Map(topology.anchors.map((a) => [a.id, a]))
  const out: PlottedMarker[] = []
  for (const m of markers) {
    const anchor = byId.get(m.anchorId)
    if (anchor) out.push({ marker: m, anchor })
  }
  return out
}

/**
 * World forward (unit XZ) for the player's `facing` (= the controller's `yaw`).
 *
 * THE MAP-ARROW INVERSION FIX (#23, recurring): this MUST match the player
 * controller's actual forward basis, which is `(-sin(yaw), -cos(yaw))` (see
 * movement/controller.ts: `fx = -sin(yaw); fz = -cos(yaw)`). The old version
 * returned `(sin, cos)` — the EXACT NEGATION — so the heading wedge pointed 180°
 * backwards, i.e. where the paper character's back faces / toward the camera,
 * never the way the player travels. Prior "fixes" tweaked the screen-projection
 * sign in drawPlayer instead of this root basis, which is why it kept coming back.
 * Verify by WALKING FORWARD: the wedge must point the way you move.
 */
export function headingVec(facing: number): { dx: number; dz: number } {
  return { dx: -Math.sin(facing), dz: -Math.cos(facing) }
}

/* --------------------------------------------------- scoped-inline styles --- */

let stylesInjected = false
export function ensureMapStyles(): void {
  if (stylesInjected) return
  if (typeof document === "undefined") return
  if (document.querySelector("style[data-wp-map]")) {
    stylesInjected = true
    return
  }
  const style = document.createElement("style")
  style.setAttribute("data-wp-map", "")
  style.textContent = MAP_CSS
  document.head.appendChild(style)
  stylesInjected = true
}

/* --------------------------------------------------- canvas DPR helper ----- */

/** Size a canvas to CSS px × devicePixelRatio and return the 2D ctx (DPR-scaled). */
export function prepCanvas(
  canvas: HTMLCanvasElement,
  cssW: number,
  cssH: number,
): CanvasRenderingContext2D | null {
  const dpr = Math.min(3, Math.max(1, (typeof window !== "undefined" && window.devicePixelRatio) || 1))
  const pxW = Math.max(1, Math.round(cssW * dpr))
  const pxH = Math.max(1, Math.round(cssH * dpr))
  if (canvas.width !== pxW) canvas.width = pxW
  if (canvas.height !== pxH) canvas.height = pxH
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    console.error(`${LOG} 2D context unavailable`)
    return null
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return ctx
}

export type { PlayerPosition }
