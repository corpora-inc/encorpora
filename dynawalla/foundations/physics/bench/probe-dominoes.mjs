// PROBE: does the chain reaction survive the friction the art direction wants?
//
// "Dominoes and chain reactions" is on the required list, and friction is the
// one parameter that decides whether a run propagates. A game will want it
// high — high friction is what makes blocks feel heavy and stay where they are
// put — so an engine that only propagates when everything is slippery is not
// usable.
//
// Reported as dominoes fallen (|angle| > 0.7 rad) out of 300 after 15 s.
//
//   node bench/probe-dominoes.mjs

import { SCENES } from "./scenes.mjs"

const ADAPTERS = {
  rapier: () => import("./adapters/rapier.mjs"),
  box2d3: () => import("./adapters/box2d3.mjs"),
  planck: () => import("./adapters/planck.mjs"),
  matter: () => import("./adapters/matter.mjs"),
}

const FRICTIONS = [0.1, 0.2, 0.3, 0.45, 0.7]

console.log("dominoes fallen out of 300 after 900 steps, by friction")
console.log("engine".padEnd(9) + FRICTIONS.map((f) => String(f).padStart(8)).join(""))

for (const id of Object.keys(ADAPTERS)) {
  const mod = await ADAPTERS[id]()
  await mod.init()
  const row = FRICTIONS.map((f) => {
    const scene = SCENES["dominoes-300"]()
    for (const b of scene.bodies) if (b.kind !== "static") b.friction = f
    const sim = mod.build(scene, {})
    for (let i = 0; i < scene.steps; i++) sim.step()
    const s = sim.snapshot()
    let fallen = 0
    for (let k = 0; k < s.length / 3; k++) if (Math.abs(s[k * 3 + 2]) > 0.7) fallen++
    sim.destroy()
    return String(fallen).padStart(8)
  })
  console.log(id.padEnd(9) + row.join(""))
}
