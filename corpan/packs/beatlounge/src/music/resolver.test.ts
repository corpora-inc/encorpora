/**
 * beatlounge — global harmony resolver tests.
 *
 * Proves both editor modes resolve to the SAME active-pitch shape, that
 * quantize/inHarmony/detune are exact, and that a doc with NO harmony field
 * (persisted pre-harmony) resolves to the C-major default.
 */

import { describe, expect, it } from "vitest"
import { createDefaultDoc, type BeatloungeDoc, type Harmony } from "../model/document"
import { reduce } from "../model/reduce"
import { PPQ } from "../model/timing"
import {
  activeMidiInRange,
  activePitches,
  chordAt,
  detuneForMidi,
  harmonyAt,
  impliedScalePcs,
  inHarmony,
  quantizeToHarmony,
} from "./resolver"

const doc0 = (): BeatloungeDoc => createDefaultDoc(0)

describe("resolver — modal mode", () => {
  it("default doc resolves to C major (Ionian, 12-TET)", () => {
    const ap = activePitches(doc0(), 0)
    expect(ap.tonicPc).toBe(0)
    expect(ap.pcs).toEqual([0, 2, 4, 5, 7, 9, 11])
    expect(ap.cents).toEqual([0, 200, 400, 500, 700, 900, 1100])
  })

  it("follows a tonic change (D major pcs)", () => {
    const d = reduce(doc0(), { t: "setTonic", pc: 2 })
    const ap = activePitches(d, 0)
    expect(ap.tonicPc).toBe(2)
    // D major: D E F# G A B C#
    expect(ap.pcs.sort((a, b) => a - b)).toEqual([1, 2, 4, 6, 7, 9, 11])
  })

  it("follows a scale (mode) change — A aeolian = natural minor", () => {
    let d = reduce(doc0(), { t: "setTonic", pc: 9 }) // A
    d = reduce(d, { t: "setScale", family: "western", id: "western.aeolian" })
    const ap = activePitches(d, 0)
    // A natural minor: A B C D E F G
    expect(ap.pcs.sort((a, b) => a - b)).toEqual([0, 2, 4, 5, 7, 9, 11])
  })

  it("chordAt is null in modal mode", () => {
    expect(chordAt(doc0(), 0)).toBeNull()
  })

  it("inHarmony / quantizeToHarmony lock to the scale", () => {
    const d = doc0() // C major
    expect(inHarmony(60, d, 0)).toBe(true) // C
    expect(inHarmony(61, d, 0)).toBe(false) // C#
    // C# quantizes to the nearest scale tone (C, tie resolves down)
    expect(quantizeToHarmony(61, d, 0)).toBe(60)
    // F# (66) is not in C major; nearest down is F (65)
    expect(quantizeToHarmony(66, d, 0)).toBe(65)
  })

  it("activeMidiInRange draws only scale frets", () => {
    const d = doc0()
    const frets = activeMidiInRange(d, 0, 60, 72)
    expect(frets).toEqual([60, 62, 64, 65, 67, 69, 71, 72])
  })
})

