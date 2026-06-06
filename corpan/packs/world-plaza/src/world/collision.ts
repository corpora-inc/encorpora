import type { RoomTopology } from "@world-plaza/contracts"
import { composeDressing, type Placement, type SpeciesId, type CompositionCaps } from "./composition"

/**
 * collision.ts — the UNIFIED obstacle field for World Plaza.
 *
 * THE PROBLEM IT SOLVES
 * ---------------------
 * Before this, ONLY building footprints (`topology.blockers`) blocked movement.
 * The dressing props (fountain, benches, stalls, barrels, crates, trees, lamps,
 * planters…) and character-vs-character had NO collision, so the player and the
 * wandering crowd walked straight THROUGH props and INTO the fountain, and paper
 * people stacked on top of each other. Owner called these "egregious overlap
 * glitches."
 *
 * WHAT IT IS
 * ----------
 * A PURE, Babylon-free, deterministic obstacle field consumed by BOTH the player
 * controller and the crowd. It unifies two shapes:
 *   • BOX obstacles  — building footprints (axis-aligned, from topology.blockers,
 *                      minus the fountain's own decor footprint which we model as
 *                      a circle instead).
 *   • CIRCLE obstacles — the big central fountain + a footprint circle for every
 *                      SOLID dressing prop (sized from its real mesh footprint).
 *
 * Genuinely non-blocking décor (lamp glow cards, ground shadow decals, bunting)
 * is NOT added — only things a body would actually bump into.
 *
 * THE QUERY API (cheap, deterministic, no physics engine)
 * -------------------------------------------------------
 *   • blocked(x, z, r)            — would a body of radius r at (x,z) overlap any
 *                                   obstacle?
 *   • resolve(px, pz, nx, nz, r)  — given a CURRENT free position and a DESIRED
 *                                   next position, return a resolved position that
 *                                   does not overlap any obstacle, SLIDING along
 *                                   surfaces (axis-separated for boxes, radial
 *                                   push-out for circles). The core glitch-stopper.
 *   • pushOut(x, z, r)            — if (x,z) is already inside an obstacle, return
 *                                   the nearest point just outside it (settles an
 *                                   agent/prop that spawned overlapping).
 *
 * PERF: a uniform spatial hash buckets obstacles so every query only tests the
 * handful in the neighbouring cells — O(1)-ish for a town's worth of props. All
 * obstacles are static, so the grid is built once.
 */

/* ------------------------------------------------------------------- shapes */

export interface CircleObstacle {
  kind: "circle"
  x: number
  z: number
  r: number
}
export interface BoxObstacle {
  kind: "box"
  x: number
  z: number
  /** HALF-extents (so tests are symmetric & cheap). */
  hw: number
  hd: number
}
export type Obstacle = CircleObstacle | BoxObstacle

/* ------------------------------------------- per-species collision footprint */

/**
 * Collision radius for each solid prop SPECIES, in world units at scale=1, read
 * from the real mesh footprints in props3d.ts (NOT the visual blob-shadow, which
 * is bigger for grounding). These are deliberately a touch SMALLER than the full
 * silhouette so paper-people can brush past tightly-packed market goods without
 * feeling like they hit an invisible wall — we want "no interpenetration," not
 * "bounce off a force field a metre away."
 *
 * `null` = NOT a collider (purely decorative / you can walk over/through it).
 */
const SPECIES_RADIUS: Record<SpeciesId, number | null> = {
  // Furniture / structures — real obstacles.
  bench: 1.0, // 1.8 wide × 0.5 deep seat → modest circle along its middle
  stall: 1.5, // 2.6 × 2.0 canopy footprint → a body-sized post ring
  cart: 1.2, // 2.0-long bed + wheels
  trough: 1.0, // 1.8 × 0.8 stone basin
  // Trees / palms — solid trunk + pot; collide on the base, not the canopy.
  tree: 0.55, // trunk ~0.46 dia; canopy overhangs, body passes under it
  palm: 0.6, // 0.85 pot
  // Market goods — small, but you shouldn't stand inside a barrel.
  barrel: 0.55, // 0.74 belly
  crate: 0.55, // 0.9 box
  sack: 0.5, // 0.85 body
  planter: 0.85, // 1.6 × 0.6 flower box
  // Slim posts — small but solid (you shouldn't clip through a lamp post).
  lamp: 0.35,
  signpost: 0.3,
}

/* ------------------------------------------------- prop-footprint extraction */

/**
 * Turn composition Placements into CIRCLE obstacles. Used by dressing.ts /
 * game.ts to feed the collision field the exact props that were placed. Scale is
 * honoured (a scaled-up tree gets a bigger collider). Non-collider species and
 * zero-radius entries are skipped.
 */
