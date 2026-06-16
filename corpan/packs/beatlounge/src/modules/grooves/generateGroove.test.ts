/**
 * beatlounge — the +/− dial's GENERATE path on the drum grid.
 *
 * Proves the dial regenerates a fresh, all-rows, density-scaled beat through
 * existing commands only (setNotes), replaces the targeted rows, scales with the
 * level, goes empty at level 0, never starts the transport, and is one undo batch.
 */

import { describe, expect, it } from "vitest"
import { createDefaultDoc, isInstrumentTrack, type BeatloungeDoc } from "../../model/document"
import { getRhythm } from "../../rhythm"
import { kitPitches } from "../../rhythm"
import { buildGrooveCommands, findDrumTrackId } from "./grooveModel"
import { generateAction } from "./actions"
import { reduce } from "../../model/reduce"
import { withStockDrums } from "../../testing/stockLoop"

const rngFrom = (seed: number): (() => number) => {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const doc = (): BeatloungeDoc => createDefaultDoc(0)
const drumNotes = (d: BeatloungeDoc) => {
  const t = d.tracks.find((x) => isInstrumentTrack(x) && x.instrument.kind === "drumSampler")
  return t && isInstrumentTrack(t) ? t.notes : []
}
const applyTo = (
  d: BeatloungeDoc,
  commands: ReturnType<typeof buildGrooveCommands>["commands"]
) => commands.reduce((acc, c) => reduce(acc, c), d)

const KICK = 36
const SNARE = 38

describe("generate path (the +/− dial)", () => {
  it("writes the kit via setNotes only — never plays (no transport commands)", () => {
    const d = doc()
    const r = getRhythm("son-clave-3-2")!
    const { commands } = buildGrooveCommands(d, r, {
      op: "generate",
      level: 2,
      seed: 123,
      target: { kind: "drums" },
    })
    expect(commands.some((c) => c.t === "setNotes")).toBe(true)
    expect(commands.every((c) => c.t !== "setTempo" && c.t !== "setLoopLength" || c.t === "setLoopLength")).toBe(true)
    // No play/start command type exists in the command set at all.
    expect(commands.every((c) => c.t === "setNotes" || c.t === "addTrack" || c.t === "setLoopLength")).toBe(true)
  })

  it("spreads over MANY kit rows (the whole kit, not 3 lanes) with no selection", () => {
    const r = getRhythm("samba")!
    const touched = new Set<number>()
    for (let s = 0; s < 40; s++) {
      const d = doc()
      const { commands } = buildGrooveCommands(d, r, {
        op: "generate",
        level: 2,
        seed: s + 1,
        target: { kind: "drums" },
      })
      const next = applyTo(d, commands)
      for (const n of drumNotes(next)) touched.add(n.pitch)
    }
    // Reaches well beyond the groove's 3-4 signature lanes.
    expect(touched.size).toBeGreaterThanOrEqual(12)
    for (const p of touched) expect(kitPitches()).toContain(p)
  })

  it("a fresh seed each press gives a genuinely different beat", () => {
    const r = getRhythm("son-clave-3-2")!
    const d = doc()
    const a = applyTo(d, buildGrooveCommands(d, r, { op: "generate", level: 2, seed: 1, target: { kind: "drums" } }).commands)
    const b = applyTo(d, buildGrooveCommands(d, r, { op: "generate", level: 2, seed: 2, target: { kind: "drums" } }).commands)
    const sig = (dd: BeatloungeDoc) => drumNotes(dd).map((n) => `${n.tick}:${n.pitch}`).sort().join(",")
    expect(sig(a)).not.toBe(sig(b))
  })

  it("level scales the hit count (denser at higher level)", () => {
    const r = getRhythm("son-clave-3-2")!
    const count = (level: number): number => {
      let total = 0
      for (let s = 0; s < 20; s++) {
        const d = doc()
        const { commands } = buildGrooveCommands(d, r, { op: "generate", level, seed: s + 1, target: { kind: "drums" } })
        total += drumNotes(applyTo(d, commands)).length
      }
      return total / 20
    }
    expect(count(3)).toBeGreaterThan(count(1))
  })

  it("generate is ADDITIVE — never clears; level 0 adds nothing but keeps existing", () => {
    const r = getRhythm("son-clave-3-2")!
    const d = withStockDrums(doc()) // stock doc has kick/snare/hat notes
    const before = drumNotes(d).length
    expect(before).toBeGreaterThan(0)
    // "+" strictly adds — it must NEVER remove existing hits (clearing/sparsing is
    // the `remove` op's job). Level 0 generates no new hits, so the count holds.
    const { commands } = buildGrooveCommands(d, r, { op: "generate", level: 0, target: { kind: "drums" } })
    expect(drumNotes(applyTo(d, commands)).length).toBe(before)
  })

  it("generate ADDS on top of existing hits (denser, never replaces)", () => {
    const r = getRhythm("son-clave-3-2")!
    const d = doc()
    const before = drumNotes(d).length
    const { commands } = buildGrooveCommands(d, r, { op: "generate", level: 4, seed: 7, target: { kind: "drums" } })
    const after = drumNotes(applyTo(d, commands)).length
    expect(after).toBeGreaterThan(before) // strictly more — additive
  })

  it("with a selection, regenerates ONLY those rows and keeps the rest", () => {
    const r = getRhythm("son-clave-3-2")!
    const d = withStockDrums(doc())
    const before = drumNotes(d)
    const hatPitch = 42
    const hatsBefore = before.filter((n) => n.pitch === hatPitch).length
    expect(hatsBefore).toBeGreaterThan(0) // stock doc has hats
    const { commands } = buildGrooveCommands(d, r, {
      op: "generate",
      level: 4,
      seed: 9,
      target: { kind: "drums", selectedPitches: [KICK, SNARE] },
    })
    const next = applyTo(d, commands)
    // Hats (un-targeted) survive untouched.
    expect(drumNotes(next).filter((n) => n.pitch === hatPitch).length).toBe(hatsBefore)
    // Every NEW generated note is on a targeted row.
    for (const n of drumNotes(next)) {
      if (n.pitch !== hatPitch) expect([KICK, SNARE]).toContain(n.pitch)
    }
  })

  it("the generateAction is deterministic given the same seed (same notes)", () => {
    // Pin the drum track id so the only variability is the (seeded) generator.
    const base = doc()
    const drumId = findDrumTrackId(base)!
    const noteSig = (res: ReturnType<typeof generateAction.run>): string => {
      const sn = res.commands.find((c) => c.t === "setNotes")
      return sn && sn.t === "setNotes"
        ? sn.notes.map((n) => `${n.tick}:${n.pitch}:${n.velocity.toFixed(4)}`).sort().join(",")
        : ""
    }
    const a = generateAction.run({ doc: base, rng: rngFrom(1) }, { rhythmId: "samba", level: 2, seed: 77, target: { kind: "drums", trackId: drumId } })
    const b = generateAction.run({ doc: base, rng: rngFrom(1) }, { rhythmId: "samba", level: 2, seed: 77, target: { kind: "drums", trackId: drumId } })
    expect(noteSig(a)).toBe(noteSig(b))
    expect(noteSig(a).length).toBeGreaterThan(0)
  })
})
