import { describe, expect, it } from "vitest"
import { createCommandBus } from "../../model/commandBus"
import {
  createDefaultDoc,
  findTrack,
  isInstrumentTrack,
  DRUM_PITCH,
  type BeatloungeDoc,
} from "../../model/document"
import { reduce } from "../../model/reduce"
import { stepsInLoop, tickForStep } from "../../model/timing"
import { clearAction, fillEveryOtherAction, stepGridActions } from "./actions"

const seedDoc = (): { doc: BeatloungeDoc; trackId: string } => {
  const doc = createDefaultDoc(0)
  const track = doc.tracks.find(
    (t) => isInstrumentTrack(t) && t.instrument.kind === "drumSampler"
  )!
  return { doc, trackId: track.id }
}

const ctx = (doc: BeatloungeDoc, trackId: string) => ({
  doc,
  targetTrackId: trackId,
  rng: () => 0.5,
})

/** Apply an ActionResult's commands to a doc (mirrors runAction's batching). */
const applyResult = (doc: BeatloungeDoc, commands: ReturnType<typeof clearAction.run>["commands"]) =>
  commands.reduce((d, c) => reduce(d, c), doc)

describe("step-grid actions — registry shape", () => {
  it("exposes exactly clear + fillEveryOther with valid impact", () => {
    expect(stepGridActions.map((a) => a.name).sort()).toEqual(["clear", "fillEveryOther"])
    for (const a of stepGridActions) {
      expect(["tweak", "mutate", "destructive"]).toContain(a.impact)
      expect(typeof a.describe).toBe("string")
      expect(typeof a.run).toBe("function")
    }
  })
})

describe("clear action", () => {
  it("returns a clearTrack command that empties the drum track", () => {
    const { doc, trackId } = seedDoc()
    const result = clearAction.run(ctx(doc, trackId), {})
    expect(result.commands).toEqual([{ t: "clearTrack", trackId }])

    const after = applyResult(doc, result.commands)
    const t = findTrack(after, trackId)
    expect(t && isInstrumentTrack(t) ? t.notes.length : -1).toBe(0)
  })
})

describe("fillEveryOther action", () => {
  it("returns valid toggleStep commands wrapped in one batch", () => {
    const { doc: seeded, trackId } = seedDoc()
    // Clear first: the default doc already has hats on every eighth (= every
    // even 1/16 step), so the fill would be a no-op on it.
    const doc = reduce(seeded, { t: "clearTrack", trackId })
    const result = fillEveryOtherAction.run(ctx(doc, trackId), {})
    expect(result.commands).toHaveLength(1)
    const batch = result.commands[0]
    expect(batch.t).toBe("batch")
    if (batch.t !== "batch") throw new Error("expected batch")
    for (const c of batch.commands) {
      expect(c.t).toBe("toggleStep")
      if (c.t !== "toggleStep") continue
      expect(c.trackId).toBe(trackId)
      expect(c.pitch).toBe(DRUM_PITCH.hat)
      expect(c.step % 2).toBe(0)
    }
  })

  it("results in a hat on every other step when applied through the bus", () => {
    const { doc, trackId } = seedDoc()
    const bus = createCommandBus(doc)
    const result = fillEveryOtherAction.run(ctx(doc, trackId), {})
    for (const cmd of result.commands) bus.dispatch(cmd)

    const after = bus.snapshot()
    const track = findTrack(after, trackId)!
    if (!isInstrumentTrack(track)) throw new Error("not instrument")
    const steps = stepsInLoop(after.loopLengthTicks, track.grid)
    for (let s = 0; s < steps; s += 2) {
      const tick = tickForStep(s, track.grid)
      const hit = track.notes.some((n) => n.tick === tick && n.pitch === DRUM_PITCH.hat)
      expect(hit).toBe(true)
    }
  })

  it("is idempotent: re-running adds nothing", () => {
    const { doc, trackId } = seedDoc()
    const bus = createCommandBus(doc)
    for (const c of fillEveryOtherAction.run(ctx(bus.snapshot(), trackId), {}).commands)
      bus.dispatch(c)
    const second = fillEveryOtherAction.run(ctx(bus.snapshot(), trackId), {})
    expect(second.commands).toHaveLength(0)
    expect(second.summary).toMatch(/nothing/i)
  })
})
