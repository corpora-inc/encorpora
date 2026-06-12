import { describe, expect, it } from "vitest"
import { createCommandBus } from "../../model/commandBus"
import {
  createDefaultDoc,
  DRUM_PITCH,
  findTrack,
  isInstrumentTrack,
  type BeatloungeDoc,
} from "../../model/document"
import { reduce } from "../../model/reduce"
import { stepsInLoop } from "../../model/timing"
import { drumPadsActions, randomPatternAction } from "./actions"

const seedDoc = (): { doc: BeatloungeDoc; trackId: string } => {
  const doc = createDefaultDoc(0)
  const track = doc.tracks.find(
    (t) => isInstrumentTrack(t) && t.instrument.kind === "drumSampler"
  )!
  return { doc, trackId: track.id }
}

/** A counter-based rng so each draw differs (deterministic, reproducible). */
const seqRng = (seed = 0) => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const ctx = (doc: BeatloungeDoc, trackId: string, rng: () => number = seqRng(1)) => ({
  doc,
  targetTrackId: trackId,
  rng,
})

describe("drum-pads actions — registry shape", () => {
  it("exposes exactly randomPattern with valid impact", () => {
    expect(drumPadsActions.map((a) => a.name)).toEqual(["randomPattern"])
    for (const a of drumPadsActions) {
      expect(["tweak", "mutate", "destructive"]).toContain(a.impact)
      expect(typeof a.describe).toBe("string")
      expect(typeof a.run).toBe("function")
    }
  })
})

describe("randomPattern action", () => {
  it("emits one setNotes command of valid drum notes", () => {
    const { doc, trackId } = seedDoc()
    const result = randomPatternAction.run(ctx(doc, trackId), {})
    expect(result.commands).toHaveLength(1)
    const cmd = result.commands[0]
    expect(cmd.t).toBe("setNotes")
    if (cmd.t !== "setNotes") throw new Error("expected setNotes")
    expect(cmd.notes.length).toBeGreaterThan(0)
    const kitPitches = new Set<number>([
      DRUM_PITCH.kick,
      DRUM_PITCH.snare,
      DRUM_PITCH.hat,
      DRUM_PITCH.clap,
    ])
    for (const n of cmd.notes) {
      expect(kitPitches.has(n.pitch)).toBe(true)
      expect(n.velocity).toBeGreaterThan(0)
      expect(n.velocity).toBeLessThanOrEqual(1)
      expect(Number.isInteger(n.tick)).toBe(true)
    }
  })

  it("places at least one hit in every canonical lane", () => {
    const { doc, trackId } = seedDoc()
    const cmd = randomPatternAction.run(ctx(doc, trackId), { density: 0.6 }).commands[0]
    if (cmd.t !== "setNotes") throw new Error("expected setNotes")
    const lanes = new Set(cmd.notes.map((n) => n.pitch))
    for (const p of [DRUM_PITCH.kick, DRUM_PITCH.snare, DRUM_PITCH.hat, DRUM_PITCH.clap]) {
      expect(lanes.has(p)).toBe(true)
    }
  })

  it("is deterministic given the same rng seed", () => {
    const { doc, trackId } = seedDoc()
    const a = randomPatternAction.run(ctx(doc, trackId, seqRng(7)), { density: 0.5 })
    const b = randomPatternAction.run(ctx(doc, trackId, seqRng(7)), { density: 0.5 })
    expect(a.commands).toEqual(b.commands)
  })

  it("keeps every hit inside the loop's step range", () => {
    const { doc, trackId } = seedDoc()
    const track = findTrack(doc, trackId)!
    if (!isInstrumentTrack(track)) throw new Error("not instrument")
    const steps = stepsInLoop(doc.loopLengthTicks, track.grid)
    const cmd = randomPatternAction.run(ctx(doc, trackId), { density: 1 }).commands[0]
    if (cmd.t !== "setNotes") throw new Error("expected setNotes")
    const tickPerStep = track.grid ? doc.loopLengthTicks / steps : 1
    for (const n of cmd.notes) {
      expect(n.tick).toBeGreaterThanOrEqual(0)
      expect(n.tick).toBeLessThan(steps * tickPerStep)
    }
  })

  it("applies through the bus replacing the prior pattern", () => {
    const { doc, trackId } = seedDoc()
    const bus = createCommandBus(doc)
    for (const c of randomPatternAction.run(ctx(bus.snapshot(), trackId), {}).commands)
      bus.dispatch(c)
    const track = findTrack(bus.snapshot(), trackId)!
    if (!isInstrumentTrack(track)) throw new Error("not instrument")
    expect(track.notes.length).toBeGreaterThan(0)
    // setNotes is a full replace, not an append.
    const replaced = randomPatternAction.run(ctx(bus.snapshot(), trackId), {}).commands[0]
    if (replaced.t !== "setNotes") throw new Error("expected setNotes")
    const after = reduce(bus.snapshot(), replaced)
    const t2 = findTrack(after, trackId)!
    if (!isInstrumentTrack(t2)) throw new Error("not instrument")
    expect(t2.notes.length).toBe(replaced.notes.length)
  })
})
