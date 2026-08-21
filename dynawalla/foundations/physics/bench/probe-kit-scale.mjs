// PROBE: tune the SHIPPING balance-scale recipe, not an idealised test rig.
//
// bench/probe-scale.mjs compared four engines on a scale carrying one contained
// slab per pan. The kit's real scale carries LOOSE CUBES that are dropped in,
// bounce, and slide — and that transient turned out to knock the beam onto its
// mechanical stop and leave it there, so an equality read as a 12 deg tilt.
//
// This sweeps the two dials that fix it against the real recipe:
//   pivotRaise    restoring torque (and therefore how fast level wins)
//   beamDamping   angular damping on the beam, which kills the drop transient
//
// Pass criteria, in the product's terms:
//   equal    |tilt| <= 1.0 deg      a child must read 4 = 4 as level
//   unequal  tilt   <= -6.0 deg     and 4 < 5 as unmistakably tipped
//
//   node bench/probe-kit-scale.mjs

import { createWorld } from "../src/index.ts"

const DEG = 180 / Math.PI

async function run({ pivotRaise, beamDamping, extraRight }) {
  const w = await createWorld({ seed: 5, tier: "mid" })
  w.ground(24)
  const scale = w.balanceScale({ at: [0, 0], pivotRaise })
  if (beamDamping) scale.beam.rb.setAngularDamping(beamDamping)
  scale.put("left", 4)
  scale.put("right", 4 + extraRight)
  w.stepExact(900)
  const settle = scale.tilt() * DEG
  // Peak-to-peak over the last 2 s: a scale that is still hunting has not
  // settled, however good its final frame happens to look.
  let lo = Infinity
  let hi = -Infinity
  for (let i = 0; i < 120; i++) {
    w.stepExact(1)
    const t = scale.tilt() * DEG
    if (t < lo) lo = t
    if (t > hi) hi = t
  }
  w.dispose()
  return { settle, jitter: hi - lo }
}

console.log("recipe sweep — loose cubes, dropped in, as the demo really does it")
console.log(
  "raise".padEnd(8) + "damping".padEnd(9) + "4v4 tilt".padEnd(11) + "4v4 jitter".padEnd(12) + "4v5 tilt".padEnd(11) + "verdict",
)

const rows = []
for (const pivotRaise of [0.15, 0.3, 0.5, 0.8]) {
  for (const beamDamping of [0, 0.5, 2, 6]) {
    const eq = await run({ pivotRaise, beamDamping, extraRight: 0 })
    const un = await run({ pivotRaise, beamDamping, extraRight: 1 })
    const ok = Math.abs(eq.settle) <= 1.0 && un.settle <= -6.0
    rows.push({ pivotRaise, beamDamping, eq, un, ok })
    console.log(
      String(pivotRaise).padEnd(8) +
        String(beamDamping).padEnd(9) +
        eq.settle.toFixed(2).padStart(7).padEnd(11) +
        eq.jitter.toFixed(3).padStart(8).padEnd(12) +
        un.settle.toFixed(2).padStart(7).padEnd(11) +
        (ok ? "PASS" : ""),
    )
  }
}

const passing = rows.filter((r) => r.ok)
console.log(`\n${passing.length} of ${rows.length} combinations meet both criteria.`)
if (passing.length) {
  // Prefer the most legible tip among the passing set: equal must be level,
  // but unequal should be as dramatic as the stop allows.
  const best = passing.reduce((a, b) => (b.un.settle < a.un.settle ? b : a))
  console.log(
    `recommended: pivotRaise ${best.pivotRaise}, beamDamping ${best.beamDamping} ` +
      `(4v4 ${best.eq.settle.toFixed(2)} deg, 4v5 ${best.un.settle.toFixed(2)} deg)`,
  )
}
