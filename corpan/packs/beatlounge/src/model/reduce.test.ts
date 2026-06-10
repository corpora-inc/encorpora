import { describe, expect, it } from "vitest"
import {
  createDefaultDoc,
  DRUM_PITCH,
  isInstrumentTrack,
  type InstrumentTrack,
} from "./document"
import { reduce } from "./reduce"
import { tickForStep } from "./timing"

const doc0 = () => createDefaultDoc(0)
const drumTrack = (d = doc0()) => d.tracks[0] as InstrumentTrack

describe("reduce — purity & structural sharing", () => {
  it("never mutates the input doc", () => {
    const a = doc0()
    const before = JSON.stringify(a)
    reduce(a, { t: "setTempo", bpm: 140 })
    expect(JSON.stringify(a)).toBe(before)
  })

  it("shares untouched tracks by reference", () => {
    const a = doc0()
    const b = reduce(a, { t: "setTrackProp", trackId: a.tracks[0].id, prop: "mute", value: true })
    expect(b).not.toBe(a)
    expect(b.tracks[1]).toBe(a.tracks[1]) // untouched track shared
    expect(b.tracks[0]).not.toBe(a.tracks[0])
  })

  it("returns the same doc for a no-op", () => {
    const a = doc0()
    const b = reduce(a, { t: "removeNote", trackId: a.tracks[0].id, noteId: "nope" })
    expect(b).toBe(a)
  })
})

describe("reduce — transport", () => {
  it("clamps tempo", () => {
    expect(reduce(doc0(), { t: "setTempo", bpm: 5 }).bpm).toBe(20)
    expect(reduce(doc0(), { t: "setTempo", bpm: 9999 }).bpm).toBe(300)
  })
  it("clamps master volume", () => {
    expect(reduce(doc0(), { t: "setMasterVolume", v: 2 }).masterVolume).toBe(1)
    expect(reduce(doc0(), { t: "setMasterVolume", v: -1 }).masterVolume).toBe(0)
  })
  it("sets swing amount", () => {
    expect(reduce(doc0(), { t: "setSwing", amount: 0.4 }).swing.amount).toBe(0.4)
  })
})

describe("reduce — notes", () => {
  it("adds a note, kept tick-sorted", () => {
    const a = doc0()
    const t = drumTrack(a)
    const b = reduce(a, {
      t: "addNote",
      trackId: t.id,
      note: { tick: 5000, duration: 120, pitch: DRUM_PITCH.clap, velocity: 0.8 },
    })
    const nt = b.tracks[0] as InstrumentTrack
    expect(nt.notes.length).toBe(t.notes.length + 1)
    const ticks = nt.notes.map((n) => n.tick)
    expect(ticks).toEqual([...ticks].sort((x, y) => x - y))
    expect(nt.notes.every((n) => typeof n.id === "string" && n.id.length > 0)).toBe(true)
  })

  it("toggleStep adds then removes the same cell", () => {
    const a = doc0()
    const t = drumTrack(a)
    const tick = tickForStep(3, t.grid)
    const on = reduce(a, { t: "toggleStep", trackId: t.id, step: 3, pitch: DRUM_PITCH.snare })
    const onT = on.tracks[0] as InstrumentTrack
    expect(onT.notes.some((n) => n.tick === tick && n.pitch === DRUM_PITCH.snare)).toBe(true)
    const off = reduce(on, { t: "toggleStep", trackId: t.id, step: 3, pitch: DRUM_PITCH.snare })
    const offT = off.tracks[0] as InstrumentTrack
    expect(offT.notes.some((n) => n.tick === tick && n.pitch === DRUM_PITCH.snare)).toBe(false)
  })

  it("editNote re-sorts when tick changes", () => {
    const a = doc0()
    const t = drumTrack(a)
    const first = t.notes[0]
    const b = reduce(a, {
      t: "editNote",
      trackId: t.id,
      noteId: first.id,
      patch: { tick: 999999 },
    })
    const nt = b.tracks[0] as InstrumentTrack
    const ticks = nt.notes.map((n) => n.tick)
    expect(ticks).toEqual([...ticks].sort((x, y) => x - y))
  })

  it("clearTrack empties notes", () => {
    const a = doc0()
    const t = drumTrack(a)
    const b = reduce(a, { t: "clearTrack", trackId: t.id })
    expect((b.tracks[0] as InstrumentTrack).notes.length).toBe(0)
  })

  it("setNotes replaces and assigns fresh ids", () => {
    const a = doc0()
    const t = drumTrack(a)
    const b = reduce(a, {
      t: "setNotes",
      trackId: t.id,
      notes: [
        { tick: 480, duration: 120, pitch: 36, velocity: 1 },
        { tick: 0, duration: 120, pitch: 38, velocity: 1 },
      ],
    })
    const nt = b.tracks[0] as InstrumentTrack
    expect(nt.notes.map((n) => n.tick)).toEqual([0, 480])
    expect(new Set(nt.notes.map((n) => n.id)).size).toBe(2)
  })
})

