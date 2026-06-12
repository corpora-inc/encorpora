/**
 * beatlounge — tool catalog tests: every build() emits VALID commands, clamps
 * its own args, and the result actually applies through the real reducer (so a
 * tool can never produce an illegal mutation). Stochastic tools are seeded.
 */

import { describe, expect, it } from "vitest"
import {
  TOOL_BY_NAME,
  TOOL_SPECS,
  resolveDrumPitch,
  resolveSynthTrack,
  MOOD_NAMES,
  JAM_FEELS,
} from "./tools"
import { reduce } from "../model/reduce"
import { createDefaultDoc, DRUM_PITCH, isInstrumentTrack } from "../model/document"
import type { BeatloungeDoc, InstrumentTrack } from "../model/document"
import type { Command } from "../model/command"
import { toPc } from "../music/harmony"

const seededRng = (seed: number) => {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Apply a command list through the real reducer → the resulting doc. */
const apply = (doc: BeatloungeDoc, commands: Command[]): BeatloungeDoc =>
  commands.reduce((d, c) => reduce(d, c), doc)

const drumTrack = (doc: BeatloungeDoc): InstrumentTrack => {
  const t = doc.tracks.find((tr) => isInstrumentTrack(tr) && tr.instrument.kind === "drumSampler")
  if (!t || !isInstrumentTrack(t)) throw new Error("no drum track")
  return t
}

describe("resolveDrumPitch", () => {
  it("maps aliases to pad pitches", () => {
    expect(resolveDrumPitch("kick")).toBe(DRUM_PITCH.kick)
    expect(resolveDrumPitch("hihats")).toBe(DRUM_PITCH.hat)
    expect(resolveDrumPitch("SNARE")).toBe(DRUM_PITCH.snare)
    expect(resolveDrumPitch("clap")).toBe(DRUM_PITCH.clap)
  })
  it("defaults unknown names to the hat", () => {
    expect(resolveDrumPitch("triangle")).toBe(DRUM_PITCH.hat)
    expect(resolveDrumPitch(undefined)).toBe(DRUM_PITCH.hat)
  })
})

describe("setTempo", () => {
  it("sets + clamps bpm", () => {
    const doc = createDefaultDoc(0)
    const r = TOOL_BY_NAME.setTempo.build({ bpm: 5000 }, doc, seededRng(1))
    const next = apply(doc, r.commands)
    expect(next.bpm).toBe(220)
    expect(r.summary).toContain("220")
  })
})

describe("setSwing", () => {
  it("sets + clamps swing", () => {
    const doc = createDefaultDoc(0)
    const r = TOOL_BY_NAME.setSwing.build({ amount: 5 }, doc, seededRng(1))
    const next = apply(doc, r.commands)
    expect(next.swing.amount).toBeCloseTo(0.66)
  })
})

describe("density", () => {
  it("adds hits to the hat lane on 'more'", () => {
    const doc = createDefaultDoc(0)
    const before = drumTrack(doc).notes.filter((n) => n.pitch === DRUM_PITCH.hat).length
    const r = TOOL_BY_NAME.density.build({ dir: "more", drum: "hat", amount: 4 }, doc, seededRng(7))
    const next = apply(doc, r.commands)
    const after = drumTrack(next).notes.filter((n) => n.pitch === DRUM_PITCH.hat).length
    expect(after).toBeGreaterThan(before)
  })
  it("removes hits on 'less'", () => {
    const doc = createDefaultDoc(0)
    const before = drumTrack(doc).notes.filter((n) => n.pitch === DRUM_PITCH.hat).length
    const r = TOOL_BY_NAME.density.build({ dir: "less", drum: "hat", amount: 2 }, doc, seededRng(7))
    const next = apply(doc, r.commands)
    const after = drumTrack(next).notes.filter((n) => n.pitch === DRUM_PITCH.hat).length
    expect(after).toBe(before - 2)
  })
  it("adds to a different lane (kick) without touching hats", () => {
    const doc = createDefaultDoc(0)
    const hatsBefore = drumTrack(doc).notes.filter((n) => n.pitch === DRUM_PITCH.hat).length
    const r = TOOL_BY_NAME.density.build({ dir: "more", drum: "kick", amount: 2 }, doc, seededRng(3))
    const next = apply(doc, r.commands)
    expect(drumTrack(next).notes.filter((n) => n.pitch === DRUM_PITCH.hat).length).toBe(hatsBefore)
  })
  it("is reproducible given the same seed", () => {
    const doc = createDefaultDoc(0)
    const a = TOOL_BY_NAME.density.build({ dir: "more", drum: "snare", amount: 3 }, doc, seededRng(42))
    const b = TOOL_BY_NAME.density.build({ dir: "more", drum: "snare", amount: 3 }, doc, seededRng(42))
    expect(JSON.stringify(a.commands)).toBe(JSON.stringify(b.commands))
  })
})

describe("euclid", () => {
  it("replaces the lane with the right number of pulses", () => {
    const doc = createDefaultDoc(0)
    const r = TOOL_BY_NAME.euclid.build({ drum: "kick", pulses: 3, steps: 8 }, doc, seededRng(1))
    const next = apply(doc, r.commands)
    const kicks = drumTrack(next).notes.filter((n) => n.pitch === DRUM_PITCH.kick).length
    expect(kicks).toBe(3)
  })
  it("clamps pulses to steps", () => {
    const doc = createDefaultDoc(0)
    const r = TOOL_BY_NAME.euclid.build({ drum: "snare", pulses: 99, steps: 4 }, doc, seededRng(1))
    const next = apply(doc, r.commands)
    expect(drumTrack(next).notes.filter((n) => n.pitch === DRUM_PITCH.snare).length).toBeLessThanOrEqual(4)
  })
  it("leaves other lanes intact", () => {
    const doc = createDefaultDoc(0)
    const kicksBefore = drumTrack(doc).notes.filter((n) => n.pitch === DRUM_PITCH.kick).length
    const r = TOOL_BY_NAME.euclid.build({ drum: "hat", pulses: 5, steps: 16 }, doc, seededRng(1))
    const next = apply(doc, r.commands)
    expect(drumTrack(next).notes.filter((n) => n.pitch === DRUM_PITCH.kick).length).toBe(kicksBefore)
  })
})

describe("humanize", () => {
  it("applies micro + velocity edits to every note", () => {
    const doc = createDefaultDoc(0)
    const synth = doc.tracks.find((t) => isInstrumentTrack(t) && t.instrument.kind === "synth")!
    const r = TOOL_BY_NAME.humanize.build({ amount: 0.6, trackId: synth.id }, doc, seededRng(9))
    const next = apply(doc, r.commands)
    const after = next.tracks.find((t) => t.id === synth.id)!
    expect(isInstrumentTrack(after)).toBe(true)
    if (isInstrumentTrack(after)) {
      expect(after.notes.some((n) => n.micro !== undefined && n.micro !== 0)).toBe(true)
    }
  })
})

describe("setMood", () => {
  it("every mood produces a non-empty, valid batch", () => {
    for (const mood of MOOD_NAMES) {
      const doc = createDefaultDoc(0)
      const r = TOOL_BY_NAME.setMood.build({ mood }, doc, seededRng(1))
      expect(r.commands.length).toBeGreaterThan(0)
      const next = apply(doc, r.commands)
      expect(next.bpm).toBeGreaterThanOrEqual(40)
      expect(next.bpm).toBeLessThanOrEqual(220)
      expect(next.swing.amount).toBeGreaterThanOrEqual(0)
      expect(r.summary.toLowerCase()).toContain("mood")
    }
  })
  it("an unknown mood falls back to chill (never throws)", () => {
    const doc = createDefaultDoc(0)
    const r = TOOL_BY_NAME.setMood.build({ mood: "spicy" }, doc, seededRng(1))
    expect(r.commands.length).toBeGreaterThan(0)
  })
})

describe("vibe (autonomous agents)", () => {
  it("spawns a modulator bundle that applies through the reducer", () => {
    const doc = createDefaultDoc(0)
    const r = TOOL_BY_NAME.vibe.build({ name: "breathe" }, doc, seededRng(1))
    expect(r.commands.length).toBeGreaterThan(0)
    expect(r.commands.every((c) => c.t === "addModulator")).toBe(true)
    const next = apply(doc, r.commands)
    expect(next.modulators.length).toBe(r.commands.length)
  })
  it("calm clears modulators", () => {
    let doc = createDefaultDoc(0)
    doc = apply(doc, TOOL_BY_NAME.vibe.build({ name: "evolve" }, doc, seededRng(1)).commands)
    expect(doc.modulators.length).toBeGreaterThan(0)
    const r = TOOL_BY_NAME.vibe.build({ name: "calm" }, doc, seededRng(1))
    const next = apply(doc, r.commands)
    expect(next.modulators.length).toBe(0)
  })
  it("an unknown vibe falls back to evolve (never throws)", () => {
    const doc = createDefaultDoc(0)
    const r = TOOL_BY_NAME.vibe.build({ name: "spicy" }, doc, seededRng(1))
    expect(r.commands.length).toBeGreaterThan(0)
  })
})

describe("automate", () => {
  it("adds one modulator to the requested target", () => {
    const doc = createDefaultDoc(0)
    const r = TOOL_BY_NAME.automate.build({ target: "pan", shape: "drift", depth: 0.5 }, doc, seededRng(1))
    expect(r.commands).toHaveLength(1)
    const next = apply(doc, r.commands)
    expect(next.modulators).toHaveLength(1)
    expect(next.modulators[0].target.scope).toBe("track")
  })
  it("defaults to a master modulator", () => {
    const doc = createDefaultDoc(0)
    const r = TOOL_BY_NAME.automate.build({}, doc, seededRng(1))
    const next = apply(doc, r.commands)
    expect(next.modulators[0].target.scope).toBe("master")
  })
})

describe("chaos", () => {
  it("spawns random tweakers that apply", () => {
    const doc = createDefaultDoc(0)
    const r = TOOL_BY_NAME.chaos.build({ amount: 2 }, doc, seededRng(1))
    expect(r.commands.length).toBeGreaterThan(0)
    const next = apply(doc, r.commands)
    expect(next.modulators.length).toBe(r.commands.length)
  })
})

describe("calm tool", () => {
  it("clears modulators and is a clean no-op when already calm", () => {
    let doc = createDefaultDoc(0)
    doc = apply(doc, TOOL_BY_NAME.chaos.build({ amount: 1 }, doc, seededRng(1)).commands)
    const cleared = apply(doc, TOOL_BY_NAME.calm.build({}, doc, seededRng(1)).commands)
    expect(cleared.modulators).toHaveLength(0)
    const again = TOOL_BY_NAME.calm.build({}, cleared, seededRng(1))
    expect(again.commands).toHaveLength(0)
  })
})

const synthTrack = (doc: BeatloungeDoc): InstrumentTrack => {
  const t = resolveSynthTrack(doc)
  if (!t) throw new Error("no synth track")
  return t
}

describe("jam", () => {
  it("writes a composed part onto the synth + sizes the loop", () => {
    const doc = createDefaultDoc(0)
    const r = TOOL_BY_NAME.jam.build({ key: "D", mode: "dorian", feel: "melody" }, doc, seededRng(5))
    expect(r.commands.length).toBeGreaterThan(0)
    const next = apply(doc, r.commands)
    const synth = next.tracks.find((t) => t.id === synthTrack(doc).id)!
    expect(isInstrumentTrack(synth)).toBe(true)
    if (isInstrumentTrack(synth)) expect(synth.notes.length).toBeGreaterThan(0)
    // The drum track must be untouched (jam binds the SYNTH).
    const drum = next.tracks.find((t) => isInstrumentTrack(t) && t.instrument.kind === "drumSampler")!
    const drumBefore = drumTrack(doc).notes.length
    expect(isInstrumentTrack(drum) && drum.notes.length).toBe(drumBefore)
    expect(r.summary.toLowerCase()).toContain("jam")
  })

  it("every feel produces a valid, applyable part", () => {
    for (const feel of JAM_FEELS) {
      const doc = createDefaultDoc(0)
      const r = TOOL_BY_NAME.jam.build({ key: "C", mode: "major", feel }, doc, seededRng(3))
      const next = apply(doc, r.commands)
      const synth = next.tracks.find((t) => t.id === synthTrack(doc).id)!
      if (isInstrumentTrack(synth)) {
        for (const n of synth.notes) {
          expect(n.pitch).toBeGreaterThanOrEqual(0)
          expect(n.pitch).toBeLessThanOrEqual(127)
          expect(n.duration).toBeGreaterThan(0)
        }
      }
    }
  })

  it("is reproducible given the same rng seed", () => {
    const doc = createDefaultDoc(0)
    const a = TOOL_BY_NAME.jam.build({ key: "G", mode: "minor", feel: "arp" }, doc, seededRng(42))
    const b = TOOL_BY_NAME.jam.build({ key: "G", mode: "minor", feel: "arp" }, doc, seededRng(42))
    expect(JSON.stringify(a.commands)).toBe(JSON.stringify(b.commands))
  })

  it("an unknown key/mode/feel degrades gracefully (never empty)", () => {
    const doc = createDefaultDoc(0)
    const r = TOOL_BY_NAME.jam.build({ key: "Q", mode: "klingon", feel: "yodel" }, doc, seededRng(1))
    expect(r.commands.length).toBeGreaterThan(0)
  })
})

describe("progression", () => {
  it("lays a named progression + jams over it", () => {
    const doc = createDefaultDoc(0)
    const r = TOOL_BY_NAME.progression.build({ template: "jazz", key: "C", mode: "major" }, doc, seededRng(2))
    const next = apply(doc, r.commands)
    const synth = next.tracks.find((t) => t.id === synthTrack(doc).id)!
    if (isInstrumentTrack(synth)) expect(synth.notes.length).toBeGreaterThan(0)
    expect(r.summary).toContain("jazz")
  })

  it("the laid part is harmonically consistent (downbeats are chord tones)", () => {
    const doc = createDefaultDoc(0)
    // pop in C = C G Am F; a melody's downbeats must be chord tones of each.
    const r = TOOL_BY_NAME.progression.build({ template: "pop", key: "C", mode: "major", feel: "melody" }, doc, seededRng(9))
    const next = apply(doc, r.commands)
    const synth = next.tracks.find((t) => t.id === synthTrack(doc).id)!
    // C(0,4,7) G(7,11,2) Am(9,0,4) F(5,9,0), one chord per 4 beats (3840t/bar).
    const PPQ = next.ppq
    const chordPcs = [
      [0, 4, 7],
      [7, 11, 2],
      [9, 0, 4],
      [5, 9, 0],
    ]
    if (isInstrumentTrack(synth)) {
      for (const n of synth.notes) {
        if (n.tick % PPQ !== 0) continue // downbeats only
        const bar = Math.floor(n.tick / (PPQ * 4)) % 4
        expect(chordPcs[bar]).toContain(toPc(n.pitch))
      }
    }
  })

  it("an unknown template falls back to pop", () => {
    const doc = createDefaultDoc(0)
    const r = TOOL_BY_NAME.progression.build({ template: "nonsense" }, doc, seededRng(1))
    expect(r.commands.length).toBeGreaterThan(0)
  })
})

describe("catalog invariants", () => {
  it("every tool with default args produces an applyable result", () => {
    for (const spec of TOOL_SPECS) {
      const doc = createDefaultDoc(0)
      // Build defaults from the param schema.
      const args: Record<string, unknown> = {}
      for (const [pn, p] of Object.entries(spec.params)) {
        if (p.default !== undefined) args[pn] = p.default
        else if (p.required && (p.type === "int" || p.type === "number")) args[pn] = p.min ?? 1
      }
      const r = spec.build(args, doc, seededRng(5))
      // Either it yields commands that apply, or it's a clean no-op summary.
      expect(() => apply(doc, r.commands)).not.toThrow()
      expect(typeof r.summary).toBe("string")
    }
  })
})
