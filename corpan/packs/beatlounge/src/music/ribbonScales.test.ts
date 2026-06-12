import { describe, expect, it } from "vitest"
import {
  A4_HZ,
  A4_MIDI,
  freqToMidi,
  isInScale,
  KEY_NAMES,
  midiToFreq,
  midiToX,
  modeLabel,
  noteLabel,
  octaveOf,
  pitchClass,
  ribbonFrets,
  scaleNotesInRange,
  SCALE_MODE_IDS,
  SCALE_MODES,
  snapToScale,
  xToFreq,
  xToMidi,
  xToScaleNote,
  type RibbonWindow,
} from "./ribbonScales"

const FULL: RibbonWindow = { lowMidi: 24, spanSemis: 96 } // ~8 octaves, C1..C9

describe("tuning", () => {
  it("A4 = 440 Hz and round-trips MIDI↔Hz", () => {
    expect(midiToFreq(A4_MIDI)).toBeCloseTo(A4_HZ, 6)
    expect(freqToMidi(A4_HZ)).toBeCloseTo(A4_MIDI, 6)
    for (const m of [0, 21, 48, 60, 69, 84, 108, 60.5, 71.3]) {
      expect(freqToMidi(midiToFreq(m))).toBeCloseTo(m, 6)
    }
  })

  it("middle C (60) is C4 ≈ 261.63 Hz", () => {
    expect(midiToFreq(60)).toBeCloseTo(261.6256, 3)
    expect(noteLabel(60)).toBe("C4")
    expect(octaveOf(60)).toBe(4)
  })

  it("an octave up doubles the frequency", () => {
    expect(midiToFreq(72) / midiToFreq(60)).toBeCloseTo(2, 9)
  })
})

describe("pitch-class + labels", () => {
  it("pitchClass wraps and handles negatives", () => {
    expect(pitchClass(60)).toBe(0)
    expect(pitchClass(61)).toBe(1)
    expect(pitchClass(59)).toBe(11)
    expect(pitchClass(-1)).toBe(11)
  })

  it("noteLabel matches the key names", () => {
    expect(noteLabel(69)).toBe("A4")
    expect(noteLabel(61)).toBe("C#4")
    expect(KEY_NAMES.length).toBe(12)
  })
})

describe("scale membership", () => {
  it("C major contains the white keys, excludes black", () => {
    for (const p of [60, 62, 64, 65, 67, 69, 71, 72]) {
      expect(isInScale(p, 0, "major")).toBe(true)
    }
    for (const p of [61, 63, 66, 68, 70]) {
      expect(isInScale(p, 0, "major")).toBe(false)
    }
  })

  it("is octave-agnostic and key-relative", () => {
    // A natural-minor = A, B, C, D, E, F, G (the white keys, rooted at A=9).
    for (const p of [69, 71, 72, 74, 76, 77, 79]) {
      expect(isInScale(p, 9, "natural-minor")).toBe(true)
    }
    expect(isInScale(70, 9, "natural-minor")).toBe(false) // A#
  })

  it("chromatic accepts every pitch", () => {
    for (let p = 60; p < 72; p++) expect(isInScale(p, 0, "chromatic")).toBe(true)
  })

  it("every mode is a sorted set of distinct degrees under 12", () => {
    for (const id of SCALE_MODE_IDS) {
      const degs = SCALE_MODES[id]
      expect(degs[0]).toBe(0)
      expect(new Set(degs).size).toBe(degs.length)
      expect(Math.max(...degs)).toBeLessThan(12)
      for (let i = 1; i < degs.length; i++) expect(degs[i]).toBeGreaterThan(degs[i - 1])
    }
  })

  it("modeLabel title-cases hyphenated ids", () => {
    expect(modeLabel("natural-minor")).toBe("Natural Minor")
    expect(modeLabel("major")).toBe("Major")
  })
})

describe("scaleNotesInRange", () => {
  it("lists exactly the in-scale notes, ascending, inclusive of bounds", () => {
    const notes = scaleNotesInRange(0, "major", 60, 72)
    expect(notes).toEqual([60, 62, 64, 65, 67, 69, 71, 72])
  })

  it("pentatonic over an octave has 5 + the top tonic", () => {
    const notes = scaleNotesInRange(0, "pentatonic", 60, 72)
    expect(notes).toEqual([60, 62, 64, 67, 69, 72])
  })

  it("every returned note is in-scale", () => {
    const notes = scaleNotesInRange(7, "dorian", 40, 90)
    for (const n of notes) expect(isInScale(n, 7, "dorian")).toBe(true)
  })
})

