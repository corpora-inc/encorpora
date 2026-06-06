/**
 * fullMap — the premium full-screen map (COHESION_ITERATION §4.3).
 *
 * Same data as the minimap, richer: a larger paper schematic with labelled POIs
 * (markets, money-changers, townsfolk, docks, gate…), the quest objective
 * highlighted with a soft "go here" tag, remote travellers with names, and a
 * legend. MVP is a stylized schematic (premium + cheap); a 3D upgrade slots in
 * behind the same `MapView` seam with no consumer change.
 *
 * TWO entry points, ONE renderer (`renderFullMap`):
 *   - `openFullMap(parent, opts)` — an in-`.wp-overlay` modal (from a minimap tap
 *     or anywhere): scrim + paper panel + close. Mounts INSIDE `.wp-overlay`.
 *   - `createMapSection(opts)` — a `MenuSectionView` factory for the menu's Map
 *     tab: it renders the SAME map into the menu body the panel hands it (no
 *     scrim/close — the menu owns the chrome). Hand this to `createMenuPanel`'s
 *     `sections.map`.
 *
 * Both are PURE consumers of the `MapView` bundle (Seam 4). Each owns a small
 * rAF loop so live positions animate while open, and tears it down on close.
 */

import type { MapView } from "../contracts/runtime"
import type { Translate } from "../contracts/runtime"
import type { Anchor } from "@world-plaza/contracts"
import {
  ensureMapStyles,
  fitProjection,
  centeredProjection,
  contentExtent,
  prepCanvas,
  createMapT,
  categoryOf,
  markerStyleForCat,
  MARKER_STYLES,
  type MapT,
  type Projection,
  type PoiCategory,
  type MarkerStyle,
} from "./mapCore"
import {
  drawBase,
  drawPois,
  drawQuestMarkers,
  drawRemotes,
  drawPlayer,
  drawMarker,
  drawWayfinding,
  type PlottedRemote,
  type PlottedQuestMarker,
  type PlottedPoi,
} from "./schematic"
import { createMapPopover, type PopoverHandle } from "./mapPopover"

const LOG = "[wp/fullMap]"

/**
 * NAVIGATION seam (#111). When the host provides `nav`, a POI popover's Route/Go sets
 * the wayfinding COURSE to that place (the on-road arrow + beacon + map all retarget),
 * and a "No quest" toggle turns quests off for free exploration. All optional + omit-
 * graceful — without `nav` the map is a pure viewer.
 */
export interface MapNav {
  setCourse(anchorId: string): void
  clearCourse(): void
  getCourse(): string | null
  isQuestActive(): boolean
  setQuestActive(active: boolean): void
}

export interface FullMapOptions {
  view: MapView
  accent?: string
  t?: Translate
  lang?: string
  /** Resolve an anchor id → a friendly POI name ("the boatman", "Serafina"). */
  anchorName?: (anchorId: string) => string
  /** Resolve an item id → a friendly label (for source-hint tags). */
  itemName?: (itemId: string) => string
  /** Optional navigation controls (set-course-to-POI + no-quest toggle). */
  nav?: MapNav
}

/**
 * Legend categories shown (in this order) when present in the topology. Grouped
 * so the key reads as a city directory: landmarks/civic first, then the transit
 * cluster (#72 — what the owner couldn't find), then shops + café.
 */
const LEGEND_ORDER: PoiCategory[] = [
  // landmarks + civic
  "fountain",
  "park",
  "stadium",
  "bridge",
  "docks",
  "gate",
  "hospital",
  "cityhall",
  "landmark",
  // commerce
  "vendor",
  "merchant",
  "npc",
  "cafe",
  "outfitter",
  "store",
  // transit
  "taxi",
  "bus",
  "rail",
  "airport",
]
interface RenderHandle {
  /** root element rendered into the host body. */
  el: HTMLElement
  dispose(): void
}

/**
 * Render the full-map content (stage canvas + floated labels + legend) into
 * `host`. Runs its own rAF loop (live actors) until disposed. Shared by both the
 * overlay modal and the menu section.
 */
/**
 * The Maps-app FILTER CHIPS (PHONE_DESIGN §6): each chip maps a friendly bucket to
 * the underlying `PoiCategory` set. "all" is the no-op default. Order = the chip row
 * order. Localized via `map.filter.*` (EN fallback in mapCore's dict + main strings).
 */
const FILTER_CHIPS: Array<{ id: string; labelKey: string; cats: PoiCategory[] | null }> = [
  { id: "all", labelKey: "map.filter.all", cats: null },
  { id: "shops", labelKey: "map.filter.shops", cats: ["vendor", "merchant", "store", "outfitter", "cafe"] },
  { id: "transit", labelKey: "map.filter.transit", cats: ["taxi", "bus", "rail", "airport"] },
  { id: "food", labelKey: "map.filter.food", cats: ["cafe", "vendor"] },
  { id: "people", labelKey: "map.filter.people", cats: ["npc"] },
  {
    id: "landmarks",
    labelKey: "map.filter.landmarks",
    cats: ["fountain", "park", "stadium", "bridge", "docks", "gate", "hospital", "cityhall", "landmark"],
  },
]