describe("resolver — chordal mode (implied scale)", () => {
  /** C major progression: Cmaj7 → Dm7 → G7 → Cmaj7 unions to C major. */
  const chordalDoc = (): BeatloungeDoc => {
    let d = reduce(doc0(), { t: "setHarmonyMode", mode: "chordal" })
    d = reduce(d, {
      t: "setProgression",
      chords: [
        { tick: 0, symbol: "Cmaj7" },
        { tick: PPQ * 4, symbol: "Dm7" },
        { tick: PPQ * 8, symbol: "G7" },
        { tick: PPQ * 12, symbol: "Cmaj7" },
      ],
    })
    return d
  }

  it("implied scale = union of all chord tones (C major)", () => {
    const d = chordalDoc()
    const pcs = impliedScalePcs(d.harmony as Harmony)
    // Cmaj7 {0,4,7,11} ∪ Dm7 {2,5,9,0} ∪ G7 {7,11,2,5} = {0,2,4,5,7,9,11}
    expect(pcs).toEqual([0, 2, 4, 5, 7, 9, 11])
  })

  it("both modes resolve activePitches to the SAME C-major set", () => {
    const modal = activePitches(doc0(), 0).pcs
    const chordal = activePitches(chordalDoc(), 0).pcs
    expect(chordal).toEqual(modal)
  })

  it("chordAt returns the chord-of-the-moment (sustains until next)", () => {
    const d = chordalDoc()
    expect(chordAt(d, 0)?.symbol).toBe("Cmaj7")
    expect(chordAt(d, PPQ * 2)?.symbol).toBe("Cmaj7") // still Cmaj7 mid-bar
    expect(chordAt(d, PPQ * 4)?.symbol).toBe("Dm7")
    expect(chordAt(d, PPQ * 9)?.symbol).toBe("G7")
    expect(chordAt(d, PPQ * 100)?.symbol).toBe("Cmaj7") // last sustains
  })

  it("harmonyAt exposes chord + active set together", () => {
    const at = harmonyAt(chordalDoc(), PPQ * 4)
    expect(at.mode).toBe("chordal")
    expect(at.chord?.root).toBe(2) // D
    expect(at.active.pcs).toEqual([0, 2, 4, 5, 7, 9, 11])
  })

  it("a crazy/chromatic progression unions to a wide palette", () => {
    let d = reduce(doc0(), { t: "setHarmonyMode", mode: "chordal" })
    d = reduce(d, {
      t: "setProgression",
      chords: [
        { tick: 0, symbol: "C" }, // 0 4 7
        { tick: PPQ, symbol: "Db" }, // 1 5 8
        { tick: PPQ * 2, symbol: "Ebaug" }, // 3 7 11
      ],
    })
    const pcs = impliedScalePcs(d.harmony as Harmony)
    expect(pcs).toEqual([0, 1, 3, 4, 5, 7, 8, 11])
    expect(pcs.length).toBeGreaterThan(7) // wider than a 7-note scale — intended
  })

  it("empty chordal progression ⇒ empty set; quantize falls back to input", () => {
    const d = reduce(doc0(), { t: "setHarmonyMode", mode: "chordal" })
    expect(activePitches(d, 0).pcs).toEqual([])
    expect(inHarmony(60, d, 0)).toBe(false)
    expect(quantizeToHarmony(63, d, 0)).toBe(63)
  })
})

describe("resolver — tuning & detune (microtonal at the edge)", () => {
  it("detune is 0 in 12-TET (Western, equal12)", () => {
    const d = doc0()
    for (const m of [60, 62, 64, 67]) {
      expect(detuneForMidi(m, d, 0)).toBe(0)
    }
  })

  it("pythagorean tuning bends the major third sharp (~+7.8¢)", () => {
    let d = reduce(doc0(), { t: "setTuning", tuning: "pythagorean" })
    // E (MIDI 64) over a C tonic is the major third.
    const detune = detuneForMidi(64, d, 0)
    expect(detune).toBeCloseTo(7.82, 1)
    // The tonic itself never detunes.
    expect(detuneForMidi(60, d, 0)).toBeCloseTo(0, 5)
    void d
  })

  it("just tuning flattens the major third (~-13.7¢)", () => {
    const d = reduce(doc0(), { t: "setTuning", tuning: "just" })
    expect(detuneForMidi(64, d, 0)).toBeCloseTo(-13.69, 1)
  })

  it("maqam (neutral third) carries a real detune even in equal12", () => {
    let d = reduce(doc0(), { t: "setHarmonyMode", mode: "modal" })
    d = reduce(d, { t: "setScale", family: "maqam", id: "maqam.rast" })
    // Rast has a half-flat third (~350¢). MIDI 64 (E, the 12-TET major third,
    // 400¢) should bend DOWN toward the neutral third.
    const detune = detuneForMidi(64, d, 0)
    expect(detune).toBeLessThan(-20) // clearly flatter than 12-TET
  })

  it("chordal mode never detunes (chords are 12-TET)", () => {
    let d = reduce(doc0(), { t: "setHarmonyMode", mode: "chordal" })
    d = reduce(d, { t: "setProgression", chords: [{ tick: 0, symbol: "Cmaj7" }] })
    expect(detuneForMidi(64, d, 0)).toBe(0)
  })
})

describe("resolver — migration safety", () => {
  it("a doc with NO harmony field resolves to the C-major default", () => {
    const d = doc0()
    // Simulate a persisted pre-harmony doc.
    const legacy = { ...d, harmony: undefined } as BeatloungeDoc
    const ap = activePitches(legacy, 0)
    expect(ap.tonicPc).toBe(0)
    expect(ap.pcs).toEqual([0, 2, 4, 5, 7, 9, 11])
    expect(inHarmony(60, legacy, 0)).toBe(true)
    expect(chordAt(legacy, 0)).toBeNull()
  })
})
