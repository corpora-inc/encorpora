/**
 * beatlounge — the piano-roll ("Synth" editor) must target MELODIC tracks only.
 *
 * The synth editors (instruments / piano-roll / analog) all agree: a melodic
 * track is an InstrumentTrack whose instrument is NOT a drumSampler. The roll
 * must resolve to a synth track and never to the drums (voicing/clearing the
 * drum track here would wreck the kit). Mirrors synth-analog/resolver.test.ts.
 */

import { describe, expect, it } from "vitest"
import { createCommandBus } from "../../model/commandBus"
import {
  createDefaultDoc,
  isInstrumentTrack,
  type BeatloungeDoc,
} from "../../model/document"
import { createBeatloungeStore } from "../../store/store"
import { resolveMelodicTrackId } from "./index"

const isDrum = (kind: string) => kind === "drumSampler"

const makeStore = (doc: BeatloungeDoc) => createBeatloungeStore(createCommandBus(doc))

/** A doc with ONLY a drum track (the melodic synth removed). */
const drumOnlyDoc = (): BeatloungeDoc => {
  const doc = createDefaultDoc(0)
  const drums = doc.tracks.filter(
    (t) => isInstrumentTrack(t) && isDrum(t.instrument.kind)
  )
  expect(drums).toHaveLength(1)
  return { ...doc, tracks: drums }
}

describe("resolveMelodicTrackId — the Synth editor targets melodic tracks only", () => {
  it("resolves to the melodic synth track in a normal song (never the drums)", () => {
    const store = makeStore(createDefaultDoc(0))
    const id = resolveMelodicTrackId(store)
    const resolved = store.vanilla.getState().doc.tracks.find((t) => t.id === id)
    expect(resolved).toBeTruthy()
    expect(isInstrumentTrack(resolved!)).toBe(true)
    if (resolved && isInstrumentTrack(resolved)) {
      expect(isDrum(resolved.instrument.kind)).toBe(false)
    }
    store.dispose()
  })

  it("returns UNDEFINED when the only instrument track is the drums", () => {
    const store = makeStore(drumOnlyDoc())
    expect(resolveMelodicTrackId(store)).toBeUndefined()
    store.dispose()
  })
})
