import { test } from "node:test"
import assert from "node:assert/strict"

import { Rng } from "../core/rng.ts"
import {
  beamDivisors,
  isFieldValue,
  MAX_BEAM,
  MIN_BEAM,
  phaseOffset,
  resonates,
  tuneLattice,
  usableCoreValue,
  validBeamCount,
} from "../sim/lattice.ts"

test("THE KILL RULE: a beam resonates with a value if and only if it divides it", () => {
  for (let beam = MIN_BEAM; beam <= MAX_BEAM; beam++) {
    for (let value = 1; value <= 1200; value++) {
      assert.equal(
        resonates(beam, value),
        value % beam === 0,
        `resonates(${beam}, ${value}) disagreed with divisibility`,
      )
    }
  }
})

test("resonance is closed against the values a malformed item could produce", () => {
  for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, -6, 0, 4.5]) {
    assert.equal(resonates(3, bad), false, `resonates(3, ${bad}) must be false`)
    assert.equal(resonates(bad, 12), false, `resonates(${bad}, 12) must be false`)
  }
  // …and a beam below the floor is never a beam, however divisible it looks.
  assert.equal(resonates(1, 7), false)
})

test("phase is zero exactly when the beam divides — the sound and the rule agree", () => {
  for (let beam = MIN_BEAM; beam <= MAX_BEAM; beam++) {
    for (let value = 1; value <= 900; value++) {
      const zero = phaseOffset(beam, value) === 0
      assert.equal(
        zero,
        resonates(beam, value),
        `phase and kill rule disagreed at beam ${beam}, value ${value}`,
      )
    }
  }
})

test("phase stays inside a half turn either way, so the beat rate is bounded", () => {
  for (let beam = MIN_BEAM; beam <= MAX_BEAM; beam++) {
    for (let value = 1; value <= 900; value++) {
      const p = phaseOffset(beam, value)
      assert.ok(p > -0.5 && p <= 0.5, `phase ${p} out of range at ${beam}/${value}`)
    }
  }
})

test("a value one either side of a multiple reads as nearly locked, from both sides", () => {
  // 83 and 85 are each one away from 84, and the phase is circular, so both
  // must be within a twelfth of a turn of zero. This is the near-miss a child
  // has to feel, and it is why the ear narrows the field without settling it.
  assert.ok(Math.abs(phaseOffset(12, 85)) <= 1 / 12 + 1e-12)
  assert.ok(Math.abs(phaseOffset(12, 83)) <= 1 / 12 + 1e-12)
  assert.equal(phaseOffset(12, 84), 0)
})

test("beamDivisors lists exactly the beams that divide", () => {
  assert.deepEqual(beamDivisors(84), [2, 3, 4, 6, 7, 12])
  assert.deepEqual(beamDivisors(85), [5])
  assert.deepEqual(beamDivisors(83), [])
  assert.deepEqual(beamDivisors(169), [])
  assert.deepEqual(beamDivisors(0), [])
  assert.deepEqual(beamDivisors(-12), [])
  for (let n = 1; n <= 600; n++) {
    for (const d of beamDivisors(n)) assert.equal(n % d, 0)
  }
})

test("validBeamCount counts what resonates and nothing else", () => {
  const beams = [3, 4, 5, 7, 9]
  assert.equal(validBeamCount(beams, 84), 3) // 3, 4, 7
  assert.equal(validBeamCount(beams, 35), 2) // 5, 7
  assert.equal(validBeamCount(beams, 11), 0)
})

test("a tuned lattice can always kill everything it was tuned for", () => {
  const rng = new Rng(0x1a771ce)
  for (let trial = 0; trial < 4000; trial++) {
    const n = 1 + Math.floor(rng.next() * 4)
    const required: number[] = []
    for (let i = 0; i < n; i++) {
      // Anything with a divisor in range, including the small primes that can
      // only be killed from their own beam — the tuner must place all of them.
      let v = rng.int(2, 999)
      while (beamDivisors(v).length === 0) v = rng.int(2, 999)
      required.push(v)
    }
    const beams = tuneLattice(required, 5, () => rng.next())
    assert.equal(beams.length, 5)
    assert.equal(new Set(beams).size, 5, "beams must be distinct")
    for (let i = 1; i < beams.length; i++) {
      assert.ok((beams[i] as number) > (beams[i - 1] as number), "beams must be ascending")
    }
    for (const b of beams) {
      assert.ok(b >= MIN_BEAM && b <= MAX_BEAM, `beam ${b} is outside the readable range`)
    }
    for (const v of required) {
      assert.ok(
        beams.some((b) => resonates(b, v)),
        `lattice ${beams.join(",")} cannot kill ${v}`,
      )
    }
  }
})