export function propFootprints(placements: Placement[]): CircleObstacle[] {
  const out: CircleObstacle[] = []
  for (const p of placements) {
    const base = SPECIES_RADIUS[p.species]
    if (base == null || base <= 0) continue
    out.push({ kind: "circle", x: p.x, z: p.z, r: base * (p.scale || 1) })
  }
  return out
}

/** The central fountain's collision circle (its big stone basin). The basin
 * outer wall is ~5.3 dia → ~2.65 radius; a hair more so bodies can't clip the
 * rim. Built from the fountain decor anchor's position. */
export const FOUNTAIN_RADIUS = 2.9
export function fountainCircle(x: number, z: number): CircleObstacle {
  return { kind: "circle", x, z, r: FOUNTAIN_RADIUS }
}

/* --------------------------------------------------------------- the field */

export interface ObstacleFieldOptions {
  /** spatial-hash cell size; ~2× the largest common collider works well. */
  cell?: number
}

export interface ObstacleField {
  /** does a body of radius `r` at (x,z) overlap any obstacle? */
  blocked: (x: number, z: number, r: number) => boolean
  /**
   * Resolve a desired move (px,pz → nx,nz) for a body of radius `r` into a
   * non-overlapping position, sliding along obstacle surfaces. `px,pz` is assumed
   * already free (the body's current spot); we slide the DELTA against obstacles.
   */
  resolve: (
    px: number,
    pz: number,
    nx: number,
    nz: number,
    r: number,
  ) => { x: number; z: number }
  /** If (x,z) is inside an obstacle, return the nearest point just outside it. */
  pushOut: (x: number, z: number, r: number) => { x: number; z: number }
  /** raw obstacle list (debug / QA). */
  obstacles: Obstacle[]
}

/* ------------------------------------------------------------ spatial hash */

class Grid {
  private cell: number
  private map = new Map<string, Obstacle[]>()
  constructor(cell: number, obstacles: Obstacle[]) {
    this.cell = cell
    for (const o of obstacles) {
      // a circle spans [x-r, x+r]; a box spans [x-hw, x+hw] etc. Insert into
      // every cell its AABB touches so neighbour queries never miss it.
      const reach = o.kind === "circle" ? o.r : Math.max(o.hw, o.hd)
      const i0 = Math.floor((o.x - reach) / cell)
      const i1 = Math.floor((o.x + reach) / cell)
      const j0 = Math.floor((o.z - reach) / cell)
      const j1 = Math.floor((o.z + reach) / cell)
      for (let i = i0; i <= i1; i++) {
        for (let j = j0; j <= j1; j++) {
          const k = i + ":" + j
          let arr = this.map.get(k)
          if (!arr) this.map.set(k, (arr = []))
          arr.push(o)
        }
      }
    }
  }
  /** all obstacles whose cells overlap the query disc (x,z,r). May include a few
   * extras from neighbouring cells — callers do the precise test. */
  query(x: number, z: number, r: number): Obstacle[] {
    const cell = this.cell
    const i0 = Math.floor((x - r) / cell)
    const i1 = Math.floor((x + r) / cell)
    const j0 = Math.floor((z - r) / cell)
    const j1 = Math.floor((z + r) / cell)
    const seen = new Set<Obstacle>()
    const out: Obstacle[] = []
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const arr = this.map.get(i + ":" + j)
        if (!arr) continue
        for (const o of arr) {
          if (!seen.has(o)) {
            seen.add(o)
            out.push(o)
          }
        }
      }
    }
    return out
  }
}

/* --------------------------------------------------- degenerate-centre push */

/**
 * DETERMINISTIC default push direction for ejecting a point that sits at (or
 * vanishingly close to) the EXACT centre of a circular collider, where the
 * radial push vector `(p − centre)` is the zero vector and so carries no usable
 * direction. Without a defined default, a body spawned/stationed dead-on a
 * circle's centre (the classic case: a special anchored at the fountain's (0,0))
 * has `d ≈ 0`, `dx/d` is `0/0 = NaN`, and the push silently does NOTHING — the
 * body is left embedded inside the collider. THAT was the fountain bug.
 *
 * +X is intentional, not random: identical inputs must always settle to the
 * identical point so the crowd/props place reproducibly across frames, reloads
 * and re-stations (the whole field is otherwise pure + deterministic, and tests
 * assert that). +X is a safe ray in this town — the plaza opens to the east of
 * the fountain — and callers that know a better direction (toward the nearest
 * open bound) can pass one via `pushDir`'s `prefer` argument.
 */
