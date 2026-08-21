/**
 * What a nine-year-old heard, as assertions.
 *
 * These do not model sound. They record what the game asks the Web Audio graph
 * for — every gain event with its time and value, every connection — and check
 * the three things that made MOSAIC dangerous:
 *
 *   1. no envelope leaves its gain at the GainNode default of 1 while it waits
 *      for a scheduled start (the unity-gain hole that made `clear()` peak at
 *      2.344 when its notes are authored at 0.15);
 *   2. no envelope attacks faster than MIN_ATTACK;
 *   3. nothing reaches `ctx.destination` except through the shared safety bus.
 *
 * Rendered peaks, before and after, measured offline against a real Web Audio
 * implementation and quoted here so the numbers are not lost:
 *
 *                          before                       after
 *   clear()                2.344 (+7.4 dBFS, 2104 clipped)   0.642 (-3.9, 0)
 *   clear() + 4x glass     3.000 (+9.5 dBFS, 2318 clipped)   0.627 (-4.0, 0)
 *   6x glass at force 1.35 1.993 (+6.0 dBFS,   62 clipped)   0.890 (-1.0, 0)
 *   forgeRight()           2.049 (+6.2 dBFS,  540 clipped)   under the ceiling
 *   power()                1.692 (+4.6 dBFS,  680 clipped)   0.132
 */
import assert from "node:assert/strict"
import { afterEach, beforeEach, describe, it } from "node:test"

import { CEILING, MIN_ATTACK } from "../../../../packs/shared/game-audio/index.ts"
import { Audio } from "./audio.ts"

type GainEvent = { kind: "set" | "ramp"; time: number; value: number }

class FakeParam {
  value = 1
  readonly events: GainEvent[] = []
  setValueAtTime(v: number, t: number): this {
    this.value = v
    this.events.push({ kind: "set", time: t, value: v })
    return this
  }
  exponentialRampToValueAtTime(v: number, t: number): this {
    this.value = v
    this.events.push({ kind: "ramp", time: t, value: v })
    return this
  }
  linearRampToValueAtTime(v: number): this {
    this.value = v
    return this
  }
  setTargetAtTime(v: number): this {
    this.value = v
    return this
  }
  cancelScheduledValues(): this {
    return this
  }
}

class FakeNode {
  readonly gain = new FakeParam()
  readonly frequency = new FakeParam()
  readonly Q = new FakeParam()
  readonly detune = new FakeParam()
  readonly threshold = new FakeParam()
  readonly knee = new FakeParam()
  readonly ratio = new FakeParam()
  readonly attack = new FakeParam()
  readonly release = new FakeParam()
  readonly outs: FakeNode[] = []
  type = "sine"
  curve: Float32Array | null = null
  oversample = "none"
  buffer: unknown = null
  readonly kind: string
  constructor(kind: string) {
    this.kind = kind
    // A GainNode's gain defaults to unity. Modelling that is the entire point:
    // the bug this file guards was a gain node left at 1 until a scheduled
    // event in the future finally turned it down.
    this.gain.value = kind === "gain" ? 1 : 0
  }
  connect<T>(d: T): T {
    this.outs.push(d as unknown as FakeNode)
    return d
  }
  disconnect(): void {}
  start(): void {}
  stop(): void {}
}

class FakeBuffer {
  readonly numberOfChannels: number
  readonly length: number
  readonly sampleRate: number
  constructor(numberOfChannels: number, length: number, sampleRate: number) {
    this.numberOfChannels = numberOfChannels
    this.length = length
    this.sampleRate = sampleRate
  }
  getChannelData(): Float32Array {
    return new Float32Array(Math.min(this.length, 256))
  }
}

class FakeCtx {
  currentTime = 12.5 // deliberately NOT zero: a real context has been running
  readonly sampleRate = 48000
  readonly destination = new FakeNode("dest")
  readonly made: FakeNode[] = []
  private mk(kind: string): FakeNode {
    const n = new FakeNode(kind)
    this.made.push(n)
    return n
  }
  createGain(): FakeNode {
    return this.mk("gain")
  }
  createBiquadFilter(): FakeNode {
    return this.mk("biquad")
  }
  createConvolver(): FakeNode {
    return this.mk("convolver")
  }
  createOscillator(): FakeNode {
    return this.mk("osc")
  }
  createBufferSource(): FakeNode {
    return this.mk("src")
  }
  createDynamicsCompressor(): FakeNode {
    return this.mk("comp")
  }
  createWaveShaper(): FakeNode {
    return this.mk("shaper")
  }
  createBuffer(c: number, l: number, r: number): FakeBuffer {
    return new FakeBuffer(c, l, r)
  }
  suspend(): Promise<void> {
    return Promise.resolve()
  }
  resume(): Promise<void> {
    return Promise.resolve()
  }
}

/** Every cue the game can fire, called the way `mount.ts` calls it. */
const CUES: [string, (a: Audio) => void][] = [
  ["glass", (a) => a.glass(6, 1.35)],
  ["clunk", (a) => a.clunk()],
  ["paddle", (a) => a.paddle(0.9)],
  ["wall", (a) => a.wall()],
  ["crumble", (a) => a.crumble()],
  ["crack", (a) => a.crack()],
  ["laser", (a) => a.laser()],
  ["star", (a) => a.star()],
  ["power", (a) => a.power()],
  ["molten", (a) => a.molten()],
  ["clear", (a) => a.clear()],
  ["lost", (a) => a.lost()],
  ["forgeOpen", (a) => a.forgeOpen()],
  ["forgeRight", (a) => a.forgeRight()],
  ["forgeWrong", (a) => a.forgeWrong()],
  ["charge", (a) => a.charge(0.5)],
  ["chargeFull", (a) => a.chargeFull()],
  ["danger", (a) => a.danger()],
]

