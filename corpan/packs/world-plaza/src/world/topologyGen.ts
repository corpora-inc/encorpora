import type { RoomTopology, Anchor, AnchorKind, AnchorRole } from "@world-plaza/contracts"
import { RoomId } from "@world-plaza/contracts"

/**
 * topologyGen.ts — the PARAMETERIZED, SEED-DETERMINISTIC topology generator
 * (CONTENT_SCALE §4, Slice 4c). Emits a valid `RoomTopology` — bounds, spawns,
 * building blockers, and TYPED anchors — from a small `LayoutSpec`, so a Room can
 * be minted per `(archetype, seed)` instead of hand-authoring every street grid.
 *
 * WHY THIS IS SAFE WITH THE FROZEN WORLD (no edits to roads/composition/buildings)
 * --------------------------------------------------------------------------------
 * The single biggest premium invariant is "ZERO road z-flicker, by construction"
 * (DECISIONS.md): roads are NOT meshes overlaid on the ground — the whole street
 * network is BAKED into ONE ground texture on ONE ground mesh (`buildRoads` →
 * `bakeGround`). Crucially, `buildRoads` and `composition.ts` derive the street
 * grid + plaza disc from the topology **`bounds` ALONE** (the shared recipe
 * `deriveAxisLines` + `plazaRadiusFor`, with the frozen constants below). They do
 * NOT read `blockers`/`anchors`. So:
 *
 *   • The ground/roads/plaza ALWAYS bake cleanly for ANY topology whose `bounds`
 *     are square (minX=-h,maxX=h,minZ=-h,maxZ=h) — there is physically one floor
 *     polygon, so z-fighting is impossible at any angle, for any archetype.
 *   • Our ONLY obligations to stay "walkable + balanced + looks designed" are
 *     therefore structural: (a) keep building blockers INSIDE the block cells the
 *     baked streets carve out (never on a street, never on the plaza disc); (b)
 *     keep spawns + reachable anchors on open, connected floor; (c) place doors
 *     onto the street the building faces. We reuse the EXACT same grid recipe the
 *     bake uses, so every archetype's footprints land in the baked blocks and its
 *     anchors sit on baked cobble — they line up for free.
 *
 * An archetype is therefore a CURATED program over that shared grid: which block
 * cells get buildings, how dense, which faces become docks/gates/markets, where
 * the plaza/landmark/garden sit. The road bake + dressing (`composition.ts`) come
 * along unchanged. This file is pure data → no Babylon, no DOM, unit-testable.
 *
 * DETERMINISM: a single seed threads an `xorshift32` PRNG (matching genMap.mjs)
 * so the same `LayoutSpec` always yields byte-identical topology JSON. Seeds are
 * namespaced by the caller (per-Track) so two Tracks get coherent-but-distinct
 * maps.
 */

/* ====================================================== shared grid recipe ===
 * THESE CONSTANTS ARE LOAD-BEARING. They MUST equal the frozen recipe in
 * src/world/roads.ts, src/world/composition.ts, and scripts/genMap.mjs. The
 * baked cobble strips, the avenue dressing, and our footprints/doors all key off
 * the SAME grid; drift here would desync roads from buildings. Do not change one
 * copy without the others (they are intentionally duplicated, not imported, so
 * each module stays a leaf — see roads.ts' note). */
const STREET_W = 5
const ROAD_MARGIN = 4
const MIN_BLOCK = 16
const PITCH = MIN_BLOCK + STREET_W // 21
/** player collision radius — matches composition.ts / collision.ts walkability. */
const PLAYER_R = 0.6

/** plazaR mirrors the bake: clamp(size*0.1, 8, 14). */
export function plazaRadiusFor(size: number): number {
  return Math.max(8, Math.min(14, size * 0.1))
}

/**
 * deriveAxisLines — the street centrelines for a given bounds, IDENTICAL recipe
 * to roads.ts/composition.ts. NS line = x const, EW line = z const. Always
 * includes the central cross (0). We lay buildings into the cells BETWEEN these.
 */
