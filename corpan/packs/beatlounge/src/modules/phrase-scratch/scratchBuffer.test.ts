import { describe, expect, it } from "vitest"
import {
  buildGappedBuffer,
  planGappedLayout,
  planToSeconds,
  splitWordsBySilence,
  type SampleWord,
} from "./scratchBuffer"
import { SILENCE_GAP } from "./scratchMath"

/** A tiny tone burst writer for building synthetic word signals. */
const tone = (data: Float32Array, from: number, to: number, amp = 0.8) => {
  for (let i = from; i < to; i++) data[i] = amp * Math.sin((i - from) * 0.5)
}

/** A minimal AudioContext stand-in for buffer allocation (no real audio). */
const fakeCtx = (): BaseAudioContext =>
  ({
    createBuffer(_channels: number, length: number, sampleRate: number) {
      const chan = new Float32Array(length)
      return {
        length,
        sampleRate,
        numberOfChannels: 1,
        duration: length / sampleRate,
        getChannelData: () => chan,
      } as unknown as AudioBuffer
    },
  }) as unknown as BaseAudioContext

const makeSourceBuffer = (data: Float32Array, sampleRate: number): AudioBuffer =>
  ({
    length: data.length,
    sampleRate,
    numberOfChannels: 1,
    duration: data.length / sampleRate,
    getChannelData: () => data,
  }) as unknown as AudioBuffer

describe("splitWordsBySilence", () => {
  const sr = 8000
  it("splits two tone bursts separated by silence into two words", () => {
    const data = new Float32Array(sr) // 1s
    tone(data, 0, 2000) // word 0: 0..0.25s
    // 0.25..0.55s silence (>= minGap)
    tone(data, 4400, 6400) // word 1: 0.55..0.8s
    const words = splitWordsBySilence(data, sr)
    expect(words.length).toBe(2)
    expect(words[0].start).toBeLessThan(words[1].start)
    expect(words[0].end).toBeLessThan(words[1].start)
  })
  it("a single burst yields one word", () => {
    const data = new Float32Array(sr)
    tone(data, 1000, 4000)
    const words = splitWordsBySilence(data, sr)
    expect(words.length).toBe(1)
  })
  it("pure silence falls back to the whole clip (never empty)", () => {
    const data = new Float32Array(sr)
    const words = splitWordsBySilence(data, sr)
    expect(words.length).toBe(1)
    expect(words[0]).toEqual({ start: 0, end: sr })
  })
  it("returns [] for an empty signal", () => {
    expect(splitWordsBySilence(new Float32Array(0), sr)).toEqual([])
  })
})

describe("planGappedLayout (silent gap between words)", () => {
  const sr = 8000
  const words: SampleWord[] = [
    { start: 0, end: 2000 },
    { start: 5000, end: 6000 },
  ]
  it("places each word back-to-back with a fixed silent gap after it", () => {
    const gapSamples = Math.floor(SILENCE_GAP * sr)
    const plan = planGappedLayout(words, sr, SILENCE_GAP)
    expect(plan.slots.length).toBe(2)
    // word 0: 2000 samples audible, then a gap.
    expect(plan.slots[0].outStart).toBe(0)
    expect(plan.slots[0].outEnd).toBe(2000)
    expect(plan.slots[0].slotEnd).toBe(2000 + gapSamples)
    // word 1 starts AFTER word0's gap → there is genuine silence between them.
    expect(plan.slots[1].outStart).toBe(2000 + gapSamples)
    expect(plan.slots[1].outEnd).toBe(2000 + gapSamples + 1000)
    // total includes the trailing gap after the last word too.
    expect(plan.totalSamples).toBe(2000 + gapSamples + 1000 + gapSamples)
  })
  it("the inter-word region is genuinely empty (gap >= SILENCE_GAP)", () => {
    const plan = planGappedLayout(words, sr, SILENCE_GAP)
    const gap = plan.slots[1].outStart - plan.slots[0].outEnd
    expect(gap / sr).toBeGreaterThanOrEqual(SILENCE_GAP - 1e-6)
  })
})

describe("planToSeconds", () => {
  it("projects sample offsets to audible second-spans", () => {
    const sr = 8000
    const plan = planGappedLayout([{ start: 0, end: 4000 }], sr, SILENCE_GAP)
    const { spans, totalSeconds } = planToSeconds(plan, sr)
    expect(spans[0].start).toBeCloseTo(0)
    expect(spans[0].end).toBeCloseTo(0.5)
    expect(totalSeconds).toBeCloseTo(0.5 + SILENCE_GAP)
  })
})

describe("buildGappedBuffer", () => {
  const sr = 8000
  it("rebuilds a gapped buffer whose gaps are SILENT by construction", () => {
    const data = new Float32Array(sr)
    tone(data, 0, 2000)
    tone(data, 4400, 6400)
    const src = makeSourceBuffer(data, sr)
    const { buffer, spans, totalSeconds } = buildGappedBuffer(fakeCtx(), src, ["one", "two"])
    expect(spans.length).toBe(2)
    expect(totalSeconds).toBeCloseTo(buffer.duration, 6)
    // Sample the inter-word gap on the OUTPUT buffer: must be pure silence.
    const out = buffer.getChannelData(0)
    const gapStart = Math.floor(spans[0].end * sr) + 5
    const gapEnd = Math.floor(spans[1].start * sr) - 5
    let maxAbs = 0
    for (let i = gapStart; i < gapEnd; i++) maxAbs = Math.max(maxAbs, Math.abs(out[i]))
    expect(maxAbs).toBe(0)
  })
  it("labels slots from the provided word texts in order", () => {
    const data = new Float32Array(sr)
    tone(data, 0, 2000)
    tone(data, 4400, 6400)
    const { words } = buildGappedBuffer(fakeCtx(), makeSourceBuffer(data, sr), ["hola", "mundo"])
    expect(words[0]).toBe("hola")
    expect(words[1]).toBe("mundo")
  })
})
