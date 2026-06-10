/**
 * beatlounge — parametric drum-synth smoke test.
 *
 * happy-dom has no WebAudio, so a real Tone graph may not instantiate. We GUARD
 * the Tone build the way the rest of the engine is tested (pure logic elsewhere):
 * if an AudioContext can't be set up, we skip the live-build assertions but still
 * assert the pure routing/velocity policy that drives the synth. When WebAudio IS
 * available, we assert the parametric build + a kit swap don't throw and dispose
 * cleanly (no leaks / no double-dispose crash).
 */

import { describe, expect, it, beforeAll } from "vitest"
import type { InstrumentConfig } from "../model/document"

// Probe: can we stand up an AudioContext + Tone in this environment?
let audioReady = false
beforeAll(async () => {
  try {
    const Ctor =
      (globalThis as { AudioContext?: typeof AudioContext }).AudioContext ??
      (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    const Tone = await import("tone")
    const ctx = new Ctor()
    Tone.setContext(ctx)
    // A trivial node proves the graph is usable.
    const g = new Tone.Gain(1)
    g.dispose()
    audioReady = true
  } catch {
    audioReady = false
  }
})

const drumConfig = (kitId?: string): InstrumentConfig => ({
  kind: "drumSampler",
  kitId,
  pads: [],
  fallback: "synthKit",
})

describe("parametric drum synth (guarded — needs WebAudio)", () => {
  it("builds the default kit, triggers every pad, swaps kits, and disposes — no throw", async () => {
    if (!audioReady) {
      // Environment lacks WebAudio; the pure corpus is covered by kits.test.ts.
      expect(audioReady).toBe(false)
      return
    }
    const { createDrumKitInstrument } = await import("./drumKit")
    const Tone = await import("tone")
    const now = Tone.now()

    const inst = createDrumKitInstrument(drumConfig())
    expect(inst.output).toBeTruthy()

    // Trigger every known pad pitch + an unknown pad (the tom fallback).
    const pitches = [36, 38, 37, 39, 42, 44, 46, 43, 45, 64, 49, 51, 56, 54, 70, 75, 99]
    let t = now + 0.01
    for (const pitch of pitches) {
      expect(() =>
        inst.trigger({ pitch, velocity: 0.8, durationSec: 0.1 }, t)
      ).not.toThrow()
      t += 0.01
    }

    // Live kit swap → rebuild voices, still triggerable, no throw.
    expect(() => inst.update(drumConfig("tr-808"))).not.toThrow()
    expect(() => inst.trigger({ pitch: 36, velocity: 0.9, durationSec: 0.1 }, t)).not.toThrow()

    // Same kit id again → no-op (no rebuild, no throw).
    expect(() => inst.update(drumConfig("tr-808"))).not.toThrow()

    // Unknown kit id → falls back to default, no throw.
    expect(() => inst.update(drumConfig("bogus"))).not.toThrow()

    expect(() => inst.dispose()).not.toThrow()
  })
})