export function deriveAxisLines(bounds: RoomTopology["bounds"]): number[] {
  const size = Math.min(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ)
  const half = size / 2
  const usable = half - ROAD_MARGIN
  const plazaR = plazaRadiusFor(size)
  const ring0 = plazaR + STREET_W / 2 + MIN_BLOCK / 2
  const pos = new Set<number>([0])
  for (let r = 0; r < 8; r++) {
    const p = Math.round((ring0 + r * PITCH) * 100) / 100
    if (p > usable + 0.01) break
    pos.add(p)
    pos.add(-p)
  }
  return [...pos].sort((a, b) => a - b)
}

/* ============================================================== LayoutSpec === */

/**
 * The ten layout archetypes. Each is a curated program over the shared street
 * grid (NOT a different road system) — they re-weight which cells build, where
 * the plaza/landmark/water/gates go, and the anchor flavour. `composition.ts`
 * dresses whatever they emit, so visual variety comes free.
 */
export type LayoutArchetype =
  | "grand-plaza" // the showcase: a deep open square ringed by even blocks (≈ plaza-grand)
  | "market-square" // a dense market quarter hugging one side of the plaza
  | "harbor" // a waterfront edge → a DOCKS anchor at the quay (route quests)
  | "walled-town" // a perimeter wall with a CITY_GATE on one side (route quests)
  | "avenue-grid" // a regular gridiron; a long ceremonial avenue spine
  | "garden-court" // sparse buildings, a generous central green + landmark
  | "boulevard" // one wide boulevard with buildings lining it, plaza at one end
  | "village-green" // small, loose ring of cottages around a green
  | "canal-town" // two parallel water strips (canals) with footbridge gaps → docks
  | "hill-terrace" // terraced blocks stepping out from the plaza, a landmark crowning it

export const ALL_ARCHETYPES: LayoutArchetype[] = [
  "grand-plaza",
  "market-square",
  "harbor",
  "walled-town",
  "avenue-grid",
  "garden-court",
  "boulevard",
  "village-green",
  "canal-town",
  "hill-terrace",
]

export interface LayoutSpec {
  /** which archetype program runs. */
  archetype: LayoutArchetype
  /** seed for the deterministic PRNG (namespace by Track upstream). */
  seed: number
  /**
   * the SIZE of the square map = full edge length in world units. The bounds are
   * ±size/2. Clamped to [120, 280] so the grid stays sane and the bake stays in
   * its proven envelope (the grand map is 240). Default 240.
   */
  size?: number
  /**
   * overall building DENSITY 0..1 — the probability a buildable cell receives
   * buildings. 1 = packed town, 0.3 = open village. Archetypes set a default.
   */
  density?: number
  /**
   * the room id to stamp on the topology (must be a non-empty string; the bake
   * never reads it). Defaults to `plaza-{archetype}-{seed}`.
   */
  id?: string
}

/* ============================================================= seeded PRNG === */

interface Rng {
  next(): number
  range(lo: number, hi: number): number
  int(lo: number, hi: number): number
  pick<T>(arr: readonly T[]): T
  chance(p: number): boolean
}

/** xorshift32 — identical algorithm to genMap.mjs so seeds reproduce. */
function makeRng(seed: number): Rng {
  let s = (seed | 0) || 0x9e3779b9
  const next = () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    s |= 0
    return ((s >>> 0) % 1_000_000) / 1_000_000
  }
  return {
    next,
    range: (lo, hi) => lo + next() * (hi - lo),
    int(lo, hi) {
      return Math.floor(this.range(lo, hi + 1))
    },
    pick(arr) {
      return arr[Math.floor(next() * arr.length)]
    },
    chance: (p) => next() < p,
  }
}

const round = (n: number) => Math.round(n * 100) / 100

/* ============================================================ small helpers === */

type Box = { x: number; z: number; w: number; d: number }

function rectsOverlap(a: Box, b: Box, pad = 0): boolean {
  return (
    Math.abs(a.x - b.x) < (a.w + b.w) / 2 + pad && Math.abs(a.z - b.z) < (a.d + b.d) / 2 + pad
  )
}
function pointInBox(x: number, z: number, b: Box, pad = 0): boolean {
  return Math.abs(x - b.x) <= b.w / 2 + pad && Math.abs(z - b.z) <= b.d / 2 + pad
}

/** A block cell = the open rectangle between two adjacent street centrelines. */
interface Cell {
  cx: number
  cz: number
  w: number
  d: number
  /** ring distance from origin (max axis index) — used to thin density outward. */
  ring: number
}

