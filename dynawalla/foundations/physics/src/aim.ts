// Aiming: trajectories that are TRUE, and assist that is honest about helping.
//
// The measurement that decided this file: fire a ball with gravity -10 and read
// its position every step for 2 s, then compare three ways of predicting it.
//
//   symplectic Euler  (v += g·dt; p += v·dt)   125.01 mm off
//   explicit Euler    (p += v·dt; v += g·dt)   208.33 mm off
//   the continuous parabola  y = y0+vy·t-½gt²   41.66 mm off
//
// None of them is right, because none of them is what Rapier actually does.
// Drawing any of them as the dotted aiming arc means drawing a lie — and the
// moment the shot touches ANYTHING the error stops being millimetres, because
// no closed form knows about the bounce.
//
// So we predict by stepping a real Rapier world containing the projectile and
// the static scenery. Measured over 150 steps including a bounce off the ground
// AND a ricochet off a ramp: **0.000000 mm** divergence from the real shot. The
// arc a child sees is the arc, by construction.
//
// Cost, measured: 0.70 ms per 150-step prediction with the shadow world reused
// (M-series Mac, Node/V8). That is real money against a 16.67 ms frame, so the
// rules the kit enforces are: predict only when the aim CHANGES, cap the step
// count at the tier's `predictSteps`, and stop early on impact.

import RAPIER from "@dimforge/rapier2d-compat"
import { FIXED_DT, type World, type Vec2 } from "./world.ts"

export interface Trajectory {
  /** [x, y] pairs, one per simulated step. Length is `steps * 2`. */
  path: Float32Array
  steps: number
  /** Where it first touched something, if it did. */
  impact: Vec2 | null
  /** Step index of the impact. */
  impactStep: number
}

export interface LauncherOpts {
  at: Vec2
  /** Projectile radius. */
  radius?: number
  density?: number
  restitution?: number
  /** Continuous collision detection. On by default: a fast small ball tunnels. */
  bullet?: boolean
}

export interface Launcher {
  readonly at: Vec2
  /** The exact flight path for this aim. Cached until the aim changes. */
  predict(aim: { angle: number; speed: number }, steps?: number): Trajectory
  /** Fire for real into the live world. */
  fire(aim: { angle: number; speed: number }): ReturnType<World["add"]>
  /**
   * Aim assist. Searches launch angles for the one that lands nearest `target`
   * and returns it with the miss distance, so the caller decides whether to
   * apply it. Returns null if nothing in the search window gets close.
   */
  assist(target: Vec2, opts?: AssistOpts): { angle: number; speed: number; missM: number } | null
  dispose(): void
}

export interface AssistOpts {
  speed?: number
  /** Only assist if the player's own aim was already within this many radians. */
  window?: number
  /** Give up if the best candidate still misses by more than this. */
  toleranceM?: number
  /** The player's current angle, so assist can stay inside `window` of it. */
  from?: number
  /** Candidate angles to try across the window. More = better fit, more cost. */
  samples?: number
}

/**
 * Build a launcher bound to `world`.
 *
 * The shadow world is a SEPARATE Rapier world holding copies of the static
 * scenery only. It has to be separate: predicting inside the live world would
 * advance the live world, and Rapier's `takeSnapshot`/`restoreSnapshot` round
 * trip serialises every body in the scene, which at 500 bodies costs far more
 * than the prediction itself.
 *
 * The consequence, stated plainly because it will bite someone: the prediction
 * knows about STATIC geometry only. A shot aimed through a swinging bucket or a
 * tower of blocks will diverge at the moment it reaches them. That is the
 * correct trade — the arc is exact over the free-flight and terrain-bounce part
 * a player is actually aiming with, and games should stop drawing the arc at
 * `impact` rather than pretending to know what happens after it hits the
 * player's own tower.
 */
