#!/usr/bin/env node
/**
 * genMap.mjs — deterministic GRAND TOWN generator for World Plaza.
 *
 * Emits a `RoomTopology` + a matching Antigua-1770 `Scene` describing a big,
 * explorable colonial town: a grand central plaza (fountain, benches, lamps)
 * opening onto STREETS that radiate into a loose grid of BUILDING BLOCKS. Each
 * building is a collision blocker plus an addressable DOOR anchor (role
 * "portal") on its street-facing side — "the doors and things" — and the streets
 * are lined with NPC stations, vendors, benches and lamps so the town feels
 * populated.
 *
 * Pure Node, zero deps. Deterministic for a given (size, seed, districts):
 * a seeded xorshift PRNG drives every placement, so the committed JSON is
 * reproducible. Geometry is laid out on an open street grid; buildings are
 * carved INTO the blocks between streets, never onto a street or the plaza, so
 * walkability is structural rather than rejection-sampled. A final validator
 * pass proves every reachable anchor is outside all blockers.
 *
 * Usage:
 *   node scripts/genMap.mjs                       # defaults, writes files
 *   node scripts/genMap.mjs --size 72 --seed 1770 --districts 4
 *   node scripts/genMap.mjs --print               # stats only, no write
 *
 * Output files:
 *   content/topologies/plaza-grand.json
 *   content/scenes/antigua-grand.json
 *   content/buildings/plaza-grand.json   (per-door building kind lookup)
 *   qa/plaza-grand.svg                   (top-down sanity preview)
 */

import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, "..")

/* ----------------------------- args ----------------------------------- */

function parseArgs(argv) {
  // size 240 (bounds ±120) is the RELAXED grand-town default: ~9× the old
  // 80×80 ground area, so the SAME ~28 buildings + props breathe across long
  // sightlines toward a deep horizon instead of piling up in a tight core.
  const a = { size: 240, seed: 1770, districts: 7, print: false, write: true }
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i]
    if (k === "--size") a.size = Number(argv[++i])
    else if (k === "--seed") a.seed = Number(argv[++i])
    else if (k === "--districts") a.districts = Number(argv[++i])
    else if (k === "--print") (a.print = true), (a.write = false)
    else if (k === "--no-write") a.write = false
  }
  return a
}

/* --------------------------- seeded PRNG ------------------------------- */

function makeRng(seed) {
  // xorshift32 → uniform [0,1). Deterministic, no deps.
  let s = (seed | 0) || 0x9e3779b9
  return {
    next() {
      s ^= s << 13
      s ^= s >>> 17
      s ^= s << 5
      s |= 0
      return ((s >>> 0) % 1_000_000) / 1_000_000
    },
    range(lo, hi) {
      return lo + this.next() * (hi - lo)
    },
    int(lo, hi) {
      return Math.floor(this.range(lo, hi + 1))
    },
    pick(arr) {
      return arr[Math.floor(this.next() * arr.length)]
    },
    chance(p) {
      return this.next() < p
    },
  }
}

/* --------------------------- geometry --------------------------------- */

const round = (n) => Math.round(n * 100) / 100

function rectsOverlap(a, b, pad = 0) {
  return (
    Math.abs(a.x - b.x) < (a.w + b.w) / 2 + pad &&
    Math.abs(a.z - b.z) < (a.d + b.d) / 2 + pad
  )
}

/** is point (x,z) inside blocker b (with optional pad)? */
function pointInBlocker(x, z, b, pad = 0) {
  return Math.abs(x - b.x) <= b.w / 2 + pad && Math.abs(z - b.z) <= b.d / 2 + pad
}

/* ----------------------- the layout generator ------------------------- */

// Kind vocabulary is kept identical to src/world/buildings.ts `BuildingKind`
// so the orchestrator can pass our per-blocker kinds straight into
// createBuildings({ kinds }).
const BUILDING_KINDS = [
  "house",
  "house",
  "house",
  "shop",
  "shop",
  "inn",
  "market-hall",
  "chapel",
  "workshop",
]

