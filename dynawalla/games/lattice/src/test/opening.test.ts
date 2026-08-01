// THE OPENING, MEASURED.
//
// "the way it starts for me now is chaotic and impossible."
//
// Every number in `game/opening.ts`'s header comes from this file, and the
// point of it is that "calmer" is not a claim anybody has to take on trust. The
// real `Arena` is armed at every step of the ramp, at three viewports, over
// sixty seeds, and what a child would be looking at is counted.
//
// The shipped opening, measured the same way (the `step: 5` row below is
// literally it, unchanged): up to six numbers on the screen before the child
// has touched anything, the fastest of them crossing the arena's diagonal in
// nine and a half seconds, and up to nine on the screen once that field is
// ground down to primes.
//
// What a child who has never played gets instead: **one**, at a third of the
// pace — thirty-three seconds to cross the diagonal — and never more than five
// even after they have shot it to pieces.

import assert from "node:assert/strict"
import { test } from "node:test"

import { Rng } from "../core/rng.ts"
import { Arena } from "../game/arena.ts"
import { MAX_HUSK, primeFactors, productOf } from "../game/factor.ts"
import { CALM_OPENINGS, gather, openingAt } from "../game/opening.ts"
import { createStubHost } from "../stubHost.ts"

/** Every shape the fleet has, so a bound is not a bound on one aspect ratio. */
const VIEWPORTS: Array<[string, number, number]> = [
  ["phone portrait", 390, 740],
  ["tablet portrait", 1180, 820],
  ["phone landscape", 844, 390],
]

const SEEDS = Array.from({ length: 60 }, (_, i) => i * 7919 + 1)

/**
 * The bounds. Measured, then written down one notch loose so an unlucky seed
 * does not fail the suite and a regression of any size does.
 *
 * `bodies` is what is on the screen at t=0. `ground` is what is on the screen
 * after every husk in that field has been shot all the way down to primes —
 * the most that one question can ever put in front of the child. `drift` is the
 * fastest anything is moving, as a percentage of the arena's own diagonal per
 * second, which is the only frame-of-reference that means the same thing on a
 * phone and on a tablet (see `arena.REFERENCE_SPAN`).
 */
const BOUNDS: Array<{ step: number; bodies: number; ground: number; drift: number }> = [
  { step: 0, bodies: 1, ground: 5, drift: 3.0 },
  { step: 1, bodies: 1, ground: 5, drift: 4.5 },
  { step: 2, bodies: 3, ground: 6, drift: 6.3 },
  { step: 3, bodies: 5, ground: 7, drift: 7.5 },
  { step: 4, bodies: 6, ground: 8, drift: 9.8 },
  { step: 5, bodies: 6, ground: 9, drift: 10.5 },
]

function armed(seed: number, w: number, h: number, experience: number): Arena {
  const host = createStubHost({ seed, reducedMotion: true })
  const arena = new Arena(host, new Rng(seed ^ 0x51de), { width: w, height: h, experience })
  arena.begin(0)
  return arena
}

/** The fastest thing on the field, as a fraction of the arena's diagonal. */
function topDrift(arena: Arena, diagonal: number): number {
  let top = 0
  for (const body of arena.bodies) top = Math.max(top, Math.hypot(body.vx, body.vy) / diagonal)
  return top
}

// ── the table itself ────────────────────────────────────────────────────────

test("the table only ever gets busier, never calmer, as a child gets further in", () => {
  let previous = openingAt(0)
  for (let step = 1; step <= 40; step++) {
    const at = openingAt(step)
    assert.ok(at.husks >= previous.husks, `husks fell at step ${step}`)
    assert.ok(at.chaff >= previous.chaff, `chaff fell at step ${step}`)
    assert.ok(at.drift >= previous.drift, `the drift band fell at step ${step}`)
    assert.ok(
      Number(at.guided) <= Number(previous.guided),
      `the guidance came back at step ${step}`,
    )
    assert.ok(at.decoy || !previous.decoy, `the decoy went away again at step ${step}`)
    previous = at
  }
})

