// PROBE: the balance scale is the equals sign, so it has to be right.
//
// The headline bake-off runs the OBVIOUS scale — a beam pivoted through its own
// centre of mass — and the four engines disagree wildly on where it settles
// with equal weight in both pans (Rapier +0.05 deg, Matter +1.5, Box2D v3
// -70.0, Planck +72.4). That is not four bugs. A beam pivoted at its centroid
// is NEUTRALLY stable: gravity exerts no restoring torque at any angle, so the
// resting angle is decided entirely by whichever way solver noise nudged it.
//
// This probe sweeps the one parameter that fixes it — how far above the beam's
// centre of mass the pivot sits — and measures, per engine:
//
//   settleDeg   the tilt after 900 steps with EQUAL pans (want ~0)
//   tiltDeg     the tilt with ONE extra cube on the right (want clearly < 0,
//               i.e. it must still visibly respond; an over-stabilised scale
//               that never moves is just as broken as one that flops over)
//   jitterDeg   peak-to-peak tilt over the last 120 steps (want ~0; a scale
//               that vibrates at rest reads as an unreliable equals sign)
//
//   node bench/probe-scale.mjs

import { balanceScaleScene } from "./scenes.mjs"

const ADAPTERS = {
  rapier: () => import("./adapters/rapier.mjs"),
  box2d3: () => import("./adapters/box2d3.mjs"),
  planck: () => import("./adapters/planck.mjs"),
  matter: () => import("./adapters/matter.mjs"),
}

const RAISES = [0, 0.05, 0.15, 0.3, 0.6]
const DEG = 180 / Math.PI

function run(mod, opts, steps = 900) {
  const scene = balanceScaleScene(opts)
  const sim = mod.build(scene, {})
  const tail = []
  for (let i = 0; i < steps; i++) {
    sim.step()
    if (i >= steps - 120) tail.push(sim.snapshot()[2])
  }
  sim.destroy()
  const settle = tail[tail.length - 1] * DEG
  const jitter = (Math.max(...tail) - Math.min(...tail)) * DEG
  return { settle, jitter }
}

console.log("raise = pivot height above beam centre of mass (m)")
console.log(
  "engine".padEnd(8) +
    "raise".padEnd(7) +
    "equal:settleDeg".padEnd(17) +
    "equal:jitterDeg".padEnd(17) +
    "+1 cube right:tiltDeg",
)
for (const id of Object.keys(ADAPTERS)) {
  const mod = await ADAPTERS[id]()
  await mod.init()
  for (const raise of RAISES) {
    const eq = run(mod, { pivotRaise: raise, loose: false })
    const un = run(mod, { pivotRaise: raise, extraRight: 1, loose: false })
    console.log(
      id.padEnd(8) +
        String(raise).padEnd(7) +
        eq.settle.toFixed(3).padStart(9).padEnd(17) +
        eq.jitter.toFixed(3).padStart(9).padEnd(17) +
        un.settle.toFixed(3).padStart(9),
    )
  }
  console.log("")
}
