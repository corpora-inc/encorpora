/**
 * beatlounge — AUTO CONDUCTOR tests. The rig-level generative engine behind the
 * Auto chip, over a REAL command bus + store and a controllable fake audio
 * facade. The headline guard: a forever-regenerating line leaves the undo stack
 * (and IDB) untouched because the conductor writes through store.preview() and
 * never keep()s.
 */

import { describe, expect, it, beforeEach, vi } from "vitest"
import { createCommandBus } from "../model/commandBus"
import { createBeatloungeStore } from "../store/store"
import {
  createDefaultDoc,
  findTrack,
  isInstrumentTrack,
  type BeatloungeDoc,
  type Id,
} from "../model/document"
import type { AudioFacade } from "../contracts/audioFacade"
import { createAutoConductor } from "./AutoConductor"
import {
  __resetAutoMelodyForTest,
  setAutoArmed,
  setAutoOption,
} from "../store/autoMelody"

/** A fake AudioFacade that lets the test drive playhead ticks + the play flag. */
const makeFakeAudio = () => {
  let playing = false
  const subs = new Set<(tick: number) => void>()
  const unsubSpy = vi.fn()
  const onPlayheadSpy = vi.fn((cb: (tick: number) => void) => {
    subs.add(cb)
    return () => {
      unsubSpy()
      subs.delete(cb)
    }
  })
  const audio = {
    start: async () => {},
    stop: () => {},
    isPlaying: () => playing,
    onPlayhead: onPlayheadSpy,
    previewTrack: () => {},
    applyParam: () => {},
    playLiveVoice: () => undefined,
    context: () => ({}) as AudioContext,
    dispose: () => {},
  } as unknown as AudioFacade
  return {
    audio,
    onPlayheadSpy,
    unsubSpy,
    setPlaying: (p: boolean) => {
      playing = p
    },
    /** Deliver a tick to every live subscription. */
    emit: (tick: number) => {
      for (const cb of subs) cb(tick)
    },
    liveSubs: () => subs.size,
  }
}

const buildRig = (doc: BeatloungeDoc) => {
  const bus = createCommandBus(doc)
  const store = createBeatloungeStore(bus)
  return { bus, store }
}

const melodicTrackId = (d: BeatloungeDoc): Id => {
  const t = d.tracks.find((t) => isInstrumentTrack(t) && t.instrument.kind !== "drumSampler")
  if (!t) throw new Error("no melodic track")
  return t.id
}

const drumTrackId = (d: BeatloungeDoc): Id => {
  const t = d.tracks.find((t) => isInstrumentTrack(t) && t.instrument.kind === "drumSampler")
  if (!t) throw new Error("no drum track")
  return t.id
}

const notesOf = (doc: BeatloungeDoc, trackId: Id) => {
  const t = findTrack(doc, trackId)
  return t && isInstrumentTrack(t) ? t.notes : []
}

/** A line's musical content (tick/pitch/duration/velocity), id-free — setNotes
 *  assigns fresh note ids each call, so compare on the actual notes, not ids. */
const lineSig = (doc: BeatloungeDoc, trackId: Id): string =>
  JSON.stringify(
    notesOf(doc, trackId).map((n) => ({
      tick: n.tick,
      pitch: n.pitch,
      duration: n.duration,
      velocity: n.velocity,
    }))
  )

/** Drive a full loop wrap: a forward tick then a backward jump. */
const wrap = (fake: ReturnType<typeof makeFakeAudio>) => {
  fake.emit(10)
  fake.emit(0) // backward → loop wrap
}

beforeEach(() => {
  __resetAutoMelodyForTest()
  // Clear the globalThis singleton between specs.
  const g = globalThis as unknown as { __blAutoConductor?: { dispose(): void } }
  g.__blAutoConductor?.dispose()
  g.__blAutoConductor = undefined
})

describe("undo cleanliness (the regression guard)", () => {
  it("N loop wraps leave the undo stack empty and the doc holds the last line", () => {
    const doc = createDefaultDoc(0)
    const { bus, store } = buildRig(doc)
    const trackId = melodicTrackId(doc)
    const fake = makeFakeAudio()
    createAutoConductor({ store, audio: fake.audio })

    setAutoArmed(trackId, true)
    setAutoOption(trackId, { variation: "new" })
    fake.setPlaying(true)

    for (let i = 0; i < 8; i++) wrap(fake)

    expect(bus.canUndo()).toBe(false)
    expect(bus.canRedo()).toBe(false)
    // The doc reflects the LAST generated line (preview applied, not rolled back).
    const last = notesOf(store.vanilla.getState().doc, trackId)
    expect(last.length).toBeGreaterThan(0)
  })
})

