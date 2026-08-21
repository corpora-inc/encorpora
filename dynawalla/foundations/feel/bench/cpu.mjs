// What the kit costs, measured.
//
//   node --expose-gc --experimental-strip-types bench/cpu.mjs
//
// Two things are measured, and the second matters more than the first.
//
//   TIME    per-frame CPU of the whole feel layer with everything running.
//   MEMORY  bytes allocated per frame and per reaction. A juice layer that
//           allocates is a juice layer that stutters *when you use it*, because
//           the minor GC lands right after the allocation, which is right after
//           the child tapped. On a mid-range Android WebView a minor GC is
//           2–6 ms — a dropped frame, at the worst possible moment.
//
// This is a developer-machine number. The derate factor for the reference
// mid-range tablet is applied in the report and stated in README.md; it is an
// estimate, not a measurement, and the only honest way to close it is to run
// bench/frames.mjs on the device.

import { FeelClock } from "../src/clock.ts"
import { Tweens, CH_WORLD, CH_UI, CH_REAL } from "../src/tween.ts"
import { CameraRig } from "../src/camera.ts"
import { Squash } from "../src/squash.ts"
import { Shake, noise1 } from "../src/shake.ts"
import { Spring1D } from "../src/spring.ts"
import { EASE } from "../src/ease.ts"
import { TIERS } from "../src/tiers.ts"

const gc = globalThis.gc
if (!gc) {
  console.error("run with --expose-gc for the memory numbers")
}

const fmt = (n, d = 3) => n.toFixed(d).padStart(9)

function timeIt(label, iterations, fn, unit = "op") {
  fn() // warm
  fn()
  gc?.()
  const t0 = process.hrtime.bigint()
  for (let i = 0; i < iterations; i++) fn()
  const t1 = process.hrtime.bigint()
  const ns = Number(t1 - t0) / iterations
  console.log(`  ${label.padEnd(46)} ${fmt(ns, 1)} ns/${unit}`)
  return ns
}

function allocIt(label, iterations, fn) {
  for (let i = 0; i < 200; i++) fn() // warm + let hidden classes settle
  gc?.()
  gc?.()
  const before = process.memoryUsage().heapUsed
  for (let i = 0; i < iterations; i++) fn()
  const after = process.memoryUsage().heapUsed
  const bytes = (after - before) / iterations
  console.log(`  ${label.padEnd(46)} ${fmt(bytes, 2)} bytes/op`)
  return bytes
}

console.log("\n=== easing curves (allocation-free, pure) ===")
{
  let acc = 0
  let i = 0
  timeIt("ease.outCubic", 5e6, () => {
    acc += EASE.outCubic((i++ % 100) / 100)
  })
  i = 0
  timeIt("ease.outBack", 5e6, () => {
    acc += EASE.outBack((i++ % 100) / 100)
  })
  i = 0
  timeIt("ease.outElastic (2 transcendentals)", 5e6, () => {
    acc += EASE.outElastic((i++ % 100) / 100)
  })
  if (acc === Infinity) console.log("unreachable")
}

console.log("\n=== noise vs Math.random ===")
{
  let acc = 0
  let i = 0
  timeIt("noise1 (coherent, what shake uses)", 5e6, () => {
    acc += noise1(i++ * 0.01, 7)
  })
  timeIt("Math.random (incoherent, the wrong one)", 5e6, () => {
    acc += Math.random()
  })
  if (acc === Infinity) console.log("unreachable")
}

console.log("\n=== spring step (exact exponential integrator) ===")
{
  const crit = new Spring1D(12, 1)
  const under = new Spring1D(12, 0.45)
  crit.impulse(1)
  under.impulse(1)
  timeIt("Spring1D.update critically damped", 5e6, () => {
    crit.impulse(1e-9)
    crit.update(16.67)
  })
  timeIt("Spring1D.update under-damped", 5e6, () => {
    under.impulse(1e-9)
    under.update(16.67)
  })
}

