// The four properties the founder asked for, asserted rather than commented.
//
// Every test here was mutation-checked: the line in `flow.ts` or `curve.ts`
// that implements the property was deleted or inverted, and the named
// assertion is the one that fired.

import assert from "node:assert/strict"
import { test } from "node:test"

import {
  SECOND_GRADE_FLOW,
  countAt,
  curved,
  demandFor,
  observe,
  outcomeScore,
  rungAt,
  revealMs,
  revealShown,
  secondsBetween,
  seedSuccess,
  settle,
  uncurved,
  valueAt,
  type Curve,
  type FlowSpec,
} from "./index.ts"

const CURVES: Curve[] = ["linear", "gentle", "steep", "settle"]
const S = SECOND_GRADE_FLOW

/** Drive the controller for `seconds` with a fixed answer cadence. */
function run(
  spec: FlowSpec,
  seconds: number,
  opts: { correct: boolean; everySeconds: number; from?: number; answerSeconds?: number },
) {
  let intensity = opts.from ?? spec.start
  let success = seedSuccess(spec, intensity)
  const dt = 1 / 60
  let sinceAnswer = 0
  for (let f = 0; f < seconds * 60; f++) {
    sinceAnswer += dt
    if (sinceAnswer >= opts.everySeconds) {
      sinceAnswer = 0
      success = observe(spec, success, opts.correct, opts.answerSeconds)
    }
    intensity = settle(spec, intensity, success, dt)
  }
  return { intensity, success }
}

// -- 1. asymmetric ----------------------------------------------------------

test("relief is immediate and predictable", () => {
  const down = secondsBetween(S, S.ceiling, S.floor)
  assert.equal(down, S.fallSeconds, "falling must stay linear — relief is the half that has to be predictable")
  const fell = run(S, S.fallSeconds + 5, { correct: false, everySeconds: 4, from: 1 })
  assert.ok(fell.intensity <= S.floor + 1e-9, `struggle did not reach the floor: ${fell.intensity}`)
})

test("a competent player is NOT trapped at the bottom of the ladder", () => {
  // The founder's correction, and the reason "climbs slow" was wrong: everybody
  // starts at 0 + 1, and an adult made to walk every rung quits.
  const quick = run(S, 75, { correct: true, everySeconds: 22, answerSeconds: 1.4, from: S.floor })
  assert.ok(
    quick.intensity > 0.7,
    `three fast correct answers in 75s only reached ${quick.intensity.toFixed(2)} — an adult is trapped at 0 + 1`,
  )
})

test("correct-but-slow holds roughly steady — that is where you want a child", () => {
  // Nine seconds is the curriculum's own p50 for this skill. It must neither
  // punish nor promote; it must park you mid-ladder and leave you there.
  const from = 0.5
  const slow = run(S, 420, { correct: true, everySeconds: 20, answerSeconds: 9, from })
  assert.ok(
    Math.abs(slow.intensity - from) < 0.22,
    `working steadily at the curriculum's own median speed moved the world ${from} -> ${slow.intensity.toFixed(2)}`,
  )
  // …and it is strictly between the two extremes, not at either end.
  assert.ok(slow.intensity > S.floor + 0.1 && slow.intensity < S.ceiling - 0.1)
})

test("evidence strength, not just correctness, decides how fast the climb is", () => {
  const fast = run(S, 120, { correct: true, everySeconds: 20, answerSeconds: 1, from: S.floor })
  const slow = run(S, 120, { correct: true, everySeconds: 20, answerSeconds: 11.5, from: S.floor })
  assert.ok(
    fast.intensity > slow.intensity + 0.25,
    `fast (${fast.intensity.toFixed(2)}) and slow (${slow.intensity.toFixed(2)}) correct answers climbed the same — latency is being ignored`,
  )
})

