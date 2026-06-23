import { describe, expect, it } from "vitest"
import { TRACK_BASE, nextTrackName, nextSingletonName } from "./trackNaming"

describe("nextTrackName", () => {
  it("starts at 1 for an empty song", () => {
    expect(nextTrackName([], TRACK_BASE.synth)).toBe("Synth 1")
  })

  it("picks the next free index after sequential names", () => {
    expect(nextTrackName(["Synth 1", "Synth 2"], "Synth")).toBe("Synth 3")
  })

  it("fills the lowest GAP so it never collides with a survivor", () => {
    // The founder's case: add Synth 1 + Synth 2, delete Synth 1, add again →
    // must NOT reuse "Synth 2" (still present); it fills the freed "Synth 1".
    expect(nextTrackName(["Synth 2"], "Synth")).toBe("Synth 1")
  })

  it("is case-insensitive and ignores surrounding whitespace", () => {
    expect(nextTrackName(["  synth 1 ", "SYNTH 2"], "Synth")).toBe("Synth 3")
  })

  it("ignores unrelated names (other kinds / user renames)", () => {
    expect(nextTrackName(["Drums", "My Bassline", "Phrases"], "Synth")).toBe("Synth 1")
  })

  it("never returns a name already in use", () => {
    const existing = ["Synth 1", "Synth 3"]
    const next = nextTrackName(existing, "Synth")
    expect(existing.map((s) => s.toLowerCase())).not.toContain(next.toLowerCase())
  })
})

describe("nextSingletonName", () => {
  it("returns the bare base for the first of its kind", () => {
    expect(nextSingletonName([], TRACK_BASE.drums)).toBe("Drums")
  })

  it("falls back to numbering once the bare base is taken", () => {
    expect(nextSingletonName(["Drums"], "Drums")).toBe("Drums 1")
    expect(nextSingletonName(["Drums", "Drums 1"], "Drums")).toBe("Drums 2")
  })
})
