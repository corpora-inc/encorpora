// Pacing is a measurable property, not a vibe.
//
// A playtest of the first build reported an average of 2.8–4.2 live objects for
// the first sixty seconds, a **minimum of zero**, and a first market rush at 82
// seconds — on a game whose own source comments say "an empty screen in the
// first ten seconds is the difference between a game and a worksheet with a
// countdown". The intent was right and the curve did not deliver it, and the
// only reason that shipped is that nothing measured it.
//
// So this file measures it. The simulation below is deliberately pessimistic:
// it models the SHORTEST flight time any supported viewport produces, so a
// number that passes here is a floor and not a best case.

import test from "node:test"
import assert from "node:assert/strict"

import { Director, type Throw } from "../sim/director.ts"
import { Rng } from "../core/rng.ts"
import { buildNumberPool, omega } from "../sim/factor.ts"

const POOL = buildNumberPool(2, 324)

function blank(): Throw {
  return { kind: "numeral", value: 0, delayMs: 0, bandT: 0, apex: 0 }
}

/**
 * Run the director against a model of the world and report live-object density
 * per second. `flight` is how long a thrown object stays cuttable — 1.8s is
 * what a 320×568 phone actually produces, the harshest case.
 */
function density(
  seconds: number,
  flight = 1.8,
  seed = 7,
): { perSecond: number[]; min: number; firstRushAt: number } {
  const d = new Director(new Rng(seed), POOL)
  const out = Array.from({ length: 24 }, blank)
  const alive: number[] = [] // remaining life of each live body
  const perSecond: number[] = []
  let min = Infinity
  let firstRushAt = Infinity
  let acc = 0
  let samples = 0
  let sum = 0

  const dt = 1 / 60
  for (let i = 0; i < seconds * 60; i++) {
    for (let k = alive.length - 1; k >= 0; k--) {
      const v = (alive[k] as number) - dt
      if (v <= 0) alive.splice(k, 1)
      else alive[k] = v
    }
    const n = d.step(dt, out, alive.length)
    for (let k = 0; k < n; k++) {
      const t = out[k] as Throw
      // A sigil is answerable, not sliceable-and-gone; it is not part of the
      // density the floor promises, so it is not counted.
      if (t.kind !== "sigil") alive.push(flight)
    }
    if (d.rushLeft > 0 && firstRushAt === Infinity) firstRushAt = d.elapsed
    // Ignore the first half second: the very first wave is still in the air.
    if (i > 30) min = Math.min(min, alive.length)
    sum += alive.length
    samples++
    acc += dt
    if (acc >= 1) {
      acc -= 1
      perSecond.push(sum / samples)
      sum = 0
      samples = 0
    }
  }
  return { perSecond, min, firstRushAt }
}

test("the field is never empty, on the harshest viewport, for five minutes", () => {
  for (const seed of [1, 7, 99, 12345]) {
    const { min } = density(300, 1.8, seed)
    assert.ok(min >= 3, `seed ${seed}: field dropped to ${min} live objects`)
  }
})

test("a child is juggling five objects by second ten, not second eighty", () => {
  const { perSecond } = density(60)
  const atTen = perSecond[9] as number
  assert.ok(atTen >= 5, `only ${atTen.toFixed(1)} objects at t=10s`)
  const firstMinute = perSecond.reduce((a, b) => a + b, 0) / perSecond.length
  assert.ok(firstMinute >= 6, `first-minute average was ${firstMinute.toFixed(1)} objects`)
})

test("the first market rush lands inside the first half minute", () => {
  for (const seed of [1, 7, 99]) {
    const { firstRushAt } = density(90, 1.8, seed)
    assert.ok(firstRushAt <= 26, `seed ${seed}: first rush at ${firstRushAt.toFixed(1)}s`)
  }
})

test("density climbs across a twenty-minute session and never collapses", () => {
  const { perSecond } = density(1200)
  const mean = (a: number[]): number => a.reduce((x, y) => x + y, 0) / a.length
  const early = mean(perSecond.slice(10, 60))
  const late = mean(perSecond.slice(1000, 1190))
  assert.ok(late > early, `late ${late.toFixed(1)} must beat early ${early.toFixed(1)}`)
  for (let i = 0; i < perSecond.length; i++) {
    assert.ok((perSecond[i] as number) >= 3, `second ${i} averaged ${perSecond[i]}`)
  }
})

