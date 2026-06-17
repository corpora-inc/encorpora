/**
 * beatlounge — progression-notation parser tests. The comma-is-a-beat grammar,
 * forgiving whitespace/bar-lines, leading rests, round-trip render, and the
 * chordAtBeat lookup the composer relies on.
 */

import { describe, expect, it } from "vitest"
import {
  parseProgression,
  chordAtBeat,
  renderProgression,
  progressionFromChords,
} from "./progression"
import { parseChord } from "./harmony"

describe("parseProgression — the founder's notation", () => {
  it("commas ARE beats: the founder's headline example", () => {
    // "Dmin,,,,Gmin,,A7,," → Dmin(4) Gmin(2) A7(2)
    const p = parseProgression("Dmin,,,,Gmin,,A7,,")
    expect(p.chords.map((c) => c.token)).toEqual(["Dmin", "Gmin", "A7"])
    expect(p.chords.map((c) => c.beats)).toEqual([4, 2, 2])
    expect(p.chords[0].startBeat).toBe(0)
    expect(p.chords[1].startBeat).toBe(4)
    expect(p.chords[2].startBeat).toBe(6)
    expect(p.totalBeats).toBe(8)
  })

  it("parses a full progression with space + comma mixing", () => {
    const p = parseProgression("D,,A,,D,,,,G,,,,A,,,,D,,,,Bmin,,,,Emin,,,,Bmin")
    // D A D G A D Bmin Emin Bmin = 9 chords
    expect(p.chords).toHaveLength(9)
    expect(p.chords[0].token).toBe("D")
    expect(p.chords[0].beats).toBe(2) // D + two commas
    expect(p.chords[2].beats).toBe(4) // D + four commas
    expect(p.chords[8].token).toBe("Bmin")
    expect(p.chords[8].beats).toBe(1) // trailing chord, no commas → implied 1
  })

  it("each parsed chord carries a real Chord with pcs", () => {
    const p = parseProgression("Cmaj7,,,Am,,,")
    expect(p.chords[0].chord.pcs).toEqual([0, 4, 7, 11])
    expect(p.chords[0].beats).toBe(3)
    expect(p.chords[1].chord.root).toBe(9)
    expect(p.chords[1].chord.quality).toBe("min")
  })

  it("space-separated chords each get one beat", () => {
    const p = parseProgression("C F G")
    expect(p.chords.map((c) => c.beats)).toEqual([1, 1, 1])
    expect(p.totalBeats).toBe(3)
  })

  it("ignores bar lines and newlines (cosmetic)", () => {
    const p = parseProgression("C,,,, | G,,,, |\n Am,,,, F,,,,")
    expect(p.chords.map((c) => c.token)).toEqual(["C", "G", "Am", "F"])
    expect(p.chords.map((c) => c.beats)).toEqual([4, 4, 4, 4])
    expect(p.totalBeats).toBe(16)
  })

  it("a leading comma run is a rest before the first chord", () => {
    const p = parseProgression(",,C,,,")
    expect(p.leadRest).toBe(2)
    expect(p.chords[0].startBeat).toBe(2)
    expect(p.chords[0].beats).toBe(3) // three commas after C
    expect(p.totalBeats).toBe(5)
  })

  it("empty / whitespace input → empty progression", () => {
    expect(parseProgression("").chords).toHaveLength(0)
    expect(parseProgression("   \n  ").chords).toHaveLength(0)
    expect(parseProgression("").totalBeats).toBe(0)
  })

  it("forgives a junk token (degrades to C major, never crashes)", () => {
    const p = parseProgression("C,,,,???,,,,")
    expect(p.chords).toHaveLength(2)
    expect(p.chords[1].chord.pcs).toEqual([0, 4, 7]) // junk → C major triad
  })
})

describe("chordAtBeat", () => {
  it("returns the chord sounding at a beat, null in rests/past-end", () => {
    const p = parseProgression("Dmin,,,,Gmin,,") // Dmin(4) Gmin(2) → totalBeats 6
    expect(chordAtBeat(p, 0)!.token).toBe("Dmin")
    expect(chordAtBeat(p, 3)!.token).toBe("Dmin")
    expect(chordAtBeat(p, 4)!.token).toBe("Gmin")
    expect(chordAtBeat(p, 5)!.token).toBe("Gmin")
    expect(chordAtBeat(p, 6)).toBeNull() // past the end
  })
  it("null inside a leading rest", () => {
    const p = parseProgression(",,C,,")
    expect(chordAtBeat(p, 0)).toBeNull()
    expect(chordAtBeat(p, 2)!.token).toBe("C")
  })
})

describe("renderProgression (round-trip)", () => {
  it("renders chord + (beats-1) commas, round-trips beat counts", () => {
    const src = "Dmin,,,,Gmin,,A7,,"
    const p = parseProgression(src)
    const out = renderProgression(p)
    const p2 = parseProgression(out)
    expect(p2.chords.map((c) => c.beats)).toEqual(p.chords.map((c) => c.beats))
    expect(p2.chords.map((c) => c.token)).toEqual(p.chords.map((c) => c.token))
  })
  it("preserves a leading rest", () => {
    const p = parseProgression(",,C,,,")
    const out = renderProgression(p)
    expect(out.startsWith(",,")).toBe(true)
    expect(parseProgression(out).leadRest).toBe(2)
  })
})

describe("progressionFromChords (generator path)", () => {
  it("builds timed chords with running start beats", () => {
    const chords = [
      { chord: parseChord("C")!, beats: 4 },
      { chord: parseChord("G")!, beats: 4 },
      { chord: parseChord("Am")!, beats: 2 },
    ]
    const p = progressionFromChords(chords)
    expect(p.chords[0].startBeat).toBe(0)
    expect(p.chords[1].startBeat).toBe(4)
    expect(p.chords[2].startBeat).toBe(8)
    expect(p.totalBeats).toBe(10)
  })
  it("honours a leading rest offset", () => {
    const p = progressionFromChords([{ chord: parseChord("C")!, beats: 4 }], 2)
    expect(p.chords[0].startBeat).toBe(2)
    expect(p.leadRest).toBe(2)
    expect(p.totalBeats).toBe(6)
  })
})
