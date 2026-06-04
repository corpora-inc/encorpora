import type { SpeciesId } from "../world/composition"
import {
  type CityLayout,
  type CityChunk,
  type CityZoneId,
  type CityBuilding,
  type CityProp,
  type CityAnchor,
  type CitySurface,
  type CityBounds,
  chunkKey,
} from "./layout"

/**
 * city/generateCity.ts — deterministic procedural generation of Corpan City.
 *
 * generateCity(seed) → CityLayout, varying by seed but always:
 *   • WALKABLE — a regular street grid leaves wide avenues between blocks; the
 *     player and crowd slide along building boxes (collision.ts derives boxes
 *     from these same footprints).
 *   • ROADS BAKED — streets are emitted as ground REGIONS per chunk, never as
 *     overlaid offset planes (the §2 z-fight rule). The streaming manager bakes
 *     each chunk's ground into ONE mesh from these regions.
 *   • A BELIEVABLE LITTLE METROPOLIS — varied block sizes, building heights/
 *     styles by ZONE (downtown taller + denser, residential lower + greener,
 *     park mostly trees, harbor warehouses at the water), and the landmarks a
 *     real city needs: a central plaza (spawn), market, harbor/docks, transit
 *     station, hospital, parks, bridges, mixed res/commercial blocks.
 *
 * ZONES ARE VISUAL ONLY. The zone map decides what each patch LOOKS like; it
 * carries NO learning-domain meaning. Landmark anchors get generic stable ids
 * (`harbor`, `station`, `market`, `hospital`, `plaza`, `bridge_n`, …) so quests
 * target them by id, never by zone.
 *
 * LAYOUT RECIPE (kept simple + readable so it's easy to tune):
 *   • The city is a square `worldSize` × `worldSize`, centered on the origin so
 *     the plaza spawn sits at (0,0) — same convention as the plaza topology.
 *   • A street GRID of avenues at a fixed `PITCH`; the squares between avenues
 *     are BLOCKS. Each block is filled with a row/column of buildings sized +
 *     weighted by its chunk's zone, leaving sidewalks inside the block.
 *   • A WATER strip along one edge gives us the harbor; the avenue crossing the
 *     water becomes a BRIDGE (a buildable deck region + bridge anchors).
 *   • Landmarks claim specific blocks (nearest the intended part of town) and
 *     suppress generic infill there so they read as singular.
 */

/* ----------------------------------------------------------------- rng */