test("outcomeScore reads latency the way the curriculum does", () => {
  assert.equal(outcomeScore(S, false, 0.1), 0, "a wrong answer is worth nothing however fast it was")
  assert.equal(outcomeScore(S, false, 30), 0)
  assert.equal(outcomeScore(S, true, 0), 1)
  assert.equal(outcomeScore(S, true, S.briskSeconds), 1)
  assert.equal(outcomeScore(S, true, S.laboredSeconds), S.laboredScore)
  assert.equal(outcomeScore(S, true, 60), S.laboredScore, "slower than labored is still just labored, never worse")
  assert.equal(
    outcomeScore(S, true, undefined),
    S.laboredScore,
    "a game that cannot see the clock must get the CONSERVATIVE reading, not a free full mark",
  )
  // Monotone in speed.
  let prev = -Infinity
  for (let sec = 30; sec >= 0; sec -= 0.25) {
    const v = outcomeScore(S, true, sec)
    assert.ok(v >= prev - 1e-12, `score fell as the answer got faster, at ${sec}s`)
    prev = v
  }
  // The curriculum's p50 lands in the middle, which is the calibration claim.
  const p50 = outcomeScore(S, true, 9)
  assert.ok(p50 > 0.6 && p50 < 0.8, `the curriculum p50 of 9s scored ${p50} — it must sit mid-ladder`)
})

test("one wrong answer does not yo-yo the world", () => {
  // A child at the top who slips once must lose ground, but not the run.
  const spec = S
  let intensity = spec.ceiling
  let success = seedSuccess(spec, spec.ceiling)
  success = observe(spec, success, false, 5)
  for (let f = 0; f < 60 * 10; f++) intensity = settle(spec, intensity, success, 1 / 60)
  assert.ok(intensity < spec.ceiling, "a wrong answer must actually cost something")
  assert.ok(
    intensity > 0.5,
    `one mistake took the world from 1.00 to ${intensity.toFixed(2)} in ten seconds — that is a yo-yo, not a breath`,
  )
})

// -- 2. smoothed ------------------------------------------------------------

test("the estimate is a moving one, so no single answer flips the world", () => {
  let s = 1
  s = observe(S, s, false, 5)
  assert.ok(s > 0.5, `one wrong answer took the estimate from 1.00 to ${s} — that is a per-answer flip`)
  assert.ok(s < 1, "…but it must move")
  // It converges, from either side, and never leaves [0,1].
  let hi = 0
  for (let i = 0; i < 200; i++) hi = observe(S, hi, true, 0.5)
  assert.ok(hi > 0.99 && hi <= 1)
  let lo = 1
  for (let i = 0; i < 200; i++) lo = observe(S, lo, false, 5)
  assert.ok(lo < 0.01 && lo >= 0)
  // A larger window is genuinely smoother.
  const wide: FlowSpec = { ...S, window: 20 }
  assert.ok(observe(wide, 1, false, 5) > observe(S, 1, false, 5), "a wider window must react less, not more")
})

test("intensity moves continuously — no step in a single frame is visible", () => {
  const spec = S
  let intensity = 1
  const success = 0
  let biggest = 0
  for (let f = 0; f < 60 * 120; f++) {
    const next = settle(spec, intensity, success, 1 / 60)
    biggest = Math.max(biggest, Math.abs(next - intensity))
    intensity = next
  }
  assert.ok(
    biggest <= 1 / spec.fallSeconds / 60 + 1e-9,
    `a single frame moved intensity by ${biggest} — "smoothly" is load-bearing`,
  )
  // …and climbing, where the rate is gap-scaled and therefore larger, is still
  // far below anything a frame could show as a jump.
  let up = 0
  let x = 0
  for (let f = 0; f < 60 * 120; f++) {
    const next = settle(spec, x, 1, 1 / 60)
    up = Math.max(up, next - x)
    x = next
  }
  assert.ok(up < 0.02, `the fastest single climbing frame moved intensity by ${up}`)
})

// -- 3. silent --------------------------------------------------------------

test("the module has nothing a child could read", () => {
  // A structural assertion, not a stylistic one: the moment this module grows a
  // string it has grown an opinion about a child that could be rendered.
  const exported: unknown[] = [
    SECOND_GRADE_FLOW, observe, outcomeScore, demandFor, seedSuccess, settle, secondsBetween,
    curved, uncurved, valueAt, countAt, rungAt,
  ]
  for (const e of exported) {
    assert.notEqual(typeof e, "string", "a string escaped the pacing module")
  }
  for (const v of Object.values(SECOND_GRADE_FLOW)) {
    assert.ok(
      typeof v === "number" || CURVES.includes(v as Curve),
      `the spec carries ${JSON.stringify(v)} — the only strings allowed here are curve names`,
    )
  }
})

