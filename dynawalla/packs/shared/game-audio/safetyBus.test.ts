import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { CEILING } from "./ceiling.ts"
import { createSafetyBus, type BusContext } from "./safetyBus.ts"

/**
 * A Web Audio graph that actually processes samples.
 *
 * Not a spy: each node implements what the spec says it does, so pushing a
 * number in and reading a number out is a real answer about the graph the bus
 * builds. Two deliberate choices:
 *
 *  - the compressor is modelled as a straight wire. A DynamicsCompressorNode
 *    has a real attack time and the first milliseconds of a transient pass
 *    through it unattenuated, so assuming it does nothing is the honest
 *    worst case. If the ceiling holds with the limiter disabled, it holds.
 *  - the shaper implements the spec's lookup exactly, including the clause
 *    that matters: an input outside [-1, 1] uses the nearest curve value.
 */
class Param {
  value: number
  constructor(v = 0) {
    this.value = v
  }
}
class Node {
  readonly gain = new Param(1) // a real GainNode defaults to unity
  readonly threshold = new Param()
  readonly knee = new Param()
  readonly ratio = new Param()
  readonly attack = new Param()
  readonly release = new Param()
  curve: Float32Array | null = null
  oversample = "none"
  readonly outs: Node[] = []
  disconnected = false
  readonly kind: "gain" | "comp" | "shaper" | "dest"
  constructor(kind: "gain" | "comp" | "shaper" | "dest") {
    this.kind = kind
  }
  connect<T>(d: T): T {
    this.outs.push(d as unknown as Node)
    return d
  }
  disconnect(): void {
    this.disconnected = true
    this.outs.length = 0
  }
  process(x: number): number {
    if (this.kind === "gain") return x * this.gain.value
    if (this.kind === "comp") return x // worst case: the limiter has not engaged
    if (this.kind === "shaper") return this.curve ? lookup(this.curve, x) : x
    return x
  }
}

/** WaveShaperNode, per spec. */
function lookup(curve: Float32Array, x: number): number {
  const n = curve.length
  const v = ((n - 1) / 2) * (x + 1)
  if (!(v > 0)) return curve[0]!
  if (v >= n - 1) return curve[n - 1]!
  const k = Math.floor(v)
  const f = v - k
  return curve[k]! * (1 - f) + curve[k + 1]! * f
}

class Ctx implements BusContext {
  currentTime = 0
  readonly destination = new Node("dest") as unknown as AudioNode
  readonly made: Node[] = []
  private mk(kind: "gain" | "comp" | "shaper"): Node {
    const n = new Node(kind)
    this.made.push(n)
    return n
  }
  createGain(): GainNode {
    return this.mk("gain") as unknown as GainNode
  }
  createDynamicsCompressor(): DynamicsCompressorNode {
    return this.mk("comp") as unknown as DynamicsCompressorNode
  }
  createWaveShaper(): WaveShaperNode {
    return this.mk("shaper") as unknown as WaveShaperNode
  }
}

/** Push one sample in at `from` and read what reaches the destination. */
function push(from: AudioNode, dest: AudioNode, x: number): number {
  let node = from as unknown as Node
  let v = (node as Node).process(x)
  const guard = 64
  for (let i = 0; i < guard; i++) {
    const next = node.outs[0]
    if (!next) throw new Error("graph does not reach an output")
    if ((next as unknown as AudioNode) === dest) return v
    node = next
    v = node.process(v)
  }
  throw new Error("graph did not terminate")
}

const render = (ctx: Ctx, bus: { input: AudioNode }, x: number): number =>
  push(bus.input, ctx.destination, x)

