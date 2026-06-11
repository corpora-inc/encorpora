/**
 * beatlounge — record-placement tests (pure). Covers the per-pointer step
 * dedupe, quantize-on/off tick choice, and the duplicate-cell guard that the
 * InstrumentRibbon's record path relies on. A mocked playhead (step + raw tick)
 * stands in for `audio.onPlayhead`.
 */

import { describe, expect, it } from "vitest"
import type { Grid, NoteEvent } from "../../model/document"
import { gridTicks, tickForStep } from "../../model/timing"
import { placeRecordedNote, type RecordInput } from "./recordPlacement"

const GRID: Grid = { denominator: 16 }
const TRACK = "trk-1"

const baseInput = (over: Partial<RecordInput> = {}): RecordInput => ({
  trackId: TRACK,
  notes: [],
  grid: GRID,
  playStep: 4,
  playTick: tickForStep(4, GRID),
  lastRecordedStep: -1,
  quantizeRecord: true,
  midi: 60,
  ...over,
})

describe("placeRecordedNote — quantize on", () => {
  it("lays a note at the grid step boundary with the clamped pitch", () => {
    const r = placeRecordedNote(baseInput({ playStep: 4, midi: 60.4 }))
    expect(r.command).not.toBeNull()
    expect(r.lastRecordedStep).toBe(4)
    if (r.command && r.command.t === "addNote") {
      expect(r.command.trackId).toBe(TRACK)
      expect(r.command.note.tick).toBe(tickForStep(4, GRID))
      expect(r.command.note.pitch).toBe(60) // rounded
      expect(r.command.note.duration).toBe(gridTicks(GRID))
    }
  })

  it("ignores the raw tick when quantizing (snaps to the step)", () => {
    const r = placeRecordedNote(
      baseInput({ playStep: 2, playTick: tickForStep(2, GRID) + 17, quantizeRecord: true })
    )
    if (r.command && r.command.t === "addNote") {
      expect(r.command.note.tick).toBe(tickForStep(2, GRID))
    }
  })
})

describe("placeRecordedNote — quantize off", () => {
  it("places at the RAW playhead tick (free timing)", () => {
    const raw = tickForStep(2, GRID) + 17
    const r = placeRecordedNote(baseInput({ playStep: 2, playTick: raw, quantizeRecord: false }))
    expect(r.command).not.toBeNull()
    if (r.command && r.command.t === "addNote") {
      expect(r.command.note.tick).toBe(raw)
    }
  })

  it("falls back to the step boundary when the raw tick is unavailable", () => {
    const r = placeRecordedNote(
      baseInput({ playStep: 3, playTick: -1, quantizeRecord: false })
    )
    if (r.command && r.command.t === "addNote") {
      expect(r.command.note.tick).toBe(tickForStep(3, GRID))
    }
  })
})

describe("placeRecordedNote — dedupe", () => {
  it("does not re-fire on the SAME step for one finger (returns null)", () => {
    const r = placeRecordedNote(baseInput({ playStep: 4, lastRecordedStep: 4 }))
    expect(r.command).toBeNull()
    expect(r.lastRecordedStep).toBe(4)
  })

  it("fires again once the playhead has moved to a NEW step", () => {
    const r = placeRecordedNote(baseInput({ playStep: 5, lastRecordedStep: 4 }))
    expect(r.command).not.toBeNull()
    expect(r.lastRecordedStep).toBe(5)
  })

  it("lays at step 0 when the transport is stopped (playStep -1)", () => {
    const r = placeRecordedNote(baseInput({ playStep: -1, lastRecordedStep: -1 }))
    expect(r.lastRecordedStep).toBe(0)
    if (r.command && r.command.t === "addNote") {
      expect(r.command.note.tick).toBe(tickForStep(0, GRID))
    }
  })
})

describe("placeRecordedNote — duplicate cell guard", () => {
  it("does not write a duplicate identical note (same tick + pitch)", () => {
    const tick = tickForStep(4, GRID)
    const notes: NoteEvent[] = [
      { id: "n1", tick, duration: gridTicks(GRID), pitch: 60, velocity: 0.8 },
    ]
    const r = placeRecordedNote(baseInput({ playStep: 4, midi: 60, notes }))
    expect(r.command).toBeNull()
    // still advances the dedupe step (so a later different pitch can record)
    expect(r.lastRecordedStep).toBe(4)
  })

  it("DOES write a different pitch on the same cell", () => {
    const tick = tickForStep(4, GRID)
    const notes: NoteEvent[] = [
      { id: "n1", tick, duration: gridTicks(GRID), pitch: 60, velocity: 0.8 },
    ]
    const r = placeRecordedNote(baseInput({ playStep: 4, midi: 64, notes }))
    expect(r.command).not.toBeNull()
    if (r.command && r.command.t === "addNote") expect(r.command.note.pitch).toBe(64)
  })
})