function renderFullMap(host: HTMLElement, opts: FullMapOptions): RenderHandle {
  ensureMapStyles()
  const accent = opts.accent ?? "#c46b4a"
  const mt: MapT = createMapT(opts.t, opts.lang ?? "en")
  const anchorName = opts.anchorName ?? prettyAnchor
  const itemName = opts.itemName ?? ((id: string) => id)
  const reduced =
    typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches

  // ── Maps-app FILTER STATE (search query + active category chip) ──────────────
  let searchQuery = ""
  let activeChip = "all"
  /** A POI passes the filter when it matches the active chip AND the search query. */
  const poiPasses = (cat: PoiCategory, a: Anchor): boolean => {
    const chip = FILTER_CHIPS.find((c) => c.id === activeChip)
    if (chip && chip.cats && !chip.cats.includes(cat)) return false
    if (searchQuery) {
      const hay = `${anchorName(a.id)} ${a.id} ${mt(`map.${cat}`)}`.toLowerCase()
      if (!hay.includes(searchQuery)) return false
    }
    return true
  }
  const filterActive = (): boolean => activeChip !== "all" || searchQuery !== ""

  const wrap = document.createElement("div")
  wrap.className = "wp-map-content"
  wrap.style.display = "flex"
  wrap.style.flexDirection = "column"
  wrap.style.minHeight = "0"
  wrap.style.flex = "1 1 auto"

  // ── SEARCH + CATEGORY CHIPS header (the real-Maps-app chrome) ────────────────
  const tools = document.createElement("div")
  tools.className = "wp-map-tools"
  const searchWrap = document.createElement("div")
  searchWrap.className = "wp-map-search"
  searchWrap.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>'
  const search = document.createElement("input")
  search.type = "search"
  search.className = "wp-map-search-input"
  search.placeholder = mt("map.search.placeholder")
  search.setAttribute("aria-label", mt("map.search.placeholder"))
  search.addEventListener("input", () => {
    searchQuery = search.value.trim().toLowerCase()
  })
  searchWrap.appendChild(search)
  const chipRow = document.createElement("div")
  chipRow.className = "wp-map-chips"
  const chipBtns = new Map<string, HTMLButtonElement>()
  for (const chip of FILTER_CHIPS) {
    const b = document.createElement("button")
    b.type = "button"
    b.className = "wp-map-chip"
    b.dataset.chip = chip.id
    b.textContent = mt(chip.labelKey)
    if (chip.id === activeChip) b.setAttribute("aria-current", "true")
    b.addEventListener("click", () => {
      activeChip = chip.id
      for (const [id, btn] of chipBtns) btn.toggleAttribute("aria-current", id === chip.id)
    })
    chipBtns.set(chip.id, b)
    chipRow.appendChild(b)
  }
  tools.append(searchWrap, chipRow)
  wrap.appendChild(tools)

  const stage = document.createElement("div")
  stage.className = "wp-map-stage"
  const canvas = document.createElement("canvas")
  canvas.className = "wp-map-canvas"
  stage.appendChild(canvas)
  wrap.appendChild(stage)

  // A layer for floated text tags (now ONLY You + the objective — #111 declutter).
  const tagLayer = document.createElement("div")
  tagLayer.style.position = "absolute"
  tagLayer.style.inset = "0"
  tagLayer.style.pointerEvents = "none"
  stage.appendChild(tagLayer)

  // ── PIN LAYER (#111): accessible, focusable hit-targets over each plotted POI.
  //   The canvas draws the pin glyphs; these transparent buttons sit on top so a
  //   POI is tappable + keyboard-focusable with a localized ARIA label, and opens
  //   the popover. Rebuilt each frame from the plotted POIs (cheap; dozens). ──────
  const pinLayer = document.createElement("div")
  pinLayer.className = "wp-map-pins"
  pinLayer.style.position = "absolute"
  pinLayer.style.inset = "0"
  stage.appendChild(pinLayer)

  // The localized POI TYPE label for a category (e.g. "Café", "Market") — reuses the
  // marker-style label key so it matches the legend.
  const typeLabel = (cat: PoiCategory): string => mt(markerStyleForCat(cat).labelKey)

  // Open the popover for a POI: localized name + type + distance + Route/Go (which
  // sets the wayfinding course). Distance uses the live player world point.
  const openPopoverFor = (poi: PlottedPoi) => {
    let pPos
    try {
      pPos = opts.view.getPlayerPos()
    } catch {
      pPos = null
    }
    const a = opts.view.topology.anchors.find((an) => an.id === poi.id)
    const dist =
      pPos && a ? mt("map.route.distance", { dist: Math.round(Math.hypot(a.x - pPos.x, a.z - pPos.z)) }) : null
    const isCourse = opts.nav?.getCourse() === poi.id
    popover.show({
      anchorId: poi.id,
      name: anchorName(poi.id),
      type: typeLabel(poi.cat),
      distance: dist,
      actionLabel: isCourse ? mt("map.course.clear") : mt("map.route.go"),
      isCourse,
      sx: poi.sx,
      sy: poi.sy,
    })
  }

  // The popover: Route/Go sets the course (or clears it if already coursed).
  const popover: PopoverHandle = createMapPopover(stage, {
    accent,
    ariaLabel: (name) => mt("map.poi.aria", { name }),
    onAct: (id) => {
      if (!opts.nav) return
      if (opts.nav.getCourse() === id) opts.nav.clearCourse()
      else opts.nav.setCourse(id)
      popover.hide()
    },
  })
  // Tap-away on the stage closes the popover (a clean tap, handled in onUp below).

  // ROUTE STRIP — "Route to {place} · ~{dist}" + a Go button that frames the
  // player→objective leg. Hidden when there's no active objective. Sits above the
  // legend so it reads as the app's primary "what now" affordance.
  const routeStrip = document.createElement("div")
  routeStrip.className = "wp-map-route"
  routeStrip.hidden = true
  const routeText = document.createElement("div")
  routeText.className = "wp-map-route-text"
  const routeGo = document.createElement("button")
  routeGo.type = "button"
  routeGo.className = "wp-map-route-go"
  routeGo.textContent = mt("map.route.go")
  // ✕ clear-course (only while a USER course is set).
  const routeClear = document.createElement("button")
  routeClear.type = "button"
  routeClear.className = "wp-map-route-clear"
  routeClear.setAttribute("aria-label", mt("map.course.clear"))
  routeClear.innerHTML = "&#10005;"
  routeClear.hidden = true
  routeClear.addEventListener("click", (e) => {
    e.stopPropagation()
    opts.nav?.clearCourse()
  })
  routeStrip.append(routeText, routeGo, routeClear)
  wrap.appendChild(routeStrip)
  // "Go": frame the player→destination leg (recenter between them, sensible zoom).
  let routeGoPending = false
  routeGo.addEventListener("click", () => {
    routeGoPending = true
  })

  // ── "No quest" toggle (free-explore mode) — only when nav is wired. ─────────────
  if (opts.nav) {
    const nav = opts.nav
    const questToggle = document.createElement("button")
    questToggle.type = "button"
    questToggle.className = "wp-map-questtoggle"
    const syncToggle = () => {
      const on = nav.isQuestActive()
      questToggle.textContent = on ? mt("map.quest.on") : mt("map.quest.off")
      questToggle.setAttribute("aria-pressed", on ? "true" : "false")
      questToggle.classList.toggle("wp-map-questtoggle--off", !on)
    }
    questToggle.addEventListener("click", () => {
      nav.setQuestActive(!nav.isQuestActive())
      syncToggle()
    })
    syncToggle()
    tools.appendChild(questToggle)
  }

  const legend = buildLegend(opts.view, accent, mt)
  if (legend) wrap.appendChild(legend)

  const note = document.createElement("div")
  note.className = "wp-map-note"
  wrap.appendChild(note)

  host.appendChild(wrap)

  // Precompute which POIs get a TEXT label. Many topologies bunch dozens of
  // generic perimeter stalls/doors at the walls; labelling them all is noise. We
  // label an anchor only when it carries a meaningful name — i.e. it has a typed
  // `kind` (a deliberate gameplay POI) OR the caller's `anchorName` returns a
  // custom name (distinct from the prettified id fallback). All significant POIs
  // still get a coloured DOT (drawPois); only the labels are curated.
  const labelledPois = opts.view.topology.anchors
    .map((a) => ({ a, cat: categoryOf(a) }))
    .filter((p) => LEGEND_ORDER.includes(p.cat))
    .filter((p) => {
      if (p.a.kind) return true
      const named = anchorName(p.a.id)
      return named !== prettyAnchor(p.a.id)
    })

  // ── ZOOM + PAN (#35) ───────────────────────────────────────────────────────
  // zoom 1 = fit the whole city; >1 zooms in around (panX,panZ). Pinch + the +/−
  // buttons drive `zoom`; dragging pans. The base (zoom-1) view stays the
  // fit-to-city projection so a bigger city still opens framed.
  const ext = contentExtent(opts.view.topology)
  const cityCx = (ext.minX + ext.maxX) / 2
  const cityCz = (ext.minZ + ext.maxZ) / 2
  const cityHalf = Math.max(1, Math.max(ext.maxX - ext.minX, ext.maxZ - ext.minZ) / 2)
  const ZOOM_MIN = 1
  const ZOOM_MAX = 8
  let zoom = 1
  let panX = cityCx
  let panZ = cityCz
  const clampPan = () => {
    // keep the centre inside the city so you can't pan into empty space.
    const half = cityHalf / zoom
    panX = Math.max(ext.minX + half * 0.4, Math.min(ext.maxX - half * 0.4, panX))
    panZ = Math.max(ext.minZ + half * 0.4, Math.min(ext.maxZ - half * 0.4, panZ))
  }
  const projForFrame = (cssW: number, cssH: number): Projection => {
    if (zoom <= 1.001) return fitProjection(opts.view.topology, cssW, cssH, 18)
    clampPan()
    return centeredProjection(panX, panZ, cityHalf / zoom, cssW, cssH, 18)
  }
  const setZoom = (z: number, focusX = panX, focusZ = panZ) => {
    const nz = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z))
    if (nz === zoom) return
    // keep the focus point stationary on screen as we zoom.
    panX = focusX
    panZ = focusZ
    zoom = nz
    if (zoom <= 1.001) {
      panX = cityCx
      panZ = cityCz
    }
    clampPan()
  }

  // +/− zoom buttons (corner of the stage). pointer-events on, so they sit above
  // the pan surface. Styled inline to avoid a stylesheet dependency.
  const zoomBox = document.createElement("div")
  zoomBox.style.cssText =
    "position:absolute;right:10px;bottom:10px;display:flex;flex-direction:column;gap:6px;z-index:4;pointer-events:auto"
  const mkBtn = (label: string, on: () => void) => {
    const b = document.createElement("button")
    b.type = "button"
    b.textContent = label
    b.setAttribute("aria-label", label === "+" ? "Zoom in" : "Zoom out")
    b.style.cssText =
      "width:34px;height:34px;border-radius:9px;border:1px solid rgba(90,74,50,.25);" +
      "background:rgba(255,250,240,.92);color:#5a4a32;font:600 18px/1 ui-sans-serif,system-ui;" +
      "cursor:pointer;box-shadow:0 1px 3px rgba(40,28,12,.18);touch-action:manipulation"
    // `click` (not pointerdown) so it fires once across mouse/touch/keyboard and
    // is robust to synthetic events; pointerdown stops the stage pan from grabbing
    // the gesture under the button.
    b.addEventListener("pointerdown", (e) => e.stopPropagation())
    b.addEventListener("click", (e) => {
      e.stopPropagation()
      e.preventDefault()
      on()
    })
    return b
  }
  /** Recenter on the player: pan to their live world pos at a comfortable zoom. */
  const recenterOnPlayer = () => {
    let pos
    try {
      pos = opts.view.getPlayerPos()
    } catch {
      pos = null
    }
    if (!pos) return
    panX = pos.x
    panZ = pos.z
    zoom = Math.max(zoom, 2.2)
    clampPan()
  }
  // ◎ recenter-on-me (top of the control stack), then +/− zoom.
  const recenterBtn = mkBtn("◎", () => recenterOnPlayer())
  recenterBtn.setAttribute("aria-label", mt("map.recenter"))
  recenterBtn.title = mt("map.recenter")
  zoomBox.appendChild(recenterBtn)
  zoomBox.appendChild(mkBtn("+", () => setZoom(zoom * 1.5)))
  zoomBox.appendChild(mkBtn("−", () => setZoom(zoom / 1.5)))
  stage.appendChild(zoomBox)

  // Wheel zoom (desktop) + pinch zoom + drag-pan (touch/mouse) on the stage.
  const stagePoint = (clientX: number, clientY: number) => {
    const r = stage.getBoundingClientRect()
    return { sx: clientX - r.left, sy: clientY - r.top }
  }
  // screen → world (invert the active projection so a pinch/drag keeps the point
  // under the fingers). Rebuilt per gesture from the current frame projection.
  const screenToWorld = (sx: number, sy: number): { x: number; z: number } => {
    const cssW = stage.clientWidth || 600
    const cssH = stage.clientHeight || 360
    const proj = projForFrame(cssW, cssH)
    // toScreen: sx = ox + (x - ax)*scale ; sy = oy + (bz - z)*scale (north-up).
    // invert via two probe points to recover the affine mapping cheaply.
    const o = proj.toScreen(0, 0)
    const ux = proj.toScreen(1, 0)
    const uz = proj.toScreen(0, 1)
    const dxds = ux.x - o.x // screen-x per world-x
    const dzds = uz.y - o.y // screen-y per world-z
    const x = dxds !== 0 ? (sx - o.x) / dxds : panX
    const z = dzds !== 0 ? (sy - o.y) / dzds : panZ
    return { x, z }
  }
  const onWheel = (e: WheelEvent) => {
    e.preventDefault()
    const { sx, sy } = stagePoint(e.clientX, e.clientY)
    const w = screenToWorld(sx, sy)
    setZoom(zoom * (e.deltaY < 0 ? 1.18 : 1 / 1.18), w.x, w.z)
  }
  stage.addEventListener("wheel", onWheel, { passive: false })

  // pointer-based pinch + drag-pan.
  const pointers = new Map<number, { x: number; y: number }>()
  let pinchStartDist = 0
  let pinchStartZoom = 1
  let dragLast: { x: number; z: number } | null = null
  const onDown = (e: PointerEvent) => {
    // Tap-away: a pointerdown that reaches the stage (pins + popover stop their own
    // propagation) dismisses any open popover (Google-Maps "tap the map to close").
    if (popover.isOpen()) popover.hide()
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.size === 1) {
      const { sx, sy } = stagePoint(e.clientX, e.clientY)
      dragLast = screenToWorld(sx, sy)
    } else if (pointers.size === 2) {
      const pts = [...pointers.values()]
      pinchStartDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1
      pinchStartZoom = zoom
      dragLast = null
    }
  }
  const onMove = (e: PointerEvent) => {
    if (!pointers.has(e.pointerId)) return
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.size === 2) {
      const pts = [...pointers.values()]
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1
      // midpoint world anchor so the pinch zooms about the fingers.
      const mid = stagePoint((pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2)
      const w = screenToWorld(mid.sx, mid.sy)
      setZoom(pinchStartZoom * (d / pinchStartDist), w.x, w.z)
    } else if (pointers.size === 1 && dragLast && zoom > 1.001) {
      const { sx, sy } = stagePoint(e.clientX, e.clientY)
      const now = screenToWorld(sx, sy)
      panX += dragLast.x - now.x
      panZ += dragLast.z - now.z
      clampPan()
      // re-read under the new pan so the grabbed point tracks the finger.
      dragLast = screenToWorld(sx, sy)
    }
  }
  const onUp = (e: PointerEvent) => {
    pointers.delete(e.pointerId)
    if (pointers.size < 2) pinchStartDist = 0
    if (pointers.size === 0) dragLast = null
  }
  stage.style.touchAction = "none"
  stage.addEventListener("pointerdown", onDown)
  stage.addEventListener("pointermove", onMove)
  stage.addEventListener("pointerup", onUp)
  stage.addEventListener("pointercancel", onUp)

  let raf = 0
  let phase = 0
  let lastT = typeof performance !== "undefined" ? performance.now() : Date.now()
  let alive = true
  let latestPois: PlottedPoi[] = []
  /** Reusable pin buttons keyed by anchor id (rebuilt sparingly — see below). */
  const pinBtns = new Map<string, HTMLButtonElement>()

  /** Sync the focusable pin buttons to the current plotted POIs (#111). */
  const syncPins = (pois: PlottedPoi[]) => {
    const seen = new Set<string>()
    for (const p of pois) {
      seen.add(p.id)
      let btn = pinBtns.get(p.id)
      if (!btn) {
        btn = document.createElement("button")
        btn.type = "button"
        btn.className = "wp-map-pin"
        btn.dataset.anchor = p.id
        btn.addEventListener("click", (e) => {
          e.stopPropagation()
          // toggle: re-tapping the open pin closes the popover.
          if (popover.current() === p.id) popover.hide()
          else openPopoverFor(latestPois.find((q) => q.id === p.id) ?? p)
        })
        pinBtns.set(p.id, btn)
        pinLayer.appendChild(btn)
      }
      btn.setAttribute("aria-label", `${anchorName(p.id)} — ${typeLabel(p.cat)}`)
      btn.style.left = `${p.sx}px`
      btn.style.top = `${p.sy}px`
      btn.classList.toggle("wp-map-pin--course", opts.nav?.getCourse() === p.id)
    }
    // drop buttons whose POI is no longer plotted (e.g. filtered out).
    for (const [id, btn] of pinBtns) {
      if (!seen.has(id)) {
        btn.remove()
        pinBtns.delete(id)
      }
    }
  }

  function frame(): void {
    if (!alive) return
    try {
      const cssW = stage.clientWidth || 600
      const cssH = stage.clientHeight || 360
      const ctx = prepCanvas(canvas, cssW, cssH)
      if (ctx) {
        const proj = projForFrame(cssW, cssH)
        drawBase(ctx, opts.view.topology, proj, cssW, cssH, true, opts.view.getMapGeometry?.())
        // Maps-app filter: when a chip/search narrows focus, non-matching POIs ghost.
        const useFilter = filterActive()
        latestPois = drawPois(ctx, opts.view.topology, proj, true, useFilter ? poiPasses : undefined)
        // Keep the focusable pin buttons + the open popover in sync with the pins.
        syncPins(latestPois)
        if (popover.isOpen()) {
          const cur = latestPois.find((p) => p.id === popover.current())
          if (cur) popover.reposition(cur.sx, cur.sy)
          else popover.hide() // its pin scrolled off / got filtered → dismiss
        }

        if (!reduced) {
          const now = typeof performance !== "undefined" ? performance.now() : Date.now()
          const dt = Math.min(0.1, (now - lastT) / 1000)
          lastT = now
          phase = (phase + dt / 1.6) % 1
        }
        const qmarkers = drawQuestMarkers(ctx, opts.view, proj, true, {
          accent,
          detail: true,
          pulse: !reduced,
          pulsePhase: phase,
        })
        const remotes = drawRemotes(ctx, opts.view, proj, true)
        const player = drawPlayer(ctx, opts.view, proj, true, accent)

        // #72 wayfinding: a "go here" cue from the player toward the active
        // objective. Suppressed in "No quest" mode or when a user course overrides
        // it (the course leader draws below instead).
        const obj = qmarkers.find((m) => m.kind === "objective")
        const objActive = (opts.nav ? opts.nav.isQuestActive() : true) && !opts.nav?.getCourse()
        if (obj && objActive) drawWayfinding(ctx, player.sx, player.sy, obj.sx, obj.sy, cssW, cssH, true)

        // ── ROUTE STRIP destination = the USER COURSE (tapped a POI's Route/Go), else
        //   the quest OBJECTIVE while quests are active. ───────────────────────────
        const courseId = opts.nav?.getCourse() ?? null
        const questActive = opts.nav ? opts.nav.isQuestActive() : true
        const destId = courseId ?? (questActive && obj ? obj.anchorId : null)
        if (destId) {
          let pPos
          try {
            pPos = opts.view.getPlayerPos()
          } catch {
            pPos = null
          }
          const destAnchor = opts.view.topology.anchors.find((a) => a.id === destId)
          if (pPos && destAnchor) {
            const dx = destAnchor.x - pPos.x
            const dz = destAnchor.z - pPos.z
            const dist = Math.round(Math.hypot(dx, dz))
            if (courseId) {
              const s = proj.toScreen(destAnchor.x, destAnchor.z)
              drawWayfinding(ctx, player.sx, player.sy, s.x, s.y, cssW, cssH, true)
            }
            routeText.innerHTML =
              `<span class="wp-map-route-to">${escapeHtml(mt("map.route", { place: anchorName(destId) }))}</span>` +
              `<span class="wp-map-route-dist">${escapeHtml(mt("map.route.distance", { dist }))}</span>`
            routeStrip.hidden = false
            routeClear.hidden = !courseId
            // Consume a pending "Go": center between player + destination, sane zoom.
            if (routeGoPending) {
              routeGoPending = false
              panX = (pPos.x + destAnchor.x) / 2
              panZ = (pPos.z + destAnchor.z) / 2
              const span = Math.max(40, Math.hypot(dx, dz))
              zoom = Math.max(1.4, Math.min(ZOOM_MAX, (cityHalf / span) * 1.1))
              clampPan()
            }
          } else {
            routeStrip.hidden = true
          }
        } else {
          routeStrip.hidden = true
          routeGoPending = false
        }

        // Floated labels (rebuild each frame — cheap, dozens of nodes). Honor the
        // filter so labels match the visible (un-ghosted) POIs.
        renderTags(tagLayer, {
          mt,
          accent,
          labelledPois: labelledPois
            .filter(({ a, cat }) => !useFilter || poiPasses(cat, a))
            .map(({ a, cat }) => {
              const s = proj.toScreen(a.x, a.z)
              return { a, cat, sx: s.x, sy: s.y }
            }),
          remotes,
          qmarkers,
          player,
          anchorName,
          itemName,
        })

        // Honest note: solo / empty.
        const remoteCount = remotes.length
        note.textContent = remoteCount === 0 ? mt("map.solo") : ""
        note.hidden = remoteCount !== 0
      }
    } catch (err) {
      console.error(`${LOG} frame failed:`, err)
    }
    raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)

  // Esc closes an open popover FIRST (capture, so it resolves before the modal's own
  // Esc-to-close). Only when the popover is closed does Esc fall through to the modal.
  const onPopoverEsc = (e: KeyboardEvent) => {
    if (e.key === "Escape" && popover.isOpen()) {
      e.preventDefault()
      e.stopPropagation()
      popover.hide()
    }
  }
  document.addEventListener("keydown", onPopoverEsc, true)

  return {
    el: wrap,
    dispose() {
      alive = false
      if (raf) cancelAnimationFrame(raf)
      raf = 0
      try {
        document.removeEventListener("keydown", onPopoverEsc, true)
        popover.dispose()
        stage.removeEventListener("wheel", onWheel)
        stage.removeEventListener("pointerdown", onDown)
        stage.removeEventListener("pointermove", onMove)
        stage.removeEventListener("pointerup", onUp)
        stage.removeEventListener("pointercancel", onUp)
        wrap.remove()
      } catch (err) {
        console.error(`${LOG} dispose failed:`, err)
      }
    },
  }
}

