/**
 * beatlounge — harmony core tests. Chord-symbol parsing, chord→pitch sets,
 * scales/modes, diatonic triads, and the voice-leading primitives.
 */

import { describe, expect, it } from "vitest"
import {
  parseNoteName,
  parseChord,
  parseQuality,
  spellPc,
  scalePcs,
  inScale,
  snapToScale,
  diatonicTriad,
  diatonicTriads,
  scaleDegreeOf,
  nearestPcTo,
  chordName,
  chordMidiTones,
  toPc,
  SCALES,
  CHORD_INTERVALS,
  QUALITY_SCALE,
} from "./harmony"

describe("parseNoteName", () => {
  it("parses naturals", () => {
    expect(parseNoteName("C")).toBe(0)
    expect(parseNoteName("E")).toBe(4)
    expect(parseNoteName("G")).toBe(7)
    expect(parseNoteName("B")).toBe(11)
  })
  it("parses accidentals (sharps + flats, double)", () => {
    expect(parseNoteName("C#")).toBe(1)
    expect(parseNoteName("Db")).toBe(1)
    expect(parseNoteName("F#")).toBe(6)
    expect(parseNoteName("Bb")).toBe(10)
    expect(parseNoteName("Cb")).toBe(11) // wraps below C
    expect(parseNoteName("B#")).toBe(0) // wraps above B
    expect(parseNoteName("G##")).toBe(9)
  })
  it("is case-insensitive on the letter and stops at the quality", () => {
    expect(parseNoteName("d")).toBe(2)
    expect(parseNoteName("Dm7")).toBe(2) // stops after D
  })
  it("returns null for junk", () => {
    expect(parseNoteName("")).toBeNull()
    expect(parseNoteName("H")).toBeNull()
  })
})

describe("parseQuality", () => {
  it("maps common suffixes to canonical qualities", () => {
    expect(parseQuality("")).toBe("maj")
    expect(parseQuality("maj")).toBe("maj")
    expect(parseQuality("m")).toBe("min")
    expect(parseQuality("min")).toBe("min")
    expect(parseQuality("-")).toBe("min")
    expect(parseQuality("7")).toBe("dom7")
    expect(parseQuality("maj7")).toBe("maj7")
    expect(parseQuality("M7")).toBe("maj7")
    expect(parseQuality("m7")).toBe("min7")
    expect(parseQuality("dim")).toBe("dim")
    expect(parseQuality("dim7")).toBe("dim7")
    expect(parseQuality("m7b5")).toBe("min7b5")
    expect(parseQuality("aug")).toBe("aug")
    expect(parseQuality("sus2")).toBe("sus2")
    expect(parseQuality("sus4")).toBe("sus4")
    expect(parseQuality("sus")).toBe("sus4")
    expect(parseQuality("6")).toBe("maj6")
    expect(parseQuality("m6")).toBe("min6")
    expect(parseQuality("9")).toBe("dom9")
    expect(parseQuality("maj9")).toBe("maj9")
    expect(parseQuality("add9")).toBe("add9")
    expect(parseQuality("5")).toBe("five")
  })
  it("strips a slash bass + degrades unknowns to maj", () => {
    expect(parseQuality("/G")).toBe("maj")
    expect(parseQuality("wat")).toBe("maj")
  })
})

describe("parseChord", () => {
  it("Dmin7 → D minor seventh with correct pcs", () => {
    const c = parseChord("Dmin7")!
    expect(c.root).toBe(2)
    expect(c.quality).toBe("min7")
    // D F A C
    expect(c.pcs).toEqual([2, 5, 9, 0])
  })
  it("G7 → G dominant seventh", () => {
    const c = parseChord("G7")!
    expect(c.root).toBe(7)
    expect(c.quality).toBe("dom7")
    // G B D F
    expect(c.pcs).toEqual([7, 11, 2, 5])
  })
  it("Cmaj7 and a bare C triad", () => {
    expect(parseChord("Cmaj7")!.pcs).toEqual([0, 4, 7, 11])
    expect(parseChord("C")!.pcs).toEqual([0, 4, 7])
  })
  it("F#m7b5 (half-diminished)", () => {
    const c = parseChord("F#m7b5")!
    expect(c.root).toBe(6)
    expect(c.quality).toBe("min7b5")
    expect(c.pcs).toEqual([6, 9, 0, 4])
  })
  it("handles a slash bass by ignoring the bass for pcs", () => {
    const c = parseChord("G/B")!
    expect(c.root).toBe(7)
    expect(c.quality).toBe("maj")
  })
  it("forgives garbage → C major triad, never null for non-empty", () => {
    const c = parseChord("???")!
    expect(c.pcs).toEqual([0, 4, 7])
    expect(parseChord("")).toBeNull()
  })
  it("attaches a fitting scale per quality", () => {
    expect(parseChord("G7")!.scale).toBe("mixolydian")
    expect(parseChord("Dm7")!.scale).toBe("dorian")
    expect(parseChord("Cmaj7")!.scale).toBe("major")
  })
})

