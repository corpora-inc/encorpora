import { describe, expect, it } from "vitest"
import { evenWordSpans, resolveWordSpans, type WordTiming } from "./wordTiming"

const tone = (data: Float32Array, from: number, to: number, amp = 0.8) => {
  for (let i = from; i < to; i++) data[i] = amp * Math.sin((i - from) * 0.5)
}

describe("evenWordSpans", () => {
  it("splits the duration into equal, non-overlapping, monotonic slices", () => {
    const spans = evenWordSpans(4, 2)
    expect(spans.length).toBe(4)
    expect(spans[0]).toEqual({ start: 0, end: 0.5 })
    expect(spans[3]).toEqual({ start: 1.5, end: 2 })
    for (let i = 1; i < spans.length; i++) {
      expect(spans[i].start).toBe(spans[i - 1].end)
    }
  })
  it("guards zero / non-positive inputs", () => {
    expect(evenWordSpans(0, 2)).toEqual([])
    expect(evenWordSpans(3, 0)).toEqual([])
  })
})

describe("resolveWordSpans precedence", () => {
  const sr = 8000
  it("EXACT forced-alignment timings win verbatim (the Whisper seam)", () => {
    const provided: WordTiming[] = [
      { text: "hola", startSec: 0.1, endSec: 0.5 },
      { text: "mundo", startSec: 0.7, endSec: 1.2 },
    ]
    const { spans, labels } = resolveWordSpans(
      new Float32Array(sr), sr, 1.5, ["hola", "mundo"], provided
    )
    expect(spans).toEqual([
      { start: 0.1, end: 0.5 },
      { start: 0.7, end: 1.2 },
    ])
    expect(labels).toEqual(["hola", "mundo"])
  })
  it("uses the silence split when its word count matches the tokens", () => {
    const data = new Float32Array(sr)
    tone(data, 0, 2000)
    tone(data, 4400, 6400)
    const { spans, labels } = resolveWordSpans(data, sr, 1, ["one", "two"])
    expect(spans.length).toBe(2)
    expect(labels).toEqual(["one", "two"])
    // The detected first word starts before the second.
    expect(spans[0].start).toBeLessThan(spans[1].start)
  })
  it("falls back to EVEN distribution when the split count mismatches the tokens", () => {
    const data = new Float32Array(sr)
    tone(data, 0, 6000) // one blob → 1 detected word
    const { spans, labels } = resolveWordSpans(data, sr, 1, ["a", "b", "c"])
    expect(spans.length).toBe(3) // matched the 3 tokens, not the 1 blob
    expect(labels).toEqual(["a", "b", "c"])
  })
  it("no tokens → a single whole-clip span", () => {
    const { spans, labels } = resolveWordSpans(new Float32Array(sr), sr, 1, [])
    expect(spans).toEqual([{ start: 0, end: 1 }])
    expect(labels).toEqual([])
  })
})
