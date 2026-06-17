import { describe, expect, it } from "vitest"
import type { ActionContext } from "../../contracts/module"
import { createDefaultDoc } from "../../model/document"
import { setGmProgramAction } from "./actions"
import { GM_SOUNDFONT_ID } from "../../instruments/gmSoundbank"
import { instrumentSummary } from "./instrumentSummary"

const ctx = (over: Partial<ActionContext> = {}): ActionContext => ({
  doc: createDefaultDoc(0),
  rng: () => 0.5,
  ...over,
})

describe("instruments setGmInstrument", () => {
  it("makes the bound track a soundfont voice at the requested program", () => {
    const c = ctx()
    const trackId = c.doc.tracks[1].id // the Synth track
    const r = setGmProgramAction.run({ ...c, targetTrackId: trackId }, { program: 48 })
    expect(r.commands).toHaveLength(1)
    const cmd = r.commands[0]
    expect(cmd.t).toBe("setInstrument")
    if (cmd.t === "setInstrument") {
      expect(cmd.trackId).toBe(trackId)
      expect(cmd.config.kind).toBe("soundfont")
      if (cmd.config.kind === "soundfont") {
        expect(cmd.config.program).toBe(48)
        expect(cmd.config.bank).toBe(0)
        expect(cmd.config.soundfontId).toBe(GM_SOUNDFONT_ID)
      }
    }
    expect(r.summary).toBe("String Ensemble 1")
  })

  it("targets the explicit track param over the bound track", () => {
    const c = ctx()
    const trackId = c.doc.tracks[0].id
    const r = setGmProgramAction.run(c, { track: trackId, program: 0 })
    const cmd = r.commands[0]
    if (cmd.t === "setInstrument") expect(cmd.trackId).toBe(trackId)
  })

  it("wraps out-of-range programs into 0..127", () => {
    const c = ctx()
    const trackId = c.doc.tracks[1].id
    const r = setGmProgramAction.run({ ...c, targetTrackId: trackId }, { program: 200 })
    const cmd = r.commands[0]
    if (cmd.t === "setInstrument" && cmd.config.kind === "soundfont") {
      expect(cmd.config.program).toBe(200 % 128)
    }
  })

  it("emits nothing when there is no track to voice", () => {
    const c = ctx()
    const r = setGmProgramAction.run(c, { program: 4 })
    // No targetTrackId and no track param → no-op (safe).
    expect(r.commands).toHaveLength(0)
  })
})

describe("instrumentSummary", () => {
  it("labels a soundfont voice by its GM name", () => {
    expect(
      instrumentSummary({ kind: "soundfont", soundfontId: "x", program: 0, bank: 0 })
    ).toBe("Acoustic Grand Piano")
    expect(
      instrumentSummary({ kind: "soundfont", soundfontId: "x", program: 73, bank: 0 })
    ).toBe("Flute")
  })

  it("labels a drum-bank soundfont as a kit", () => {
    expect(
      instrumentSummary({ kind: "soundfont", soundfontId: "x", program: 0, bank: 128 })
    ).toBe("Standard Kit")
  })

  it("labels synthesis engines by kind", () => {
    expect(
      instrumentSummary({
        kind: "synth",
        osc: "sawtooth",
        filter: { type: "lowpass", frequency: 3000, q: 1 },
        env: { attack: 0.01, decay: 0.1, sustain: 0.2, release: 0.2 },
      })
    ).toBe("Synth (sawtooth)")
  })
})
