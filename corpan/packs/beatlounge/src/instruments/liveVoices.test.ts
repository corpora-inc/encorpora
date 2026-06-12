import { describe, expect, it } from "vitest"
import {
  createLivePool,
  midiToHz,
  type LiveVoice,
  type LiveVoiceFactory,
} from "./liveVoices"

/** A spy voice recording every call (no WebAudio). */
interface Event {
  kind: "attack" | "setHz" | "release" | "dispose"
  hz?: number
  glide?: number
  velocity?: number
  when?: number
}

const spyFactory = (opts: Partial<LiveVoiceFactory> = {}) => {
  const events: Event[] = []
  let created = 0
  const factory: LiveVoiceFactory = {
    maxVoices: opts.maxVoices ?? 4,
    glideSec: opts.glideSec ?? 0.05,
    create(): LiveVoice {
      created++
      return {
        attack: (velocity, when) => events.push({ kind: "attack", velocity, when }),
        setHz: (hz, when, glide) => events.push({ kind: "setHz", hz, when, glide }),
        release: (when) => {
          events.push({ kind: "release", when })
          return 0.2
        },
        dispose: () => events.push({ kind: "dispose" }),
      }
    },
  }
  return { factory, events, count: () => created }
}

describe("midiToHz", () => {
  it("anchors A4 = 69 → 440 Hz", () => {
    expect(midiToHz(69)).toBeCloseTo(440, 5)
  })
  it("an octave up doubles the frequency", () => {
    expect(midiToHz(81)).toBeCloseTo(880, 5)
  })
  it("handles fractional (microtonal) pitch", () => {
    // +50 cents above A4 ≈ 452.89 Hz.
    expect(midiToHz(69.5)).toBeCloseTo(452.89, 1)
  })
})

describe("createLivePool", () => {
  it("startVoice sets pitch INSTANTLY then attacks", () => {
    const { factory, events } = spyFactory()
    const pool = createLivePool(factory)
    pool.startVoice(69, 0.8, 1.0)
    const setHz = events.find((e) => e.kind === "setHz")!
    const attack = events.find((e) => e.kind === "attack")!
    expect(setHz.hz).toBeCloseTo(440, 3)
    expect(setHz.glide).toBe(0) // note-on never glides into the first note
    expect(attack.velocity).toBeCloseTo(0.8, 5)
  })

  it("bendVoice glides a held voice with the factory glide time", () => {
    const { factory, events } = spyFactory({ glideSec: 0.07 })
    const pool = createLivePool(factory)
    const id = pool.startVoice(60, 0.9, 0)
    pool.bendVoice(id, 72, 0.1)
    const setHzEvents = events.filter((e) => e.kind === "setHz")
    const bend = setHzEvents[setHzEvents.length - 1]
    expect(bend.hz).toBeCloseTo(midiToHz(72), 3)
    expect(bend.glide).toBeCloseTo(0.07, 5)
  })

  it("is polyphonic — each finger gets its own voice + id", () => {
    const { factory, count } = spyFactory()
    const pool = createLivePool(factory)
    const a = pool.startVoice(60, 0.9, 0)
    const b = pool.startVoice(64, 0.9, 0)
    const c = pool.startVoice(67, 0.9, 0)
    expect(new Set([a, b, c]).size).toBe(3)
    expect(count()).toBe(3)
  })

  it("releasing frees the slot so a later voice REUSES it (no leak)", () => {
    const { factory, count } = spyFactory({ maxVoices: 2 })
    const pool = createLivePool(factory)
    const a = pool.startVoice(60, 0.9, 0)
    pool.endVoice(a, 0) // released at t=0, tail 0.2 → free at ~0.25
    // A new voice well after the tail reuses the freed slot (no new voice).
    pool.startVoice(62, 0.9, 1.0)
    expect(count()).toBe(1)
  })

  it("ignores bend/release for unknown or already-released ids", () => {
    const { factory, events } = spyFactory()
    const pool = createLivePool(factory)
    const a = pool.startVoice(60, 0.9, 0)
    pool.endVoice(a, 0)
    const before = events.length
    pool.bendVoice(a, 72, 0.5) // already released — no-op
    pool.endVoice(a, 0.6) // double release — no-op
    pool.bendVoice(999, 60, 0.7) // unknown — no-op
    expect(events.length).toBe(before)
  })

  it("steals the oldest voice once max polyphony is exceeded", () => {
    const { factory, count } = spyFactory({ maxVoices: 2 })
    const pool = createLivePool(factory)
    pool.startVoice(60, 0.9, 0) // oldest
    pool.startVoice(62, 0.9, 1)
    pool.startVoice(64, 0.9, 2) // exceeds max → steals, no 3rd voice built
    expect(count()).toBe(2)
  })

  it("dispose tears down every built voice", () => {
    const { factory, events } = spyFactory()
    const pool = createLivePool(factory)
    pool.startVoice(60, 0.9, 0)
    pool.startVoice(64, 0.9, 0)
    pool.dispose()
    expect(events.filter((e) => e.kind === "dispose")).toHaveLength(2)
  })
})