interface TagCtx {
  mt: MapT
  accent: string
  labelledPois: Array<{ a: Anchor; cat: PoiCategory; sx: number; sy: number }>
  remotes: PlottedRemote[]
  qmarkers: PlottedQuestMarker[]
  player: { sx: number; sy: number }
  anchorName: (id: string) => string
  itemName: (id: string) => string
}

/** A placement candidate, in priority order (high → low). Lower-priority tags
 * that would overlap an already-placed one are dropped (declutter). */
interface TagCandidate {
  text: string
  sx: number
  sy: number
  /** vertical offset of the pill from the marker (px; negative = above). */
  dy: number
  cls: string
  /** higher = placed first / never dropped. */
  prio: number
}

/** ~rough pill rect (we don't measure text — approximate from length). */
function pillRect(t: TagCandidate): { x: number; y: number; w: number; h: number } {
  const w = Math.min(150, 18 + t.text.length * 6.6)
  const h = 18
  // pill is centred on sx and floated above sy by ~135% + dy.
  return { x: t.sx - w / 2, y: t.sy + t.dy - h, w, h }
}
function overlaps(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

function renderTags(layer: HTMLElement, c: TagCtx): void {
  layer.replaceChildren()
  const objectiveMarkers = c.qmarkers.filter((m) => m.kind === "objective")
  const labelled = new Set(c.labelledPois.map((p) => p.a.id))

  // Build candidates in priority order. We only label what MATTERS — the
  // objective + source hints, YOU, then named specials / key POIs, then a
  // capped set of nearby travellers — and drop any lower-priority pill that
  // would overlap one already placed (no more crowded, redundant pills).
  const cands: TagCandidate[] = []

  // 1) YOU (always, top priority).
  cands.push({
    text: c.mt("map.you"),
    sx: c.player.sx,
    sy: c.player.sy,
    dy: -10,
    cls: "wp-map-tag wp-map-tag--player",
    prio: 100,
  })

  // 2) Objective (always — "go here" must be readable).
  for (const m of objectiveMarkers) {
    cands.push({
      text: c.anchorName(m.anchorId),
      sx: m.sx,
      sy: m.sy,
      dy: -12,
      cls: "wp-map-tag wp-map-tag--objective",
      prio: 95,
    })
  }

  // 3) Source hints ("Find {item}") — point at where the item is.
  for (const m of c.qmarkers) {
    if (m.kind !== "source-hint" || !m.itemId) continue
    cands.push({
      text: c.mt("map.findItem", { item: c.itemName(m.itemId) }),
      sx: m.sx,
      sy: m.sy,
      dy: 26, // below the droplet, so it doesn't fight the marker
      cls: "wp-map-tag wp-map-tag--hint",
      prio: 80,
    })
  }

  // #111 GOOGLE-MAPS DECLUTTER: only YOU + the active objective (+ source hints)
  // stay LABELLED on the canvas. Named-POI pills + traveller-name pills are GONE —
  // they overlapped into illegible mush. POI names are now TAP-TO-REVEAL via the
  // pin popover (clean pins + one popover at a time). The markers themselves still
  // draw for every POI/traveller; only the always-on text is removed.
  void labelled
  void c.labelledPois
  void c.remotes
  void c.anchorName

  // Place high→low; drop lower-priority pills that collide with placed ones.
  cands.sort((a, b) => b.prio - a.prio)
  const placed: Array<{ x: number; y: number; w: number; h: number }> = []
  for (const cand of cands) {
    const rect = pillRect(cand)
    // Always place the top-tier anchors (You/objective/hint); declutter the rest.
    const mustPlace = cand.prio >= 80
    if (!mustPlace && placed.some((r) => overlaps(rect, r))) continue
    placed.push(rect)
    const tag = document.createElement("div")
    tag.className = cand.cls
    tag.style.left = `${cand.sx}px`
    tag.style.top = `${cand.sy + cand.dy}px`
    tag.textContent = cand.text
    layer.appendChild(tag)
  }
}

/**
 * Build the legend. Each item's swatch is a tiny CANVAS painted with the EXACT
 * marker shape+colour (via `drawMarker`), so the key and the dots share one
 * source of truth (MARKER_STYLES) and can never drift. We always show You /
 * Objective / Travellers, then one row per POI category actually present.
 */
function buildLegend(view: MapView, accent: string, mt: MapT): HTMLElement | null {
  const present = new Set<PoiCategory>()
  for (const a of view.topology.anchors) {
    const cat = categoryOf(a)
    if (LEGEND_ORDER.includes(cat)) present.add(cat)
  }
  const legend = document.createElement("div")
  legend.className = "wp-map-legend"

  // Always-present actors first (the player wedge takes the accent colour).
  legend.appendChild(legendItem({ ...MARKER_STYLES.player, color: accent }, mt("map.you"), accent))
  legend.appendChild(legendItem(MARKER_STYLES.objective, mt("map.objective"), accent))
  legend.appendChild(legendItem(MARKER_STYLES.traveller, mt("map.players"), accent))

  // One legend row per POI category present in the topology.
  for (const cat of LEGEND_ORDER) {
    if (!present.has(cat)) continue
    const style = markerStyleForCat(cat)
    legend.appendChild(legendItem(style, mt(style.labelKey), accent))
  }
  return legend
}

function legendItem(style: MarkerStyle, label: string, accent: string): HTMLElement {
  const item = document.createElement("span")
  item.className = "wp-map-legend-item"
  const sw = document.createElement("canvas")
  sw.className = "wp-map-swatch"
  const size = 15
  const dpr = Math.min(3, Math.max(1, (typeof window !== "undefined" && window.devicePixelRatio) || 1))
  sw.width = Math.round(size * dpr)
  sw.height = Math.round(size * dpr)
  const ctx = sw.getContext("2d")
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    if (style.shape === "wedge") {
      // The player wedge: a small upward accent arrow (matches drawPlayer).
      ctx.fillStyle = accent
      ctx.lineJoin = "round"
      ctx.lineWidth = 1.4
      ctx.strokeStyle = "rgba(255,255,255,0.95)"
      ctx.beginPath()
      ctx.moveTo(size / 2, 2)
      ctx.lineTo(size - 3, size - 3)
      ctx.lineTo(3, size - 3)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    } else {
      drawMarker(ctx, size / 2, size / 2, 5, style, false)
    }
  }
  const text = document.createElement("span")
  text.textContent = label
  item.append(sw, text)
  return item
}

