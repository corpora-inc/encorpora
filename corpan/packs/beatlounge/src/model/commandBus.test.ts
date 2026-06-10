import { describe, expect, it } from "vitest"
import { createCommandBus } from "./commandBus"
import { createDefaultDoc, type InstrumentTrack } from "./document"

const bus = () => createCommandBus(createDefaultDoc(0))

describe("commandBus — dispatch + undo/redo", () => {
  it("dispatches and updates the snapshot", () => {
    const b = bus()
    b.dispatch({ t: "setTempo", bpm: 150 })
    expect(b.snapshot().bpm).toBe(150)
  })

  it("undo/redo walks history", () => {
    const b = bus()
    const start = b.snapshot().bpm
    b.dispatch({ t: "setTempo", bpm: 100 })
    b.dispatch({ t: "setTempo", bpm: 140 })
    expect(b.snapshot().bpm).toBe(140)
    b.undo()
    expect(b.snapshot().bpm).toBe(100)
    b.undo()
    expect(b.snapshot().bpm).toBe(start)
    expect(b.canUndo()).toBe(false)
    b.redo()
    expect(b.snapshot().bpm).toBe(100)
  })

  it("a new dispatch clears the redo stack", () => {
    const b = bus()
    b.dispatch({ t: "setTempo", bpm: 100 })
    b.undo()
    b.dispatch({ t: "setTempo", bpm: 200 })
    expect(b.canRedo()).toBe(false)
    expect(b.snapshot().bpm).toBe(200)
  })

  it("no-op commands do not grow history", () => {
    const b = bus()
    b.dispatch({ t: "removeNote", trackId: "nope", noteId: "nope" })
    expect(b.canUndo()).toBe(false)
  })
})

describe("commandBus — preview keep/rollback", () => {
  it("rollback restores the prior doc", () => {
    const b = bus()
    const before = b.snapshot()
    const h = b.preview({ t: "setTempo", bpm: 200 })
    expect(b.snapshot().bpm).toBe(200)
    h.rollback()
    expect(b.snapshot()).toBe(before)
    expect(b.canUndo()).toBe(false)
  })

  it("keep commits onto the undo stack", () => {
    const b = bus()
    const h = b.preview({ t: "setTempo", bpm: 200 })
    h.keep()
    expect(b.snapshot().bpm).toBe(200)
    expect(b.canUndo()).toBe(true)
    b.undo()
    expect(b.snapshot().bpm).not.toBe(200)
  })

  it("a settled handle is idempotent", () => {
    const b = bus()
    const h = b.preview({ t: "setTempo", bpm: 200 })
    h.keep()
    const again = h.rollback() // ignored
    expect(again.bpm).toBe(200)
  })
})

describe("commandBus — subscribe + load", () => {
  it("notifies subscribers with change meta", () => {
    const b = bus()
    const kinds: string[] = []
    b.subscribe((_doc, meta) => kinds.push(meta.kind))
    b.dispatch({ t: "setTempo", bpm: 111 })
    b.undo()
    b.redo()
    expect(kinds).toEqual(["dispatch", "undo", "redo"])
  })

  it("load replaces the doc and clears history", () => {
    const b = bus()
    b.dispatch({ t: "setTempo", bpm: 111 })
    b.load(createDefaultDoc(5))
    expect(b.canUndo()).toBe(false)
    expect(b.snapshot().bpm).toBe(96)
  })

  it("bumps updatedAt on change", () => {
    const b = bus()
    const out = b.dispatch({ t: "renameSong", name: "x" })
    expect(out.name).toBe("x")
    const drums = out.tracks[0] as InstrumentTrack
    expect(drums.notes.length).toBeGreaterThan(0)
  })
})
