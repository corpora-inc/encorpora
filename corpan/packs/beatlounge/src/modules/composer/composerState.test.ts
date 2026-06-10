/**
 * beatlounge — composer state-bridge tests. The pure (settings → commands)
 * function the immersive view drives: text-vs-template resolution, the compose
 * command shape, determinism by seed, and the evolve/roll seed helpers.
 */

import { describe, expect, it } from "vitest"
import {
  composeCommands,
  defaultComposerSettings,
  resolveProgression,
  progressionNotation,
  nextEvolveSeed,
  keyPc,
  type ComposerSettings,
} from "./composerState"
import { createDefaultDoc, isInstrumentTrack, type BeatloungeDoc } from "../../model/document"
import { reduce } from "../../model/reduce"

/** A single fixed doc + its synth id (so track ids are stable across a test). */
const fixture = (): { doc: BeatloungeDoc; synth: string } => {
  const doc = createDefaultDoc(0)
  const t = doc.tracks.find((tr) => isInstrumentTrack(tr) && tr.instrument.kind !== "drumSampler")!
  return { doc, synth: t.id }
}
const SYNTH_ID = "trk_fixed_synth"

const settings = (patch: Partial<ComposerSettings> = {}): ComposerSettings => ({
  ...defaultComposerSettings(),
  ...patch,
})

describe("resolveProgression", () => {
  it("uses the typed notation when present + parseable", () => {
    const p = resolveProgression(settings({ text: "Dmin,,,,Gmin,,A7,," }))
    expect(p.chords.map((c) => c.token)).toEqual(["Dmin", "Gmin", "A7"])
    expect(p.chords.map((c) => c.beats)).toEqual([4, 2, 2])
  })
  it("falls back to the template in key/mode when text is blank", () => {
    const p = resolveProgression(settings({ text: "", template: "pop", key: "G", mode: "major" }))
    // pop in G = G D Em C
    expect(p.chords.map((c) => c.chord.root)).toEqual([7, 2, 4, 0])
  })
  it("falls back to template when text parses to nothing", () => {
    const p = resolveProgression(settings({ text: "   ", template: "pop", key: "C" }))
    expect(p.chords.length).toBeGreaterThan(0)
  })
})

describe("progressionNotation", () => {
  it("round-trips typed notation beat counts", () => {
    const note = progressionNotation(settings({ text: "C,,,,G,,,," }))
    expect(note).toBe("C,,,,G,,,,")
  })
})

describe("composeCommands", () => {
  it("emits setLoopLength + setNotes onto the bound track", () => {
    const { commands, noteCount, chordCount } = composeCommands(
      settings({ template: "pop", key: "C", feel: "melody" }),
      SYNTH_ID
    )
    expect(commands[0].t).toBe("setLoopLength")
    expect(commands[1].t).toBe("setNotes")
    expect(noteCount).toBeGreaterThan(0)
    expect(chordCount).toBe(4)
  })

  it("the result applies cleanly through the reducer", () => {
    const { doc: doc0, synth } = fixture()
    let doc = doc0
    const { commands } = composeCommands(settings({ template: "jazz", key: "C" }), synth)
    for (const c of commands) doc = reduce(doc, c)
    const t = doc.tracks.find((tr) => tr.id === synth)!
    expect(isInstrumentTrack(t) && t.notes.length).toBeGreaterThan(0)
  })

  it("is deterministic for a fixed seed", () => {
    const a = composeCommands(settings({ template: "epic", key: "A", mode: "minor", seed: 7 }), SYNTH_ID)
    const b = composeCommands(settings({ template: "epic", key: "A", mode: "minor", seed: 7 }), SYNTH_ID)
    expect(JSON.stringify(a.commands)).toBe(JSON.stringify(b.commands))
  })

  it("a different seed yields different material", () => {
    const a = composeCommands(settings({ seed: 1 }), SYNTH_ID)
    const b = composeCommands(settings({ seed: 2 }), SYNTH_ID)
    expect(JSON.stringify(a.commands)).not.toBe(JSON.stringify(b.commands))
  })
})

describe("seed helpers", () => {
  it("nextEvolveSeed is deterministic + moves off the current seed", () => {
    expect(nextEvolveSeed(1)).toBe(nextEvolveSeed(1))
    expect(nextEvolveSeed(1)).not.toBe(1)
  })
  it("keyPc resolves note names", () => {
    expect(keyPc("C")).toBe(0)
    expect(keyPc("Eb")).toBe(3)
    expect(keyPc("F#")).toBe(6)
    expect(keyPc("nonsense")).toBe(0)
  })
})
