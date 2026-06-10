import { describe, expect, it } from "vitest"
import {
  createDefaultDoc,
  isInstrumentTrack,
  type BeatloungeDoc,
  type InstrumentTrack,
} from "../../model/document"
import { stepsInLoop, tickForStep } from "../../model/timing"
import {
  autoWindow,
  buildRollView,
  buildRows,
  DEFAULT_LOW_PITCH,
  isInScale,
  octaveOf,
  pitchLabel,
  ROW_SPAN,
} from "./pitchModel"

const synthTrack = (): { doc: BeatloungeDoc; track: InstrumentTrack } => {
  const doc = createDefaultDoc(0)
  const track = doc.tracks.find(
    (t) => isInstrumentTrack(t) && t.instrument.kind !== "drumSampler"
  )
  if (!track || !isInstrumentTrack(track)) throw new Error("no melodic track")
  return { doc, track }
}

describe("pitch labelling", () => {
  it("names middle C as C4", () => {
    expect(pitchLabel(60)).toBe("C4")
    expect(octaveOf(60)).toBe(4)
  })
  it("spells accidentals with sharps", () => {
    expect(pitchLabel(61)).toBe("C#4")
    expect(pitchLabel(66)).toBe("F#4")
    expect(pitchLabel(72)).toBe("C5")
  })
})

describe("scale highlighting", () => {
  it("flags C-major degrees as in-scale (C D E F G A B)", () => {
    const expected = [60, 62, 64, 65, 67, 69, 71]
    for (const p of expected) expect(isInScale(p, 0)).toBe(true)
  })
  it("flags accidentals as out of scale", () => {
    for (const p of [61, 63, 66, 68, 70]) expect(isInScale(p, 0)).toBe(false)
  })
  it("re-roots the scale by tonic (D-major flags F# and C#)", () => {
    // D major degrees: D E F# G A B C# → pitch classes 2 4 6 7 9 11 1
    expect(isInScale(66, 2)).toBe(true) // F#
    expect(isInScale(61, 2)).toBe(true) // C#
    expect(isInScale(65, 2)).toBe(false) // F natural is out
  })
})

describe("buildRows — the visible pitch window", () => {
  it("returns ROW_SPAN rows, highest pitch first", () => {
    const rows = buildRows(DEFAULT_LOW_PITCH)
    expect(rows).toHaveLength(ROW_SPAN)
    expect(rows[0].pitch).toBe(DEFAULT_LOW_PITCH + ROW_SPAN - 1)
    expect(rows[rows.length - 1].pitch).toBe(DEFAULT_LOW_PITCH)
  })
  it("marks tonic rows and keeps accidentals reachable but flagged", () => {
    const rows = buildRows(60)
    const c4 = rows.find((r) => r.pitch === 60)!
    expect(c4.tonic).toBe(true)
    expect(c4.inScale).toBe(true)
    expect(c4.accidental).toBe(false)
    const cs4 = rows.find((r) => r.pitch === 61)!
    expect(cs4.accidental).toBe(true)
    expect(cs4.inScale).toBe(false)
  })
})

describe("buildRollView — pitch↔row/step mapping", () => {
  it("column count equals the steps in the loop on the track grid", () => {
    const { doc, track } = synthTrack()
    const view = buildRollView(doc, track, { low: 60 })
    expect(view.steps).toBe(stepsInLoop(doc.loopLengthTicks, track.grid))
  })

  it("lights the cell where a note sits (default riff C-E-G-C)", () => {
    const { doc, track } = synthTrack()
    const view = buildRollView(doc, track, { low: 60, span: ROW_SPAN })
    // The default synth riff starts on C4 (60) at step 0.
    const rowC4 = view.rows.findIndex((r) => r.pitch === 60)
    expect(rowC4).toBeGreaterThanOrEqual(0)
    expect(view.cells[rowC4][0].on).toBe(true)
    expect(view.cells[rowC4][0].noteId).toBeTruthy()
  })

  it("rows align with cells (one cell-row per pitch row)", () => {
    const { doc, track } = synthTrack()
    const view = buildRollView(doc, track, { low: 60 })
    expect(view.cells).toHaveLength(view.rows.length)
    for (const r of view.cells) expect(r).toHaveLength(view.steps)
  })
})

describe("autoWindow — frames the existing melody", () => {
  it("falls back to the default low pitch for an empty track", () => {
    const { track } = synthTrack()
    const empty: InstrumentTrack = { ...track, notes: [] }
    expect(autoWindow(empty)).toBe(DEFAULT_LOW_PITCH)
  })
  it("snaps the window bottom to a tonic and keeps notes in range", () => {
    const { doc, track } = synthTrack()
    const low = autoWindow(track)
    expect(low % 12).toBe(0) // snapped to a C
    // Every note pitch lands inside [low, low+ROW_SPAN).
    const view = buildRollView(doc, track, { low })
    for (const n of track.notes) {
      const inWindow = n.pitch >= low && n.pitch < low + ROW_SPAN
      // The default riff spans C4..C5 which fits a 2-octave window.
      if (inWindow) {
        const rowIdx = view.rows.findIndex((r) => r.pitch === n.pitch)
        const step = Math.round(n.tick / tickForStep(1, track.grid))
        expect(view.cells[rowIdx][step].on).toBe(true)
      }
    }
  })
})
