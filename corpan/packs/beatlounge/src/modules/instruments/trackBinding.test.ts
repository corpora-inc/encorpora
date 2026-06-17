/**
 * beatlounge — Instruments-page track add / remove / rename + re-binding tests.
 *
 * Covers the pure binding helpers AND drives a real store so the add → bind,
 * remove → re-bind, last-track guard, and rename flows are exercised end-to-end
 * (no DOM). The drum-clobber guard (a drum track is never melodic) is asserted
 * too — this is the regression the retired synth-analog resolver test protected.
 */

import { describe, expect, it } from "vitest"
import { createCommandBus } from "../../model/commandBus"
import {
  createDefaultDoc,
  isInstrumentTrack,
  type BeatloungeDoc,
} from "../../model/document"
import { createBeatloungeStore } from "../../store/store"
import { newInstrumentTrackInit } from "./addTrack"
import {
  canRemoveTrack,
  isMelodicTrack,
  melodicTracks,
  rebindTrackId,
  trackIdAfterRemoval,
} from "./trackBinding"

const makeStore = (doc: BeatloungeDoc = createDefaultDoc(0)) =>
  createBeatloungeStore(createCommandBus(doc))

const melodicIds = (s: ReturnType<typeof makeStore>) =>
  melodicTracks(s.vanilla.getState().doc.tracks).map((t) => t.id)

describe("isMelodicTrack — drum-clobber guard", () => {
  it("excludes the drum (drumSampler) track", () => {
    const doc = createDefaultDoc(0)
    const drum = doc.tracks.find(
      (t) => isInstrumentTrack(t) && t.instrument.kind === "drumSampler"
    )!
    expect(isMelodicTrack(drum)).toBe(false)
    // the default doc has exactly one melodic track (Synth)
    expect(melodicTracks(doc.tracks).map((t) => t.name)).toEqual(["Synth"])
  })
})

describe("rebindTrackId", () => {
  it("keeps the current binding when it is still melodic", () => {
    const doc = createDefaultDoc(0)
    const synth = melodicTracks(doc.tracks)[0]
    expect(rebindTrackId(doc.tracks, synth.id)).toBe(synth.id)
  })
  it("re-binds to the first melodic track when the bound one vanished", () => {
    const doc = createDefaultDoc(0)
    const synth = melodicTracks(doc.tracks)[0]
    expect(rebindTrackId(doc.tracks, "gone")).toBe(synth.id)
  })
  it("never binds to a drum track even if asked", () => {
    const doc = createDefaultDoc(0)
    const drum = doc.tracks.find(
      (t) => isInstrumentTrack(t) && t.instrument.kind === "drumSampler"
    )!
    expect(rebindTrackId(doc.tracks, drum.id)).not.toBe(drum.id)
  })
})

describe("add → bind", () => {
  it("adds a fresh melodic synth track and yields its id to bind", () => {
    const store = makeStore()
    const before = melodicIds(store)
    const init = newInstrumentTrackInit(store.vanilla.getState().doc.tracks.map((t) => t.name))
    store.dispatch({ t: "addTrack", track: init })
    const after = melodicIds(store)
    expect(after).toHaveLength(before.length + 1)
    expect(after).toContain(init.id)
    // the new track is a re-bindable melodic voice
    expect(rebindTrackId(store.vanilla.getState().doc.tracks, init.id)).toBe(init.id)
    store.dispose()
  })
})

describe("remove → guard + re-bind", () => {
  it("refuses to remove the LAST melodic track", () => {
    const store = makeStore()
    const [only] = melodicIds(store)
    expect(canRemoveTrack(store.vanilla.getState().doc.tracks, only)).toBe(false)
    store.dispose()
  })

  it("removes a non-last melodic track and re-binds to the survivor", () => {
    const store = makeStore()
    // add a second melodic track so removal is allowed
    const init = newInstrumentTrackInit(store.vanilla.getState().doc.tracks.map((t) => t.name))
    store.dispatch({ t: "addTrack", track: init })
    const tracks = store.vanilla.getState().doc.tracks
    const [first] = melodicTracks(tracks)
    expect(canRemoveTrack(tracks, init.id!)).toBe(true)

    // the bound track is the new one; removing it should re-bind to `first`
    const next = trackIdAfterRemoval(tracks, init.id, init.id!)
    expect(next).toBe(first.id)
    store.dispatch({ t: "removeTrack", trackId: init.id! })
    expect(melodicIds(store)).toEqual([first.id])
    expect(rebindTrackId(store.vanilla.getState().doc.tracks, init.id)).toBe(first.id)
    store.dispose()
  })

  it("keeps the binding when removing a DIFFERENT track than the bound one", () => {
    const store = makeStore()
    const init = newInstrumentTrackInit(store.vanilla.getState().doc.tracks.map((t) => t.name))
    store.dispatch({ t: "addTrack", track: init })
    const tracks = store.vanilla.getState().doc.tracks
    const [first] = melodicTracks(tracks)
    // bound = first; removing the OTHER (init) keeps first bound
    expect(trackIdAfterRemoval(tracks, first.id, init.id!)).toBe(first.id)
    store.dispose()
  })
})

describe("rename", () => {
  it("renames a track via setTrackProp without changing its id (binding holds)", () => {
    const store = makeStore()
    const [id] = melodicIds(store)
    store.dispatch({ t: "setTrackProp", trackId: id, prop: "name", value: "Bassline" })
    const t = store.vanilla.getState().doc.tracks.find((x) => x.id === id)!
    expect(t.name).toBe("Bassline")
    // same id → still bound
    expect(rebindTrackId(store.vanilla.getState().doc.tracks, id)).toBe(id)
    store.dispose()
  })
})