let ctx: FakeCtx
let realCtor: unknown
let timers: (() => void)[]
let realSetTimeout: typeof setTimeout

beforeEach(() => {
  ctx = new FakeCtx()
  realCtor = (globalThis as { AudioContext?: unknown }).AudioContext
  ;(globalThis as { AudioContext?: unknown }).AudioContext = function () {
    return ctx
  }
  // The game schedules node teardown on a timer. Collect them instead of
  // letting node's runner wait on them.
  timers = []
  realSetTimeout = globalThis.setTimeout
  ;(globalThis as { setTimeout: unknown }).setTimeout = ((fn: () => void) => {
    timers.push(fn)
    return 0
  }) as unknown as typeof setTimeout
})

afterEach(() => {
  ;(globalThis as { AudioContext?: unknown }).AudioContext = realCtor
  ;(globalThis as { setTimeout: unknown }).setTimeout = realSetTimeout
})

function fresh(): Audio {
  const a = new Audio()
  a.start()
  return a
}

describe("mosaic audio — hearing safety", () => {
  it("never leaves a scheduled envelope open at unity", () => {
    // THE bug. `setValueAtTime(0.0001, now + delay)` leaves the gain at its
    // default of 1 for the whole delay, so every staggered note in an arpeggio
    // played at FULL amplitude before its own envelope began. Six notes
    // authored at 0.15 measured 2.344 — two and a third times full scale.
    for (const [name, fire] of CUES) {
      const a = fresh()
      const before = ctx.made.length
      fire(a)
      for (const node of ctx.made.slice(before)) {
        if (node.kind !== "gain" || node.gain.events.length === 0) continue
        const first = node.gain.events[0]!
        assert.ok(
          first.time <= ctx.currentTime + 1e-9,
          `${name}: a gain node's first event is at ${first.time}, ${(
            first.time - ctx.currentTime
          ).toFixed(3)}s in the future — it sits at unity until then`,
        )
        assert.ok(first.value < 0.01, `${name}: first gain event is ${first.value}, not silence`)
      }
    }
  })

  it("never attacks faster than the shared minimum", () => {
    for (const [name, fire] of CUES) {
      const a = fresh()
      const before = ctx.made.length
      fire(a)
      for (const node of ctx.made.slice(before)) {
        if (node.kind !== "gain") continue
        const ev = node.gain.events
        // The envelope is: silence now, silence at t, ramp up, ramp down.
        const up = ev.find((e) => e.kind === "ramp" && e.value > 0.001)
        const start = ev.filter((e) => e.kind === "set").at(-1)
        if (!up || !start) continue
        const attack = up.time - start.time
        assert.ok(
          attack >= MIN_ATTACK - 1e-9,
          `${name}: attack ${attack}s is below MIN_ATTACK ${MIN_ATTACK}s — that is a step function`,
        )
      }
    }
  })

  it("routes every voice through the safety bus, never straight to the output", () => {
    fresh()
    const shaper = ctx.made.find((n) => n.kind === "shaper")
    assert.ok(shaper, "no WaveShaper: the output ceiling is not enforced")
    assert.ok(shaper.curve, "the shaper has no curve")
    let max = 0
    for (const v of shaper.curve) max = Math.max(max, Math.abs(v))
    assert.ok(Math.abs(max - CEILING) < 1e-6, `shaper tops out at ${max}, not ${CEILING}`)

    // Nothing may reach the destination except the bus's own last node.
    const feeders = ctx.made.filter((n) => n.outs.includes(ctx.destination))
    assert.equal(feeders.length, 1, `${feeders.length} nodes connect to ctx.destination`)
    assert.ok(reaches(shaper, feeders[0]!), "the destination is fed from outside the safety bus")
  })

  it("caps the force a caller can ask for", () => {
    // mount.ts computes `0.85 + min(0.5, combo * 0.04)`, so a long chain asks
    // for 1.35. A future edit to that expression must not be able to scale the
    // whole cue without bound.
    const a = fresh()
    const before = ctx.made.length
    a.glass(6, 40)
    const loud = ctx.made
      .slice(before)
      .filter((n) => n.kind === "gain")
      .flatMap((n) => n.gain.events.map((e) => e.value))
    const peak = Math.max(...loud)
    assert.ok(peak <= 0.5, `glass(step, 40) asked for a voice at ${peak}`)
  })

  it("plays nothing at all when disabled", () => {
    const a = fresh()
    a.setMuted(true)
    const before = ctx.made.length
    for (const [, fire] of CUES) fire(a)
    const connected = ctx.made.slice(before).filter((n) => n.outs.length > 0)
    assert.equal(connected.length, 0, `${connected.length} nodes were built while muted`)
  })

  it("builds no graph before start() — no audio before a user gesture", () => {
    const a = new Audio()
    for (const [, fire] of CUES) fire(a)
    assert.equal(ctx.made.length, 0, "the game built an audio graph without a gesture")
  })

  it("bounds a stampede: a hundred shatters do not make a hundred voices", () => {
    const a = fresh()
    const before = ctx.made.length
    for (let i = 0; i < 100; i++) a.glass(6, 1.35)
    const live = ctx.made
      .slice(before)
      .filter((n) => n.kind === "gain" && n.outs.length > 0 && n.gain.events.length > 0)
    assert.ok(live.length <= 12, `${live.length} voices were connected to the bus`)
  })
})

function reaches(from: FakeNode, target: FakeNode, seen = new Set<FakeNode>()): boolean {
  if (from === target) return true
  if (seen.has(from)) return false
  seen.add(from)
  return from.outs.some((n) => reaches(n, target, seen))
}
