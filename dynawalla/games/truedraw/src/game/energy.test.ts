import assert from "node:assert/strict"
import { test } from "node:test"

import { VOICE_POOL, VOICES } from "../audio/audio.ts"
import { energy, HAPTIC, MOVERS, TIMINGS } from "./energy.ts"
import { OUTCOMES } from "./response.ts"
import { TIMING, TIMING_REDUCED } from "./round.ts"

test("A MISS IS A STATEMENT OF FACT AND NEVER A PUNISHMENT", () => {
  // This test used to say `energy("dud") === 0` — a wrong verdict made no sound and
  // put no mark on the slate, so it was trivially the quietest thing in the game.
  // That kept the invariant by having nothing to weigh, and it spent the single most
  // teachable second in the game showing the child nothing at all.
  //
  // A miss now COMPLETES THE SUM in the accent and says one quiet rising figure over
  // it. So the invariant has to be checked rather than assumed, and these are the
  // three things that keep it honest.

  // 1. It is a fifth of the smallest celebration, and it never got louder later.
  const missGain = VOICES.dud?.gain ?? 0
  const bankGain = VOICES.bank?.gain ?? 0
  assert.ok(missGain > 0, "a miss has a voice now — see audio.ts")
  assert.ok(
    missGain <= bankGain * 0.25,
    `a miss speaks at ${String(missGain)} against a bank's ${String(bankGain)}`,
  )
  // ...and that is true of EVERY voice in the pool, not just the loudest one the
  // energy calculation happens to read.
  for (const voice of VOICE_POOL.dud ?? []) assert.ok(voice.gain <= bankGain * 0.25)
  for (const voice of VOICE_POOL.burn ?? []) assert.ok(voice.gain <= bankGain * 0.25)

  // 1b. And `energy()` is told about the WORST case. `VOICES` is derived from the
  //     pools, and if that derivation picked the quietest member instead of the
  //     loudest, every check in this file would pass while the game played
  //     something louder on two rounds in three. Found by mutation: reversing the
  //     comparison in `audio.ts` left the whole suite green.
  for (const outcome of OUTCOMES) {
    const pool = VOICE_POOL[outcome]
    if (!pool || pool.length === 0) {
      assert.equal(VOICES[outcome], undefined, outcome)
      continue
    }
    assert.equal(
      VOICES[outcome]?.gain,
      Math.max(...pool.map((v) => v.gain)),
      `${outcome}: energy() is weighing something other than the loudest voice in the pool`,
    )
  }

  // 2. NOTHING BUZZES. A motor pulse on a wrong answer is a buzzer you can feel: it
  //    tells a masher that something registered, which is the acknowledgement the
  //    design withholds. This one has not moved and must not.
  assert.equal(HAPTIC.dud, null, "a motor pulse is a buzzer you can feel")
  assert.equal(HAPTIC.burn, null)

  // 3. And the energy, computed from the real durations, mover counts and gains, is
  //    still a fraction of either correct verdict in BOTH timing branches.
  for (const timing of TIMINGS) {
    for (const wrong of ["dud", "burn"] as const) {
      assert.ok(
        energy(wrong, timing) < energy("bank", timing) * 0.8,
        `${wrong} ${energy(wrong, timing).toFixed(1)} against bank ${energy("bank", timing).toFixed(1)}`,
      )
    }
  }
})

test("a miss voice never falls — it is the answer arriving, not a verdict on the child", () => {
  // A descending figure is the universal sound of "no". Every miss voice in the pool
  // rises, and the ones that repeat a degree do not count as falling.
  for (const kind of ["dud", "burn"] as const) {
    for (const voice of VOICE_POOL[kind] ?? []) {
      const degrees = voice.degrees
      for (let i = 1; i < degrees.length; i++) {
        assert.ok(
          (degrees[i] ?? 0) >= (degrees[i - 1] ?? 0),
          `${kind} voice ${degrees.join(">")} falls`,
        )
      }
    }
  }
})

test("a lapse is the quietest thing in the game, because it is not a failure", () => {
  // A tone or a buzz at the end of a window a child was still thinking through is a
  // buzzer aimed at slowness, which is the one thing this product will not do.
  for (const timing of TIMINGS) assert.equal(energy("lapse", timing), 0)
  assert.equal(VOICES.lapse, undefined)
  assert.equal(HAPTIC.lapse, null)
})

test("being wrong is never more interesting than being right", () => {
  // energy(SLIP) < energy(SEAT), from EXPERIENCE_DESIGN.md, checked against the real
  // durations and gains rather than against a comment about them.
  for (const timing of TIMINGS) {
    for (const wrong of ["dud", "burn", "lapse"] as const) {
      assert.ok(energy(wrong, timing) < energy("bank", timing), wrong)
      assert.ok(energy(wrong, timing) < energy("spot", timing), wrong)
    }
  }
})

test("spotting a counterfeit is the biggest moment in the game", () => {
  for (const timing of TIMINGS) {
    assert.ok(energy("spot", timing) > energy("bank", timing))
  }
  assert.ok(MOVERS.spot > MOVERS.bank)
})

test("reduced motion is a branch, not a deletion", () => {
  for (const kind of ["bank", "spot"] as const) {
    assert.ok(TIMING_REDUCED.verdict[kind] > 0, kind)
    assert.ok(TIMING_REDUCED.verdict[kind] < TIMING.verdict[kind], kind)
  }
  // The ones that must NOT shrink. Most of a miss beat is a completed sum standing
  // still being read, and reading time is not motion: shortening it would take a
  // child who asked for less movement and give them less time to see the answer.
  // What reduced motion changes there is HOW the sum completes — a cross-fade in
  // place instead of a rolling counter wheel.
  assert.equal(TIMING_REDUCED.verdict.dud, TIMING.verdict.dud)
  assert.equal(TIMING_REDUCED.verdict.burn, TIMING.verdict.burn)
})

test("only the two correct verdicts buzz, and nothing buzzes at the cue", () => {
  // A haptic when the statement is cut in would let a child play the beat by feel and
  // never read the slate.
  const buzzing = OUTCOMES.filter((o) => HAPTIC[o] !== null)
  assert.deepEqual(buzzing, ["bank", "spot"], `${buzzing.join(",")} buzz`)
})

test("the mover table counts what the renderer actually draws", () => {
  // `MOVERS` is one half of the energy invariant, and a table that UNDERSTATES a
  // reaction makes the invariant pass by lying about it rather than by holding it.
  // Found by mutation: zeroing the two miss counts left every check in this file
  // green while the game went on drawing the reveal.
  //
  // A miss draws three things — the sum completing itself, the slate leaving, and
  // the coins coming back out — and it must be counted as three.
  assert.ok(MOVERS.dud >= 3, `a dud draws the reveal, the slate and the coins: ${String(MOVERS.dud)}`)
  assert.ok(MOVERS.burn >= 3, `a burn draws the reveal, the slate and the coins: ${String(MOVERS.burn)}`)
  // A lapse draws the least of anything, and still draws something: the slate sinks.
  assert.equal(MOVERS.lapse, 1)
  for (const outcome of OUTCOMES) {
    assert.ok(MOVERS[outcome] >= 1, `${outcome} draws nothing at all`)
  }
})

test("every outcome has a mover count and a duration — no table is left short", () => {
  for (const outcome of OUTCOMES) {
    assert.equal(typeof MOVERS[outcome], "number", outcome)
    for (const timing of TIMINGS) {
      assert.ok(timing.verdict[outcome] > 0, `${outcome} has no beat`)
    }
  }
})
