import { describe, expect, it } from "vitest"
import { createCommandBus } from "../model/commandBus"
import { createDefaultDoc, findTrack, isInstrumentTrack } from "../model/document"
import { createBeatloungeStore } from "./store"

const makeStore = () => {
  const bus = createCommandBus(createDefaultDoc(0))
  return { bus, store: createBeatloungeStore(bus) }
}

const drumId = (store: ReturnType<typeof createBeatloungeStore>): string => {
  const doc = store.vanilla.getState().doc
  const drum = doc.tracks.find(
    (t) => isInstrumentTrack(t) && t.instrument.kind === "drumSampler"
  )
  if (!drum) throw new Error("no drum track")
  return drum.id
}

describe("store — dispatch mirrors the bus doc", () => {
  it("reflects a dispatched command in state.doc", () => {
    const { store } = makeStore()
    expect(store.vanilla.getState().doc.bpm).toBe(96)
    store.dispatch({ t: "setTempo", bpm: 128 })
    expect(store.vanilla.getState().doc.bpm).toBe(128)
    store.dispose()
  })

  it("tracks canUndo / canRedo", () => {
    const { store } = makeStore()
    expect(store.vanilla.getState().canUndo).toBe(false)
    store.dispatch({ t: "setTempo", bpm: 100 })
    expect(store.vanilla.getState().canUndo).toBe(true)
    expect(store.vanilla.getState().canRedo).toBe(false)
    store.dispose()
  })
})

describe("store — undo / redo", () => {
  it("undo restores the prior doc, redo re-applies", () => {
    const { store } = makeStore()
    store.dispatch({ t: "setTempo", bpm: 140 })
    expect(store.vanilla.getState().doc.bpm).toBe(140)

    store.undo()
    expect(store.vanilla.getState().doc.bpm).toBe(96)
    expect(store.vanilla.getState().canRedo).toBe(true)

    store.redo()
    expect(store.vanilla.getState().doc.bpm).toBe(140)
    store.dispose()
  })

  it("toggleStep adds then removes a note (undo-able)", () => {
    const { store } = makeStore()
    const trackId = drumId(store)
    const before = noteCount(store, trackId)

    store.dispatch({ t: "toggleStep", trackId, step: 5, pitch: 42, velocity: 0.6 })
    expect(noteCount(store, trackId)).toBe(before + 1)

    store.dispatch({ t: "toggleStep", trackId, step: 5, pitch: 42 })
    expect(noteCount(store, trackId)).toBe(before)

    store.undo() // undo the removal
    expect(noteCount(store, trackId)).toBe(before + 1)
    store.dispose()
  })
})

const noteCount = (
  store: ReturnType<typeof createBeatloungeStore>,
  trackId: string
): number => {
  const t = findTrack(store.vanilla.getState().doc, trackId)
  return t && isInstrumentTrack(t) ? t.notes.length : -1
}
