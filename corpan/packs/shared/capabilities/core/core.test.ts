// Core plumbing unit tests: settle-once, active clock (injected now),
// abandoned synthesis, mock host STT fabrication, segment session math.
import { describe, it, expect } from "vitest"
import {
  clamp01,
  createActiveClock,
  createSettleOnce,
  makeAbandonedResult,
} from "./index"
import type { ActivitySpec } from "./index"
import { createMockCapabilityHost, makeMockTranscription } from "./mock"
import {
  createSegmentSession,
  type SegmentSessionEngine,
} from "../segment-player/src/segmentSession"

const spec: ActivitySpec = {
  specId: "s1",
  activityType: "cap-test",
  itemRefs: [],
  targetLang: "es",
}

describe("core/result", () => {
  it("clamp01 clamps and guards non-finite", () => {
    expect(clamp01(-1)).toBe(0)
    expect(clamp01(0.5)).toBe(0.5)
    expect(clamp01(2)).toBe(1)
    expect(clamp01(NaN)).toBe(0)
  })

  it("settleOnce: first result wins, never rejects", async () => {
    const s = createSettleOnce()
    expect(s.settled()).toBe(false)
    s.settle(makeAbandonedResult(spec, 100))
    s.settle({ specId: "other", score: 1, perItem: [], durationMs: 5 })
    const r = await s.promise
    expect(r.specId).toBe("s1")
    expect(r.abandoned).toBe(true)
    expect(s.settled()).toBe(true)
  })

  it("activeClock excludes paused time (injected now)", () => {
    let t = 0
    const clock = createActiveClock(() => t)
    t = 100
    clock.pause()
    t = 500 // 400ms paused
    clock.resume()
    t = 600
    expect(clock.activeMs()).toBe(200)
    expect(clock.paused()).toBe(false)
  })

  it("activeClock startPaused accumulates nothing until resume", () => {
    let t = 0
    const clock = createActiveClock(() => t, true)
    t = 300
    expect(clock.activeMs()).toBe(0)
    clock.resume()
    t = 350
    expect(clock.activeMs()).toBe(50)
  })
})

describe("core/mock", () => {
  it("fabricates the full 18-field transcription from expected text", () => {
    const r = makeMockTranscription("sid", "hola mundo feliz", "es")
    expect(r.words.length).toBe(3)
    expect(r.overallScore).toBeCloseTo(0.86)
    expect(r.freeText).toBe("hola mundo feliz")
    expect(Object.keys(r).length).toBeGreaterThanOrEqual(18)
  })

  it("stt:false host has no stt member (degradation paths)", () => {
    const host = createMockCapabilityHost({ stt: false })
    expect(host.stt).toBeUndefined()
  })
})

describe("segment session (fake engine)", () => {
  const makeEngine = () => {
    const starts = [0, 160, 320]
    const state = {
      currentMs: 0,
      playing: false,
      seeks: [] as number[],
    }
    const engine: SegmentSessionEngine = {
      seekToSegment(i) {
        state.seeks.push(i)
        state.currentMs = starts[i]
      },
      play() {
        state.playing = true
      },
      pause() {
        state.playing = false
      },
      unlock() {},
      getCurrentTimeMs: () => state.currentMs,
      getSegmentAbsoluteStartMs: () => starts,
    }
    return { engine, state }
  }

  it("plays a range, fires per-segment completion in order, stops at end", () => {
    const { engine, state } = makeEngine()
    const completed: number[] = []
    let ended = 0
    const session = createSegmentSession(engine, () => 120, {
      onSegmentComplete: (i) => completed.push(i),
      onRangeEnd: () => {
        ended += 1
      },
    })
    session.playRange(0, 2, { countReplay: false })
    expect(state.playing).toBe(true)
    state.currentMs = 130 // past seg0 end (0+120)
    session.tick()
    expect(completed).toEqual([0])
    state.currentMs = 300 // past seg1 end (160+120)
    session.tick()
    expect(completed).toEqual([0, 1])
    state.currentMs = 460 // past seg2 end (320+120) → range end
    session.tick()
    expect(completed).toEqual([0, 1, 2])
    expect(ended).toBe(1)
    expect(state.playing).toBe(false)
    expect(session.isActive()).toBe(false)
  })

  it("snapBackOnEnd returns to the range start (tap-to-replay preview)", () => {
    const { engine, state } = makeEngine()
    const session = createSegmentSession(engine, () => 120)
    session.playRange(1, 1, { snapBackOnEnd: true, countReplay: false })
    state.currentMs = 290
    session.tick()
    expect(state.seeks[state.seeks.length - 1]).toBe(1)
    expect(state.playing).toBe(false)
  })

  it("counts replays of the same range; armRange skips already-passed boundaries", () => {
    const { engine, state } = makeEngine()
    const completed: number[] = []
    const session = createSegmentSession(engine, () => 120, {
      onSegmentComplete: (i) => completed.push(i),
    })
    session.playRange(0, 0, { countReplay: false })
    expect(session.getReplays()).toBe(0)
    session.playRange(0, 0) // same range again → replay
    expect(session.getReplays()).toBe(1)
    // Arm mid-range: boundaries before the playhead don't re-fire (seg0's
    // end is already behind the 200ms playhead; seg1 hasn't ended yet).
    completed.length = 0
    state.currentMs = 200
    session.armRange(0, 2)
    session.tick()
    expect(completed).toEqual([])
    state.currentMs = 290 // past seg1's end (280)
    session.tick()
    expect(completed).toEqual([1])
  })

  it("cancel aborts without firing onRangeEnd", () => {
    const { engine, state } = makeEngine()
    let ended = 0
    const session = createSegmentSession(engine, () => 120, {
      onRangeEnd: () => {
        ended += 1
      },
    })
    session.playRange(0, 2, { countReplay: false })
    session.cancel(true)
    expect(ended).toBe(0)
    expect(session.isActive()).toBe(false)
    expect(state.playing).toBe(false)
  })
})