/**
 * Compute the abstract town layout: plaza rect, street strips (each an
 * axis-aligned rectangle on the ground), and building blocks. Returns plain
 * data so both the topology emitter and the runtime road renderer can agree
 * on the grid (roads.ts re-derives the same strips from this same recipe).
 */
function buildLayout({ size, seed, districts }) {
  const rng = makeRng(seed)
  const half = size / 2
  const bounds = {
    minX: round(-half),
    maxX: round(half),
    minZ: round(-half),
    maxZ: round(half),
  }

  // ---- central plaza ----
  // A generous central square (the town's focal point). Clamp wider on the big
  // relaxed map so the plaza reads as a real public space, not a pinch-point.
  const plazaR = Math.max(8, Math.min(14, size * 0.1)) // half-extent
  const plaza = { x: 0, z: 0, w: round(plazaR * 2), d: round(plazaR * 2) }

  // ---- street grid ----
  // A set of axis lines (x = const → a N/S street; z = const → an E/W street).
  // Always include the central cross through the plaza, then add evenly spaced
  // ring streets out to the edge. STREET_W is the walkable corridor width.
  const STREET_W = 5
  const ROAD_MARGIN = 4 // keep blocks off the very edge
  const usable = half - ROAD_MARGIN
  // Street axis lines. Spaced so the BLOCK between two adjacent streets is wide
  // enough (>= MIN_BLOCK) to hold buildings. We grow lines outward from the
  // plaza by a comfortable block pitch rather than evenly subdividing, so blocks
  // stay buildable regardless of size.
  const MIN_BLOCK = 16 // open block width between two street centrelines minus the street
  const pitch = MIN_BLOCK + STREET_W // centreline-to-centreline spacing (~21)
  // Central cross (x=0, z=0) cuts THROUGH the plaza; ring streets start one full
  // block beyond the plaza edge and march outward by `pitch`. `districts` caps
  // how many ring streets per side (more districts → bigger town).
  const ring0 = round(plazaR + STREET_W / 2 + MIN_BLOCK / 2) // first ring centreline
  // Let the street grid REACH the enlarged bounds (up to 8 rings/side) so the
  // town spreads across the big map instead of staying balled up in the centre.
  const ringCap = Math.max(2, Math.min(districts + 1, 8))
  const axisPos = [0]
  for (let r = 0; r < ringCap; r++) {
    const p = round(ring0 + r * pitch)
    if (p > usable + 0.01) break
    axisPos.push(p, -p)
  }
  const uniqAxis = [...new Set(axisPos.map(round))].sort((a, b) => a - b)

  // street strips as rectangles (for the road renderer + the open-floor test)
  const streets = []
  for (const xc of uniqAxis) {
    streets.push({
      x: round(xc),
      z: 0,
      w: STREET_W,
      d: round(size - ROAD_MARGIN * 2 + STREET_W),
      axis: "ns",
    })
  }
  for (const zc of uniqAxis) {
    streets.push({
      x: 0,
      z: round(zc),
      w: round(size - ROAD_MARGIN * 2 + STREET_W),
      d: STREET_W,
      axis: "ew",
    })
  }

  // ---- blocks: the rectangles BETWEEN adjacent streets ----
  // For each (xi,zi) gap we get a block cell; buildings are carved inside it.
  const cells = []
  for (let xi = 0; xi < uniqAxis.length - 1; xi++) {
    for (let zi = 0; zi < uniqAxis.length - 1; zi++) {
      const x0 = uniqAxis[xi] + STREET_W / 2
      const x1 = uniqAxis[xi + 1] - STREET_W / 2
      const z0 = uniqAxis[zi] + STREET_W / 2
      const z1 = uniqAxis[zi + 1] - STREET_W / 2
      const cw = x1 - x0
      const cd = z1 - z0
      if (cw < 3 || cd < 3) continue
      cells.push({
        cx: round((x0 + x1) / 2),
        cz: round((z0 + z1) / 2),
        w: round(cw),
        d: round(cd),
      })
    }
  }

  return { rng, bounds, plaza, streets, plazaR, uniqAxis, STREET_W, cells, half }
}

