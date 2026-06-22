import { describe, expect, it, beforeAll } from "vitest"
import {
  DEFAULT_PRESET_ID,
  familyOfPreset,
  getPreset,
  instantiatePreset,
  INSTRUMENT_PRESETS,
  listPresets,
  presetsByFamily,
  PRESET_FAMILIES,
  type PresetFamily,
} from "./presets"
import { createInstrument } from "./createInstrument"
import { WAVETABLES } from "./wavetables"
import { ANALOG_PARAMS } from "./analogSynth"

// happy-dom has no WebAudio; probe whether a real Tone graph can stand up so the
// live-build assertions run only where they can (mirrors drumKit.test.ts).
let audioReady = false
beforeAll(async () => {
  try {
    const Ctor =
      (globalThis as { AudioContext?: typeof AudioContext }).AudioContext ??
      (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    const Tone = await import("tone")
    Tone.setContext(new Ctor())
    const g = new Tone.Gain(1)
    g.dispose()
    audioReady = true
  } catch {
    audioReady = false
  }
})

/** Engine kinds the corpus is allowed to target — all SYNTHESIS engines, never
 *  soundfont (no asset shipped) and never ttsFragment (fragment team). */
const SYNTH_KINDS = new Set(["synth", "fmSynth", "wavetable", "analogSynth"])

describe("INSTRUMENT_PRESETS corpus", () => {
  it("ships a broad, world-class palette (120+ presets)", () => {
    expect(INSTRUMENT_PRESETS.length).toBeGreaterThanOrEqual(120)
    expect(INSTRUMENT_PRESETS.length).toBeLessThanOrEqual(200)
  })

  it("every family is well-stocked (≥4 members) for a deep palette", () => {
    const groups = presetsByFamily()
    for (const g of groups) {
      expect(g.presets.length, g.family).toBeGreaterThanOrEqual(4)
    }
  })

  it("has unique ids", () => {
    const ids = INSTRUMENT_PRESETS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("every preset has complete display metadata", () => {
    for (const p of INSTRUMENT_PRESETS) {
      expect(p.id.length, p.id).toBeGreaterThan(0)
      expect(p.name.length, p.id).toBeGreaterThan(0)
      expect(p.description.length, p.id).toBeGreaterThan(0)
      expect(PRESET_FAMILIES, p.id).toContain(p.family)
    }
  })

  it("every preset config targets a synthesis engine (never soundfont/tts/sampler)", () => {
    for (const p of INSTRUMENT_PRESETS) {
      expect(SYNTH_KINDS.has(p.config.kind), `${p.id} → ${p.config.kind}`).toBe(true)
    }
  })

  it("covers every documented family with at least two members", () => {
    const groups = presetsByFamily()
    const families = groups.map((g) => g.family)
    const expected: PresetFamily[] = ["keys", "bass", "lead", "pad", "pluck", "brass", "fx"]
    for (const fam of expected) {
      expect(families, fam).toContain(fam)
      const g = groups.find((x) => x.family === fam)!
      expect(g.presets.length, fam).toBeGreaterThanOrEqual(2)
    }
  })

  it("presetsByFamily lists every preset exactly once, in corpus order", () => {
    const flat = presetsByFamily().flatMap((g) => g.presets)
    expect(flat.length).toBe(INSTRUMENT_PRESETS.length)
    expect(new Set(flat.map((p) => p.id)).size).toBe(INSTRUMENT_PRESETS.length)
  })

  it("the configs are genuinely distinct (no two presets identical)", () => {
    const seen = new Set<string>()
    for (const p of INSTRUMENT_PRESETS) {
      const key = JSON.stringify(p.config)
      expect(seen.has(key), `${p.id} duplicates another config`).toBe(false)
      seen.add(key)
    }
  })

  it("uses a variety of engines across families (not all one kind)", () => {
    const kinds = new Set(INSTRUMENT_PRESETS.map((p) => p.config.kind))
    // We expect at least synth, fmSynth, wavetable and analogSynth to appear.
    expect(kinds.has("synth")).toBe(true)
    expect(kinds.has("fmSynth")).toBe(true)
    expect(kinds.has("wavetable")).toBe(true)
    expect(kinds.has("analogSynth")).toBe(true)
  })

  it("wavetable presets reference a real built-in table", () => {
    for (const p of INSTRUMENT_PRESETS) {
      if (p.config.kind !== "wavetable") continue
      expect(WAVETABLES[p.config.tableId], p.id).toBeDefined()
    }
  })

  it("analogSynth presets carry a FULL, self-describing param bag", () => {
    const required = ANALOG_PARAMS.map((s) => s.key)
    for (const p of INSTRUMENT_PRESETS) {
      if (p.config.kind !== "analogSynth") continue
      for (const key of required) {
        expect(p.config.params[key], `${p.id}.${key}`).toBeDefined()
      }
    }
  })

  it("pad-family sine/triangle synths have a slow attack so they route to the pad engine", () => {
    for (const p of INSTRUMENT_PRESETS) {
      if (p.family !== "pad") continue
      if (p.config.kind === "synth" && (p.config.osc === "sine" || p.config.osc === "triangle")) {
        expect(p.config.env.attack, p.id).toBeGreaterThanOrEqual(0.4)
        expect(p.config.env.release, p.id).toBeGreaterThan(1)
      }
    }
  })

  it("every preset config is CONSTRUCTIBLE by the instrument factory", () => {
    if (!audioReady) return // no WebAudio in this env — structural checks above cover shape
    for (const p of INSTRUMENT_PRESETS) {
      const inst = createInstrument(p.config)
      expect(inst, p.id).toBeTruthy()
      expect(typeof inst.trigger, p.id).toBe("function")
      inst.dispose()
    }
  })

  it("every synthesis preset exposes the LIVE multitouch play path", () => {
    if (!audioReady) return // needs a real Tone graph to build the live voices
    for (const p of INSTRUMENT_PRESETS) {
      const inst = createInstrument(p.config)
      expect(inst.live, `${p.id} must support continuous live play`).toBeTruthy()
      // A finger opens, glides, and releases without throwing.
      const id = inst.live!.startVoice(60.5, 0.8, 0)
      inst.live!.bendVoice(id, 62.25, 0.01)
      inst.live!.endVoice(id, 0.02)
      inst.dispose()
    }
  })
})

describe("preset lookups", () => {
  it("getPreset / familyOfPreset resolve known ids and reject unknowns", () => {
    const first = INSTRUMENT_PRESETS[0]
    expect(getPreset(first.id)).toBe(first)
    expect(familyOfPreset(first.id)).toBe(first.family)
    expect(getPreset("nope")).toBeUndefined()
    expect(familyOfPreset("nope")).toBeUndefined()
  })

  it("listPresets returns the corpus", () => {
    expect(listPresets()).toBe(INSTRUMENT_PRESETS)
  })

  it("DEFAULT_PRESET_ID points at a real preset", () => {
    expect(getPreset(DEFAULT_PRESET_ID)).toBeDefined()
  })
})

describe("instantiatePreset", () => {
  it("deep-copies so the frozen preset is never aliased", () => {
    const a = instantiatePreset(DEFAULT_PRESET_ID)!
    const b = instantiatePreset(DEFAULT_PRESET_ID)!
    expect(a).not.toBe(b)
    expect(a).toEqual(b)
  })

  it("returns undefined for unknown ids", () => {
    expect(instantiatePreset("nope")).toBeUndefined()
  })

  it("mutating an instantiated config never touches the frozen source", () => {
    const cfg = instantiatePreset("grand-piano")!
    if (cfg.kind === "analogSynth") {
      cfg.params.cutoff = 1
      const fresh = getPreset("grand-piano")!.config
      if (fresh.kind === "analogSynth") expect(fresh.params.cutoff).not.toBe(1)
    }
  })
})
