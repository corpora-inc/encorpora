/**
 * beatlounge — harmony command reducer + migration tests.
 *
 * The harmony commands are additive on doc.harmony, structurally shared, and
 * migration-safe (a doc with no harmony field reduces against the default).
 */

import { describe, expect, it } from "vitest"
import {
  createDefaultDoc,
  defaultHarmony,
  docHarmony,
  migrateDoc,
  type BeatloungeDoc,
} from "./document"
import { reduce } from "./reduce"
import { PPQ } from "./timing"

const doc0 = (): BeatloungeDoc => createDefaultDoc(0)

describe("harmony — default + migration", () => {
  it("a fresh doc carries the modal C-major default", () => {
    const h = doc0().harmony
    expect(h).toEqual(defaultHarmony())
    expect(h?.mode).toBe("modal")
    expect(h?.tonic).toBe(0)
    expect(h?.scale).toEqual({ family: "western", id: "western.ionian", tuning: "equal12" })
    expect(h?.reference).toEqual({ hz: 440, midi: 69 })
  })

  it("migrateDoc fills a missing harmony field idempotently", () => {
    const legacy = { ...doc0(), harmony: undefined } as BeatloungeDoc
    const migrated = migrateDoc(legacy)
    expect(migrated.harmony).toEqual(defaultHarmony())
    // Idempotent: a doc that already has harmony is returned unchanged.
    const again = migrateDoc(migrated)
    expect(again).toBe(migrated)
  })

  it("docHarmony returns the default for a pre-harmony doc without mutating", () => {
    const legacy = { ...doc0(), harmony: undefined } as BeatloungeDoc
    expect(docHarmony(legacy)).toEqual(defaultHarmony())
    expect(legacy.harmony).toBeUndefined()
  })

  it("reduce never mutates the input doc (harmony command)", () => {
    const a = doc0()
    const before = JSON.stringify(a)
    reduce(a, { t: "setTonic", pc: 7 })
    expect(JSON.stringify(a)).toBe(before)
  })

  it("reduces a harmony command against a missing harmony field", () => {
    const legacy = { ...doc0(), harmony: undefined } as BeatloungeDoc
    const d = reduce(legacy, { t: "setTonic", pc: 5 })
    expect(d.harmony?.tonic).toBe(5)
    expect(d.harmony?.scale.id).toBe("western.ionian") // default preserved
  })
})

describe("harmony — modal commands", () => {
  it("setHarmonyMode toggles modal ⇄ chordal", () => {
    const d = reduce(doc0(), { t: "setHarmonyMode", mode: "chordal" })
    expect(d.harmony?.mode).toBe("chordal")
    // No-op returns the SAME doc reference.
    expect(reduce(d, { t: "setHarmonyMode", mode: "chordal" })).toBe(d)
  })

  it("setTonic normalizes to a pitch class 0..11", () => {
    expect(reduce(doc0(), { t: "setTonic", pc: 14 }).harmony?.tonic).toBe(2)
    expect(reduce(doc0(), { t: "setTonic", pc: -1 }).harmony?.tonic).toBe(11)
  })

  it("setScale + setTuning update the modal scale", () => {
    let d = reduce(doc0(), { t: "setScale", family: "thaat", id: "thaat.bhairav" })
    expect(d.harmony?.scale).toMatchObject({ family: "thaat", id: "thaat.bhairav" })
    d = reduce(d, { t: "setTuning", tuning: "just" })
    expect(d.harmony?.scale.tuning).toBe("just")
  })

  it("setReference validates + sets the anchor", () => {
    const d = reduce(doc0(), { t: "setReference", reference: { hz: 432, midi: 69 } })
    expect(d.harmony?.reference).toEqual({ hz: 432, midi: 69 })
    // Invalid hz is rejected (no-op).
    expect(reduce(d, { t: "setReference", reference: { hz: 0, midi: 69 } })).toBe(d)
  })

  it("shares untouched parts of the doc (structural sharing)", () => {
    const a = doc0()
    const b = reduce(a, { t: "setTonic", pc: 4 })
    expect(b).not.toBe(a)
    expect(b.tracks).toBe(a.tracks) // tracks untouched, shared by reference
  })
})

describe("harmony — chord timeline commands", () => {
  it("setProgression replaces the timeline (tick-sorted, ids assigned)", () => {
    const d = reduce(doc0(), {
      t: "setProgression",
      chords: [
        { tick: PPQ * 4, symbol: "G7" },
        { tick: 0, symbol: "Cmaj7" },
      ],
    })
    const prog = d.harmony?.progression ?? []
    expect(prog.map((c) => c.tick)).toEqual([0, PPQ * 4]) // sorted
    expect(prog.map((c) => c.symbol)).toEqual(["Cmaj7", "G7"])
    expect(prog.every((c) => typeof c.id === "string" && c.id.length > 0)).toBe(true)
  })

  it("setChordAt inserts, then REPLACES the chord at the same tick", () => {
    let d = reduce(doc0(), { t: "setChordAt", tick: PPQ * 2, symbol: "Am" })
    expect(d.harmony?.progression).toHaveLength(1)
    const firstId = d.harmony?.progression[0].id
    d = reduce(d, { t: "setChordAt", tick: PPQ * 2, symbol: "F" })
    expect(d.harmony?.progression).toHaveLength(1)
    expect(d.harmony?.progression[0].symbol).toBe("F")
    // Replacement keeps the slot's id stable (undo-friendly).
    expect(d.harmony?.progression[0].id).toBe(firstId)
  })

  it("addChord appends + keeps the timeline tick-sorted", () => {
    let d = reduce(doc0(), { t: "addChord", chord: { tick: PPQ * 4, symbol: "G7" } })
    d = reduce(d, { t: "addChord", chord: { tick: 0, symbol: "C" } })
    expect(d.harmony?.progression.map((c) => c.tick)).toEqual([0, PPQ * 4])
  })

  it("removeChord drops by id (no-op if absent)", () => {
    const d = reduce(doc0(), { t: "setChordAt", tick: 0, symbol: "C" })
    const id = d.harmony!.progression[0].id
    const removed = reduce(d, { t: "removeChord", chordId: id })
    expect(removed.harmony?.progression).toHaveLength(0)
    expect(reduce(d, { t: "removeChord", chordId: "nope" })).toBe(d)
  })

  it("batch applies multiple harmony edits as one step", () => {
    const d = reduce(doc0(), {
      t: "batch",
      commands: [
        { t: "setHarmonyMode", mode: "chordal" },
        { t: "setTonic", pc: 7 },
        { t: "setChordAt", tick: 0, symbol: "G" },
      ],
    })
    expect(d.harmony?.mode).toBe("chordal")
    expect(d.harmony?.tonic).toBe(7)
    expect(d.harmony?.progression).toHaveLength(1)
  })
})