describe("scales", () => {
  it("every scale starts on the tonic and is ascending pcs", () => {
    for (const name of Object.keys(SCALES) as (keyof typeof SCALES)[]) {
      const degs = SCALES[name]
      expect(degs[0]).toBe(0)
      for (let i = 1; i < degs.length; i++) expect(degs[i]).toBeGreaterThan(degs[i - 1])
    }
  })
  it("scalePcs roots correctly + inScale agrees", () => {
    // D dorian = D E F G A B C
    expect(scalePcs(2, "dorian")).toEqual([2, 4, 5, 7, 9, 11, 0])
    expect(inScale(5, 2, "dorian")).toBe(true) // F is in D dorian
    expect(inScale(6, 2, "dorian")).toBe(false) // F# is not
  })
  it("snapToScale snaps out-of-scale pitches in, leaves in-scale alone", () => {
    // C major: 61 (C#) should snap to 60 or 62.
    const snapped = snapToScale(61, 0, "major")
    expect([60, 62]).toContain(snapped)
    expect(snapToScale(64, 0, "major")).toBe(64) // E is in C major
  })
})

describe("diatonic", () => {
  it("the seven triads of C major are I ii iii IV V vi vii°", () => {
    const tris = diatonicTriads(0, "major")
    const quals = tris.map((t) => t.quality)
    expect(quals).toEqual(["maj", "min", "min", "maj", "maj", "min", "dim"])
    expect(tris[0].root).toBe(0) // C
    expect(tris[4].root).toBe(7) // G
  })
  it("diatonicTriad wraps degree + roots correctly in A minor", () => {
    // A natural minor i = Am.
    const i = diatonicTriad(0, 9, "minor")
    expect(i.root).toBe(9)
    expect(i.quality).toBe("min")
  })
  it("scaleDegreeOf identifies degrees", () => {
    expect(scaleDegreeOf(7, 0, "major")).toBe(4) // G is degree 5 (index 4) of C major
    expect(scaleDegreeOf(6, 0, "major")).toBe(-1) // F# not in C major
  })
})

describe("voice-leading primitives", () => {
  it("nearestPcTo finds the closest octave of a pitch class", () => {
    expect(nearestPcTo(0, 60)).toBe(60) // C nearest to C4 is C4
    expect(nearestPcTo(11, 60)).toBe(59) // B nearest to C4 is B3 (down 1)
    expect(nearestPcTo(1, 60)).toBe(61) // C# nearest to C4 is C#4 (up 1)
    expect(Math.abs(nearestPcTo(6, 60) - 60)).toBeLessThanOrEqual(6)
  })
  it("chordMidiTones builds ascending absolute tones", () => {
    const c = parseChord("C")!
    expect(chordMidiTones(c, 48)).toEqual([48, 52, 55]) // C3 E3 G3
  })
})

describe("display", () => {
  it("chordName spells roots + suffixes", () => {
    expect(chordName(parseChord("Dm7")!)).toBe("Dm7")
    expect(chordName(parseChord("G7")!)).toBe("G7")
    expect(chordName(parseChord("C")!)).toBe("C")
    expect(spellPc(1)).toBe("C#")
    expect(spellPc(1, true)).toBe("Db")
  })
})

describe("catalog invariants", () => {
  it("every quality has intervals starting on the root + a fitting scale", () => {
    for (const q of Object.keys(CHORD_INTERVALS) as (keyof typeof CHORD_INTERVALS)[]) {
      expect(CHORD_INTERVALS[q][0]).toBe(0)
      expect(QUALITY_SCALE[q]).toBeDefined()
    }
  })
  it("toPc normalizes negatives", () => {
    expect(toPc(-1)).toBe(11)
    expect(toPc(13)).toBe(1)
  })
})
