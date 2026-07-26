// The physics world: the one object a prototype author touches.
//
// Everything in here exists because the bake-off or a probe proved it was
// needed. The measurements are in ../README.md; the short version:
//
// - Fixed timestep, always. A variable dt makes the same input produce a
//   different result on a 120 Hz iPad than on a 60 Hz tablet, which kills
//   replay and makes "the ball goes in the bucket" a device-dependent claim.
// - Interpolated render transforms, always. A fixed 60 Hz sim rendered raw on a
//   120 Hz display judders visibly; the fix is one lerp and it is free.
// - Assembly collision groups by default. Rapier is the only engine of the four
//   whose joints collide the bodies they connect, and it does not expose
//   `collideConnected` at all. Measured: a pendulum with a collider on its
//   anchor does not move — 0.0 deg in 5 s, versus -33.0 deg without. Every
//   articulated recipe in this kit would be silently frozen without this.
// - Flat Float32Array readback. A `{x, y}` object per body per frame is 500
//   allocations a frame at `debris-500`; the GC pause lands on a child's
//   screen as a stutter.

import RAPIER from "@dimforge/rapier2d-compat"
import { makeRng, type Rng } from "./rng.ts"
import { TIERS, guessTier, autoTune, type Tier, type TierName } from "./tiers.ts"

export type Vec2 = readonly [number, number]

/** Fixed simulation rate. Not configurable — see the note above. */
export const FIXED_DT = 1 / 60

/**
 * One membership bit per articulated assembly, cleared from its own filter.
 * 15 assemblies can coexist without colliding internally while still colliding
 * with the world and with each other. Bit 0 is "the world": everything else.
 */
const WORLD_BIT = 0x0001
const MAX_ASSEMBLIES = 15

export interface BodyOpts {
  density?: number
  friction?: number
  restitution?: number
  /** Continuous collision. Costs a broadphase pass; use it on fast small things. */
  bullet?: boolean
  /** Bodies in the same assembly never collide with each other. */
  assembly?: number
  /** Tag readable back from a raycast or a contact. */
  tag?: string
}

/**
 * A collider. `at` offsets it within the body, which is how compound bodies are
 * built — a pan with lips, a bucket, a gear blank with a hub. Compound bodies
 * matter more than they look: a single concave shape is not expressible, and
 * faking one with separate jointed bodies is both slower and less stable.
 */
export type Shape =
  | { box: Vec2; at?: Vec2 }
  | { circle: number; at?: Vec2 }
  | { capsule: [number, number]; at?: Vec2 }

export interface BodyHandle {
  readonly index: number
  readonly rb: RAPIER.RigidBody
  readonly tag: string | undefined
  position(): Vec2
  angle(): number
  velocity(): Vec2
  setVelocity(v: Vec2): void
  applyImpulse(v: Vec2): void
  /** Nudge toward a pose without teleporting — for "put it back" affordances. */
  steerTo(p: Vec2, strength?: number): void
  remove(): void
}

export interface WorldOpts {
  seed?: number
  gravity?: number
  tier?: TierName | "auto"
  deviceHints?: Parameters<typeof guessTier>[0]
}

let rapierReady: Promise<void> | null = null
/**
 * Idempotent init. Calling `RAPIER.init()` twice is not an error but it does
 * re-instantiate the WASM module, and under React StrictMode every mount runs
 * twice — the same class of bug that spawned two Babylon engines in World
 * Plaza. One promise, shared, forever.
 */
export function initPhysics(): Promise<void> {
  rapierReady ??= RAPIER.init()
  return rapierReady
}

export class World {
  readonly rapier: RAPIER.World
  readonly rng: Rng
  tier: Tier

  /** [x, y, cos, sin] per body — render-ready, interpolated, never reallocated. */
  transforms: Float32Array
  /** Live body count; `transforms` beyond `count * 4` is stale. */
  count = 0

  private bodies: (BodyHandle | null)[] = []
  private prev: Float32Array
  private curr: Float32Array
  private accumulator = 0
  private assemblyNext = 1
  private stepCosts: number[] = []
  private frameCount = 0
  /** Monotonic step index — the clock a replay is addressed by. */
  stepIndex = 0

  constructor(opts: WorldOpts = {}) {
    this.rng = makeRng(opts.seed ?? 1)
    const tierName = opts.tier === "auto" || opts.tier === undefined
      ? guessTier(opts.deviceHints)
      : opts.tier
    this.tier = TIERS[tierName]

    this.rapier = new RAPIER.World({ x: 0, y: opts.gravity ?? -10 })
    this.rapier.timestep = FIXED_DT
    this.rapier.numSolverIterations = this.tier.solverIterations

    const cap = this.tier.bodies + 64
    this.transforms = new Float32Array(cap * 4)
    this.prev = new Float32Array(cap * 4)
    this.curr = new Float32Array(cap * 4)
  }