// -- 4. bounded -------------------------------------------------------------

test("the floor is a real destination and the ceiling is a real limit", () => {
  const spec = S
  // Sustained struggle parks at the floor and STAYS there — it does not creep
  // back up on its own, because nothing here is on a timer.
  let intensity = 1
  let success = seedSuccess(spec, 1)
  for (let f = 0; f < 60 * 600; f++) {
    if (f % 240 === 0) success = observe(spec, success, false, 5)
    intensity = settle(spec, intensity, success, 1 / 60)
    assert.ok(intensity >= spec.floor - 1e-9 && intensity <= spec.ceiling + 1e-9, `intensity left its bounds: ${intensity}`)
  }
  assert.ok(Math.abs(intensity - spec.floor) < 1e-9, `ten minutes of struggle settled at ${intensity}, not at the floor`)
})

test("a perfect run reaches the ceiling, and an even run sits in the middle", () => {
  const perfect = run(S, S.climbSeconds + 30, { correct: true, everySeconds: 5, answerSeconds: 1 })
  assert.ok(perfect.intensity > 0.99, `unbroken success only reached ${perfect.intensity}`)

  // Alternating right and wrong is a 50% success rate, which is below
  // `strugglingBelow` — that is deliberate. Half wrong is struggling.
  const spec = S
  let intensity = 0.9
  let success = seedSuccess(spec, 0.9)
  for (let f = 0; f < 60 * 400; f++) {
    if (f % 300 === 0) success = observe(spec, success, (f / 300) % 2 === 0, 2)
    intensity = settle(spec, intensity, success, 1 / 60)
  }
  assert.ok(intensity < 0.35, `a 50% success rate parked at ${intensity} — half wrong should be a calm world`)
})

test("demandFor is monotone, flat at both marks, and respects a shifted range", () => {
  let prev = -Infinity
  for (let s = 0; s <= 1.0001; s += 0.005) {
    const d = demandFor(S, s)
    assert.ok(d >= prev - 1e-12, `demand FELL as success rose, at ${s}`)
    assert.ok(d >= S.floor - 1e-12 && d <= S.ceiling + 1e-12)
    prev = d
  }
  assert.equal(demandFor(S, 0), S.floor)
  assert.equal(demandFor(S, S.strugglingBelow), S.floor)
  assert.equal(demandFor(S, S.strugglingBelow - 0.2), S.floor, "everything below the low mark wants the same easy world")
  assert.equal(demandFor(S, S.thrivingAbove), S.ceiling)
  assert.equal(demandFor(S, 1), S.ceiling)

  const shifted: FlowSpec = { ...S, floor: 0.2, ceiling: 0.8 }
  assert.equal(demandFor(shifted, 0), 0.2)
  assert.equal(demandFor(shifted, 1), 0.8)
})

test("seedSuccess round-trips, so a fresh run starts at rest", () => {
  for (const curve of CURVES) {
    const spec: FlowSpec = { ...S, curve }
    for (const i of [spec.floor, 0.08, 0.3, 0.5, 0.77, spec.ceiling]) {
      const back = demandFor(spec, seedSuccess(spec, i))
      assert.ok(Math.abs(back - i) < 1e-9, `${curve}: seed round-trip lost ${i} -> ${back}`)
    }
    // At rest means it does not move on the first frame.
    const s = seedSuccess(spec)
    assert.ok(
      Math.abs(settle(spec, spec.start, s, 1 / 60) - spec.start) < 1e-9,
      `${curve}: a fresh run lurched on frame one`,
    )
  }
})

