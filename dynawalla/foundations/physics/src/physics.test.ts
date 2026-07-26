// Gates for the physics kit.
//
// These are not "does Rapier work" tests. Each one pins a claim the README
// makes or a trap the bake-off found, so that a future change which quietly
// undoes it fails here instead of on a child's tablet.

import { test } from "node:test"
import assert from "node:assert/strict"

import { createWorld, FIXED_DT } from "./index.ts"
import { makeRng } from "./rng.ts"
import { guessTier, autoTune, TIERS } from "./tiers.ts"
import { defineCommand, replay, verify } from "./replay.ts"

const DEG = 180 / Math.PI

test("rng: same seed, same stream; different seeds, different streams", () => {
  const a = makeRng(42)
  const b = makeRng(42)
  const c = makeRng(43)
  const sa = Array.from({ length: 64 }, () => a())
  const sb = Array.from({ length: 64 }, () => b())
  const sc = Array.from({ length: 64 }, () => c())
  assert.deepEqual(sa, sb)
  assert.notDeepEqual(sa, sc)
  // Adjacent seeds must not be correlated — the classic bad-seeding failure.
  const corr = sa.reduce((acc, v, i) => acc + Math.abs(v - sc[i]!), 0) / 64
  assert.ok(corr > 0.2, `adjacent seeds look correlated (mean |diff| ${corr})`)
  assert.ok(sa.every((v) => v >= 0 && v < 1))
})

test("tiers: mid is the floor, and autoTune drops fast and climbs slowly", () => {
  assert.equal(guessTier({ deviceMemoryGb: 4 }), "mid")
  assert.equal(guessTier({ deviceMemoryGb: 2 }), "low")
  // iOS never reports deviceMemory. It must not fall through to "low".
  assert.equal(guessTier({ hardwareConcurrency: 8 }), "ultra")
  assert.equal(guessTier({ hardwareConcurrency: 4 }), "mid")
  // Over budget -> down one. Far under -> up one. In between -> hold.
  assert.equal(autoTune("high", 9, 4), "mid")
  assert.equal(autoTune("mid", 0.5, 4), "high")
  assert.equal(autoTune("mid", 3, 4), "mid")
  assert.equal(autoTune("low", 99, 4), "low")
  assert.equal(autoTune("ultra", 0.001, 4), "ultra")
})

test("THE EQUALS SIGN: equal pans settle level, and stay level", async () => {
  const w = await createWorld({ seed: 1, tier: "mid" })
  w.ground()
  const scale = w.balanceScale({ at: [0, 0] })
  scale.put("left", 4)
  scale.put("right", 4)
  w.stepExact(900)
  const tiltDeg = Math.abs(scale.tilt() * DEG)
  assert.ok(tiltDeg < 1.5, `equal pans must read level; got ${tiltDeg.toFixed(3)} deg`)
  assert.equal(scale.compare(), 0)
  assert.ok(scale.settled(), "an equal scale must come to rest")
  w.dispose()
})

test("THE EQUALS SIGN: an imbalance tips the right way, visibly", async () => {
  const w = await createWorld({ seed: 1, tier: "mid" })
  w.ground()
  const scale = w.balanceScale({ at: [0, 0] })
  scale.put("left", 4)
  scale.put("right", 5)
  w.stepExact(900)
  // Negative tilt = the right-hand pan went down.
  const tiltDeg = scale.tilt() * DEG
  assert.ok(tiltDeg < -4, `heavier right pan must visibly drop; got ${tiltDeg.toFixed(2)} deg`)
  assert.equal(scale.compare(), 1)
  w.dispose()
})

test("THE EQUALS SIGN: compare() is arithmetic, not the solver", async () => {
  const w = await createWorld({ seed: 1, tier: "mid" })
  w.ground()
  const scale = w.balanceScale({ at: [0, 0] })
  scale.put("left", 3)
  scale.put("right", 3)
  // Before a single step has run — no physics has happened at all — the
  // comparison is already correct. That is the whole point.
  assert.equal(scale.compare(), 0)
  scale.put("right", 1)
  assert.equal(scale.compare(), 1)
  assert.equal(scale.left, 3)
  assert.equal(scale.right, 4)
  // And knocking the beam about must not change the answer.
  scale.beam.rb.setRotation(0.6, true)
  w.stepExact(30)
  assert.equal(scale.compare(), 1)
  w.dispose()
})

