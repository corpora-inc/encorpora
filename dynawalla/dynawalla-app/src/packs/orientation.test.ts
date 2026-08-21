// The tilt, driven as a sequence of readings.
//
// Nobody here can run this on a phone, so the split matters: everything that is
// *decidable* — the neutral pose, the wrap at ±180, the re-zero when a tablet is
// turned, the dead zone, the throttle, and what happens when a device reports
// nulls forever — is decided here, in Node, from readings. What is left for
// hardware is two things and they are named: whether `deviceorientation` fires
// at all inside a WKWebView, and whether `SCREEN_ROTATION` has the four signs
// the specification implies.

import { test } from "node:test"
import assert from "node:assert/strict"

import {
  angleDelta,
  createOrientationSource,
  createSampler,
  SAMPLER_LIMITS,
  SCREEN_ROTATION,
  shape,
} from "./orientation.ts"
import type { OrientationPorts, RawOrientation } from "./orientation.ts"
import type { Orientation } from "../../../packs/sdk/src/index.ts"
import { ORIENTATION_FULL_TILT_DEG } from "../../../packs/sdk/src/index.ts"

/** Faster than any real gap, so the throttle never hides a value in these. */
const SLOW = { ...SAMPLER_LIMITS, minIntervalMs: 0 }

const raw = (beta: number | null, gamma: number | null): RawOrientation => ({ beta, gamma })

/* ─── angles ──────────────────────────────────────────────────────────────── */

test("an angle delta takes the short way round", () => {
  assert.equal(angleDelta(0, 10), 10)
  assert.equal(angleDelta(10, 0), -10)
  // The bug this exists to stop: beta runs −180..180 and wraps, so a device held
  // near the seam that rocks two degrees would otherwise read as a 358° swing —
  // full deflection the wrong way, once per pass, and only ever in somebody's
  // hands.
  assert.equal(angleDelta(179, -179), 2)
  assert.equal(angleDelta(-179, 179), -2)
  assert.equal(angleDelta(-180, 180), 0)
})

test("the dead zone is subtracted, not clipped", () => {
  // Inside it, nothing. A hand is not still, and a game that drifts while a
  // child holds it as steadily as they can reads as broken rather than as human.
  assert.equal(shape(0), 0)
  assert.equal(shape(1.9), 0)
  assert.equal(shape(-2), 0)
  // And immediately outside it the value grows from zero rather than jumping to
  // the fraction the raw angle would have given. A clipping dead zone would step
  // from 0 to 0.08 the instant a hand moved, which reads as the control catching.
  assert.ok(shape(2.5) > 0 && shape(2.5) < 0.03, `${String(shape(2.5))} is a step, not a start`)
  assert.equal(shape(ORIENTATION_FULL_TILT_DEG), 1)
  assert.equal(shape(-ORIENTATION_FULL_TILT_DEG), -1)
  // Clamped past full deflection rather than growing: a tablet turned right over
  // must not steer four times as hard as one held at the stated angle.
  assert.equal(shape(90), 1)
  assert.equal(shape(-90), -1)
})

/* ─── the neutral pose ────────────────────────────────────────────────────── */

test("the pose the stream opened in is zero, whatever it was", () => {
  // Nobody plays with a tablet flat on a table. Held at forty degrees, an
  // absolute reading is pinned at full deflection before the game starts.
  const fold = createSampler(SLOW)
  const first = fold.push(raw(40, 0), 0, 1000)
  assert.deepEqual(first, { x: 0, y: 0, degrees: { x: 0, y: 0 } })
  // And everything after it is measured from there.
  const tilted = fold.push(raw(40 - ORIENTATION_FULL_TILT_DEG, 0), 0, 2000)
  assert.equal(tilted?.y, 1)
})

