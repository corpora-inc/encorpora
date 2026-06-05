/**
 * stationing — the PURE geometry behind a stationed special quest NPC's hover.
 *
 * A stationed special (the boatman at the docks, the gatekeeper at the city gate,
 * …) does NOT wander the whole map like the general crowd; it HOVERS within a
 * small radius of its anchor so the player reliably FINDS it where the quest map
 * marker points, while still taking gentle idle steps so it isn't a frozen statue.
 *
 * The crowd simulation owns the agents + Babylon plumbing; this module owns only
 * the small bit of MATH it needs, factored out so it is testable without a GL
 * context: where to place the station off an anchor, how to pick the next little
 * hover target inside the ring, and whether an agent has drifted off its leash.
 *
 * Conventions (shared with `crowd.ts`):
 *  - STATION_RADIUS: a stationed special never strays farther than this from its
 *    station (the leash). Small enough to be found at the marker.
 *  - STATION_STEP: the radius within which it picks its next hover target (kept a
 *    touch inside STATION_RADIUS so steering/separation never push it past the ring).
 *  - STATION_OFFSET: how far OFF the exact anchor it stands (clear of a prop that
 *    may sit on the anchor — a mooring post, a gate arch).
 */

export const STATION_RADIUS = 2.6
export const STATION_STEP = 1.8
export const STATION_OFFSET = 1.2

export interface Vec2 {
  x: number
  z: number
}

/** Farthest a station may be pushed off its anchor to clear a prop (a big
 *  fountain can be several units across; never push so far the NPC leaves the
 *  landmark it belongs to). */
export const STATION_MAX_PUSH = 7

/**
 * The station point for an anchor: the nearest CLEAR walkable spot to the anchor,
 * preferring the anchor's `facing` side (where the player approaches). Invariant:
 * a stationed agent never stands inside a prop. We sweep OUTWARD in expanding
 * rings (so a prop of ANY size sitting on the anchor — a 1u post or a 5u fountain
 * basin — is cleared, not just a fixed nudge), and at each radius fan out from the
 * facing direction so the first clear hit is the one most in front of the anchor.
 * Falls back to the bare anchor only if the whole neighbourhood is blocked.
 * Pure: no GL, no randomness.
 */
export function stationPoint(
  anchor: { x: number; z: number; facing?: number },
  isBlocked: (x: number, z: number) => boolean,
): Vec2 {
  const face = anchor.facing ?? Math.PI / 2
  // Spiral outward from STATION_OFFSET, fanning ± from the facing direction at each
  // radius, and return the first CLEAR point. Standing a touch off the anchor (not
  // exactly on it) keeps the NPC clear of a marker/plinth that sits on the anchor;
  // expanding the radius clears a prop of ANY size (a 5u fountain basin, not just a
  // 1u post). Falls back to the bare anchor only when the whole neighbourhood is
  // blocked (degenerate map).
  const RING = 0.5
  for (let r = STATION_OFFSET; r <= STATION_MAX_PUSH; r += RING) {
    for (let k = 0; k <= 12; k++) {
      const da = (k % 2 === 0 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 6)
      const a = face + da
      const x = anchor.x + Math.cos(a) * r
      const z = anchor.z + Math.sin(a) * r
      if (!isBlocked(x, z)) return { x, z }
    }
  }
  return { x: anchor.x, z: anchor.z }
}

/** How far (x,z) is from a station point. */
export function distFromStation(p: Vec2, station: Vec2): number {
  return Math.hypot(p.x - station.x, p.z - station.z)
}

/** Has an agent drifted past its leash (must aim back toward the station)? */
export function isOffLeash(p: Vec2, station: Vec2): boolean {
  return distFromStation(p, station) > STATION_RADIUS
}

/**
 * Pick the next gentle hover target inside the station ring. Samples a point
 * within STATION_STEP of the station that is free (`isBlocked` false) and — when
 * a player position + `bodyGap` are given — not on top of the player. Falls back
 * to the station point itself if every sample is blocked, so a target ALWAYS lies
 * within STATION_STEP (≤ STATION_RADIUS) of the station. `rand` is injectable for
 * deterministic tests.
 */
export function pickStationTarget(
  station: Vec2,
  opts: {
    isBlocked: (x: number, z: number) => boolean
    clamp?: (x: number, z: number) => Vec2
    player?: Vec2
    bodyGap?: number
    rand?: () => number
    tries?: number
  },
): Vec2 {
  const rand = opts.rand ?? Math.random
  const tries = opts.tries ?? 16
  const gap = opts.bodyGap ?? 0
  for (let i = 0; i < tries; i++) {
    const ang = rand() * Math.PI * 2
    const rad = rand() * STATION_STEP
    let x = station.x + Math.cos(ang) * rad
    let z = station.z + Math.sin(ang) * rad
    if (opts.clamp) {
      const c = opts.clamp(x, z)
      x = c.x
      z = c.z
    }
    if (opts.isBlocked(x, z)) continue
    if (opts.player && gap > 0 && Math.hypot(x - opts.player.x, z - opts.player.z) < gap) continue
    return { x, z }
  }
  return { x: station.x, z: station.z }
}
