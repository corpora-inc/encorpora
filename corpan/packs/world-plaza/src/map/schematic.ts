/**
 * schematic — the shared 2D paint of the topology + live actors, used by BOTH
 * the corner minimap and the full-screen map. It is a stylized paper schematic
 * (premium + cheap); a 3D upgrade can slot in behind the same `MapView` seam
 * later with no consumer change (COHESION_ITERATION §4.3).
 *
 * Pure canvas drawing from the `MapView` bundle + a `Projection`. No DOM, no
 * state, no other-slice internals.
 */

import type { RoomTopology, Anchor } from "@world-plaza/contracts"
import type { MapView, MapGeometry } from "../contracts/runtime"
import {
  PALETTE,
  type Projection,
  categoryOf,
  markerStyleForCat,
  MARKER_STYLES,
  SIGNIFICANT,
  plotMarkers,
  headingVec,
  contentExtent,
  type PoiCategory,
  type MarkerShape,
  type MarkerStyle,
} from "./mapCore"

export interface SchematicOpts {
  /** accent for the player marker. */
  accent: string
  /** larger detail (labels-ready dots, thicker player) for the full map. */
  detail: boolean
  /** draw the current-objective pulse ring (skip under reduced motion). */
  pulse: boolean
  /** pulse phase 0..1 (driven by the caller's clock; ignored if !pulse). */
  pulsePhase?: number
}

/** Draw the static layer (paper, bounds, blockers, faint POIs). Cheap to redraw. */
export function drawBase(
  ctx: CanvasRenderingContext2D,
  topology: RoomTopology,
  proj: Projection,
  cssW: number,
  cssH: number,
  detail: boolean,
  geometry?: MapGeometry,
): void {
  ctx.clearRect(0, 0, cssW, cssH)

  // Ground card.
  const { x, y, w, h } = proj.inset
  ctx.fillStyle = PALETTE.ground
  roundRect(ctx, x, y, w, h, detail ? 10 : 6)
  ctx.fill()

  // A faint grid for paper texture / scale legibility.
  ctx.save()
  roundRect(ctx, x, y, w, h, detail ? 10 : 6)
  ctx.clip()

  // WATER (#35): open river/coast filled UNDER the grid + blockers, so the player
  // can read where land ends. Drawn before the grid so grid lines tint it subtly.
  if (geometry && geometry.water.length) {
    ctx.fillStyle = PALETTE.water
    ctx.strokeStyle = PALETTE.waterEdge
    ctx.lineWidth = detail ? 1.5 : 1
    for (const wr of geometry.water) {
      const p0 = proj.toScreen(wr.x0, wr.z0)
      const p1 = proj.toScreen(wr.x1, wr.z1)
      const rx = Math.min(p0.x, p1.x)
      const ry = Math.min(p0.y, p1.y)
      const rw = Math.abs(p1.x - p0.x)
      const rh = Math.abs(p1.y - p0.y)
      ctx.fillRect(rx, ry, rw, rh)
      if (detail) ctx.strokeRect(rx, ry, rw, rh)
    }
  }
  ctx.strokeStyle = PALETTE.groundLine
  ctx.globalAlpha = detail ? 0.5 : 0.35
  ctx.lineWidth = 1
  // Grid spans the fitted CONTENT extent (not the huge nominal bounds), so the
  // lines actually fall inside the drawn card.
  const ext = contentExtent(topology)
  const step = niceGrid(ext.maxX - ext.minX)
  for (let gx = Math.ceil(ext.minX / step) * step; gx <= ext.maxX; gx += step) {
    const p0 = proj.toScreen(gx, ext.minZ)
    const p1 = proj.toScreen(gx, ext.maxZ)
    line(ctx, p0.x, p0.y, p1.x, p1.y)
  }
  for (let gz = Math.ceil(ext.minZ / step) * step; gz <= ext.maxZ; gz += step) {
    const p0 = proj.toScreen(ext.minX, gz)
    const p1 = proj.toScreen(ext.maxX, gz)
    line(ctx, p0.x, p0.y, p1.x, p1.y)
  }
  ctx.globalAlpha = 1

  // Blockers / building footprints (faint). Prefer the supplied map geometry
  // (the city's real building footprints, #35) when present; else fall back to the
  // contract `topology.blockers`. Both render as soft rounded rects.
  ctx.fillStyle = PALETTE.blocker
  ctx.strokeStyle = PALETTE.blockerEdge
  ctx.lineWidth = 1
  const drawBlk = (cx: number, cy: number, bw: number, bh: number) => {
    ctx.globalAlpha = 0.55
    roundRect(ctx, cx - bw / 2, cy - bh / 2, bw, bh, 2)
    ctx.fill()
    ctx.globalAlpha = 0.8
    ctx.stroke()
  }
  if (geometry && geometry.blockers.length) {
    for (const b of geometry.blockers) {
      const p0 = proj.toScreen(b.x0, b.z0)
      const p1 = proj.toScreen(b.x1, b.z1)
      drawBlk((p0.x + p1.x) / 2, (p0.y + p1.y) / 2, Math.abs(p1.x - p0.x), Math.abs(p1.y - p0.y))
    }
  } else {
    for (const blk of topology.blockers) {
      const c = proj.toScreen(blk.x, blk.z)
      drawBlk(c.x, c.y, blk.w * proj.scale, blk.d * proj.scale)
    }
  }
  ctx.globalAlpha = 1
  ctx.restore()

  // Bounds frame.
  ctx.strokeStyle = PALETTE.groundLine
  ctx.lineWidth = detail ? 1.5 : 1
  roundRect(ctx, x, y, w, h, detail ? 10 : 6)
  ctx.stroke()
}