test("a sample says which way a marble on the screen would roll", () => {
  // The whole convention, as a physical statement rather than an axis name.
  const fold = createSampler(SLOW)
  fold.push(raw(0, 0), 0, 1000)

  // Positive gamma puts the right-hand edge down, so a marble rolls right.
  const right = fold.push(raw(0, ORIENTATION_FULL_TILT_DEG), 0, 2000)
  assert.equal(right?.x, 1)
  assert.equal(right?.y, 0)
  assert.equal(right?.degrees.x, ORIENTATION_FULL_TILT_DEG)

  const left = fold.push(raw(0, -ORIENTATION_FULL_TILT_DEG), 0, 3000)
  assert.equal(left?.x, -1)

  // Positive beta LIFTS the top edge, so a marble rolls toward the bottom of the
  // screen: y is the negative of beta.
  const up = fold.push(raw(-ORIENTATION_FULL_TILT_DEG, 0), 0, 4000)
  assert.equal(up?.y, 1)
  const down = fold.push(raw(ORIENTATION_FULL_TILT_DEG, 0), 0, 5000)
  assert.equal(down?.y, -1)
})

test("the wrap at the seam is two degrees, not a full swing", () => {
  const fold = createSampler(SLOW)
  fold.push(raw(179, 0), 0, 1000)
  const rocked = fold.push(raw(-179, 0), 0, 2000)
  // Two degrees of beta, inside the dead zone, so no steering at all — and
  // certainly not the −1 a naive subtraction would produce.
  assert.equal(rocked?.y, 0)
  assert.equal(rocked?.degrees.y, -2)
})

/* ─── the screen ──────────────────────────────────────────────────────────── */

test("the rotation table is four rows and each one is a quarter turn", () => {
  // Read off the Screen Orientation specification and NOT measured on hardware.
  // Locked here so that a correction from a device is a one-line change with a
  // failing test to point at.
  const at = (angle: number) => SCREEN_ROTATION[angle]?.(1, 0)
  assert.deepEqual(at(0), { x: 1, y: 0 })
  assert.deepEqual(at(90), { x: 0, y: 1 })
  assert.deepEqual(at(180), { x: -1, y: 0 })
  assert.deepEqual(at(270), { x: 0, y: -1 })
  // And every row is a rotation: length is preserved on both axes.
  for (const angle of [0, 90, 180, 270]) {
    const out = SCREEN_ROTATION[angle]?.(3, 4) ?? { x: 0, y: 0 }
    assert.equal(Math.round(Math.hypot(out.x, out.y)), 5, `angle ${String(angle)} is not a rotation`)
  }
})

test("turning the tablet remaps the axes and re-zeroes the pose", () => {
  const fold = createSampler(SLOW)
  fold.push(raw(0, 0), 0, 1000)
  const portrait = fold.push(raw(0, ORIENTATION_FULL_TILT_DEG), 0, 2000)
  assert.equal(portrait?.x, 1, "right edge down is not steering right in portrait")

  // A quarter turn. The old neutral described "flat", and after the turn that
  // same physical pose is a different pair of numbers — so keeping it would peg
  // the steering the moment a child rotated the device.
  const rezeroed = fold.push(raw(0, ORIENTATION_FULL_TILT_DEG), 90, 3000)
  assert.deepEqual(rezeroed, { x: 0, y: 0, degrees: { x: 0, y: 0 } })
  // And from the new neutral, gamma now drives the screen's y axis.
  const landscape = fold.push(raw(0, ORIENTATION_FULL_TILT_DEG * 2), 90, 4000)
  assert.equal(landscape?.x, 0)
  assert.equal(landscape?.y, 1)
})

test("an angle the platform cannot express steers as though upright", () => {
  // Better a game that steers as though the device were natural than a game that
  // stops steering because a WebView reported 45.
  const fold = createSampler(SLOW)
  fold.push(raw(0, 0), 45, 1000)
  const sample = fold.push(raw(0, ORIENTATION_FULL_TILT_DEG), 45, 2000)
  assert.equal(sample?.x, 1)
})

/* ─── absence, and silence ────────────────────────────────────────────────── */