describe("reduce — tracks & effects", () => {
  it("adds and removes a track", () => {
    const a = doc0()
    const added = reduce(a, {
      t: "addTrack",
      track: {
        kind: "instrument",
        name: "Bass",
        grid: { denominator: 16 },
        volume: 0.8,
        pan: 0,
        mute: false,
        solo: false,
        inserts: [],
        sends: [],
        automation: [],
        instrument: { kind: "fmSynth", harmonicity: 1, modIndex: 5, env: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.3 } },
        notes: [],
      },
    })
    expect(added.tracks.length).toBe(a.tracks.length + 1)
    const id = added.tracks[added.tracks.length - 1].id
    const removed = reduce(added, { t: "removeTrack", trackId: id })
    expect(removed.tracks.length).toBe(a.tracks.length)
  })

  it("adds an insert effect with a fresh id, then sets params", () => {
    const a = doc0()
    const t = drumTrack(a)
    const withFx = reduce(a, {
      t: "addInsert",
      trackId: t.id,
      effect: { kind: "filter", enabled: true, params: { frequency: 800 } },
    })
    const fx = (withFx.tracks[0] as InstrumentTrack).inserts[0]
    expect(fx.kind).toBe("filter")
    expect(fx.id).toBeTruthy()
    const tuned = reduce(withFx, {
      t: "setEffectParams",
      trackId: t.id,
      insertId: fx.id,
      params: { frequency: 1200 },
      enabled: false,
    })
    const fx2 = (tuned.tracks[0] as InstrumentTrack).inserts[0]
    expect(fx2.params.frequency).toBe(1200)
    expect(fx2.enabled).toBe(false)
  })
})

describe("reduce — batch", () => {
  it("applies commands in order atomically", () => {
    const a = doc0()
    const t = drumTrack(a)
    const b = reduce(a, {
      t: "batch",
      commands: [
        { t: "setTempo", bpm: 128 },
        { t: "clearTrack", trackId: t.id },
        { t: "addNote", trackId: t.id, note: { tick: 0, duration: 120, pitch: 36, velocity: 1 } },
      ],
    })
    expect(b.bpm).toBe(128)
    expect((b.tracks[0] as InstrumentTrack).notes.length).toBe(1)
  })
})

describe("default doc", () => {
  it("is musically alive and valid", () => {
    const d = doc0()
    expect(d.schema).toBe(1)
    expect(d.tracks.length).toBeGreaterThanOrEqual(2)
    expect(d.tracks.every((t) => t.id)).toBe(true)
    const drums = d.tracks.find((t) => t.name === "Drums") as InstrumentTrack
    expect(isInstrumentTrack(drums)).toBe(true)
    // four kicks
    expect(drums.notes.filter((n) => n.pitch === DRUM_PITCH.kick).length).toBe(4)
    // notes are tick-sorted
    const ticks = drums.notes.map((n) => n.tick)
    expect(ticks).toEqual([...ticks].sort((x, y) => x - y))
  })
})