test("past the ramp it is the same opening forever, and nothing before it is", () => {
  const steady = openingAt(CALM_OPENINGS)
  for (const step of [CALM_OPENINGS, CALM_OPENINGS + 1, 40, 4000]) {
    assert.deepEqual({ ...openingAt(step), step: 0 }, { ...steady, step: 0 })
  }
  assert.equal(steady.guided, false, "the steady game walks a child through it")
  assert.equal(steady.drift, 1, "the steady game is not the arena's own pace")
  for (let step = 0; step < CALM_OPENINGS; step++) {
    const at = openingAt(step)
    assert.ok(
      at.husks < steady.husks || at.chaff < steady.chaff || at.drift < steady.drift,
      `step ${step} is already the full field`,
    )
  }
  // Nothing that is not a number is a step, and none of them throws.
  for (const bad of [Number.NaN, -1, Number.POSITIVE_INFINITY, -Number.MAX_VALUE]) {
    assert.equal(openingAt(bad).step, 0, `${bad} was not read as the very beginning`)
  }
})

test("gather conserves the product exactly, whatever it is asked for", () => {
  const rng = new Rng(0xca1)
  for (let trial = 0; trial < 4000; trial++) {
    const many = rng.int(1, 8)
    const primes: number[] = []
    for (let i = 0; i < many; i++) primes.push(rng.pick([2, 3, 5, 7, 11, 13, 17, 19, 23, 47]))
    const cap = rng.int(1, 6)
    const husks = gather(primes, cap)
    assert.equal(
      productOf(husks),
      productOf(primes),
      `gather(${primes.join(",")}, ${cap}) lost or invented a factor`,
    )
    assert.ok(husks.length <= Math.max(cap, primes.length), "gather made more husks than asked")
    assert.ok(husks.length >= 1, "gather made nothing out of something")
    for (const husk of husks) {
      assert.ok(Number.isInteger(husk) && husk >= 2, `a husk of ${husk} is not a number to shoot`)
      assert.ok(husk <= MAX_HUSK, `a husk of ${husk} is past what the game will draw`)
    }
    // Cracked all the way down, it is the same multiset it was handed.
    const back = husks.flatMap((h) => primeFactors(h)).sort((a, b) => a - b)
    assert.deepEqual(back, primes.slice().sort((a, b) => a - b), "gather changed the factorisation")
  }
  assert.deepEqual(gather([], 3), [], "gather invented a husk out of nothing")
})

// ── the real arena, at every step, at every viewport ────────────────────────

test("the first field is ONE number, and it carries the whole answer", () => {
  for (const [name, w, h] of VIEWPORTS) {
    for (const seed of SEEDS) {
      const arena = armed(seed, w, h, 0)
      const res = arena.resonator
      if (!res) continue
      assert.equal(
        arena.bodies.length,
        1,
        `${name} seed ${seed}: ${arena.bodies.length} numbers on the first screen, not one`,
      )
      assert.equal(
        arena.bodies[0]?.value,
        res.target,
        `${name} seed ${seed}: the one number is not the answer`,
      )
    }
  }
})

test("the opening stays inside its bounds at every step, at every shape", () => {
  for (const [name, w, h] of VIEWPORTS) {
    const diagonal = Math.hypot(w, h)
    for (const bound of BOUNDS) {
      for (const seed of SEEDS) {
        const arena = armed(seed, w, h, bound.step)
        const where = `${name} seed ${seed} step ${bound.step}`
        assert.ok(
          arena.bodies.length <= bound.bodies,
          `${where}: ${arena.bodies.length} numbers at t=0, over the bound of ${bound.bodies}`,
        )
        const drift = topDrift(arena, diagonal) * 100
        assert.ok(
          drift <= bound.drift,
          `${where}: something crossing ${drift.toFixed(2)}% of the diagonal a second, over ${bound.drift}`,
        )

        // Now shoot the whole field to pieces without opening anything. This is
        // the most this one question can ever put in front of the child, and it
        // is the number the report was actually about — every shot turns one
        // husk into two bodies, so a busy field compounds.
        let peak = arena.bodies.length
        for (let guard = 0; guard < 400; guard++) {
          const composite = arena.bodies.find((b) => !b.prime)
          if (!composite) break
          arena.strike(composite.id)
          peak = Math.max(peak, arena.bodies.length)
        }
        assert.ok(
          peak <= bound.ground,
          `${where}: ${peak} numbers once the field is ground down, over ${bound.ground}`,
        )
      }
    }
  }
})