function prettyAnchor(id: string): string {
  return id
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
    .trim()
}

/** Minimal HTML escaper for the few innerHTML spots (route strip). */
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  )
}

/* ============================================================ overlay modal */

export interface FullMapModalHandle {
  isOpen(): boolean
  open(): void
  close(): void
  dispose(): void
}

/**
 * Open the full map as an in-`.wp-overlay` modal (from a minimap tap, etc.).
 * Mounts INSIDE `parent` (the overlay), NOT `document.body`.
 */
export function openFullMap(
  parent: HTMLElement,
  opts: FullMapOptions & { onClose?: () => void },
): FullMapModalHandle {
  ensureMapStyles()
  const accent = opts.accent ?? "#c46b4a"
  const mt: MapT = createMapT(opts.t, opts.lang ?? "en")

  let root: HTMLElement | null = null
  let render: RenderHandle | null = null
  let open = false
  let escKey: ((e: KeyboardEvent) => void) | null = null

  function build(): HTMLElement {
    const el = document.createElement("div")
    el.className = "wp-map"
    el.style.setProperty("--wp-map-accent", accent)
    const scrim = document.createElement("div")
    scrim.className = "wp-map-scrim"
    const panel = document.createElement("div")
    panel.className = "wp-map-panel"
    panel.setAttribute("role", "dialog")
    panel.setAttribute("aria-modal", "true")
    panel.setAttribute("aria-label", mt("map.title"))
    const head = document.createElement("div")
    head.className = "wp-map-head"
    const title = document.createElement("div")
    title.className = "wp-map-title"
    title.textContent = mt("map.title")
    const close = document.createElement("button")
    close.type = "button"
    close.className = "wp-map-close"
    close.setAttribute("aria-label", mt("map.close"))
    close.textContent = "✕"
    head.append(title, close)
    panel.appendChild(head)
    el.append(scrim, panel)

    // Swallow pointer gestures so a tap can't leak to the world joystick.
    const swallow = (e: Event) => e.stopPropagation()
    el.addEventListener("pointerdown", swallow)
    el.addEventListener("pointerup", swallow)
    scrim.addEventListener("click", () => handle.close())
    close.addEventListener("click", () => handle.close())

    render = renderFullMap(panel, opts)
    return el
  }

  const handle: FullMapModalHandle = {
    isOpen: () => open,
    open() {
      if (open) return
      open = true
      root = build()
      parent.appendChild(root)
      requestAnimationFrame(() => root?.classList.add("wp-map--open"))
      escKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault()
          e.stopPropagation()
          handle.close()
        }
      }
      document.addEventListener("keydown", escKey, true)
    },
    close() {
      if (!open) return
      open = false
      if (escKey) {
        document.removeEventListener("keydown", escKey, true)
        escKey = null
      }
      try {
        render?.dispose()
      } catch (err) {
        console.error(`${LOG} render dispose threw:`, err)
      }
      render = null
      const el = root
      root = null
      el?.classList.remove("wp-map--open")
      window.setTimeout(() => el?.remove(), 220)
      try {
        opts.onClose?.()
      } catch (err) {
        console.error(`${LOG} onClose threw:`, err)
      }
    },
    dispose() {
      if (escKey) {
        document.removeEventListener("keydown", escKey, true)
        escKey = null
      }
      try {
        render?.dispose()
      } catch (err) {
        console.error(`${LOG} render dispose (dispose) threw:`, err)
      }
      render = null
      root?.remove()
      root = null
      open = false
    },
  }
  return handle
}

/* ====================================================== menu section factory */

/**
 * A `MenuSectionView` for the menu's Map tab: renders the SAME full-map content
 * into the menu body the panel hands it (the menu owns the surrounding chrome).
 * Returns the cleanup the menu calls on tab-switch/close.
 *
 * Hand this to `createMenuPanel({ sections: { map: createMapSection(opts) } })`.
 */
export function createMapSection(
  opts: FullMapOptions,
): (body: HTMLElement) => () => void {
  return (body: HTMLElement) => {
    // The menu body is a plain block; give the map a stage to fill.
    body.style.display = "flex"
    body.style.flexDirection = "column"
    body.style.minHeight = "300px"
    const render = renderFullMap(body, opts)
    return () => {
      try {
        render.dispose()
      } catch (err) {
        console.error(`${LOG} section dispose threw:`, err)
      }
      body.style.removeProperty("display")
      body.style.removeProperty("flex-direction")
      body.style.removeProperty("min-height")
    }
  }
}
