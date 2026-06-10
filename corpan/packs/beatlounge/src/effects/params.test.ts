import { describe, expect, it } from "vitest"
import type { EffectKind } from "../model/document"
import {
  EFFECT_KINDS,
  EFFECT_SPECS,
  defaultEffectParams,
  numParam,
  strParam,
} from "./params"

const ALL: EffectKind[] = [
  "filter",
  "eq3",
  "compressor",
  "distortion",
  "chorus",
  "phaser",
  "bitcrusher",
  "delay",
  "reverb",
  "limiter",
  "gain",
]

describe("effect param specs", () => {
  it("declares a spec for every EffectKind", () => {
    for (const kind of ALL) {
      expect(EFFECT_SPECS[kind]).toBeTruthy()
      expect(EFFECT_SPECS[kind].kind).toBe(kind)
      expect(EFFECT_SPECS[kind].params.length).toBeGreaterThan(0)
    }
  })

  it("EFFECT_KINDS lists every kind exactly once", () => {
    expect([...EFFECT_KINDS].sort()).toEqual([...ALL].sort())
    expect(new Set(EFFECT_KINDS).size).toBe(EFFECT_KINDS.length)
  })

  it("every number param has a finite default within [min,max]", () => {
    for (const kind of ALL) {
      for (const p of EFFECT_SPECS[kind].params) {
        if (p.type !== "number") continue
        const d = p.default as number
        expect(Number.isFinite(d)).toBe(true)
        if (p.min != null) expect(d).toBeGreaterThanOrEqual(p.min)
        if (p.max != null) expect(d).toBeLessThanOrEqual(p.max)
      }
    }
  })

  it("every enum param's default is one of its options", () => {
    for (const kind of ALL) {
      for (const p of EFFECT_SPECS[kind].params) {
        if (p.type !== "enum") continue
        expect(p.options).toBeTruthy()
        expect(p.options).toContain(p.default as string)
      }
    }
  })

  it("delay time is capped at the maxDelay=3 headroom", () => {
    const time = EFFECT_SPECS.delay.params.find((p) => p.key === "delayTime")!
    expect(time.max).toBe(3)
  })

  it("wet effects expose a Mix (wet) param", () => {
    for (const kind of ["distortion", "chorus", "phaser", "bitcrusher", "delay", "reverb"] as const) {
      expect(EFFECT_SPECS[kind].params.some((p) => p.key === "wet")).toBe(true)
    }
  })
})

describe("defaultEffectParams", () => {
  it("returns a complete bag keyed by every spec param", () => {
    for (const kind of ALL) {
      const bag = defaultEffectParams(kind)
      for (const p of EFFECT_SPECS[kind].params) {
        expect(bag[p.key]).toEqual(p.default)
      }
    }
  })

  it("is a fresh object each call (no shared mutation)", () => {
    const a = defaultEffectParams("delay")
    const b = defaultEffectParams("delay")
    expect(a).not.toBe(b)
    a.feedback = 0.99
    expect(b.feedback).not.toBe(0.99)
  })
})

describe("param readers", () => {
  const freqSpec = EFFECT_SPECS.filter.params.find((p) => p.key === "frequency")!
  const typeSpec = EFFECT_SPECS.filter.params.find((p) => p.key === "type")!

  it("numParam reads numbers and coerces numeric strings", () => {
    expect(numParam({ frequency: 800 }, freqSpec)).toBe(800)
    expect(numParam({ frequency: "440" }, freqSpec)).toBe(440)
  })

  it("numParam falls back to the spec default on missing/garbage", () => {
    expect(numParam({}, freqSpec)).toBe(freqSpec.default)
    expect(numParam({ frequency: "nope" }, freqSpec)).toBe(freqSpec.default)
    expect(numParam({ frequency: true }, freqSpec)).toBe(freqSpec.default)
  })

  it("strParam reads strings and falls back to the default", () => {
    expect(strParam({ type: "highpass" }, typeSpec)).toBe("highpass")
    expect(strParam({}, typeSpec)).toBe(typeSpec.default)
    expect(strParam({ type: 5 }, typeSpec)).toBe(typeSpec.default)
  })
})
