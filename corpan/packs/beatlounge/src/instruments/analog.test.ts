/**
 * beatlounge — synth-analog pure-logic tests: the param schema, presets, value
 * normalization (the engine reads these), and the module actions. No Tone /
 * audio context is touched (those need a real graph) — only the pure exports.
 */

import { describe, expect, it } from "vitest"
import type { ActionContext } from "../contracts/module"
import { createDefaultDoc, isInstrumentTrack } from "../model/document"
import { analogSynthPreset } from "../model/document"
import {
  ANALOG_PARAMS,
  ANALOG_PRESETS,
  ANALOG_PRESET_NAMES,
  ANALOG_WAVES,
  FILTER_TYPES,
  LFO_TARGETS,
  VOICE_MODES,
  analogSpec,
  defaultAnalogParams,
  enumParam,
  numParam,
  resolveAnalogPreset,
} from "./analogSynth"
import {
  applyPresetAction,
  makeAnalogAction,
  randomizePatchAction,
  setAnalogParam,
} from "../modules/instruments/actions"

const mulberry32 = (seed: number) => {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const ctx = (over: Partial<ActionContext> = {}): ActionContext => ({
  doc: createDefaultDoc(0),
  rng: mulberry32(1),
  ...over,
})

// ---------------------------------------------------------------- schema
describe("ANALOG_PARAMS schema", () => {
  it("has unique keys", () => {
    const keys = ANALOG_PARAMS.map((s) => s.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it("every number param defines a finite min < max range and a default in range", () => {
    for (const s of ANALOG_PARAMS) {
      if (s.type !== "number") continue
      expect(typeof s.min).toBe("number")
      expect(typeof s.max).toBe("number")
      expect(s.min!).toBeLessThan(s.max!)
      expect(typeof s.default).toBe("number")
      expect(s.default as number).toBeGreaterThanOrEqual(s.min!)
      expect(s.default as number).toBeLessThanOrEqual(s.max!)
    }
  })

  it("every enum param's default is one of its options", () => {
    for (const s of ANALOG_PARAMS) {
      if (s.type !== "enum") continue
      expect(s.options).toBeTruthy()
      expect(s.options).toContain(s.default)
    }
  })

  it("exposes the documented oscillator / filter / lfo / voice vocabularies", () => {
    expect(analogSpec("osc1Wave")?.options).toEqual(ANALOG_WAVES)
    expect(analogSpec("filterType")?.options).toEqual(FILTER_TYPES)
    expect(analogSpec("lfoTarget")?.options).toEqual(LFO_TARGETS)
    expect(analogSpec("voiceMode")?.options).toEqual(VOICE_MODES)
  })

  it("covers the headline subtractive controls", () => {
    const keys = new Set(ANALOG_PARAMS.map((s) => s.key))
    for (const k of [
      "osc1Wave",
      "osc2Wave",
      "oscMix",
      "subLevel",
      "noiseLevel",
      "cutoff",
      "resonance",
      "filterEnvAmount",
      "filterAttack",
      "ampAttack",
      "lfoRate",
      "lfoDepth",
      "drive",
      "glide",
    ]) {
      expect(keys.has(k)).toBe(true)
    }
  })
})

// ---------------------------------------------------------------- defaults
describe("defaultAnalogParams", () => {
  it("defines a value for every schema key", () => {
    const p = defaultAnalogParams()
    for (const s of ANALOG_PARAMS) expect(p[s.key]).toBe(s.default)
  })

  it("matches the model-layer analogSynthPreset() defaults for shared keys", () => {
    const fromModel = analogSynthPreset().params
    const fromEngine = defaultAnalogParams()
    for (const key of Object.keys(fromModel)) {
      expect(fromEngine[key]).toBe(fromModel[key])
    }
  })
})

// ---------------------------------------------------------------- presets
describe("ANALOG_PRESETS", () => {
  it("ships the documented palette", () => {
    expect(ANALOG_PRESET_NAMES).toEqual(
      expect.arrayContaining(["init", "fat bass", "warm pad", "acid lead", "pluck"])
    )
  })

  it("resolves each preset to a FULL, in-range param bag", () => {
    for (const name of ANALOG_PRESET_NAMES) {
      const p = resolveAnalogPreset(name)
      // every key present
      for (const s of ANALOG_PARAMS) expect(p[s.key]).toBeDefined()
      // every numeric value within its schema range
      for (const s of ANALOG_PARAMS) {
        if (s.type !== "number") continue
        const v = numParam(p, s.key)
        expect(v).toBeGreaterThanOrEqual(s.min!)
        expect(v).toBeLessThanOrEqual(s.max!)
      }
      // every enum value valid
      for (const s of ANALOG_PARAMS) {
        if (s.type !== "enum") continue
        expect(s.options).toContain(p[s.key])
      }
    }
  })

  it("preset overrides only touch known schema keys", () => {
    const known = new Set(ANALOG_PARAMS.map((s) => s.key))
    for (const name of ANALOG_PRESET_NAMES) {
      for (const key of Object.keys(ANALOG_PRESETS[name])) {
        expect(known.has(key)).toBe(true)
      }
    }
  })

  it("an unknown preset name falls back to defaults", () => {
    expect(resolveAnalogPreset("nope")).toEqual(defaultAnalogParams())
  })
})

// ---------------------------------------------------------------- normalization
describe("numParam / enumParam", () => {
  it("clamps out-of-range numbers to the schema range", () => {
    expect(numParam({ cutoff: 999999 }, "cutoff")).toBe(analogSpec("cutoff")!.max)
    expect(numParam({ cutoff: -50 }, "cutoff")).toBe(analogSpec("cutoff")!.min)
  })

  it("falls back to the default for missing / non-finite values", () => {
    expect(numParam({}, "resonance")).toBe(analogSpec("resonance")!.default)
    expect(numParam({ resonance: NaN }, "resonance")).toBe(analogSpec("resonance")!.default)
    expect(numParam({ resonance: "x" as unknown as number }, "resonance")).toBe(
      analogSpec("resonance")!.default
    )
  })

  it("validates enum values against the options, else default", () => {
    expect(enumParam({ osc1Wave: "pulse" }, "osc1Wave", ANALOG_WAVES)).toBe("pulse")
    expect(enumParam({ osc1Wave: "bogus" }, "osc1Wave", ANALOG_WAVES)).toBe("sawtooth")
    expect(enumParam({}, "filterType", FILTER_TYPES)).toBe("lowpass")
  })
})

// ---------------------------------------------------------------- actions
describe("synth-analog actions", () => {
  it("makeAnalog turns the bound track into an analogSynth with the preset", () => {
    const c = ctx()
    const trackId = c.doc.tracks[1].id // the Synth track
    const r = makeAnalogAction.run({ ...c, targetTrackId: trackId }, { preset: "fat bass" })
    expect(r.commands).toHaveLength(1)
    const cmd = r.commands[0]
    expect(cmd.t).toBe("setInstrument")
    if (cmd.t === "setInstrument") {
      expect(cmd.trackId).toBe(trackId)
      expect(cmd.config.kind).toBe("analogSynth")
      if (cmd.config.kind === "analogSynth") {
        expect(cmd.config.preset).toBe("fat bass")
        // full param bag
        for (const s of ANALOG_PARAMS) expect(cmd.config.params[s.key]).toBeDefined()
      }
    }
  })

  it("makeAnalog targets the first instrument track when none is bound", () => {
    const c = ctx()
    const r = makeAnalogAction.run(c, {})
    const cmd = r.commands[0]
    if (cmd.t === "setInstrument") {
      const first = c.doc.tracks.find((t) => isInstrumentTrack(t))!
      expect(cmd.trackId).toBe(first.id)
    }
  })

  it("makeAnalog falls back to init for an unknown preset", () => {
    const c = ctx()
    const r = makeAnalogAction.run(c, { preset: "wobble" })
    const cmd = r.commands[0]
    if (cmd.t === "setInstrument" && cmd.config.kind === "analogSynth") {
      expect(cmd.config.preset).toBe("init")
    }
  })

  it("applyPreset emits one setInstrument with the resolved preset", () => {
    const c = ctx()
    const trackId = c.doc.tracks[1].id
    const r = applyPresetAction.run({ ...c, targetTrackId: trackId }, { preset: "acid lead" })
    const cmd = r.commands[0]
    expect(cmd.t).toBe("setInstrument")
    if (cmd.t === "setInstrument" && cmd.config.kind === "analogSynth") {
      expect(cmd.config.preset).toBe("acid lead")
      expect(cmd.config.params).toEqual(resolveAnalogPreset("acid lead"))
    }
  })

  it("randomize is deterministic for a fixed seed and in-range", () => {
    const doc = createDefaultDoc(0)
    const trackId = doc.tracks[1].id
    const a = randomizePatchAction.run({ doc, rng: mulberry32(42), targetTrackId: trackId }, {})
    const b = randomizePatchAction.run({ doc, rng: mulberry32(42), targetTrackId: trackId }, {})
    expect(a.commands).toEqual(b.commands)
    const cmd = a.commands[0]
    if (cmd.t === "setInstrument" && cmd.config.kind === "analogSynth") {
      for (const s of ANALOG_PARAMS) {
        if (s.type !== "number") continue
        const v = numParam(cmd.config.params, s.key)
        expect(v).toBeGreaterThanOrEqual(s.min!)
        expect(v).toBeLessThanOrEqual(s.max!)
      }
    }
  })

  it("setAnalogParam read-modify-writes the full bag as one setInstrument", () => {
    const c = ctx()
    const trackId = c.doc.tracks[1].id
    const r = setAnalogParam(c, trackId, "cutoff", 800)
    const cmd = r.commands[0]
    expect(cmd.t).toBe("setInstrument")
    if (cmd.t === "setInstrument" && cmd.config.kind === "analogSynth") {
      expect(cmd.config.params.cutoff).toBe(800)
      // untouched keys keep their defaults
      expect(cmd.config.params.resonance).toBe(analogSpec("resonance")!.default)
    }
  })
})
