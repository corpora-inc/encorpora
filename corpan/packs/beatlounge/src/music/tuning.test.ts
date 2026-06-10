import { describe, expect, it } from "vitest"
import {
  centsBetween,
  centsFromRatio,
  centsToRatio,
  centsToRatioApprox,
  detuneCentsForMidi,
  DEFAULT_REFERENCE,
  equal12,
  freqForMidiInMode,
  freqFromCents,
  freqToMidi,
  just,
  midiToFreq,
  PYTHAGOREAN_COMMA,
  pythagorean,
  quantizeToScale,
  ratioToCents,
  SYNTONIC_COMMA,
  type ModeCents,
} from "./tuning"

describe("centsFromRatio — textbook interval values", () => {
  it("octave 2/1 = 1200¢, fifth 3/2 = 701.955¢", () => {
    expect(centsFromRatio(2, 1)).toBeCloseTo(1200, 6)
    expect(centsFromRatio(3, 2)).toBeCloseTo(701.955, 3)
    expect(ratioToCents(1.5)).toBeCloseTo(701.955, 3)
  })
  it("just major third 5/4 = 386.314¢", () => {
    expect(centsFromRatio(5, 4)).toBeCloseTo(386.314, 3)
  })
  it("Pythagorean major third 81/64 = 407.820¢", () => {
    expect(centsFromRatio(81, 64)).toBeCloseTo(407.820, 3)
  })
  it("12-TET semitone (2^(1/12)) = 100¢", () => {
    expect(centsFromRatio(Math.pow(2, 1 / 12))).toBeCloseTo(100, 6)
  })
  it("single-arg and two-arg overloads agree", () => {
    expect(centsFromRatio(1.25)).toBeCloseTo(centsFromRatio(5, 4), 9)
  })
  it("throws on a non-positive ratio (noisy, not silent)", () => {
    expect(() => centsFromRatio(0)).toThrow()
    expect(() => centsFromRatio(-3, 2)).toThrow()
  })
})

describe("the commas", () => {
  it("Pythagorean comma = 3¹²/2¹⁹ ≈ 23.460¢", () => {
    expect(PYTHAGOREAN_COMMA).toBeCloseTo(23.460, 3)
    // 12 fifths − 7 octaves
    expect(12 * centsFromRatio(3, 2) - 7 * 1200).toBeCloseTo(PYTHAGOREAN_COMMA, 6)
  })
  it("syntonic comma = 81/80 ≈ 21.506¢ (Pyth M3 − just M3)", () => {
    expect(SYNTONIC_COMMA).toBeCloseTo(21.506, 3)
    expect(centsFromRatio(81, 64) - centsFromRatio(5, 4)).toBeCloseTo(SYNTONIC_COMMA, 6)
  })
})

describe("cents ↔ ratio round-trips", () => {
  it("centsToRatio inverts centsFromRatio", () => {
    for (const [n, d] of [[3, 2], [5, 4], [81, 64], [9, 8], [15, 8]]) {
      expect(centsToRatio(centsFromRatio(n, d))).toBeCloseTo(n / d, 9)
    }
  })
  it("centsToRatioApprox finds the just third for 386.314¢", () => {
    const r = centsToRatioApprox(386.314)
    expect(r.num).toBe(5)
    expect(r.den).toBe(4)
    expect(Math.abs(r.errorCents)).toBeLessThan(0.01)
  })
  it("centsToRatioApprox finds 3/2 for the fifth and 2/1 for the octave", () => {
    expect(centsToRatioApprox(701.955)).toMatchObject({ num: 3, den: 2 })
    expect(centsToRatioApprox(1200)).toMatchObject({ num: 2, den: 1 })
  })
})

describe("frequency math", () => {
  it("A4 = 440 Hz at MIDI 69, middle C ≈ 261.626 Hz", () => {
    expect(midiToFreq(69)).toBeCloseTo(440, 9)
    expect(midiToFreq(60)).toBeCloseTo(261.6256, 3)
  })
  it("midiToFreq ↔ freqToMidi round-trip (incl. fractional MIDI)", () => {
    for (const m of [0, 21, 60, 69, 60.5, 71.3, 108]) {
      expect(freqToMidi(midiToFreq(m))).toBeCloseTo(m, 9)
    }
  })
  it("freqFromCents: +1200¢ doubles, centsBetween inverts", () => {
    expect(freqFromCents(1200, 100)).toBeCloseTo(200, 9)
    expect(centsBetween(100, 200)).toBeCloseTo(1200, 9)
    expect(centsBetween(440, midiToFreq(81))).toBeCloseTo(1200, 6) // A4→A5
  })
  it("a non-default reference (A4 = 415, Baroque) shifts pitch down", () => {
    const ref = { hz: 415, midi: 69 }
    expect(midiToFreq(69, ref)).toBeCloseTo(415, 9)
    expect(midiToFreq(60, ref)).toBeLessThan(midiToFreq(60, DEFAULT_REFERENCE))
  })
})