describe("snapToScale", () => {
  it("leaves in-scale notes untouched", () => {
    for (const p of [60, 62, 64, 65, 67]) {
      expect(snapToScale(p, 0, "major")).toBe(p)
    }
  })

  it("snaps an out-of-scale pitch to the nearest scale degree", () => {
    // C# (61) is 1 above C, 1 below D → tie resolves DOWN to C (60).
    expect(snapToScale(61, 0, "major")).toBe(60)
    // F# (66) sits between F(65) and G(67) → tie down to F.
    expect(snapToScale(66, 0, "major")).toBe(65)
  })

  it("snaps a fractional value to the nearest degree", () => {
    expect(snapToScale(64.4, 0, "major")).toBe(64) // ~E
    expect(snapToScale(63.9, 0, "major")).toBe(64) // rounds to 64=E
    expect(snapToScale(65.6, 0, "major")).toBe(65) // rounds to 66→snap F(65)
  })

  it("always yields an in-scale result for every mode", () => {
    for (const id of SCALE_MODE_IDS) {
      for (let m = 48; m <= 84; m += 0.5) {
        expect(isInScale(snapToScale(m, 3, id), 3, id)).toBe(true)
      }
    }
  })
})

describe("ribbon window mapping", () => {
  it("x=0 → low edge, x=1 → high edge (fretless, continuous)", () => {
    expect(xToMidi(0, FULL)).toBe(24)
    expect(xToMidi(1, FULL)).toBe(120)
    expect(xToMidi(0.5, FULL)).toBe(72)
  })

  it("clamps x outside [0,1]", () => {
    expect(xToMidi(-0.5, FULL)).toBe(24)
    expect(xToMidi(2, FULL)).toBe(120)
  })

  it("xToFreq agrees with midiToFreq at the mapped pitch", () => {
    expect(xToFreq(0.5, FULL)).toBeCloseTo(midiToFreq(72), 6)
  })

  it("midiToX is the inverse of xToMidi across the window", () => {
    for (const x of [0, 0.13, 0.5, 0.77, 1]) {
      expect(midiToX(xToMidi(x, FULL), FULL)).toBeCloseTo(x, 9)
    }
  })

  it("xToScaleNote stays in key across the whole sweep", () => {
    for (let i = 0; i <= 200; i++) {
      const x = i / 200
      const note = xToScaleNote(x, FULL, 2, "blues") // D blues
      expect(isInScale(note, 2, "blues")).toBe(true)
      expect(Number.isInteger(note)).toBe(true)
    }
  })

  it("a degenerate zero-span window maps everything to the low pitch", () => {
    const zero: RibbonWindow = { lowMidi: 60, spanSemis: 0 }
    expect(xToMidi(0.5, zero)).toBe(60)
    expect(midiToX(60, zero)).toBe(0)
  })
})

describe("ribbonFrets", () => {
  it("places one fret per in-scale note with a normalized x in [0,1]", () => {
    const win: RibbonWindow = { lowMidi: 60, spanSemis: 12 }
    const frets = ribbonFrets(win, 0, "major")
    expect(frets.map((f) => f.midi)).toEqual([60, 62, 64, 65, 67, 69, 71, 72])
    for (const f of frets) {
      expect(f.x).toBeGreaterThanOrEqual(0)
      expect(f.x).toBeLessThanOrEqual(1)
    }
    expect(frets[0].x).toBeCloseTo(0, 9)
    expect(frets[frets.length - 1].x).toBeCloseTo(1, 9)
  })

  it("flags the tonic frets and labels them", () => {
    const win: RibbonWindow = { lowMidi: 60, spanSemis: 12 }
    const frets = ribbonFrets(win, 0, "major")
    const tonics = frets.filter((f) => f.tonic)
    expect(tonics.map((f) => f.midi)).toEqual([60, 72])
    expect(tonics[0].label).toBe("C4")
  })

  it("respects a non-C key", () => {
    const win: RibbonWindow = { lowMidi: 65, spanSemis: 12 }
    const frets = ribbonFrets(win, 7, "major") // G major
    for (const f of frets) expect(isInScale(f.midi, 7, "major")).toBe(true)
    expect(frets.some((f) => f.tonic && f.midi === 67)).toBe(true) // G4
  })
})
