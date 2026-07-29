// **The invariant, and the defect it replaces.**
//
// The press window used to be `timingForBout(bout)`: 13.0 s at the first Turk,
// 1.1 s less at every one after, down to a 7.6 s floor. The bout counter is also
// what escalates the arithmetic, so the child got less time exactly as the sums
// got harder. Every case here is written so that putting a bout number, an
// elapsed time or a speed back into the window fails it.

import assert from "node:assert/strict"
import { test } from "node:test"

import {
  comprehensionSeconds,
  MAX_PRESS_SECONDS,
  MIN_PRESS_SECONDS,
  motorSeconds,
  needsRegrouping,
  pressMsFor,
  STRIKE_SECONDS,
  STRIKES_PER_COLUMN,
  SUSTAINABLE_STRIKE_SECONDS,
  widestColumn,
} from "../game/window.ts"
import { planStrikes, strikesFor } from "../game/places.ts"
import { BASE_STRAIN, BLEED_PER_SEC, impulseFor, Strain } from "../game/strain.ts"
import { Rng } from "../core/rng.ts"
import { createStubHost } from "../stubHost.ts"

/** Every column operation the seven live curriculum rows can produce. */
function ladderItems(): Array<{ prompt: string; answer: number; level: number }> {
  const out: Array<{ prompt: string; answer: number; level: number }> = []
  for (let level = 0; level < 8; level++) {
    const host = createStubHost({ seed: 0x51ee, level, reducedMotion: true })
    for (let i = 0; i < 300; i++) {
      const q = host.next({ domain: "add" })
      out.push({ prompt: q.prompt, answer: Number(q.answer), level })
    }
  }
  return out
}

test("the window is monotone non-decreasing in the item's width", () => {
  // Half of the invariant, stated as directly as it can be: no wider sum ever
  // gets less time than a narrower one, anywhere in the reachable range.
  const rng = new Rng(0x7c31)
  const byWidth = new Map<number, { min: number; max: number }>()
  for (let i = 0; i < 6000; i++) {
    const a = rng.int(1, 9999)
    const b = rng.int(1, 9999)
    const item = { prompt: `${a} + ${b}`, answer: a + b }
    const ms = pressMsFor(item)
    const w = widestColumn(item)
    const seen = byWidth.get(w) ?? { min: Infinity, max: -Infinity }
    byWidth.set(w, { min: Math.min(seen.min, ms), max: Math.max(seen.max, ms) })
  }
  const widths = [...byWidth.keys()].sort((x, y) => x - y)
  assert.ok(widths.length >= 4, "the sample never reached four columns")
  for (let i = 1; i < widths.length; i++) {
    const lower = byWidth.get(widths[i - 1] as number)
    const upper = byWidth.get(widths[i] as number)
    assert.ok(lower && upper)
    assert.ok(
      upper.min >= lower.max,
      `${widths[i]} columns can get ${upper.min} ms where ${widths[i - 1]} columns gets ${lower.max} ms`,
    )
  }
})

test("regrouping is never worth less time than not regrouping", () => {
  // The other half. Same width, harder procedure, never a shorter window.
  const rng = new Rng(0x2288)
  let plain = 0
  let carried = 0
  for (let i = 0; i < 4000; i++) {
    const a = rng.int(10, 99)
    const b = rng.int(10, 99)
    if (a + b >= 100) continue
    const item = { prompt: `${a} + ${b}`, answer: a + b }
    if (needsRegrouping(item.prompt)) carried = Math.max(carried, pressMsFor(item))
    else plain = Math.max(plain, pressMsFor(item))
  }
  assert.ok(plain > 0 && carried > 0, "the sample missed one of the two cases")
  assert.ok(carried >= plain, `a regrouping sum got ${carried} ms against ${plain} ms without`)
})

test("the window is a pure function of the item and of nothing else", () => {
  // The structural claim. `pressMsFor` takes one argument; call it a thousand
  // times, out of order, interleaved with other items, and it cannot drift —
  // which is exactly what a bout counter, a run clock or a tempo would do.
  const items = ladderItems()
  const first = new Map<string, number>()
  for (const item of items) {
    const key = `${item.prompt}=${item.answer}`
    const ms = pressMsFor(item)
    const seen = first.get(key)
    if (seen === undefined) first.set(key, ms)
    else assert.equal(ms, seen, `${key} answered ${ms} ms after answering ${seen} ms`)
  }
  // And again, in reverse, after everything else has been through it.
  for (const item of [...items].reverse()) {
    assert.equal(pressMsFor(item), first.get(`${item.prompt}=${item.answer}`))
  }
})

