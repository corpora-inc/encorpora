import type { CircleObstacle } from "./collision"

/**
 * kinetics.ts — OPTIONAL "physics for cool effects" (the owner's stretch goal).
 *
 * STRICTLY SEPARABLE from the deterministic collision core: nothing in
 * collision.ts / controller.ts / crowd.ts imports this. It is opt-in flair —
 * wire it ONLY when you want a couple of light props to react to a bump (a
 * barrel/crate that rolls a little when the player nudges it). The rock-solid,
 * cheap, deterministic glitch-prevention stays the source of truth; if this is
 * disabled or removed, collision is unaffected.
 *
 * MODEL (cheap, stable, no physics engine):
 *   • a small set of DYNAMIC props (barrels/crates) become `KineticBody`s with a
 *     position + velocity + radius + drag.
 *   • each frame, the player (and optionally agents) "bumps" a body: if a mover
 *     of radius `pr` at (px,pz) overlaps the body, the body gains an impulse
 *     AWAY from the mover, proportional to the overlap and the mover's speed.
 *   • bodies integrate with heavy drag (they coast a short distance then settle)
 *     and are clamped against the STATIC field so a nudged barrel can't roll
 *     through a wall/another prop.
 *   • Capped step + max-speed keep it from ever exploding; deterministic given
 *     the same bumps.
 *
 * The dynamic bodies should be REMOVED from the static obstacle field (so they
 * don't double as immovable AND movable); the caller registers them here and
 * adds their live circles back as "soft" obstacles via `bodies()` if it wants
 * agents to also avoid them.
 */

export interface KineticBody {
  x: number
  z: number
  vx: number
  vz: number
  r: number
  /** original spawn — bodies are tethered loosely so they don't drift away. */
  homeX: number
  homeZ: number
}

export interface KineticsOptions {
  /** velocity decay per second (0..1 of speed retained over 1s); lower = stickier. */
  drag?: number
  /** clamp body speed (world u/s) so a hard bump can't fling a barrel. */
  maxSpeed?: number
  /** spring pulling a body gently home so the plaza self-tidies. 0 = no tether. */
  tether?: number
  /** how much a mover's bump transfers (impulse scale). */
  bumpScale?: number
  /** keep dynamic bodies out of these STATIC obstacles (walls + solid props). */
  isBlocked?: (x: number, z: number, r: number) => boolean
}

export interface Kinetics {
  bodies: () => readonly KineticBody[]
  /** register a movable prop (e.g. a barrel) at a position. */
  add: (x: number, z: number, r: number) => KineticBody
  /** a mover (player/agent) nudges any overlapping bodies this frame. */
  bump: (px: number, pz: number, pr: number, pvx: number, pvz: number) => void
  /** integrate one step (drag, tether, static-clamp). */
  update: (dt: number) => void
}

export function createKinetics(opts: KineticsOptions = {}): Kinetics {
  const drag = opts.drag ?? 0.06 // retain 6%/s → settles in well under a second
  const maxSpeed = opts.maxSpeed ?? 3.0
  const tether = opts.tether ?? 0.6
  const bumpScale = opts.bumpScale ?? 1.4
  const isBlocked = opts.isBlocked
  const bodies: KineticBody[] = []

  const add: Kinetics["add"] = (x, z, r) => {
    const b: KineticBody = { x, z, vx: 0, vz: 0, r, homeX: x, homeZ: z }
    bodies.push(b)
    return b
  }

  const bump: Kinetics["bump"] = (px, pz, pr, pvx, pvz) => {
    const pspeed = Math.hypot(pvx, pvz)
    for (const b of bodies) {
      const dx = b.x - px
      const dz = b.z - pz
      const d = Math.hypot(dx, dz)
      const need = b.r + pr
      if (d > 0 && d < need) {
        const nx = dx / d
        const nz = dz / d
        const overlap = need - d
        // impulse ∝ overlap + the mover's forward speed along the contact normal.
        const along = Math.max(0, pvx * nx + pvz * nz)
        const imp = (overlap * 4 + (pspeed + along) * 0.5) * bumpScale
        b.vx += nx * imp
        b.vz += nz * imp
      }
    }
  }

  const update: Kinetics["update"] = (dt) => {
    const decay = Math.pow(drag, dt) // frame-rate independent drag
    for (const b of bodies) {
      // gentle tether home (so a rolled prop drifts back, plaza self-tidies).
      if (tether > 0) {
        b.vx += (b.homeX - b.x) * tether * dt
        b.vz += (b.homeZ - b.z) * tether * dt
      }
      b.vx *= decay
      b.vz *= decay
      // clamp speed.
      const sp = Math.hypot(b.vx, b.vz)
      if (sp > maxSpeed) {
        b.vx = (b.vx / sp) * maxSpeed
        b.vz = (b.vz / sp) * maxSpeed
      }
      let nx = b.x + b.vx * dt
      let nz = b.z + b.vz * dt
      // clamp against the static world (axis-separated, kill that axis' velocity).
      if (isBlocked) {
        if (isBlocked(nx, b.z, b.r)) {
          nx = b.x
          b.vx = 0
        }
        if (isBlocked(b.x, nz, b.r)) {
          nz = b.z
          b.vz = 0
        }
      }
      b.x = nx
      b.z = nz
    }
  }

  return { bodies: () => bodies, add, bump, update }
}

/** Pick a few placed barrels/crates to make dynamic (the rest stay static). The
 * caller removes these from the static field and registers them with Kinetics. */
export function pickDynamicProps(
  footprints: CircleObstacle[],
  max = 4,
): CircleObstacle[] {
  // deterministic: the first few barrels/crates by position order.
  return footprints.slice(0, max)
}