/* -------------------- topology + scene emission ----------------------- */

function generate({ size, seed, districts }) {
  const L = buildLayout({ size, seed, districts })
  const { rng, bounds, plaza, plazaR, cells } = L

  const blockers = []
  const anchors = []
  const buildingLookup = {} // doorAnchorId -> { kind, blockerIndex, ... }
  let aid = 0
  const nextId = (p) => `${p}_${aid++}`

  // The plaza is NOT a blocker (it's open floor); the fountain at its centre is.
  const FOUNT = 3
  blockers.push({ x: 0, z: 0, w: FOUNT, d: FOUNT })
  anchors.push({ id: "fountain", role: "decor", x: 0, z: 0 })

  // plaza ring dressing: benches + lamps around the fountain, well inside the
  // open plaza and clear of the fountain blocker.
  const ring = Math.min(plazaR - 2.5, plazaR * 0.62)
  const ringSpots = 8
  for (let i = 0; i < ringSpots; i++) {
    const ang = (i / ringSpots) * Math.PI * 2 + 0.39
    const x = round(Math.cos(ang) * ring)
    const z = round(Math.sin(ang) * ring)
    const role = i % 2 === 0 ? "bench" : "decor"
    anchors.push({
      id: nextId(role === "bench" ? "plaza_bench" : "plaza_lamp"),
      role,
      x,
      z,
      facing: round(Math.atan2(-z, -x)),
    })
  }
  // a vendor + a station ON the plaza edge (the market & town crier)
  anchors.push({
    id: "plaza_market",
    role: "vendor",
    x: round(plazaR - 1.2),
    z: round(-plazaR + 2.5),
    facing: round(Math.atan2(plazaR, -(plazaR - 1.2))),
  })
  anchors.push({
    id: "plaza_crier",
    role: "npc_station",
    x: round(-plazaR + 2.5),
    z: round(plazaR - 1.2),
    facing: round(Math.atan2(-plazaR, plazaR - 2.5)),
  })

  // ---- buildings: carve 1–2 into each block cell ----
  // Keep ALL cells — even plaza-adjacent ones contribute (their buildings get
  // nudged outward, off the plaza, below). Drop only cells fully swallowed by
  // the plaza (no buildable corner left).
  const targetBuildings = Math.max(16, Math.min(28, cells.length * 2 + districts * 2))
  const usableCells = cells.filter(
    (c) => Math.hypot(c.cx, c.cz) > plazaR - Math.max(c.w, c.d) / 2,
  )
  // sort cells outward-first for stable, pleasant filling
  usableCells.sort((a, b) => Math.hypot(a.cx, a.cz) - Math.hypot(b.cx, b.cz))

  let built = 0
  const PAD = 2.0 // gap between a building and the street/another building
  for (const c of usableCells) {
    if (built >= targetBuildings) break
    // how many buildings fit along the longer cell axis
    const along = c.w >= c.d ? "x" : "z"
    const span = along === "x" ? c.w : c.d
    const cross = along === "x" ? c.d : c.w
    // pack 1 building in a small cell, 2 in a roomy one (paired terrace houses)
    const count = span >= 8.5 ? 2 : 1
    for (let k = 0; k < count && built < targetBuildings; k++) {
      // building footprint, slightly randomized but bounded by the cell
      const bw0 = Math.min(span / count - PAD, rng.range(3.8, 7.5))
      const bd0 = Math.min(cross - PAD, rng.range(4.0, 7.0))
      const bw = round(Math.max(3.5, along === "x" ? bw0 : bd0))
      const bd = round(Math.max(3.5, along === "x" ? bd0 : bw0))
      // centre this building within its share of the cell
      const slot = along === "x"
        ? { x: c.cx - c.w / 2 + (k + 0.5) * (c.w / count), z: c.cz }
        : { x: c.cx, z: c.cz - c.d / 2 + (k + 0.5) * (c.d / count) }
      const b = { x: round(slot.x), z: round(slot.z), w: bw, d: bd }
      // If the centred footprint clips the grand plaza, slide it OUTWARD (away
      // from origin) within its cell until it clears — keeps plaza-adjacent
      // cells buildable (esp. on small maps) without touching the street recipe.
      if (rectsOverlap(b, plaza, 1.0)) {
        const ux = Math.sign(b.x || rng.range(-1, 1))
        const uz = Math.sign(b.z || rng.range(-1, 1))
        for (let step = 0; step < 8 && rectsOverlap(b, plaza, 1.0); step++) {
          b.x = round(b.x + ux * 1.0)
          b.z = round(b.z + uz * 1.0)
        }
      }
      // safety: never overlap plaza or an existing blocker
      if (rectsOverlap(b, plaza, 1.0)) continue
      if (blockers.some((o) => rectsOverlap(b, o, 1.0))) continue
      if (
        b.x - b.w / 2 < bounds.minX + 1 ||
        b.x + b.w / 2 > bounds.maxX - 1 ||
        b.z - b.d / 2 < bounds.minZ + 1 ||
        b.z + b.d / 2 > bounds.maxZ - 1
      )
        continue

      const blockerIndex = blockers.length
      blockers.push(b)

      // DOOR: on the building side facing the NEAREST street (toward plaza is a
      // good heuristic since streets radiate from the centre). Place the portal
      // anchor just OUTSIDE the footprint on that side, on open street floor.
      const towardCenter = pickDoorSide(b, L)
      const door = {
        id: nextId("door"),
        role: "portal",
        x: round(b.x + towardCenter.nx * (b[towardCenter.axis === "x" ? "w" : "d"] / 2 + 1.4)),
        z: round(b.z + towardCenter.nz * (b[towardCenter.axis === "x" ? "w" : "d"] / 2 + 1.4)),
        facing: round(Math.atan2(towardCenter.nz, towardCenter.nx)),
      }
      anchors.push(door)

      const kind = rng.pick(BUILDING_KINDS)
      buildingLookup[door.id] = {
        kind,
        blockerIndex,
        footprint: b,
        face: towardCenter.axis,
      }

      // populate the street in front: a station OR vendor at the door, and
      // occasionally a lamp/bench beside it.
      if (rng.chance(0.85)) {
        const isVendor = kind === "market-hall" || kind === "shop" || rng.chance(0.3)
        anchors.push({
          id: nextId(isVendor ? "vendor" : "station"),
          role: isVendor ? "vendor" : "npc_station",
          x: round(door.x + towardCenter.nx * 0.9),
          z: round(door.z + towardCenter.nz * 0.9),
          facing: round(Math.atan2(-towardCenter.nz, -towardCenter.nx)),
        })
      }
      if (rng.chance(0.4)) {
        // a lamp at the corner, offset perpendicular to the door normal
        const px = -towardCenter.nz
        const pz = towardCenter.nx
        anchors.push({
          id: nextId("lamp"),
          role: "decor",
          x: round(door.x + px * (b.w / 2 + 0.6)),
          z: round(door.z + pz * (b.d / 2 + 0.6)),
        })
      }
      built++
    }
  }

  // ---- spawns: in the plaza, on open floor, never inside a blocker ----
  const spawns = []
  const spawnCandidates = [
    { x: 0, z: round(plazaR - 2.5) },
    { x: round(plazaR - 2.5), z: 0 },
    { x: 0, z: round(-plazaR + 2.5) },
  ]
  for (const s of spawnCandidates) {
    if (!blockers.some((b) => pointInBlocker(s.x, s.z, b, 0.5))) spawns.push(s)
  }
  if (spawns.length === 0) spawns.push({ x: 0, z: round(plazaR - 2.5) })

  const topology = {
    id: "plaza-grand",
    bounds,
    spawns,
    blockers,
    anchors,
  }

  const scene = buildScene(topology, buildingLookup)
  return { topology, scene, buildingLookup, layout: L, stats: built }
}

