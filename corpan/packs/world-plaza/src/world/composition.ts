import type { RoomTopology } from "@world-plaza/contracts"

/**
 * composition.ts — the LAYOUT / ZONING / SPACING brain for World Plaza dressing.
 *
 * THE PROBLEM IT SOLVES
 * ---------------------
 * The old dressing scattered props haphazardly: a prop knot around EVERY anchor
 * plus a per-building-edge sprinkle with random skips. On the small ±40 map that
 * read as "a tornado dropped 50 benches and a forest of lamps in a pile." On the
 * enlarged ±120 map the right answer is not "more confetti" but INTENTIONAL,
 * LEGIBLE COMPOSITION: the SAME (or fewer) props arranged into readable ZONES
 * with real breathing room, so the town reads as designed, not random.
 *
 * WHAT IT IS
 * ----------
 * A PURE planner (no Babylon, no DOM) — easy to unit-test (qa/composition.mjs).
 * Given the topology it emits a flat list of `Placement`s (which species, where,
 * how big, which way it faces, shadow radius). dressing.ts simply instantiates
 * them. All randomness is seeded → deterministic for a given (seed, topology).
 *
 * THE ZONES (each with its own spacing discipline)
 * ------------------------------------------------
 *   • PLAZA      — the central square around the fountain: benches in a clean
 *                  ring FACING the fountain, lamps at the cardinals, a few
 *                  planters. One deliberate focal point.
 *   • MARKET     — ONE quarter (the densest vendor cluster) dressed like a real
 *                  market: striped stalls + crates/barrels/sacks packed tight
 *                  THERE, with a cart. Other vendors stay quiet.
 *   • AVENUES    — lamps at a regular rhythm + trees as an allée (paired flanking
 *                  lines) along the road axis lines. Lamps follow the road; trees
 *                  form lines, not noise. Skips blockers, doors and the plaza.
 *   • GARDEN     — an open block becomes a leafy green: a loose tree GROVE around
 *                  a couple of benches. A quiet destination.
 *   • RESIDENTIAL— sparse trees/planters hugging the OUTER buildings, thinning
 *                  toward the edge (density falloff) so the town dissolves into
 *                  open ground toward the horizon.
 *
 * SPACING DISCIPLINE (the whole point)
 * ------------------------------------
 *   • minimum gap between ANY two placed props (per-species + global), enforced
 *     by an occupancy list — NO overlaps ever;
 *   • props never sit inside (or hard against) a collision blocker;
 *   • density falls off toward the edges;
 *   • avenue props ALIGN to the roads; benches FACE a focal point; trees form
 *     lines / groves; lamps keep the road rhythm.
 */

/* ------------------------------------------------------------------ species */

export type SpeciesId =
  | "tree"
  | "palm"
  | "lamp"
  | "planter"
  | "barrel"
  | "crate"
  | "sack"
  | "signpost"
  | "cart"
  | "stall"
  | "bench"
  | "trough"

export interface Placement {
  species: SpeciesId
  x: number
  z: number
  scale: number
  /** baked yaw (radians). undefined = let the renderer pick (wall-aware/random). */
  yaw?: number
  /** blob-shadow radius; 0 = no shadow decal. */
  shadow: number
}

export interface CompositionResult {
  placements: Placement[]
  /** zone metadata for QA / debugging (counts + the chosen market/garden cell). */
  zones: {
    plaza: { cx: number; cz: number; r: number }
    market: { cx: number; cz: number } | null
    garden: { cx: number; cz: number; r: number } | null
    avenues: number // count of axis lines dressed
  }
  counts: Record<SpeciesId, number>
}

export interface CompositionCaps {
  trees: number
  palms: number
  lamps: number
  planters: number
  marketProps: number
  signposts: number
  carts: number
  stalls: number
  benches: number
  troughs: number
}

export interface CompositionOptions {
  seed?: number
  caps: CompositionCaps
}

type Box = { x: number; z: number; w: number; d: number }
type Anchor = RoomTopology["anchors"][number]

/* --------------------------------------------------------------- rng (seeded) */

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

/* ------------------------------------------------ road-grid axis derivation */

/**
 * deriveAxisLines — recover the street centrelines from the bounds, using the
 * SAME recipe genMap.mjs / roads.ts use (plazaR, STREET_W, MIN_BLOCK, pitch,
 * ring cap). Avenues dress along these lines, so they MUST match the baked road.
 * Kept in lockstep with scripts/genMap.mjs and src/world/roads.ts.
 */