export const DEFAULT_PUSH_DX = 1
export const DEFAULT_PUSH_DZ = 0
/** Radial offset below which a point counts as "dead-centre" (push undefined). */
const CENTRE_EPS = 1e-4

/**
 * Resolve the unit push direction for ejecting (x,z) from the circle (cx,cz):
 * normally the outward radial `(p − centre)/|p − centre|`, but when the point is
 * within `CENTRE_EPS` of the centre that vector is undefined, so fall back to a
 * deterministic default (`prefer` if given + itself non-degenerate, else +X).
 * NEVER returns a zero/NaN vector, so a push ALWAYS moves the point out. Exported
 * so the degenerate-centre case can be unit-tested in isolation.
 */
export function pushDir(
  x: number,
  z: number,
  cx: number,
  cz: number,
  prefer?: { dx: number; dz: number },
): { dx: number; dz: number } {
  const dx = x - cx
  const dz = z - cz
  const d = Math.hypot(dx, dz)
  if (d >= CENTRE_EPS) return { dx: dx / d, dz: dz / d }
  // dead-centre → deterministic default. Honour a caller's preference (e.g.
  // "toward the nearest open bound") when it is itself non-degenerate.
  if (prefer) {
    const pl = Math.hypot(prefer.dx, prefer.dz)
    if (pl >= CENTRE_EPS) return { dx: prefer.dx / pl, dz: prefer.dz / pl }
  }
  return { dx: DEFAULT_PUSH_DX, dz: DEFAULT_PUSH_DZ }
}

/**
 * Eject a body of radius `r` at (x,z) out of a SINGLE circle (cx,cz,cr) to just
 * outside it (clear by `+1e-3`). A no-op when already outside. Uses `pushDir`, so
 * the dead-centre case is handled deterministically rather than left embedded.
 * Pure + standalone so callers (e.g. the crowd's static `avoidCircles`, which are
 * NOT in the streamed field) can settle a point against a footprint without an
 * ObstacleField. `prefer` lets the caller bias the dead-centre default.
 */
export function pushOutCircle(
  x: number,
  z: number,
  r: number,
  cx: number,
  cz: number,
  cr: number,
  prefer?: { dx: number; dz: number },
): { x: number; z: number } {
  const dx = x - cx
  const dz = z - cz
  const need = r + cr
  if (dx * dx + dz * dz >= need * need) return { x, z } // already clear
  const dir = pushDir(x, z, cx, cz, prefer)
  // push from the CENTRE out to the required separation (works even dead-centre,
  // where there is no current radius to extend from).
  return { x: cx + dir.dx * (need + 1e-3), z: cz + dir.dz * (need + 1e-3) }
}

/* ------------------------------------------------------------- safe spawn */

/** A minimal collision view `findSafeSpawn` needs — any `ObstacleField` satisfies
 *  it, and tests can pass a trivial stub. `pushOut` is optional (a first, cheap
 *  ejection attempt); the ring search is the always-correct fallback. */
export interface SpawnCollision {
  blocked: (x: number, z: number, r: number) => boolean
  pushOut?: (x: number, z: number, r: number) => { x: number; z: number }
}

/**
 * Find a CLEAR, walkable spawn point near (x,z) for a body of radius `r` — the ONE
 * safe-spawn every respawn/teleport/arrival/resume must route through so the player
 * is NEVER dropped inside a collider (the taxi-to-fountain trap: the destination
 * anchor's CENTRE is inside the basin -> stuck forever).
 *
 * Order: (1) the requested point if already free; (2) one `pushOut` (handles the
 * dead-centre fountain case deterministically) if that lands free; (3) a
 * deterministic outward SPIRAL — expanding rings of evenly-spaced candidates —
 * returning the FIRST free one. The spiral is the robust fallback when `pushOut`
 * isn't enough (overlapping colliders, a deep box, or the obstacle not yet loaded
 * when pushOut ran). ALWAYS returns a point; pure + deterministic so it's testable.
 */
