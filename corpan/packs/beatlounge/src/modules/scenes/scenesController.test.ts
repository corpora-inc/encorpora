import { describe, expect, it } from "vitest"
import { createCommandBus } from "../../model/commandBus"
import { createDefaultDoc } from "../../model/document"
import { createScenesController } from "./scenesController"

const make = () => {
  const bus = createCommandBus(createDefaultDoc(1000))
  // Deterministic clock + seed so default names are reproducible.
  let t = 10_000
  const ctrl = createScenesController(bus, {
    now: () => (t += 1),
    seed: () => 42,
  })
  return { bus, ctrl }
}

describe("scenesController — save", () => {
  it("saves the current state as a scene + marks it active, not dirty", async () => {
    const { ctrl } = make()
    const scene = await ctrl.save()
    const st = ctrl.vanilla.getState()
    expect(st.scenes).toHaveLength(1)
    expect(st.activeSceneId).toBe(scene.id)
    expect(st.dirty).toBe(false)
    // default name format: "<date> · word-word"
    expect(scene.name).toMatch(/^\d{4}-\d{2}-\d{2} · [a-z]+-[a-z]+$/)
  })

  it("uses a provided name verbatim", async () => {
    const { ctrl } = make()
    const scene = await ctrl.save("My Drop")
    expect(scene.name).toBe("My Drop")
  })
})

describe("scenesController — dirty tracking", () => {
  it("flips dirty true when the live doc drifts from the active scene", async () => {
    const { bus, ctrl } = make()
    await ctrl.save()
    expect(ctrl.vanilla.getState().dirty).toBe(false)
    bus.dispatch({ t: "setTempo", bpm: 123 })
    expect(ctrl.vanilla.getState().dirty).toBe(true)
  })

  it("is not dirty with no active scene", () => {
    const { bus, ctrl } = make()
    bus.dispatch({ t: "setTempo", bpm: 140 })
    expect(ctrl.vanilla.getState().dirty).toBe(false)
  })
})

describe("scenesController — load is atomic + undoable + transport-safe", () => {
  it("loads scene A into the live doc and is undoable", async () => {
    const { bus, ctrl } = make()
    // A: bpm 96 (default) → save A
    const a = await ctrl.save("A")
    // evolve to B: bpm 200, then save B
    bus.dispatch({ t: "setTempo", bpm: 200 })
    await ctrl.save("B")
    expect(bus.snapshot().bpm).toBe(200)

    // load A back
    ctrl.load(a.id)
    expect(bus.snapshot().bpm).toBe(96)
    expect(ctrl.vanilla.getState().activeSceneId).toBe(a.id)
    expect(ctrl.vanilla.getState().dirty).toBe(false)

    // load is ONE undo step → undo returns to B's bpm
    bus.undo()
    expect(bus.snapshot().bpm).toBe(200)
  })

  it("switches A ↔ B freely, preserving each state", async () => {
    const { bus, ctrl } = make()
    const a = await ctrl.save("A")
    bus.dispatch({ t: "setLoopLength", ticks: 3840 })
    const b = await ctrl.save("B")

    ctrl.load(a.id)
    const aTicks = bus.snapshot().loopLengthTicks
    ctrl.load(b.id)
    expect(bus.snapshot().loopLengthTicks).toBe(3840)
    ctrl.load(a.id)
    expect(bus.snapshot().loopLengthTicks).toBe(aTicks)
  })
})

describe("scenesController — rename / delete", () => {
  it("rename updates the list", async () => {
    const { ctrl } = make()
    const s = await ctrl.save("A")
    await ctrl.rename(s.id, "Renamed")
    expect(ctrl.vanilla.getState().scenes.find((x) => x.id === s.id)!.name).toBe(
      "Renamed"
    )
  })

  it("delete removes it + clears active when it was loaded", async () => {
    const { ctrl } = make()
    const s = await ctrl.save("A")
    expect(ctrl.vanilla.getState().activeSceneId).toBe(s.id)
    await ctrl.remove(s.id)
    expect(ctrl.vanilla.getState().scenes).toHaveLength(0)
    expect(ctrl.vanilla.getState().activeSceneId).toBeNull()
  })
})

describe("scenesController — start fresh (clear / randomize / loadDemo)", () => {
  const noteCount = (bus: ReturnType<typeof createCommandBus>) =>
    bus.snapshot().tracks.reduce(
      (n, t) => n + (t.kind === "instrument" ? t.notes.length : 0),
      0
    )

  it("clear() wipes to an empty grid and drops scene context (undoable)", async () => {
    const { bus, ctrl } = make()
    // Save a scene so there is active context to clear.
    const s = await ctrl.save("A")
    expect(ctrl.vanilla.getState().activeSceneId).toBe(s.id)
    ctrl.clear()
    expect(noteCount(bus)).toBe(0)
    expect(ctrl.vanilla.getState().activeSceneId).toBeNull()
    expect(ctrl.vanilla.getState().dirty).toBe(false)
    // One undoable step.
    expect(bus.canUndo()).toBe(true)
  })

  it("randomize() yields an empty grid with 3 synth voices + drums", () => {
    const bus = createCommandBus(createDefaultDoc(1000))
    let seed = 0
    // A simple deterministic-ish stream for the test.
    const ctrl = createScenesController(bus, {
      now: () => 1,
      seed: () => 1,
      rng: () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff), seed / 0x7fffffff),
    })
    ctrl.randomize()
    const tracks = bus.snapshot().tracks
    const notes = tracks.reduce((n, t) => n + (t.kind === "instrument" ? t.notes.length : 0), 0)
    expect(notes).toBe(0)
    expect(tracks.filter((t) => t.kind === "instrument").length).toBe(4)
    expect(ctrl.vanilla.getState().activeSceneId).toBeNull()
  })

  it("loadDemo() loads a known demo and returns true; false for unknown", () => {
    const { bus, ctrl } = make()
    expect(ctrl.loadDemo("ode-to-joy")).toBe(true)
    expect(noteCount(bus)).toBeGreaterThan(0)
    expect(ctrl.vanilla.getState().activeSceneId).toBeNull()
    expect(ctrl.loadDemo("does-not-exist")).toBe(false)
  })
})