const STREET_W = 5
const ROAD_MARGIN = 4
const MIN_BLOCK = 16
const PITCH = MIN_BLOCK + STREET_W // 21

export function plazaRadiusFor(size: number): number {
  return Math.max(8, Math.min(14, size * 0.1))
}

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

/* ----------------------------------------------------------- spatial helpers */

function blocked(x: number, z: number, blockers: Box[], pad: number): boolean {
  for (const b of blockers) {
    if (Math.abs(x - b.x) <= b.w / 2 + pad && Math.abs(z - b.z) <= b.d / 2 + pad) return true
  }
  return false
}

function inBounds(x: number, z: number, bounds: RoomTopology["bounds"], margin: number): boolean {
  return (
    x > bounds.minX + margin &&
    x < bounds.maxX - margin &&
    z > bounds.minZ + margin &&
    z < bounds.maxZ - margin
  )
}

/** Occupancy grid: O(1)-ish min-gap queries so spacing scales to a big map. */
class Occupancy {
  private cell: number
  private map = new Map<string, { x: number; z: number }[]>()
  constructor(cell: number) {
    this.cell = cell
  }
  private key(i: number, j: number) {
    return i + ":" + j
  }
  add(x: number, z: number) {
    const i = Math.floor(x / this.cell)
    const j = Math.floor(z / this.cell)
    const k = this.key(i, j)
    let arr = this.map.get(k)
    if (!arr) this.map.set(k, (arr = []))
    arr.push({ x, z })
  }
  /** true if some prop sits within `minDist` of (x,z). */
  near(x: number, z: number, minDist: number): boolean {
    const md2 = minDist * minDist
    const reach = Math.ceil(minDist / this.cell)
    const ci = Math.floor(x / this.cell)
    const cj = Math.floor(z / this.cell)
    for (let di = -reach; di <= reach; di++) {
      for (let dj = -reach; dj <= reach; dj++) {
        const arr = this.map.get(this.key(ci + di, cj + dj))
        if (!arr) continue
        for (const p of arr) {
          const dx = x - p.x
          const dz = z - p.z
          if (dx * dx + dz * dz < md2) return true
        }
      }
    }
    return false
  }
}

/* ====================================================================== plan */