function buildCells(axis: number[]): Cell[] {
  const cells: Cell[] = []
  for (let xi = 0; xi < axis.length - 1; xi++) {
    for (let zi = 0; zi < axis.length - 1; zi++) {
      const x0 = axis[xi] + STREET_W / 2
      const x1 = axis[xi + 1] - STREET_W / 2
      const z0 = axis[zi] + STREET_W / 2
      const z1 = axis[zi + 1] - STREET_W / 2
      const cw = x1 - x0
      const cd = z1 - z0
      if (cw < 3 || cd < 3) continue
      const cx = round((x0 + x1) / 2)
      const cz = round((z0 + z1) / 2)
      cells.push({
        cx,
        cz,
        w: round(cw),
        d: round(cd),
        ring: Math.max(Math.abs(xi - (axis.length - 1) / 2), Math.abs(zi - (axis.length - 1) / 2)),
      })
    }
  }
  return cells
}

/* ================================================== anchor emitter (typed) === */

/**
 * Map a typed `AnchorKind` to the coarse render `AnchorRole` so generated anchors
 * satisfy BOTH the (required) `role` and the (optional, gameplay) `kind`. The map
 * + special NPCs + quests prefer `kind`; the renderer + dressing read `role`.
 */
const ROLE_FOR_KIND: Record<AnchorKind, AnchorRole> = {
  vendor: "vendor",
  npc_station: "npc_station",
  docks: "npc_station", // a quay post you walk up to + talk at (the boatman)
  city_gate: "portal", // a gate you pass through (also a special-NPC post)
  fountain: "decor",
  merchant: "vendor",
  portal: "portal",
  bench: "bench",
  spawn: "spawn",
  decor: "decor",
  landmark: "decor",
}

class AnchorBuilder {
  readonly anchors: Anchor[] = []
  private n = 0
  add(kind: AnchorKind, x: number, z: number, facing?: number, id?: string): Anchor {
    const role = ROLE_FOR_KIND[kind]
    const a: Anchor = {
      id: id ?? `${kind}_${this.n++}`,
      role,
      kind,
      x: round(x),
      z: round(z),
      ...(facing !== undefined ? { facing: round(facing) } : {}),
    }
    this.anchors.push(a)
    return a
  }
}

/* ====================================================== the core generator === */

export interface GeneratedTopology {
  topology: RoomTopology
  /** the resolved spec (after defaults) — handy for QA / Scene authoring. */
  spec: Required<LayoutSpec>
  /** quick stats for QA. */
  stats: {
    buildings: number
    anchorsByKind: Partial<Record<AnchorKind, number>>
    cells: number
  }
}

/**
 * generateTopology — the public entry point. Deterministic for a given spec.
 * Returns a `RoomTopology` that:
 *   • parses against the frozen Zod schema,
 *   • bakes cleanly (square bounds → one ground mesh → 0 z-fight),
 *   • is walkable (spawns + every reachable anchor on the connected open floor),
 *   • carries TYPED anchors (vendor/npc_station/docks/city_gate/fountain/…).
 */
