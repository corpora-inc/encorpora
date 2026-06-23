import { describe, expect, it } from "vitest"
import type { AsrCapability } from "./contract"
import { rankProviders, type RouterBudget } from "./router"

// Capability fixtures roughly matching the real engines' shapes.
const native = (langs: string[]): AsrCapability => ({
  providerId: "native", languages: langs, onDevice: true, modelSizeMB: 0,
  residentMemoryMB: 0, streaming: true, latencyClass: "instant",
  needsDownload: false, autoregressive: true,
})
const whisper = (langs: string[], needsDownload = true): AsrCapability => ({
  providerId: "whisper", languages: langs, onDevice: true, modelSizeMB: 1031,
  residentMemoryMB: 1400, streaming: false, latencyClass: "batch",
  needsDownload, autoregressive: true,
})
const qwen3 = (langs: string[], needsDownload = true): AsrCapability => ({
  providerId: "qwen3", languages: langs, onDevice: true, modelSizeMB: 805,
  residentMemoryMB: 650, streaming: true, latencyClass: "fast",
  needsDownload, autoregressive: true,
})
const parakeet = (langs: string[], needsDownload = true): AsrCapability => ({
  providerId: "sherpa", languages: langs, onDevice: true, modelSizeMB: 480,
  residentMemoryMB: 400, streaming: true, latencyClass: "instant",
  needsDownload, autoregressive: false,
})

const roomy: RouterBudget = { availableForAsrMB: 4000, androidCpuOnly: false }
const android: RouterBudget = { availableForAsrMB: 4000, androidCpuOnly: true }

describe("rankProviders", () => {
  it("prefers native whenever it covers the language", () => {
    const caps = [whisper(["en"], false), qwen3(["en"], false), native(["en"])]
    const order = rankProviders(caps, { lang: "en", goal: "dictation", budget: roomy })
    expect(order[0]).toBe("native")
  })

  it("falls to keyboard (empty) when no provider covers the language", () => {
    const caps = [native(["en"]), whisper(["en"])]
    const order = rankProviders(caps, {
      lang: "pa-Arab", goal: "dictation", budget: roomy,
    })
    expect(order).toEqual([])
  })

  it("excludes a downloadable runtime that doesn't fit the budget", () => {
    const tight: RouterBudget = { availableForAsrMB: 500, androidCpuOnly: false }
    // whisper(1400) and qwen3(650) both exceed 500 → only nothing fits here.
    const caps = [whisper(["hi"]), qwen3(["hi"])]
    const order = rankProviders(caps, { lang: "hi", goal: "dictation", budget: tight })
    expect(order).toEqual([])
    // Bump the budget so qwen3 (650) fits but whisper (1400) still doesn't.
    const mid: RouterBudget = { availableForAsrMB: 800, androidCpuOnly: false }
    const order2 = rankProviders(caps, { lang: "hi", goal: "dictation", budget: mid })
    expect(order2).toEqual(["qwen3"])
  })

  it("on Android CPU, ranks the non-autoregressive engine above AR for dictation", () => {
    // Polish: Parakeet (NAR) vs Whisper (AR), both downloadable, both fit.
    const caps = [whisper(["pl"]), parakeet(["pl"])]
    const order = rankProviders(caps, { lang: "pl", goal: "dictation", budget: android })
    expect(order[0]).toBe("sherpa") // Parakeet rides the sherpa provider id
  })

  it("for a challenge goal, accuracy (WER hint) outweighs latency", () => {
    // qwen3 is 'fast', whisper is 'batch'. For dictation qwen3 wins on latency;
    // for a challenge with whisper much more accurate, whisper should win.
    const caps = [qwen3(["te"], false), whisper(["te"], false)]
    const wer = { "qwen3:te": 0.30, "whisper:te": 0.12 }
    const dict = rankProviders(caps, { lang: "te", goal: "dictation", budget: roomy, wer })
    expect(dict[0]).toBe("qwen3") // latency wins for dictation
    const chal = rankProviders(caps, { lang: "te", goal: "challenge", budget: roomy, wer })
    expect(chal[0]).toBe("whisper") // accuracy wins for challenge
  })

  it("prefers an already-installed model over one needing download", () => {
    const caps = [qwen3(["es"], true), whisper(["es"], false)]
    // whisper installed, qwen3 not → whisper first despite worse latency.
    const order = rankProviders(caps, { lang: "es", goal: "dictation", budget: roomy })
    expect(order[0]).toBe("whisper")
  })
})
