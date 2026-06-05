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
  type CityBoundary,
  type CityWallRect,
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

/** width (world-Z) of the walkable RIVERWALK promenade between the buildings and
 *  the water's edge — a real quay you can stroll, not a road bleeding into blue.
 *  env-art DECORATES this band (railings/lamps/foliage); we own its extent. */
const RIVERWALK_W = 16
/** half-width of the walkable BRIDGE corridor cut through the water collider —
 *  matches generateCity's bridge deck (AVENUE_W + 4 wide → +2 each side margin so
 *  the deck reads as comfortably wider than the avenue). */
const BRIDGE_HALF_W = (AVENUE_W + 4) / 2 + 1

/* ------------------------------------------------- crafted boundary (#32) knobs */
// The +Z edge is a RIVER BAND (not water-to-edge): the river is `RIVER_W` wide,
// then a FAR-BANK district (a far promenade + a row of buildings) the bridge
// arrives at, then a sea wall at the very edge. The other three land edges get a
// perimeter rampart inset `WALL_INSET` from the bounds, `WALL_THICK` thick, with
// a GATE where each cardinal avenue passes through. All relative so a later
// world-size bump (#34) keeps a coherent edge.
/** width (world-Z) of the open river BAND between the near and far banks. */
const RIVER_W = 34
/** width (world-Z) of the walkable FAR-BANK promenade (mirror of the near quay). */
const FAR_PROM_W = 12
/** how far the perimeter rampart sits inside the world bounds (land edges). */
const WALL_INSET = 10
/** thickness of the rampart box. */
const WALL_THICK = 4
/** half-width of a gate opening (an avenue passes through it). */
const GATE_HALF_W = AVENUE_W / 2 + 3

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
  /** world-Z of the NEAR water edge; [waterZ, farBankZ) is the open river band. */
  waterZ: number
  /** world-Z where the near riverwalk promenade starts (bankZ < waterZ). The band
   *  [bankZ, waterZ) is the walkable near quay; harbor buildings sit inland. */
  bankZ: number
  /** world-Z of the FAR water edge / far quay — the river ends here. */
  farBankZ: number
  /** world-Z where the far promenade ends and far-bank buildings start. */
  farPromZ: number
}