/**
 * Choose which side of building `b` the door faces: the side pointing toward
 * the nearest street axis line (so the door opens onto walkable road, not into
 * a neighbour). Returns a unit normal + which footprint axis it crosses.
 */
function pickDoorSide(b, L) {
  // distance from each face to its nearest perpendicular street line
  const nearestLine = (val) =>
    L.uniqAxis.reduce((best, p) => (Math.abs(p - val) < Math.abs(best - val) ? p : best), L.uniqAxis[0])
  const sx = nearestLine(b.x) // nearest NS street x
  const sz = nearestLine(b.z) // nearest EW street z
  const dx = Math.abs(sx - b.x) - b.w / 2
  const dz = Math.abs(sz - b.z) - b.d / 2
  if (dx <= dz) {
    const nx = sx >= b.x ? 1 : -1
    return { nx, nz: 0, axis: "x" }
  } else {
    const nz = sz >= b.z ? 1 : -1
    return { nx: 0, nz, axis: "z" }
  }
}

/* --------------------------- scene skin ------------------------------- */

const KIND_PROP = {
  house: "placeholder:house",
  shop: "placeholder:shop",
  inn: "placeholder:inn",
  "market-hall": "placeholder:stall",
  chapel: "placeholder:chapel",
  workshop: "placeholder:workshop",
}
const KIND_NPC = {
  house: "placeholder:npc-resident",
  shop: "placeholder:npc-merchant",
  inn: "placeholder:npc-innkeeper",
  "market-hall": "placeholder:npc-vendor",
  chapel: "placeholder:npc-friar",
  workshop: "placeholder:npc-artisan",
}
const KIND_VOICE = {
  house: "es-ES",
  shop: "es-ES",
  inn: "es-MX",
  "market-hall": "es-MX",
  chapel: "es-ES",
  workshop: "es-ES",
}

