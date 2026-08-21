// Chains, levers and gear trains.

import RAPIER from "@dimforge/rapier2d-compat"
import { pin, type World, type Vec2, type BodyHandle } from "../world.ts"

export interface ChainOpts {
  from: Vec2
  links?: number
  /** Metres per link. */
  linkLength?: number
  /** Mass hung on the free end, in multiples of one link's mass. */
  load?: number
  /** Pin the far end too, for a hanging banner or a rope bridge. */
  to?: Vec2
}

export interface Chain {
  readonly links: BodyHandle[]
  readonly bob: BodyHandle | null
  /** Measured length / rest length - 1, as a percentage. Cheap; use it in tests. */
  stretchPct(): number
}

/**
 * A chain that behaves like a chain.
 *
 * `bench/probe-rope.mjs` swept the load:link mass ratio across four engines.
 * Rapier at its default 4 solver iterations holds 0.7% stretch at 10:1, 3.3% at
 * 150:1 and 17.5% at 2000:1; 16 iterations brings 2000:1 down to 7% for 3.4x
 * the solve cost. (For contrast, Planck stretches 64% at 10:1 and more
 * iterations barely help — Box2D 2.4's solver simply cannot hold a chain.)
 *
 * So the guidance encoded here is: keep `load` at or under ~150 link-masses and
 * the default tier is fine. Above that, raise the tier rather than the link
 * count — a longer chain of lighter links is cheaper AND more stable than a
 * short chain fighting a boulder.
 */
export function chain(w: World, o: ChainOpts): Chain {
  const links = o.links ?? 20
  const half = (o.linkLength ?? 0.2) / 2
  const asm = w.newAssembly()
  const [ax, ay] = o.from

  const anchor = w.add("static", { box: [0.08, 0.08] }, [ax, ay], { assembly: asm })
  const made: BodyHandle[] = []
  for (let i = 0; i < links; i++) {
    const link = w.add("dynamic", { box: [half, half * 0.5] }, [ax + half + i * half * 2, ay], {
      assembly: asm,
      density: 4,
      friction: 0.2,
    })
    // Damping is not a cheat, it is the air resistance and inter-link friction
    // a real chain has. Without it a chain released from horizontal swings
    // forever, and the peak tension at the bottom of every swing keeps the
    // measured stretch high long after it should have settled — which is what
    // made the first version of the chain gate fail at 30% on a load the probe
    // said should sit near 3%.
    link.rb.setLinearDamping(0.15)
    link.rb.setAngularDamping(0.25)
    made.push(link)
  }

  pin(w, anchor, made[0]!, [0, 0], [-half, 0])
  for (let i = 0; i < links - 1; i++) pin(w, made[i]!, made[i + 1]!, [half, 0], [-half, 0])

  let bob: BodyHandle | null = null
  if (o.load) {
    const r = 0.35
    // density chosen so the bob is `load` x one link's mass
    const linkMass = 4 * (half * 2) * half
    const density = (o.load * linkMass) / (Math.PI * r * r)
    bob = w.add("dynamic", { circle: r }, [ax + links * half * 2 + r, ay], {
      assembly: asm,
      density,
      friction: 0.4,
    })
    bob.rb.setLinearDamping(0.15)
    pin(w, made[links - 1]!, bob, [half, 0], [-r, 0])
  } else if (o.to) {
    const far = w.add("static", { box: [0.08, 0.08] }, o.to, { assembly: asm })
    pin(w, made[links - 1]!, far, [half, 0], [0, 0])
  }

  const rest = (links - 1) * half * 2 + (bob ? half + 0.35 : 0)
  return {
    links: made,
    bob,
    stretchPct() {
      const pts = [...made, ...(bob ? [bob] : [])]
      let span = 0
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1]!.position()
        const b = pts[i]!.position()
        span += Math.hypot(b[0] - a[0], b[1] - a[1])
      }
      return rest === 0 ? 0 : ((span - rest) / rest) * 100
    },
  }
}

