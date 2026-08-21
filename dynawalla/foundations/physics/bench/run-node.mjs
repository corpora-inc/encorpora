// Node runner for the bake-off. V8 — the same engine as the Android System
// WebView and Chrome, so these numbers transfer to Android directly and to iOS
// only by analogy (iOS is JavaScriptCore; see run-browser.mjs --webkit).
//
//   node bench/run-node.mjs                       # everything
//   node bench/run-node.mjs --engine rapier       # one engine
//   node bench/run-node.mjs --scene rope-60       # one scene
//   node bench/run-node.mjs --json out.json
//   node bench/run-node.mjs --repeat 3            # determinism across runs

import { writeFileSync } from "node:fs"
import { SCENES, SCENE_ORDER, ROPE_REST } from "./scenes.mjs"
import { measure, quality } from "./harness.mjs"

const ADAPTERS = {
  rapier: () => import("./adapters/rapier.mjs"),
  box2d3: () => import("./adapters/box2d3.mjs"),
  planck: () => import("./adapters/planck.mjs"),
  matter: () => import("./adapters/matter.mjs"),
}

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : fallback
}

const onlyEngine = arg("engine")
const onlyScene = arg("scene")
const repeat = Number(arg("repeat", "1"))
const jsonOut = arg("json")
const variant = arg("variant", "auto")

const engines = onlyEngine ? [onlyEngine] : Object.keys(ADAPTERS)
const scenes = onlyScene ? [onlyScene] : SCENE_ORDER

const results = []

for (const engineId of engines) {
  const mod = await ADAPTERS[engineId]()
  let version
  const t0 = performance.now()
  try {
    version = await mod.init(engineId === "rapier" && variant !== "auto" ? variant : variant)
  } catch (err) {
    console.error(`${engineId}: init failed — ${err.message}`)
    continue
  }
  const initMs = performance.now() - t0

  for (const sceneName of scenes) {
    const scene = SCENES[sceneName]()
    const runs = []
    let buildMs = 0
    for (let r = 0; r < repeat; r++) {
      const b0 = performance.now()
      let sim
      try {
        sim = mod.build(scene, {})
      } catch (err) {
        console.error(`${engineId}/${sceneName}: build failed — ${err.message}`)
        break
      }
      buildMs = performance.now() - b0
      let m
      try {
        m = measure(sim, scene.steps)
      } catch (err) {
        console.error(`${engineId}/${sceneName}: step failed — ${err.message}`)
        sim.destroy()
        break
      }
      m.quality = quality(sceneName, scene, m.state, ROPE_REST)
      delete m.state
      runs.push(m)
      sim.destroy()
    }
    if (runs.length === 0) continue
    const stable = runs.every((r) => r.hash === runs[0].hash)
    results.push({
      engine: engineId,
      label: mod.meta.label,
      version,
      initMs,
      buildMs,
      scene: sceneName,
      bodies: scene.bodies.filter((b) => b.kind !== "static").length,
      runs: runs.length,
      selfDeterministic: stable,
      ...runs[0],
    })
    const r = runs[0]
    console.log(
      `${engineId.padEnd(8)} ${sceneName.padEnd(16)} ` +
        `p50 ${r.p50.toFixed(3)}ms  p95 ${r.p95.toFixed(3)}  p99 ${r.p99.toFixed(3)}  max ${r.max.toFixed(3)}  ` +
        `snap ${r.snapMean.toFixed(3)}  awake~${Math.round(r.awakeMean)}  ` +
        `hash ${r.hash}${stable ? "" : " UNSTABLE"}  ${JSON.stringify(r.quality)}`,
    )
  }
  console.log("")
}

if (jsonOut) {
  writeFileSync(jsonOut, JSON.stringify({ platform: "node", node: process.version, results }, null, 2))
  console.log(`wrote ${jsonOut}`)
}
