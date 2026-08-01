// THE ARENA — what the child can actually do, and what the host hears.
//
// The rules only. Nothing here draws, and nothing here reads a clock it was not
// handed; the arena is a pure state machine over integers and the shell is what
// turns collisions into these calls.

import assert from "node:assert/strict"
import { test } from "node:test"

import { Rng } from "../core/rng.ts"
import { Arena, MAX_TARGET } from "../game/arena.ts"
import { isPrime, primeFactors, productOf, sameMultiset } from "../game/factor.ts"
import { CALM_OPENINGS } from "../game/opening.ts"
import { createStubHost } from "../stubHost.ts"
import { grindToPrimes, rig, sweepFactorisation } from "./harness.ts"

test("a resonator always arrives with a target the arena can honestly ask for", () => {
  for (let seed = 1; seed <= 60; seed++) {
    const { arena } = rig(seed * 7919)
    const res = arena.resonator
    assert.ok(res, `seed ${seed} armed no resonator`)
    assert.ok(Number.isInteger(res.target), `seed ${seed}: a non-integer target`)
    assert.ok(res.target >= 2 && res.target <= MAX_TARGET, `seed ${seed}: target ${res.target}`)
    assert.equal(arena.stalled, false)
  }
})

test("shooting conserves the product: grinding the field never changes what is on it", () => {
  for (let seed = 1; seed <= 40; seed++) {
    const { arena } = rig(seed * 104729)
    const before = productOf(arena.bodies.map((b) => b.value))
    const primes = grindToPrimes(arena)
    assert.ok(primes.every(isPrime), `seed ${seed}: something un-ground survived`)
    assert.equal(
      productOf(primes),
      before,
      `seed ${seed}: grinding the field changed its product`,
    )
  }
})

test("a shot at a prime is refused — it shoves the mote and never splits it", () => {
  const { arena } = rig(0x9a11)
  grindToPrimes(arena)
  const mote = arena.bodies[0]
  assert.ok(mote)
  const count = arena.bodies.length
  const value = mote.value
  const events = arena.strike(mote.id)
  assert.equal(events.length, 1)
  assert.equal(events[0]?.kind, "wall")
  assert.equal(arena.bodies.length, count, "a prime came apart under fire")
  assert.equal(arena.bodies.find((b) => b.id === mote.id)?.value, value)
})

test("the field can always supply the answer's factorisation", () => {
  // A resonator the field cannot answer is a resonator the child cannot open,
  // which would make the whole thinking layer unreachable without anything
  // failing anywhere. This is the test that would catch it.
  for (let seed = 1; seed <= 50; seed++) {
    const { arena } = rig(seed * 15485863)
    const res = arena.resonator
    assert.ok(res)
    grindToPrimes(arena)
    assert.ok(
      sweepFactorisation(arena, res.target),
      `seed ${seed}: the field could not supply the primes of ${res.target}`,
    )
    assert.equal(arena.bank.value, res.target)
    assert.ok(sameMultiset(arena.bank.tiles, primeFactors(res.target)))
  }
})

test("flying into the resonator with the right primes opens it and reports it", () => {
  const { arena, reports, transitions } = rig(0x09e05)
  const res = arena.resonator
  assert.ok(res)
  grindToPrimes(arena)
  assert.ok(sweepFactorisation(arena, res.target))

  const events = arena.enter(3200)
  assert.ok(
    events.some((e) => e.kind === "open"),
    "the resonator did not open for its own factorisation",
  )
  assert.equal(arena.opened, 1)
  assert.equal(arena.chain, 1)
  assert.equal(arena.bank.size, 0, "the hold was not spent")

  assert.equal(reports.length, 1)
  assert.equal(reports[0]?.questionId, res.questionId)
  assert.equal(reports[0]?.correct, true)
  assert.equal(reports[0]?.answered, String(res.target))
  assert.equal(reports[0]?.ms, 3200)

  // A stopping point the child reached, never a failure.
  assert.deepEqual(transitions, [{ kind: "level", label: "resonance" }])
  // And the next question is already armed.
  assert.ok(arena.resonator)
  assert.notEqual(arena.resonator?.questionId, res.questionId)
})