export interface GearTrainOpts {
  at: Vec2
  /** Tooth counts, left to right. Radius is derived so the teeth mesh. */
  teeth: number[]
  /** Metres per tooth. 0.12 reads well on a tablet. */
  module?: number
  /** Radians per second on gear 0. */
  driveSpeed?: number
}

export interface GearTrain {
  readonly gears: { body: BodyHandle; teeth: number; radius: number; ratio: number }[]
  /** Advance the train. Call once per fixed step. */
  update(dt: number): void
  /** Exact angle of gear i, in radians. */
  angleOf(i: number): number
  setSpeed(radPerSec: number): void
}

/**
 * A gear train whose teeth mesh EXACTLY, by construction.
 *
 * Deliberately kinematic, not dynamic. Simulating real involute teeth as
 * colliding rigid bodies is the textbook way to get a gear train that jitters,
 * backlashes, climbs out of mesh and costs a fortune in contacts — dozens of
 * tiny high-speed manifolds per pair, which is exactly the contact profile a
 * mid-range tablet is worst at. Rapier's JS API has no gear joint (fixed,
 * revolute, prismatic, rope and spring are the whole set), so a dynamic train
 * would have to be faked with friction anyway.
 *
 * Driving the angles from one exact ratio chain gives perfect mesh for free,
 * costs nothing per frame, and is deterministic. The teeth are a rendering
 * concern. If a game needs a gear to be BLOCKED by something, put a dynamic
 * body in its path and check the contact — do not ask the solver to do the
 * meshing.
 */
export function gearTrain(w: World, o: GearTrainOpts): GearTrain {
  const module_ = o.module ?? 0.12
  const asm = w.newAssembly()
  const gears: GearTrain["gears"] = []
  let x = o.at[0]
  let ratio = 1
  o.teeth.forEach((teeth, i) => {
    const radius = (teeth * module_) / 2
    if (i > 0) {
      x += gears[i - 1]!.radius + radius
      // Meshed gears turn opposite ways, at the inverse ratio of their teeth.
      ratio = -gears[i - 1]!.ratio * (gears[i - 1]!.teeth / teeth)
    }
    const body = w.add("kinematic", { circle: radius }, [x, o.at[1]], {
      assembly: asm,
      friction: 0.9,
      tag: `gear-${i}`,
    })
    gears.push({ body, teeth, radius, ratio })
  })

  let speed = o.driveSpeed ?? 1
  let angle = 0
  return {
    gears,
    setSpeed: (s) => {
      speed = s
    },
    angleOf: (i) => angle * gears[i]!.ratio,
    update(dt) {
      angle += speed * dt
      for (const g of gears) {
        g.body.rb.setNextKinematicRotation(angle * g.ratio)
      }
    },
  }
}

export interface LeverOpts {
  at: Vec2
  length?: number
  /** Fulcrum position along the beam, -1 (left end) .. +1 (right end). */
  fulcrum?: number
}

/**
 * A lever: the same mechanism as the balance scale but with a LOAD SURFACE
 * rather than hanging pans, so things placed on it can slide and fall off.
 * That is the point — a lever teaches moments, and a moment depends on where
 * the weight sits, which a hanging pan deliberately hides.
 */
export function lever(w: World, o: LeverOpts) {
  const length = o.length ?? 4
  const f = o.fulcrum ?? 0
  const asm = w.newAssembly()
  const [ox, oy] = o.at
  const fulcrumX = ox + f * length
  const post = w.add("static", { box: [0.25, 0.5] }, [fulcrumX, oy + 0.5], { assembly: asm })
  const plank = w.add("dynamic", { box: [length, 0.1] }, [ox, oy + 1.1], {
    assembly: asm,
    density: 2,
    friction: 0.8,
  })
  pin(w, post, plank, [0, 0.5], [f * length, 0])
  return {
    plank,
    /** Signed moment about the fulcrum, in N·m — the exact quantity, for the UI. */
    momentOf(b: BodyHandle) {
      const [bx] = b.position()
      return (bx - fulcrumX) * b.rb.mass() * 10
    },
    tilt: () => plank.angle(),
  }
}

export { RAPIER }
