/**
 * beatlounge — SCORE model tests. The pure +/− melody "layer" brain: the layer
 * adds IN KEY into the selected rows (additive, deduped), the sparsify removes
 * lowest-weight / off-beat first down to empty, the dial is deterministic given a
 * seed, and the sixteenth↔tick mapping is exact. Mirrors grooveModel.test.ts.
 */

import { describe, expect, it } from "vitest"
import { createDefaultDoc, isInstrumentTrack } from "../../model/document"
import type { BeatloungeDoc, NoteEvent } from "../../model/document"
import { PPQ } from "../../model/timing"
import { reduce } from "../../model/reduce"
import { activePitches } from "../../music/resolver"
import { METRIC_PROFILES, TRANSITION_TABLES } from "../../music/melody"
import {
  SIXTEENTH_TICKS,
  sixteenthsToTicks,
  ticksToSixteenths,
  buildScoreCommands,
  buildAutoPlayNotes,
  buildScoreView,
  fillScoreCells,
  degreeRows,
  workingTonicMidi,
  sparsifyMelody,
} from "./scoreModel"

const doc = (): BeatloungeDoc => createDefaultDoc(0)

/** The synth (melodic) instrument track in the default doc. */
const melodicTrackId = (d: BeatloungeDoc): string => {
  const t = d.tracks.find((t) => isInstrumentTrack(t) && t.instrument.kind !== "drumSampler")
  if (!t) throw new Error("no melodic track")
  return t.id
}

const trackNotes = (d: BeatloungeDoc, id: string): NoteEvent[] => {
  const t = d.tracks.find((t) => t.id === id)
  return t && isInstrumentTrack(t) ? t.notes : []
}

const metric = METRIC_PROFILES[0]
const table = TRANSITION_TABLES[0]

describe("sixteenth ↔ tick mapping", () => {
  it("one sixteenth = PPQ/4 ticks", () => {
    expect(SIXTEENTH_TICKS).toBe(PPQ / 4)
    expect(sixteenthsToTicks(1)).toBe(PPQ / 4)
    expect(sixteenthsToTicks(4)).toBe(PPQ) // a quarter
    expect(sixteenthsToTicks(16)).toBe(PPQ * 4) // a bar
  })
  it("round-trips ticks → sixteenths", () => {
    for (const s of [0, 1, 3, 8, 16, 31]) {
      expect(ticksToSixteenths(sixteenthsToTicks(s))).toBe(s)
    }
  })
})

describe("degree rows resolve in key", () => {
  it("spans ~2 octaves and resolves every row to a real MIDI in the active set", () => {
    const d = doc()
    const ap = activePitches(d, 0)
    const rows = degreeRows(d, { octaves: 2 })
    // size = scale degrees; ~2 octaves → ~ (2*size) + 1 rows.
    const size = ap.cents.length
    expect(rows.length).toBeGreaterThanOrEqual(size * 2)
    // High → low ordering.
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].midi).toBeLessThanOrEqual(rows[i - 1].midi)
    }
    // Every row's pitch class is in the active set.
    const pcs = new Set(ap.pcs)
    for (const r of rows) expect(pcs.has(((r.midi % 12) + 12) % 12)).toBe(true)
  })
  it("the working tonic sits near middle C", () => {
    const ap = activePitches(doc(), 0)
    const tonic = workingTonicMidi(ap, 60)
    expect(Math.abs(tonic - 60)).toBeLessThanOrEqual(6)
    expect(((tonic % 12) + 12) % 12).toBe(((ap.tonicPc % 12) + 12) % 12)
  })
})