export function findSafeSpawn(
  field: SpawnCollision,
  x: number,
  z: number,
  r: number,
  opts: { maxRadius?: number; step?: number; spokes?: number } = {},
): { x: number; z: number } {
  if (!field.blocked(x, z, r)) return { x, z }
  if (field.pushOut) {
    const p = field.pushOut(x, z, r)
    if (!field.blocked(p.x, p.z, r)) return p
  }
  const maxRadius = opts.maxRadius ?? 60
  const step = opts.step ?? Math.max(1, r * 2)
  const spokes = opts.spokes ?? 16
  for (let ring = 1; ring * step <= maxRadius; ring++) {
    const rad = ring * step
    for (let s = 0; s < spokes; s++) {
      const a = (s / spokes) * Math.PI * 2 + ring * 0.39
      const cx = x + Math.cos(a) * rad
      const cz = z + Math.sin(a) * rad
      if (!field.blocked(cx, cz, r)) return { x: cx, z: cz }
    }
  }
  return field.pushOut ? field.pushOut(x, z, r) : { x, z }
}

/* -------------------------------------------------- precise overlap helpers */

function overlapsCircle(x: number, z: number, r: number, c: CircleObstacle): boolean {
  const dx = x - c.x
  const dz = z - c.z
  const rr = r + c.r
  return dx * dx + dz * dz < rr * rr
}

function overlapsBox(x: number, z: number, r: number, b: BoxObstacle): boolean {
  // distance from point to the (padded) AABB; >0 means outside.
  const dx = Math.max(Math.abs(x - b.x) - b.hw, 0)
  const dz = Math.max(Math.abs(z - b.z) - b.hd, 0)
  return dx * dx + dz * dz < r * r
}

function overlaps(x: number, z: number, r: number, o: Obstacle): boolean {
  return o.kind === "circle" ? overlapsCircle(x, z, r, o) : overlapsBox(x, z, r, o)
}

/* ----------------------------------------------------------------- builder */

export function createObstacleField(
  obstacles: Obstacle[],
  opts: ObstacleFieldOptions = {},
): ObstacleField {
  const cell = opts.cell ?? 6
  const grid = new Grid(cell, obstacles)

  const blocked = (x: number, z: number, r: number): boolean => {
    for (const o of grid.query(x, z, r)) if (overlaps(x, z, r, o)) return true
    return false
  }

  /**
   * Single-axis resolve: move from `from` to `to` along ONE axis, stopping at the
   * first obstacle surface so the body slides instead of penetrating. Returns the
   * resolved coordinate on that axis. The OTHER axis is held fixed at `fixed`.
   */
  const resolveAxis = (
    from: number,
    to: number,
    fixed: number,
    r: number,
    axis: "x" | "z",
  ): number => {
    if (to === from) return from
    const qx = axis === "x" ? to : fixed
    const qz = axis === "x" ? fixed : to
    let result = to
    for (const o of grid.query(qx, qz, r)) {
      if (!overlaps(qx, qz, r, o)) continue
      // We overlap this obstacle at the desired point → clamp to its surface on
      // this axis, on the side we came FROM.
      if (o.kind === "box") {
        const cAxis = axis === "x" ? o.x : o.z
        const half = axis === "x" ? o.hw : o.hd
        // clamp to the box face on the side we came from.
        const surf = from < cAxis ? cAxis - half - r : cAxis + half + r
        // keep the most-restrictive clamp (closest to `from`).
        if (Math.abs(surf - from) < Math.abs(result - from)) result = surf
      } else {
        // circle: clamp this axis so the body just touches the circle, holding
        // the other axis at `fixed`. Solve (axisPos - c.axis)^2 = R^2 - perp^2.
        const cAxis = axis === "x" ? o.x : o.z
        const cPerp = axis === "x" ? o.z : o.x
        const R = r + o.r
        const perp = fixed - cPerp
        const inside = R * R - perp * perp
        if (inside <= 0) continue // not actually blocked on this axis here
        const d = Math.sqrt(inside)
        const surf = from < cAxis ? cAxis - d : cAxis + d
        if (Math.abs(surf - from) < Math.abs(result - from)) result = surf
      }
    }
    // clamp so we never overshoot past `to` away from `from`.
    if (to > from) result = Math.min(result, to)
    else result = Math.max(result, to)
    return result
  }

  const resolve = (
    px: number,
    pz: number,
    nx: number,
    nz: number,
    r: number,
  ): { x: number; z: number } => {
    // Axis-separated slide (classic, stable, jitter-free): resolve X holding the
    // OLD z, then resolve Z holding the NEW x. This yields smooth wall-slide.
    let rx = resolveAxis(px, nx, pz, r, "x")
    let rz = resolveAxis(pz, nz, rx, r, "z")
    // Safety net: if the combined point still overlaps (diagonal pinch between
    // two obstacles), fall back to staying on whichever axis is clear.
    if (blocked(rx, rz, r)) {
      if (!blocked(px, rz, r)) rx = px
      else if (!blocked(rx, pz, r)) rz = pz
      else {
        rx = px
        rz = pz
      }
    }
    return { x: rx, z: rz }
  }

  const pushOut = (x: number, z: number, r: number): { x: number; z: number } => {
    let ox = x
    let oz = z
    // a few relaxation passes — handles overlapping multiple obstacles at once.
    for (let pass = 0; pass < 4; pass++) {
      let moved = false
      for (const o of grid.query(ox, oz, r)) {
        if (o.kind === "circle") {
          const dx = ox - o.x
          const dz = oz - o.z
          const need = r + o.r
          if (dx * dx + dz * dz < need * need) {
            // `pushDir` gives a unit outward ray AND a deterministic default at
            // the dead-centre singularity (where `(p − centre)` is the zero
            // vector), so a point AT a circle's centre is ejected rather than
            // left embedded — the generalized fix for the fountain bug.
            const dir = pushDir(ox, oz, o.x, o.z)
            ox = o.x + dir.dx * (need + 1e-3)
            oz = o.z + dir.dz * (need + 1e-3)
            moved = true
          }
        } else {
          if (!overlapsBox(ox, oz, r, o)) continue
          // push out along the smallest-penetration axis.
          const penX = o.hw + r - Math.abs(ox - o.x)
          const penZ = o.hd + r - Math.abs(oz - o.z)
          if (penX < penZ) ox += ox < o.x ? -penX - 1e-3 : penX + 1e-3
          else oz += oz < o.z ? -penZ - 1e-3 : penZ + 1e-3
          moved = true
        }
      }
      if (!moved) break
    }
    return { x: ox, z: oz }
  }

  return { blocked, resolve, pushOut, obstacles }
}

