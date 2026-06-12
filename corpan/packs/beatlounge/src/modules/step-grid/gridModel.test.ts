import { describe, expect, it } from "vitest"
import { createDefaultDoc, findTrack, isInstrumentTrack, DRUM_PITCH } from "../../model/document"
import { stepForTick, tickForStep, stepsInLoop } from "../../model/timing"
import { buildGridView, buildMiniView, DRUM_LANES, MINI_LANE_COUNT } from "./gridModel"
import { KIT_PITCHES } from "../../rhythm"

const drumTrack = () => {
  const doc = createDefaultDoc(0)
  const track = doc.tracks.find(
    (t) => isInstrumentTrack(t) && t.instrument.kind === "drumSampler"
  )
  if (!track || !isInstrumentTrack(track)) throw new Error("no drum track")
  return { doc, track }
}

describe("step↔tick mapping used by the grid", () => {
  it("derives the visible step count from loop + grid", () => {
    const { doc, track } = drumTrack()
    const view = buildGridView(doc, track)
    expect(view.steps).toBe(stepsInLoop(doc.loopLengthTicks, track.grid))
    expect(view.steps).toBe(16) // one 4/4 bar at a 1/16 grid
  })

  it("round-trips step → tick → step on the track grid", () => {
    const { track } = drumTrack()
    for (let s = 0; s < 16; s++) {
      expect(stepForTick(tickForStep(s, track.grid), track.grid)).toBe(s)
    }
  })

  it("lights the kick lane on every beat (steps 0,4,8,12)", () => {
    const { doc, track } = drumTrack()
    const view = buildGridView(doc, track)
    const kick = view.lanes.find((l) => l.pitch === DRUM_PITCH.kick)!
    expect(kick.cells.filter((c) => c.on).map((_, i) => i)).not.toHaveLength(0)
    expect(kick.cells[0].on).toBe(true)
    expect(kick.cells[4].on).toBe(true)
    expect(kick.cells[8].on).toBe(true)
    expect(kick.cells[12].on).toBe(true)
    expect(kick.cells[2].on).toBe(false)
  })

  it("places snare on the backbeat (steps 4 and 12)", () => {
    const { doc, track } = drumTrack()
    const snare = buildGridView(doc, track).lanes.find(
      (l) => l.pitch === DRUM_PITCH.snare
    )!
    expect(snare.cells[4].on).toBe(true)
    expect(snare.cells[12].on).toBe(true)
    expect(snare.cells[0].on).toBe(false)
  })

  it("computes stepsPerBeat from the grid denominator", () => {
    const { doc, track } = drumTrack()
    expect(buildGridView(doc, track).stepsPerBeat).toBe(4) // 1/16 grid
  })

  it("mini view exposes only the top lanes (calm tile subset)", () => {
    const { doc, track } = drumTrack()
    const mini = buildMiniView(doc, track)
    expect(mini.lanes).toHaveLength(MINI_LANE_COUNT)
    expect(mini.lanes.map((l) => l.pitch)).toEqual(
      DRUM_LANES.slice(0, MINI_LANE_COUNT).map((l) => l.pitch)
    )
  })

  it("renders a lane for EVERY voice the kit triggers (full kit, not just 4)", () => {
    const { doc, track } = drumTrack()
    const lanes = buildGridView(doc, track).lanes
    // The full kit is many more than kick/snare/hat/clap.
    expect(lanes.length).toBeGreaterThanOrEqual(16)
    // Every distinct kit pitch a groove role can resolve to has a visible lane,
    // so no groove hit is ever invisible/un-editable.
    const lanePitches = new Set(lanes.map((l) => l.pitch))
    for (const p of KIT_PITCHES) expect(lanePitches.has(p)).toBe(true)
  })

  it("orders lanes musically (kick first, then snare)", () => {
    const { doc, track } = drumTrack()
    const lanes = buildGridView(doc, track).lanes
    expect(lanes[0].label).toBe("Kick")
    expect(lanes[1].label).toBe("Snare")
    // toms / ride / cowbell / conga all present and editable.
    const labels = lanes.map((l) => l.label)
    for (const l of ["Ride", "Crash", "Hi Tom", "Lo Tom", "Conga", "Cowbell"])
      expect(labels).toContain(l)
  })

  it("has no duplicate lane pitches", () => {
    const { doc, track } = drumTrack()
    const pitches = buildGridView(doc, track).lanes.map((l) => l.pitch)
    expect(new Set(pitches).size).toBe(pitches.length)
  })
})

describe("findTrack sanity", () => {
  it("resolves the drum track by id", () => {
    const { doc, track } = drumTrack()
    expect(findTrack(doc, track.id)?.id).toBe(track.id)
  })
})
