import assert from "node:assert/strict"
import { test } from "node:test"

import {
  MIN_AFFINITY,
  divOfBeat,
  expectedNotes,
  grooveMatrix,
  grooveSlotBeats,
  metreWeight,
  modeAffinity,
} from "./groove.ts"
import { MODES } from "./modes.ts"
import { pickSoundscape, withTension, type Soundscape } from "./soundscape.ts"

const scapes = (n: number): Soundscape[] =>
  Array.from({ length: n }, (_, i) => pickSoundscape(i * 2654435761))

test("the slot grid is the union of the subdivisions, in order, no duplicates", () => {
  assert.deepEqual(grooveSlotBeats(4, [1]), [0, 1, 2, 3])
  assert.deepEqual(grooveSlotBeats(4, [1, 2]), [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5])
  const trip = grooveSlotBeats(4, [1, 3])
  assert.equal(trip.length, 12, "quarters inside triplets is twelve slots, not sixteen")
  assert.equal(new Set(trip).size, trip.length, "a slot must not appear twice")
  for (let i = 1; i < trip.length; i++) assert.ok(trip[i]! > trip[i - 1]!, "slots must ascend")
  // Eighths and triplets together: 0, 1/3, 1/2, 2/3 in every beat — four
  // instants, not the eight a naive 2×3 grid would give.
  assert.equal(grooveSlotBeats(4, [1, 2, 3]).length, 16)
  assert.equal(grooveSlotBeats(4, [1, 2, 3, 4]).length, 24)
})

test("`div` names the coarsest grid an instant lands on", () => {
  assert.equal(divOfBeat(0, [1, 2, 4]), 1)
  assert.equal(divOfBeat(0.5, [1, 2, 4]), 2)
  assert.equal(divOfBeat(0.25, [1, 2, 4]), 4)
  assert.equal(divOfBeat(1 / 3, [1, 3]), 3)
})

test("metre is the bar's own shape: downbeat, halfway, beats, then decoration", () => {
  const w = (b: number, d: number): number => metreWeight(b, 4, d)
  assert.ok(w(0, 1) > w(2, 1), "the downbeat outranks the halfway point")
  assert.ok(w(2, 1) > w(1, 1), "the halfway point outranks the other beats")
  assert.ok(w(1, 1) > w(0.5, 2), "a beat outranks an eighth")
  assert.ok(w(0.5, 2) > w(0.25, 4), "an eighth outranks a sixteenth")
})

test("a mode colours the bar but can never delete a slot", () => {
  for (const scape of scapes(40)) {
    for (const beat of grooveSlotBeats(4, [1, 2, 3, 4])) {
      const a = modeAffinity(scape, beat, 4)
      assert.ok(a >= MIN_AFFINITY, `${scape.modeId} at ${beat} scored ${a}`)
      assert.ok(a <= 1, `${scape.modeId} at ${beat} scored ${a}`)
    }
  }
})

test("different modes want different instants — the mode is a real input", () => {
  const beats = grooveSlotBeats(4, [1, 2, 3, 4])
  const shapes = new Set<string>()
  for (const mode of MODES) {
    const scape: Soundscape = { modeId: mode.id, rootHz: 130.81, seed: 1, tension: 0 }
    shapes.add(beats.map((b) => modeAffinity(scape, b, 4).toFixed(3)).join(","))
  }
  // 38 modes; several are the same pitch collection under two names (Bilawal is
  // Ionian, Kafi is Dorian), so this is deliberately well under 38.
  assert.ok(shapes.size >= 20, `only ${shapes.size} distinct affinity profiles across 38 modes`)
})

test("density means expected notes per bar, to within rounding", () => {
  for (const scape of scapes(12)) {
    for (const divs of [[1], [1, 2], [1, 3], [1, 2, 4], [1, 2, 3, 4]]) {
      for (const density of [0.2, 0.35, 0.5, 0.75]) {
        const m = grooveMatrix(scape, { beatsPerBar: 4, divs, density })
        // The downbeat is a floor under the budget; above it the number is exact.
        const want = Math.max(1, density * m.length)
        assert.ok(
          Math.abs(expectedNotes(m) - want) < 0.02,
          `${scape.modeId} divs=${divs} d=${density}: expected ${want.toFixed(2)}, got ${expectedNotes(m).toFixed(2)}`,
        )
      }
    }
  }
})

test("a low density really is a sparse bar, on every mode", () => {
  for (const scape of scapes(20)) {
    const sparse = grooveMatrix(scape, { beatsPerBar: 4, divs: [1, 2], density: 0.25 })
    const full = grooveMatrix(scape, { beatsPerBar: 4, divs: [1, 2], density: 0.7 })
    assert.ok(expectedNotes(sparse) < 2.4, `${scape.modeId}: ${expectedNotes(sparse)}`)
    assert.ok(expectedNotes(full) > expectedNotes(sparse) + 2, `${scape.modeId} did not fill up`)
  }
})

test("the downbeat is a certainty and nothing else is", () => {
  for (const scape of scapes(20)) {
    const m = grooveMatrix(scape, { beatsPerBar: 4, divs: [1, 2, 3], density: 0.9 })
    assert.equal(m[0]!.beat, 0)
    assert.equal(m[0]!.p, 1)
    for (const s of m.slice(1)) assert.ok(s.p <= 0.95 + 1e-9, `slot ${s.beat} is a certainty`)
  }
})

test("density 0 is still a bar a child can find", () => {
  const m = grooveMatrix(pickSoundscape(7), { beatsPerBar: 4, divs: [1, 2], density: 0 })
  assert.equal(m[0]!.p, 1)
  assert.ok(expectedNotes(m) <= 1 + 1e-9, "an empty bar means the downbeat and nothing else")
})

test("the matrix is a pure function of the soundscape and the spec", () => {
  const scape = pickSoundscape(99)
  const spec = { beatsPerBar: 4, divs: [1, 2, 3], density: 0.4 }
  assert.deepEqual(grooveMatrix(scape, spec), grooveMatrix(scape, spec))
})

test("tension leans on the colour degree without spending the density budget", () => {
  let moved = 0
  for (const scape of scapes(24)) {
    const spec = { beatsPerBar: 4, divs: [1, 2, 4], density: 0.4 }
    const calm = grooveMatrix(withTension(scape, 0), spec)
    const wound = grooveMatrix(withTension(scape, 1), spec)
    assert.ok(
      Math.abs(expectedNotes(calm) - expectedNotes(wound)) < 0.02,
      "tension must not make the bar fuller — that is what density is for",
    )
    if (calm.some((s, i) => Math.abs(s.p - wound[i]!.p) > 1e-6)) moved++
  }
  assert.ok(moved >= 20, `tension moved the shape in only ${moved} of 24 soundscapes`)
})

test("a malformed spec cannot produce a NaN probability", () => {
  const scape = pickSoundscape(3)
  for (const density of [Number.NaN, Infinity, -5, 12]) {
    const m = grooveMatrix(scape, { beatsPerBar: 4, divs: [1, 2], density })
    for (const s of m) assert.ok(Number.isFinite(s.p) && s.p >= 0 && s.p <= 1, `p=${s.p}`)
  }
  const empty = grooveMatrix(scape, { beatsPerBar: 4, divs: [], density: 0.5 })
  assert.equal(empty.length, 4, "no subdivisions at all still leaves the beats")
})
