/**
 * beatlounge — audioGraph make-before-break crossfade wiring.
 *
 * Real WebAudio/Tone can't run under happy-dom, so we stub `tone` with
 * spyable Gain/Panner nodes and stub `createEffect`/`createInstrument`. The
 * audible gap can't be asserted, but the WIRING LOGIC can: on a STRUCTURE
 * change the old chain survives until AFTER the crossfade window, the new
 * chain is built in parallel, a crossfade is scheduled, and the old chain +
 * its fade gain are disposed exactly once after the window. A rapid second
 * change must not leak the superseded chain. The param-only fast path must
 * still just call `update()`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// ---- fake Tone nodes (hoisted so the vi.mock factories can see them) -------
const H = vi.hoisted(() => {
  class FakeParam {
    value = 1
    cancelScheduledValues = vi.fn()
    setValueAtTime = vi.fn()
    setTargetAtTime = vi.fn()
    rampTo = vi.fn()
  }
  class FakeNode {
    gain = new FakeParam()
    pan = new FakeParam()
    threshold = new FakeParam()
    volume = new FakeParam()
    connect = vi.fn(function (this: FakeNode) {
      return this
    })
    disconnect = vi.fn(function (this: FakeNode) {
      return this
    })
    dispose = vi.fn(function (this: FakeNode) {
      return this
    })
    toDestination = vi.fn(function (this: FakeNode) {
      return this
    })
    start = vi.fn(function (this: FakeNode) {
      return this
    })
    constructor(..._args: unknown[]) {}
  }
  // Each createEffect call returns a fresh spyable Effect with its own node.
  const createdEffects: { dispose: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> }[] = []
  return { FakeNode, createdEffects }
})

vi.mock("tone", () => ({
  Gain: H.FakeNode,
  Panner: H.FakeNode,
  Limiter: H.FakeNode,
  Volume: H.FakeNode,
  setContext: vi.fn(),
  gainToDb: (v: number) => v,
  now: () => 0,
}))

vi.mock("../effects/createEffect", () => ({
  createEffect: vi.fn(() => {
    const node = new H.FakeNode()
    const fx = {
      input: node,
      output: node,
      update: vi.fn(),
      setParam: vi.fn(),
      dispose: vi.fn(),
    }
    H.createdEffects.push(fx as never)
    return fx
  }),
}))

const createdEffects = H.createdEffects

vi.mock("../instruments/createInstrument", () => ({
  createInstrument: vi.fn(() => ({
    output: new H.FakeNode(),
    trigger: vi.fn(),
    update: vi.fn(),
    setParam: vi.fn(),
    load: vi.fn(async () => {}),
    dispose: vi.fn(),
  })),
  instrumentKindOf: (c: { kind: string }) => c.kind,
}))

import { createAudioGraph } from "./audioGraph"
import { CROSSFADE_SEC } from "./crossfade"
import type { BeatloungeDoc, Bus, EffectNode } from "../model/document"

const fx = (id: string, kind = "gain"): EffectNode => ({
  id,
  kind: kind as EffectNode["kind"],
  enabled: true,
  params: { gain: 1 },
})

const bus = (inserts: EffectNode[]): Bus => ({
  id: "bus1",
  name: "FX",
  role: "fx",
  inserts,
  sends: [],
  volume: 0.8,
  mute: false,
})

const doc = (b: Bus): BeatloungeDoc =>
  ({
    masterVolume: 0.8,
    tracks: [],
    buses: [b],
  }) as unknown as BeatloungeDoc

// A stub AudioContext clock.
const fakeCtx = () => ({ currentTime: 0 }) as unknown as AudioContext

describe("audioGraph — make-before-break crossfade on structure change", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    createdEffects.length = 0
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it("param-only change does NOT rebuild — just calls update()", () => {
    const g = createAudioGraph(fakeCtx())
    g.reconcile(null, doc(bus([fx("a")])))
    const builtFirst = createdEffects.length
    expect(builtFirst).toBe(1)
    const firstFx = createdEffects[0]

    // Same id+kind, different param → fast path.
    g.reconcile(doc(bus([fx("a")])), doc(bus([{ ...fx("a"), params: { gain: 0.5 } }])))
    expect(createdEffects.length).toBe(builtFirst) // no new effect built
    expect(firstFx.update).toHaveBeenCalled()
    expect(firstFx.dispose).not.toHaveBeenCalled()
  })

  it("structure change builds a parallel new chain and does NOT dispose the old one synchronously", () => {
    const g = createAudioGraph(fakeCtx())
    g.reconcile(null, doc(bus([fx("a")])))
    const oldFx = createdEffects[0]
    expect(oldFx.dispose).not.toHaveBeenCalled()

    // Reorder/add → structure changes → crossfade.
    g.reconcile(doc(bus([fx("a")])), doc(bus([fx("b"), fx("a")])))

    // New chain built in parallel (2 new effects), old NOT yet disposed.
    expect(createdEffects.length).toBe(3)
    expect(oldFx.dispose).not.toHaveBeenCalled()

    // After the crossfade window, the old chain is disposed exactly once.
    vi.advanceTimersByTime(CROSSFADE_SEC * 1000 + 1)
    expect(oldFx.dispose).toHaveBeenCalledTimes(1)
  })

  it("reorder of the SAME effects still crossfades (order is structural)", () => {
    const g = createAudioGraph(fakeCtx())
    g.reconcile(null, doc(bus([fx("a"), fx("b")])))
    const a = createdEffects[0]
    const b = createdEffects[1]

    g.reconcile(doc(bus([fx("a"), fx("b")])), doc(bus([fx("b"), fx("a")])))
    // Two fresh effects built for the reordered chain (built-fresh, not reused).
    expect(createdEffects.length).toBe(4)
    expect(a.dispose).not.toHaveBeenCalled()
    expect(b.dispose).not.toHaveBeenCalled()

    vi.advanceTimersByTime(CROSSFADE_SEC * 1000 + 1)
    expect(a.dispose).toHaveBeenCalledTimes(1)
    expect(b.dispose).toHaveBeenCalledTimes(1)
  })

  it("rapid successive restructure finalizes the in-flight fade — old-old chain disposed, no leak", () => {
    const g = createAudioGraph(fakeCtx())
    g.reconcile(null, doc(bus([fx("a")]))) // chain v0: [a]
    const v0 = createdEffects[0]

    g.reconcile(doc(bus([fx("a")])), doc(bus([fx("a"), fx("b")]))) // → v1: [a,b]
    const v1Count = createdEffects.length
    expect(v0.dispose).not.toHaveBeenCalled()

    // Second restructure BEFORE the first fade completes.
    g.reconcile(doc(bus([fx("a"), fx("b")])), doc(bus([fx("c")]))) // → v2: [c]

    // The in-flight v0 teardown was finalized immediately (no waiting timer).
    expect(v0.dispose).toHaveBeenCalledTimes(1)
    // v2 built fresh; nothing disposed twice.
    expect(createdEffects.length).toBeGreaterThan(v1Count)

    // After the new window, v1 ([a,b]) is disposed exactly once.
    vi.advanceTimersByTime(CROSSFADE_SEC * 1000 + 1)
    const v1Effects = createdEffects.slice(1, v1Count)
    for (const e of v1Effects) expect(e.dispose).toHaveBeenCalledTimes(1)
    // v0 still disposed exactly once (no double-dispose).
    expect(v0.dispose).toHaveBeenCalledTimes(1)
  })

  it("disposing the graph mid-fade clears the timer and disposes without throwing", () => {
    const g = createAudioGraph(fakeCtx())
    g.reconcile(null, doc(bus([fx("a")])))
    const oldFx = createdEffects[0]
    g.reconcile(doc(bus([fx("a")])), doc(bus([fx("b"), fx("a")])))

    expect(() => g.dispose()).not.toThrow()
    // Old chain disposed during teardown.
    expect(oldFx.dispose).toHaveBeenCalledTimes(1)

    // No stray timer fires after dispose (would re-dispose → throw/double-count).
    vi.advanceTimersByTime(CROSSFADE_SEC * 1000 + 1)
    expect(oldFx.dispose).toHaveBeenCalledTimes(1)
  })
})