export function composeDressing(
  topology: RoomTopology,
  opts: CompositionOptions,
): CompositionResult {
  const rand = rng(opts.seed ?? 1770)
  const caps = opts.caps
  const bounds = topology.bounds
  const anchors = topology.anchors as Anchor[]
  const blockers = topology.blockers as Box[]

  const size = Math.min(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ)
  const plazaR = plazaRadiusFor(size)
  const cx = (bounds.minX + bounds.maxX) / 2
  const cz = (bounds.minZ + bounds.maxZ) / 2
  const maxR = Math.hypot(bounds.maxX - cx, bounds.maxZ - cz)

  // BUILDING blockers = everything except a decor footprint (the fountain).
  const wallBoxes = blockers.filter(
    (b) =>
      !anchors.some(
        (a) => a.role === "decor" && Math.abs(a.x - b.x) <= b.w / 2 && Math.abs(a.z - b.z) <= b.d / 2,
      ),
  )

  const placements: Placement[] = []
  const counts: Record<SpeciesId, number> = {
    tree: 0, palm: 0, lamp: 0, planter: 0, barrel: 0, crate: 0, sack: 0,
    signpost: 0, cart: 0, stall: 0, bench: 0, trough: 0,
  }

  // global occupancy (every committed prop) + spawn keep-clear.
  const occ = new Occupancy(4)
  for (const s of topology.spawns) occ.add(s.x, s.z)

  /** Try to place a prop with a per-species GLOBAL min-gap. Returns success. */
  const tryPlace = (
    species: SpeciesId,
    x: number,
    z: number,
    scale: number,
    shadow: number,
    minGap: number,
    blockerPad: number,
    yaw?: number,
  ): boolean => {
    if (counts[species] >= cap(species)) return false
    if (!inBounds(x, z, bounds, 1.0)) return false
    if (blocked(x, z, blockers, blockerPad)) return false
    if (occ.near(x, z, minGap)) return false
    placements.push({ species, x, z, scale, yaw, shadow })
    counts[species]++
    occ.add(x, z)
    return true
  }

  const cap = (s: SpeciesId): number => {
    switch (s) {
      case "tree": return caps.trees
      case "palm": return caps.palms
      case "lamp": return caps.lamps
      case "planter": return caps.planters
      case "barrel": case "crate": case "sack":
        return caps.marketProps // shared market budget (checked below too)
      case "signpost": return caps.signposts
      case "cart": return caps.carts
      case "stall": return caps.stalls
      case "bench": return caps.benches
      case "trough": return caps.troughs
    }
  }
  const marketUsed = () => counts.barrel + counts.crate + counts.sack

  /* ============================================================ ZONE 1 PLAZA */
  // The central square: a deliberate ring of benches FACING the fountain, lamps
  // at the cardinals between them, planters tucked just inside. We honour the
  // topology's plaza bench/lamp anchors as the canonical ring (already evenly
  // spaced), so the arrangement reads as designed, not scattered.
  {
    const plazaAnchors = anchors.filter(
      (a) =>
        Math.hypot(a.x - cx, a.z - cz) <= plazaR + 1 &&
        (a.role === "bench" || (a.role === "decor" && a.id.startsWith("plaza_lamp"))),
    )
    for (const a of plazaAnchors) {
      if (a.role === "bench") {
        // face the fountain (focal point).
        const yaw = Math.atan2(cx - a.x, cz - a.z)
        tryPlace("bench", a.x, a.z, 1, 0.95, 2.4, 0.5, yaw)
        // a planter just inside the bench, toward the centre.
        const ix = a.x + (cx - a.x) * 0.18
        const iz = a.z + (cz - a.z) * 0.18
        tryPlace("planter", ix, iz, 0.95, 0.7, 2.0, 0.5)
      } else {
        tryPlace("lamp", a.x, a.z, 1, 0.5, 3.0, 0.4)
      }
    }
    // four flanking palms just OUTSIDE the bench ring, on the diagonals, framing
    // the square without crowding it.
    const palmR = plazaR + 2.2
    for (let k = 0; k < 4; k++) {
      const ang = Math.PI / 4 + (k / 4) * Math.PI * 2
      tryPlace("palm", cx + Math.cos(ang) * palmR, cz + Math.sin(ang) * palmR, 1.0, 0.7, 4.0, 0.6)
    }
  }

  /* =========================================================== ZONE 2 MARKET */
  // ONE market quarter — the tightest cluster of vendor anchors. Dress THAT like
  // a real market (stalls + crates/barrels/sacks packed close + a cart); leave
  // the other vendors quiet so the market reads as a place, not a sprinkle.
  let marketCenter: { cx: number; cz: number } | null = null
  {
    const vendors = anchors.filter((a) => a.role === "vendor")
    if (vendors.length) {
      // pick the vendor with the most neighbours within 24u → densest quarter.
      let best = vendors[0]
      let bestN = -1
      for (const v of vendors) {
        let n = 0
        for (const o of vendors) if (o !== v && Math.hypot(o.x - v.x, o.z - v.z) < 24) n++
        if (n > bestN) {
          bestN = n
          best = v
        }
      }
      marketCenter = { cx: best.x, cz: best.z }
      const market = vendors.filter((v) => Math.hypot(v.x - best.x, v.z - best.z) < 24)
      const species: SpeciesId[] = ["barrel", "crate", "sack"]
      for (const v of market) {
        // a striped stall canopy AT the vendor, facing the street.
        tryPlace("stall", v.x, v.z, 1, 1.4, 3.6, 0.6, v.facing ?? rand() * Math.PI * 2)
        // a tight knot of market goods on the open side of the stall.
        const f = v.facing ?? 0
        const ox = Math.cos(f)
        const oz = Math.sin(f)
        for (let k = 0; k < 6; k++) {
          if (marketUsed() >= caps.marketProps) break
          const ang = rand() * Math.PI * 2
          const r = 1.6 + rand() * 2.4
          const px = v.x + ox * 1.4 + Math.cos(ang) * r
          const pz = v.z + oz * 1.4 + Math.sin(ang) * r
          const sp = species[Math.floor(rand() * 3) % 3]
          tryPlace(sp, px, pz, 0.85 + rand() * 0.3, 0.55, 1.2, 0.4)
        }
      }
      // a cart parked at the edge of the market.
      tryPlace("cart", best.x + 3.2, best.z - 3.2, 1, 0.95, 2.6, 0.5)
      // a water trough at the market — animals + life.
      tryPlace("trough", best.x - 3.4, best.z + 1.2, 1, 1.3, 2.6, 0.6)
    }
  }

  /* ========================================================== ZONE 3 AVENUES */
  // Lamps at a REGULAR rhythm + trees as an allée flanking the road axis lines.
  // Lamps follow the road; trees form paired lines. We march each axis line and
  // drop a lamp every `lampRhythm`, a tree pair every `treeRhythm`, OFFSET to
  // the road shoulder, skipping blockers, doors, the plaza and the market.
  let avenueLines = 0
  {
    const axis = deriveAxisLines(bounds)
    const shoulder = STREET_W / 2 + 1.4 // lamp/tree offset from road centreline
    const lampRhythm = PITCH / 2 // a lamp every half-block → steady cadence
    const treeRhythm = PITCH / 3 // trees a touch denser than lamps
    const along = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ)
    const start = -along / 2 + ROAD_MARGIN + 2
    const end = along / 2 - ROAD_MARGIN - 2

    const tooNearMarket = (x: number, z: number) =>
      marketCenter ? Math.hypot(x - marketCenter.cx, z - marketCenter.cz) < 8 : false
    const inPlaza = (x: number, z: number) => Math.hypot(x - cx, z - cz) < plazaR + 2

    // lamp/tree alternate down BOTH shoulders of every axis line, both
    // orientations (NS lines = x const, EW lines = z const).
    const dressLine = (along0: number, axisVal: number, orient: "ns" | "ew") => {
      avenueLines++
      // lamps: regular rhythm, both shoulders, phase by axis so opposite lines
      // don't all line up into a tunnel.
      for (let t = along0; t <= end; t += lampRhythm) {
        for (const side of [-1, 1]) {
          const x = orient === "ns" ? axisVal + shoulder * side : t
          const z = orient === "ns" ? t : axisVal + shoulder * side
          if (inPlaza(x, z) || tooNearMarket(x, z)) continue
          if (blocked(x, z, blockers, 1.0)) continue
          tryPlace("lamp", x, z, 1, 0.5, lampRhythm * 0.8, 0.6)
        }
      }
      // trees: an allée a touch further out, offset half a rhythm from lamps so
      // tree and lamp interleave instead of colliding.
      const treeShoulder = shoulder + 2.0
      for (let t = along0 + treeRhythm / 2; t <= end; t += treeRhythm) {
        for (const side of [-1, 1]) {
          const x = orient === "ns" ? axisVal + treeShoulder * side : t
          const z = orient === "ns" ? t : axisVal + treeShoulder * side
          if (inPlaza(x, z) || tooNearMarket(x, z)) continue
          if (blocked(x, z, blockers, 1.0)) continue
          // density falloff toward the edges keeps the avenues from feeling
          // mechanical all the way out; trees thin as they leave town.
          const r = Math.hypot(x - cx, z - cz)
          const keep = 1 - (r / maxR) * 0.55
          if (rand() > keep) continue
          // tiny seeded jitter so the allée breathes (still reads as a line).
          const jx = x + (rand() - 0.5) * 1.0
          const jz = z + (rand() - 0.5) * 1.0
          tryPlace("tree", jx, jz, 0.9 + rand() * 0.4, 1.0, treeRhythm * 0.7, 0.7)
        }
      }
    }

    for (const a of axis) {
      dressLine(start, a, "ns")
      dressLine(start, a, "ew")
    }
  }

  /* =========================================================== ZONE 4 GARDEN */
  // A quiet green: find an OPEN block cell (no building, off the plaza) and grow
  // a loose tree GROVE around a couple of benches. A destination, not noise.
  let garden: { cx: number; cz: number; r: number } | null = null
  {
    const axis = deriveAxisLines(bounds)
    // candidate cell centres = midpoints between adjacent axis lines.
    const cellCenters: { x: number; z: number }[] = []
    for (let i = 0; i < axis.length - 1; i++) {
      for (let j = 0; j < axis.length - 1; j++) {
        cellCenters.push({ x: (axis[i] + axis[i + 1]) / 2, z: (axis[j] + axis[j + 1]) / 2 })
      }
    }
    // pick the open cell nearest the plaza (a town green sits near the centre).
    let chosen: { x: number; z: number } | null = null
    let bestD = Infinity
    for (const c of cellCenters) {
      const r = Math.hypot(c.x - cx, c.z - cz)
      if (r < plazaR + PITCH) continue // not the plaza itself / too central
      if (r > maxR * 0.55) continue // keep the green in-town, not in the sticks
      // empty = no building blocker within a block of the cell centre.
      const occupied = wallBoxes.some((b) => Math.hypot(b.x - c.x, b.z - c.z) < MIN_BLOCK * 0.55)
      if (occupied) continue
      if (Math.hypot(c.x - (marketCenter?.cx ?? 1e9), c.z - (marketCenter?.cz ?? 1e9)) < PITCH) continue
      if (r < bestD) {
        bestD = r
        chosen = c
      }
    }
    if (chosen) {
      const gr = MIN_BLOCK * 0.42
      garden = { cx: chosen.x, cz: chosen.z, r: gr }
      // two benches back-to-back at the heart of the green, facing OUT.
      tryPlace("bench", chosen.x - 1.6, chosen.z, 1, 0.95, 2.4, 0.5, Math.PI / 2)
      tryPlace("bench", chosen.x + 1.6, chosen.z, 1, 0.95, 2.4, 0.5, -Math.PI / 2)
      // a loose grove: rejection-sample tree positions in the cell with a healthy
      // min-gap so it reads as a planted grove, never a thicket.
      let tries = 0
      let grown = 0
      const want = 10
      while (grown < want && tries < 120) {
        tries++
        const ang = rand() * Math.PI * 2
        const rr = Math.sqrt(rand()) * gr
        const x = chosen.x + Math.cos(ang) * rr
        const z = chosen.z + Math.sin(ang) * rr
        if (tryPlace("tree", x, z, 0.95 + rand() * 0.5, 1.0, 4.4, 0.6)) grown++
      }
      // a couple of planters frame the green's near edge.
      tryPlace("planter", chosen.x, chosen.z - gr * 0.7, 0.95, 0.7, 2.4, 0.5)
      tryPlace("planter", chosen.x, chosen.z + gr * 0.7, 0.95, 0.7, 2.4, 0.5)
    }
  }

  /* ====================================================== ZONE 5 RESIDENTIAL */
  // Quiet edges: a single tree or planter beside each OUTER building, thinning
  // toward the rim (density falloff) so the town dissolves into open ground.
  {
    // sort buildings outward; the further out, the lower the chance of a prop.
    const outer = [...wallBoxes].sort(
      (a, b) => Math.hypot(b.x - cx, b.z - cz) - Math.hypot(a.x - cx, a.z - cz),
    )
    for (const b of outer) {
      const r = Math.hypot(b.x - cx, b.z - cz)
      const keep = 1 - (r / maxR) * 0.7 // thin out toward the edge
      if (rand() > keep) continue
      // place ONE prop at a corner of the building, on open ground.
      const corner = Math.floor(rand() * 4)
      const sx = corner < 2 ? -1 : 1
      const sz = corner % 2 === 0 ? -1 : 1
      const px = b.x + sx * (b.w / 2 + 1.6)
      const pz = b.z + sz * (b.d / 2 + 1.6)
      // alternate a tree vs a planter for a little variety, deterministically.
      if (rand() < 0.6) tryPlace("tree", px, pz, 0.85 + rand() * 0.4, 1.0, 5.0, 0.7)
      else tryPlace("planter", px, pz, 0.95, 0.7, 3.0, 0.5)
    }
  }

  /* ========================================== ZONE 6 PORTAL / STATION ACCENTS */
  // Small, RESTRAINED accents at doors & NPC counters so they read as places of
  // business without re-introducing the per-anchor pile: a signpost beside a
  // door, a single planter at a counter. Spacing rules keep them from clumping.
  {
    for (const a of anchors) {
      if (a.role === "portal") {
        const f = a.facing ?? 0
        // a signpost a step out from the door, to one side.
        const tx = Math.cos(f + Math.PI / 2)
        const tz = Math.sin(f + Math.PI / 2)
        tryPlace("signpost", a.x + tx * 1.8, a.z + tz * 1.8, 0.95, 0.45, 3.0, 0.4)
      } else if (a.role === "npc_station") {
        tryPlace("planter", a.x + 1.4, a.z + 0.6, 0.9, 0.7, 2.4, 0.4)
      }
    }
  }

  return {
    placements,
    zones: {
      plaza: { cx, cz, r: plazaR },
      market: marketCenter,
      garden,
      avenues: avenueLines,
    },
    counts,
  }
}