describe("createSafetyBus", () => {
  it("reaches the destination", () => {
    const ctx = new Ctx()
    const bus = createSafetyBus(ctx)
    // Float32 curve interpolation, hence the tolerance.
    assert.ok(Math.abs(render(ctx, bus, 0.1) - 0.1) < 1e-6)
  })

  it("passes ordinary game levels through untouched", () => {
    const ctx = new Ctx()
    const bus = createSafetyBus(ctx)
    // Every measured single cue in the 27 games sits inside this range.
    for (const x of [0.09, 0.113, 0.152, 0.223, 0.296, 0.389, 0.5]) {
      assert.ok(Math.abs(render(ctx, bus, x) - x) < 1e-6, `${x} was altered`)
    }
  })

  it("CANNOT exceed the ceiling — this is the whole point", () => {
    const ctx = new Ctx()
    const bus = createSafetyBus(ctx)
    // Measured, before the fix: MOSAIC clear() = 2.344, six of them = 13.955.
    for (const x of [0.9, 1, 1.3, 2.049, 2.344, 6, 13.955, 100, 1e6]) {
      const y = render(ctx, bus, x)
      assert.ok(y <= CEILING + 1e-6, `input ${x} produced ${y}, above ceiling ${CEILING}`)
      assert.ok(render(ctx, bus, -x) >= -(CEILING + 1e-6))
    }
  })

  it("never emits a sample at or above full scale, so nothing clips", () => {
    const ctx = new Ctx()
    const bus = createSafetyBus(ctx)
    for (let x = -20; x <= 20; x += 0.017) {
      assert.ok(Math.abs(render(ctx, bus, x)) < 1, `input ${x} clipped`)
    }
  })

  it("is limiting, not gluing", () => {
    const ctx = new Ctx()
    createSafetyBus(ctx)
    const comp = ctx.made.find((n) => n.kind === "comp")
    assert.ok(comp, "no compressor in the bus")
    // The games that had a compressor used knee 22-26 / ratio 5-6 and still
    // clipped when six cues overlapped. That is a glue compressor.
    assert.equal(comp.knee.value, 0)
    assert.ok(comp.ratio.value >= 12, `ratio ${comp.ratio.value} is not a limiter`)
    assert.ok(comp.attack.value <= 0.005, `attack ${comp.attack.value} is too slow to catch a hit`)
  })

  it("mutes to true silence, after the ceiling", () => {
    const ctx = new Ctx()
    const bus = createSafetyBus(ctx)
    bus.setMuted(true)
    assert.equal(bus.muted, true)
    assert.equal(render(ctx, bus, 0.4), 0)
    assert.equal(render(ctx, bus, 50), 0)
    bus.setMuted(false)
    assert.ok(Math.abs(render(ctx, bus, 0.4) - 0.4) < 1e-6)
  })

  it("can mount already muted", () => {
    const ctx = new Ctx()
    const bus = createSafetyBus(ctx, { muted: true })
    assert.equal(render(ctx, bus, 0.4), 0)
  })

  it("trims before the limiter, and clamps a nonsense level", () => {
    const ctx = new Ctx()
    const bus = createSafetyBus(ctx, { level: 0.5 })
    assert.ok(Math.abs(render(ctx, bus, 0.4) - 0.2) < 1e-6)
    bus.setLevel(4)
    assert.ok(render(ctx, bus, 0.4) <= CEILING)
    bus.setLevel(Number.NaN)
    assert.equal(render(ctx, bus, 0.4), 0)
  })

  it("honours a custom ceiling", () => {
    const ctx = new Ctx()
    const bus = createSafetyBus(ctx, { ceiling: 0.4 })
    assert.equal(bus.ceiling, 0.4)
    assert.ok(render(ctx, bus, 9) <= 0.4 + 1e-6)
  })

  it("says so out loud when the ceiling cannot be enforced", () => {
    const full = new Ctx()
    const ctx: BusContext = {
      currentTime: 0,
      destination: full.destination,
      createGain: () => full.createGain(),
      createDynamicsCompressor: () => full.createDynamicsCompressor(),
    }
    const warnings: unknown[][] = []
    const real = console.warn
    console.warn = (...a: unknown[]) => void warnings.push(a)
    try {
      createSafetyBus(ctx)
    } finally {
      console.warn = real
    }
    assert.ok(
      warnings.some((w) => String(w[0]).includes("ceiling is NOT enforced")),
      "a bus without a ceiling must not fail silently",
    )
  })

  it("tears down without throwing", () => {
    const ctx = new Ctx()
    const bus = createSafetyBus(ctx)
    bus.disconnect()
    assert.ok(ctx.made.every((n) => n.disconnected))
  })
})