function buildZoneField(half: number, r: () => number): ZoneField {
  // Harbor sits along the +Z edge (one waterfront). The river is a BAND between
  // the near bank (waterZ) and the far bank (farBankZ); beyond it the far-bank
  // district faces back across the water. The near RIVERWALK promenade band
  // [bankZ, waterZ) is solid quay you can stroll.
  // Keep the near water edge where it was so the near city is unchanged; the band
  // + far bank consume the old water strip out to the wall.
  const waterZ = half - 70
  const bankZ = waterZ - RIVERWALK_W
  const farBankZ = waterZ + RIVER_W
  const farPromZ = farBankZ + FAR_PROM_W
  // District seeds: (x,z, zone) — nearest-seed wins (Voronoi-ish), with the
  // plaza forced at the center and harbor/industrial pinned near the water.
  const seeds: Array<{ x: number; z: number; zone: CityZoneId }> = [
    { x: 0, z: 0, zone: "plaza" },
    { x: -half * 0.55, z: -half * 0.5, zone: "downtown" },
    { x: half * 0.5, z: -half * 0.55, zone: "downtown" },
    { x: -half * 0.6, z: half * 0.2, zone: "residential" },
    { x: half * 0.62, z: half * 0.1, zone: "residential" },
    { x: half * 0.1, z: -half * 0.15, zone: "market" },
    { x: -half * 0.15, z: bankZ - 22, zone: "harbor" },
    { x: half * 0.45, z: bankZ - 24, zone: "industrial" },
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
    // near riverwalk + open river + far-bank district all dress as harbor (stone
    // quay surface + warehouse character) — one coherent waterfront across the river.
    if (z >= bankZ) return "harbor"
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
  return { zoneAt, waterZ, bankZ, farBankZ, farPromZ }
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

/** Build a landmark's hero building(s) + anchor at a snapped block center.
 *  `bankZ` (the riverwalk edge) lets the harbor place its docks ON the promenade
 *  instead of floating its anchor toward the water. */
function buildLandmark(
  plan: LandmarkPlan,
  cx: number,
  cz: number,
  bankZ: number,
): { buildings: CityBuilding[]; anchor: CityAnchor; props: CityProp[] } {
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
    case "harbor": {
      // warehouses set back from the quay; cargo lined up on the LAND side of the
      // riverwalk; docks anchor sits ON the promenade (a touch inland of the
      // water's edge) so the dockmaster + cargo never float on the river (#30).
      buildings.push({ x: cx - 10, z: cz - 6, w: 12, d: 10, kind: "workshop" })
      buildings.push({ x: cx + 10, z: cz - 6, w: 12, d: 10, kind: "workshop" })
      // a line of cargo barrels along the quay, clamped just inland of the bank.
      const cargoZ = Math.min(cz + 8, bankZ - 3)
      for (let i = -3; i <= 3; i++) props.push({ species: "barrel", x: cx + i * 3, z: cargoZ, scale: 1, shadow: 0.6 })
      const dockZ = Math.min(cz + 11, bankZ - 2) // dockmaster stands on the quay
      anchor = { id: "harbor", kind: "docks", x: cx, z: dockZ, facing: Math.PI, label: plan.label }
      break
    }
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
    { id: "harbor", zone: "harbor", fx: -0.1, fz: (zoneField.bankZ - 30) / half, label: "Harbor Docks" },
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
    const lm = buildLandmark(plan, best.x, best.z, zoneField.bankZ)
    allBuildings.push(...lm.buildings)
    allProps.push(...lm.props)
    allAnchors.push(lm.anchor)
    claimed.push({ x: best.x, z: best.z, w: best.w + 4, d: best.d + 4 })
  }

  // bridge anchors at BOTH ends of the crossing (#32): the near approach on the
  // near bank, and the FAR approach on the far bank the bridge arrives at — so
  // "cross the bridge" lands you in more city, never the map edge. The bridge
  // STRUCTURE itself is world-fix (#29); we leave the corridor open in the river
  // collider (makeChunks `bridgeX`) and put walkable land on the far side.
  const bridgeX = 0
  allAnchors.push({ id: "bridge_n", kind: "landmark", x: bridgeX, z: zoneField.bankZ, facing: 0, label: "North Bridge" })
  allAnchors.push({ id: "bridge_s", kind: "landmark", x: bridgeX, z: zoneField.farPromZ, facing: Math.PI, label: "Far Bank" })

  // ---- generic block infill across the grid (skipping claimed blocks) ----
  // A block is skipped when ANY of its footprint reaches the riverwalk band: we
  // keep the promenade [bankZ, waterZ) clear of buildings so it reads as an open
  // quay, and obviously never build on the water itself.
  for (const c of centers) {
    if (claimed.some((cl) => boxesOverlap({ x: c.x, z: c.z, w: c.w, d: c.d }, cl, 0))) continue
    if (c.z + c.d / 2 > zoneField.bankZ) continue // block reaches the riverwalk/water → skip
    const zone = zoneField.zoneAt(c.x, c.z)
    const buildings = fillBlock(c.x, c.z, c.w, c.d, zone, claimed, r)
    allBuildings.push(...buildings)
    allProps.push(...dressBlock(c.x, c.z, c.w, c.d, zone, buildings, r))
  }

  // ---- FAR-BANK DISTRICT (#32): the city the bridge crosses TO. A row of
  // warehouse/quarter buildings facing back across the river, set behind a far
  // promenade, bounded by the sea wall. Kept simple + walkable: a front quay
  // (clear), then buildings in [farPromZ, wallZ), with the bridge corridor left
  // open so you step off the deck onto the far promenade.
  const wallZ = half - WALL_INSET // the sea wall sits just inside the +Z edge
  buildFarBank(zoneField, half, bridgeX, wallZ, r, allBuildings, allProps)

  // DEFENSE-IN-DEPTH (#30): drop any prop that ended up IN THE RIVER band (between
  // the near and far banks) or past the sea wall — landmark/dressing jitter can
  // nudge a barrel/lamp off the quay. Props on either bank are kept; only the open
  // water + the no-man's strip behind the wall are cleared.
  const PROP_BANK_INSET = 1.5
  const inRiver = (z: number): boolean =>
    z > zoneField.bankZ - PROP_BANK_INSET && z < zoneField.farBankZ + PROP_BANK_INSET
  const onLand = (p: CityProp): boolean => !inRiver(p.z) && p.z <= wallZ - PROP_BANK_INSET
  for (let i = allProps.length - 1; i >= 0; i--) {
    if (!onLand(allProps[i])) allProps.splice(i, 1)
  }

  // ---- WALLS (#32): the perimeter rampart on the three LAND edges (south, east,
  // west). The +Z edge is the river/sea (no wall — the water IS the boundary).
  // A gate where the central avenue (x=0 / z=0 line) crosses each edge.
  const boundary: CityBoundary = {
    inset: WALL_INSET,
    thickness: WALL_THICK,
    gates: [
      { side: "south", center: 0, halfWidth: GATE_HALF_W },
      { side: "west", center: 0, halfWidth: GATE_HALF_W },
      { side: "east", center: 0, halfWidth: GATE_HALF_W },
    ],
  }
  pushGateAnchors(boundary, half, allAnchors)

  // ---- partition everything into chunks (by feature CENTER) ----
  const chunks: CityChunk[] = makeChunks(bounds, CHUNK_SIZE, gridDim, zoneField, {
    buildings: allBuildings,
    props: allProps,
    anchors: allAnchors,
    lines,
    waterZ: zoneField.waterZ,
    bankZ: zoneField.bankZ,
    farBankZ: zoneField.farBankZ,
    farPromZ: zoneField.farPromZ,
    bridgeX,
    bridgeHalfW: BRIDGE_HALF_W,
    boundary,
    wallZ,
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
    water: {
      waterZ: zoneField.waterZ,
      bankZ: zoneField.bankZ,
      farBankZ: zoneField.farBankZ,
      farPromZ: zoneField.farPromZ,
      bridgeX,
      bridgeHalfW: BRIDGE_HALF_W,
      // The deck spans near promenade → where far-bank LAND begins (z1 = farBankZ),
      // ramping onto walkable ground at both ends; water passes under [waterZ,
      // farBankZ]. Single source of truth so the bridge mesh + collider gap agree.
      deck: { z0: zoneField.bankZ, z1: zoneField.farBankZ, x: bridgeX, halfW: BRIDGE_HALF_W },
    },
    boundary,
    baseSurfaceByZone: BASE_SURFACE_BY_ZONE,
  }
}

/* ------------------------------------------------------ far bank + gates (#32) */

/**
 * Build the FAR-BANK district the bridge crosses to: a row of warehouse-style
 * buildings facing back across the river, set behind a clear far promenade and in
 * front of the sea wall, with the bridge corridor kept open so you step off the
 * deck onto walkable far ground. Deterministic; appends to the shared arrays.
 */
function buildFarBank(
  zf: ZoneField,
  half: number,
  bridgeX: number,
  wallZ: number,
  r: () => number,
  buildings: CityBuilding[],
  props: CityProp[],
): void {
  const z0 = zf.farPromZ // buildings start behind the far promenade
  const z1 = wallZ - 2 // and stop short of the sea wall
  const depth = z1 - z0
  if (depth < 6) return
  const cz = (z0 + z1) / 2
  const d = Math.min(depth, 12)
  // a run of warehouses across the far bank, leaving the bridge mouth clear.
  const x0 = -half + WALL_INSET + 6
  const x1 = half - WALL_INSET - 6
  const stepW = 26
  for (let x = x0; x <= x1; x += stepW) {
    // skip the building that would block the bridge mouth (keep the deck arrival open).
    if (Math.abs(x - bridgeX) < BRIDGE_HALF_W + 10) continue
    const w = 14 + r() * 6
    buildings.push({ x, z: cz, w, d, kind: r() < 0.5 ? "workshop" : "market-hall", door: { x, z: z0 - 2 } })
    // a couple of cargo props on the far quay in front of each warehouse.
    props.push({ species: "crate", x: x - 4, z: z0 - 2.5, scale: 1, shadow: 0.6 })
    props.push({ species: "barrel", x: x + 4, z: z0 - 2.5, scale: 1, shadow: 0.6 })
  }
}

/** Drop a GATE anchor at each wall opening (map legend + a place to dress towers). */
function pushGateAnchors(boundary: CityBoundary, half: number, anchors: CityAnchor[]): void {
  const inner = half - boundary.inset
  for (const g of boundary.gates) {
    const pos =
      g.side === "south"
        ? { x: g.center, z: -inner }
        : g.side === "west"
          ? { x: -inner, z: g.center }
          : { x: inner, z: g.center } // east
    anchors.push({ id: `gate_${g.side}`, kind: "landmark", x: pos.x, z: pos.z, facing: 0, label: `${cap(g.side)} Gate` })
  }
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

/* ------------------------------------------------------- chunk partitioning */

interface ChunkInput {
  buildings: CityBuilding[]
  props: CityProp[]
  anchors: CityAnchor[]
  lines: number[]
  waterZ: number
  bankZ: number
  farBankZ: number
  farPromZ: number
  bridgeX: number
  bridgeHalfW: number
  boundary: CityBoundary
  /** world-Z of the sea wall (the +Z far edge wall). */
  wallZ: number
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
        water: [],
        walls: [],
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
      // ── RIVERWALK promenade: a solid stone quay across the bank band
      // [bankZ, waterZ) so the waterfront reads as a walkable promenade, not a
      // road bleeding into blue. Baked for any chunk that overlaps the band. The
      // band is WALKABLE land (no water collider here) and env-art dresses it.
      if (b.maxZ > zoneField.bankZ && b.minZ < zoneField.waterZ) {
        const rz0 = Math.max(b.minZ, zoneField.bankZ)
        const rz1 = Math.min(b.maxZ, zoneField.waterZ)
        if (rz1 > rz0) {
          ch.ground.push({
            kind: "rect",
            surface: "stone",
            cx: (b.minX + b.maxX) / 2,
            cz: (rz0 + rz1) / 2,
            w: chunkSize,
            d: rz1 - rz0,
            metersPerTile: 3.2,
          })
        }
      }
      // ── RIVER BAND (#30/#32): the open river occupies [waterZ, farBankZ) — a
      // BAND, not water-to-the-edge. A chunk overlapping it paints blue river over
      // that clipped span AND emits a non-walkable collision rect (with the bridge
      // corridor carved out). Beyond farBankZ is the FAR BANK (land), not water.
      if (b.maxZ > zoneField.waterZ && b.minZ < zoneField.farBankZ) {
        const wz0 = Math.max(b.minZ, zoneField.waterZ)
        const wz1 = Math.min(b.maxZ, zoneField.farBankZ)
        if (wz1 > wz0) {
          ch.ground.push({
            kind: "rect",
            surface: "water",
            cx: (b.minX + b.maxX) / 2,
            cz: (wz0 + wz1) / 2,
            w: chunkSize,
            d: wz1 - wz0,
            metersPerTile: 6,
          })
          const crossesBridge = inp.bridgeX >= b.minX - inp.bridgeHalfW && inp.bridgeX <= b.maxX + inp.bridgeHalfW
          ch.water.push({
            x0: b.minX,
            x1: b.maxX,
            z0: wz0,
            z1: wz1,
            ...(crossesBridge
              ? { bridgeGap: [inp.bridgeX - inp.bridgeHalfW, inp.bridgeX + inp.bridgeHalfW] as [number, number] }
              : {}),
          })
          // bridge deck: a stone strip carrying the avenue across the river band.
          if (crossesBridge) {
            ch.ground.push({
              kind: "rect",
              surface: "stone",
              cx: inp.bridgeX,
              cz: (wz0 + wz1) / 2,
              w: inp.bridgeHalfW * 2,
              d: wz1 - wz0,
              metersPerTile: 3,
            })
          }
        }
      }
      // ── FAR BANK (#32): stone quay + ground across [farBankZ, wallZ) — the
      // walkable district the bridge arrives at. One stone fill so the far-bank
      // promenade + warehouse ground read as a coherent waterfront across the river.
      if (b.maxZ > zoneField.farBankZ && b.minZ < inp.wallZ) {
        const fz0 = Math.max(b.minZ, zoneField.farBankZ)
        const fz1 = Math.min(b.maxZ, inp.wallZ)
        if (fz1 > fz0) {
          ch.ground.push({
            kind: "rect",
            surface: "stone",
            cx: (b.minX + b.maxX) / 2,
            cz: (fz0 + fz1) / 2,
            w: chunkSize,
            d: fz1 - fz0,
            metersPerTile: 3.2,
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

  // ---- WALLS (#32): slice the four perimeter ramparts into per-chunk segments
  // + bake a thin stone strip under each. The three LAND edges (S/E/W) get a
  // gated rampart; the +Z edge gets a SEA WALL behind the far bank. Each segment
  // is clipped to the chunk it lies in so the collider streams with that chunk.
  const wallSegments = buildWallSegments(bounds, inp)
  for (const seg of wallSegments) {
    const cx = (seg.x0 + seg.x1) / 2
    const cz = (seg.z0 + seg.z1) / 2
    const ch = chunkFor(cx, cz)
    ;(ch.walls ??= []).push(seg)
    // bake a stone rampart strip under the segment (the wall mesh is built by
    // world/cityWall.ts; this is the ground footprint so it doesn't float).
    ch.ground.push({
      kind: "rect",
      surface: "stone",
      cx,
      cz,
      w: Math.max(seg.x1 - seg.x0, 0.5),
      d: Math.max(seg.z1 - seg.z0, 0.5),
      metersPerTile: 3,
    })
  }

  return chunks.flat()
}

/**
 * Build the perimeter rampart as a list of per-chunk-clippable segments (#32).
 * S/E/W edges sit `inset` inside the bounds with a gate opening; the +Z edge gets
 * a SEA WALL just behind the far bank. Each full edge is split at chunk grid lines
 * so a segment lands wholly inside one chunk (its collider streams with it), and
 * the gate interval is recorded on whichever segment spans it.
 */
function buildWallSegments(bounds: CityBounds, inp: ChunkInput): CityWallRect[] {
  const { inset, thickness } = inp.boundary
  const half = (bounds.maxX - bounds.minX) / 2
  const t = thickness
  const lo = -half + inset // wall centerline on the inset edges
  const out: CityWallRect[] = []
  const gateFor = (side: "south" | "east" | "west") => inp.boundary.gates.find((g) => g.side === side)

  // split [a,b] at every chunk boundary so each piece is inside one chunk.
  const chunkSplits = (a: number, b: number, axisMin: number): number[] => {
    const cs = CHUNK_SIZE
    const pts = [a]
    let k = Math.ceil((a - axisMin) / cs)
    for (let edge = axisMin + k * cs; edge < b; edge += cs) if (edge > a) pts.push(edge)
    pts.push(b)
    return pts
  }

  // SOUTH (−Z) + the SEA WALL (+Z behind the far bank): horizontal ramparts (long
  // axis X). South is gated; the sea wall is solid (the river is the boundary, the
  // wall just caps the far bank — bridge arrives BEFORE it).
  const horiz = (zc: number, side: "south", gate?: { center: number; halfWidth: number }) => {
    const xs = chunkSplits(bounds.minX + inset, bounds.maxX - inset, bounds.minX)
    for (let i = 0; i < xs.length - 1; i++) {
      const x0 = xs[i]
      const x1 = xs[i + 1]
      const seg: CityWallRect = { x0, x1, z0: zc - t / 2, z1: zc + t / 2, side }
      if (gate && gate.center - gate.halfWidth < x1 && gate.center + gate.halfWidth > x0) {
        seg.gateGap = [gate.center - gate.halfWidth, gate.center + gate.halfWidth]
      }
      out.push(seg)
    }
  }
  const seaWall = (zc: number) => {
    const xs = chunkSplits(bounds.minX + inset, bounds.maxX - inset, bounds.minX)
    for (let i = 0; i < xs.length - 1; i++) {
      // a solid sea wall, but leave the bridge mouth clear so the deck reaches it.
      const x0 = xs[i]
      const x1 = xs[i + 1]
      const seg: CityWallRect = { x0, x1, z0: zc - t / 2, z1: zc + t / 2, side: "north" }
      if (inp.bridgeX - inp.bridgeHalfW < x1 && inp.bridgeX + inp.bridgeHalfW > x0) {
        seg.gateGap = [inp.bridgeX - inp.bridgeHalfW, inp.bridgeX + inp.bridgeHalfW]
      }
      out.push(seg)
    }
  }

  // EAST (+X) + WEST (−X): vertical ramparts (long axis Z), gated. They span only
  // the LAND edge — they stop at the river so they don't wall across the water.
  const vert = (xc: number, side: "east" | "west", gate?: { center: number; halfWidth: number }) => {
    const zEnd = inp.waterZ // stop the side walls at the near water edge
    const zs = chunkSplits(bounds.minZ + inset, zEnd, bounds.minZ)
    for (let i = 0; i < zs.length - 1; i++) {
      const z0 = zs[i]
      const z1 = zs[i + 1]
      const seg: CityWallRect = { x0: xc - t / 2, x1: xc + t / 2, z0, z1, side }
      if (gate && gate.center - gate.halfWidth < z1 && gate.center + gate.halfWidth > z0) {
        seg.gateGap = [gate.center - gate.halfWidth, gate.center + gate.halfWidth]
      }
      out.push(seg)
    }
  }

  horiz(lo, "south", gateFor("south"))
  vert(half - inset, "east", gateFor("east"))
  vert(lo, "west", gateFor("west"))
  seaWall(inp.wallZ)
  return out
}