test("a beam is never labelled with a number that is on a hull", () => {
  // Otherwise a child matches two glyphs instead of dividing.
  const rng = new Rng(0x9a771ce)
  for (let trial = 0; trial < 3000; trial++) {
    const required = [rng.int(2, 12), rng.int(2, 12) * 2, rng.int(4, 240)].filter(
      (v) => beamDivisors(v).length > 0,
    )
    if (required.length === 0) continue
    const beams = tuneLattice(required, 5, () => rng.next())
    for (const v of required) {
      if (!usableCoreValue(v)) continue
      assert.ok(!beams.includes(v), `beam ${v} printed a hull value back at the child`)
    }
  }
})

test("a re-tune keeps the candidates killable and still hides their numbers", () => {
  // This is the shape `mount.retune()` calls with: the wave's candidates first,
  // then whatever ordinary automata happen to be in the air. The candidates must
  // survive the competition for beams — the answer above all — and none of them
  // may end up printed on a beam label.
  const rng = new Rng(0x5e7)
  for (let trial = 0; trial < 3000; trial++) {
    const candidates: number[] = []
    while (candidates.length < 1 + Math.floor(rng.next() * 4)) {
      const v = rng.int(4, 999)
      if (usableCoreValue(v) && !candidates.includes(v)) candidates.push(v)
    }
    // Ordinary automata are always `beam × multiplier`, so always composite.
    const live: number[] = []
    for (let i = 0; i < 8; i++) live.push(rng.int(2, 12) * rng.int(2, 15))

    const beams = tuneLattice([...candidates, ...live], 5, () => rng.next())
    assert.equal(beams.length, 5)
    for (const c of candidates) {
      assert.ok(
        beams.some((b) => resonates(b, c)),
        `re-tuned lattice ${beams.join(",")} cannot kill candidate ${c}`,
      )
      assert.ok(!beams.includes(c), `beam ${c} printed a candidate back at the child`)
    }
  }
})

test("the tuner is deterministic for a seed", () => {
  const a = tuneLattice([84, 35], 5, () => new Rng(7).next())
  const b = tuneLattice([84, 35], 5, () => new Rng(7).next())
  assert.deepEqual(a, b)
})

test("usableCoreValue rejects exactly what cannot be put on a readable lattice", () => {
  for (const prime of [83, 97, 101, 211, 997]) {
    assert.equal(usableCoreValue(prime), false, `${prime} is prime and has no beam`)
  }
  for (const stubborn of [169, 221, 289]) {
    assert.equal(usableCoreValue(stubborn), false, `${stubborn} has no divisor under 13`)
  }
  for (const fine of [84, 85, 100, 462, 918]) {
    assert.equal(usableCoreValue(fine), true, `${fine} should be usable`)
  }
  for (const tiny of [0, 1, 2, 3, -8, 4.5]) {
    assert.equal(usableCoreValue(tiny), false, `${tiny} is not a usable core`)
  }
  // The property the definition exists for: usable ⟹ killable, and by a beam
  // strictly smaller than the value, so the label never prints the answer.
  for (let n = 0; n <= 3000; n++) {
    if (!usableCoreValue(n)) continue
    const d = beamDivisors(n)
    assert.ok(d.length > 0)
    assert.ok((d[0] as number) < n)
  }
})

test("isFieldValue admits only legible, killable numbers", () => {
  const beams = [3, 4, 5, 7, 9]
  assert.equal(isFieldValue(beams, 84), true)
  assert.equal(isFieldValue(beams, 11), false, "nothing on this lattice divides 11")
  assert.equal(isFieldValue(beams, 1), false)
  assert.equal(isFieldValue(beams, 1008), false, "four digits cannot be read on a moving hull")
  assert.equal(isFieldValue(beams, 4.5), false)
})