test("a child who just looks at it for a minute is never overtaken", () => {
  for (const [name, w, h] of VIEWPORTS) {
    const diagonal = Math.hypot(w, h)
    for (const seed of SEEDS.slice(0, 20)) {
      const arena = armed(seed, w, h, 0)
      if (!arena.resonator) continue
      // Sixty seconds, hands off the glass, sampled every second.
      let total = 0
      for (let second = 0; second < 60; second++) {
        for (let frame = 0; frame < 60; frame++) arena.step(16.7)
        assert.equal(
          arena.bodies.length,
          1,
          `${name} seed ${seed}: the field grew to ${arena.bodies.length} on its own`,
        )
        const drift = topDrift(arena, diagonal) * 100
        total += drift
        // The ceiling is loose because a husk that drifts into a ship nobody is
        // flying still shoves off it — `JOSTLE_HUSK_SPAN` is the ship's own
        // dynamics and is deliberately not scaled down with the field. It
        // decays back inside a second, which is what the average is for.
        assert.ok(
          drift <= 4.5,
          `${name} seed ${seed}: it wound itself up to ${drift.toFixed(2)}% of a diagonal a second`,
        )
      }
      const average = total / 60
      assert.ok(
        average <= 2.4,
        `${name} seed ${seed}: it averaged ${average.toFixed(2)}% of a diagonal a second over the minute`,
      )
    }
  }
})

test("a number that has been slowed down stays slow on a calm field", () => {
  // The floor as well as the ceiling. `Arena.step` *accelerates* anything
  // drifting below `DRIFT_MIN_SPAN` — the arena refuses to let a husk park —
  // and that floor has to come down with the rest of the band or the calm field
  // is not calm, it is merely pinned into a very narrow fast one.
  //
  // Measured with the floor left at the ordinary value: a husk knocked down to
  // a crawl is wound back up to 2.1% of the arena's diagonal a second, against
  // the 0.6% the calm band asks for. Nothing else in this file notices, because
  // a freshly seeded husk is already near the ceiling and never visits the
  // floor at all — it takes a bump, or a very long sitting, to get there.
  for (const [name, w, h] of VIEWPORTS) {
    const diagonal = Math.hypot(w, h)
    for (const seed of SEEDS.slice(0, 10)) {
      const arena = armed(seed, w, h, 0)
      const body = arena.bodies[0]
      if (!body) continue
      // Knocked almost to a stop, the way a bump leaves one.
      body.vx = diagonal * 0.0005
      body.vy = 0
      for (let f = 0; f < 900; f++) arena.step(16.7)
      const settled = topDrift(arena, diagonal) * 100
      assert.ok(
        settled > 0.2,
        `${name} seed ${seed}: the field stopped dead at ${settled.toFixed(2)}%`,
      )
      assert.ok(
        settled <= 1.0,
        `${name} seed ${seed}: a husk at a crawl was wound back up to ${settled.toFixed(2)}% of a diagonal a second`,
      )
    }
  }
})

