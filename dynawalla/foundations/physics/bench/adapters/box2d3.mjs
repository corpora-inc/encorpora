// Box2D v3 adapter (box2d3-wasm 5.2.0 -> Box2D v3.x, Erin Catto's soft-step solver).
//
// Two things about this binding are load-bearing and neither is in its README:
//
// 1. The package's entry point picks the SIMD ("deluxe") build only when
//    `WebAssembly.validate(<simd probe>)` passes AND, in a browser,
//    `window.crossOriginIsolated === true`. A Tauri WebView is not
//    cross-origin-isolated unless you add COOP/COEP to the custom protocol
//    response, so the default browser path silently takes the scalar "compat"
//    build. We import the build we want explicitly and report which one ran.
//
// 2. It is an Embind binding, so every value returned by a getter is a heap
//    handle the caller must `.delete()`. `b2Body_GetPosition()` in a
//    per-frame render loop allocates one object per body per frame. This
//    adapter deletes them; the cost of doing so is part of what we measure.

export const meta = { id: "box2d3", label: "Box2D v3 (box2d3-wasm 5.2.0)", wasm: true }

let B = null
let variantUsed = "?"

export async function init(variant = "auto") {
  if (variant === "deluxe" || variant === "compat") {
    const mod = await import(`box2d3-wasm/build/dist/es/${variant}/Box2D.${variant}.mjs`)
    B = await mod.default()
    variantUsed = variant
  } else {
    const mod = await import("box2d3-wasm")
    B = await mod.default()
    // The entry point does not tell you which one it picked. Infer it.
    variantUsed = WebAssembly.validate(
      new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]),
    )
      ? "deluxe(simd)"
      : "compat"
  }
  return `v3 / ${variantUsed}`
}

export function variant() {
  return variantUsed
}

export function build(scene, opts = {}) {
  const dt = opts.dt ?? 1 / 60
  // Box2D v3 takes a SUB-STEP count, not velocity/position iteration counts.
  // 4 is the library default and what Erin tunes against.
  const subSteps = opts.subSteps ?? 4

  const wd = B.b2DefaultWorldDef()
  wd.gravity = new B.b2Vec2(scene.gravity[0], scene.gravity[1])
  if (opts.noSleep) wd.enableSleep = false
  const worldId = B.b2CreateWorld(wd)

  const handles = []
  const dynamicIdx = []

  for (const b of scene.bodies) {
    const bd = B.b2DefaultBodyDef()
    bd.type = b.kind === "static" ? B.b2BodyType.b2_staticBody : B.b2BodyType.b2_dynamicBody
    bd.position = new B.b2Vec2(b.pos[0], b.pos[1])
    if (b.angle) bd.rotation = B.b2MakeRot(b.angle)
    if (b.velocity) bd.linearVelocity = new B.b2Vec2(b.velocity[0], b.velocity[1])
    const id = B.b2CreateBody(worldId, bd)

    const sd = B.b2DefaultShapeDef()
    sd.density = b.density ?? 1
    // `material` is a nested value getter: mutate a copy, then assign it back.
    // Writing `sd.material.friction = x` compiles, runs, and does nothing.
    const mat = sd.material
    mat.friction = b.friction ?? 0.5
    mat.restitution = b.restitution ?? 0
    sd.material = mat

    for (const sh of b.shapes ?? [b.shape]) {
      if (sh.box) {
        // b2MakeBox is origin-centred; b2MakeOffsetBox takes a centre + rotation.
        const poly = sh.at
          ? B.b2MakeOffsetBox(sh.box[0], sh.box[1], new B.b2Vec2(sh.at[0], sh.at[1]), B.b2Rot_identity)
          : B.b2MakeBox(sh.box[0], sh.box[1])
        B.b2CreatePolygonShape(id, sd, poly)
      } else {
        const circle = new B.b2Circle()
        circle.center = new B.b2Vec2(sh.at ? sh.at[0] : 0, sh.at ? sh.at[1] : 0)
        circle.radius = sh.circle
        B.b2CreateCircleShape(id, sd, circle)
      }
    }

    handles.push(id)
    if (b.kind !== "static") dynamicIdx.push(handles.length - 1)
  }

  for (const j of scene.joints) {
    if (j.type !== "revolute") throw new Error(`box2d3 adapter: joint ${j.type}`)
    const jd = B.b2DefaultRevoluteJointDef()
    const base = jd.base
    base.bodyIdA = handles[j.a]
    base.bodyIdB = handles[j.b]
    // v3.1 renamed localAnchorA/B to localFrameA/B (a b2Transform).
    const fa = base.localFrameA
    fa.p = new B.b2Vec2(j.anchorA[0], j.anchorA[1])
    base.localFrameA = fa
    const fb = base.localFrameB
    fb.p = new B.b2Vec2(j.anchorB[0], j.anchorB[1])
    base.localFrameB = fb
    jd.base = base
    B.b2CreateRevoluteJoint(worldId, jd)
  }

  const out = new Float64Array(dynamicIdx.length * 3)

  return {
    step() {
      B.b2World_Step(worldId, dt, subSteps)
    },
    snapshot() {
      for (let k = 0; k < dynamicIdx.length; k++) {
        const id = handles[dynamicIdx[k]]
        const p = B.b2Body_GetPosition(id)
        const r = B.b2Body_GetRotation(id)
        out[k * 3] = p.x
        out[k * 3 + 1] = p.y
        out[k * 3 + 2] = B.b2Rot_GetAngle(r)
        p.delete()
        r.delete()
      }
      return out
    },
    awake() {
      let n = 0
      for (const i of dynamicIdx) if (B.b2Body_IsAwake(handles[i])) n++
      return n
    },
    destroy() {
      B.b2DestroyWorld(worldId)
    },
  }
}
