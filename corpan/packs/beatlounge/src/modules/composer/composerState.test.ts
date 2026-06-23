/**
 * beatlounge — composer (Harmony bar) jam-bridge tests. The pure
 * (doc.harmony + performance settings → commands) function the immersive view
 * drives: harmony→progression for both modes, the compose command shape,
 * determinism by seed, and the evolve/roll seed helpers.
 */

import { describe, expect, it } from "vitest"
import {
  composeFromHarmony,
  defaultComposerSettings,
  harmonyToProgression,
  nextEvolveSeed,
  type ComposerSettings,
} from "./composerState"
import { createDefaultDoc, isInstrumentTrack, type BeatloungeDoc } from "../../model/document"
import { reduce } from "../../model/reduce"
import { PPQ } from "../../model/timing"

const SYNTH_ID = "trk_fixed_synth"

const settings = (patch: Partial<ComposerSettings> = {}): ComposerSettings => ({
  ...defaultComposerSettings(),
  ...patch,
})

/** A chordal doc carrying a C-G-Am-F progression. */
const chordalDoc = (base?: BeatloungeDoc): BeatloungeDoc => {
  let d = reduce(base ?? createDefaultDoc(0), { t: "setHarmonyMode", mode: "chordal" })
  d = reduce(d, { t: "setLoopLength", ticks: PPQ * 16 })
  d = reduce(d, {
    t: "setProgression",
    chords: [
      { tick: 0, symbol: "C" },
      { tick: PPQ * 4, symbol: "G" },
      { tick: PPQ * 8, symbol: "Am" },
      { tick: PPQ * 12, symbol: "F" },
    ],
  })
  return d
}

describe("harmonyToProgression", () => {
  it("chordal: builds a progression from the tick timeline with beat durations", () => {
    const prog = harmonyToProgression(chordalDoc())
    expect(prog).not.toBeNull()
    expect(prog!.chords.map((c) => c.token)).toEqual(["C", "G", "Am", "F"])
    expect(prog!.chords.map((c) => c.beats)).toEqual([4, 4, 4, 4])
  })

  it("chordal with no chords ⇒ null (nothing to play)", () => {
    const d = reduce(createDefaultDoc(0), { t: "setHarmonyMode", mode: "chordal" })
    expect(harmonyToProgression(d)).toBeNull()
  })

  it("modal: lays the modal scale's diatonic triads (one per bar)", () => {
    // Default modal C major, one-bar loop → one triad (C).
    const prog = harmonyToProgression(createDefaultDoc(0))
    expect(prog).not.toBeNull()
    expect(prog!.chords[0].chord.root).toBe(0) // C
  })
})

describe("composeFromHarmony", () => {
  it("emits setLoopLength + setNotes onto the bound track (chordal)", () => {
    const { commands, noteCount, chordCount } = composeFromHarmony(
      chordalDoc(),
      settings({ feel: "melody" }),
      SYNTH_ID
    )
    expect(commands[0].t).toBe("setLoopLength")
    expect(commands[1].t).toBe("setNotes")
    expect(noteCount).toBeGreaterThan(0)
    expect(chordCount).toBe(4)
  })

  it("the result applies cleanly through the reducer", () => {
    let doc = chordalDoc()
    const synth = doc.tracks.find(
      (tr) => isInstrumentTrack(tr) && tr.instrument.kind !== "drumSampler"
    )!.id
    const { commands } = composeFromHarmony(doc, settings({ feel: "arp" }), synth)
    for (const c of commands) doc = reduce(doc, c)
    const t = doc.tracks.find((tr) => tr.id === synth)!
    expect(isInstrumentTrack(t) && t.notes.length).toBeGreaterThan(0)
  })

  it("is deterministic for a fixed seed", () => {
    const d = chordalDoc()
    const a = composeFromHarmony(d, settings({ feel: "melody", seed: 7 }), SYNTH_ID)
    const b = composeFromHarmony(d, settings({ feel: "melody", seed: 7 }), SYNTH_ID)
    expect(JSON.stringify(a.commands)).toBe(JSON.stringify(b.commands))
  })

  it("a different seed yields different material", () => {
    const d = chordalDoc()
    const a = composeFromHarmony(d, settings({ seed: 1 }), SYNTH_ID)
    const b = composeFromHarmony(d, settings({ seed: 2 }), SYNTH_ID)
    expect(JSON.stringify(a.commands)).not.toBe(JSON.stringify(b.commands))
  })

  it("returns no commands when there is nothing to play", () => {
    const d = reduce(createDefaultDoc(0), { t: "setHarmonyMode", mode: "chordal" })
    const { commands } = composeFromHarmony(d, settings(), SYNTH_ID)
    expect(commands).toHaveLength(0)
  })
})

describe("seed helpers", () => {
  it("nextEvolveSeed is deterministic + moves off the current seed", () => {
    expect(nextEvolveSeed(1)).toBe(nextEvolveSeed(1))
    expect(nextEvolveSeed(1)).not.toBe(1)
  })
})
