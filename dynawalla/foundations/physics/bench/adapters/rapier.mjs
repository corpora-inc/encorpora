// Rapier 2D adapter (@dimforge/rapier2d-compat 0.19.3).
//
// `-compat` inlines the WASM as base64 in the JS so there is no second fetch
// and no asset-path plumbing. That costs ~33% over the raw binary on disk
// (6.4 MB unpacked vs 2.3 MB) but the WASM itself is identical; see README for
// the measured transfer numbers and which one to ship.

let RAPIER = null

export const meta = {
  id: "rapier",
  label: "Rapier 2D 0.19.3",
  wasm: true,
}

export async function init(variant = "default") {
  const mod =
    variant === "deterministic"
      ? await import("@dimforge/rapier2d-deterministic-compat")
      : await import("@dimforge/rapier2d-compat")
  RAPIER = mod.default ?? mod
  await RAPIER.init()
  return RAPIER.version()
}

// Rapier's JS API has NO `collideConnected` flag on impulse joints — unlike
// Box2D, Planck and Matter, whose joints default to NOT colliding the bodies
// they connect. In Rapier, jointed bodies DO collide, and because a joint by
// construction holds two colliders overlapping at the anchor, the contact and
// the joint fight each other and the joint jams solid.
//
// Measured: a simple pendulum (fixed anchor + arm, revolute at the shared
// point) rotates -33.0 deg in 5 s if the anchor has no collider, and 0.0 deg —
// frozen horizontal in mid-air — if it does. Same joint, same masses.
//
// The fix is one membership bit for the whole articulated assembly, cleared
// from its own filter: the assembly never collides with itself and still
// collides with everything else.
const ASSEMBLY_BIT = 0x0002
const ASSEMBLY_GROUPS = (ASSEMBLY_BIT << 16) | (0xffff & ~ASSEMBLY_BIT)

export function build(scene, opts = {}) {
  const world = new RAPIER.World({ x: scene.gravity[0], y: scene.gravity[1] })
  world.timestep = opts.dt ?? 1 / 60
  if (opts.solverIterations) world.numSolverIterations = opts.solverIterations

  // Every body that participates in a joint joins the assembly group, unless
  // the caller explicitly asks for Rapier's raw default in order to see it.
  const jointed = new Set()
  if (!opts.rawJointDefaults) {
    for (const j of scene.joints) {
      jointed.add(j.a)
      jointed.add(j.b)
    }
  }

  const handles = []
  const dynamicIdx = []

  scene.bodies.forEach((b, i) => {
    const desc =
      b.kind === "static"
        ? RAPIER.RigidBodyDesc.fixed()
        : RAPIER.RigidBodyDesc.dynamic()
    desc.setTranslation(b.pos[0], b.pos[1])
    if (b.angle) desc.setRotation(b.angle)
    if (b.velocity) desc.setLinvel(b.velocity[0], b.velocity[1])
    if (opts.noSleep) desc.setCanSleep(false)
    const body = world.createRigidBody(desc)

    for (const sh of b.shapes ?? [b.shape]) {
      const cd = sh.box
        ? RAPIER.ColliderDesc.cuboid(sh.box[0], sh.box[1])
        : RAPIER.ColliderDesc.ball(sh.circle)
      cd.setDensity(b.density ?? 1)
      cd.setFriction(b.friction ?? 0.5)
      cd.setRestitution(b.restitution ?? 0)
      if (sh.at) cd.setTranslation(sh.at[0], sh.at[1])
      if (jointed.has(i)) cd.setCollisionGroups(ASSEMBLY_GROUPS)
      world.createCollider(cd, body)
    }

    handles.push(body)
    if (b.kind !== "static") dynamicIdx.push(i)
  })

  for (const j of scene.joints) {
    if (j.type !== "revolute") throw new Error(`rapier adapter: joint ${j.type}`)
    const data = RAPIER.JointData.revolute(
      { x: j.anchorA[0], y: j.anchorA[1] },
      { x: j.anchorB[0], y: j.anchorB[1] },
    )
    world.createImpulseJoint(data, handles[j.a], handles[j.b], true)
  }

  const out = new Float64Array(dynamicIdx.length * 3)

  return {
    step() {
      world.step()
    },
    snapshot() {
      for (let k = 0; k < dynamicIdx.length; k++) {
        const body = handles[dynamicIdx[k]]
        const t = body.translation()
        out[k * 3] = t.x
        out[k * 3 + 1] = t.y
        out[k * 3 + 2] = body.rotation()
      }
      return out
    },
    // How many bodies the solver actually touched this step. Rapier does not
    // expose an awake count directly, so this counts non-sleeping bodies.
    awake() {
      let n = 0
      for (const i of dynamicIdx) if (!handles[i].isSleeping()) n++
      return n
    },
    destroy() {
      world.free()
    },
  }
}