test("a device with no sensor reports nulls, and nulls are not readings", () => {
  // The single most likely way this capability is absent. `deviceorientation`
  // fires on every desktop browser, sensor or no sensor, with nulls in it — so
  // `typeof DeviceOrientationEvent` is not a feature test and never was.
  const fold = createSampler(SLOW)
  assert.equal(fold.push(raw(null, null), 0, 1000), null)
  assert.equal(fold.push(raw(0, null), 0, 1100), null)
  assert.equal(fold.push(raw(null, 0), 0, 1200), null)
  assert.equal(fold.push(raw(Number.NaN, 0), 0, 1300), null)
  assert.equal(fold.everRead, false, "a null reading counted as a reading")
  assert.ok(fold.push(raw(0, 0), 0, 1400))
  assert.equal(fold.everRead, true)
})

test("a device held still posts nothing at all", () => {
  const fold = createSampler(SLOW)
  assert.ok(fold.push(raw(10, 10), 0, 1000), "the first reading is always worth posting")
  // A sensor's last digit never settles. Without the change gate a tablet lying
  // on a table would post thirty structured clones a second forever, each one a
  // task in the pack's event loop.
  assert.equal(fold.push(raw(10, 10), 0, 2000), null)
  assert.equal(fold.push(raw(10.001, 10.001), 0, 3000), null)
  // A real movement still gets through.
  assert.ok(fold.push(raw(10, 16), 0, 4000))
})

test("the throttle is a ceiling on messages, not on readings", () => {
  const fold = createSampler({ ...SAMPLER_LIMITS, minIntervalMs: 33 })
  assert.ok(fold.push(raw(0, 0), 0, 1000))
  // Inside the window, dropped — even though the value moved a long way. The gap
  // shows up in the stream's `seq`, which is what `seq` is for.
  assert.equal(fold.push(raw(0, 10), 0, 1010), null)
  assert.equal(fold.push(raw(0, 20), 0, 1032), null)
  // Past it, delivered, and it carries the CURRENT value rather than a queued
  // stale one.
  const sample = fold.push(raw(0, ORIENTATION_FULL_TILT_DEG), 0, 1033)
  assert.equal(sample?.x, 1)
})

/* ─── the source ──────────────────────────────────────────────────────────── */

type Rig = {
  ports: OrientationPorts
  /** Push a reading at whoever subscribed. */
  fire: (reading: RawOrientation) => void
  subscribed: () => number
  released: () => number
}

function rig(options: Partial<OrientationPorts> = {}): Rig {
  let subscribed = 0
  let released = 0
  const listeners = new Set<(reading: RawOrientation) => void>()
  const ports: OrientationPorts = {
    present: true,
    requestPermission: null,
    subscribe: (onRaw) => {
      subscribed += 1
      listeners.add(onRaw)
      return () => {
        released += 1
        listeners.delete(onRaw)
      }
    },
    screenAngle: () => 0,
    ...options,
  }
  return {
    ports,
    fire: (reading) => {
      for (const listener of [...listeners]) listener(reading)
    },
    subscribed: () => subscribed,
    released: () => released,
  }
}

const FAST = { warmupMs: 30 }

test("a build with no source says so instead of subscribing to nothing", async () => {
  const harness = rig({ present: false })
  const source = createOrientationSource(harness.ports, FAST)
  assert.equal(source.available, false)
  assert.equal(await source.start({ emit: () => {}, lost: () => {} }), null)
  assert.equal(harness.subscribed(), 0)
})

test("a declined permission is a device that cannot, not an error", async () => {
  const harness = rig({ requestPermission: async () => false })
  const source = createOrientationSource(harness.ports, FAST)
  const stop = await source.start({ emit: () => {}, lost: () => {} })
  assert.equal(stop, null)
  // And nothing was subscribed, so a refusal costs no listener and no battery.
  assert.equal(harness.subscribed(), 0)
})