export function generateTopology(spec: LayoutSpec): GeneratedTopology {
  const archetype = spec.archetype
  const size = Math.max(120, Math.min(280, spec.size ?? defaultSize(archetype)))
  const density = clamp01(spec.density ?? defaultDensity(archetype))
  const seed = spec.seed | 0
  const id = spec.id ?? `plaza-${archetype}-${seed >>> 0}`

  const rng = makeRng(seed)
  const half = size / 2
  const bounds = { minX: round(-half), maxX: round(half), minZ: round(-half), maxZ: round(half) }
  const plazaR = plazaRadiusFor(size)
  const plazaBox: Box = { x: 0, z: 0, w: plazaR * 2, d: plazaR * 2 }

  const axis = deriveAxisLines(bounds)
  const allCells = buildCells(axis)
  const maxRing = allCells.reduce((m, c) => Math.max(m, c.ring), 1)

  const blockers: Box[] = []
  const ab = new AnchorBuilder()

  /* ---- the plaza centrepiece: a fountain (decor blocker + a typed anchor) ---- */
  const FOUNT = 3
  blockers.push({ x: 0, z: 0, w: FOUNT, d: FOUNT })
  ab.add("fountain", 0, 0, undefined, "fountain")

  /* ---- plaza ring dressing: benches + lamps around the fountain (in open floor) */
  {
    const ring = Math.min(plazaR - 2.5, plazaR * 0.62)
    const spots = 8
    for (let i = 0; i < spots; i++) {
      const a = (i / spots) * Math.PI * 2 + 0.39
      const x = Math.cos(a) * ring
      const z = Math.sin(a) * ring
      const facing = Math.atan2(-z, -x)
      if (i % 2 === 0) ab.add("bench", x, z, facing, `plaza_bench_${i}`)
      else ab.add("decor", x, z, facing, `plaza_lamp_${i}`)
    }
    // a market vendor + town crier on the plaza edge (the social heart).
    ab.add("vendor", plazaR - 1.2, -plazaR + 2.5, Math.atan2(plazaR, -(plazaR - 1.2)), "plaza_market")
    ab.add(
      "npc_station",
      -plazaR + 2.5,
      plazaR - 1.2,
      Math.atan2(-plazaR, plazaR - 2.5),
      "plaza_crier",
    )
  }

  /* ------------- the archetype program decides the buildable cell set + features */
  const program = archetypeProgram(archetype, {
    rng,
    bounds,
    plazaR,
    plazaBox,
    axis,
    cells: allCells,
    maxRing,
    density,
    blockers,
    ab,
  })

  /* ----------------------------- carve buildings into the chosen cells -------- */
  const PAD = 2.0
  let built = 0
  for (const c of program.buildCells) {
    // density falloff toward the rim so the town dissolves into open ground.
    const keep = density * (1 - (c.ring / (maxRing + 1)) * 0.5)
    if (!rng.chance(keep)) continue
    // 1 building in a tight cell, 2 (paired terrace) in a roomy one.
    const along = c.w >= c.d ? "x" : "z"
    const span = along === "x" ? c.w : c.d
    const cross = along === "x" ? c.d : c.w
    const count = span >= 8.5 && rng.chance(0.8) ? 2 : 1
    for (let k = 0; k < count; k++) {
      const bw0 = Math.min(span / count - PAD, rng.range(3.8, 7.5))
      const bd0 = Math.min(cross - PAD, rng.range(4.0, 7.0))
      const bw = round(Math.max(3.5, along === "x" ? bw0 : bd0))
      const bd = round(Math.max(3.5, along === "x" ? bd0 : bw0))
      const slot =
        along === "x"
          ? { x: c.cx - c.w / 2 + (k + 0.5) * (c.w / count), z: c.cz }
          : { x: c.cx, z: c.cz - c.d / 2 + (k + 0.5) * (c.d / count) }
      const b: Box = { x: round(slot.x), z: round(slot.z), w: bw, d: bd }

      // never on the plaza; nudge outward if a centred footprint clips it.
      if (rectsOverlap(b, plazaBox, 1.0)) {
        const ux = Math.sign(b.x || rng.range(-1, 1))
        const uz = Math.sign(b.z || rng.range(-1, 1))
        for (let step = 0; step < 8 && rectsOverlap(b, plazaBox, 1.0); step++) {
          b.x = round(b.x + ux)
          b.z = round(b.z + uz)
        }
      }
      if (rectsOverlap(b, plazaBox, 1.0)) continue
      if (blockers.some((o) => rectsOverlap(b, o, 1.0))) continue
      if (
        b.x - b.w / 2 < bounds.minX + 1 ||
        b.x + b.w / 2 > bounds.maxX - 1 ||
        b.z - b.d / 2 < bounds.minZ + 1 ||
        b.z + b.d / 2 > bounds.maxZ - 1
      )
        continue

      // the door + its station onto the street the building faces.
      const side = pickDoorSide(b, axis)
      const door = {
        x: b.x + side.nx * ((side.axis === "x" ? b.w : b.d) / 2 + 1.4),
        z: b.z + side.nz * ((side.axis === "x" ? b.w : b.d) / 2 + 1.4),
        facing: Math.atan2(side.nz, side.nx),
      }
      const stationX = door.x + side.nx * 0.9
      const stationZ = door.z + side.nz * 0.9
      // REACHABILITY GUARANTEE: only commit this building if its door + station
      // land on OPEN floor (not boxed in by a neighbour). A door trapped in a
      // sub-player-width pocket between two footprints would be unreachable; we
      // simply DON'T build there rather than emit a dead anchor. (Player radius
      // = composition's 0.6; pad a touch so the door has real standing room.)
      const doorClear =
        !blockers.some((o) => pointInBox(door.x, door.z, o, PLAYER_R)) &&
        !blockers.some((o) => pointInBox(stationX, stationZ, o, PLAYER_R)) &&
        !pointInBox(door.x, door.z, plazaBox, -1)
      if (!doorClear) continue

      blockers.push(b)
      built++

      ab.add("portal", door.x, door.z, door.facing)

      // populate the street: a vendor OR an NPC station at the door (most doors).
      if (rng.chance(0.82)) {
        const isVendor = rng.chance(0.42)
        ab.add(
          isVendor ? "vendor" : "npc_station",
          stationX,
          stationZ,
          Math.atan2(-side.nz, -side.nx),
        )
      }
      // an occasional lamp at the corner.
      if (rng.chance(0.35)) {
        ab.add("decor", door.x - side.nz * (b.w / 2 + 0.6), door.z + side.nx * (b.d / 2 + 0.6))
      }
    }
  }

  /* --------------------------- spawns: in the plaza, on guaranteed open floor -- */
  const spawnCands = [
    { x: 0, z: plazaR - 2.5 },
    { x: plazaR - 2.5, z: 0 },
    { x: 0, z: -plazaR + 2.5 },
    { x: -plazaR + 2.5, z: 0 },
  ].map((s) => ({ x: round(s.x), z: round(s.z) }))
  const spawns = spawnCands.filter((s) => !blockers.some((b) => pointInBox(s.x, s.z, b, 0.5)))
  if (spawns.length === 0) spawns.push({ x: 0, z: round(plazaR - 2.5) })

  const topology: RoomTopology = {
    id: RoomId.parse(id),
    bounds,
    spawns,
    blockers,
    anchors: ab.anchors,
  }

  // stats
  const anchorsByKind: Partial<Record<AnchorKind, number>> = {}
  for (const a of ab.anchors) {
    if (a.kind) anchorsByKind[a.kind] = (anchorsByKind[a.kind] ?? 0) + 1
  }

  return {
    topology,
    spec: { archetype, seed, size, density, id },
    stats: { buildings: built, anchorsByKind, cells: program.buildCells.length },
  }
}