function buildScene(topology, lookup) {
  const anchorSkins = {}
  const npcSkins = {}

  for (const a of topology.anchors) {
    if (a.role === "decor" && a.id === "fountain") {
      anchorSkins[a.id] = { spriteRef: { url: "placeholder:fountain" } }
    } else if (a.role === "decor" && a.id.startsWith("plaza_lamp")) {
      anchorSkins[a.id] = { spriteRef: { url: "placeholder:lamp" } }
    } else if (a.role === "decor" && a.id.startsWith("lamp")) {
      anchorSkins[a.id] = { spriteRef: { url: "placeholder:lamp" } }
    } else if (a.role === "bench") {
      anchorSkins[a.id] = { spriteRef: { url: "placeholder:bench" } }
    } else if (a.role === "portal") {
      const kind = lookup[a.id]?.kind ?? "house"
      anchorSkins[a.id] = { spriteRef: { url: KIND_PROP[kind] ?? "placeholder:house" } }
    } else if (a.role === "vendor") {
      anchorSkins[a.id] = { spriteRef: { url: "placeholder:stall" } }
      npcSkins[a.id] = { spriteRef: { url: "placeholder:npc-vendor" }, voiceHint: "es-MX" }
    } else if (a.role === "npc_station") {
      anchorSkins[a.id] = { spriteRef: { url: "placeholder:cafe" } }
      npcSkins[a.id] = { spriteRef: { url: "placeholder:npc-resident" }, voiceHint: "es-ES" }
    }
  }

  // give each door's adjacent station/vendor a kind-appropriate NPC skin where
  // we can correlate them (the populated anchor sits ~0.9u off the door).
  for (const a of topology.anchors) {
    if (a.role !== "portal") continue
    const kind = lookup[a.id]?.kind ?? "house"
    const near = topology.anchors.find(
      (o) =>
        (o.role === "npc_station" || o.role === "vendor") &&
        Math.hypot(o.x - a.x, o.z - a.z) < 2.2,
    )
    if (near) {
      npcSkins[near.id] = {
        spriteRef: { url: KIND_NPC[kind] ?? "placeholder:npc-resident" },
        voiceHint: KIND_VOICE[kind] ?? "es-ES",
      }
    }
  }

  return {
    id: "antigua-grand",
    topologyId: "plaza-grand",
    setting: { place: "Antigua", era: "1770", mood: "warm colonial market day" },
    themeId: "paper",
    narrativeBlurb:
      "A whole town wakes around the great plaza: streets fan out past the fountain to shops, an inn, a chapel and workshops, each door open to a story.",
    anchorSkins,
    npcSkins,
    palette: {
      ground: "#d9c7a3",
      groundAlt: "#cdb892",
      road: "#b9a079",
      roadEdge: "#9c8462",
      plaza: "#e3d3ad",
      sky: "#bfe0e8",
      accent: "#c46b4a",
      building: "#e7d4ad",
    },
  }
}

