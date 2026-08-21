// Matter.js adapter (matter-js 0.20.0).
//
// Matter is not a metric engine. It is a SCREEN-SPACE engine: +y is down, the
// unit is the pixel, and its tolerances (`Resolver._restingThresh`, slop 0.05,
// `gravity.scale` 1e-3) are tuned for a world a few hundred pixels tall. So the
// adapter converts: 100 px = 1 m, and y is flipped on the way in and on the way
// out. Anyone porting a Matter prototype to any other engine pays this tax once
// and it is easy to get subtly wrong — which is itself a finding.
//
// Its constraints are position-based soft constraints applied in a fixed
// number of passes, not a joint solver. A revolute is "length 0, stiffness 1".

import Matter from "matter-js"

const { Engine, Bodies, Body, Composite, Constraint } = Matter

const S = 100 // px per metre

export const meta = { id: "matter", label: "Matter.js 0.20.0 (pure JS)", wasm: false }

export async function init() {
  return "0.20.0"
}

export function build(scene, opts = {}) {
  const dtMs = (opts.dt ?? 1 / 60) * 1000
  const engine = Engine.create()
  // Matter's default gravity {y:1, scale:0.001} works out to ~1000 px/s^2,
  // which at 100 px/m is the 10 m/s^2 every other adapter gets.
  engine.gravity.x = scene.gravity[0] / 10
  engine.gravity.y = -scene.gravity[1] / 10
  if (opts.matterIterations) {
    engine.positionIterations = opts.matterIterations
    engine.velocityIterations = opts.matterIterations
  }

  const handles = []
  const dynamicIdx = []

  scene.bodies.forEach((b, i) => {
    const isStatic = b.kind === "static"
    const x = b.pos[0] * S
    const y = -b.pos[1] * S
    const opts = { friction: b.friction ?? 0.5, restitution: b.restitution ?? 0 }
    const mk = (sh) => {
      const ox = x + (sh.at ? sh.at[0] * S : 0)
      const oy = y - (sh.at ? sh.at[1] * S : 0)
      return sh.box
        ? Bodies.rectangle(ox, oy, sh.box[0] * 2 * S, sh.box[1] * 2 * S, opts)
        : Bodies.circle(ox, oy, sh.circle * S, opts)
    }
    const shapes = b.shapes ?? [b.shape]
    const body =
      shapes.length === 1 ? mk(shapes[0]) : Body.create({ parts: shapes.map(mk), ...opts })
    if (isStatic) Body.setStatic(body, true)
    if (b.angle) Body.setAngle(body, -b.angle)
    if (!isStatic) Body.setDensity(body, (b.density ?? 1) * 0.001)
    if (b.velocity) Body.setVelocity(body, { x: (b.velocity[0] * S) / 60, y: (-b.velocity[1] * S) / 60 })
    Composite.add(engine.world, body)
    handles.push(body)
    if (!isStatic) dynamicIdx.push(i)
  })

  for (const j of scene.joints) {
    if (j.type !== "revolute") throw new Error(`matter adapter: joint ${j.type}`)
    Composite.add(
      engine.world,
      Constraint.create({
        bodyA: handles[j.a],
        pointA: { x: j.anchorA[0] * S, y: -j.anchorA[1] * S },
        bodyB: handles[j.b],
        pointB: { x: j.anchorB[0] * S, y: -j.anchorB[1] * S },
        length: 0,
        stiffness: 1,
        damping: 0,
      }),
    )
  }

  const out = new Float64Array(dynamicIdx.length * 3)

  return {
    step() {
      Engine.update(engine, dtMs)
    },
    snapshot() {
      for (let k = 0; k < dynamicIdx.length; k++) {
        const body = handles[dynamicIdx[k]]
        out[k * 3] = body.position.x / S
        out[k * 3 + 1] = -body.position.y / S
        out[k * 3 + 2] = -body.angle
      }
      return out
    },
    awake() {
      let n = 0
      for (const i of dynamicIdx) if (!handles[i].isSleeping) n++
      return n
    },
    destroy() {
      Engine.clear(engine)
    },
  }
}