test("every item the curriculum can serve fits its window with the arithmetic still to do", () => {
  // **The measured claim, and the one the pacing audit says the old window
  // failed.** For every item on every live rung: the plates the answer needs,
  // struck at a cadence the steel survives, must leave the child most of the
  // window to think in.
  const items = ladderItems()
  let worst = { prompt: "", left: Infinity, level: -1 }
  for (const item of items) {
    // The pan starts a handful of strikes off in either direction; take the
    // expensive side of the range the game can actually put a child in.
    const strikes = Math.max(
      strikesFor(item.answer + 1 - Math.round(item.answer * 0.9)),
      strikesFor(item.answer + 1 - Math.round(item.answer * 1.1)),
    )
    const motor = strikes * STRIKE_SECONDS
    const left = pressMsFor(item) / 1000 - motor
    if (left < worst.left) worst = { prompt: item.prompt, left, level: item.level }
  }
  assert.ok(
    worst.left >= 8,
    `${worst.prompt} (rung ${worst.level}) leaves ${worst.left.toFixed(1)} s to do the arithmetic in`,
  )
})

test("the motor budget is priced at a cadence the steel actually survives", () => {
  // Not a comfort figure. A blow outside the resonance window costs
  // `BASE_STRAIN` and the beam bleeds `BLEED_PER_SEC`, so anything faster than
  // their ratio accumulates strain until the beam shears — which would mean the
  // game shearing a child for executing a correct plan inside the window it gave
  // them. Proved by playing it, not by reading the constants.
  assert.ok(
    STRIKE_SECONDS >= SUSTAINABLE_STRIKE_SECONDS,
    `${STRIKE_SECONDS}s per strike is faster than the steel bleeds (${SUSTAINABLE_STRIKE_SECONDS}s)`,
  )
  assert.equal(SUSTAINABLE_STRIKE_SECONDS, BASE_STRAIN / BLEED_PER_SEC)
  assert.equal(impulseFor(STRIKE_SECONDS * 1000), BASE_STRAIN)

  // The longest plan this rack can be asked for, struck at the budgeted cadence.
  // Found rather than asserted: five blows on each of the low places and
  // whatever is left on the thousands pillar, which has nothing above it.
  let longest = 0
  for (let delta = -19999; delta <= 19999; delta++) {
    longest = Math.max(longest, planStrikes(delta).length)
  }
  assert.ok(longest >= 20, `the worst plan is only ${longest} strikes`)
  const steel = new Strain({ shearAt: 34 })
  for (let i = 0; i < longest; i++) {
    steel.strike()
    steel.advance(STRIKE_SECONDS * 1000)
    assert.equal(steel.isSheared, false, `the steel sheared on blow ${i + 1} of a correct plan`)
  }
})

test("the pieces are each monotone, so nothing can cancel out inside the sum", () => {
  const widths: Array<{ prompt: string; answer: number }> = [
    { prompt: "3 + 4", answer: 7 },
    { prompt: "43 + 25", answer: 68 },
    { prompt: "473 + 168", answer: 641 },
    { prompt: "6253 + 5710", answer: 11963 },
  ]
  for (let i = 1; i < widths.length; i++) {
    const lower = widths[i - 1] as { prompt: string; answer: number }
    const upper = widths[i] as { prompt: string; answer: number }
    assert.ok(comprehensionSeconds(upper) >= comprehensionSeconds(lower))
    assert.ok(motorSeconds(upper) >= motorSeconds(lower))
  }
  assert.ok(STRIKES_PER_COLUMN >= 5, "balanced base-ten can need five blows on a place")
})

test("a prompt this cannot read gets the longer window, never the shorter", () => {
  // Guessing in the child's favour is the only direction this may be wrong in.
  assert.equal(needsRegrouping("a bag of 47 marbles and one of 25"), true)
  assert.equal(needsRegrouping("43 + 25"), false)
  assert.equal(needsRegrouping("47 + 25"), true)
  assert.equal(needsRegrouping("52 − 27"), true)
  assert.equal(needsRegrouping("58 − 27"), false)
})

test("the clamps hold at both ends", () => {
  assert.ok(pressMsFor({ prompt: "1 + 1", answer: 2 }) >= MIN_PRESS_SECONDS * 1000)
  const absurd = { prompt: "123456789 + 987654321", answer: 1111111110 }
  assert.ok(pressMsFor(absurd) <= MAX_PRESS_SECONDS * 1000)
  assert.ok(MIN_PRESS_SECONDS < MAX_PRESS_SECONDS)
})