test("the ramp is walked by opening rings, and it is remembered across sittings", () => {
  // A child who opened three yesterday comes back to the fourth field, not the
  // first — which is the whole reason `experience` exists rather than a counter
  // that starts at zero every time the pack is mounted.
  const fresh = armed(0x09e11, 900, 700, 0)
  assert.equal(fresh.openingStep, 0)
  assert.equal(fresh.opening.guided, true, "a first sitting is not guided")

  const returning = armed(0x09e11, 900, 700, 3)
  assert.equal(returning.openingStep, 3)
  assert.ok(
    returning.bodies.length > fresh.bodies.length,
    "a child on their fourth ring got the first-ring field again",
  )

  const fluent = armed(0x09e11, 900, 700, 20)
  assert.equal(fluent.opening.guided, false, "a fluent child is still being walked through it")
  assert.equal(fluent.liveMarks(), null, "a fluent child's field is still being marked")
})

test("opening a ring walks the child one step along the ramp", () => {
  const host = createStubHost({ seed: 0x57e9, reducedMotion: true })
  const arena = new Arena(host, new Rng(0x57e9 ^ 0x51de), {
    width: 900,
    height: 700,
    experience: 0,
  })
  arena.begin(0)
  const before = arena.openingStep
  const res = arena.resonator
  assert.ok(res, "nothing was armed")
  // Grind the one husk down and carry exactly the answer in.
  for (let guard = 0; guard < 400; guard++) {
    const composite = arena.bodies.find((b) => !b.prime)
    if (!composite) break
    arena.strike(composite.id)
  }
  for (const prime of primeFactors(res.target)) {
    const mote = arena.bodies.find((b) => b.prime && b.value === prime)
    assert.ok(mote, `the field could not supply a ${prime}`)
    arena.touch(mote.id)
  }
  arena.enter(1000)
  assert.equal(arena.opened, 1, "the ring did not open on the exact factorisation")
  assert.equal(arena.openingStep, before + 1, "the ramp did not move")
})

test("a round the opening helped with does not climb the arena's own ladder", () => {
  // The same rule `hint.ts` applies to a tree that stated the answer, and for
  // the same reason: the first field carries the target on one stone and the
  // guidance says which primes divide it, so an opening is not evidence about
  // arithmetic. The host still hears the outcome — the progress bar still moves
  // — and only the game's own idea of where to ask next is held.
  //
  // Counted at `Ladder.opened` itself rather than off `ladder.at`, because
  // `arm` also calls `landed()` on every arming and the position therefore moves
  // whether or not anything climbed. Reading the position would have passed
  // with the rule deleted.
  const play = (experience: number): { climbs: number; opened: number } => {
    const host = createStubHost({ seed: 0x1adde2, reducedMotion: true })
    const arena = new Arena(host, new Rng(0x1adde2 ^ 0x51de), {
      width: 900,
      height: 700,
      experience,
    })
    let climbs = 0
    const climb = arena.ladder.opened.bind(arena.ladder)
    arena.ladder.opened = (): void => {
      climbs += 1
      climb()
    }
    arena.begin(0)
    for (let round = 0; round < 3; round++) {
      const res = arena.resonator
      if (!res) break
      for (let guard = 0; guard < 400; guard++) {
        const composite = arena.bodies.find((b) => !b.prime)
        if (!composite) break
        arena.strike(composite.id)
      }
      let ok = true
      for (const prime of primeFactors(res.target)) {
        const mote = arena.bodies.find((b) => b.prime && b.value === prime)
        if (!mote) {
          ok = false
          break
        }
        arena.touch(mote.id)
      }
      if (!ok) break
      arena.enter(1000 * (round + 1))
    }
    return { climbs, opened: arena.opened }
  }
  const guided = play(0)
  assert.ok(guided.opened >= 3, `only ${guided.opened} rings opened on the guided ramp`)
  assert.equal(guided.climbs, 0, "the guided opening climbed the ladder on rounds it helped with")
  const steady = play(CALM_OPENINGS)
  assert.ok(steady.opened >= 3, `only ${steady.opened} rings opened at the steady state`)
  assert.equal(steady.climbs, steady.opened, "the steady game stopped climbing at all")
})