/* ----------------------------------------------------- topology → obstacles */

/**
 * Build the BUILDING-box + FOUNTAIN-circle obstacles straight from a topology.
 * The fountain's own decor footprint blocker (a small 3×3 box at the fountain
 * anchor) is REPLACED by a proper big fountain circle; all other blockers are
 * real buildings and stay as boxes. Prop circles are appended separately by the
 * caller via `propFootprints(...)`.
 */
export function topologyObstacles(topology: RoomTopology): Obstacle[] {
  const anchors = topology.anchors
  const decor = anchors.filter((a) => a.role === "decor")
  // the fountain = the decor anchor nearest origin (matches dressing.ts).
  const fountain = decor.reduce<(typeof decor)[number] | undefined>(
    (best, a) => (!best || a.x * a.x + a.z * a.z < best.x * best.x + best.z * best.z ? a : best),
    undefined,
  )
  const out: Obstacle[] = []
  for (const b of topology.blockers) {
    // is THIS blocker the fountain's footprint box? (decor anchor inside it)
    const isFountainBox = decor.some(
      (a) => Math.abs(a.x - b.x) <= b.w / 2 && Math.abs(a.z - b.z) <= b.d / 2,
    )
    if (isFountainBox) continue // replaced by the fountain circle below
    out.push({ kind: "box", x: b.x, z: b.z, hw: b.w / 2, hd: b.d / 2 })
  }
  if (fountain) out.push(fountainCircle(fountain.x, fountain.z))
  return out
}

/* ----------------------------------------------- one-call field for the game */

export interface PlazaFieldOptions {
  /** composition caps — MUST match the caps dressWorld used (FULL_CAPS / LEAN_CAPS)
   * so the obstacle circles line up with the actually-placed props. */
  caps: CompositionCaps
  /** composition seed — MUST match dressWorld's (DRESSING_DEFAULT_SEED). */
  seed?: number
  /** spatial-hash cell override. */
  cell?: number
}

/**
 * buildPlazaObstacleField — the single entry point game.ts uses to construct the
 * unified collision field. It re-runs the PURE composition planner (same seed +
 * caps as dressWorld) to recover the exact prop placements, turns the solid ones
 * into circle obstacles, and unions them with the building boxes + fountain
 * circle. Because composeDressing is deterministic, this matches the placed props
 * exactly without needing the live Babylon dressing instance.
 *
 * (dressing.ts ALSO exposes its `footprints` for callers that already hold the
 * dressing handle; this helper is for the common case where game.ts builds the
 * field up front and passes it into both the player and the crowd.)
 */
export function buildPlazaObstacleField(
  topology: RoomTopology,
  opts: PlazaFieldOptions,
): ObstacleField {
  const plan = composeDressing(topology, { seed: opts.seed, caps: opts.caps })
  const obstacles: Obstacle[] = [
    ...topologyObstacles(topology),
    ...propFootprints(plan.placements),
  ]
  return createObstacleField(obstacles, { cell: opts.cell })
}
