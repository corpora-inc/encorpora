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
} from "./schematic"

const LOG = "[wp/fullMap]"

export interface FullMapOptions {
  view: MapView
  accent?: string
  t?: Translate
  lang?: string
  /** Resolve an anchor id → a friendly POI name ("the boatman", "Serafina"). */
  anchorName?: (anchorId: string) => string
  /** Resolve an item id → a friendly label (for source-hint tags). */
  itemName?: (itemId: string) => string
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
function renderFullMap(host: HTMLElement, opts: FullMapOptions): RenderHandle {
  ensureMapStyles()
  const accent = opts.accent ?? "#c46b4a"
  const mt: MapT = createMapT(opts.t, opts.lang ?? "en")
  const anchorName = opts.anchorName ?? prettyAnchor
  const itemName = opts.itemName ?? ((id: string) => id)
  const reduced =
    typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches

  const wrap = document.createElement("div")
  wrap.className = "wp-map-content"
  wrap.style.display = "flex"
  wrap.style.flexDirection = "column"
  wrap.style.minHeight = "0"
  wrap.style.flex = "1 1 auto"

  const stage = document.createElement("div")
  stage.className = "wp-map-stage"
  const canvas = document.createElement("canvas")
  canvas.className = "wp-map-canvas"
  stage.appendChild(canvas)
  wrap.appendChild(stage)

  // A layer for floated text tags (POI names, player, objective).
  const tagLayer = document.createElement("div")
  tagLayer.style.position = "absolute"
  tagLayer.style.inset = "0"
  tagLayer.style.pointerEvents = "none"
  stage.appendChild(tagLayer)

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

  function frame(): void {
    if (!alive) return
    try {
      const cssW = stage.clientWidth || 600
      const cssH = stage.clientHeight || 360
      const ctx = prepCanvas(canvas, cssW, cssH)
      if (ctx) {
        const proj = projForFrame(cssW, cssH)
        drawBase(ctx, opts.view.topology, proj, cssW, cssH, true, opts.view.getMapGeometry?.())
        drawPois(ctx, opts.view.topology, proj, true)

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
        // objective (dashed leader, or an edge arrow when it's off-screen).
        const obj = qmarkers.find((m) => m.kind === "objective")
        if (obj) drawWayfinding(ctx, player.sx, player.sy, obj.sx, obj.sy, cssW, cssH, true)

        // Floated labels (rebuild each frame — cheap, dozens of nodes).
        renderTags(tagLayer, {
          mt,
          accent,
          labelledPois: labelledPois.map(({ a, cat }) => {
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

  return {
    el: wrap,
    dispose() {
      alive = false
      if (raf) cancelAnimationFrame(raf)
      raf = 0
      try {
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
  const objectiveAnchors = new Set(objectiveMarkers.map((m) => m.anchorId))
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

  // 4) Named specials / key POIs (curated set; objective ones already covered).
  for (const p of c.labelledPois) {
    if (objectiveAnchors.has(p.a.id)) continue
    cands.push({
      text: c.anchorName(p.a.id),
      sx: p.sx,
      sy: p.sy,
      dy: -10,
      cls: "wp-map-tag",
      prio: 60,
    })
  }
  void labelled

  // 5) Travellers — only the NAMED few; cap so a packed room doesn't drown the
  // map in name pills (the markers themselves still show every traveller).
  const TRAVELLER_LABEL_CAP = 5
  for (const r of c.remotes.slice(0, TRAVELLER_LABEL_CAP)) {
    cands.push({
      text: r.name,
      sx: r.sx,
      sy: r.sy,
      dy: -9,
      cls: "wp-map-tag",
      prio: 30,
    })
  }

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