console.log("\n=== tween pool ===")
{
  const tw = new Tweens(512)
  const o = { v: 0 }
  timeIt("Tweens.to2 start + immediate settle", 2e6, () => {
    tw.to2(o, "v", 0, 1, 200, "outBack")
    tw.settle()
  })
  allocIt("Tweens.to2 start (the GC question)", 2e5, () => {
    tw.to2(o, "v", 0, 1, 200, "outBack")
    tw.settle()
  })

  // A realistic mid-flourish load: 64 live tweens being stepped.
  const tw2 = new Tweens(512)
  const objs = Array.from({ length: 64 }, () => ({ v: 0 }))
  for (const ob of objs) tw2.to2(ob, "v", 0, 1, 1e9, "outCubic")
  timeIt("Tweens.update with 64 live tweens", 2e5, () => {
    tw2.update(CH_WORLD, 16.67)
  })

}

console.log("\n=== a whole frame of the feel layer ===")
{
  const clock = new FeelClock({ now: () => 0, raf: () => 0, cancelRaf: () => {} })
  const tweens = new Tweens(320)
  const rig = new CameraRig({ baseFov: 50 })
  const squash = new Squash()
  const camera = {
    position: { x: 0, y: 0, z: 0 },
    rotation: { z: 0 },
    fov: 50,
    lookAt() {},
    updateProjectionMatrix() {},
  }
  const subject = { scale: { x: 1, y: 1, z: 1 } }

  // Load it up the way a `bloom` does: shake, kick, fov punch, squash, and a
  // realistic 24 concurrent tweens.
  const load = () => {
    rig.impact(0.62, 0.2, 0, -1, 0)
    rig.punchFov(-4)
    squash.punch(0.55)
    for (let i = 0; i < 24; i++) tweens.to2(subject.scale, "x", 1, 1.2, 600, "outElastic")
  }
  load()

  clock.onTick((t) => {
    tweens.update(CH_WORLD, t.dtWorld)
    tweens.update(CH_UI, t.dtUi)
    tweens.update(CH_REAL, t.dtReal)
    rig.update(t.dtReal)
    squash.update(t.dtReal)
    squash.applyTo(subject)
    rig.applyTo(camera)
  })

  let n = 0
  const ns = timeIt(
    "full frame: clock + 24 tweens + rig + squash",
    5e5,
    () => {
      if (++n % 200 === 0) load()
      clock.step(16.67)
    },
    "frame",
  )
  console.log(`  ${"".padEnd(46)} ${fmt(ns / 1e6, 5)} ms/frame`)
  console.log(
    `  ${"as % of a 16.67 ms frame budget".padEnd(46)} ${fmt((ns / 1e6 / 16.67) * 100, 3)} %`,
  )
  console.log(
    `  ${"same, derated 8x for a mid-range tablet".padEnd(46)} ${fmt((ns / 1e6 / 16.67) * 800, 3)} %`,
  )

  n = 0
  allocIt("full frame allocation", 3e5, () => {
    if (++n % 200 === 0) load()
    clock.step(16.67)
  })
}

console.log("\n=== interrupt(): the fast-child path ===")
{
  const tweens = new Tweens(512)
  const rig = new CameraRig()
  const squash = new Squash()
  const clock = new FeelClock({ now: () => 0, raf: () => 0, cancelRaf: () => {} })
  const o = { v: 0 }

  const fill = () => {
    for (let i = 0; i < 512; i++) tweens.to2(o, "v", 0, 1, 5000, "outElastic")
    rig.impact(0.85, 0.3, 0, -1, 0)
    squash.punch(0.75)
    clock.hitstop(160)
    clock.slowmo(0.32, 420)
  }

  const ns = timeIt(
    "interrupt with a FULL 512-tween pool",
    2e5,
    () => {
      fill()
      clock.settleNow()
      tweens.settle()
      rig.settle()
      squash.settle()
    },
    "interrupt",
  )
  console.log(`  ${"".padEnd(46)} ${fmt(ns / 1e6, 5)} ms (incl. refilling the pool)`)
  console.log(`  ${"derated 8x".padEnd(46)} ${fmt((ns / 1e6) * 8, 5)} ms — budget is 1.00 ms`)
}

console.log("\n=== tier table sanity (energy ladder, measured) ===")
{
  const { energy } = await import("../src/tiers.ts")
  for (const name of ["nudge", "tick", "snap", "pop", "slam", "bloom", "ascend"]) {
    const t = TIERS[name]
    console.log(
      `  ${name.padEnd(8)} tail ${String(t.tailMs).padStart(5)}ms  block ${String(t.blockingMs).padStart(4)}ms` +
        `  hitstop ${String(t.hitstopMs).padStart(4)}ms  energy ${fmt(energy(t), 0)}`,
    )
  }
}

console.log("")
