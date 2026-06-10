import { describe, expect, it } from "vitest"
import {
  getPreset,
  instantiatePreset,
  instantiatePresetWithFreshSet,
  INSTRUMENT_PRESETS,
} from "./presets"
import { WAVETABLES } from "./wavetables"

const ENGINE_KINDS = new Set([
  "drumSampler",
  "sampler",
  "synth",
  "fmSynth",
  "wavetable",
  "soundfont",
])

describe("INSTRUMENT_PRESETS", () => {
  it("ships the documented palette", () => {
    const ids = INSTRUMENT_PRESETS.map((p) => p.id)
    expect(ids).toEqual(
      expect.arrayContaining([
        "tambura",
        "tabla",
        "sine-drone",
        "warm-pad",
        "sub-bass",
        "pluck",
        "bell",
      ])
    )
  })

  it("has unique ids", () => {
    const ids = INSTRUMENT_PRESETS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("every preset config targets a real engine kind (never ttsFragment)", () => {
    for (const p of INSTRUMENT_PRESETS) {
      expect(ENGINE_KINDS.has(p.config.kind), p.id).toBe(true)
      expect(p.config.kind).not.toBe("ttsFragment")
    }
  })

  it("every preset has display metadata", () => {
    for (const p of INSTRUMENT_PRESETS) {
      expect(p.label.length, p.id).toBeGreaterThan(0)
      expect(p.description.length, p.id).toBeGreaterThan(0)
      expect(p.category, p.id).toBeTruthy()
    }
  })

  it("drones/pads use long-attack synths so they route to the pad engine", () => {
    for (const id of ["sine-drone", "warm-pad", "tambura"]) {
      const cfg = getPreset(id)!.config
      if (cfg.kind === "synth") {
        expect(cfg.env.attack, id).toBeGreaterThan(0.3)
        expect(cfg.env.release, id).toBeGreaterThan(1)
      }
    }
  })

  it("the bell preset references an existing wavetable", () => {
    const bell = getPreset("bell")!.config
    expect(bell.kind).toBe("wavetable")
    if (bell.kind === "wavetable") {
      expect(WAVETABLES[bell.tableId]).toBeDefined()
    }
  })

  it("sampler presets have non-overlapping, full-coverage zones", () => {
    for (const p of INSTRUMENT_PRESETS) {
      if (p.config.kind !== "sampler") continue
      const zones = [...p.config.zones].sort((a, b) => a.rootNote - b.rootNote)
      expect(zones.length, p.id).toBeGreaterThan(0)
      // contiguous coverage: each zone's hi+1 == next zone's lo
      for (let i = 0; i < zones.length - 1; i++) {
        expect(zones[i].hiNote + 1, `${p.id} zone ${i}`).toBe(zones[i + 1].loNote)
        expect(zones[i].loNote).toBeLessThanOrEqual(zones[i].rootNote)
        expect(zones[i].hiNote).toBeGreaterThanOrEqual(zones[i].rootNote)
      }
      expect(zones[0].loNote).toBe(0)
      expect(zones[zones.length - 1].hiNote).toBe(127)
    }
  })
})

describe("instantiatePreset", () => {
  it("deep-copies so the frozen preset is never aliased", () => {
    const a = instantiatePreset("tabla")!
    const b = instantiatePreset("tabla")!
    expect(a).not.toBe(b)
    expect(a).toEqual(b)
    if (a.kind === "sampler") a.zones[0].rootNote = 99
    const fresh = getPreset("tabla")!.config
    if (fresh.kind === "sampler") {
      expect(fresh.zones[0].rootNote).not.toBe(99)
    }
  })

  it("returns undefined for unknown ids", () => {
    expect(instantiatePreset("nope")).toBeUndefined()
  })
})

describe("instantiatePresetWithFreshSet", () => {
  it("re-seeds the sampleSetId for sampler presets", () => {
    const a = instantiatePresetWithFreshSet("pluck")!
    const b = instantiatePresetWithFreshSet("pluck")!
    if (a.kind === "sampler" && b.kind === "sampler") {
      expect(a.sampleSetId).not.toBe(b.sampleSetId)
      expect(a.sampleSetId.startsWith("pluck-")).toBe(true)
    } else {
      throw new Error("expected sampler configs")
    }
  })

  it("leaves non-sampler presets unchanged in kind", () => {
    const cfg = instantiatePresetWithFreshSet("sub-bass")!
    expect(cfg.kind).toBe("fmSynth")
  })
})
