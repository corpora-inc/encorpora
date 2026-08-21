import { test } from "node:test"
import assert from "node:assert/strict"

import { Rng } from "../core/rng.ts"
import { Director, fieldValue, killScore } from "../sim/director.ts"
import { resonates, validBeamCount } from "../sim/lattice.ts"

const BOARDS = [
  [2, 3, 5, 7, 11],
  [3, 4, 5, 7, 9],
  [2, 4, 6, 8, 12],
  [5, 6, 7, 9, 10],
]

test("every automaton the director puts on the lattice can be killed on it", () => {
  // There is no dodge verb in this game, so an unkillable automaton would be a
  // guaranteed breach the child could do nothing about.
  const rng = new Rng(0xd1)
  for (const beams of BOARDS) {
    for (let tightness = 0; tightness <= 1.0001; tightness += 0.1) {
      for (let i = 0; i < 900; i++) {
        const v = fieldValue(beams, tightness, () => rng.next())
        assert.ok(Number.isInteger(v), `${v} is not an integer`)
        assert.ok(v >= 2 && v <= 999, `${v} is not legible on a moving hull`)
        assert.ok(
          beams.some((b) => resonates(b, v)),
          `nothing on ${beams.join(",")} divides ${v}`,
        )
      }
    }
  }
})

test("tightness really does push the stream toward the precision intercept", () => {
  const beams = [3, 4, 5, 7, 9]
  const meanValid = (tightness: number, seed: number): number => {
    const rng = new Rng(seed)
    let sum = 0
    const n = 4000
    for (let i = 0; i < n; i++) sum += validBeamCount(beams, fieldValue(beams, tightness, () => rng.next()))
    return sum / n
  }
  const loose = meanValid(0, 0x1111)
  const tight = meanValid(1, 0x1111)
  assert.ok(tight < loose, `tight ${tight.toFixed(2)} should be below loose ${loose.toFixed(2)}`)
  assert.ok(loose - tight > 0.25, "the difficulty knob barely moved anything")
})

test("the stream is deterministic for a seed", () => {
  const draw = (seed: number): number[] => {
    const rng = new Rng(seed)
    return Array.from({ length: 200 }, () => fieldValue([3, 4, 5, 7, 9], 0.5, () => rng.next()))
  }
  assert.deepEqual(draw(4), draw(4))
  assert.notDeepEqual(draw(4), draw(5))
})

test("the tight divisor is always worth more than the obvious one", () => {
  // 84 is divisible by 2, 3, 4, 6, 7 and 12. Taking it from the biggest beam is
  // the read worth learning, and it must never pay less than taking it from 2.
  const beams = [2, 3, 4, 7, 12]
  const paid = beams.map((b) => killScore(b, 84, validBeamCount(beams, 84)))
  for (let i = 1; i < paid.length; i++) {
    assert.ok((paid[i] as number) > (paid[i - 1] as number), "a bigger divisor must pay more")
  }
  // And the sole valid beam doubles.
  assert.equal(killScore(7, 35, 1), killScore(7, 35, 2) * 2)
})

test("a beam that does not divide pays nothing at all", () => {
  for (let beam = 2; beam <= 12; beam++) {
    for (let v = 2; v <= 400; v++) {
      if (v % beam === 0) assert.ok(killScore(beam, v, 3) > 0)
      else assert.equal(killScore(beam, v, 3), 0)
    }
  }
})

test("pressure rises with the size of a run and is bounded", () => {
  const d = new Director()
  const start = d.pressure()
  assert.equal(start.level, 0)
  for (let i = 0; i < 400; i++) {
    d.advance(1)
    d.recordKill()
  }
  const end = d.pressure()
  assert.equal(end.level, 1)
  assert.ok(end.descentSeconds < start.descentSeconds)
  assert.ok(end.spawnGap < start.spawnGap)
  assert.ok(end.stepSeconds < start.stepSeconds)
  assert.ok(end.floorCount > start.floorCount)
  assert.ok(end.tightness > start.tightness)
  // Never so fast that a three-digit number cannot be read on the way down.
  assert.ok(end.descentSeconds >= 5.5)
  // And never so slow at the start that the first minute holds two problems.
  assert.ok(start.descentSeconds <= 10)
})

test("escalation is on the size of the run, never on an unbroken streak", () => {
  // Two directors that reach the same totals by different routes must land on
  // the same pressure — a mistake in the middle changes nothing. This is the
  // house rule against streak-keyed escalation, as an assertion.
  const steady = new Director()
  const lumpy = new Director()
  for (let i = 0; i < 40; i++) {
    steady.advance(0.5)
    steady.recordKill()
  }
  for (let i = 0; i < 40; i++) lumpy.recordKill()
  for (let i = 0; i < 40; i++) lumpy.advance(0.5)
  assert.deepEqual(steady.pressure(), lumpy.pressure())
})

test("the lattice is never left empty, and a core never overlaps a core", () => {
  const d = new Director()
  assert.ok(d.wantsSpawn(0), "an empty lattice must always want an automaton")
  d.noteSpawn()
  assert.ok(d.wantsSpawn(0), "the floor count beats the cooldown")
  assert.equal(d.wantsSpawn(9), false, "a full lattice waits for the gap")
  assert.equal(d.wantsCore(true), false, "a second core while one is live is forbidden")
  assert.equal(d.wantsCore(false), false, "and one does not arrive instantly")
  d.advance(1)
  assert.equal(d.wantsCore(false), false, "the dead gap is real, if short")
  d.advance(2)
  assert.ok(d.wantsCore(false))
  d.noteCore()
  assert.equal(d.wantsCore(false), false)
  assert.equal(d.coreCount, 1)
})

test("reset returns the director to the first second of a run", () => {
  const d = new Director()
  for (let i = 0; i < 100; i++) {
    d.advance(1)
    d.recordKill()
  }
  d.noteCore()
  d.reset()
  assert.deepEqual(d.pressure(), new Director().pressure())
  assert.equal(d.killCount, 0)
  assert.equal(d.coreCount, 0)
})