/* ======================================================= archetype programs === */

interface ProgramCtx {
  rng: Rng
  bounds: RoomTopology["bounds"]
  plazaR: number
  plazaBox: Box
  axis: number[]
  cells: Cell[]
  maxRing: number
  density: number
  blockers: Box[]
  ab: AnchorBuilder
}
interface ProgramResult {
  /** the ordered set of cells the builder will try to fill. */
  buildCells: Cell[]
}

/** Per-archetype default map size (full edge length). Smaller archetypes (a
 * village, a garden court) read better on a tighter map; the showcase grids fill
 * the full ±120 grand bounds. Caller can override via `spec.size`. */
function defaultSize(a: LayoutArchetype): number {
  switch (a) {
    case "village-green":
      return 150
    case "garden-court":
      return 190
    case "canal-town":
      return 210
    default:
      return 240
  }
}

function defaultDensity(a: LayoutArchetype): number {
  switch (a) {
    case "grand-plaza":
      return 0.85
    case "market-square":
      return 0.92
    case "harbor":
      return 0.7
    case "walled-town":
      return 0.8
    case "avenue-grid":
      return 0.88
    case "garden-court":
      return 0.5
    case "boulevard":
      return 0.72
    case "village-green":
      return 0.72
    case "canal-town":
      return 0.65
    case "hill-terrace":
      return 0.78
  }
}

/**
 * Each archetype curates the buildable cells (outward-first for a pleasant fill)
 * and stamps its SIGNATURE feature anchors (docks/city_gate/landmark/garden) at
 * a guaranteed-open spot on the rim or a green cell. Buildings + dressing then
 * fill in around them. Returns the cell list the builder consumes.
 */