  /** A fresh assembly id. Bodies sharing one never collide with each other. */
  newAssembly(): number {
    const id = this.assemblyNext
    this.assemblyNext = (this.assemblyNext % MAX_ASSEMBLIES) + 1
    return id
  }

  private groupsFor(assembly: number | undefined): number {
    if (assembly === undefined) return (WORLD_BIT << 16) | 0xffff
    const bit = 1 << assembly
    return (bit << 16) | (0xffff & ~bit)
  }

  add(kind: "dynamic" | "static" | "kinematic", shape: Shape | Shape[], at: Vec2, o: BodyOpts = {}): BodyHandle {
    const desc =
      kind === "static"
        ? RAPIER.RigidBodyDesc.fixed()
        : kind === "kinematic"
          ? RAPIER.RigidBodyDesc.kinematicPositionBased()
          : RAPIER.RigidBodyDesc.dynamic()
    desc.setTranslation(at[0], at[1])
    if (o.bullet) desc.setCcdEnabled(true)
    const rb = this.rapier.createRigidBody(desc)

    const groups = this.groupsFor(o.assembly)
    for (const s of Array.isArray(shape) ? shape : [shape]) {
      const cd = shapeDesc(s)
      cd.setDensity(o.density ?? 1)
      cd.setFriction(o.friction ?? 0.5)
      cd.setRestitution(o.restitution ?? 0)
      cd.setCollisionGroups(groups)
      if (s.at) cd.setTranslation(s.at[0], s.at[1])
      this.rapier.createCollider(cd, rb)
    }

    const index = this.bodies.length
    const handle: BodyHandle = {
      index,
      rb,
      tag: o.tag,
      position: () => {
        const t = rb.translation()
        return [t.x, t.y] as Vec2
      },
      angle: () => rb.rotation(),
      velocity: () => {
        const v = rb.linvel()
        return [v.x, v.y] as Vec2
      },
      setVelocity: (v) => rb.setLinvel({ x: v[0], y: v[1] }, true),
      applyImpulse: (v) => rb.applyImpulse({ x: v[0], y: v[1] }, true),
      steerTo: (p, strength = 12) => {
        const t = rb.translation()
        const m = rb.mass()
        rb.applyImpulse(
          { x: (p[0] - t.x) * strength * m * FIXED_DT, y: (p[1] - t.y) * strength * m * FIXED_DT },
          true,
        )
      },
      remove: () => {
        this.bodies[index] = null
        this.rapier.removeRigidBody(rb)
      },
    }
    this.bodies.push(handle)
    this.growIfNeeded()
    return handle
  }

  private growIfNeeded() {
    const need = this.bodies.length * 4
    if (need <= this.transforms.length) return
    const cap = Math.max(need, this.transforms.length * 2)
    const grow = (a: Float32Array) => {
      const n = new Float32Array(cap)
      n.set(a)
      return n
    }
    this.transforms = grow(this.transforms)
    this.prev = grow(this.prev)
    this.curr = grow(this.curr)
  }

  /**
   * Advance by real elapsed time. Call it with the raw rAF delta; the fixed
   * step and the leftover-time interpolation are handled here.
   *
   * The clamp is not a nicety. A WebView that was backgrounded — an iOS app
   * switch, an Android doze, a Tauri window minimise — resumes with a delta of
   * whole seconds. Without the clamp the world tries to simulate every missed
   * step in one frame, which on a tablet is a multi-second freeze that looks
   * exactly like a crash. We drop the time instead; a child who came back to
   * the app would rather the lamp be where they left it than watch it
   * fast-forward.
   */
  advance(dtSeconds: number): number {
    this.accumulator += Math.min(dtSeconds, this.tier.maxCatchUpSteps * FIXED_DT)
    let steps = 0
    while (this.accumulator >= FIXED_DT && steps < this.tier.maxCatchUpSteps) {
      this.prev.set(this.curr)
      const t0 = performance.now()
      this.rapier.step()
      this.stepCosts.push(performance.now() - t0)
      this.stepIndex++
      this.readInto(this.curr)
      this.accumulator -= FIXED_DT
      steps++
    }
    if (steps === 0) {
      // No step ran, but the display still refreshed: interpolate further along
      // the SAME segment rather than freezing. This is what makes 60 Hz physics
      // look smooth on a 120 Hz iPad.
      this.interpolate(this.accumulator / FIXED_DT)
    } else {
      this.interpolate(this.accumulator / FIXED_DT)
    }
    this.frameCount++
    if (this.stepCosts.length > 240) this.stepCosts.splice(0, this.stepCosts.length - 240)
    return steps
  }

