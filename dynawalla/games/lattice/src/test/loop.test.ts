// DOES THE LOOP CLOSE?
//
// Every other test in this package checks a rule in isolation: this one plays
// the game. A scripted child flies the real arena through the real physics —
// shooting husks apart, chasing the motes they need, avoiding the ones they do
// not, and running at the resonator when the hold is right — and the assertion
// is that resonators actually open.
//
// It is here because the failure it catches is silent and total. A field that
// drifts its last 7 into a corner, a resonator that never listens again after a
// refusal, a hold that fills with chaff and cannot be emptied: each of those
// passes every unit test in this directory and leaves a child flying around an
// arena that can never be beaten. Nothing throws. Nothing goes red. The game is
// simply not a game.
//
// The clock is a counter, the arena's randomness is seeded, and the policy is
// deterministic, so this is reproducible: it passes every time or it fails
// every time.

import assert from "node:assert/strict"
import { test } from "node:test"

import { Rng } from "../core/rng.ts"
import { Arena } from "../game/arena.ts"
import { multisetDifference, primeFactors } from "../game/factor.ts"
import { createStubHost } from "../stubHost.ts"

type Report = { correct: boolean; answered: string }

/** Fly toward a point, and aim there too. */
function steer(arena: Arena, x: number, y: number): void {
  const dx = x - arena.ship.x
  const dy = y - arena.ship.y
  arena.setMove(dx, dy)
  arena.setAim(dx, dy)
}

function nearest<T extends { x: number; y: number }>(arena: Arena, xs: readonly T[]): T | null {
  let best: T | null = null
  let bestD = Number.POSITIVE_INFINITY
  for (const item of xs) {
    const d = Math.hypot(item.x - arena.ship.x, item.y - arena.ship.y)
    if (d < bestD) {
      bestD = d
      best = item
    }
  }
  return best
}

/**
 * A child who is playing properly: work out what the resonator needs, break
 * open whatever is holding those primes, collect exactly them, and go.
 */
function playCarefully(arena: Arena, frames: number): void {
  let t = 0
  for (let f = 0; f < frames; f++) {
    t += 16
    const res = arena.resonator
    if (!res) break

    const wanted = primeFactors(res.target)
    const held = arena.bank.tiles.slice()
    const surplus = multisetDifference(held, wanted)

    if (surplus.length > 0) {
      // Something got swept that the resonator does not want. Drop the lot and
      // start the hold again — the primes go back on the field.
      arena.vent()
    } else if (held.length === wanted.length) {
      // The hold is right. Run at it.
      steer(arena, res.x, res.y)
      if (Math.hypot(res.x - arena.ship.x, res.y - arena.ship.y) < 60) arena.enter(t)
    } else {
      const needed = multisetDifference(wanted, held)
      const motes = arena.bodies.filter((b) => b.prime && needed.includes(b.value))
      const mote = nearest(arena, motes)
      if (mote) {
        steer(arena, mote.x, mote.y)
      } else {
        // Nothing loose carries what is needed, so open something that does.
        const husks = arena.bodies.filter(
          (b) => !b.prime && needed.some((p) => b.value % p === 0),
        )
        const husk = nearest(arena, husks) ?? nearest(arena, arena.bodies.filter((b) => !b.prime))
        if (husk) {
          // Stand off and shoot rather than flying into it — a husk jostles.
          const dx = husk.x - arena.ship.x
          const dy = husk.y - arena.ship.y
          arena.setAim(dx, dy)
          const range = Math.hypot(dx, dy)
          arena.setMove(range > 220 ? dx : -dx, range > 220 ? dy : -dy)
          arena.fire()
        } else {
          // The field has nothing left that helps. Sit still rather than
          // thrashing; the assertion below is what reports it.
          arena.setMove(0, 0)
        }
      }
    }
    arena.step(16)
  }
}

test("a child who plays it properly opens resonators, over and over", () => {
  for (const seed of [0x1a771ce, 0x0c105, 0x5eed, 0xbea7, 0x9a11]) {
    const reports: Report[] = []
    const host = createStubHost({
      seed,
      reducedMotion: true,
      onReport: (r) => reports.push({ correct: r.correct, answered: r.answered }),
    })
    const arena = new Arena(host, new Rng(seed ^ 0x51de), { width: 900, height: 700 })
    arena.begin(0)

    playCarefully(arena, 9000)

    assert.ok(
      arena.opened >= 4,
      `seed ${seed.toString(16)}: a careful player opened only ${arena.opened} resonators in 9000 frames`,
    )
    assert.ok(reports.length >= arena.opened, "resonators opened without being reported")
    // A careful player is right: they assembled the factorisation on purpose.
    const wrong = reports.filter((r) => !r.correct).length
    assert.ok(
      wrong <= reports.length / 4,
      `seed ${seed.toString(16)}: ${wrong} of ${reports.length} careful answers were wrong`,
    )
  }
})

test("a chain builds when nothing goes wrong, and the count is honest", () => {
  const host = createStubHost({ seed: 0xc4a1, reducedMotion: true })
  const arena = new Arena(host, new Rng(0xc4a1), { width: 1100, height: 800 })
  arena.begin(0)
  playCarefully(arena, 9000)
  assert.equal(arena.chain, arena.opened, "a clean run did not build a chain")
  assert.ok(arena.chain >= 4)
})

test("the arena never runs out of things to shoot", () => {
  // Every resonator restocks the field, so a sitting cannot arrive at an empty
  // arena with a question still on the board.
  const host = createStubHost({ seed: 0x5106, reducedMotion: true })
  const arena = new Arena(host, new Rng(0x5106), { width: 900, height: 700 })
  arena.begin(0)
  let emptyFrames = 0
  for (let f = 0; f < 6000; f++) {
    playCarefully(arena, 1)
    if (arena.bodies.length === 0 && arena.bank.size === 0) emptyFrames += 1
  }
  assert.equal(emptyFrames, 0, `the arena was empty on ${emptyFrames} frames`)
})