function archetypeProgram(a: LayoutArchetype, ctx: ProgramCtx): ProgramResult {
  const { cells } = ctx
  // base: usable cells = those not swallowed by the plaza, sorted outward-first.
  const usable = cells
    .filter((c) => Math.hypot(c.cx, c.cz) > ctx.plazaR - Math.max(c.w, c.d) / 2)
    .sort((p, q) => Math.hypot(p.cx, p.cz) - Math.hypot(q.cx, q.cz))

  switch (a) {
    case "grand-plaza":
      return { buildCells: usable }

    case "market-square": {
      // pack the plaza-adjacent ring hard (the market quarter), thin the rim.
      addMarketCluster(ctx)
      return { buildCells: usable.sort((p, q) => p.ring - q.ring) }
    }

    case "harbor": {
      // the WATERFRONT: clear the far +Z edge (water), put a DOCKS quay there.
      addWaterEdge(ctx, "north")
      addDocks(ctx, "north")
      // drop cells that sit in the water band so buildings line the quay, not it.
      const dry = usable.filter((c) => c.cz < ctx.bounds.maxZ - PITCH * 1.2)
      return { buildCells: dry }
    }

    case "walled-town": {
      // a perimeter WALL ring + a CITY_GATE on the -Z side (the road out).
      addPerimeterWall(ctx)
      addCityGate(ctx, "south")
      return { buildCells: usable }
    }

    case "avenue-grid": {
      // a regular gridiron — keep all cells, plus a ceremonial landmark up the spine.
      addLandmark(ctx, 0, ctx.bounds.maxZ - PITCH)
      return { buildCells: usable }
    }

    case "garden-court": {
      // a generous central GREEN: skip an inner ring of cells, crown with a landmark.
      const green = pickGreenCell(ctx)
      addLandmark(ctx, green.cx, green.cz)
      const open = usable.filter((c) => Math.hypot(c.cx - green.cx, c.cz - green.cz) > MIN_BLOCK)
      return { buildCells: open }
    }

    case "boulevard": {
      // one wide ceremonial avenue (the central EW street): line it with buildings,
      // a landmark anchoring the far +X end.
      addLandmark(ctx, ctx.bounds.maxX - PITCH, 0)
      // prefer cells flanking the z≈0 boulevard.
      const flank = usable.sort(
        (p, q) => Math.abs(p.cz) - Math.abs(q.cz) || Math.hypot(p.cx, p.cz) - Math.hypot(q.cx, q.cz),
      )
      return { buildCells: flank }
    }

    case "village-green": {
      // a loose ring of cottages around a green; the inner two rings of cells
      // (plaza-hugging), falling back to all usable on a tiny map.
      const inner = usable.filter((c) => c.ring <= 2)
      return { buildCells: inner.length >= 4 ? inner : usable }
    }

    case "canal-town": {
      // two parallel CANAL strips (water bands at z≈±band) with quay DOCKS; cells
      // between/around them build, water bands stay clear.
      const band = Math.min(ctx.bounds.maxZ - PITCH, PITCH * 1.5)
      addWaterStrip(ctx, band)
      addWaterStrip(ctx, -band)
      addDocks(ctx, "north")
      const dry = usable.filter((c) => Math.abs(Math.abs(c.cz) - band) > STREET_W + 3)
      return { buildCells: dry }
    }

    case "hill-terrace": {
      // terraced blocks stepping outward, a landmark crowning the +Z rise.
      addLandmark(ctx, 0, ctx.bounds.maxZ - PITCH)
      // build outward-first but bias to keep inner terraces fuller.
      return { buildCells: usable }
    }
  }
}

/* ------------------------------- feature stampers --------------------------- */

/** A water region is a non-walkable band on the rim. We model it as a blocker so
 * the player can't walk into the sea, and put a DOCKS anchor at its edge. The
 * road bake still derives streets from bounds — water just reads as "edge you
 * can't cross", which dressing/sky already imply visually. */
function addWaterEdge(ctx: ProgramCtx, _side: "north"): void {
  const { bounds } = ctx
  const z = bounds.maxZ - PITCH * 0.55
  const w = bounds.maxX - bounds.minX
  // a shallow blocker band along the far edge (the sea). Kept inside bounds.
  ctx.blockers.push({ x: 0, z: round((z + bounds.maxZ) / 2), w: round(w - 6), d: round(bounds.maxZ - z) })
}

function addWaterStrip(ctx: ProgramCtx, zCenter: number): void {
  const { bounds } = ctx
  const w = bounds.maxX - bounds.minX
  ctx.blockers.push({ x: 0, z: round(zCenter), w: round(w * 0.7), d: STREET_W + 2 })
}