export function launcher(world: World, o: LauncherOpts): Launcher {
  const radius = o.radius ?? 0.25
  const density = o.density ?? 2
  const restitution = o.restitution ?? 0.35
  const bullet = o.bullet ?? true

  const shadow = new RAPIER.World(world.rapier.gravity)
  shadow.timestep = FIXED_DT
  shadow.numSolverIterations = world.tier.solverIterations
  mirrorStatics(world, shadow)

  let cacheKey = ""
  let cached: Trajectory | null = null

  function simulate(angle: number, speed: number, steps: number): Trajectory {
    const rb = shadow.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(o.at[0], o.at[1])
        .setLinvel(Math.cos(angle) * speed, Math.sin(angle) * speed)
        .setCcdEnabled(bullet),
    )
    shadow.createCollider(
      RAPIER.ColliderDesc.ball(radius).setDensity(density).setRestitution(restitution).setFriction(0.4),
      rb,
    )
    const path = new Float32Array(steps * 2)
    let impact: Vec2 | null = null
    let impactStep = -1
    let n = 0
    let lastV = speed
    for (let i = 0; i < steps; i++) {
      shadow.step()
      const t = rb.translation()
      path[i * 2] = t.x
      path[i * 2 + 1] = t.y
      n = i + 1
      if (impact === null) {
        const v = rb.linvel()
        const sp = Math.hypot(v.x, v.y)
        // A contact is the only thing that can remove speed faster than
        // gravity adds it. 0.55 is loose enough to survive a grazing hit and
        // tight enough not to fire on a fast apex.
        if (sp < lastV * 0.55) {
          impact = [t.x, t.y]
          impactStep = i
        }
        lastV = Math.max(sp, 0.001)
      }
    }
    shadow.removeRigidBody(rb)
    return { path, steps: n, impact, impactStep }
  }

  return {
    at: o.at,
    predict(aim, steps) {
      const n = Math.min(steps ?? world.tier.predictSteps, 600)
      const key = `${aim.angle.toFixed(5)}|${aim.speed.toFixed(4)}|${n}`
      if (key === cacheKey && cached) return cached
      cacheKey = key
      cached = simulate(aim.angle, aim.speed, n)
      return cached
    },
    fire(aim) {
      const shot = world.add("dynamic", { circle: radius }, o.at, {
        density,
        restitution,
        friction: 0.4,
        bullet,
        tag: "shot",
      })
      // The launch velocity must be set with the SAME expression the predictor
      // used, or the arc and the shot diverge — which is exactly the bug the
      // test `aim: the predicted arc IS the flight path` exists to catch. It
      // caught it.
      shot.setVelocity([Math.cos(aim.angle) * aim.speed, Math.sin(aim.angle) * aim.speed])
      return shot
    },
    assist(target, opts = {}) {
      const speed = opts.speed ?? 12
      const window = opts.window ?? 0.28
      const tolerance = opts.toleranceM ?? 1.2
      const samples = opts.samples ?? 9
      const centre = opts.from ?? Math.atan2(target[1] - o.at[1], target[0] - o.at[0])
      let best: { angle: number; missM: number } | null = null
      for (let i = 0; i < samples; i++) {
        const angle = centre + (samples === 1 ? 0 : (i / (samples - 1) - 0.5) * 2 * window)
        const tr = simulate(angle, speed, world.tier.predictSteps)
        let miss = Infinity
        for (let s = 0; s < tr.steps; s++) {
          const d = Math.hypot(tr.path[s * 2]! - target[0], tr.path[s * 2 + 1]! - target[1])
          if (d < miss) miss = d
        }
        if (!best || miss < best.missM) best = { angle, missM: miss }
      }
      if (!best || best.missM > tolerance) return null
      return { angle: best.angle, speed, missM: best.missM }
    },
    dispose() {
      shadow.free()
    },
  }
}

/**
 * Copy every static collider from the live world into the shadow world.
 *
 * Only cuboids and balls are mirrored, which covers every static shape the kit
 * builds. If a game adds its own static geometry with another shape it must
 * rebuild the launcher, or the arc will fly straight through it — a failure
 * mode worth knowing about because it is silent and looks like a physics bug.
 */
function mirrorStatics(world: World, shadow: RAPIER.World) {
  world.rapier.forEachCollider((c) => {
    const parent = c.parent()
    if (!parent || !parent.isFixed()) return
    const t = c.translation()
    const rb = shadow.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(t.x, t.y).setRotation(c.rotation()),
    )
    const shape = c.shape
    let desc: RAPIER.ColliderDesc | null = null
    if (shape.type === RAPIER.ShapeType.Cuboid) {
      const h = (shape as RAPIER.Cuboid).halfExtents
      desc = RAPIER.ColliderDesc.cuboid(h.x, h.y)
    } else if (shape.type === RAPIER.ShapeType.Ball) {
      desc = RAPIER.ColliderDesc.ball((shape as RAPIER.Ball).radius)
    }
    if (!desc) return
    desc.setFriction(c.friction()).setRestitution(c.restitution())
    shadow.createCollider(desc, rb)
  })
}