/** mulberry32 — same deterministic generator the rest of the pack uses. */
function rng(seed: number): () => number {
  let a = (seed >>> 0) || 1
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ------------------------------------------------------------- recipe knobs */

/** the city is ~10× the plaza's 240u square footprint by area (≈3.2× per side). */
const WORLD_SIZE = 760
/** square chunk side; a 760 world / 95 chunk → 8×8 = 64 chunks. */
const CHUNK_SIZE = 95
/** street width (matches the warm avenue feel of the plaza roads). */
const AVENUE_W = 8
/** block pitch — avenue centre-to-centre. Blocks are PITCH - AVENUE_W wide. */
const PITCH = 48
/** sidewalk inset inside a block before buildings start. */
const SIDEWALK = 3.5

/** base ground surface under each zone (roads bake on top). */
const BASE_SURFACE_BY_ZONE: Record<CityZoneId, CitySurface> = {
  plaza: "flagstone",
  downtown: "dirt",
  residential: "dirt",
  market: "dirt",
  harbor: "stone",
  park: "grass",
  station: "stone",
  civic: "dirt",
  industrial: "stone",
}

/* per-zone building character: kind weights + height/footprint feel. */
interface ZoneSpec {
  /** weighted KIND choices for generic infill in this zone. */
  kinds: string[]
  /** target footprint size range (world units, per side). */
  size: [number, number]
  /** 0..1 chance a block cell is EMPTY (gardens/yards) — higher = greener/sparser. */
  gap: number
  /** dressing density multiplier (props per block). */
  dressing: number
}

const ZONE_SPECS: Record<CityZoneId, ZoneSpec> = {
  // Kind weights only steer WHICH building type fills a cell (footprint/collision
  // are unchanged — sizes below are left as-is). Weights tuned for believable
  // districts: downtown leans to mid-rise shops/inns/arcades, residential to
  // townhouses, the park stays green with the occasional chapel/lodge.
  plaza: { kinds: ["inn", "market-hall", "shop", "chapel"], size: [7, 11], gap: 0.45, dressing: 1.2 },
  downtown: { kinds: ["shop", "shop", "shop", "inn", "inn", "market-hall", "house"], size: [8, 13], gap: 0.08, dressing: 0.9 },
  residential: { kinds: ["house", "house", "house", "shop"], size: [6, 9], gap: 0.4, dressing: 1.1 },
  market: { kinds: ["market-hall", "shop", "shop", "workshop"], size: [6, 10], gap: 0.25, dressing: 1.6 },
  harbor: { kinds: ["workshop", "workshop", "market-hall", "inn"], size: [8, 12], gap: 0.3, dressing: 1.1 },
  park: { kinds: ["house", "chapel"], size: [6, 8], gap: 0.86, dressing: 2.3 },
  station: { kinds: ["market-hall", "inn", "shop", "shop"], size: [9, 14], gap: 0.18, dressing: 1.1 },
  civic: { kinds: ["market-hall", "inn", "chapel"], size: [10, 16], gap: 0.35, dressing: 0.8 },
  industrial: { kinds: ["workshop", "workshop", "market-hall"], size: [8, 12], gap: 0.2, dressing: 0.7 },
}

/* ----------------------------------------------------------- landmark plan */

/**
 * Each landmark claims a target world position (which block it sits in) and a
 * generic, stable anchor id. The generator snaps each to its block center, drops
 * a hero footprint, and suppresses generic infill in that block. Positions are
 * fractions of the half-extent so the seed can nudge them without leaving bounds.
 */
interface LandmarkPlan {
  id: string
  zone: CityZoneId
  /** target position as a fraction of half-world (−1..1) in x,z. */
  fx: number
  fz: number
  label: string
}

/* ------------------------------------------------------------- box helpers */

type Box = { x: number; z: number; w: number; d: number }

function boxesOverlap(a: Box, b: Box, pad: number): boolean {
  return (
    Math.abs(a.x - b.x) < (a.w + b.w) / 2 + pad &&
    Math.abs(a.z - b.z) < (a.d + b.d) / 2 + pad
  )
}

/* a uniform zone field: which CityZoneId governs a world point. Built once from
 * the harbor edge + a few seeded zone "seeds" so the city has coherent districts
 * rather than per-block noise. */
interface ZoneField {
  zoneAt: (x: number, z: number) => CityZoneId
  /** y-position (world Z) of the harbor waterline; everything beyond is water. */
  waterZ: number
}

function buildZoneField(half: number, r: () => number): ZoneField {
  // Harbor sits along the +Z edge (one waterfront). Water beyond `waterZ`.
  const waterZ = half - 70
  // District seeds: (x,z, zone) — nearest-seed wins (Voronoi-ish), with the
  // plaza forced at the center and harbor/industrial pinned near the water.
  const seeds: Array<{ x: number; z: number; zone: CityZoneId }> = [
    { x: 0, z: 0, zone: "plaza" },
    { x: -half * 0.55, z: -half * 0.5, zone: "downtown" },
    { x: half * 0.5, z: -half * 0.55, zone: "downtown" },
    { x: -half * 0.6, z: half * 0.2, zone: "residential" },
    { x: half * 0.62, z: half * 0.1, zone: "residential" },
    { x: half * 0.1, z: -half * 0.15, zone: "market" },
    { x: -half * 0.15, z: waterZ - 20, zone: "harbor" },
    { x: half * 0.45, z: waterZ - 22, zone: "industrial" },
    { x: -half * 0.5, z: half * 0.55, zone: "park" },
    { x: half * 0.2, z: half * 0.42, zone: "station" },
    { x: -half * 0.05, z: half * 0.3, zone: "civic" },
  ]
  // jitter each seed a touch by the city seed so districts vary by run.
  for (const s of seeds) {
    if (s.zone === "plaza") continue
    s.x += (r() - 0.5) * half * 0.18
    s.z += (r() - 0.5) * half * 0.18
  }
  const zoneAt = (x: number, z: number): CityZoneId => {
    if (z > waterZ) return "harbor" // the quay belongs to the harbor zone
    // plaza wins inside a generous radius so the civic heart is coherent.
    if (x * x + z * z < 60 * 60) return "plaza"
    let best = seeds[0]
    let bd = Infinity
    for (const s of seeds) {
      const d = (s.x - x) ** 2 + (s.z - z) ** 2
      if (d < bd) {
        bd = d
        best = s
      }
    }
    return best.zone
  }
  return { zoneAt, waterZ }
}

/* ------------------------------------------------------------- block infill */

/** Fill one street block with a tidy run of buildings for its zone. */
function fillBlock(
  bx: number,
  bz: number,
  bw: number,
  bd: number,
  zone: CityZoneId,
  claimed: Box[],
  r: () => number,
): CityBuilding[] {
  const out: CityBuilding[] = []
  const spec = ZONE_SPECS[zone]
  const innerW = bw - SIDEWALK * 2
  const innerD = bd - SIDEWALK * 2
  if (innerW < 5 || innerD < 5) return out
  // choose a cell size from the zone's range; lay a small grid of cells. The
  // generous per-cell gutter (cell + 5) keeps a block to a handful of buildings
  // so an active chunk stays inside the draw-call budget (buildings don't
  // instance across each other — each merged building is its own draw).
  const cell = spec.size[0] + r() * (spec.size[1] - spec.size[0])
  const cols = Math.max(1, Math.floor(innerW / (cell + 5)))
  const rows = Math.max(1, Math.floor(innerD / (cell + 5)))
  const cw = innerW / cols
  const cd = innerD / rows
  for (let cI = 0; cI < cols; cI++) {
    for (let rI = 0; rI < rows; rI++) {
      if (r() < spec.gap) continue // a yard/garden/plaza gap
      const cx = bx - innerW / 2 + (cI + 0.5) * cw
      const cz = bz - innerD / 2 + (rI + 0.5) * cd
      // footprint a little smaller than the cell, jittered, taller in downtown.
      const w = Math.min(cw - 1.5, cell) * (0.7 + r() * 0.3)
      const d = Math.min(cd - 1.5, cell) * (0.7 + r() * 0.3)
      const box: Box = { x: cx, z: cz, w, d }
      if (claimed.some((c) => boxesOverlap(box, c, 1))) continue
      const kind = spec.kinds[Math.floor(r() * spec.kinds.length)]
      // door faces the nearest avenue (outward from block center).
      const door = {
        x: cx + (cx >= bx ? d : -d), // approximate; refined toward block edge
        z: cz,
      }
      out.push({ x: cx, z: cz, w, d, kind, door })
    }
  }
  return out
}

/* ------------------------------------------------------------- block props */

/** Scatter zone-appropriate dressing inside a block (avoiding the buildings). */
function dressBlock(
  bx: number,
  bz: number,
  bw: number,
  bd: number,
  zone: CityZoneId,
  buildings: CityBuilding[],
  r: () => number,
): CityProp[] {
  const out: CityProp[] = []
  const spec = ZONE_SPECS[zone]
  const n = Math.round((4 + r() * 4) * spec.dressing)
  const innerW = bw - SIDEWALK
  const innerD = bd - SIDEWALK
  const freeAt = (x: number, z: number): boolean =>
    !buildings.some(
      (b) => Math.abs(x - b.x) < b.w / 2 + 1.2 && Math.abs(z - b.z) < b.d / 2 + 1.2,
    )
  // species menu per zone (visual only). Tuned for a grounded streetscape:
  // lamps line the avenues, benches + planters + the odd signpost give the
  // sidewalks real street furniture, trees soften residential blocks.
  const menu: SpeciesId[] =
    zone === "park"
      ? ["tree", "tree", "tree", "tree", "bench", "lamp", "trough"]
      : zone === "market"
        ? ["stall", "cart", "barrel", "crate", "sack", "lamp", "signpost"]
        : zone === "harbor" || zone === "industrial"
          ? ["barrel", "crate", "crate", "cart", "lamp", "sack", "signpost"]
          : zone === "residential"
            ? ["tree", "tree", "planter", "bench", "lamp", "lamp"]
            : zone === "downtown"
              ? ["lamp", "lamp", "bench", "planter", "tree", "signpost"]
              : zone === "civic" || zone === "station"
                ? ["lamp", "lamp", "bench", "planter", "tree", "signpost", "trough"]
                : ["lamp", "planter", "tree", "bench", "barrel"]
  for (let i = 0; i < n; i++) {
    const x = bx + (r() - 0.5) * innerW
    const z = bz + (r() - 0.5) * innerD
    if (!freeAt(x, z)) continue
    const species = menu[Math.floor(r() * menu.length)]
    out.push({ species, x, z, scale: 0.9 + r() * 0.3, shadow: 0.6 })
  }
  return out
}

/* ------------------------------------------------- landmark hero footprints */

/** Build a landmark's hero building(s) + anchor at a snapped block center. */
function buildLandmark(plan: LandmarkPlan, cx: number, cz: number): { buildings: CityBuilding[]; anchor: CityAnchor; props: CityProp[] } {
  const buildings: CityBuilding[] = []
  const props: CityProp[] = []
  let anchor: CityAnchor
  switch (plan.id) {
    case "market":
      // a long market hall + flanking stalls.
      buildings.push({ x: cx, z: cz, w: 22, d: 14, kind: "market-hall", door: { x: cx, z: cz + 8 } })
      for (let i = -2; i <= 2; i++) {
        props.push({ species: "stall", x: cx + i * 5, z: cz + 11, scale: 1.1, shadow: 0.8 })
        props.push({ species: "cart", x: cx + i * 5, z: cz - 11, scale: 1, shadow: 0.7 })
      }
      anchor = { id: "market", kind: "vendor", x: cx, z: cz + 12, facing: 0, label: plan.label }
      break
    case "station":
      // a long transit shed with a forecourt.
      buildings.push({ x: cx, z: cz, w: 30, d: 12, kind: "market-hall", door: { x: cx, z: cz + 7 } })
      for (let i = -3; i <= 3; i++) props.push({ species: "lamp", x: cx + i * 6, z: cz + 14, scale: 1, shadow: 0.5 })
      anchor = { id: "station", kind: "portal", x: cx, z: cz + 16, facing: 0, label: plan.label }
      break
    case "hospital":
      buildings.push({ x: cx, z: cz, w: 24, d: 18, kind: "inn", door: { x: cx, z: cz + 10 } })
      anchor = { id: "hospital", kind: "landmark", x: cx, z: cz + 12, facing: 0, label: plan.label }
      break
    case "harbor":
      // warehouses set back from the quay; docks anchor at the waterline.
      buildings.push({ x: cx - 10, z: cz - 6, w: 12, d: 10, kind: "workshop" })
      buildings.push({ x: cx + 10, z: cz - 6, w: 12, d: 10, kind: "workshop" })
      for (let i = -3; i <= 3; i++) props.push({ species: "barrel", x: cx + i * 3, z: cz + 8, scale: 1, shadow: 0.6 })
      anchor = { id: "harbor", kind: "docks", x: cx, z: cz + 10, facing: Math.PI, label: plan.label }
      break
    default:
      buildings.push({ x: cx, z: cz, w: 16, d: 12, kind: "chapel" })
      anchor = { id: plan.id, kind: "landmark", x: cx, z: cz + 9, facing: 0, label: plan.label }
  }
  return { buildings, anchor, props }
}

/* ---------------------------------------------------------------- entry */

export function generateCity(seed = 20260603): CityLayout {
  const r = rng(seed)
  const half = WORLD_SIZE / 2
  const bounds: CityBounds = { minX: -half, maxX: half, minZ: -half, maxZ: half }
  const gridDim = Math.round(WORLD_SIZE / CHUNK_SIZE) // 8
  const zoneField = buildZoneField(half, r)

  // ---- avenue centrelines (a regular grid through the whole city) ----
  const lines: number[] = []
  for (let p = 0; p <= half - AVENUE_W; p += PITCH) {
    lines.push(p)
    if (p > 0) lines.push(-p)
  }
  lines.sort((a, b) => a - b)

  // ---- landmark plans → snapped block centers (claim their blocks) ----
  const landmarkPlans: LandmarkPlan[] = [
    { id: "market", zone: "market", fx: 0.12, fz: -0.18, label: "Market Square" },
    { id: "harbor", zone: "harbor", fx: -0.1, fz: (zoneField.waterZ - 14) / half, label: "Harbor Docks" },
    { id: "station", zone: "station", fx: 0.22, fz: 0.46, label: "Central Station" },
    { id: "hospital", zone: "civic", fx: -0.06, fz: 0.32, label: "City Hospital" },
  ]

  const claimed: Box[] = []
  const allBuildings: CityBuilding[] = []
  const allProps: CityProp[] = []
  const allAnchors: CityAnchor[] = []

  // plaza spawn at the center; a fountain anchor + the spawn anchor.
  const spawn = { x: 0, z: 12 }
  allAnchors.push({ id: "plaza", kind: "spawn", x: 0, z: 12, facing: 0, label: "Grand Plaza" })
  allAnchors.push({ id: "fountain", kind: "fountain", x: 0, z: 0, facing: 0, label: "Plaza Fountain" })
  // keep the plaza disc clear of generic infill.
  claimed.push({ x: 0, z: 0, w: 70, d: 70 })

  // place landmarks: snap each target to the nearest block center, drop hero.
  const blockCenters = (): Array<{ x: number; z: number; w: number; d: number }> => {
    const centers: Array<{ x: number; z: number; w: number; d: number }> = []
    for (let i = 0; i < lines.length - 1; i++) {
      for (let j = 0; j < lines.length - 1; j++) {
        const x0 = lines[i] + AVENUE_W / 2
        const x1 = lines[i + 1] - AVENUE_W / 2
        const z0 = lines[j] + AVENUE_W / 2
        const z1 = lines[j + 1] - AVENUE_W / 2
        if (x1 - x0 < 8 || z1 - z0 < 8) continue
        centers.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0 })
      }
    }
    return centers
  }
  const centers = blockCenters()
  for (const plan of landmarkPlans) {
    const tx = plan.fx * half
    const tz = plan.fz * half
    let best = centers[0]
    let bd = Infinity
    for (const c of centers) {
      const d = (c.x - tx) ** 2 + (c.z - tz) ** 2
      if (d < bd) {
        bd = d
        best = c
      }
    }
    if (!best) continue
    const lm = buildLandmark(plan, best.x, best.z)
    allBuildings.push(...lm.buildings)
    allProps.push(...lm.props)
    allAnchors.push(lm.anchor)
    claimed.push({ x: best.x, z: best.z, w: best.w + 4, d: best.d + 4 })
  }

  // bridge anchors where an avenue crosses the water (north waterfront).
  // The avenue nearest x=0 makes the main bridge; mark its deck region later.
  const bridgeX = 0
  allAnchors.push({ id: "bridge_n", kind: "landmark", x: bridgeX, z: zoneField.waterZ, facing: 0, label: "North Bridge" })

  // ---- generic block infill across the grid (skipping claimed blocks) ----
  for (const c of centers) {
    if (claimed.some((cl) => boxesOverlap({ x: c.x, z: c.z, w: c.w, d: c.d }, cl, 0))) continue
    if (c.z > zoneField.waterZ) continue // block sits in the water → skip
    const zone = zoneField.zoneAt(c.x, c.z)
    const buildings = fillBlock(c.x, c.z, c.w, c.d, zone, claimed, r)
    allBuildings.push(...buildings)
    allProps.push(...dressBlock(c.x, c.z, c.w, c.d, zone, buildings, r))
  }

  // ---- partition everything into chunks (by feature CENTER) ----
  const chunks: CityChunk[] = makeChunks(bounds, CHUNK_SIZE, gridDim, zoneField, {
    buildings: allBuildings,
    props: allProps,
    anchors: allAnchors,
    lines,
    waterZ: zoneField.waterZ,
    bridgeX,
  })

  return {
    id: "corpan-city",
    seed,
    bounds,
    chunkSize: CHUNK_SIZE,
    gridDim,
    chunks,
    anchors: allAnchors,
    spawn,
    baseSurfaceByZone: BASE_SURFACE_BY_ZONE,
  }
}