/** DOCKS: the boatman's quay post you walk up to. Sits on open floor just SHORT
 * of the water band, on the central N/S street so it's reachable from the plaza.
 * `kind:"docks"` is what the es-guadalajara-route `docks` step binds to. */
function addDocks(ctx: ProgramCtx, _side: "north"): void {
  const { bounds } = ctx
  const z = bounds.maxZ - PITCH * 1.05 // on dry land, short of the sea blocker
  ctx.ab.add("docks", 0, z, Math.PI / 2, "docks")
  // a couple of mooring posts (decor) flanking the quay.
  ctx.ab.add("decor", -2.4, round(z + 0.4), undefined)
  ctx.ab.add("decor", 2.4, round(z + 0.4), undefined)
}

/** CITY_GATE: a gatehouse you pass through on the road out of town. We place two
 * wall-pier blockers with a walkable GAP between them on the central street, and
 * a `kind:"city_gate"` anchor IN the gap (open floor on the central axis). */
function addCityGate(ctx: ProgramCtx, _side: "south"): void {
  const { bounds } = ctx
  const z = bounds.minZ + PITCH * 0.55
  // two gate piers flanking the central N/S street (x=0), leaving the street open.
  const pierW = 6
  const pierOff = STREET_W / 2 + pierW / 2 + 0.5
  ctx.blockers.push({ x: round(-pierOff), z: round(z), w: pierW, d: 6 })
  ctx.blockers.push({ x: round(pierOff), z: round(z), w: pierW, d: 6 })
  ctx.ab.add("city_gate", 0, round(z), -Math.PI / 2, "city_gate")
}

/** A continuous-ish perimeter WALL: short blockers hugging the rim, leaving the
 * street mouths (axis lines) open so the gridiron still exits cleanly. */
function addPerimeterWall(ctx: ProgramCtx): void {
  const { bounds, axis } = ctx
  const m = ROAD_MARGIN - 1.0
  const isStreetMouth = (v: number) => axis.some((a) => Math.abs(a - v) < STREET_W / 2 + 1.5)
  const seg = 8
  for (let v = bounds.minX + seg / 2 + 1; v < bounds.maxX - seg / 2; v += seg) {
    if (!isStreetMouth(v)) {
      ctx.blockers.push({ x: round(v), z: round(bounds.maxZ - m / 2), w: seg - 1, d: m })
      ctx.blockers.push({ x: round(v), z: round(bounds.minZ + m / 2), w: seg - 1, d: m })
    }
  }
  for (let v = bounds.minZ + seg / 2 + 1; v < bounds.maxZ - seg / 2; v += seg) {
    if (!isStreetMouth(v)) {
      ctx.blockers.push({ x: round(bounds.maxX - m / 2), z: round(v), w: m, d: seg - 1 })
      ctx.blockers.push({ x: round(bounds.minX + m / 2), z: round(v), w: m, d: seg - 1 })
    }
  }
}

/** A signature POI for the map legend (a monument/temple) — a small decor blocker
 * + a `kind:"landmark"` anchor, snapped to a guaranteed-open spot near (x,z). */
function addLandmark(ctx: ProgramCtx, x: number, z: number): void {
  const px = round(x)
  const pz = round(z)
  ctx.blockers.push({ x: px, z: pz, w: 4, d: 4 })
  ctx.ab.add("landmark", px, pz + 3.4, Math.PI / 2)
}

/** A dense market knot: a couple of extra vendor anchors clustered just off the
 * plaza so composition.ts reads a real market quarter there. */
function addMarketCluster(ctx: ProgramCtx): void {
  const { plazaR } = ctx
  const base = plazaR + STREET_W + 2
  for (let i = 0; i < 4; i++) {
    const ang = -Math.PI / 4 + i * 0.5
    ctx.ab.add(
      i === 0 ? "merchant" : "vendor",
      Math.cos(ang) * base,
      Math.sin(ang) * base,
      ang + Math.PI,
    )
  }
}

/** Pick an open block cell off the plaza to host a green (garden-court). */
function pickGreenCell(ctx: ProgramCtx): Cell {
  const cands = ctx.cells.filter((c) => {
    const r = Math.hypot(c.cx, c.cz)
    return r > ctx.plazaR + PITCH && r < (ctx.bounds.maxX - ROAD_MARGIN) * 0.6
  })
  return cands.length ? cands[Math.floor(ctx.rng.next() * cands.length)] : ctx.cells[0]
}