test("articulated assemblies do not collide with themselves", async () => {
  // The Rapier trap. Without assembly collision groups this pendulum is frozen
  // at 0.0 deg; with them it swings. Measured in bench/, gated here.
  const w = await createWorld({ seed: 1, tier: "mid" })
  const asm = w.newAssembly()
  const anchor = w.add("static", { box: [0.1, 0.1] }, [0, 10], { assembly: asm })
  const arm = w.add("dynamic", { box: [1, 0.05] }, [1, 10], { assembly: asm, density: 5 })
  w.pin(anchor, arm, [0, 0], [-1, 0])
  w.stepExact(300)
  assert.ok(
    Math.abs(arm.angle()) > 0.2,
    `pendulum did not swing (${(arm.angle() * DEG).toFixed(2)} deg) — assembly groups regressed`,
  )
  w.dispose()
})

test("a joint limit set on JointData is ignored — pin() must apply it to the joint", async () => {
  // The trap, gated. Rapier accepts `JointData.limitsEnabled` / `.limits` for a
  // revolute joint, type-checks them, and silently ignores them; measured, an
  // arm with a +/-22 deg stop set that way swings to -174 deg. Only
  // `joint.setLimits()` on the created joint works.
  const w = await createWorld({ seed: 1, tier: "mid" })
  const asm = w.newAssembly()
  const post = w.add("static", { box: [0.1, 0.1] }, [0, 5], { assembly: asm })
  const arm = w.add("dynamic", { box: [1, 0.1] }, [1, 5], { assembly: asm, density: 5 })
  const stop = (22 * Math.PI) / 180
  w.pin(post, arm, [0, 0], [-1, 0], [-stop, stop])
  w.stepExact(400)
  const deg = arm.angle() * DEG
  assert.ok(Math.abs(deg) <= 22.5, `joint limit not applied: arm reached ${deg.toFixed(2)} deg`)
  assert.ok(Math.abs(deg) > 20, `arm should be resting ON the stop, not at ${deg.toFixed(2)} deg`)
  w.dispose()
})

test("aim: the predicted arc IS the flight path, bounces included", async () => {
  const w = await createWorld({ seed: 1, tier: "high" })
  w.ground(30)
  w.add("static", { box: [2, 0.2] }, [9, 1], { restitution: 0.35 })
  const gun = w.launcher({ at: [-8, 4] })
  const aim = { angle: 0.55, speed: 13 }
  const predicted = gun.predict(aim, 150)

  const shot = gun.fire(aim)
  let worst = 0
  for (let i = 0; i < predicted.steps; i++) {
    w.stepExact(1)
    const p = shot.position()
    worst = Math.max(worst, Math.hypot(p[0] - predicted.path[i * 2]!, p[1] - predicted.path[i * 2 + 1]!))
  }
  // Sub-millimetre over 150 steps and at least one bounce.
  assert.ok(worst < 0.001, `prediction diverged by ${(worst * 1000).toFixed(4)} mm`)
  gun.dispose()
  w.dispose()
})

test("aim assist stays inside its window and reports its own miss", async () => {
  const w = await createWorld({ seed: 1, tier: "mid" })
  w.ground(30)
  const gun = w.launcher({ at: [-8, 2] })
  const target: [number, number] = [6, 0.4]
  const from = Math.atan2(target[1] - 2, target[0] + 8)
  const a = gun.assist(target, { from, window: 0.3, speed: 13, toleranceM: 3 })
  assert.ok(a, "assist should find a shot at a reachable target")
  assert.ok(Math.abs(a!.angle - from) <= 0.3 + 1e-9, "assist must stay inside its window")
  assert.ok(a!.missM <= 3)
  // An unreachable target must return null rather than a wild guess.
  assert.equal(gun.assist([500, 400], { window: 0.3, speed: 13, toleranceM: 1 }), null)
  gun.dispose()
  w.dispose()
})

test("chain holds its length under a realistic load", async () => {
  const w = await createWorld({ seed: 1, tier: "mid" })
  const c = w.chain({ from: [-4, 10], links: 24, load: 100 })
  w.stepExact(600)
  const s = Math.abs(c.stretchPct())
  assert.ok(s < 12, `chain stretched ${s.toFixed(1)}% — should read as a chain, not elastic`)
  w.dispose()
})

