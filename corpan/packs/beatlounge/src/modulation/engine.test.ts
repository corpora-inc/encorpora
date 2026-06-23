/**
 * beatlounge — modulation engine tests. We inject a fake clock + a fake graph
 * that captures applyParam calls + a manual rAF pump, so the per-frame value
 * computation (range mapping, sync-vs-Hz cycle, mute skip, idle stop/start) is
 * exercised deterministically without a real renderer or audio nodes.
 */

import { describe, expect, it } from "vitest"
import {
  createModulationEngine,
  evalModulator,
  applyModulationFrame,
} from "./engine"
import { createCommandBus } from "../model/commandBus"
import { createDefaultDoc, createModulator } from "../model/document"
import type { BeatloungeDoc, ParamTarget } from "../model/document"

interface Captured {
  target: ParamTarget
  value: number
}
const fakeGraph = () => {
  const calls: Captured[] = []
  return { calls, applyParam: (target: ParamTarget, value: number) => calls.push({ target, value }) }
}

/** A controllable rAF pump: collect scheduled callbacks, fire on demand. */
const fakeRaf = () => {
  let queue: Array<() => void> = []
  let nextHandle = 1
  const raf = (cb: () => void): number => {
    queue.push(cb)
    return nextHandle++
  }
  const caf = () => {
    queue = []
  }
  const flush = (frames: number) => {
    for (let i = 0; i < frames; i++) {
      const batch = queue
      queue = []
      for (const cb of batch) cb()
    }
  }
  return { raf, caf, flush, pending: () => queue.length }
}

const masterTarget: ParamTarget = { scope: "master", param: "volume" }

describe("evalModulator — value computation", () => {
  it("maps a sine at center 0.5 / depth 1 to the midpoint at t=0", () => {
    const doc = createDefaultDoc(0)
    const mod = createModulator(masterTarget, { shape: "sine", center: 0.5, depth: 1, syncBeats: 4 })
    // sine(0) = 0 → value01 = 0.5 → master range {0,1} → 0.5
    expect(evalModulator(mod, doc, 0)).toBeCloseTo(0.5)
  })

  it("respects depth + center in normalized space, then maps to actual range", () => {
    const doc = createDefaultDoc(0)
    const panTarget: ParamTarget = { scope: "track", trackId: doc.tracks[0].id, param: "pan" }
    // saw at p=0 → -1; center 0.5, depth 1 → value01 = 0 → pan range {-1,1} → -1
    const mod = createModulator(panTarget, { shape: "saw", center: 0.5, depth: 1, syncBeats: 1, phase: 0 })
    expect(evalModulator(mod, doc, 0)).toBeCloseTo(-1)
  })

  it("uses rateHz when syncBeats is absent (1 Hz → 1s cycle)", () => {
    const doc = createDefaultDoc(0)
    const mod = createModulator(masterTarget, {
      shape: "square",
      center: 0.5,
      depth: 1,
      syncBeats: undefined,
      rateHz: 1,
    })
    // square first half high. At t=0.25 (quarter of a 1s cycle) → +1 → value01=1 → 1
    expect(evalModulator(mod, doc, 0.25)).toBeCloseTo(1)
    // At t=0.75 (second half) → -1 → value01=0 → 0
    expect(evalModulator(mod, doc, 0.75)).toBeCloseTo(0)
  })

  it("tempo-syncs the cycle to bpm", () => {
    const doc: BeatloungeDoc = { ...createDefaultDoc(0), bpm: 120 }
    // 120 bpm → 0.5s/beat; syncBeats 2 → 1s cycle. saw at t=0.5 → mid → 0
    const mod = createModulator(masterTarget, { shape: "saw", center: 0.5, depth: 1, syncBeats: 2 })
    expect(evalModulator(mod, doc, 0.5)).toBeCloseTo(0.5)
  })
})

describe("applyModulationFrame", () => {
  it("applies only enabled modulators and skips muted track-volume", () => {
    const base = createDefaultDoc(0)
    const t0 = base.tracks[0]
    const doc: BeatloungeDoc = {
      ...base,
      tracks: [{ ...t0, mute: true }, ...base.tracks.slice(1)],
      modulators: [
        createModulator({ scope: "track", trackId: t0.id, param: "volume" }, { enabled: true }),
        createModulator(masterTarget, { enabled: true }),
        createModulator(masterTarget, { enabled: false }),
      ],
    }
    const g = fakeGraph()
    applyModulationFrame(doc, 0, g)
    // Only the master (enabled, not mute-gated) ran: muted track-vol skipped, disabled skipped.
    expect(g.calls).toHaveLength(1)
    expect(g.calls[0].target).toEqual(masterTarget)
  })
})

describe("createModulationEngine — lifecycle", () => {
  it("does not spin when there are no enabled modulators", () => {
    const bus = createCommandBus(createDefaultDoc(0))
    const g = fakeGraph()
    const r = fakeRaf()
    const eng = createModulationEngine({ bus, graph: g, now: () => 0, raf: r.raf, caf: r.caf })
    expect(r.pending()).toBe(0)
    eng.dispose()
  })

  it("starts the loop when a modulator is added and writes each frame", () => {
    const bus = createCommandBus(createDefaultDoc(0))
    const g = fakeGraph()
    const r = fakeRaf()
    let t = 0
    const eng = createModulationEngine({ bus, graph: g, now: () => t, raf: r.raf, caf: r.caf })

    bus.dispatch({ t: "addModulator", modulator: createModulator(masterTarget, { enabled: true }) })
    expect(r.pending()).toBe(1) // bus subscription kicked the loop on

    t = 0.1
    r.flush(1)
    expect(g.calls.length).toBe(1)
    t = 0.2
    r.flush(1)
    expect(g.calls.length).toBe(2)

    eng.dispose()
  })

  it("stops spinning once all modulators are removed", () => {
    const bus = createCommandBus(createDefaultDoc(0))
    const g = fakeGraph()
    const r = fakeRaf()
    const eng = createModulationEngine({ bus, graph: g, now: () => 0, raf: r.raf, caf: r.caf })

    const doc = bus.dispatch({
      t: "addModulator",
      modulator: createModulator(masterTarget, { enabled: true }),
    })
    r.flush(1) // re-schedules itself (still enabled)
    expect(r.pending()).toBe(1)

    bus.dispatch({ t: "clearModulators" })
    void doc
    // Next frame sees no enabled mods → does not reschedule.
    r.flush(1)
    expect(r.pending()).toBe(0)

    eng.dispose()
  })

  it("dispose cancels the pending frame and unsubscribes", () => {
    const bus = createCommandBus(createDefaultDoc(0))
    const g = fakeGraph()
    const r = fakeRaf()
    const eng = createModulationEngine({ bus, graph: g, now: () => 0, raf: r.raf, caf: r.caf })
    bus.dispatch({ t: "addModulator", modulator: createModulator(masterTarget, { enabled: true }) })
    eng.dispose()
    r.flush(1)
    // After dispose, adding more does nothing.
    bus.dispatch({ t: "addModulator", modulator: createModulator(masterTarget, { enabled: true }) })
    expect(r.pending()).toBe(0)
  })
})