  /** One exact step. For tests, replays and headless simulation. */
  stepExact(n = 1): void {
    for (let i = 0; i < n; i++) {
      this.rapier.step()
      this.stepIndex++
    }
    this.readInto(this.curr)
    this.prev.set(this.curr)
    this.transforms.set(this.curr)
    this.count = this.bodies.length
  }

  private readInto(out: Float32Array) {
    let n = 0
    for (const b of this.bodies) {
      if (b) {
        const t = b.rb.translation()
        const r = b.rb.rotation()
        out[n * 4] = t.x
        out[n * 4 + 1] = t.y
        // cos/sin rather than the angle: the renderer wants them, and computing
        // them once here beats 500 Math.cos calls in the draw loop.
        out[n * 4 + 2] = Math.cos(r)
        out[n * 4 + 3] = Math.sin(r)
      }
      n++
    }
    this.count = n
  }

  private interpolate(alpha: number) {
    const a = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha
    const t = this.transforms
    const p = this.prev
    const c = this.curr
    const n = this.count * 4
    for (let i = 0; i < n; i++) t[i] = p[i]! + (c[i]! - p[i]!) * a
  }

  /** p99 physics step cost over the last ~4 s. The number the budget is about. */
  p99StepMs(): number {
    if (this.stepCosts.length === 0) return 0
    const s = [...this.stepCosts].sort((x, y) => x - y)
    return s[Math.min(s.length - 1, Math.floor(s.length * 0.99))]!
  }

  /** Re-tier from measured cost. Safe to call every second. */
  retune(budgetMs = 4): TierName {
    const next = autoTune(this.tier.name, this.p99StepMs(), budgetMs)
    if (next !== this.tier.name) this.setTier(next)
    return next
  }

  setTier(name: TierName) {
    this.tier = TIERS[name]
    this.rapier.numSolverIterations = this.tier.solverIterations
  }

  awakeCount(): number {
    let n = 0
    for (const b of this.bodies) if (b && !b.rb.isSleeping()) n++
    return n
  }

  /**
   * Quantised state hash. Quantised to 0.1 mm because a bit-exact hash of f32
   * state is too brittle to be useful across engines — see the determinism
   * section of the README, where V8 and JavaScriptCore agree to the bit today
   * but nothing in either spec promises they will tomorrow.
   */
  hash(): string {
    let h = 0x811c9dc5
    const n = this.count * 4
    for (let i = 0; i < n; i++) {
      const q = Math.round(this.curr[i]! * 10000) | 0
      for (let s = 0; s < 32; s += 8) {
        h ^= (q >>> s) & 0xff
        h = Math.imul(h, 0x01000193) >>> 0
      }
    }
    return h.toString(16).padStart(8, "0")
  }

  raycast(from: Vec2, dir: Vec2, maxToi = 100): { point: Vec2; toi: number } | null {
    const ray = new RAPIER.Ray({ x: from[0], y: from[1] }, { x: dir[0], y: dir[1] })
    const hit = this.rapier.castRay(ray, maxToi, true)
    if (!hit) return null
    return {
      toi: hit.timeOfImpact,
      point: [from[0] + dir[0] * hit.timeOfImpact, from[1] + dir[1] * hit.timeOfImpact],
    }
  }

  dispose() {
    this.rapier.free()
    this.bodies = []
  }
}

function shapeDesc(s: Shape): RAPIER.ColliderDesc {
  if ("box" in s) return RAPIER.ColliderDesc.cuboid(s.box[0], s.box[1])
  if ("circle" in s) return RAPIER.ColliderDesc.ball(s.circle)
  return RAPIER.ColliderDesc.capsule(s.capsule[0], s.capsule[1])
}

/**
 * Pin two bodies at a shared point, free to rotate. Local anchors, like Rapier
 * — NOT a world point like Box2D/Planck, which is the single most common
 * porting mistake between the two families.
 */
export function pin(
  w: World,
  a: BodyHandle,
  b: BodyHandle,
  anchorA: Vec2,
  anchorB: Vec2,
  /** Optional [min, max] rotation in radians — a mechanical stop. */
  limit?: readonly [number, number],
): RAPIER.ImpulseJoint {
  const data = RAPIER.JointData.revolute(
    { x: anchorA[0], y: anchorA[1] },
    { x: anchorB[0], y: anchorB[1] },
  )
  const joint = w.rapier.createImpulseJoint(data, a.rb, b.rb, true)
  if (limit) {
    // TRAP: setting `data.limitsEnabled = true` and `data.limits = [...]` on the
    // JointData BEFORE creating the joint type-checks, runs, and does nothing
    // at all for a revolute joint. Measured: an arm with a +/-22 deg stop set
    // that way swings to -174 deg, and `joint.limitsEnabled()` reads back
    // false. The limit has to be applied to the CREATED joint.
    ;(joint as RAPIER.RevoluteImpulseJoint).setLimits(limit[0], limit[1])
  }
  return joint
}
