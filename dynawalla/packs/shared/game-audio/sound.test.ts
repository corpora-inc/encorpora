/**
 * The app's Sound setting, held to meaning something.
 *
 * The graph here processes samples the same way `safetyBus.test.ts` does — push
 * a number into `bus.input`, read what arrives at the destination — because the
 * only claim worth testing is "no sound comes out", and the only honest way to
 * test that claim is to look at what comes out.
 *
 * Two contexts, deliberately. `Ctx` has `.value` and nothing else, which is
 * what most of the 27 games' own fake contexts implement and therefore the
 * shape the bus must never assume its way out of. `SchedulingCtx` implements
 * the three automation methods a real `AudioParam` has, which is the branch a
 * child on a device actually hears.
 */
import assert from "node:assert/strict"
import { beforeEach, describe, it } from "node:test"

import { createSafetyBus, type BusContext } from "./safetyBus.ts"
import { hostSoundAllowed, onHostSound, resetHostSound, setHostSound } from "./sound.ts"

// ─── A graph that processes samples ──────────────────────────────────────────

class Param {
  value: number
  constructor(v = 0) {
    this.value = v
  }
}

/** An `AudioParam` with the automation a real one has, and a clock to read it against. */
class SchedParam extends Param {
  /** Ramps scheduled but not yet arrived: [target, when]. */
  private pending: [number, number][] = []
  private readonly clock: { currentTime: number }
  constructor(clock: { currentTime: number }, v = 0) {
    super(v)
    this.clock = clock
  }
  cancelScheduledValues(when: number): void {
    this.pending = this.pending.filter(([, at]) => at < when)
  }
  setValueAtTime(value: number, when: number): void {
    this.pending.push([value, when])
  }
  linearRampToValueAtTime(value: number, when: number): void {
    this.pending.push([value, when])
  }
  /** The last event whose time has arrived wins. Enough to see a ramp land. */
  settle(): number {
    for (const [value, at] of this.pending) if (at <= this.clock.currentTime) this.value = value
    this.pending = this.pending.filter(([, at]) => at > this.clock.currentTime)
    return this.value
  }
}

class Node {
  readonly gain: Param
  readonly threshold = new Param()
  readonly knee = new Param()
  readonly ratio = new Param()
  readonly attack = new Param()
  readonly release = new Param()
  curve: Float32Array | null = null
  oversample = "none"
  readonly outs: Node[] = []
  readonly kind: "gain" | "comp" | "shaper" | "dest"
  constructor(kind: "gain" | "comp" | "shaper" | "dest", gain: Param) {
    this.kind = kind
    this.gain = gain
  }
  connect<T>(d: T): T {
    this.outs.push(d as unknown as Node)
    return d
  }
  disconnect(): void {
    this.outs.length = 0
  }
  process(x: number): number {
    if (this.kind === "gain") {
      const g = this.gain
      return x * (g instanceof SchedParam ? g.settle() : g.value)
    }
    if (this.kind === "comp") return x
    if (this.kind === "shaper") return this.curve ? lookup(this.curve, x) : x
    return x
  }
}

