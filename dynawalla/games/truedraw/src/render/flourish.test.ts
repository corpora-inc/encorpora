// THE POOLS ACTUALLY VARY — and they vary the same way twice for the same seed.
//
// "Success and failure sounds need to be awesome and varied and so do the
// animations." The failure mode this file exists to catch is the quiet one: a pool
// of four that a bug narrows to one, or a `pick` that reads the RNG once and caches
// it, or a no-repeat rule that filters the pool down to a single survivor. All
// three of those produce a game that runs, ships, and does the same thing every
// round — which is exactly the state the founder played.

import assert from "node:assert/strict"
import { test } from "node:test"

import { Rng } from "../core/rng.ts"
import { voiceCount, VOICE_POOL } from "../audio/audio.ts"
import { OUTCOMES, isCorrect, isMiss, type Outcome } from "../game/response.ts"
import { CELEBRATIONS, Flourishes, MISSES, defaultFlourish } from "./flourish.ts"

const ROUNDS = 60

function run(seed: number, outcomes: readonly Outcome[]): { kind: string; voice: number }[] {
  const f = new Flourishes(new Rng(seed))
  const out: { kind: string; voice: number }[] = []
  for (let i = 0; i < ROUNDS; i++) {
    const drawn = f.next(outcomes[i % outcomes.length] as Outcome)
    if (drawn) out.push({ kind: drawn.kind, voice: drawn.voice })
  }
  return out
}

test("EVERY CELEBRATION IN THE POOL IS ACTUALLY REACHED", () => {
  // Not "more than one" — all of them. A variant that a filter or an off-by-one
  // makes unreachable is dead code that looks like variety in the source.
  const drawn = new Set(run(2026, ["bank", "spot"]).map((f) => f.kind))
  for (const kind of CELEBRATIONS) {
    assert.ok(drawn.has(kind), `${kind} was never drawn in ${String(ROUNDS)} rounds`)
  }
  assert.ok(drawn.size > 1, "one celebration, over and over — this is the shipped defect")
})

test("EVERY MISS REVEAL IN THE POOL IS ACTUALLY REACHED", () => {
  const drawn = new Set(run(4711, ["dud", "burn"]).map((f) => f.kind))
  for (const kind of MISSES) {
    assert.ok(drawn.has(kind), `${kind} was never drawn in ${String(ROUNDS)} rounds`)
  }
})

test("EVERY VOICE IN EVERY POOL IS ACTUALLY REACHED", () => {
  // The sound half of the same claim. A voice index that never reaches the third
  // entry is a pool of two wearing a pool of three's clothes.
  for (const outcome of OUTCOMES) {
    const n = voiceCount(outcome)
    if (n === 0) continue
    const voices = new Set(run(913, [outcome]).map((f) => f.voice))
    assert.equal(voices.size, n, `${outcome}: ${String(voices.size)} of ${String(n)} voices used`)
    for (const v of voices) assert.ok(v >= 0 && v < n, `${outcome} voice index ${String(v)}`)
  }
})

test("THE SAME SEED IS THE SAME RUN, FOREVER", () => {
  // Determinism is not decoration here: it is what makes every other assertion in
  // this file a fact rather than a sample, and it is what lets a bug report that
  // names a seed be reproduced.
  const order: readonly Outcome[] = ["bank", "dud", "spot", "burn", "lapse"]
  const a = run(31337, order)
  const b = run(31337, order)
  assert.deepEqual(a, b)
  assert.notDeepEqual(a, run(31338, order), "two different seeds produced identical runs")
})

test("THE SAME VARIANT NEVER LANDS TWICE IN A ROW", () => {
  // A uniform draw from four repeats about a quarter of the time, and a child reads
  // "it did the same thing again" as "it did not notice".
  for (const seed of [1, 2, 3, 17, 999]) {
    for (const family of [
      ["bank", "spot"],
      ["dud", "burn"],
    ] as const) {
      const kinds = run(seed, family).map((f) => f.kind)
      for (let i = 1; i < kinds.length; i++) {
        assert.notEqual(kinds[i], kinds[i - 1], `seed ${String(seed)}: ${String(kinds[i])} twice at ${String(i)}`)
      }
    }
  }
})

test("a lapse draws nothing, in either sense", () => {
  // A window that closed on a child who was still working is not an event the street
  // reacts to. No animation, no sound, and — the part that matters — no consumption
  // of the run's RNG, so a lapse cannot shift which celebration the next correct call
  // gets.
  const f = new Flourishes(new Rng(5))
  assert.equal(f.next("lapse"), null)
  assert.equal(defaultFlourish("lapse"), null)
  assert.equal(voiceCount("lapse"), 0)
  assert.equal(VOICE_POOL.lapse, undefined)

  const withLapses = new Flourishes(new Rng(5))
  const without = new Flourishes(new Rng(5))
  for (let i = 0; i < 12; i++) {
    withLapses.next("lapse")
    assert.deepEqual(withLapses.next("bank"), without.next("bank"))
  }
})

test("a verdict that arrives without a draw still celebrates", () => {
  // A host pause across the settle, a resize, a re-rendered held frame. The
  // alternative to a fallback is a correct call that celebrates NOTHING, which is by
  // a distance the worse failure: the celebration is the reinforcement.
  for (const outcome of OUTCOMES) {
    const fallback = defaultFlourish(outcome)
    if (voiceCount(outcome) === 0) {
      assert.equal(fallback, null, outcome)
      continue
    }
    assert.ok(fallback, `${outcome} falls back to nothing`)
    assert.equal(fallback.outcome, outcome)
    const pool: readonly string[] = isCorrect(outcome) ? CELEBRATIONS : MISSES
    assert.ok(pool.includes(fallback.kind), `${outcome} fell back to ${fallback.kind}`)
    assert.ok(fallback.voice >= 0 && fallback.voice < voiceCount(outcome))
  }
})

test("a celebration is only ever drawn for a correct call", () => {
  // The binding rule, at the level of the draw: the juice fires on the MATHS moment.
  // A miss must never be able to receive a celebration variant and vice versa.
  const f = new Flourishes(new Rng(77))
  for (let i = 0; i < 200; i++) {
    const outcome = OUTCOMES[i % OUTCOMES.length] as Outcome
    const drawn = f.next(outcome)
    if (!drawn) continue
    if (isCorrect(outcome)) {
      assert.ok(CELEBRATIONS.includes(drawn.kind as never), `${outcome} → ${drawn.kind}`)
    } else {
      assert.ok(isMiss(outcome))
      assert.ok(MISSES.includes(drawn.kind as never), `${outcome} → ${drawn.kind}`)
    }
  }
})

test("the spin is a real 0..1 and it is not one frozen number", () => {
  // Each variant jitters off it, so a constant spin would make one variant one
  // picture — the same defect one level down.
  const spins = new Set<number>()
  const f = new Flourishes(new Rng(600))
  for (let i = 0; i < 40; i++) {
    const drawn = f.next("bank")
    assert.ok(drawn)
    assert.ok(drawn.spin >= 0 && drawn.spin < 1, `spin ${String(drawn.spin)}`)
    spins.add(drawn.spin)
  }
  assert.ok(spins.size > 30, `only ${String(spins.size)} distinct spins in 40 draws`)
})
