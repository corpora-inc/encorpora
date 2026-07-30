/**
 * The wire from the app's Sound switch to a silent game.
 *
 * `attachGameHost` already read `safeArea` and `reducedMotion` off
 * `client.settings` and walked past `sound`. Nothing else read it either: all
 * 27 games shipped their own mute button and their own localStorage key, so a
 * parent turning Sound off in Settings silenced nothing at all.
 *
 * These tests run the whole path a device runs: a host client whose settings
 * say what the app's store says, a pack attaching to it, and a game's audio
 * graph built through the shared safety bus. What is asserted is what leaves
 * the graph, because "is it silent" is not a question a spy can answer.
 */
import assert from "node:assert/strict"
import { beforeEach, describe, it } from "node:test"

import type { HostClient, HostEventName, Settings } from "../../sdk/src/index.ts"
import { createSafetyBus, resetHostSound, type BusContext } from "../game-audio/index.ts"
import { setHostInsets, safeInsets } from "../game-chrome/insets.ts"
import {
  currentSoundscape,
  pickSoundscape,
  resetHostSoundscape,
} from "../game-soundscape/index.ts"
import { attachGameHost } from "./index.ts"

// ─── The smallest host that can change its mind ──────────────────────────────

const BASE: Settings = {
  locale: "en",
  reducedMotion: false,
  quality: "high",
  textScale: 1,
  colorScheme: "light",
  sound: true,
  haptics: true,
}

type Stub = {
  readonly client: HostClient
  /** What the app's Settings screen just did. Pushes a `settings` event, as the real host does. */
  push(next: Partial<Settings>): void
  setSound(on: boolean): void
}

/**
 * A client that behaves like the SDK's guest on the one axis under test:
 * `settings` is live, and a `settings` event follows every change to it.
 */
function stubClient(initial: Partial<Settings> = {}): Stub {
  let settings: Settings = { ...BASE, ...initial }
  const listeners = new Map<HostEventName, Set<(data: unknown) => void>>()
  const client: HostClient = {
    packId: "dynawalla.test",
    hostVersion: "0.1.0",
    granted: [],
    // Nothing is granted to this stub, so nothing is usable and the tilt reader
    // is unavailable — which is what the SDK's own client reports for a pack that
    // declared no native capability. See `docs/NATIVE_CAPABILITIES.md`.
    usable: [],
    available: () => false,
    tilt: { available: false, start: () => () => {} },
    get settings() {
      return settings
    },
    can: () => false,
    nextItem: () => Promise.resolve(null),
    answer: () => Promise.reject(new Error("not used")),
    skip: () => Promise.resolve(),
    reveal: () => Promise.resolve(""),
    learnerSummary: () => Promise.resolve({ skills: [] }),
    haptic: () => Promise.resolve(),
    sound: () => Promise.resolve(),
    milestone: () => Promise.resolve(),
    storage: {
      get: () => Promise.resolve(null),
      set: () => Promise.resolve(),
      remove: () => Promise.resolve(),
      keys: () => Promise.resolve([]),
    },
    progress: () => Promise.resolve(),
    end: () => Promise.resolve(),
    transition: () => Promise.resolve(),
    on: (event, listener) => {
      const set = listeners.get(event) ?? new Set()
      set.add(listener)
      listeners.set(event, set)
      return () => void set.delete(listener)
    },
    dispose: () => {},
  }
  const push = (next: Partial<Settings>): void => {
    settings = { ...settings, ...next }
    for (const listener of listeners.get("settings") ?? []) listener(settings)
  }
  return { client, push, setSound: (on: boolean) => push({ sound: on }) }
}

// ─── A graph that processes samples ──────────────────────────────────────────

class Param {
  value: number
  constructor(v = 0) {
    this.value = v
  }
}
class Node {
  readonly gain = new Param(1)
  readonly threshold = new Param()
  readonly knee = new Param()
  readonly ratio = new Param()
  readonly attack = new Param()
  readonly release = new Param()
  curve: Float32Array | null = null
  oversample = "none"
  readonly outs: Node[] = []
  readonly kind: "gain" | "comp" | "shaper" | "dest"
  constructor(kind: "gain" | "comp" | "shaper" | "dest") {
    this.kind = kind
  }
  connect<T>(d: T): T {
    this.outs.push(d as unknown as Node)
    return d
  }
  disconnect(): void {
    this.outs.length = 0
  }
  process(x: number): number {
    if (this.kind === "gain") return x * this.gain.value
    if (this.kind === "shaper") return this.curve ? lookup(this.curve, x) : x
    return x
  }
}
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
  createGain(): GainNode {
    return new Node("gain") as unknown as GainNode
  }
  createDynamicsCompressor(): DynamicsCompressorNode {
    return new Node("comp") as unknown as DynamicsCompressorNode
  }
  createWaveShaper(): WaveShaperNode {
    return new Node("shaper") as unknown as WaveShaperNode
  }
}