test("gear train meshes exactly and reverses each stage", async () => {
  const w = await createWorld({ seed: 1, tier: "mid" })
  const t = w.gearTrain({ at: [0, 4], teeth: [12, 24, 8], driveSpeed: 2 })
  for (let i = 0; i < 60; i++) t.update(FIXED_DT)
  const a0 = t.angleOf(0)
  const a1 = t.angleOf(1)
  const a2 = t.angleOf(2)
  // Meshed gears counter-rotate, and arc length at the pitch circle is shared:
  // theta1 / theta0 == -teeth0 / teeth1, exactly.
  assert.ok(Math.abs(a1 / a0 - -12 / 24) < 1e-12, "stage 1 ratio is not exact")
  assert.ok(Math.abs(a2 / a0 - 12 / 8) < 1e-12, "stage 2 ratio is not exact")
  assert.ok(a0 * a1 < 0, "meshed gears must counter-rotate")
  assert.ok(a1 * a2 < 0, "meshed gears must counter-rotate")
  w.dispose()
})

test("dominoes propagate", async () => {
  const w = await createWorld({ seed: 1, tier: "mid" })
  w.ground(40)
  const run = w.dominoes({ from: [-6, 0], to: [6, 0], count: 30 })
  w.stepExact(900)
  const { fallenFraction } = await import("./recipes/piles.ts")
  assert.ok(fallenFraction(run) > 0.8, `only ${(fallenFraction(run) * 100) | 0}% of the run fell`)
  w.dispose()
})

test("soft blob squashes and recovers rather than inverting", async () => {
  const w = await createWorld({ seed: 1, tier: "high" })
  w.ground(20)
  const blob = w.softBlob({ at: [0, 6], radius: 0.8, firmness: 0.6 })
  w.stepExact(30)
  const airborne = blob.roundness()
  w.stepExact(60) // impact
  w.stepExact(240) // settle
  const settled = blob.roundness()
  assert.ok(airborne > 0.75, `blob deformed in free fall (${airborne.toFixed(2)})`)
  assert.ok(settled > 0.45, `blob collapsed or inverted on landing (${settled.toFixed(2)})`)
  w.dispose()
})

test("liquid is capped by the tier, not by the caller's optimism", async () => {
  const w = await createWorld({ seed: 1, tier: "low" })
  w.ground(10)
  const drops = w.liquid({ at: [0, 8], count: 5000 })
  assert.equal(drops.length, TIERS.low.particles)
  w.dispose()
})

test("advance() clamps a backgrounded tab instead of freezing on catch-up", async () => {
  const w = await createWorld({ seed: 1, tier: "mid" })
  w.ground()
  w.stack({ at: [0, 0], rows: 4 })
  // 12 seconds of missed time, as if the app had been backgrounded.
  const steps = w.advance(12)
  assert.ok(steps <= TIERS.mid.maxCatchUpSteps, `ran ${steps} steps for one frame`)
  w.dispose()
})

test("replay: a command tape reproduces the run bit for bit", async () => {
  defineCommand("drop", (world, [x, y]) => {
    world.add("dynamic", { box: [0.2, 0.2] }, [x as number, y as number], { density: 1 })
  })

  const build = async () => {
    const w = await createWorld({ seed: 99, tier: "mid" })
    w.ground()
    w.stack({ at: [0, 0], rows: 3 })
    return w
  }

  const a = await build()
  const rec = a.record()
  for (let i = 0; i < 120; i++) {
    if (i === 10) rec.do("drop", -1.5, 6)
    if (i === 40) rec.do("drop", 0.7, 7)
    if (i === 80) rec.do("drop", 1.9, 8)
    a.stepExact(1)
  }
  const tape = rec.stop()

  const b = await build()
  replay(b, tape)

  assert.equal(b.hash(), a.hash(), "replay diverged from the recorded run")
  assert.ok(verify(b, tape))
  assert.equal(tape.commands.length, 3)
  // The tape stores commands, not positions.
  assert.ok(JSON.stringify(tape).length < 800, "a tape should be tiny")
  a.dispose()
  b.dispose()
})

test("the same seed and the same steps give the same world twice", async () => {
  const run = async () => {
    const w = await createWorld({ seed: 2026, tier: "mid" })
    w.ground(12)
    w.stack({ at: [0, 0], rows: 6 })
    w.liquid({ at: [0, 9], count: 60 })
    w.stepExact(400)
    const h = w.hash()
    w.dispose()
    return h
  }
  assert.equal(await run(), await run())
})
