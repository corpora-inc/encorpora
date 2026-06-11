/**
 * beatlounge — synth-analog DRUM-CLOBBER GUARD tests.
 *
 * Regression for the founder's data-wrecking bug: the analog synth treated the
 * DRUM track (an InstrumentTrack with instrument.kind === "drumSampler") as a
 * valid melodic target. Selecting it + "Make analog" dispatched setInstrument
 * and TURNED THE DRUM TRACK INTO A SYNTH — destroying the drums ("no drum
 * track"). These tests prove the analog surface:
 *   1. never RESOLVES to a drum track, and
 *   2. when only a drum track exists, "make analog" ADDS A NEW synth track and
 *      makes THAT analog — leaving the drum track fully intact.
 */

import { describe, expect, it } from "vitest"
import { createCommandBus } from "../../model/commandBus"
import {
  createDefaultDoc,
  isInstrumentTrack,
  type BeatloungeDoc,
} from "../../model/document"
import { createBeatloungeStore } from "../../store/store"
import { newInstrumentTrackInit } from "../instruments/addTrack"
import { resolveAnalogTrackId } from "./index"

const isDrum = (kind: string) => kind === "drumSampler"

/** A doc with ONLY a drum track (the synth removed) — the pathological case. */
const drumOnlyDoc = (): BeatloungeDoc => {
  const doc = createDefaultDoc(0)
  const drums = doc.tracks.filter(
    (t) => isInstrumentTrack(t) && isDrum(t.instrument.kind)
  )
  expect(drums).toHaveLength(1)
  return { ...doc, tracks: drums }
}

const makeStore = (doc: BeatloungeDoc) => {
  const bus = createCommandBus(doc)
  return createBeatloungeStore(bus)
}

const drumTrackOf = (store: ReturnType<typeof createBeatloungeStore>) => {
  const drum = store.vanilla
    .getState()
    .doc.tracks.find((t) => isInstrumentTrack(t) && isDrum(t.instrument.kind))
  if (!drum || !isInstrumentTrack(drum)) throw new Error("expected a drum track")
  return drum
}

describe("resolveAnalogTrackId — never targets a drum track", () => {
  it("returns the melodic synth track in a normal song (not the drums)", () => {
    const store = makeStore(createDefaultDoc(0))
    const id = resolveAnalogTrackId(store)
    const doc = store.vanilla.getState().doc
    const resolved = doc.tracks.find((t) => t.id === id)
    expect(resolved).toBeTruthy()
    expect(isInstrumentTrack(resolved!)).toBe(true)
    if (resolved && isInstrumentTrack(resolved)) {
      expect(isDrum(resolved.instrument.kind)).toBe(false)
    }
    store.dispose()
  })

  it("returns UNDEFINED when the only instrument track is a drum track", () => {
    const store = makeStore(drumOnlyDoc())
    expect(resolveAnalogTrackId(store)).toBeUndefined()
    store.dispose()
  })

  it("ignores a drum-track mount fallback and resolves to nothing (drum-only)", () => {
    const store = makeStore(drumOnlyDoc())
    const drumId = drumTrackOf(store).id
    // Even if the host hands us the drum track id, we refuse it.
    expect(resolveAnalogTrackId(store, drumId)).toBeUndefined()
    store.dispose()
  })
})

describe("make analog with only a drum track — CREATE, never clobber", () => {
  it("adds a NEW synth track and leaves the drum track intact", () => {
    const store = makeStore(drumOnlyDoc())
    const drumBefore = drumTrackOf(store)
    expect(drumBefore.instrument.kind).toBe("drumSampler")

    // Reproduce exactly what SynthAnalogImmersive.createAndMakeAnalog dispatches.
    const melodicCount = store.vanilla
      .getState()
      .doc.tracks.filter(
        (t) => isInstrumentTrack(t) && !isDrum(t.instrument.kind)
      ).length
    const init = newInstrumentTrackInit(melodicCount)
    store.dispatch({ t: "addTrack", track: init })
    store.dispatch({
      t: "setInstrument",
      trackId: init.id!,
      config: { kind: "analogSynth", preset: "init", params: {} },
    })

    const doc = store.vanilla.getState().doc
    // The drum track still exists and is STILL a drumSampler (NOT clobbered).
    const drumAfter = doc.tracks.find((t) => t.id === drumBefore.id)
    expect(drumAfter).toBeTruthy()
    expect(isInstrumentTrack(drumAfter!)).toBe(true)
    if (drumAfter && isInstrumentTrack(drumAfter)) {
      expect(drumAfter.instrument.kind).toBe("drumSampler")
    }

    // A brand-new analog synth track was added (the drums were never touched).
    const newTrack = doc.tracks.find((t) => t.id === init.id)
    expect(newTrack).toBeTruthy()
    if (newTrack && isInstrumentTrack(newTrack)) {
      expect(newTrack.instrument.kind).toBe("analogSynth")
    }
    expect(doc.tracks).toHaveLength(2)

    // And NOW the resolver finds that new analog track — never the drums.
    expect(resolveAnalogTrackId(store)).toBe(init.id)
    store.dispose()
  })
})