test("degenerate specs cannot divide by zero or hand back NaN", () => {
  const flat: FlowSpec = { ...S, floor: 0.5, ceiling: 0.5 }
  assert.equal(settle(flat, 0, 1, 1 / 60), 0.5)
  assert.equal(demandFor(flat, 0.3), 0.5)

  const instant: FlowSpec = { ...S, climbSeconds: 0, fallSeconds: 0 }
  assert.equal(settle(instant, 0, 1, 1 / 60), 1)
  assert.equal(settle(instant, 1, 0, 1 / 60), 0)

  const crossed: FlowSpec = { ...S, strugglingBelow: 0.9, thrivingAbove: 0.4 }
  assert.ok(Number.isFinite(demandFor(crossed, 0.5)))

  for (const bad of [NaN, Infinity, -Infinity]) {
    assert.ok(Number.isFinite(settle(S, bad, 0.8, 1 / 60)), `settle produced a non-number from intensity ${bad}`)
    assert.ok(Number.isFinite(settle(S, 0.4, 0.8, bad)), `settle produced a non-number from dt ${bad}`)
    assert.ok(Number.isFinite(observe(S, bad, true, 1)))
    assert.ok(Number.isFinite(outcomeScore(S, true, bad)), `outcomeScore produced a non-number from ${bad}s`)
  }
  const noBand: FlowSpec = { ...S, briskSeconds: 9, laboredSeconds: 9 }
  assert.ok(Number.isFinite(outcomeScore(noBand, true, 9)))
  assert.equal(settle(S, 0.4, 0.8, 0), 0.4, "a zero-length frame must not move the world")
})

// -- the mapping seam -------------------------------------------------------

test("valueAt and countAt walk both directions and stay inside their range", () => {
  for (const curve of CURVES) {
    assert.equal(valueAt(0, 300, 520, curve), 300)
    assert.equal(valueAt(1, 300, 520, curve), 520)
    // Descending: a question's time limit, which SHRINKS as the world pushes.
    assert.equal(valueAt(0, 16, 9, curve), 16)
    assert.equal(valueAt(1, 16, 9, curve), 9)
    for (let i = -0.5; i <= 1.5; i += 0.05) {
      for (const [a, b] of [[4, 26], [26, 4], [7, 7]] as const) {
        const n = countAt(i, a, b, curve)
        assert.ok(Number.isInteger(n), `${curve}: countAt gave a non-integer ${n}`)
        assert.ok(
          n >= Math.min(a, b) && n <= Math.max(a, b),
          `${curve}: countAt gave ${n} outside [${Math.min(a, b)},${Math.max(a, b)}] — a fixed-size pool would be asked for a slot it does not own`,
        )
      }
    }
  }
})

test("curved and uncurved are inverses and fix both ends", () => {
  for (const curve of CURVES) {
    assert.equal(curved(0, curve), 0)
    assert.equal(curved(1, curve), 1)
    for (let u = 0; u <= 1.0001; u += 0.01) {
      assert.ok(Math.abs(uncurved(curved(u, curve), curve) - Math.min(1, u)) < 1e-6, `${curve} did not invert at ${u}`)
    }
    // Monotone.
    let prev = -Infinity
    for (let u = 0; u <= 1; u += 0.01) {
      const v = curved(u, curve)
      assert.ok(v >= prev - 1e-12, `${curve} is not monotone at ${u}`)
      prev = v
    }
  }
  assert.equal(curved(NaN, "linear"), 0, "a NaN intensity must read as the calmest world, not propagate")
})

test("rungAt never flickers on a band edge, and never jumps two rungs", () => {
  const rungs = 10
  // Without hysteresis it is a plain floor.
  assert.equal(rungAt(0, rungs), 0)
  assert.equal(rungAt(0.999, rungs), 9)
  assert.equal(rungAt(1, rungs), 9, "intensity 1 must not index past the ladder")
  assert.equal(rungAt(-1, rungs), 0)

  // Sitting exactly on the 0.3 boundary and jittering must not move the rung.
  let cur = 2
  for (let f = 0; f < 500; f++) {
    const jitter = 0.30 + Math.sin(f) * 0.02
    const next = rungAt(jitter, rungs, cur)
    assert.equal(next, cur, `the rung flickered ${cur} -> ${next} on a band edge at intensity ${jitter}`)
  }

  // A real move happens once intensity travels past the margin, and it is one
  // rung at a time however far intensity jumped.
  cur = rungAt(0.99, rungs, 2)
  assert.equal(cur, 3, "a jump from 0.2 to 0.99 must climb ONE rung, not eight")
  cur = rungAt(0.0, rungs, 8)
  assert.equal(cur, 7, "…and falling is one rung at a time too")

  // Walking all the way up and all the way down is monotone in each direction.
  cur = 0
  for (let i = 0; i <= 1; i += 0.005) {
    const next = rungAt(i, rungs, cur)
    assert.ok(next >= cur && next - cur <= 1, `rung went ${cur} -> ${next}`)
    cur = next
  }
  assert.equal(cur, 9)
  for (let i = 1; i >= 0; i -= 0.005) {
    const next = rungAt(i, rungs, cur)
    assert.ok(next <= cur && cur - next <= 1, `rung went ${cur} -> ${next}`)
    cur = next
  }
  assert.equal(cur, 0)

  assert.equal(rungAt(0.5, 1, 0), 0, "a one-rung ladder has exactly one answer")
  assert.equal(rungAt(0.5, 0), 0, "a zero-length ladder must not index -1")
})

