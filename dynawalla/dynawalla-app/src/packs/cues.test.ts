// The host's own cues, measured.
//
// Every pack's audio ends at `createSafetyBus` — a limiter, then a
// `WaveShaperNode` whose curve is flat at −1 dBFS, then the mute gate — and
// `packs/shared/game-audio/routing.test.ts` fails any game that connects to
// `ctx.destination` instead. The host was the one source in the product with
// nothing over it: `playCue` connected straight to the output. Harmless while
// it is five short triangle tones; not harmless the moment the host owns the
// continuous ambient bed the soundscape design gives it, because a bed and a
// cue summing on an unlimited path is the MOSAIC incident with the roles
// swapped, and a bed is by definition always playing.
//
// ── Why this renders instead of grepping ────────────────────────────────────
//
// `routing.test.ts` is a source scan and says so, because a game's graph is
// built inside a `start()` that needs a gesture and a real `AudioContext`. The
// host's cue graph does not: `playCue` takes the context it is handed, so the
// graph it actually builds can be assembled here and had samples pushed through
// it. Everything below is a number that came out of the graph, not a line of
// code that was found in a file.
//
// The fake is the one from `game-audio/safetyBus.test.ts`, extended with an
// oscillator, and it keeps that file's two deliberate choices:
//
//   * the compressor is a straight wire. A `DynamicsCompressorNode` has a real
//     attack time and the first milliseconds of a transient pass through it
//     unattenuated, so assuming it does nothing is the honest worst case. It is
//     also why a compressor is not a ceiling: its makeup gain is derived from
//     its threshold, so at any threshold below 0 dB it makes quiet material
//     LOUDER.
//   * the shaper implements the spec's lookup exactly, including the clause
//     that is the whole guarantee — an input outside [-1, 1] uses the nearest
//     curve value.

import { test } from "node:test"
import assert from "node:assert/strict"

import { CUE_PEAK, closeCueAudio, playCue, type CueAudio, type CueContext } from "./services.ts"
import type { SoundCue } from "../../../packs/sdk/src/index.ts"
import { CEILING } from "../../../packs/shared/game-audio/index.ts"

const CUES: readonly SoundCue[] = ["tick", "seat", "settle", "refuse", "arrive"]

type Kind = "osc" | "gain" | "comp" | "shaper" | "dest"

class Param {
  value: number
  /**
   * The largest value this param is ever asked for.
   *
   * A real `GainNode.gain` defaults to **1**, and the envelope in `playCue` is
   * three scheduling calls against `context.currentTime` — so from the cue's
   * onset it is the schedule that governs and not the default. Modelled that
   * way: once anything has been scheduled, the peak is the peak of the
   * schedule; until then it is whatever was assigned. Delete the envelope and
   * this reads 1, which is what the "not turned down to get there" assertion
   * below would then measure — an eight-fold jump.
   */
  peak: number
  private scheduled = false
  constructor(v = 0) {
    this.value = v
    this.peak = v
  }
  private note(v: number): void {
    if (!this.scheduled) {
      this.scheduled = true
      this.peak = v
      return
    }
    this.peak = Math.max(this.peak, v)
  }
  setValueAtTime(v: number): void {
    this.value = v
    this.note(v)
  }
  exponentialRampToValueAtTime(v: number): void {
    this.value = v
    this.note(v)
  }
  linearRampToValueAtTime(v: number): void {
    this.value = v
    this.note(v)
  }
  cancelScheduledValues(): void {}
}