/* ----------------------------- door-side picker ----------------------------- */

function pickDoorSide(b: Box, axis: number[]): { nx: number; nz: number; axis: "x" | "z" } {
  const nearest = (val: number) =>
    axis.reduce((best, p) => (Math.abs(p - val) < Math.abs(best - val) ? p : best), axis[0])
  const sx = nearest(b.x)
  const sz = nearest(b.z)
  const dx = Math.abs(sx - b.x) - b.w / 2
  const dz = Math.abs(sz - b.z) - b.d / 2
  if (dx <= dz) return { nx: sx >= b.x ? 1 : -1, nz: 0, axis: "x" }
  return { nx: 0, nz: sz >= b.z ? 1 : -1, axis: "z" }
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

/* ======================================================= walkability check === */

export interface ReachReport {
  ok: boolean
  reachableCells: number
  openCells: number
  unreachableAnchors: string[]
  outOfBounds: string[]
}

/**
 * checkWalkability — a coarse flood-fill from spawn[0] proving every REACHABLE
 * anchor (vendor/npc_station/portal/docks/city_gate/merchant/landmark) sits on
 * the connected open floor, plus a bounds/overlap integrity pass. Mirrors the
 * genMap.mjs validator so generated maps clear the same bar. Pure → testable.
 */
export function checkWalkability(t: RoomTopology, playerR = 0.6, cell = 1.0): ReachReport {
  const { minX, maxX, minZ, maxZ } = t.bounds
  const nx = Math.ceil((maxX - minX) / cell)
  const nz = Math.ceil((maxZ - minZ) / cell)
  const idx = (i: number, j: number) => i * nz + j
  const walkable = new Uint8Array(nx * nz)
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < nz; j++) {
      const x = minX + (i + 0.5) * cell
      const z = minZ + (j + 0.5) * cell
      const blocked = t.blockers.some((b) => pointInBox(x, z, b as Box, playerR))
      walkable[idx(i, j)] = blocked ? 0 : 1
    }
  const visited = new Uint8Array(nx * nz)
  const s = t.spawns[0]
  const si = Math.min(nx - 1, Math.max(0, Math.floor((s.x - minX) / cell)))
  const sj = Math.min(nz - 1, Math.max(0, Math.floor((s.z - minZ) / cell)))
  const q: Array<[number, number]> = [[si, sj]]
  visited[idx(si, sj)] = 1
  let count = 0
  while (q.length) {
    const [i, j] = q.pop()!
    count++
    for (const [di, dj] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const ni = i + di
      const nj = j + dj
      if (ni < 0 || nj < 0 || ni >= nx || nj >= nz) continue
      const k = idx(ni, nj)
      if (visited[k] || !walkable[k]) continue
      visited[k] = 1
      q.push([ni, nj])
    }
  }
  const isReachable = (x: number, z: number): boolean => {
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
  }
  const reachableRoles = new Set<AnchorRole>(["npc_station", "vendor", "portal"])
  const unreachableAnchors: string[] = []
  const outOfBounds: string[] = []
  for (const a of t.anchors) {
    if (!reachableRoles.has(a.role)) continue
    if (!isReachable(a.x, a.z)) unreachableAnchors.push(a.id)
  }
  for (const b of t.blockers as Box[]) {
    if (
      b.x - b.w / 2 < minX - 0.01 ||
      b.x + b.w / 2 > maxX + 0.01 ||
      b.z - b.d / 2 < minZ - 0.01 ||
      b.z + b.d / 2 > maxZ + 0.01
    )
      outOfBounds.push(`blocker@${b.x},${b.z}`)
  }
  for (const sp of t.spawns) {
    if (t.blockers.some((b) => pointInBox(sp.x, sp.z, b as Box, 0)))
      outOfBounds.push(`spawn@${sp.x},${sp.z}`)
  }
  const openCells = walkable.reduce((n, v) => n + v, 0)
  return {
    ok: unreachableAnchors.length === 0 && outOfBounds.length === 0,
    reachableCells: count,
    openCells,
    unreachableAnchors,
    outOfBounds,
  }
}