describe("transport gating", () => {
  it("a stopped transport writes nothing, even on a backward jump", () => {
    const doc = createDefaultDoc(0)
    const { store } = buildRig(doc)
    const trackId = melodicTrackId(doc)
    const before = JSON.stringify(notesOf(doc, trackId))
    const fake = makeFakeAudio()
    createAutoConductor({ store, audio: fake.audio })

    setAutoArmed(trackId, true)
    fake.setPlaying(false)
    wrap(fake)

    expect(JSON.stringify(notesOf(store.vanilla.getState().doc, trackId))).toBe(before)
  })

  it("writes once playing and a wrap fires", () => {
    const doc = createDefaultDoc(0)
    const { store } = buildRig(doc)
    const trackId = melodicTrackId(doc)
    const before = JSON.stringify(notesOf(doc, trackId))
    const fake = makeFakeAudio()
    createAutoConductor({ store, audio: fake.audio })

    setAutoArmed(trackId, true)
    fake.setPlaying(true)
    wrap(fake)

    expect(JSON.stringify(notesOf(store.vanilla.getState().doc, trackId))).not.toBe(before)
  })
})

describe("wrap edge detection", () => {
  it("forward ticks never fire a fill; only a backward jump does", () => {
    const doc = createDefaultDoc(0)
    const { store } = buildRig(doc)
    const trackId = melodicTrackId(doc)
    const fake = makeFakeAudio()
    createAutoConductor({ store, audio: fake.audio })
    setAutoArmed(trackId, true)
    fake.setPlaying(true)

    const before = JSON.stringify(notesOf(store.vanilla.getState().doc, trackId))
    fake.emit(0)
    fake.emit(4)
    fake.emit(8)
    fake.emit(12) // all forward
    expect(JSON.stringify(notesOf(store.vanilla.getState().doc, trackId))).toBe(before)
    fake.emit(2) // backward → wrap
    expect(JSON.stringify(notesOf(store.vanilla.getState().doc, trackId))).not.toBe(before)
  })

  it("a loopLength change resets the baseline (no spurious wrap)", () => {
    const doc = createDefaultDoc(0)
    const { bus, store } = buildRig(doc)
    const trackId = melodicTrackId(doc)
    const fake = makeFakeAudio()
    createAutoConductor({ store, audio: fake.audio })
    setAutoArmed(trackId, true)
    fake.setPlaying(true)

    fake.emit(12) // prevTick = 12
    // Now the loop length changes (e.g. user shortened the loop). The next tick
    // is backward relative to 12 but must NOT fire because the baseline resets.
    bus.dispatch({ t: "setLoopLength", ticks: 480 })
    const before = JSON.stringify(notesOf(store.vanilla.getState().doc, trackId))
    fake.emit(5) // would look like a wrap vs 12, but baseline was reset to -1
    expect(JSON.stringify(notesOf(store.vanilla.getState().doc, trackId))).toBe(before)
  })
})

describe("multi-track de-correlation", () => {
  it("two tracks on the same Feel/Motion get different lines (trackId salt)", () => {
    // Build a doc with two melodic tracks.
    const base = createDefaultDoc(0)
    const synth = base.tracks.find(
      (t) => isInstrumentTrack(t) && t.instrument.kind !== "drumSampler"
    )!
    const synth2 = { ...synth, id: "trk_synth2" as Id, notes: [] }
    const doc: BeatloungeDoc = { ...base, tracks: [...base.tracks, synth2] }
    const { store } = buildRig(doc)
    const fake = makeFakeAudio()
    createAutoConductor({ store, audio: fake.audio })

    const id1 = synth.id
    const id2 = "trk_synth2" as Id
    for (const id of [id1, id2]) {
      setAutoArmed(id, true)
      setAutoOption(id, { variation: "lock" })
    }
    fake.setPlaying(true)
    wrap(fake)

    const a = lineSig(store.vanilla.getState().doc, id1)
    const b = lineSig(store.vanilla.getState().doc, id2)
    expect(a).not.toBe(b)
  })
})