describe("TuningSystem axis", () => {
  it("equal12 is 100¢ per semitone", () => {
    expect(equal12.degreeToCents(0)).toBe(0)
    expect(equal12.degreeToCents(4)).toBe(400)
    expect(equal12.degreeToCents(12)).toBe(1200)
  })
  it("pythagorean reproduces 9/8, 81/64, 4/3, 3/2, 243/128", () => {
    expect(pythagorean.degreeToCents(2)).toBeCloseTo(203.910, 3) // 9/8
    expect(pythagorean.degreeToCents(4)).toBeCloseTo(407.820, 3) // 81/64
    expect(pythagorean.degreeToCents(5)).toBeCloseTo(498.045, 3) // 4/3
    expect(pythagorean.degreeToCents(7)).toBeCloseTo(701.955, 3) // 3/2
    expect(pythagorean.degreeToCents(11)).toBeCloseTo(1109.775, 3) // 243/128
    expect(pythagorean.degreeToCents(12)).toBeCloseTo(1200, 6)
  })
  it("just reproduces 9/8, 5/4, 4/3, 3/2, 5/3, 15/8", () => {
    expect(just.degreeToCents(2)).toBeCloseTo(203.910, 3)
    expect(just.degreeToCents(4)).toBeCloseTo(386.314, 3) // 5/4
    expect(just.degreeToCents(5)).toBeCloseTo(498.045, 3)
    expect(just.degreeToCents(7)).toBeCloseTo(701.955, 3)
    expect(just.degreeToCents(9)).toBeCloseTo(884.359, 3) // 5/3
    expect(just.degreeToCents(11)).toBeCloseTo(1088.269, 3) // 15/8
  })
  it("the three tunings DISAGREE on the major third (the audible point)", () => {
    expect(just.degreeToCents(4)).toBeLessThan(equal12.degreeToCents(4)) // 386 < 400
    expect(pythagorean.degreeToCents(4)).toBeGreaterThan(equal12.degreeToCents(4)) // 408 > 400
  })
})

describe("MIDI ↔ mode detune bridge", () => {
  // C major in 12-TET cents.
  const cMajor: ModeCents = { degrees: [0, 200, 400, 500, 700, 900, 1100] }

  it("12-TET mode + equal12 tuning ⇒ zero detune (authoring untouched)", () => {
    for (const midi of [60, 62, 64, 65, 67, 69, 71, 72]) {
      expect(detuneCentsForMidi(midi, cMajor, equal12, 60)).toBeCloseTo(0, 9)
    }
  })

  it("Pythagorean tuning detunes the major third sharp by +7.82¢", () => {
    // E (64) over tonic C (60): 12-TET 400¢ → Pythagorean 407.82¢.
    const d = detuneCentsForMidi(64, cMajor, pythagorean, 60)
    expect(d).toBeCloseTo(407.820 - 400, 2)
  })
  it("just tuning detunes the major third flat by −13.69¢", () => {
    const d = detuneCentsForMidi(64, cMajor, just, 60)
    expect(d).toBeCloseTo(386.314 - 400, 2)
  })

  it("a maqam neutral 3rd (355¢) detunes a played E (12-TET 400¢) by −45¢", () => {
    // Rast-like: a half-flat 3rd at 355¢. Playing MIDI E (the nearest key)
    // should bend down to 355 → detune −45¢. equal12 tuning keeps the exact
    // corpus cents (the maqam path).
    const rastLower: ModeCents = { degrees: [0, 204, 355, 498, 702, 906, 1057] }
    const d = detuneCentsForMidi(64, rastLower, equal12, 60)
    expect(d).toBeCloseTo(355 - 400, 1)
  })

  it("freqForMidiInMode bends E to the just third's exact Hz", () => {
    // C4 = 60. Just M3 above C4: C4hz * 5/4.
    const cHz = midiToFreq(60)
    const f = freqForMidiInMode(64, cMajor, just, 60)
    expect(f).toBeCloseTo(cHz * (5 / 4), 4)
  })
})

describe("quantizeToScale (fret/lock)", () => {
  const cMajor: ModeCents = { degrees: [0, 200, 400, 500, 700, 900, 1100] }
  it("snaps an off-scale cents value to the nearest degree", () => {
    expect(quantizeToScale(370, cMajor)).toBe(400) // nearer the M3 than the M2
    expect(quantizeToScale(260, cMajor)).toBe(200) // nearer the M2
    expect(quantizeToScale(0, cMajor)).toBe(0)
  })
  it("preserves register across octaves", () => {
    expect(quantizeToScale(1390, cMajor)).toBe(1400) // octave + M3
    expect(quantizeToScale(-50, cMajor)).toBe(0) // nearer the tonic than B below
    expect(quantizeToScale(-100, cMajor)).toBe(-100) // B below the tonic (in scale)
    expect(quantizeToScale(-1200, cMajor)).toBe(-1200) // octave below the tonic
  })
})