test("a wrong product is reported as itself and does not open anything", () => {
  const { arena, reports, transitions } = rig(0xbad1)
  const res = arena.resonator
  assert.ok(res)
  grindToPrimes(arena)

  // Sweep one prime and no more: unless the target is that prime, this is an
  // honest wrong assertion — the kind a child makes by rushing.
  const mote = arena.bodies.find((b) => b.prime && b.value !== res.target)
  assert.ok(mote)
  arena.touch(mote.id)
  const asserted = arena.bank.value
  assert.notEqual(asserted, res.target)

  const events = arena.enter(2000)
  assert.equal(events.length, 1)
  assert.equal(events[0]?.kind, "refuse")
  assert.equal(arena.opened, 0)
  assert.equal(arena.chain, 0)
  assert.equal(reports.length, 1)
  assert.equal(reports[0]?.correct, false)
  assert.equal(reports[0]?.answered, String(asserted))
  // A purchase surface must never sit next to a mistake.
  assert.deepEqual(transitions, [], "a refusal raised a stopping point")
})

test("a refusal hands the primes back — nothing the child worked for is destroyed", () => {
  const { arena } = rig(0x9e17)
  const res = arena.resonator
  assert.ok(res)
  grindToPrimes(arena)
  const mote = arena.bodies.find((b) => b.prime && b.value !== res.target)
  assert.ok(mote)
  arena.touch(mote.id)
  const held = arena.bank.tiles.slice()
  const onField = arena.bodies.map((b) => b.value)

  arena.enter(1000)
  assert.equal(arena.bank.size, 0)
  assert.ok(
    sameMultiset(arena.bodies.map((b) => b.value), [...onField, ...held]),
    "a refusal ate the primes the child was holding",
  )
})

test("one question, one report: a second assertion is not heard again", () => {
  const { arena, reports } = rig(0x2ce)
  const res = arena.resonator
  assert.ok(res)
  grindToPrimes(arena)
  const mote = arena.bodies.find((b) => b.prime && b.value !== res.target)
  assert.ok(mote)

  arena.touch(mote.id)
  arena.enter(1000)
  assert.equal(reports.length, 1)

  // The resonator is dim for a moment after a refusal; step past it, then open
  // it properly. The child gets their resonance; the host hears one answer.
  arena.step(1000)
  assert.ok(sweepFactorisation(arena, res.target))
  const events = arena.enter(9000)
  assert.ok(events.some((e) => e.kind === "open"))
  assert.equal(reports.length, 1, "the same question was answered to the host twice")
})

test("an empty hold flies straight through: no event, no report", () => {
  const { arena, reports } = rig(0x0e17)
  assert.equal(arena.bank.size, 0)
  assert.deepEqual(arena.enter(500), [])
  assert.equal(reports.length, 0)
  assert.equal(arena.opened, 0)
})

test("a resonator asking for a prime opens only for the mote carrying it", () => {
  // The wall, in the arena rather than in the rule: a stub host wound forward
  // to a prime answer, ground down, and every smaller prime on the field swept.
  const host = createStubHost({ seed: 0x7a11, reducedMotion: true })
  const arena = new Arena(host, new Rng(0x7a11), { width: 900, height: 700, experience: CALM_OPENINGS })
  arena.begin(0)
  let guard = 0
  while (arena.resonator && !isPrime(arena.resonator.target) && guard++ < 200) {
    // Open it the honest way so the next question is drawn.
    grindToPrimes(arena)
    assert.ok(sweepFactorisation(arena, arena.resonator.target))
    arena.enter(guard * 100)
  }
  const res = arena.resonator
  assert.ok(res && isPrime(res.target), "no prime target came up in 200 questions")

  grindToPrimes(arena)
  // Sweep every prime on the field that is smaller than the target, and try.
  for (const body of arena.bodies.filter((b) => b.value < res.target).slice(0, 6)) {
    arena.touch(body.id)
    if (arena.bank.value === res.target) break
  }
  if (arena.bank.value !== res.target) {
    const events = arena.enter(1000)
    assert.ok(
      !events.some((e) => e.kind === "open"),
      `the prime ${res.target} was assembled from smaller factors`,
    )
  }
  // And the mote itself is on the field, because that is the only way in.
  assert.ok(
    arena.bodies.some((b) => b.value === res.target) || arena.bank.tiles.includes(res.target),
    `the prime ${res.target} was asked for and no mote carried it`,
  )
})

test("a composite jostles the ship and shakes a mote loose; it is never swept", () => {
  const { arena } = rig(0x105)
  const husk = arena.bodies.find((b) => !b.prime)
  assert.ok(husk)
  // Put something in the hold first, so there is something to lose.
  arena.strike(husk.id)
  const mote = arena.bodies.find((b) => b.prime)
  assert.ok(mote)
  arena.touch(mote.id)
  assert.equal(arena.bank.size, 1)

  const other = arena.bodies.find((b) => !b.prime)
  if (other) {
    const events = arena.touch(other.id)
    assert.equal(events[0]?.kind, "jostle")
    assert.equal(arena.bank.size, 0, "a jostle did not cost a mote")
    assert.ok(
      arena.bodies.some((b) => !b.prime && b.id === other.id),
      "a jostle consumed the husk",
    )
  }
})

