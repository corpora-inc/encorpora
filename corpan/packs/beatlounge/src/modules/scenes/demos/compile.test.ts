import { describe, expect, it } from "vitest"
import { compileDemo, validateDemo } from "./compile"
import { DEMO_SONGS } from "./index"
import type { DemoSongSpec } from "./types"
import { isFragmentTrack, isInstrumentTrack } from "../../../model/document"
import { PPQ } from "../../../model/timing"

describe("demo catalog — every shipped demo is valid + compiles", () => {
  it("has unique ids", () => {
    const ids = DEMO_SONGS.map((d) => d.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  for (const demo of DEMO_SONGS) {
    it(`"${demo.id}" validates and compiles`, () => {
      expect(validateDemo(demo)).toEqual([])
      const snap = compileDemo(demo)
      // A demo is content: it should put at least one note on the grid.
      const notes = snap.tracks.reduce(
        (n, t) => n + (isInstrumentTrack(t) ? t.notes.length : 0),
        0
      )
      expect(notes).toBeGreaterThan(0)
      // Always carries a Phrases strip, like the default doc.
      expect(snap.tracks.filter(isFragmentTrack).length).toBe(1)
      // Provenance is recorded.
      expect(demo.source.length).toBeGreaterThan(0)
    })
  }
})

const minimalSpec = (): DemoSongSpec => ({
  id: "t",
  name: "T",
  blurb: "b",
  source: "test",
  bpm: 120,
  meter: { numerator: 4, denominator: 4 },
  bars: 1,
  harmony: { tonic: 0, modeId: "western.ionian" },
  tracks: [{ role: "lead", name: "L", presetId: "grand-piano", notes: [{ beat: 1, pitch: 60 }] }],
})

describe("compileDemo — beats → ticks", () => {
  it("places a beat-1 note at one quarter (PPQ ticks) in 4/4", () => {
    const snap = compileDemo(minimalSpec())
    const lead = snap.tracks.find((t) => isInstrumentTrack(t) && t.notes.length > 0)
    expect(lead && isInstrumentTrack(lead) && lead.notes[0].tick).toBe(PPQ)
  })

  it("scales the loop to bars × beats", () => {
    const snap = compileDemo({ ...minimalSpec(), bars: 2 })
    expect(snap.loopLengthTicks).toBe(2 * 4 * PPQ)
  })

  it("resolves drum roles to kit pitches", () => {
    const spec: DemoSongSpec = {
      ...minimalSpec(),
      tracks: [{ role: "drums", name: "Drums", kitId: "tr-909", notes: [{ beat: 0, role: "kick" }] }],
    }
    const snap = compileDemo(spec)
    const drums = snap.tracks.find((t) => isInstrumentTrack(t) && t.instrument.kind === "drumSampler")
    expect(drums && isInstrumentTrack(drums) && drums.notes.length).toBe(1)
  })
})

describe("validateDemo — loud on bad ids", () => {
  it("flags an unknown preset id", () => {
    const bad = { ...minimalSpec(), tracks: [{ role: "lead" as const, name: "L", presetId: "nope", notes: [{ beat: 0, pitch: 60 }] }] }
    expect(validateDemo(bad)).toContain('unknown presetId "nope"')
  })
  it("flags an unknown mode id", () => {
    const bad = { ...minimalSpec(), harmony: { tonic: 0, modeId: "western.nope" } }
    expect(validateDemo(bad).some((p) => p.includes("unknown modeId"))).toBe(true)
  })
  it("flags a melodic note with no pitch", () => {
    const bad = { ...minimalSpec(), tracks: [{ role: "lead" as const, name: "L", presetId: "grand-piano", notes: [{ beat: 0 }] }] }
    expect(validateDemo(bad).some((p) => p.includes("missing pitch"))).toBe(true)
  })
  it("compileDemo throws on an invalid spec", () => {
    const bad = { ...minimalSpec(), harmony: { tonic: 0, modeId: "western.nope" } }
    expect(() => compileDemo(bad)).toThrow(/Invalid demo/)
  })
})
