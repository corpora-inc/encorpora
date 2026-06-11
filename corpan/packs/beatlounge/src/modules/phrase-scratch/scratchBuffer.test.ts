import { describe, expect, it } from "vitest"
import { splitWordsBySilence } from "./scratchBuffer"

/** A tiny tone burst writer for building synthetic word signals. */
const tone = (data: Float32Array, from: number, to: number, amp = 0.8) => {
  for (let i = from; i < to; i++) data[i] = amp * Math.sin((i - from) * 0.5)
}

describe("splitWordsBySilence (word detection for groove labels)", () => {
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