test("a permission call that throws is a refusal", async () => {
  // iOS throws when there is no user activation, and any platform where the
  // static exists but does not work will throw or reject. All of it is "no".
  const harness = rig({
    requestPermission: () => Promise.reject(new Error("no user gesture")),
  })
  const source = createOrientationSource(harness.ports, FAST)
  assert.equal(await source.start({ emit: () => {}, lost: () => {} }), null)
  assert.equal(harness.subscribed(), 0)
})

test("a granted permission subscribes once and delivers samples", async () => {
  const harness = rig({ requestPermission: async () => true })
  // Unthrottled: the source clocks the throttle off `Date.now()`, and two fires
  // in one test land in the same millisecond.
  const source = createOrientationSource(harness.ports, FAST, SLOW)
  const samples: Orientation[] = []
  const stop = await source.start({ emit: (sample) => samples.push(sample), lost: () => {} })
  assert.ok(stop)
  assert.equal(harness.subscribed(), 1)
  harness.fire(raw(0, 0))
  harness.fire(raw(0, ORIENTATION_FULL_TILT_DEG))
  assert.equal(samples.length, 2)
  assert.equal(samples[0]?.x, 0)
  assert.equal(samples[1]?.x, 1)
  stop()
  assert.equal(harness.released(), 1)
  // Idempotent, and nothing arrives afterwards.
  stop()
  harness.fire(raw(0, -ORIENTATION_FULL_TILT_DEG))
  assert.equal(harness.released(), 1)
  assert.equal(samples.length, 2)
})

test("a source that never produces a reading gives up and says it is lost", async (t) => {
  // The real absence check. A desktop browser and a WebView with no sensor both
  // subscribe successfully and then fire nulls forever, so "did it subscribe" is
  // not the question — "did a number ever arrive" is.
  const harness = rig()
  const source = createOrientationSource(harness.ports, FAST)
  let lost = 0
  const stop = await source.start({ emit: () => {}, lost: () => (lost += 1) })
  assert.ok(stop)
  harness.fire(raw(null, null))
  harness.fire(raw(null, null))
  assert.equal(lost, 0, "given up before the warm-up was over")
  await new Promise((resolve) => setTimeout(resolve, 60))
  assert.equal(lost, 1)
  // And it let go of the listener rather than leaving one attached forever.
  assert.equal(harness.released(), 1)
  t.after(stop)
})

test("one usable reading settles it, and the warm-up never fires", async () => {
  const harness = rig()
  const source = createOrientationSource(harness.ports, FAST)
  let lost = 0
  const stop = await source.start({ emit: () => {}, lost: () => (lost += 1) })
  assert.ok(stop)
  harness.fire(raw(null, null))
  harness.fire(raw(12, -3))
  await new Promise((resolve) => setTimeout(resolve, 60))
  assert.equal(lost, 0, "a working sensor was called lost")
  assert.equal(harness.released(), 0)
  stop()
})

test("stopping inside the warm-up cannot end a stream afterwards", async () => {
  // This property has TWO independent guards and either one alone is enough: the
  // `clearTimeout` in `stop`, and the `stopped` check inside the warm-up
  // callback. Removing either on its own leaves this test green, which was
  // measured rather than assumed; removing BOTH fails it with
  // `actual: 1, expected: 0`. The redundancy is deliberate — one stops the timer,
  // the other stops the effect — and the test is written against the property
  // rather than against either mechanism, which is why its name no longer claims
  // "leaves no timer": that is a statement about the mechanism it cannot see.
  const harness = rig()
  const source = createOrientationSource(harness.ports, FAST)
  let lost = 0
  const stop = await source.start({ emit: () => {}, lost: () => (lost += 1) })
  assert.ok(stop)
  stop()
  await new Promise((resolve) => setTimeout(resolve, 60))
  // A child who left during the warm-up must not cause a stream to be ended
  // "unavailable" after the session it belonged to has gone.
  assert.equal(lost, 0)
  assert.equal(harness.released(), 1)
})
