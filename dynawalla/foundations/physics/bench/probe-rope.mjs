// PROBE: where does a chain stop looking like a chain?
//
// Ropes, chains, pulleys and swinging buckets are on the Bazaar's list, and the
// thing that breaks them is the MASS RATIO between the load and one link. Below
// some ratio every engine is fine; above it the chain stretches like elastic
// and then explodes. This finds each engine's cliff, and what raising the
// solver iteration count buys.
//
//   node bench/probe-rope.mjs

import { ropeScene, ROPE_REST } from "./scenes.mjs"

const ADAPTERS = {
  rapier: () => import("./adapters/rapier.mjs"),
  box2d3: () => import("./adapters/box2d3.mjs"),
  planck: () => import("./adapters/planck.mjs"),
  matter: () => import("./adapters/matter.mjs"),
}

// One link is 0.2 x 0.1 m => area 0.02 m^2. The bob is a 0.35 m disc =>
// 0.3848 m^2. So ratio = (bobDensity * 0.3848) / (linkDensity * 0.02).
const LINK_AREA = 0.2 * 0.1
const BOB_AREA = Math.PI * 0.35 * 0.35

function stretch(mod, opts, build = {}) {
  const scene = ropeScene(opts)
  const sim = mod.build(scene, build)
  for (let i = 0; i < 600; i++) sim.step()
  const s = sim.snapshot()
  sim.destroy()
  const n = s.length / 3
  let span = 0
  for (let k = 1; k < n; k++) {
    span += Math.hypot(s[k * 3] - s[(k - 1) * 3], s[k * 3 + 1] - s[(k - 1) * 3 + 1])
  }
  if (!Number.isFinite(span)) return Infinity
  return ((span - ROPE_REST) / ROPE_REST) * 100
}

const RATIOS = [10, 50, 150, 500, 2000]
const linkDensity = 4

console.log("stretch % of a 60-link chain after 10 s, by bob:link mass ratio")
console.log("(> ~5% is visible as elastic; > 50% is broken; Inf is an explosion)")
console.log("engine".padEnd(9) + RATIOS.map((r) => `${r}:1`.padStart(10)).join(""))

for (const id of Object.keys(ADAPTERS)) {
  const mod = await ADAPTERS[id]()
  await mod.init()
  const row = RATIOS.map((ratio) => {
    const bobDensity = (ratio * linkDensity * LINK_AREA) / BOB_AREA
    const v = stretch(mod, { linkDensity, bobDensity })
    return (Number.isFinite(v) ? v.toFixed(1) : "EXPLODED").padStart(10)
  })
  console.log(id.padEnd(9) + row.join(""))
}

// What do extra solver iterations buy on the worst ratio? Rapier and Planck
// expose an iteration count; Box2D v3 exposes sub-steps; Matter exposes both
// position and velocity iteration counts.
console.log("\nsame chain at 2000:1, with the engine's quality dial turned up")
const worst = { linkDensity, bobDensity: (2000 * linkDensity * LINK_AREA) / BOB_AREA }
const DIALS = {
  rapier: [{ solverIterations: 4 }, { solverIterations: 8 }, { solverIterations: 16 }],
  box2d3: [{ subSteps: 4 }, { subSteps: 8 }, { subSteps: 16 }],
  planck: [
    { velocityIterations: 8, positionIterations: 3 },
    { velocityIterations: 16, positionIterations: 6 },
    { velocityIterations: 32, positionIterations: 12 },
  ],
  matter: [{ matterIterations: 6 }, { matterIterations: 12 }, { matterIterations: 24 }],
}
for (const id of Object.keys(ADAPTERS)) {
  const mod = await ADAPTERS[id]()
  await mod.init()
  const row = DIALS[id].map((d) => {
    const t0 = performance.now()
    const v = stretch(mod, worst, d)
    const ms = (performance.now() - t0) / 600
    const label = Object.values(d).join("/")
    return `${label}=${Number.isFinite(v) ? v.toFixed(0) + "%" : "EXPLODED"} @${ms.toFixed(3)}ms`
  })
  console.log(id.padEnd(9) + row.join("   "))
}
