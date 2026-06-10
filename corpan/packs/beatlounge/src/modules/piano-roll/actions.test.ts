import { describe, expect, it } from "vitest"
import { createCommandBus } from "../../model/commandBus"
import {
  createDefaultDoc,
  findTrack,
  isInstrumentTrack,
  type BeatloungeDoc,
} from "../../model/document"
import { reduce } from "../../model/reduce"
import { stepsInLoop } from "../../model/timing"
import {
  arpeggiateAction,
  clearAction,
  pianoRollActions,
  transposeAction,
} from "./actions"

const seedDoc = (): { doc: BeatloungeDoc; trackId: string } => {
  const doc = createDefaultDoc(0)
  const track = doc.tracks.find(
    (t) => isInstrumentTrack(t) && t.instrument.kind !== "drumSampler"
  )!
  return { doc, trackId: track.id }
}

const ctx = (doc: BeatloungeDoc, trackId: string, rng: () => number = () => 0.5) => ({
  doc,
  targetTrackId: trackId,
  rng,
})

const applyResult = (
  doc: BeatloungeDoc,
  commands: ReturnType<typeof clearAction.run>["commands"]
) => commands.reduce((d, c) => reduce(d, c), doc)

describe("piano-roll actions — registry shape", () => {
  it("exposes exactly clear + arpeggiate + transpose with valid impact", () => {
    expect(pianoRollActions.map((a) => a.name).sort()).toEqual([
      "arpeggiate",
      "clear",
      "transpose",
    ])
    for (const a of pianoRollActions) {
      expect(["tweak", "mutate", "destructive"]).toContain(a.impact)
      expect(typeof a.describe).toBe("string")
      expect(typeof a.run).toBe("function")
    }
  })
})

describe("clear action", () => {
  it("empties the melodic track", () => {
    const { doc, trackId } = seedDoc()
    const result = clearAction.run(ctx(doc, trackId), {})
    expect(result.commands).toEqual([{ t: "clearTrack", trackId }])
    const after = applyResult(doc, result.commands)
    const t = findTrack(after, trackId)
    expect(t && isInstrumentTrack(t) ? t.notes.length : -1).toBe(0)
  })
})

describe("arpeggiate action", () => {
  it("emits one setNotes command with the requested pulse count", () => {
    const { doc, trackId } = seedDoc()
    const result = arpeggiateAction.run(ctx(doc, trackId), { pulses: 6 })
    expect(result.commands).toHaveLength(1)
    const cmd = result.commands[0]
    expect(cmd.t).toBe("setNotes")
    if (cmd.t !== "setNotes") throw new Error("expected setNotes")
    expect(cmd.notes).toHaveLength(6)
    for (const n of cmd.notes) {
      expect(n.pitch).toBeGreaterThanOrEqual(0)
      expect(n.pitch).toBeLessThanOrEqual(127)
      expect(n.velocity).toBeGreaterThan(0)
      expect(n.velocity).toBeLessThanOrEqual(1)
      expect(Number.isInteger(n.tick)).toBe(true)
    }
  })

  it("is deterministic given the same rng seed", () => {
    const { doc, trackId } = seedDoc()
    const a = arpeggiateAction.run(ctx(doc, trackId, () => 0.5), { pulses: 8 })
    const b = arpeggiateAction.run(ctx(doc, trackId, () => 0.5), { pulses: 8 })
    expect(a.commands).toEqual(b.commands)
  })

  it("clamps pulses to the number of steps in the loop", () => {
    const { doc, trackId } = seedDoc()
    const track = findTrack(doc, trackId)!
    if (!isInstrumentTrack(track)) throw new Error("not instrument")
    const steps = stepsInLoop(doc.loopLengthTicks, track.grid)
    const result = arpeggiateAction.run(ctx(doc, trackId), { pulses: 999 })
    const cmd = result.commands[0]
    if (cmd.t !== "setNotes") throw new Error("expected setNotes")
    expect(cmd.notes.length).toBeLessThanOrEqual(steps)
  })

  it("applies through the bus into real notes", () => {
    const { doc, trackId } = seedDoc()
    const bus = createCommandBus(doc)
    for (const c of arpeggiateAction.run(ctx(doc, trackId), { pulses: 5 }).commands)
      bus.dispatch(c)
    const track = findTrack(bus.snapshot(), trackId)!
    if (!isInstrumentTrack(track)) throw new Error("not instrument")
    expect(track.notes).toHaveLength(5)
  })
})

describe("transpose action", () => {
  it("shifts every note by the given semitones (clamped to MIDI)", () => {
    const { doc, trackId } = seedDoc()
    const before = findTrack(doc, trackId)!
    if (!isInstrumentTrack(before)) throw new Error("not instrument")
    const original = before.notes.map((n) => n.pitch)

    const result = transposeAction.run(ctx(doc, trackId), { semitones: 12 })
    expect(result.commands).toHaveLength(1)
    expect(result.commands[0].t).toBe("batch")

    const after = applyResult(doc, result.commands)
    const t = findTrack(after, trackId)!
    if (!isInstrumentTrack(t)) throw new Error("not instrument")
    const shifted = t.notes.map((n) => n.pitch).sort((a, b) => a - b)
    expect(shifted).toEqual(original.map((p) => Math.min(127, p + 12)).sort((a, b) => a - b))
  })

  it("returns no commands for a zero shift", () => {
    const { doc, trackId } = seedDoc()
    const result = transposeAction.run(ctx(doc, trackId), { semitones: 0 })
    expect(result.commands).toHaveLength(0)
  })

  it("returns no commands when the track is empty", () => {
    const { doc, trackId } = seedDoc()
    const cleared = reduce(doc, { t: "clearTrack", trackId })
    const result = transposeAction.run(ctx(cleared, trackId), { semitones: 5 })
    expect(result.commands).toHaveLength(0)
  })
})
