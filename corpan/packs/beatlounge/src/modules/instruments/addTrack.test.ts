import { describe, expect, it } from "vitest"
import { newInstrumentTrackInit, nextTrackColor, TRACK_COLORS } from "./addTrack"
import { DEFAULT_PRESET_ID, getPreset } from "../../instruments/presets"
import { reduce } from "../../model/reduce"
import { createDefaultDoc, isInstrumentTrack } from "../../model/document"

describe("nextTrackColor", () => {
  it("cycles the palette and never returns undefined", () => {
    for (let i = 0; i < TRACK_COLORS.length * 2 + 1; i++) {
      expect(TRACK_COLORS).toContain(nextTrackColor(i))
    }
    expect(nextTrackColor(0)).toBe(TRACK_COLORS[0])
    expect(nextTrackColor(TRACK_COLORS.length)).toBe(TRACK_COLORS[0])
  })
})

describe("newInstrumentTrackInit", () => {
  it("builds a valid instrument-track stub voiced to a synthesized preset", () => {
    const init = newInstrumentTrackInit(1)
    expect(init.kind).toBe("instrument")
    expect(init.id).toBeTruthy()
    expect(init.name).toBe("Synth 2")
    if (init.kind !== "instrument") throw new Error("expected instrument track")
    expect(init.notes).toEqual([])
    expect(init.instrument.kind).toBe(getPreset(DEFAULT_PRESET_ID)!.config.kind)
    // never a silent / soundfont-collapsed voice
    expect(init.instrument.kind).not.toBe("soundfont")
    expect(init.instrument.kind).not.toBe("ttsFragment")
  })

  it("can voice a specific preset", () => {
    const init = newInstrumentTrackInit(0, "sub-bass")
    if (init.kind !== "instrument") throw new Error("expected instrument track")
    expect(init.instrument.kind).toBe(getPreset("sub-bass")!.config.kind)
  })

  it("falls back to the default preset for an unknown id", () => {
    const init = newInstrumentTrackInit(0, "does-not-exist")
    if (init.kind !== "instrument") throw new Error("expected instrument track")
    expect(init.instrument.kind).toBe(getPreset(DEFAULT_PRESET_ID)!.config.kind)
  })

  it("flows through the reducer's addTrack to a real InstrumentTrack", () => {
    const doc = createDefaultDoc(0)
    const before = doc.tracks.length
    const init = newInstrumentTrackInit(1)
    const next = reduce(doc, { t: "addTrack", track: init })
    expect(next.tracks.length).toBe(before + 1)
    const added = next.tracks.find((t) => t.id === init.id)
    expect(added).toBeDefined()
    expect(added && isInstrumentTrack(added)).toBe(true)
  })

  it("seeds a unique id each call", () => {
    const a = newInstrumentTrackInit(0)
    const b = newInstrumentTrackInit(0)
    expect(a.id).not.toBe(b.id)
  })

  it("names by KIND from existing names — a unique, non-colliding 'Synth N'", () => {
    // Passing the song's NAMES (not a count) yields a unique synth name even
    // after a delete left a gap (the founder couldn't tell strips apart).
    expect(newInstrumentTrackInit(["Drums", "Synth 1", "Synth 2"]).name).toBe("Synth 3")
    // Synth 1 deleted → reuse the freed index, never the surviving "Synth 2".
    expect(newInstrumentTrackInit(["Drums", "Synth 2"]).name).toBe("Synth 1")
    // First synth in a drums-only song.
    expect(newInstrumentTrackInit(["Drums"]).name).toBe("Synth 1")
  })

  it("never derives the name from track content — always 'Synth N'", () => {
    const init = newInstrumentTrackInit(["I will always…", "Phrases"])
    expect(init.name).toBe("Synth 1")
  })
})