/* --------------------------- validation ------------------------------- */

function validate(topology) {
  const issues = []
  const reachableRoles = new Set(["npc_station", "vendor", "portal", "spawn"])
  // 1) reachable anchors must not sit inside any blocker
  for (const a of topology.anchors) {
    if (!reachableRoles.has(a.role)) continue
    for (const b of topology.blockers) {
      if (pointInBlocker(a.x, a.z, b, -0.05)) {
        issues.push(`anchor ${a.id} (${a.role}) is inside blocker @${b.x},${b.z}`)
        break
      }
    }
  }
  // 2) spawns must be open floor & in-bounds
  for (const s of topology.spawns) {
    if (topology.blockers.some((b) => pointInBlocker(s.x, s.z, b, 0))) {
      issues.push(`spawn ${s.x},${s.z} is inside a blocker`)
    }
    if (
      s.x < topology.bounds.minX ||
      s.x > topology.bounds.maxX ||
      s.z < topology.bounds.minZ ||
      s.z > topology.bounds.maxZ
    )
      issues.push(`spawn ${s.x},${s.z} out of bounds`)
  }
  // 3) blockers fully in-bounds
  for (const b of topology.blockers) {
    if (
      b.x - b.w / 2 < topology.bounds.minX ||
      b.x + b.w / 2 > topology.bounds.maxX ||
      b.z - b.d / 2 < topology.bounds.minZ ||
      b.z + b.d / 2 > topology.bounds.maxZ
    )
      issues.push(`blocker @${b.x},${b.z} out of bounds`)
  }
  // 4) flood-fill reachability from spawn[0] on a coarse grid; every reachable
  //    anchor must be in the connected open region.
  const reach = floodReach(topology)
  for (const a of topology.anchors) {
    if (!reachableRoles.has(a.role)) continue
    if (!reach.isReachable(a.x, a.z)) {
      issues.push(`anchor ${a.id} (${a.role}) is NOT reachable from spawn`)
    }
  }
  return { ok: issues.length === 0, issues, reach }
}

/**
 * Coarse grid BFS from the first spawn. A cell is walkable if its centre is not
 * inside any blocker (inflated by the player radius). Reachability for an anchor
 * tests the nearest walkable cell within one cell of it (doors/stations sit just
 * outside their building).
 */
