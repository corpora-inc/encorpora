/**
 * beatlounge — voice-type mapping tests (pure). The Instruments page derives the
 * active voice type from instrument.kind and voices the bound track to a type's
 * default config; both directions are tested here without a DOM.
 */

import { describe, expect, it } from "vitest"
import type { InstrumentConfig } from "../model/document"
import { synthPreset } from "../model/document"
import { ANALOG_PARAMS, resolveAnalogPreset } from "./analogSynth"
import { GM_SOUNDFONT_ID } from "./gmSoundbank"
import {
  OSC_WAVES,
  VOICE_TYPES,
  configForVoiceType,
  voiceTypeForKind,
  voiceTypeOf,
} from "./voiceTypes"

describe("voiceTypeForKind / voiceTypeOf", () => {
  it("maps analogSynth → analog", () => {
    expect(voiceTypeForKind("analogSynth")).toBe("analog")
  })
  it("maps the raw synth engine → osc", () => {
    expect(voiceTypeForKind("synth")).toBe("osc")
  })
  it("maps soundfont → preset", () => {
    expect(voiceTypeForKind("soundfont")).toBe("preset")
  })
  it("falls back to preset for other engines (fm / wavetable / sampler)", () => {
    expect(voiceTypeForKind("fmSynth")).toBe("preset")
    expect(voiceTypeForKind("wavetable")).toBe("preset")
    expect(voiceTypeForKind("sampler")).toBe("preset")
  })
  it("voiceTypeOf reads a config's kind", () => {
    const cfg: InstrumentConfig = synthPreset("sawtooth")
    expect(voiceTypeOf(cfg)).toBe("osc")
  })
})

describe("configForVoiceType — analog", () => {
  it("produces a full, in-range analogSynth init patch", () => {
    const cfg = configForVoiceType("analog")
    expect(cfg.kind).toBe("analogSynth")
    if (cfg.kind === "analogSynth") {
      expect(cfg.preset).toBe("init")
      // a full param bag (every schema key present)
      for (const s of ANALOG_PARAMS) expect(cfg.params[s.key]).toBeDefined()
      expect(cfg.params).toEqual(resolveAnalogPreset("init"))
    }
  })
})

describe("configForVoiceType — preset", () => {
  it("produces a GM Grand Piano soundfont voice (the browser then re-voices)", () => {
    const cfg = configForVoiceType("preset")
    expect(cfg.kind).toBe("soundfont")
    if (cfg.kind === "soundfont") {
      expect(cfg.soundfontId).toBe(GM_SOUNDFONT_ID)
      expect(cfg.program).toBe(0)
      expect(cfg.bank).toBe(0)
    }
  })
})

describe("configForVoiceType — osc", () => {
  it("produces a raw synth voice with the requested waveform", () => {
    for (const wave of OSC_WAVES) {
      const cfg = configForVoiceType("osc", wave)
      expect(cfg.kind).toBe("synth")
      if (cfg.kind === "synth") expect(cfg.osc).toBe(wave)
    }
  })
  it("defaults the osc waveform to triangle", () => {
    const cfg = configForVoiceType("osc")
    if (cfg.kind === "synth") expect(cfg.osc).toBe("triangle")
  })
})

describe("voice types round-trip", () => {
  it("each voice type's default config maps back to that voice type", () => {
    for (const vt of VOICE_TYPES) {
      expect(voiceTypeOf(configForVoiceType(vt))).toBe(vt)
    }
  })
})