/** Draw POI dots (significant categories). Returns plotted POIs (for labels). */
export interface PlottedPoi {
  id: string
  cat: PoiCategory
  sx: number
  sy: number
}
export function drawPois(
  ctx: CanvasRenderingContext2D,
  topology: RoomTopology,
  proj: Projection,
  detail: boolean,
  /**
   * Optional Maps-app filter (search + category chips). When given, a POI whose
   * `(cat, anchor)` returns false is dimmed to a faint ghost instead of drawn at
   * full strength — so a filter narrows focus without hiding the city's shape.
   * Omitted ⇒ every marker draws normally (the minimap + legacy callers).
   */
  filter?: (cat: PoiCategory, a: Anchor) => boolean,
): PlottedPoi[] {
  const out: PlottedPoi[] = []
  // Bigger, shaped markers on the (now roomy) full map; compact on the minimap.
  const size = detail ? 8 : 4
  for (const a of topology.anchors) {
    const cat = categoryOf(a)
    const passes = !filter || filter(cat, a)
    if (!SIGNIFICANT.has(cat)) {
      // decor/bench/portal/spawn → a barely-there tick, not a categorical marker.
      if (!detail) continue
      const p = proj.toScreen(a.x, a.z)
      ctx.fillStyle = PALETTE.inkSoft
      ctx.globalAlpha = 0.26
      dot(ctx, p.x, p.y, 1.7)
      ctx.globalAlpha = 1
      continue
    }
    const p = proj.toScreen(a.x, a.z)
    const style = markerStyleForCat(cat)
    if (!passes) {
      // Filtered out: a faint ghost so the city shape stays, focus narrows.
      ctx.globalAlpha = 0.16
      drawMarker(ctx, p.x, p.y, size, style, detail)
      ctx.globalAlpha = 1
      continue
    }
    drawMarker(ctx, p.x, p.y, size, style, detail)
    out.push({ id: a.id, cat, sx: p.x, sy: p.y })
  }
  return out
}

/* ----------------------------------------------------------- shaped markers */
/**
 * Draw a typed marker (shape + fill + white halo + optional glyph). Shape — not
 * just hue — separates the categories, so the map reads even desaturated /
 * colour-blind (the owner's "7 types, 2 colours" critique). `size` is the
 * marker's nominal radius in CSS px.
 */