function floodReach(topology, cell = 1.0, playerR = 0.6) {
  const { minX, maxX, minZ, maxZ } = topology.bounds
  const nx = Math.ceil((maxX - minX) / cell)
  const nz = Math.ceil((maxZ - minZ) / cell)
  const idx = (i, j) => i * nz + j
  const walkable = new Uint8Array(nx * nz)
  const toW = (i, j) => ({ x: minX + (i + 0.5) * cell, z: minZ + (j + 0.5) * cell })
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < nz; j++) {
      const { x, z } = toW(i, j)
      const blocked = topology.blockers.some((b) => pointInBlocker(x, z, b, playerR))
      walkable[idx(i, j)] = blocked ? 0 : 1
    }
  // BFS from spawn cell
  const visited = new Uint8Array(nx * nz)
  const s = topology.spawns[0]
  const si = Math.min(nx - 1, Math.max(0, Math.floor((s.x - minX) / cell)))
  const sj = Math.min(nz - 1, Math.max(0, Math.floor((s.z - minZ) / cell)))
  const q = [[si, sj]]
  visited[idx(si, sj)] = 1
  let count = 0
  while (q.length) {
    const [i, j] = q.pop()
    count++
    for (const [di, dj] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const ni = i + di
      const nj = j + dj
      if (ni < 0 || nj < 0 || ni >= nx || nj >= nz) continue
      const k = idx(ni, nj)
      if (visited[k] || !walkable[k]) continue
      visited[k] = 1
      q.push([ni, nj])
    }
  }
  const openCells = walkable.reduce((n, v) => n + v, 0)
  return {
    nx,
    nz,
    cell,
    reachableCells: count,
    openCells,
    isReachable(x, z) {
      // accept any visited cell within 1.6u (covers doors just off the wall)
      const r = Math.ceil(1.6 / cell)
      const ci = Math.floor((x - minX) / cell)
      const cj = Math.floor((z - minZ) / cell)
      for (let di = -r; di <= r; di++)
        for (let dj = -r; dj <= r; dj++) {
          const i = ci + di
          const j = cj + dj
          if (i < 0 || j < 0 || i >= nx || j >= nz) continue
          if (visited[idx(i, j)]) return true
        }
      return false
    },
  }
}

/* ----------------------------- SVG preview ---------------------------- */

function toSvg(topology, layout) {
  const { minX, maxX, minZ, maxZ } = topology.bounds
  const W = 720
  const scale = W / (maxX - minX)
  const H = (maxZ - minZ) * scale
  const X = (x) => round((x - minX) * scale)
  const Y = (z) => round((z - minZ) * scale)
  const parts = []
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${round(H)}" viewBox="0 0 ${W} ${round(H)}">`,
  )
  parts.push(`<rect width="${W}" height="${round(H)}" fill="#d9c7a3"/>`)
  // streets
  for (const s of layout.streets) {
    parts.push(
      `<rect x="${X(s.x - s.w / 2)}" y="${Y(s.z - s.d / 2)}" width="${round(s.w * scale)}" height="${round(
        s.d * scale,
      )}" fill="#b9a079"/>`,
    )
  }
  // plaza
  parts.push(
    `<circle cx="${X(0)}" cy="${Y(0)}" r="${round(layout.plazaR * scale)}" fill="#e3d3ad" stroke="#9c8462"/>`,
  )
  // blockers
  for (const b of topology.blockers) {
    const isFount = b.w <= 3.5 && b.x === 0 && b.z === 0
    parts.push(
      `<rect x="${X(b.x - b.w / 2)}" y="${Y(b.z - b.d / 2)}" width="${round(b.w * scale)}" height="${round(
        b.d * scale,
      )}" fill="${isFount ? "#6f9fb0" : "#a98b5c"}" stroke="#7a623f"/>`,
    )
  }
  // anchors
  const col = {
    npc_station: "#1f6f43",
    vendor: "#b8470e",
    portal: "#7a2fb0",
    bench: "#8a6d3b",
    decor: "#444",
    spawn: "#c00",
  }
  for (const a of topology.anchors) {
    parts.push(`<circle cx="${X(a.x)}" cy="${Y(a.z)}" r="3" fill="${col[a.role] ?? "#000"}"/>`)
  }
  for (const s of topology.spawns) {
    parts.push(
      `<circle cx="${X(s.x)}" cy="${Y(s.z)}" r="5" fill="none" stroke="#c00" stroke-width="2"/>`,
    )
  }
  parts.push("</svg>")
  return parts.join("\n")
}

/* ------------------------------- merge -------------------------------- */

