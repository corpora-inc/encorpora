/**
 * beatlounge — tool catalog tests: every build() emits VALID commands, clamps
 * its own args, and the result actually applies through the real reducer (so a
 * tool can never produce an illegal mutation). Stochastic tools are seeded.
 */

import { describe, expect, it } from "vitest"
import { TOOL_BY_NAME, TOOL_SPECS, resolveDrumPitch, MOOD_NAMES } from "./tools"
import { reduce } from "../model/reduce"
import { createDefaultDoc, DRUM_PITCH, isInstrumentTrack } from "../model/document"
import type { BeatloungeDoc, InstrumentTrack } from "../model/document"
import type { Command } from "../model/command"

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