test("falling and rising cross a band at DIFFERENT intensities — that is the hysteresis", () => {
  const rungs = 10
  // Rising out of rung 3 needs 0.4 + margin; falling out of rung 4 needs
  // 0.4 - margin. The gap between them is what stops the flicker.
  assert.equal(rungAt(0.401, rungs, 3), 3, "rose a rung the instant it touched the boundary")
  assert.equal(rungAt(0.45, rungs, 3), 4)
  assert.equal(rungAt(0.399, rungs, 4), 4, "fell a rung the instant it touched the boundary")
  assert.equal(rungAt(0.35, rungs, 4), 3)
})

test("the whole loop composes: struggle makes the world sparser AND the maths easier", () => {
  // This is the coupling the design is actually about, exercised end to end
  // through the same three functions a game calls.
  const spec = S
  let intensity = 1
  let success = seedSuccess(spec, 1)
  let rung = 9
  const at = () => ({
    rivals: countAt(intensity, 4, 26),
    speed: Math.round(valueAt(intensity, 300, 520)),
    rung,
  })
  const before = at()
  for (let f = 0; f < 60 * 90; f++) {
    if (f % 300 === 0) success = observe(spec, success, false, 6)
    intensity = settle(spec, intensity, success, 1 / 60)
    rung = rungAt(intensity, 10, rung)
  }
  const after = at()
  assert.ok(after.rivals < before.rivals, `the world did not get sparser: ${before.rivals} -> ${after.rivals} rivals`)
  assert.ok(after.speed < before.speed, `the world did not get slower: ${before.speed} -> ${after.speed}`)
  assert.ok(after.rung < before.rung, `the maths did not get easier: rung ${before.rung} -> ${after.rung}`)
  assert.equal(after.rung, 0, "ninety seconds of struggle must reach the bottom of the ladder")
})

// -- the reveal -------------------------------------------------------------

test("the answer reveal is patient at the bottom and skipped at the top", () => {
  assert.equal(revealMs(S, 0), S.revealCalmMs)
  assert.equal(revealMs(S, 1), S.revealFullMs)
  assert.ok(revealShown(S, 0), "a player at the floor must be shown the finished sum")
  assert.ok(!revealShown(S, 1), "…and a player at the ceiling must not be held for it")

  // Monotone: more mastery is never MORE patience.
  let prev = Infinity
  for (let i = 0; i <= 1.0001; i += 0.01) {
    const v = revealMs(S, i)
    assert.ok(v <= prev + 1e-9, `the reveal got LONGER as intensity rose, at ${i}`)
    assert.ok(v >= 0, "a negative reveal is a negative hold")
    prev = v
  }
  // Patience is spent at the bottom, not smeared across the whole range: the
  // reveal is already mostly gone by the middle of the ladder.
  assert.ok(revealMs(S, 0.15) > S.revealCalmMs * 0.6, `at 0.15 the reveal was already down to ${revealMs(S, 0.15)}ms`)
  assert.ok(revealMs(S, 0.6) < S.revealCalmMs * 0.25, `at 0.6 the reveal was still ${revealMs(S, 0.6)}ms`)
  assert.ok(Number.isFinite(revealMs(S, NaN)))
})
