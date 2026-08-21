// Planck.js adapter (planck 1.5.0) — a pure-JS port of Box2D 2.4.
// No WASM, so no init cost, no COOP/COEP question, and it tree-shakes.

import * as pl from "planck"

export const meta = { id: "planck", label: "Planck.js 1.5.0 (pure JS)", wasm: false }

export async function init() {
  return "1.5.0"
}

/** Local anchor -> world anchor. Planck's revolute joint takes ONE world point. */
function worldAnchor(body, local) {
  const c = Math.cos(body.angle ?? 0)
  const s = Math.sin(body.angle ?? 0)
  return {
    x: body.pos[0] + local[0] * c - local[1] * s,
    y: body.pos[1] + local[0] * s + local[1] * c,
  }
}

export function build(scene, opts = {}) {
  const dt = opts.dt ?? 1 / 60
  const velIters = opts.velocityIterations ?? 8
  const posIters = opts.positionIterations ?? 3
  const world = new pl.World({
    gravity: new pl.Vec2(scene.gravity[0], scene.gravity[1]),
    allowSleep: !opts.noSleep,
  })

  const handles = []
  const dynamicIdx = []

  scene.bodies.forEach((b, i) => {
    const body = world.createBody({
      type: b.kind === "static" ? "static" : "dynamic",
      position: new pl.Vec2(b.pos[0], b.pos[1]),
      angle: b.angle ?? 0,
      ...(b.velocity ? { linearVelocity: new pl.Vec2(b.velocity[0], b.velocity[1]) } : {}),
    })
    for (const sh of b.shapes ?? [b.shape]) {
      const at = sh.at ? new pl.Vec2(sh.at[0], sh.at[1]) : new pl.Vec2(0, 0)
      const shape = sh.box
        ? new pl.Box(sh.box[0], sh.box[1], at, 0)
        : new pl.Circle(at, sh.circle)
      body.createFixture(shape, {
        density: b.density ?? 1,
        friction: b.friction ?? 0.5,
        restitution: b.restitution ?? 0,
      })
    }
    handles.push(body)
    if (b.kind !== "static") dynamicIdx.push(i)
  })

  for (const j of scene.joints) {
    if (j.type !== "revolute") throw new Error(`planck adapter: joint ${j.type}`)
    const wa = worldAnchor(scene.bodies[j.a], j.anchorA)
    world.createJoint(
      new pl.RevoluteJoint({}, handles[j.a], handles[j.b], new pl.Vec2(wa.x, wa.y)),
    )
  }

  const out = new Float64Array(dynamicIdx.length * 3)

  return {
    step() {
      world.step(dt, velIters, posIters)
    },
    snapshot() {
      for (let k = 0; k < dynamicIdx.length; k++) {
        const body = handles[dynamicIdx[k]]
        const p = body.getPosition()
        out[k * 3] = p.x
        out[k * 3 + 1] = p.y
        out[k * 3 + 2] = body.getAngle()
      }
      return out
    },
    awake() {
      let n = 0
      for (const i of dynamicIdx) if (handles[i].isAwake()) n++
      return n
    },
    destroy() {},
  }
}