/**
 * mergeSceneSkin — preserve the SCENE author's fields while keeping the derived,
 * anchor-ID-keyed skins in sync with the (re)generated topology.
 *
 * The generator only authoritatively owns `anchorSkins` + `npcSkins` (they are
 * pure functions of the anchor set). Everything else in the scene file —
 * `palette`, `sky`, `landmark`, `buildingStyle`, `setting`, `narrativeBlurb`,
 * `themeId` — is owned by the scene author and is PRESERVED verbatim if the file
 * already exists. A fresh file falls back to the fully-generated scene.
 */
function mergeSceneSkin(scenePath, generated) {
  if (!existsSync(scenePath)) return generated
  let existing
  try {
    existing = JSON.parse(readFileSync(scenePath, "utf8"))
  } catch {
    return generated
  }
  // Keep all of the author's fields; refresh ONLY the anchor-derived skins so
  // they always match the current topology's anchor IDs.
  return {
    ...existing,
    id: existing.id ?? generated.id,
    topologyId: generated.topologyId,
    anchorSkins: generated.anchorSkins,
    npcSkins: generated.npcSkins,
  }
}

/* ------------------------------- main --------------------------------- */

function summarize(topology) {
  const by = {}
  for (const a of topology.anchors) by[a.role] = (by[a.role] ?? 0) + 1
  return by
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const { topology, scene, buildingLookup, layout } = generate(args)
  const v = validate(topology)
  const roles = summarize(topology)

  console.log("=== plaza-grand ===")
  console.log(`seed=${args.seed} size=${args.size} districts=${args.districts}`)
  console.log(
    `bounds: x[${topology.bounds.minX},${topology.bounds.maxX}] z[${topology.bounds.minZ},${topology.bounds.maxZ}]`,
  )
  console.log(`blockers (buildings+fountain): ${topology.blockers.length}`)
  console.log(`streets: ${layout.streets.length}  block-cells: ${layout.cells.length}`)
  console.log(`anchors by role:`, roles)
  console.log(`spawns: ${topology.spawns.length}`)
  console.log(
    `walkability: ${v.reach.reachableCells}/${v.reach.openCells} open cells reachable from spawn`,
  )
  console.log(v.ok ? "VALIDATION: OK ✔" : `VALIDATION: ${v.issues.length} ISSUE(S):`)
  v.issues.forEach((i) => console.log("  - " + i))

  if (!v.ok) process.exitCode = 1

  if (args.write) {
    const tPath = resolve(ROOT, "content/topologies/plaza-grand.json")
    const sPath = resolve(ROOT, "content/scenes/antigua-grand.json")
    const bPath = resolve(ROOT, "content/buildings/plaza-grand.json")
    const svgPath = resolve(ROOT, "qa/plaza-grand.svg")
    mkdirSync(dirname(bPath), { recursive: true })
    writeFileSync(tPath, JSON.stringify(topology, null, 2) + "\n")
    // The Scene file is the SCENE author's artifact (it carries hand/agent-tuned
    // `sky` / `landmark` / `buildingStyle` / palette divergence on top of the
    // derived skin). Regenerating the topology must NOT clobber those. So MERGE:
    // refresh only the deterministic, anchor-ID-keyed `anchorSkins`/`npcSkins`
    // (which track the topology) and KEEP every other field the file already has.
    const sceneOut = mergeSceneSkin(sPath, scene)
    writeFileSync(sPath, JSON.stringify(sceneOut, null, 2) + "\n")
    writeFileSync(
      bPath,
      JSON.stringify(
        {
          topologyId: "plaza-grand",
          generatedBy: "scripts/genMap.mjs",
          params: args,
          doors: buildingLookup,
        },
        null,
        2,
      ) + "\n",
    )
    writeFileSync(svgPath, toSvg(topology, layout))
    console.log(`\nwrote:\n  ${tPath}\n  ${sPath}\n  ${bPath}\n  ${svgPath}`)
  }
}

main()