/* ------------------------------------------------------- chunk partitioning */

interface ChunkInput {
  buildings: CityBuilding[]
  props: CityProp[]
  anchors: CityAnchor[]
  lines: number[]
  waterZ: number
  bridgeX: number
}

/**
 * Slice all city features into the chunk grid and BAKE each chunk's ground
 * regions (avenue strips that pass through it, the plaza/park discs, the water
 * + bridge deck). Roads are stored as GROUND REGIONS — never overlay meshes — so
 * the streaming manager paints them into the chunk's single ground mesh.
 */
function makeChunks(
  bounds: CityBounds,
  chunkSize: number,
  gridDim: number,
  zoneField: ZoneField,
  inp: ChunkInput,
): CityChunk[] {
  const chunks: CityChunk[][] = []
  for (let gx = 0; gx < gridDim; gx++) {
    chunks[gx] = []
    for (let gz = 0; gz < gridDim; gz++) {
      const minX = bounds.minX + gx * chunkSize
      const minZ = bounds.minZ + gz * chunkSize
      const cb: CityBounds = { minX, maxX: minX + chunkSize, minZ, maxZ: minZ + chunkSize }
      const cx = minX + chunkSize / 2
      const cz = minZ + chunkSize / 2
      chunks[gx][gz] = {
        gx,
        gz,
        key: chunkKey(gx, gz),
        bounds: cb,
        zone: zoneField.zoneAt(cx, cz),
        buildings: [],
        props: [],
        ground: [],
        anchors: [],
      }
    }
  }

  const idxOf = (v: number, minV: number): number => {
    const i = Math.floor((v - minV) / chunkSize)
    return i < 0 ? 0 : i >= gridDim ? gridDim - 1 : i
  }
  const chunkFor = (x: number, z: number): CityChunk =>
    chunks[idxOf(x, bounds.minX)][idxOf(z, bounds.minZ)]

  for (const b of inp.buildings) chunkFor(b.x, b.z).buildings.push(b)
  for (const p of inp.props) chunkFor(p.x, p.z).props.push(p)
  for (const a of inp.anchors) chunkFor(a.x, a.z).anchors.push(a)

  // ---- bake ground regions per chunk ----
  for (let gx = 0; gx < gridDim; gx++) {
    for (let gz = 0; gz < gridDim; gz++) {
      const ch = chunks[gx][gz]
      const b = ch.bounds
      // avenue strips that intersect this chunk (clipped to the chunk for tidy
      // bake bounds — the strip is painted only over the part inside this chunk).
      for (const lx of inp.lines) {
        if (lx >= b.minX - AVENUE_W && lx <= b.maxX + AVENUE_W) {
          ch.ground.push({
            kind: "rect",
            surface: "cobble",
            cx: lx,
            cz: (b.minZ + b.maxZ) / 2,
            w: AVENUE_W,
            d: chunkSize,
            metersPerTile: 2.4,
          })
        }
      }
      for (const lz of inp.lines) {
        if (lz >= b.minZ - AVENUE_W && lz <= b.maxZ + AVENUE_W) {
          ch.ground.push({
            kind: "rect",
            surface: "cobble",
            cx: (b.minX + b.maxX) / 2,
            cz: lz,
            w: chunkSize,
            d: AVENUE_W,
            metersPerTile: 2.4,
          })
        }
      }
      // water: any chunk that touches the waterline gets a water rect beyond it.
      if (b.maxZ > zoneField.waterZ) {
        const wz0 = Math.max(b.minZ, zoneField.waterZ)
        ch.ground.push({
          kind: "rect",
          surface: "water",
          cx: (b.minX + b.maxX) / 2,
          cz: (wz0 + b.maxZ) / 2,
          w: chunkSize,
          d: b.maxZ - wz0,
          metersPerTile: 6,
        })
        // bridge deck: a stone strip carrying the bridge avenue across the water.
        if (inp.bridgeX >= b.minX - 6 && inp.bridgeX <= b.maxX + 6) {
          ch.ground.push({
            kind: "rect",
            surface: "stone",
            cx: inp.bridgeX,
            cz: (wz0 + b.maxZ) / 2,
            w: AVENUE_W + 4,
            d: b.maxZ - wz0,
            metersPerTile: 3,
          })
        }
      }
      // plaza flagstone disc (only the center chunk(s) it overlaps).
      if (Math.abs((b.minX + b.maxX) / 2) < chunkSize && Math.abs((b.minZ + b.maxZ) / 2) < chunkSize) {
        ch.ground.push({ kind: "disc", surface: "flagstone", cx: 0, cz: 0, r: 30, metersPerTile: 4 })
      }
      // park greens get a grass disc.
      if (ch.zone === "park") {
        ch.ground.push({
          kind: "disc",
          surface: "grass",
          cx: (b.minX + b.maxX) / 2,
          cz: (b.minZ + b.maxZ) / 2,
          r: chunkSize * 0.42,
          metersPerTile: 8,
        })
      }
    }
  }

  return chunks.flat()
}
