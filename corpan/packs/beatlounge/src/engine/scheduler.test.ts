import { describe, expect, it } from "vitest"
import { collectTriggers, occurrencesInWindow, trackLength } from "./scheduler"
import { DRUM_PITCH, createDefaultDoc, type InstrumentTrack } from "../model/document"
import { reduce } from "../model/reduce"
import { PPQ } from "../model/timing"
import { stockLoopDoc } from "../testing/stockLoop"

describe("occurrencesInWindow", () => {
  it("finds the in-window occurrence of a once-per-loop event", () => {
    // event at tick 0, loop 3840; window [0,3840) → one occurrence at 0
    expect(occurrencesInWindow(0, 3840, 0, 3840)).toEqual([0])
  })
  it("repeats across loops", () => {
    // event at tick 480, loop 960; window [0, 4000) → 480,1440,2400,3360
    expect(occurrencesInWindow(480, 960, 0, 4000)).toEqual([480, 1440, 2400, 3360])
  })
  it("excludes the window end (half-open)", () => {
    expect(occurrencesInWindow(0, 960, 0, 960)).toEqual([0])
    expect(occurrencesInWindow(0, 960, 960, 1920)).toEqual([960])
  })
  it("returns nothing for an empty window", () => {
    expect(occurrencesInWindow(0, 960, 100, 100)).toEqual([])
  })
})

describe("collectTriggers — the pure scheduling core", () => {
  it("schedules the stock loop's kicks on the beats", () => {
    const doc = stockLoopDoc()
    const bar = PPQ * 4
    const planned = collectTriggers(doc, 0, bar)
    const kicks = planned
      .filter((p) => p.note.pitch === DRUM_PITCH.kick)
      .map((p) => p.scheduledTick)
      .sort((a, b) => a - b)
    expect(kicks).toEqual([0, 960, 1920, 2880])
  })

  it("is sorted by scheduled tick", () => {
    const doc = stockLoopDoc()
    const planned = collectTriggers(doc, 0, PPQ * 4)
    const ticks = planned.map((p) => p.scheduledTick)
    expect(ticks).toEqual([...ticks].sort((a, b) => a - b))
  })

  it("repeats the loop across multiple bars", () => {
    const doc = stockLoopDoc()
    const bar = PPQ * 4
    const oneBar = collectTriggers(doc, 0, bar).length
    const twoBars = collectTriggers(doc, 0, bar * 2).length
    expect(twoBars).toBe(oneBar * 2)
  })

  it("applies swing as a positive offset to off-cells only", () => {
    const doc = reduce(stockLoopDoc(), { t: "setSwing", amount: 0.5, grid: { denominator: 8 } })
    const planned = collectTriggers(doc, 0, PPQ * 4)
    // The hat on the off-eighth (tick 480) should be pushed later than 480.
    const offHat = planned.find((p) => p.baseTick === 480 && p.note.pitch === DRUM_PITCH.hat)
    expect(offHat).toBeDefined()
    expect(offHat!.scheduledTick).toBeGreaterThan(480)
    // The downbeat hat (tick 0) is an on-cell — unchanged.
    const onHat = planned.find((p) => p.baseTick === 0 && p.note.pitch === DRUM_PITCH.hat)
    expect(onHat!.scheduledTick).toBe(0)
  })

  it("respects per-track length for polymeter", () => {
    let doc = stockLoopDoc()
    // Give the synth track a 3-beat loop against the 4-beat song loop.
    const synth = doc.tracks[1] as InstrumentTrack
    doc = reduce(doc, { t: "setTrackProp", trackId: synth.id, prop: "lengthTicks", value: PPQ * 3 })
    const t = doc.tracks[1] as InstrumentTrack
    expect(trackLength(doc, t)).toBe(PPQ * 3)
    // Over 12 beats (LCM of 3 and 4), the 3-beat synth pattern repeats 4×.
    const planned = collectTriggers(doc, 0, PPQ * 12).filter((p) => p.trackId === synth.id)
    const firstNoteHits = planned.filter((p) => p.baseTick % (PPQ * 3) === 0)
    expect(firstNoteHits.length).toBe(4)
  })

  it("velocity and duration ride along", () => {
    const doc = stockLoopDoc()
    const planned = collectTriggers(doc, 0, PPQ * 4)
    expect(planned.length).toBeGreaterThan(0)
    expect(planned.every((p) => p.note.velocity > 0 && p.note.durationSec > 0)).toBe(true)
  })
})

describe("collectTriggers — microtonal detune from the active tuning (#415)", () => {
  const withNotes = (doc: ReturnType<typeof createDefaultDoc>, pitches: number[]) => {
    const tid = (doc.tracks[1] as InstrumentTrack).id
    return reduce(doc, {
      t: "setNotes",
      trackId: tid,
      notes: pitches.map((pitch, i) => ({ tick: i * PPQ, duration: PPQ, pitch, velocity: 0.8 })),
    })
  }
  const detuneOf = (doc: ReturnType<typeof createDefaultDoc>, pitch: number) =>
    collectTriggers(doc, 0, doc.loopLengthTicks).find((p) => p.note.pitch === pitch)?.note.detuneCents

  it("attaches the maqam's neutral-tone detune to scheduled notes (Rast)", () => {
    let d = reduce(createDefaultDoc(0), { t: "setHarmonyMode", mode: "modal" })
    d = reduce(d, { t: "setScale", family: "maqam", id: "maqam.rast" })
    d = withNotes(d, [60, 64]) // tonic C, and the 12-TET major third E
    expect(detuneOf(d, 60) ?? 0).toBeCloseTo(0, 0) // tonic ~ in tune
    expect(detuneOf(d, 64)!).toBeLessThan(-20) // bends DOWN to Rast's neutral 3rd
  })

  it("a plain 12-TET doc emits zero detune (backward-compatible)", () => {
    const d = withNotes(createDefaultDoc(0), [64])
    expect(detuneOf(d, 64) ?? 0).toBe(0)
  })
})
