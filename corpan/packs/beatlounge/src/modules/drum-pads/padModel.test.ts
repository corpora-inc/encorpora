import { describe, expect, it } from "vitest"
import {
  createDefaultDoc,
  DRUM_PITCH,
  isInstrumentTrack,
  type BeatloungeDoc,
  type InstrumentTrack,
} from "../../model/document"
import { stepForTick, stepsInLoop, tickForStep } from "../../model/timing"
import {
  buildPadView,
  PAD_BANK,
  recordStep,
  visiblePadCount,
} from "./padModel"
import { withStockDrums } from "../../testing/stockLoop"

const drumTrack = (): { doc: BeatloungeDoc; track: InstrumentTrack } => {
  const doc = withStockDrums(createDefaultDoc(0))
  const track = doc.tracks.find(
    (t) => isInstrumentTrack(t) && t.instrument.kind === "drumSampler"
  )
  if (!track || !isInstrumentTrack(track)) throw new Error("no drum track")
  return { doc, track }
}

describe("pad bank layout", () => {
  it("has 16 pads and includes the canonical kit pitches", () => {
    expect(PAD_BANK).toHaveLength(16)
    const pitches = PAD_BANK.map((p) => p.pitch)
    for (const p of [DRUM_PITCH.kick, DRUM_PITCH.snare, DRUM_PITCH.hat, DRUM_PITCH.clap]) {
      expect(pitches).toContain(p)
    }
  })
  it("has unique pitches per pad", () => {
    const pitches = PAD_BANK.map((p) => p.pitch)
    expect(new Set(pitches).size).toBe(pitches.length)
  })
})

describe("visiblePadCount", () => {
  it("shows 8 on phone and 16 on tablet/desktop", () => {
    expect(visiblePadCount("phone")).toBe(8)
    expect(visiblePadCount("tablet")).toBe(16)
    expect(visiblePadCount("desktop")).toBe(16)
  })
})

describe("buildPadView — counts + live glow", () => {
  it("counts the default kit hits per lane", () => {
    const { doc, track } = drumTrack()
    const view = buildPadView(doc, track)
    expect(view.steps).toBe(stepsInLoop(doc.loopLengthTicks, track.grid))
    const kick = view.pads.find((p) => p.pitch === DRUM_PITCH.kick)!
    expect(kick.count).toBe(4) // four-on-the-floor
    const snare = view.pads.find((p) => p.pitch === DRUM_PITCH.snare)!
    expect(snare.count).toBe(2) // backbeat
  })

  it("lights pads with a hit on the live playhead step (kick fires on step 0)", () => {
    const { doc, track } = drumTrack()
    const view = buildPadView(doc, track, 0)
    const kick = view.pads.find((p) => p.pitch === DRUM_PITCH.kick)!
    expect(kick.liveHit).toBe(true)
    const snare = view.pads.find((p) => p.pitch === DRUM_PITCH.snare)!
    expect(snare.liveHit).toBe(false) // snare is on the backbeat, not step 0
  })

  it("no pad is live when the playhead is stopped (-1)", () => {
    const { doc, track } = drumTrack()
    const view = buildPadView(doc, track, -1)
    expect(view.pads.some((p) => p.liveHit)).toBe(false)
  })

  it("snare lights on its backbeat step", () => {
    const { doc, track } = drumTrack()
    // The snare sits at beat 2 (tick = PPQ). Find its step on the grid.
    const snareTick = track.notes.find((n) => n.pitch === DRUM_PITCH.snare)!.tick
    const snareStep = stepForTick(snareTick, track.grid)
    const view = buildPadView(doc, track, snareStep)
    const snare = view.pads.find((p) => p.pitch === DRUM_PITCH.snare)!
    expect(snare.liveHit).toBe(true)
    // sanity: the tick round-trips
    expect(tickForStep(snareStep, track.grid)).toBe(snareTick)
  })
})

describe("recordStep — where a pad-tap records", () => {
  it("records at step 0 when stopped", () => {
    expect(recordStep(-1, 16)).toBe(0)
  })
  it("records at the live step, wrapped into the loop", () => {
    expect(recordStep(5, 16)).toBe(5)
    expect(recordStep(20, 16)).toBe(4)
  })
  it("is safe for an empty loop", () => {
    expect(recordStep(3, 0)).toBe(0)
  })
})