export function drawMarker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  style: MarkerStyle,
  detail: boolean,
): void {
  ctx.save()
  // Soft drop shadow lifts the marker off the paper (premium, subtle).
  if (detail) {
    ctx.shadowColor = "rgba(40,28,12,0.28)"
    ctx.shadowBlur = 3
    ctx.shadowOffsetY = 1
  }
  // A white halo gives every shape a crisp edge over busy ground. On the small
  // minimap (~108-168px) the markers read muddy with a thin halo, so thicken it
  // to 1.8 for cleaner separation (FAB_POLISH §4.6 / §1.3).
  ctx.lineJoin = "round"
  ctx.lineWidth = detail ? 2 : 1.8
  ctx.strokeStyle = "rgba(255,255,255,0.95)"
  ctx.fillStyle = style.color
  shapePath(ctx, style.shape, x, y, size)
  ctx.fill()
  ctx.shadowColor = "transparent"
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0
  ctx.stroke()
  ctx.restore()

  // Glyph (full map only, when the marker is large enough to read).
  if (detail && style.glyph) {
    ctx.save()
    ctx.fillStyle = "rgba(255,255,255,0.96)"
    ctx.font = `700 ${Math.round(size * 1.15)}px ui-sans-serif, system-ui, sans-serif`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    // nudge for the pin/droplet whose visual centre sits above the tip
    const gy = style.shape === "pin" ? y - size * 0.18 : style.shape === "droplet" ? y - size * 0.1 : y
    ctx.fillText(style.glyph, x, gy + 0.5)
    ctx.restore()
  }
}

/** Trace the marker's outline for the given shape (centred at x,y, radius r). */
function shapePath(
  ctx: CanvasRenderingContext2D,
  shape: MarkerShape,
  x: number,
  y: number,
  r: number,
): void {
  ctx.beginPath()
  switch (shape) {
    case "circle":
      ctx.arc(x, y, r, 0, Math.PI * 2)
      break
    case "square": {
      const s = r * 0.92
      const rr = Math.max(1, s * 0.28)
      roundRectPath(ctx, x - s, y - s, s * 2, s * 2, rr)
      break
    }
    case "diamond":
      ctx.moveTo(x, y - r * 1.18)
      ctx.lineTo(x + r * 1.04, y)
      ctx.lineTo(x, y + r * 1.18)
      ctx.lineTo(x - r * 1.04, y)
      ctx.closePath()
      break
    case "triangle": {
      const h = r * 1.2
      ctx.moveTo(x, y - h)
      ctx.lineTo(x + r * 1.05, y + h * 0.72)
      ctx.lineTo(x - r * 1.05, y + h * 0.72)
      ctx.closePath()
      break
    }
    case "star":
      starPath(ctx, x, y, r * 1.28, r * 0.56, 5)
      break
    case "pin": {
      // a teardrop "map pin": round top, pointed bottom tip.
      const rad = r
      ctx.arc(x, y - rad * 0.35, rad, Math.PI * 0.85, Math.PI * 0.15, false)
      ctx.lineTo(x, y + rad * 1.25)
      ctx.closePath()
      break
    }
    case "droplet": {
      // upright water droplet (rounded bottom, pointed top).
      const rad = r
      ctx.arc(x, y + rad * 0.32, rad, Math.PI * 1.85, Math.PI * 1.15, false)
      ctx.lineTo(x, y - rad * 1.3)
      ctx.closePath()
      break
    }
    case "wedge":
    default:
      ctx.arc(x, y, r, 0, Math.PI * 2)
      break
  }
}

function starPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  points: number,
): void {
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? outer : inner
    const ang = (Math.PI / points) * i - Math.PI / 2
    const px = cx + Math.cos(ang) * rad
    const py = cy + Math.sin(ang) * rad
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

/** Draw quest markers (objective + source hints) resolved to anchors. */
export interface PlottedQuestMarker {
  sx: number
  sy: number
  kind: "objective" | "source-hint"
  itemId?: string
  anchorId: string
}
export function drawQuestMarkers(
  ctx: CanvasRenderingContext2D,
  view: MapView,
  proj: Projection,
  detail: boolean,
  opts: SchematicOpts,
): PlottedQuestMarker[] {
  const out: PlottedQuestMarker[] = []
  let markers: ReturnType<typeof plotMarkers> = []
  try {
    markers = plotMarkers(view.topology, view.getQuestMarkers())
  } catch (err) {
    console.error("[wp/map] getQuestMarkers/plot failed:", err)
    markers = []
  }
  const objStyle = MARKER_STYLES.objective
  const hintStyle = MARKER_STYLES["source-hint"]
  for (const { marker, anchor } of markers) {
    const p = proj.toScreen(anchor.x, anchor.z)
    if (marker.kind === "objective") {
      // Gentle pulse ring on the active objective only (directs without nagging).
      if (opts.pulse) {
        const ph = (opts.pulsePhase ?? 0) % 1
        const baseR = detail ? 12 : 6
        ctx.strokeStyle = objStyle.color
        ctx.globalAlpha = (1 - ph) * 0.5
        ctx.lineWidth = 2
        ring(ctx, p.x, p.y, baseR + ph * (detail ? 18 : 10))
        ctx.globalAlpha = 1
      }
      // The vivid amber STAR — the unmistakable "go here". Raised to 6 on the
      // minimap so the objective stays legible at 108-168px (FAB_POLISH §4.6).
      drawMarker(ctx, p.x, p.y, detail ? 9 : 6, objStyle, detail)
    } else {
      // Source hint = a leaf-green DROPLET ("where to find the item").
      drawMarker(ctx, p.x, p.y, detail ? 7 : 4, hintStyle, detail)
    }
    out.push({ sx: p.x, sy: p.y, kind: marker.kind, itemId: marker.itemId, anchorId: marker.anchorId })
  }
  return out
}

/**
 * WAYFINDING (#72): a subtle "go here" cue from the player toward the active
 * objective so the owner knows which way to WALK. Two parts:
 *   - a dashed leader from the player toward the objective (when both are in view);
 *   - an EDGE ARROW pinned at the viewport rim pointing toward the objective when
 *     it's off-screen (the common case on the player-following minimap, and when
 *     zoomed in on the full map). This is what answers "where do I go?".
 * Drawn UNDER the player/objective markers (call before drawPlayer). Cheap: a few
 * line segments + one triangle, no allocations.
 */
export function drawWayfinding(
  ctx: CanvasRenderingContext2D,
  playerSx: number,
  playerSy: number,
  objSx: number,
  objSy: number,
  cssW: number,
  cssH: number,
  detail: boolean,
): void {
  const objColor = MARKER_STYLES.objective.color
  const dx = objSx - playerSx
  const dy = objSy - playerSy
  const dist = Math.hypot(dx, dy)
  if (dist < (detail ? 26 : 16)) return // already on top of it — no cue needed
  const ux = dx / dist
  const uy = dy / dist

  const margin = detail ? 16 : 10
  const objOnScreen =
    objSx >= margin && objSx <= cssW - margin && objSy >= margin && objSy <= cssH - margin

  ctx.save()
  if (objOnScreen) {
    // A dashed amber leader from just outside the player dot toward the objective,
    // stopping short of the star so it doesn't crowd it.
    const startGap = detail ? 12 : 7
    const endGap = detail ? 16 : 9
    ctx.strokeStyle = objColor
    ctx.globalAlpha = 0.42
    ctx.lineWidth = detail ? 2 : 1.4
    ctx.lineCap = "round"
    ctx.setLineDash(detail ? [6, 6] : [4, 4])
    ctx.beginPath()
    ctx.moveTo(playerSx + ux * startGap, playerSy + uy * startGap)
    ctx.lineTo(objSx - ux * endGap, objSy - uy * endGap)
    ctx.stroke()
    ctx.setLineDash([])
  } else {
    // Objective is off the rendered window: pin a "go here" arrow at the viewport
    // edge in its direction, so you can steer toward it even when it's not drawn.
    const cx = cssW / 2
    const cy = cssH / 2
    // intersect the ray (from centre, dir u) with the inset rectangle.
    const rx = cssW / 2 - margin
    const ry = cssH / 2 - margin
    const tx = ux !== 0 ? rx / Math.abs(ux) : Infinity
    const ty = uy !== 0 ? ry / Math.abs(uy) : Infinity
    const tEdge = Math.min(tx, ty)
    const ex = cx + ux * tEdge
    const ey = cy + uy * tEdge
    const ang = Math.atan2(uy, ux)
    const size = detail ? 11 : 7
    if (detail) {
      ctx.shadowColor = "rgba(40,28,12,0.3)"
      ctx.shadowBlur = 3
      ctx.shadowOffsetY = 1
    }
    ctx.translate(ex, ey)
    ctx.rotate(ang)
    ctx.fillStyle = objColor
    ctx.strokeStyle = "rgba(255,255,255,0.95)"
    ctx.lineJoin = "round"
    ctx.lineWidth = detail ? 2 : 1.4
    ctx.beginPath()
    ctx.moveTo(size, 0)
    ctx.lineTo(-size * 0.7, size * 0.82)
    ctx.lineTo(-size * 0.7, -size * 0.82)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }
  ctx.restore()
}

/** Remote players (soft dots). Returns plotted remotes (for labels on full map). */
export interface PlottedRemote {
  sx: number
  sy: number
  name: string
  playerId: string
}
export function drawRemotes(
  ctx: CanvasRenderingContext2D,
  view: MapView,
  proj: Projection,
  detail: boolean,
): PlottedRemote[] {
  const out: PlottedRemote[] = []
  let remotes: ReturnType<MapView["getRemotePositions"]> = []
  try {
    remotes = view.getRemotePositions()
  } catch (err) {
    console.error("[wp/map] getRemotePositions failed:", err)
    remotes = []
  }
  const style = MARKER_STYLES.traveller
  for (const r of remotes) {
    const p = proj.toScreen(r.pos.x, r.pos.z)
    // Indigo circle with a white pip centre — clearly "another person, not me".
    drawMarker(ctx, p.x, p.y, detail ? 6 : 3.4, style, detail)
    if (detail) {
      ctx.fillStyle = "rgba(255,255,255,0.95)"
      dot(ctx, p.x, p.y, 2)
    }
    out.push({ sx: p.x, sy: p.y, name: r.name, playerId: r.playerId })
  }
  return out
}

/** The local player: a heading wedge in the accent colour. */
export function drawPlayer(
  ctx: CanvasRenderingContext2D,
  view: MapView,
  proj: Projection,
  detail: boolean,
  accent: string,
): { sx: number; sy: number } {
  let pos
  try {
    pos = view.getPlayerPos()
  } catch {
    pos = { x: 0, z: 0, facing: 0 }
  }
  const p = proj.toScreen(pos.x, pos.z)
  const { dx, dz } = headingVec(pos.facing)
  const len = detail ? 16 : 9
  // The projection is north-up (+z → screen UP), so a world +z heading points to
  // screen -y: negate dz when turning the world heading into a SCREEN direction.
  const sdz = -dz
  const tipX = p.x + dx * len
  const tipY = p.y + sdz * len
  // Heading cone — a crisp white-haloed arrow so "you + where you face" pops.
  const ang = Math.atan2(sdz, dx)
  const spread = 0.52
  const back = detail ? 9 : 5.5
  ctx.save()
  if (detail) {
    ctx.shadowColor = "rgba(40,28,12,0.3)"
    ctx.shadowBlur = 3
    ctx.shadowOffsetY = 1
  }
  ctx.fillStyle = accent
  ctx.lineJoin = "round"
  ctx.lineWidth = detail ? 2 : 1.4
  ctx.strokeStyle = "rgba(255,255,255,0.95)"
  ctx.beginPath()
  ctx.moveTo(tipX, tipY)
  ctx.lineTo(p.x + Math.cos(ang + Math.PI - spread) * back, p.y + Math.sin(ang + Math.PI - spread) * back)
  ctx.lineTo(p.x + Math.cos(ang + Math.PI + spread) * back, p.y + Math.sin(ang + Math.PI + spread) * back)
  ctx.closePath()
  ctx.fill()
  ctx.shadowColor = "transparent"
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0
  ctx.stroke()
  ctx.restore()
  // Player dot core (white-ringed so it never disappears into the wedge).
  ctx.fillStyle = accent
  dot(ctx, p.x, p.y, detail ? 4 : 2.6)
  ctx.lineWidth = detail ? 2 : 1.4
  ctx.strokeStyle = "#fff7f0"
  ring(ctx, p.x, p.y, detail ? 4 : 2.6)
  return { sx: p.x, sy: p.y }
}

/* ----------------------------------------------------------- 2D primitives */

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
}
function ring(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.stroke()
}
function line(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): void {
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.lineTo(x1, y1)
  ctx.stroke()
}
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}
/** A "nice" grid spacing (~6 lines across the world span). */
function niceGrid(span: number): number {
  const raw = span / 6
  const pow = Math.pow(10, Math.floor(Math.log10(raw)))
  const n = raw / pow
  const m = n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10
  return m * pow
}