/** WaveShaperNode, per spec: outside [-1,1] uses the nearest curve value. */
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
  readonly destination = new Node("dest", new Param(1)) as unknown as AudioNode
  /** Whether gains get scheduling methods. Off = the games' own fake shape. */
  protected scheduling = false
  private mk(kind: "gain" | "comp" | "shaper"): Node {
    const gain =
      this.scheduling && kind === "gain" ? new SchedParam(this, 1) : new Param(kind === "gain" ? 1 : 0)
    return new Node(kind, gain)
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

class SchedulingCtx extends Ctx {
  constructor() {
    super()
    this.scheduling = true
  }
}

/** Push one sample in at `bus.input` and read what reaches the destination. */
function render(ctx: Ctx, bus: { input: AudioNode }, x: number): number {
  let node = bus.input as unknown as Node
  let v = node.process(x)
  for (let i = 0; i < 64; i++) {
    const next = node.outs[0]
    if (!next) throw new Error("graph does not reach an output")
    if ((next as unknown as AudioNode) === ctx.destination) return v
    node = next
    v = node.process(v)
  }
  throw new Error("graph did not terminate")
}

const SAMPLE = 0.4

beforeEach(() => resetHostSound())

// ─── The setting itself ──────────────────────────────────────────────────────

describe("the published Sound setting", () => {
  it("allows sound until a host says otherwise", () => {
    assert.equal(hostSoundAllowed(), true)
  })

  it("only `false` silences — an older host that omits the field must not", () => {
    setHostSound(undefined)
    assert.equal(hostSoundAllowed(), true)
    setHostSound(null)
    assert.equal(hostSoundAllowed(), true)
    setHostSound(false)
    assert.equal(hostSoundAllowed(), false)
  })

  it("tells its followers, and stops when they leave", () => {
    const seen: boolean[] = []
    const off = onHostSound((on) => void seen.push(on))
    setHostSound(false)
    setHostSound(true)
    off()
    setHostSound(false)
    assert.deepEqual(seen, [false, true])
  })

  it("says so out loud when a follower throws, and still tells the rest", () => {
    const seen: boolean[] = []
    onHostSound(() => {
      throw new Error("this bus is broken")
    })
    onHostSound((on) => void seen.push(on))
    const said: string[] = []
    const real = console.error
    console.error = (...a: unknown[]) => void said.push(a.map(String).join(" "))
    try {
      setHostSound(false)
    } finally {
      console.error = real
    }
    assert.deepEqual(seen, [false], "a throwing bus swallowed the setting for the others")
    assert.ok(
      said.some((s) => s.includes("refused the app's sound setting")),
      "a bus that could not be silenced failed silently",
    )
  })
})

// ─── What the child hears ────────────────────────────────────────────────────

describe("the app's Sound setting reaches the bus", () => {
  it("THE DEFECT: a bus built while Sound is off used to make noise", () => {
    setHostSound(false)
    const ctx = new Ctx()
    const bus = createSafetyBus(ctx)
    assert.equal(render(ctx, bus, SAMPLE), 0, "a game mounted with Sound off is audible")
    assert.equal(render(ctx, bus, 50), 0, "not even a huge input gets through")
  })

  it("THE DEFECT, LIVE: turning Sound off mid-session silences a running game", () => {
    const ctx = new Ctx()
    const bus = createSafetyBus(ctx)
    assert.ok(Math.abs(render(ctx, bus, SAMPLE) - SAMPLE) < 1e-6, "sound on, but nothing came out")

    setHostSound(false)
    assert.equal(render(ctx, bus, SAMPLE), 0, "Sound was turned off and the game kept playing")

    setHostSound(true)
    assert.ok(
      Math.abs(render(ctx, bus, SAMPLE) - SAMPLE) < 1e-6,
      "the gate stuck shut: Sound came back on and the game stayed silent",
    )
  })

  it("catches a cue that was already scheduled, not merely the next one", () => {
    // A game's own mute button usually means "stop making new voices", which
    // leaves the half-second tail of the cue that fired a moment ago ringing
    // out. This gate is downstream of every voice, so the cue in flight — the
    // one whose oscillator is already started and connected — is silenced too.
    const ctx = new Ctx()
    const bus = createSafetyBus(ctx)
    const voice = new Node("gain", new Param(1))
    voice.connect(bus.input as unknown as Node)
    const throughVoice = (x: number): number => render(ctx, { input: voice as unknown as AudioNode }, x)

    assert.ok(Math.abs(throughVoice(SAMPLE) - SAMPLE) < 1e-6)
    setHostSound(false)
    assert.equal(throughVoice(SAMPLE), 0, "a cue already in flight survived the mute")
  })

  it("gates every bus in the pack, not just the last one made", () => {
    const a = new Ctx()
    const b = new Ctx()
    const busA = createSafetyBus(a)
    const busB = createSafetyBus(b)
    setHostSound(false)
    assert.equal(render(a, busA, SAMPLE), 0)
    assert.equal(render(b, busB, SAMPLE), 0)
  })

  it("stops following once the bus is torn down", () => {
    const ctx = new Ctx()
    const bus = createSafetyBus(ctx)
    bus.disconnect()
    // The graph is gone; what matters is that the setting no longer reaches a
    // closure holding a dead bus alive.
    setHostSound(false)
    assert.equal(bus.hostAllows, true, "a disconnected bus is still following the setting")
  })
})

// ─── Who wins ────────────────────────────────────────────────────────────────

describe("the app setting is authoritative; the game's button is a convenience", () => {
  it("a game cannot unmute itself out of an app-level mute", () => {
    setHostSound(false)
    const ctx = new Ctx()
    const bus = createSafetyBus(ctx)
    bus.setMuted(false)
    assert.equal(render(ctx, bus, SAMPLE), 0, "the game's mute button overrode the parent")
    assert.equal(bus.muted, true, "the bus reported itself audible while silent")
    assert.equal(bus.gameMuted, false, "the game's own preference was not recorded")
  })

  it("a game toggling with `!bus.muted` still cannot make noise", () => {
    setHostSound(false)
    const ctx = new Ctx()
    const bus = createSafetyBus(ctx)
    // The idiom every in-game mute button uses.
    for (let i = 0; i < 4; i++) {
      bus.setMuted(!bus.muted)
      assert.equal(render(ctx, bus, SAMPLE), 0, `toggle ${String(i)} produced sound`)
    }
  })

  it("the game's preference applies again the moment the app allows sound", () => {
    setHostSound(false)
    const ctx = new Ctx()
    const bus = createSafetyBus(ctx)
    bus.setMuted(false)
    setHostSound(true)
    assert.ok(Math.abs(render(ctx, bus, SAMPLE) - SAMPLE) < 1e-6)

    bus.setMuted(true)
    assert.equal(render(ctx, bus, SAMPLE), 0, "the game's own mute stopped working")
    // And the app turning Sound off and on again must not undo the game's mute.
    setHostSound(false)
    setHostSound(true)
    assert.equal(render(ctx, bus, SAMPLE), 0, "the app's setting forgot the game had muted itself")
  })

  it("reports the two owners separately", () => {
    const ctx = new Ctx()
    const bus = createSafetyBus(ctx)
    bus.setMuted(true)
    assert.equal(bus.gameMuted, true)
    assert.equal(bus.hostAllows, true)
    setHostSound(false)
    assert.equal(bus.hostAllows, false)
  })
})

// ─── How the gate moves ──────────────────────────────────────────────────────

describe("the gate on a real AudioParam", () => {
  it("ramps rather than stepping, because a step from 1 to 0 is a click", () => {
    const ctx = new SchedulingCtx()
    const bus = createSafetyBus(ctx)
    assert.ok(Math.abs(render(ctx, bus, SAMPLE) - SAMPLE) < 1e-6)

    setHostSound(false)
    // Nothing has arrived yet: this is a ramp, not an assignment.
    assert.ok(render(ctx, bus, SAMPLE) > 0, "the gate stepped instead of ramping")
    // 12 ms later it is shut, which is well inside "immediate" for a human.
    ctx.currentTime += 0.05
    assert.equal(render(ctx, bus, SAMPLE), 0, "the ramp never arrived")
  })

  it("mounts muted with no fade in, so a game with Sound off is silent at sample zero", () => {
    setHostSound(false)
    const ctx = new SchedulingCtx()
    const bus = createSafetyBus(ctx)
    assert.equal(render(ctx, bus, SAMPLE), 0, "the first 12 ms of a Sound-off game were audible")
  })

  it("falls back to a step where the context has no automation", () => {
    // The shape most of the 27 games' own fake contexts implement. Blunt, but
    // complete — and the alternative is a shared module breaking their suites,
    // which has happened here before.
    const ctx = new Ctx()
    const bus = createSafetyBus(ctx)
    setHostSound(false)
    assert.equal(render(ctx, bus, SAMPLE), 0, "a value-only AudioParam was never gated")
  })
})