/** What a game sounds like: one cue pushed through its bus to the speaker. */
function heard(ctx: Ctx, bus: { input: AudioNode }, x = 0.4): number {
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

const CUE = 0.4

// The setting is module state in game-audio; a test that inherits the previous
// test's answer is a test that passes for the wrong reason.
beforeEach(() => {
  resetHostSound()
  setHostInsets(null)
})

describe("the app's Sound setting silences the game", () => {
  it("THE DEFECT: a game launched with Sound off is silent", () => {
    const stub = stubClient({ sound: false })
    attachGameHost(stub.client)

    // Exactly what a game does in `start()`, after the gesture.
    const ctx = new Ctx()
    const bus = createSafetyBus(ctx)
    assert.equal(
      heard(ctx, bus, CUE),
      0,
      "the parent turned Sound off before launch and the game played anyway",
    )
  })

  it("THE DEFECT, LIVE: the switch works during a session, in both directions", () => {
    const stub = stubClient({ sound: true })
    attachGameHost(stub.client)
    const ctx = new Ctx()
    const bus = createSafetyBus(ctx)

    assert.ok(Math.abs(heard(ctx, bus, CUE) - CUE) < 1e-6, "Sound is on and the game is silent")

    stub.setSound(false)
    assert.equal(heard(ctx, bus, CUE), 0, "Sound was switched off mid-game and nothing happened")

    stub.setSound(true)
    assert.ok(
      Math.abs(heard(ctx, bus, CUE) - CUE) < 1e-6,
      "the gate stuck shut: Sound came back and the game did not",
    )
  })

  it("keeps publishing the insets it always published", () => {
    // The settings handler grew a second job, and the two were folded into one
    // listener. The first job has to survive that — a shared handler that
    // quietly replaced the other is exactly the regression this repo has
    // shipped before, so this reads the insets back out of game-chrome rather
    // than trusting that the call was made.
    const stub = stubClient({ safeArea: { top: 47, right: 0, bottom: 34, left: 0 } })
    attachGameHost(stub.client)
    assert.deepEqual(safeInsets(), { top: 47, right: 0, bottom: 34, left: 0 })

    stub.push({ safeArea: { top: 0, right: 21, bottom: 21, left: 0 } })
    assert.deepEqual(
      safeInsets(),
      { top: 0, right: 21, bottom: 21, left: 0 },
      "rotating the tablet no longer moves the safe area",
    )
  })

  it("a host too old to send the field does not silence the game", () => {
    const { sound: _omitted, ...older } = BASE
    const stub = stubClient()
    const legacy: HostClient = { ...stub.client, settings: older as Settings }
    attachGameHost(legacy)
    const ctx = new Ctx()
    const bus = createSafetyBus(ctx)
    assert.ok(
      Math.abs(heard(ctx, bus, CUE) - CUE) < 1e-6,
      "an older host with no `sound` field silenced a game it never asked to silence",
    )
  })

  it("a game's own mute button cannot override the parent", () => {
    const stub = stubClient({ sound: false })
    attachGameHost(stub.client)
    const ctx = new Ctx()
    const bus = createSafetyBus(ctx)

    bus.setMuted(false) // the child pressed the in-game speaker icon
    assert.equal(heard(ctx, bus, CUE), 0, "the in-game button unmuted past the app setting")

    stub.setSound(true)
    assert.ok(
      Math.abs(heard(ctx, bus, CUE) - CUE) < 1e-6,
      "the child's own preference was lost when Sound came back",
    )
  })

  it("silences every bus in the pack at once", () => {
    // Several games build more than one: music and effects on separate buses.
    const stub = stubClient({ sound: true })
    attachGameHost(stub.client)
    const music = new Ctx()
    const sfx = new Ctx()
    const musicBus = createSafetyBus(music)
    const sfxBus = createSafetyBus(sfx)

    stub.setSound(false)
    assert.equal(heard(music, musicBus, CUE), 0, "the music bus kept playing")
    assert.equal(heard(sfx, sfxBus, CUE), 0, "the effects bus kept playing")
  })
})

// ─── The soundscape, on the same channel ─────────────────────────────────────
//
// The third slow-moving fact that has to reach a pack from the host, and the
// same failure mode is available: publish it once at attach and a child who
// plays across a key change is in the wrong key for the rest of the session.
// These assert the wire rather than the music — `game-soundscape` owns whether
// the notes are right, and this owns whether the pack was told.

describe("the app's soundscape reaches the pack", () => {
  beforeEach(() => {
    resetHostSoundscape()
  })

  it("is published at attach", () => {
    const scape = pickSoundscape(31)
    const stub = stubClient({ soundscape: scape })
    attachGameHost(stub.client)
    assert.deepEqual(currentSoundscape(), scape)
    resetHostSoundscape()
  })

  it("follows a change without a remount", () => {
    const stub = stubClient({ soundscape: pickSoundscape(1) })
    attachGameHost(stub.client)
    const next = pickSoundscape(2)
    stub.push({ soundscape: next })
    assert.deepEqual(currentSoundscape(), next, "the pack stayed in the old key")
    resetHostSoundscape()
  })

  it("a host that sends none leaves every game with its own sounds", () => {
    // The ship gate. No host populates this field today, so this is the path
    // production takes, and `null` has to mean "keep what you had" rather than
    // "go quiet".
    const stub = stubClient()
    attachGameHost(stub.client)
    assert.equal(currentSoundscape(), null)
    resetHostSoundscape()
  })

  it("a malformed one is refused rather than played", () => {
    const stub = stubClient()
    attachGameHost(stub.client)
    stub.push({ soundscape: { modeId: "not.a.mode", rootHz: 130, seed: 1 } as never })
    assert.equal(currentSoundscape(), null, "a mode the pack does not have was accepted")
    resetHostSoundscape()
  })
})