class Node {
  disconnected = false
  readonly gain = new Param(1)
  readonly frequency = new Param(440)
  readonly threshold = new Param()
  readonly knee = new Param()
  readonly ratio = new Param()
  readonly attack = new Param()
  readonly release = new Param()
  type = "sine"
  curve: Float32Array | null = null
  oversample = "none"
  readonly outs: Node[] = []
  started = false
  readonly kind: Kind
  constructor(kind: Kind) {
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
  start(): void {
    this.started = true
  }
  stop(): void {}
  process(x: number): number {
    if (this.kind === "gain") return x * this.gain.peak
    if (this.kind === "comp") return x // worst case: the limiter has not engaged
    if (this.kind === "shaper") return this.curve ? lookup(this.curve, x) : x
    return x
  }
}

/** `WaveShaperNode`, per spec, including the out-of-range clause. */
function lookup(curve: Float32Array, x: number): number {
  const n = curve.length
  const v = ((n - 1) / 2) * (x + 1)
  if (!(v > 0)) return curve[0] ?? 0
  if (v >= n - 1) return curve[n - 1] ?? 0
  const k = Math.floor(v)
  const f = v - k
  return (curve[k] ?? 0) * (1 - f) + (curve[k + 1] ?? 0) * f
}

class Ctx {
  currentTime = 0
  state = "running"
  resumed = 0
  closed = 0
  readonly destination = new Node("dest")
  readonly made: Node[] = []
  private mk(kind: Kind): Node {
    const n = new Node(kind)
    this.made.push(n)
    return n
  }
  resume(): void {
    this.resumed += 1
  }
  close(): void {
    this.closed += 1
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
  createOscillator(): OscillatorNode {
    return this.mk("osc") as unknown as OscillatorNode
  }
}

const asContext = (ctx: Ctx): CueContext => ctx as unknown as CueContext

/** A fresh session: one context, one bus, nothing played yet. */
function session(): { ctx: Ctx; audio: CueAudio; play: (cue: SoundCue) => void } {
  const ctx = new Ctx()
  const audio: CueAudio = { context: null, bus: null }
  return { ctx, audio, play: (cue) => playCue(audio, cue, () => asContext(ctx)) }
}

/** The chain a cue's oscillator actually reaches the output through. */
function path(ctx: Ctx): Node[] {
  const osc = ctx.made.find((n) => n.kind === "osc")
  assert.ok(osc, "no oscillator was created — nothing played")
  const chain: Node[] = [osc]
  let node: Node = osc
  for (let i = 0; i < 64; i++) {
    const next = node.outs[0]
    assert.ok(next, "the cue graph does not reach an output")
    if (next === ctx.destination) return chain
    chain.push(next)
    node = next
  }
  throw new Error("the cue graph did not terminate")
}

/** Push one sample in at the oscillator and read what reaches the speaker. */
function render(ctx: Ctx, x: number): number {
  let v = x
  for (const node of path(ctx)) v = node.process(v)
  return v
}

test("a host cue reaches the output at all", () => {
  const { ctx, play } = session()
  play("tick")
  const osc = ctx.made.find((n) => n.kind === "osc")
  assert.ok(osc?.started, "the oscillator was never started")
  assert.equal(osc.frequency.value, 880)
  assert.equal(osc.type, "triangle")
})

test("the host's own cue CANNOT leave above the ceiling", () => {
  // The whole point. Driven far past anything an oscillator can produce,
  // because the guarantee is about the graph and not about the source: the bed
  // that is coming will sum with these, and a graph that only holds for inputs
  // under 1 is not a ceiling.
  for (const cue of CUES) {
    const { ctx, play } = session()
    play(cue)
    for (const x of [0.9, 1, 2.344, 13.955, 100, 1e6]) {
      const y = render(ctx, x)
      assert.ok(
        y <= CEILING + 1e-6,
        `${cue}: an input of ${x} left the host at ${y}, above the ceiling ${CEILING}`,
      )
      assert.ok(render(ctx, -x) >= -(CEILING + 1e-6), `${cue}: the negative half escaped`)
      assert.ok(Math.abs(y) < 1, `${cue}: an input of ${x} clipped`)
    }
  }
})

test("and it is not turned down to get there — the cue still sounds as authored", () => {
  // The wrong fix for the ceiling is a volume knob, and the founder has said so:
  // the direction is more juice. A full-scale oscillator through the cue's
  // envelope must still measure exactly the peak the envelope asks for.
  for (const cue of CUES) {
    const { ctx, play } = session()
    play(cue)
    assert.ok(
      Math.abs(render(ctx, 1) - CUE_PEAK) < 1e-6,
      `${cue}: peaks at ${render(ctx, 1)}, not the authored ${CUE_PEAK}`,
    )
    // Well under the knee, so the ceiling is transparent here rather than
    // merely bounded: nothing about how these five cues sound has changed.
    assert.ok(CUE_PEAK < 0.5)
  }
})

test("the ceiling in the path is the real one: a shaper, flat at CEILING, un-oversampled", () => {
  const { ctx, play } = session()
  play("arrive")
  const chain = path(ctx)

  const shaper = chain.find((n) => n.kind === "shaper")
  assert.ok(shaper, "the host's cue reaches the speaker without passing a WaveShaper")
  const curve = shaper.curve
  assert.ok(curve && curve.length >= 1024, "the shaper has no curve to be a ceiling with")

  // Measured off the curve that was installed, not off a constant: the largest
  // value in it is the largest sample the node can emit for ANY input.
  let top = 0
  for (const v of curve) top = Math.max(top, Math.abs(v))
  assert.ok(Math.abs(top - CEILING) < 1e-6, `the curve tops out at ${top}, not ${CEILING}`)

  // "none", and it matters: oversampling means upsample, shape, downsample, and
  // the downsampling filter rings PAST the curve's own maximum. Rendered against
  // a real implementation the same curve measured 0.890 at "none", 1.082 at
  // "2x" and 1.098 at "4x" — the nicer-sounding setting is the one that voids
  // the guarantee.
  assert.equal(shaper.oversample, "none")

  // A compressor is present and is doing the musical work, but it is not what
  // is being trusted: its makeup gain is derived from its threshold, so it is
  // not a limiter at any threshold below 0 dB, and the render above models it
  // as a wire for exactly that reason.
  const comp = chain.find((n) => n.kind === "comp")
  assert.ok(comp, "no limiter in the host's cue path")
  assert.equal(comp.threshold.value, 0, "a negative threshold applies makeup gain")

  // And the ceiling is upstream of the mute, so muting is silence and not
  // merely quiet: the last gain before the speaker comes after the shaper.
  assert.equal(chain[chain.length - 1]?.kind, "gain", "the gate is not the last node")
})

test("one bus for the whole session, not one per tap", () => {
  // A bus per cue is five nodes and a `game-audio/sound.ts` subscription leaked
  // on every single tap a child makes, for the life of the app.
  const { ctx, play } = session()
  for (let round = 0; round < 3; round++) for (const cue of CUES) play(cue)
  assert.equal(ctx.made.filter((n) => n.kind === "shaper").length, 1)
  assert.equal(ctx.made.filter((n) => n.kind === "comp").length, 1)
  assert.equal(ctx.made.filter((n) => n.kind === "osc").length, CUES.length * 3)
})

test("one context for the whole session, resumed when the device suspended it", () => {
  const ctx = new Ctx()
  ctx.state = "suspended"
  const audio: CueAudio = { context: null, bus: null }
  let opened = 0
  const open = () => {
    opened += 1
    return asContext(ctx)
  }
  playCue(audio, "tick", open)
  playCue(audio, "seat", open)
  assert.equal(opened, 1, "a context was opened per cue")
  assert.equal(ctx.resumed, 2, "a suspended context was never resumed")
})

test("a device with no audio is a quiet cue, not a broken app", () => {
  const audio: CueAudio = { context: null, bus: null }
  playCue(audio, "tick", () => null)
  assert.equal(audio.context, null)
  assert.equal(audio.bus, null)
})

test("a context that throws is logged, loudly, and does not take the host down", () => {
  const errors: unknown[][] = []
  const real = console.error
  console.error = (...args: unknown[]) => void errors.push(args)
  try {
    const audio: CueAudio = { context: null, bus: null }
    playCue(audio, "tick", () => {
      throw new Error("no audio on this device")
    })
  } finally {
    console.error = real
  }
  assert.equal(errors.length, 1, "a failing cue was swallowed silently")
})

test("closing a session gives the device back, totally and idempotently", () => {
  // Not tidiness. `createSafetyBus` registers a listener in `game-audio`'s
  // module-global set of live buses, which keeps the bus, its nodes and the
  // context reachable for the life of the app — and an `AudioContext` is
  // scarce: Chromium allows six per document and throws on the seventh. A child
  // who opens eight games in one sitting would find the host's cues silent for
  // the rest of the session, with one caught-and-logged error to show for it.
  //
  // Idempotent because React runs a cleanup twice in development StrictMode,
  // and an unmount after a launch that never played runs it against a session
  // with no context at all.
  const ctx = new Ctx()
  const audio: CueAudio = { context: null, bus: null }
  playCue(audio, "tick", () => asContext(ctx))
  // The bus's own nodes: the chain after the oscillator and the cue's envelope.
  // The envelope gain is per-tap and is collected when the oscillator stops,
  // which is the same thing every game in the fleet relies on.
  const nodes = path(ctx).slice(2)
  assert.ok(nodes.length >= 4, `the bus is only ${nodes.length} nodes`)

  closeCueAudio(audio)
  assert.ok(nodes.every((n) => n.disconnected), "a bus node was left connected")
  assert.equal(ctx.closed, 1)
  assert.equal(audio.bus, null)
  assert.equal(audio.context, null)

  closeCueAudio(audio)
  assert.equal(ctx.closed, 1, "a second close reached the device")
  closeCueAudio({ context: null, bus: null })

  // And the session can play again afterwards: a new context, a new bus, and
  // the ceiling still in the path.
  playCue(audio, "seat", () => asContext(new Ctx()))
  assert.notEqual(audio.bus, null)
})
