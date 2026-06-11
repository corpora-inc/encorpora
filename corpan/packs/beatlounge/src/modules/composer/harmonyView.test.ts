/**
 * beatlounge — Harmony-bar view-model tests (pure, React-free).
 */

import { describe, expect, it } from "vitest"
import { createDefaultDoc, type BeatloungeDoc } from "../../model/document"
import { reduce } from "../../model/reduce"
import { PPQ } from "../../model/timing"
import { getProgression } from "../../music/chords"
import {
  beatsPerBar,
  buildChordGrid,
  corpusProgressionToHarmony,
  loopBeats,
  modeById,
  noteRow,
  scaleIsMicrotonal,
  scalesForFamily,
} from "./harmonyView"

const doc0 = (): BeatloungeDoc => createDefaultDoc(0)

describe("harmonyView — families & scales", () => {
  it("lists scales for each family", () => {
    expect(scalesForFamily("western").length).toBeGreaterThan(7)
    expect(scalesForFamily("thaat")).toHaveLength(10)
    expect(scalesForFamily("melakarta")).toHaveLength(72)
    expect(scalesForFamily("maqam").length).toBeGreaterThan(5)
  })

  it("flags maqam scales as microtonal, western as not", () => {
    expect(scaleIsMicrotonal(modeById("western", "western.ionian"))).toBe(false)
    expect(scaleIsMicrotonal(modeById("maqam", "maqam.rast"))).toBe(true)
  })
})

describe("harmonyView — note row", () => {
  it("renders C major as C D E F G A B with the tonic flagged", () => {
    const row = noteRow(doc0())
    expect(row.map((c) => c.label)).toEqual(["C", "D", "E", "F", "G", "A", "B"])
    expect(row.find((c) => c.tonic)?.label).toBe("C")
  })

  it("follows a tonic + mode change", () => {
    let d = reduce(doc0(), { t: "setTonic", pc: 7 }) // G
    d = reduce(d, { t: "setScale", family: "western", id: "western.mixolydian" })
    const row = noteRow(d)
    // G mixolydian: G A B C D E F
    expect(row.map((c) => c.pc)).toEqual([7, 9, 11, 0, 2, 4, 5])
    expect(row.find((c) => c.tonic)?.label).toBe("G")
  })
})

describe("harmonyView — chord grid over the loop", () => {
  it("builds one slot per beat, marking placed + sustained chords", () => {
    // 4/4, one-bar loop (default) → 4 beats.
    let d = doc0()
    expect(beatsPerBar(d)).toBe(4)
    expect(loopBeats(d)).toBe(4)
    d = reduce(d, { t: "setChordAt", tick: 0, symbol: "C" })
    d = reduce(d, { t: "setChordAt", tick: PPQ * 2, symbol: "G" })
    const grid = buildChordGrid(d)
    expect(grid).toHaveLength(4)
    expect(grid[0]).toMatchObject({ symbol: "C", sustained: false, beatInBar: 0 })
    expect(grid[1]).toMatchObject({ symbol: null, sustained: true }) // C sustains
    expect(grid[2]).toMatchObject({ symbol: "G", sustained: false })
    expect(grid[3]).toMatchObject({ symbol: null, sustained: true }) // G sustains
  })

  it("grid grows with the loop length", () => {
    const d = reduce(doc0(), { t: "setLoopLength", ticks: PPQ * 8 })
    expect(loopBeats(d)).toBe(8)
    expect(buildChordGrid(d)).toHaveLength(8)
  })
})

describe("harmonyView — corpus → harmony bridge (browse 994)", () => {
  it("converts a corpus progression into tick-addressed chord events at the tonic", () => {
    const prog = getProgression("pop-loop:I-V-vi-IV") ?? CORPUS_FALLBACK()
    const { chords, loopTicks } = corpusProgressionToHarmony(prog, 0)
    expect(chords.length).toBe(prog.degrees.length)
    expect(chords[0].tick).toBe(0)
    // Each chord symbol parses to a real chord.
    expect(chords.every((c) => /^[A-G]/.test(c.symbol))).toBe(true)
    expect(loopTicks).toBeGreaterThan(0)
  })

  it("dropping a progression into a chordal doc yields a C-major implied scale for I-V-vi-IV", () => {
    const prog = getProgression("pop-loop:I-V-vi-IV") ?? CORPUS_FALLBACK()
    const { chords } = corpusProgressionToHarmony(prog, 0)
    let d = reduce(doc0(), { t: "setHarmonyMode", mode: "chordal" })
    d = reduce(d, { t: "setProgression", chords })
    // C major I-V-vi-IV = C G Am F → union is the C major scale.
    const row = noteRow(d)
    expect(new Set(row.map((c) => c.pc))).toEqual(new Set([0, 2, 4, 5, 7, 9, 11]))
  })
})

/** Fallback if the exact id ever changes — pick any pop-loop progression. */
import { CORPUS } from "../../music/chords"
const CORPUS_FALLBACK = () =>
  CORPUS.find((p) => p.family === "pop-loop") ?? CORPUS[0]