test("questions arrive at least twice as often as the old build's 10.6s", () => {
  const d = new Director(new Rng(3), POOL)
  const out = Array.from({ length: 24 }, blank)
  let sigils = 0
  for (let i = 0; i < 60 * 300; i++) {
    const n = d.step(1 / 60, out, 8)
    for (let k = 0; k < n; k++) if ((out[k] as Throw).kind === "sigil") sigils++
  }
  const gap = 300 / sigils
  assert.ok(gap <= 5.2, `a sigil every ${gap.toFixed(1)}s`)
})

test("a refused sigil is retried, never dropped", () => {
  const d = new Director(new Rng(3), POOL)
  const out = Array.from({ length: 24 }, blank)
  let sigils = 0
  let refusals = 0
  for (let i = 0; i < 60 * 120; i++) {
    const n = d.step(1 / 60, out, 8)
    for (let k = 0; k < n; k++) {
      if ((out[k] as Throw).kind !== "sigil") continue
      sigils++
      // Refuse every other one, as a live question would.
      if (sigils % 2 === 0) {
        refusals++
        d.sigilRefused()
      }
    }
  }
  assert.ok(refusals > 5, "the test did not exercise refusal")
  // With half of them refused and retried within half a second, the offered
  // rate must stay far above the scheduled rate — that is the whole point.
  assert.ok(sigils >= 30, `only ${sigils} sigils offered in two minutes`)
})

test("every value the director can throw is legible: three digits, integer", () => {
  const d = new Director(new Rng(11), POOL)
  const out = Array.from({ length: 24 }, blank)
  const seen = new Set<number>()
  for (let i = 0; i < 60 * 1200; i++) {
    const n = d.step(1 / 60, out, 6)
    for (let k = 0; k < n; k++) {
      const t = out[k] as Throw
      if (t.kind !== "numeral") continue
      seen.add(t.value)
    }
  }
  assert.ok(seen.size > 60, `only ${seen.size} distinct values in twenty minutes`)
  for (const v of seen) {
    assert.ok(Number.isInteger(v), `${v} is not an integer`)
    assert.ok(v >= 2 && v <= 999, `${v} is out of the legible band`)
    assert.ok(String(v).length <= 3, `${v} is four digits`)
  }
})

test("the cascade gets deeper over a long run", () => {
  const d = new Director(new Rng(11), POOL)
  const out = Array.from({ length: 24 }, blank)
  let earlyMax = 0
  let lateMax = 0
  for (let i = 0; i < 60 * 900; i++) {
    const n = d.step(1 / 60, out, 6)
    for (let k = 0; k < n; k++) {
      const t = out[k] as Throw
      if (t.kind !== "numeral") continue
      const w = omega(t.value)
      if (d.elapsed < 30) earlyMax = Math.max(earlyMax, w)
      else if (d.elapsed > 600) lateMax = Math.max(lateMax, w)
    }
  }
  assert.ok(lateMax > earlyMax, `late omega ${lateMax} must beat early ${earlyMax}`)
})

test("a rush is always a reward: no bombs, ever", () => {
  const d = new Director(new Rng(4), POOL)
  const out = Array.from({ length: 24 }, blank)
  let rushFrames = 0
  for (let i = 0; i < 60 * 600; i++) {
    const n = d.step(1 / 60, out, 6)
    const inRush = d.rushLeft > 0
    if (inRush) rushFrames++
    for (let k = 0; k < n; k++) {
      if (inRush) assert.notEqual((out[k] as Throw).kind, "bomb", "a bomb during a rush")
    }
  }
  assert.ok(rushFrames > 60 * 40, "the test did not see enough rush")
})

test("rushes get longer and closer together, forever", () => {
  const d = new Director(new Rng(4), POOL)
  const out = Array.from({ length: 24 }, blank)
  const lengths: number[] = []
  let cur = 0
  for (let i = 0; i < 60 * 1200; i++) {
    d.step(1 / 60, out, 6)
    if (d.rushLeft > 0) cur += 1 / 60
    else if (cur > 0) {
      lengths.push(cur)
      cur = 0
    }
  }
  assert.ok(lengths.length >= 8, `only ${lengths.length} rushes in twenty minutes`)
  assert.ok(
    (lengths.at(-1) as number) > (lengths[0] as number) + 1,
    `last rush ${lengths.at(-1)}s vs first ${lengths[0]}s`,
  )
})