test("venting puts the whole hold back on the field", () => {
  const { arena } = rig(0x0e27)
  grindToPrimes(arena)
  const mote = arena.bodies[0]
  assert.ok(mote)
  arena.touch(mote.id)
  const onField = arena.bodies.map((b) => b.value)
  const held = arena.bank.tiles.slice()
  assert.equal(held.length, 1)

  const events = arena.vent()
  assert.equal(events[0]?.kind, "vent")
  assert.equal(arena.bank.size, 0)
  assert.ok(sameMultiset(arena.bodies.map((b) => b.value), [...onField, ...held]))
  assert.deepEqual(arena.vent(), [], "venting an empty hold produced an event")
})

test("the hold refuses past its ceiling rather than dropping what is in it", () => {
  const { arena } = rig(0xf0117)
  grindToPrimes(arena)
  // Sweep everything on the field; the hold either takes it or says it is full,
  // and either way the bar stays a true factorisation of the value it shows.
  for (const id of arena.bodies.map((b) => b.id)) {
    arena.touch(id)
    assert.equal(productOf(arena.bank.tiles), arena.bank.value)
    assert.ok(arena.bank.tiles.every(isPrime))
  }
})

test("stepping the world never changes any number on it", () => {
  const { arena } = rig(0x57e9)
  const before = arena.bodies.map((b) => b.value).sort((a, b) => a - b)
  for (let i = 0; i < 240; i++) arena.step(16)
  const after = arena.bodies
    .filter((b) => !b.prime || true)
    .map((b) => b.value)
    .sort((a, b) => a - b)
  // Drifting bodies may collide with the ship and be swept, so compare the
  // product of everything that exists — field plus hold — instead.
  assert.equal(
    productOf(after) * arena.bank.value,
    productOf(before),
    "drifting changed the arithmetic",
  )
})

test("a released mote is thrown clear, and the ship is deaf to it while it goes", () => {
  // The bug this catches was invisible and total: a mote handed back at the
  // ship's own position is a mote the ship is already touching, so it was swept
  // again on the next frame. Venting did nothing, a refusal handed the same
  // wrong hold straight back, and a jostle cost nothing.
  const { arena } = rig(0x5ca7)
  grindToPrimes(arena)
  const mote = arena.bodies[0]
  assert.ok(mote)
  arena.touch(mote.id)
  assert.equal(arena.bank.size, 1)

  arena.vent()
  assert.equal(arena.bank.size, 0)
  // Half a second of frames with the ship sitting exactly where it vented.
  for (let i = 0; i < 20; i++) arena.step(16)
  assert.equal(arena.bank.size, 0, "a vented mote was swept straight back up")

  // Every released mote landed clear of the ship rather than inside it.
  for (const body of arena.bodies) {
    const d = Math.hypot(body.x - arena.ship.x, body.y - arena.ship.y)
    assert.ok(d > 20, `a released mote landed ${Math.round(d)} units from the ship`)
  }
})

test("a refusal costs the trip: the hold is not handed straight back", () => {
  const { arena } = rig(0x5ca8)
  const res = arena.resonator
  assert.ok(res)
  grindToPrimes(arena)
  const mote = arena.bodies.find((b) => b.prime && b.value !== res.target)
  assert.ok(mote)
  arena.touch(mote.id)
  arena.enter(1000)
  assert.equal(arena.bank.size, 0)
  for (let i = 0; i < 20; i++) arena.step(16)
  assert.equal(arena.bank.size, 0, "the refused hold was re-swept on the spot")
})

test("a jostle costs a mote, and the mote does not come straight back", () => {
  const { arena } = rig(0x5ca9)
  const husk = arena.bodies.find((b) => !b.prime)
  assert.ok(husk)
  arena.strike(husk.id)
  const mote = arena.bodies.find((b) => b.prime)
  assert.ok(mote)
  arena.touch(mote.id)
  assert.equal(arena.bank.size, 1)

  const other = arena.bodies.find((b) => !b.prime)
  if (!other) return
  arena.touch(other.id)
  assert.equal(arena.bank.size, 0)
  for (let i = 0; i < 20; i++) arena.step(16)
  assert.equal(arena.bank.size, 0, "the spilled mote was picked straight back up")
})