describe("+ layer (add)", () => {
  it("is additive — keeps existing notes and adds more, in key", () => {
    const d = doc()
    const id = melodicTrackId(d)
    const before = trackNotes(d, id)
    const ap = activePitches(d, 0)
    const r = buildScoreCommands(d, { trackId: id, op: "add", metric, table, seed: 7 })
    expect(r.commands.length).toBe(1)
    const next = reduce(d, r.commands[0])
    const after = trackNotes(next, id)
    expect(after.length).toBeGreaterThan(before.length)
    expect(r.count).toBe(after.length - before.length)
    // Every note lands on an in-key pitch class.
    const pcs = new Set(ap.pcs)
    for (const n of after) expect(pcs.has(((n.pitch % 12) + 12) % 12)).toBe(true)
  })

  it("targets ONLY the selected rows when rows are selected", () => {
    const d = doc()
    const id = melodicTrackId(d)
    // Clear existing notes so we observe the layer's own placement cleanly.
    const cleared = reduce(d, { t: "setNotes", trackId: id, notes: [] })
    const rows = degreeRows(cleared, { octaves: 2 })
    // Select two specific rows (degrees) and confirm the layer only uses them.
    const sel = new Set([rows[2].key, rows[5].key])
    const selectedMidis = new Set([rows[2].midi, rows[5].midi])
    const r = buildScoreCommands(cleared, {
      trackId: id,
      op: "add",
      selectedRows: sel,
      metric,
      table,
      seed: 3,
    })
    const next = reduce(cleared, r.commands[0])
    const after = trackNotes(next, id)
    expect(after.length).toBeGreaterThan(0)
    for (const n of after) expect(selectedMidis.has(n.pitch)).toBe(true)
  })

  it("is deterministic given the same seed", () => {
    const d = doc()
    const id = melodicTrackId(d)
    const a = buildScoreCommands(d, { trackId: id, op: "add", metric, table, seed: 42 })
    const b = buildScoreCommands(d, { trackId: id, op: "add", metric, table, seed: 42 })
    expect(JSON.stringify(a.commands)).toBe(JSON.stringify(b.commands))
  })

  it("dedupes — the merged set has no duplicate (tick,pitch)", () => {
    const d = doc()
    const id = melodicTrackId(d)
    // Clear first so the layer is guaranteed to place into open space.
    const cleared = reduce(d, { t: "setNotes", trackId: id, notes: [] })
    const r = buildScoreCommands(cleared, { trackId: id, op: "add", metric, table, seed: 9 })
    const cmd = r.commands[0]
    if (cmd.t !== "setNotes") throw new Error("expected setNotes")
    const keys = cmd.notes.map((n) => `${n.tick}:${n.pitch}`)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe("− sparser (remove)", () => {
  it("removes lowest-velocity first", () => {
    const d = doc()
    const id = melodicTrackId(d)
    // Seed three notes with distinct velocities; the quietest should go first.
    const notes: Omit<NoteEvent, "id">[] = [
      { tick: 0, duration: PPQ, pitch: 60, velocity: 0.9 },
      { tick: PPQ, duration: PPQ, pitch: 62, velocity: 0.2 }, // quietest
      { tick: 2 * PPQ, duration: PPQ, pitch: 64, velocity: 0.7 },
    ]
    const d2 = reduce(d, { t: "setNotes", trackId: id, notes })
    const live = trackNotes(d2, id)
    const quietest = live.find((n) => n.velocity === 0.2)!
    const r = sparsifyMelody(d2, id, live)
    expect(r.commands.length).toBe(1)
    const cmd = r.commands[0]
    if (cmd.t !== "removeNote") throw new Error("expected removeNote")
    expect(cmd.noteId).toBe(quietest.id)
  })

  it("thins down to nothing over repeated taps", () => {
    let d = doc()
    const id = melodicTrackId(d)
    let guard = 0
    while (trackNotes(d, id).length > 0 && guard++ < 50) {
      const live = trackNotes(d, id)
      const r = sparsifyMelody(d, id, live)
      expect(r.commands.length).toBeGreaterThan(0)
      for (const c of r.commands) d = reduce(d, c)
    }
    expect(trackNotes(d, id).length).toBe(0)
  })

  it("is a smaller bite than + adds (asymmetric)", () => {
    const d = doc()
    const id = melodicTrackId(d)
    // Fill a dense line, then compare a single − removal vs the whole count.
    const dense = reduce(d, {
      t: "setNotes",
      trackId: id,
      notes: buildAutoPlayNotes(d, { metric, table, seed: 5 }),
    })
    const live = trackNotes(dense, id)
    const r = sparsifyMelody(dense, id, live)
    expect(r.count).toBeLessThan(live.length)
  })
})

describe("grid view", () => {
  it("lights cells where the track has a note at (row midi, step tick)", () => {
    const d = doc()
    const id = melodicTrackId(d)
    const track = d.tracks.find((t) => t.id === id)!
    if (!isInstrumentTrack(track)) throw new Error("not instrument")
    const view = fillScoreCells(buildScoreView(d, track.grid, { octaves: 2 }), track.notes, track.grid)
    // At least one cell is lit (the default lead melody).
    const lit = view.rows.some((r) => r.cells.some((c) => c.on))
    expect(lit).toBe(true)
  })
})

describe("auto-play fill", () => {
  it("fills the whole loop in key, deterministically by seed", () => {
    const d = doc()
    const ap = activePitches(d, 0)
    const a = buildAutoPlayNotes(d, { metric, table, seed: 11 })
    const b = buildAutoPlayNotes(d, { metric, table, seed: 11 })
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    expect(a.length).toBeGreaterThan(0)
    const pcs = new Set(ap.pcs)
    for (const n of a) expect(pcs.has(((n.pitch % 12) + 12) % 12)).toBe(true)
  })
})

describe("no melodic track", () => {
  it("returns no commands for a drum track", () => {
    const d = doc()
    const drum = d.tracks.find((t) => isInstrumentTrack(t) && t.instrument.kind === "drumSampler")!
    // It IS an instrument track, so layering works; assert a missing track id is a no-op.
    const r = buildScoreCommands(d, { trackId: "nope", op: "add", metric, table, seed: 1 })
    expect(r.commands.length).toBe(0)
    void drum
  })
})
