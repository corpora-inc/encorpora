/**
 * beatlounge — drum-kit corpus tests (pure logic; no Tone / audio context).
 *
 * Asserts the corpus is well-formed, every kit defines (after resolve) the full
 * voice set, the default kit is preserved 1:1, the pitch→role router matches the
 * original drumKit routing, and the schema invariants hold. The parametric
 * Tone build is smoke-tested separately under a guard (drumKit.test.ts).
 */

import { describe, expect, it } from "vitest"
import {
  KITS,
  getKit,
  listKits,
  kitsByFamily,
  kitsGroupedByFamily,
  resolveKit,
  resolveKitId,
  FAMILY_META,
  FAMILY_ORDER,
  DEFAULT_KIT,
  DEFAULT_KIT_ID,
  DEFAULT_VOICES,
  VOICE_ROLES,
  PITCH_TO_ROLE,
  ROLE_TO_PITCH,
  roleForPitch,
  type KitDef,
  type VoiceParams,
  type VoiceRole,
} from "./index"
import { DRUM_PITCH } from "../model/document"

// ---------------------------------------------------------------- corpus shape
describe("KITS corpus", () => {
  it("ships a solid repertoire (12–20 kits)", () => {
    expect(KITS.length).toBeGreaterThanOrEqual(12)
    expect(KITS.length).toBeLessThanOrEqual(20)
  })

  it("has unique kit ids", () => {
    const ids = KITS.map((k) => k.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("leads with the default 'studio' kit", () => {
    expect(KITS[0].id).toBe(DEFAULT_KIT_ID)
    expect(DEFAULT_KIT_ID).toBe("studio")
  })

  it("every kit has a name, family, and a non-empty description", () => {
    for (const k of KITS) {
      expect(k.name.trim().length).toBeGreaterThan(0)
      expect(FAMILY_ORDER).toContain(k.family)
      expect(k.description.trim().length).toBeGreaterThan(10)
    }
  })

  it("spans all three families with several kits each", () => {
    for (const fam of FAMILY_ORDER) {
      expect(kitsByFamily(fam).length).toBeGreaterThanOrEqual(2)
    }
    // electronic should be the deepest family
    expect(kitsByFamily("electronic").length).toBeGreaterThanOrEqual(8)
  })

  it("exposes a meta blurb for every family", () => {
    for (const fam of FAMILY_ORDER) {
      expect(FAMILY_META[fam].label.length).toBeGreaterThan(0)
      expect(FAMILY_META[fam].blurb.length).toBeGreaterThan(0)
    }
  })
})

// ---------------------------------------------------------------- lookups
describe("kit lookups", () => {
  it("getKit returns by id and undefined for unknown", () => {
    expect(getKit("tr-808")?.name).toBe("808")
    expect(getKit("nope")).toBeUndefined()
  })

  it("listKits returns the whole corpus in order", () => {
    expect(listKits()).toBe(KITS)
  })

  it("kitsGroupedByFamily covers every kit exactly once, in family order", () => {
    const groups = kitsGroupedByFamily()
    expect(groups.map((g) => g.family)).toEqual([...FAMILY_ORDER])
    const flat = groups.flatMap((g) => g.kits)
    expect(flat.length).toBe(KITS.length)
    expect(new Set(flat.map((k) => k.id)).size).toBe(KITS.length)
  })
})

// ---------------------------------------------------------------- schema
const assertVoiceWellFormed = (v: VoiceParams) => {
  expect(["membrane", "noise", "tonal"]).toContain(v.source)
  // envelope present + finite, non-negative
  for (const f of [v.env.attack, v.env.decay, v.env.release ?? 0]) {
    expect(Number.isFinite(f)).toBe(true)
    expect(f).toBeGreaterThanOrEqual(0)
  }
  expect(v.env.sustain ?? 0).toBeGreaterThanOrEqual(0)
  expect(v.env.sustain ?? 0).toBeLessThanOrEqual(1)
  if (v.filter) {
    expect(["lowpass", "highpass", "bandpass"]).toContain(v.filter.type)
    expect(v.filter.frequency).toBeGreaterThan(0)
  }
  if (v.filter2) expect(v.filter2.frequency).toBeGreaterThan(0)
  if (v.source === "noise") expect(["white", "pink", "brown"]).toContain(v.noise ?? "white")
  if (v.durationSec != null) expect(v.durationSec).toBeGreaterThan(0)
  if (v.partials) {
    for (const p of v.partials) {
      expect(p.frequency).toBeGreaterThan(0)
      expect(["sine", "triangle", "sawtooth", "square"]).toContain(p.type)
    }
  }
}

describe("kit voice schema", () => {
  it("every authored voice in every kit is well-formed", () => {
    for (const k of KITS) {
      for (const role of Object.keys(k.voices) as VoiceRole[]) {
        const v = k.voices[role]
        expect(v).toBeDefined()
        assertVoiceWellFormed(v!)
        // authored roles must be real voice roles
        expect(VOICE_ROLES).toContain(role)
      }
    }
  })

  it("VOICE_ROLES has 16 unique roles", () => {
    expect(VOICE_ROLES.length).toBe(16)
    expect(new Set(VOICE_ROLES).size).toBe(16)
  })
})

// ---------------------------------------------------------------- resolve
describe("resolveKit", () => {
  it("fills EVERY voice role so no pad is ever silent", () => {
    for (const k of KITS) {
      const r = resolveKit(k)
      for (const role of VOICE_ROLES) {
        expect(r.voices[role]).toBeDefined()
        assertVoiceWellFormed(r.voices[role])
      }
    }
  })

  it("a partial kit inherits unspecified voices from the default kit", () => {
    const partial: KitDef = {
      id: "x",
      name: "X",
      family: "electronic",
      description: "a one-voice variation kit for the test",
      voices: { kick: DEFAULT_VOICES.kick },
    }
    const r = resolveKit(partial)
    // unspecified roles === default voices
    expect(r.voices.snare).toBe(DEFAULT_VOICES.snare)
    expect(r.voices.cowbell).toBe(DEFAULT_VOICES.cowbell)
    // specified role preserved
    expect(r.voices.kick).toBe(DEFAULT_VOICES.kick)
  })

  it("specialised kits actually OVERRIDE the default voice (distinct sound)", () => {
    const k808 = resolveKit(getKit("tr-808")!)
    expect(k808.voices.kick).not.toBe(DEFAULT_VOICES.kick)
    // 808 kick drops further / decays longer than the default
    expect(k808.voices.kick.env.decay).toBeGreaterThan(DEFAULT_VOICES.kick.env.decay)
  })
})

describe("resolveKitId", () => {
  it("undefined / missing id resolves to the default kit", () => {
    expect(resolveKitId(undefined).id).toBe(DEFAULT_KIT_ID)
  })

  it("a known id resolves to that kit (fully voiced)", () => {
    const r = resolveKitId("tr-909")
    expect(r.id).toBe("tr-909")
    for (const role of VOICE_ROLES) expect(r.voices[role]).toBeDefined()
  })

  it("an unknown id falls back to the default (noisy-not-silent)", () => {
    const r = resolveKitId("does-not-exist")
    expect(r.id).toBe(DEFAULT_KIT_ID)
  })
})

// ---------------------------------------------------------------- default kit
describe("default kit preservation", () => {
  it("DEFAULT_KIT covers every voice role explicitly (the byte-for-ear baseline)", () => {
    for (const role of VOICE_ROLES) {
      expect(DEFAULT_KIT.voices[role]).toBeDefined()
    }
  })

  it("the default kick matches the ORIGINAL hardcoded kick params", () => {
    const k = DEFAULT_VOICES.kick
    expect(k.source).toBe("membrane")
    expect(k.pitchDecay).toBe(0.04)
    expect(k.octaves).toBe(6)
    expect(k.osc).toBe("sine")
    expect(k.env).toMatchObject({ attack: 0.001, decay: 0.32, sustain: 0, release: 0.4 })
  })

  it("the default snare keeps the original noise+body recipe", () => {
    const s = DEFAULT_VOICES.snare
    expect(s.source).toBe("noise")
    expect(s.noise).toBe("white")
    expect(s.env).toMatchObject({ attack: 0.001, decay: 0.18, sustain: 0 })
    expect(s.body?.type).toBe("triangle")
    expect(s.body?.level).toBe(-6)
  })

  it("the default cowbell keeps the dual-square 540/800 partials through a BPF", () => {
    const c = DEFAULT_VOICES.cowbell
    expect(c.source).toBe("tonal")
    expect(c.partials?.map((p) => p.frequency)).toEqual([540, 800])
    expect(c.filter).toMatchObject({ type: "bandpass", frequency: 2640, q: 1.2 })
  })

  it("the default hats keep the original HPF 4000 → BPF 8500 Q1.2 stack", () => {
    for (const role of ["closedHat", "openHat", "pedalHat"] as const) {
      const h = DEFAULT_VOICES[role]
      expect(h.filter2).toMatchObject({ type: "highpass", frequency: 4000 })
      expect(h.filter).toMatchObject({ type: "bandpass", frequency: 8500, q: 1.2 })
    }
  })
})

// ---------------------------------------------------------------- pitch router
describe("pitch → role routing (matches original drumKit.ts)", () => {
  it("maps the canonical drum pitches to the expected roles", () => {
    expect(roleForPitch(DRUM_PITCH.kick)).toBe("kick") // 36
    expect(roleForPitch(DRUM_PITCH.snare)).toBe("snare") // 38
    expect(roleForPitch(DRUM_PITCH.clap)).toBe("clap") // 39
    expect(roleForPitch(DRUM_PITCH.hat)).toBe("closedHat") // 42
    expect(roleForPitch(37)).toBe("rim")
    expect(roleForPitch(44)).toBe("pedalHat")
    expect(roleForPitch(46)).toBe("openHat")
    expect(roleForPitch(43)).toBe("loTom")
    expect(roleForPitch(45)).toBe("hiTom")
    expect(roleForPitch(64)).toBe("conga")
    expect(roleForPitch(49)).toBe("crash")
    expect(roleForPitch(51)).toBe("ride")
    expect(roleForPitch(56)).toBe("cowbell")
    expect(roleForPitch(54)).toBe("tamb")
    expect(roleForPitch(70)).toBe("shaker")
    expect(roleForPitch(75)).toBe("click")
  })

  it("an unknown pad has no mapped role (synth falls back to a tom)", () => {
    expect(roleForPitch(99)).toBeUndefined()
  })

  it("PITCH_TO_ROLE covers every voice role at least once", () => {
    const covered = new Set(Object.values(PITCH_TO_ROLE))
    for (const role of VOICE_ROLES) expect(covered.has(role)).toBe(true)
  })

  it("ROLE_TO_PITCH is the inverse for the canonical pitch of each role", () => {
    for (const role of VOICE_ROLES) {
      const pitch = ROLE_TO_PITCH[role]
      expect(roleForPitch(pitch)).toBe(role)
    }
  })
})