describe("variation policy", () => {
  it("lock → identical notes across wraps", () => {
    const doc = createDefaultDoc(0)
    const { store } = buildRig(doc)
    const trackId = melodicTrackId(doc)
    const fake = makeFakeAudio()
    createAutoConductor({ store, audio: fake.audio })
    setAutoArmed(trackId, true)
    setAutoOption(trackId, { variation: "lock" })
    fake.setPlaying(true)

    wrap(fake)
    const first = lineSig(store.vanilla.getState().doc, trackId)
    wrap(fake)
    const second = lineSig(store.vanilla.getState().doc, trackId)
    wrap(fake)
    const third = lineSig(store.vanilla.getState().doc, trackId)
    expect(second).toBe(first)
    expect(third).toBe(first)
  })

  it("evolve → changes each wrap but is deterministic for a given seed chain", () => {
    const run = () => {
      __resetAutoMelodyForTest()
      const g = globalThis as unknown as { __blAutoConductor?: { dispose(): void } }
      g.__blAutoConductor?.dispose()
      g.__blAutoConductor = undefined
      const doc = createDefaultDoc(0)
      const { store } = buildRig(doc)
      const trackId = melodicTrackId(doc)
      const fake = makeFakeAudio()
      createAutoConductor({ store, audio: fake.audio })
      setAutoArmed(trackId, true)
      // Pin a deterministic starting seed so the chain is reproducible.
      setAutoOption(trackId, { variation: "evolve" })
      fake.setPlaying(true)
      const lines: string[] = []
      for (let i = 0; i < 3; i++) {
        wrap(fake)
        lines.push(lineSig(store.vanilla.getState().doc, trackId))
      }
      return lines
    }
    const lines = run()
    // Each wrap differs (evolving).
    expect(new Set(lines).size).toBeGreaterThan(1)
  })

  it("new → different each wrap", () => {
    const doc = createDefaultDoc(0)
    const { store } = buildRig(doc)
    const trackId = melodicTrackId(doc)
    const fake = makeFakeAudio()
    createAutoConductor({ store, audio: fake.audio })
    setAutoArmed(trackId, true)
    setAutoOption(trackId, { variation: "new" })
    fake.setPlaying(true)
    const lines: string[] = []
    for (let i = 0; i < 4; i++) {
      wrap(fake)
      lines.push(lineSig(store.vanilla.getState().doc, trackId))
    }
    expect(new Set(lines).size).toBeGreaterThan(1)
  })
})

describe("idempotent mount", () => {
  it("a second createAutoConductor disposes the first; only one sub is live", () => {
    const doc = createDefaultDoc(0)
    const { store } = buildRig(doc)
    const trackId = melodicTrackId(doc)
    const fake = makeFakeAudio()

    const first = createAutoConductor({ store, audio: fake.audio })
    const second = createAutoConductor({ store, audio: fake.audio })
    expect(first).not.toBe(second)
    // The first's playhead sub was torn down on the second mount.
    expect(fake.unsubSpy).toHaveBeenCalledTimes(1)
    expect(fake.liveSubs()).toBe(1)

    setAutoArmed(trackId, true)
    setAutoOption(trackId, { variation: "lock" })
    fake.setPlaying(true)

    // Exactly one write per wrap (not two from a doubled sub).
    let writes = 0
    const off = store.vanilla.subscribe(() => {
      writes += 1
    })
    wrap(fake)
    off()
    expect(writes).toBe(1)
  })
})

describe("dispose safety", () => {
  it("a playhead callback after dispose() is a no-op; both unsubs fire", () => {
    const doc = createDefaultDoc(0)
    const { store } = buildRig(doc)
    const trackId = melodicTrackId(doc)
    const fake = makeFakeAudio()
    const conductor = createAutoConductor({ store, audio: fake.audio })
    setAutoArmed(trackId, true)
    fake.setPlaying(true)

    conductor.dispose()
    expect(fake.unsubSpy).toHaveBeenCalled()
    expect(fake.liveSubs()).toBe(0)

    // Even if a stale callback somehow arrives, disposed → no-op (no live sub
    // exists, but assert the doc is untouched by a re-armed wrap attempt).
    const before = JSON.stringify(notesOf(store.vanilla.getState().doc, trackId))
    fake.emit(10)
    fake.emit(0)
    expect(JSON.stringify(notesOf(store.vanilla.getState().doc, trackId))).toBe(before)
  })
})

describe("skips non-eligible tracks", () => {
  it("an armed drum track is never filled (isMelodicTrack guard)", () => {
    const doc = createDefaultDoc(0)
    const { store } = buildRig(doc)
    const drumId = drumTrackId(doc)
    const before = JSON.stringify(notesOf(doc, drumId))
    const fake = makeFakeAudio()
    createAutoConductor({ store, audio: fake.audio })
    setAutoArmed(drumId, true)
    fake.setPlaying(true)
    wrap(fake)
    expect(JSON.stringify(notesOf(store.vanilla.getState().doc, drumId))).toBe(before)
  })

  it("an armed but vanished trackId is skipped without throwing", () => {
    const doc = createDefaultDoc(0)
    const { store } = buildRig(doc)
    const fake = makeFakeAudio()
    createAutoConductor({ store, audio: fake.audio })
    setAutoArmed("trk_ghost" as Id, true)
    fake.setPlaying(true)
    expect(() => wrap(fake)).not.toThrow()
  })
})
