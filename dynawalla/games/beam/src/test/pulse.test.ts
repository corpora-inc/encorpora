import { test } from "node:test"
import assert from "node:assert/strict"

import { Rng } from "../core/rng.ts"
import { A_CANDIDATE, A_CORE, A_ORDINARY, type Automaton, Field } from "../sim/field.ts"
import { MAX_BEAM, MIN_BEAM } from "../sim/lattice.ts"
import { canKill, resolveStrike } from "../sim/pulse.ts"

test("A KILL IS POSSIBLE IF AND ONLY IF THE BEAM DIVIDES THE VALUE", () => {
  // The headline invariant of the whole game, asserted as a biconditional over
  // every readable beam and every legible hull value, for both killable
  // classes, and in both pulse positions.
  for (let beam = MIN_BEAM; beam <= MAX_BEAM; beam++) {
    for (let value = 2; value <= 999; value++) {
      const divides = value % beam === 0
      assert.equal(canKill(beam, value), divides)
      for (const isFirst of [true, false]) {
        const ordinary = resolveStrike(beam, A_ORDINARY, value, isFirst)
        const candidate = resolveStrike(beam, A_CANDIDATE, value, isFirst)
        assert.equal(
          ordinary === "shatter",
          divides,
          `beam ${beam} vs ${value}: ordinary kill did not track divisibility`,
        )
        assert.equal(
          candidate === "submit",
          divides,
          `beam ${beam} vs ${value}: candidate submission did not track divisibility`,
        )
      }
    }
  }
})

test("a beam that does not divide rings the first body it meets, and only that one", () => {
  assert.equal(resolveStrike(5, A_ORDINARY, 84, true), "dissonance")
  assert.equal(resolveStrike(5, A_ORDINARY, 84, false), "pass")
  assert.equal(resolveStrike(5, A_CANDIDATE, 84, true), "dissonance")
  assert.equal(resolveStrike(5, A_CANDIDATE, 84, false), "pass")
})

test("a CORE is armoured: the problem is never the target", () => {
  for (let beam = MIN_BEAM; beam <= MAX_BEAM; beam++) {
    for (const v of [84, 85, 90, 405]) {
      assert.equal(resolveStrike(beam, A_CORE, v, true), "pass")
      assert.equal(resolveStrike(beam, A_CORE, v, false), "pass")
    }
  }
})

test("nothing can be killed by a value that is not a whole number of beams", () => {
  for (const bad of [Number.NaN, 4.5, -12, 0]) {
    assert.equal(resolveStrike(6, A_ORDINARY, bad, true), "dissonance")
    assert.equal(canKill(6, bad), false)
  }
})

test("a pulse meets the bodies on its beam nearest first", () => {
  const field = new Field()
  const at = (t: number, col: number) => {
    const b = field.spawn()
    assert.ok(b)
    b.kind = A_ORDINARY
    b.t = t
    b.beam = col
    b.slide = col
    b.value = Math.round(t * 100)
    return b
  }
  at(0.2, 1)
  at(0.8, 1)
  at(0.5, 1)
  at(0.5, 3) // a different beam: never swept
  const out: Automaton[] = []
  field.sweep(1, 1, 0, out)
  assert.deepEqual(
    out.map((b) => b.t),
    [0.8, 0.5, 0.2],
  )
})

test("a pulse only sweeps the slice of the beam it has travelled through", () => {
  const field = new Field()
  for (const t of [0.1, 0.4, 0.7, 0.95]) {
    const b = field.spawn()
    assert.ok(b)
    b.kind = A_ORDINARY
    b.t = t
    b.beam = 2
    b.slide = 2
    b.value = 12
  }
  const out: Automaton[] = []
  field.sweep(2, 0.75, 0.35, out)
  assert.deepEqual(
    out.map((b) => b.t),
    [0.7, 0.4],
  )
})

test("automata walk the lattice and turn back at the edges", () => {
  const field = new Field()
  const b = field.spawn()
  assert.ok(b)
  b.kind = A_ORDINARY
  b.beam = 4
  b.slide = 4
  b.stepDir = 1
  b.stepIn = 0
  b.speed = 0
  const landed: Automaton[] = []
  const seen: number[] = []
  for (let i = 0; i < 12; i++) {
    field.update(0.5, 5, 0.5, landed)
    seen.push(b.beam)
  }
  // Reflected off column 4 immediately and walked back down the lattice.
  assert.deepEqual(seen, [3, 2, 1, 0, 1, 2, 3, 4, 3, 2, 1, 0])
  assert.ok(seen.every((c) => c >= 0 && c <= 4))
})

test("an automaton that reaches the floor is reported exactly once per step", () => {
  const field = new Field()
  const b = field.spawn()
  assert.ok(b)
  b.kind = A_ORDINARY
  b.t = 0.9
  b.speed = 1
  b.stepIn = 1e9
  const landed: Automaton[] = []
  field.update(0.05, 5, 1, landed)
  assert.equal(landed.length, 0)
  field.update(0.2, 5, 1, landed)
  assert.equal(landed.length, 1)
  assert.equal(b.t, 1)
})

test("dissonance costs time and nothing else", () => {
  // The urgency multiplier is the only thing a wrong read touches: no score is
  // deducted anywhere in this file, and no anchor is spent.
  const field = new Field()
  const b = field.spawn()
  assert.ok(b)
  b.speed = 0.1
  b.urgency = 1
  b.urgency = Math.min(2.4, b.urgency + 0.35)
  assert.ok(b.urgency > 1 && b.urgency <= 2.4)
})

test("the field never hands out the same slot twice", () => {
  const field = new Field()
  const rng = new Rng(5)
  const live = new Set<number>()
  for (let i = 0; i < 500; i++) {
    if (rng.chance(0.6)) {
      const b = field.spawn()
      if (b) {
        assert.ok(!live.has(b.serial))
        live.add(b.serial)
      }
    } else {
      for (const b of field.bodies) {
        if (b.alive) {
          b.alive = false
          live.delete(b.serial)
          break
        }
      }
    }
    assert.equal(field.liveCount(), field.bodies.filter((b) => b.alive).length)
  }
})
