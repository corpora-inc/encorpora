/**
 * beatlounge — DRUM-LANE GROOVE TARGETING tests (the cool new feature).
 *
 * `applyRhythm(r, { targetPitches })` re-points a world rhythm at the kit voices
 * the user selected on the drum page's lane heads:
 *   • empty / undefined → the natural role→DRUM_PITCH mapping (unchanged).
 *   • ONE pitch         → COLLAPSE: every onset of every lane unioned onto that
 *                         one pitch (a clave plays the kick).
 *   • N pitches         → DISTRIBUTE: rank lanes (signature first, then density),
 *                         top-N assigned in order to the N target pitches.
 *
 * These assert the heuristics are correct and deterministic, and that an empty
 * selection is byte-identical to the old behaviour.
 */

import { describe, expect, it } from "vitest"
import { getRhythm } from "./index"
import { applyRhythm, cellTicks } from "./engine"
import { pitchForRole } from "./roles"

const son = () => getRhythm("son-clave-3-2")!
const samba = () => getRhythm("samba")!

/** Kit pitches we'll target (kept distinct from the rhythms' natural pitches). */
const KICK = 36
const SNARE = 38
const COWBELL = 56

describe("applyRhythm targeting — empty selection == old behavior", () => {
  it("undefined targetPitches is identical to no option at all", () => {
    const r = son()
    expect(applyRhythm(r, { targetPitches: undefined })).toEqual(applyRhythm(r))
    expect(applyRhythm(r, { targetPitches: [] })).toEqual(applyRhythm(r))
  })

  it("a multi-lane rhythm with no target keeps its per-role pitches", () => {
    const r = samba()
    const out = applyRhythm(r)
    const pitches = new Set(out.map((n) => n.pitch))
    // Surdo, ganzá, tamborim, caixa map to several distinct voices.
    expect(pitches.size).toBeGreaterThan(1)
  })
})

describe("applyRhythm targeting — ONE pitch collapses the whole rhythm", () => {
  it("every hit lands on the single target pitch", () => {
    const r = samba()
    const out = applyRhythm(r, { targetPitches: [KICK] })
    expect(out.every((n) => n.pitch === KICK)).toBe(true)
  })

  it("collapse is the UNION of all lanes' onset ticks (deduped)", () => {
    const r = samba()
    // Expected: union of every lane's hit cells (one cycle), mapped to ticks.
    const cells = new Set<number>()
    for (const lane of r.lanes) for (const h of lane.hits) cells.add(h.cell)
    const out = applyRhythm(r, { targetPitches: [KICK] })
    const outCells = new Set(out.map((n) => n.tick / cellTickOf(r)))
    expect([...outCells].sort((a, b) => a - b)).toEqual(
      [...cells].sort((a, b) => a - b)
    )
    // No duplicate (tick,pitch) — overlapping lanes were merged.
    const keys = out.map((n) => `${n.tick}:${n.pitch}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it("a clave (one-lane signature) plays the chosen voice", () => {
    const r = son()
    const naturalPitch = pitchForRole(r.lanes[0].role) // claves voice 75
    const out = applyRhythm(r, { targetPitches: [KICK] })
    expect(out.every((n) => n.pitch === KICK)).toBe(true)
    expect(naturalPitch).not.toBe(KICK)
    // Same onset COUNT as the natural pattern (5 clave stabs).
    expect(out.length).toBe(applyRhythm(r).length)
  })

  it("collapse keeps the LOUDER hit when two lanes collide on a tick", () => {
    const r = samba()
    const out = applyRhythm(r, { targetPitches: [KICK] })
    // surdo accent at cell 4 (vel ~1.0) and caixa accent at cell 4 collide →
    // the surviving hit at that tick should be the louder of the two.
    const ct = cellTickOf(r)
    const atCell4 = out.filter((n) => n.tick === 4 * ct)
    expect(atCell4.length).toBe(1)
    expect(atCell4[0].velocity).toBeGreaterThan(0.8)
  })
})

describe("applyRhythm targeting — N pitches distribute top-N lanes in order", () => {
  it("the SIGNATURE lane lands on the first target pitch", () => {
    const r = samba()
    // samba lane 0 = surdo (signature). Distribute across [SNARE, COWBELL].
    // Use pitches that DON'T also collide with the 2nd lane so the assertion is
    // unambiguous: the signature lane's own onsets must appear on the 1st pitch.
    const out = applyRhythm(r, { targetPitches: [SNARE, COWBELL] })
    const ct = cellTickOf(r)
    const snareCells = new Set(
      out.filter((n) => n.pitch === SNARE).map((n) => n.tick / ct)
    )
    // Surdo (signature) onsets are cells 4 & 12 → present on the FIRST pitch.
    expect(snareCells.has(4)).toBe(true)
    expect(snareCells.has(12)).toBe(true)
  })

  it("uses exactly the N selected pitches (no others)", () => {
    const r = samba()
    const out = applyRhythm(r, { targetPitches: [SNARE, COWBELL] })
    const pitches = new Set(out.map((n) => n.pitch))
    expect([...pitches].sort((a, b) => a - b)).toEqual([SNARE, COWBELL])
  })

  it("picks the TOP-N lanes by importance (signature, then density)", () => {
    const r = samba()
    // With ONE extra target beyond the signature, the second-ranked lane is a
    // high-density colour lane (ganzá/tamborim/caixa each 8 hits) — so the
    // second pitch must carry a dense pattern (>2 onsets), not the sparse
    // surdo-hi (2 hits). Assert the COWBELL lane is dense.
    const out = applyRhythm(r, { targetPitches: [SNARE, COWBELL] })
    const ct = cellTickOf(r)
    const cowbellCells = new Set(
      out.filter((n) => n.pitch === COWBELL).map((n) => n.tick / ct)
    )
    expect(cowbellCells.size).toBeGreaterThan(2)
  })

  it("fewer lanes than targets → extra targets go unused (no empty lanes)", () => {
    const r = son() // a single-lane clave
    const out = applyRhythm(r, { targetPitches: [KICK, SNARE, COWBELL] })
    const pitches = new Set(out.map((n) => n.pitch))
    // Only the one lane → only the FIRST target pitch is used.
    expect([...pitches]).toEqual([KICK])
  })

  it("is deterministic — same inputs, same placements", () => {
    const r = samba()
    const a = applyRhythm(r, { targetPitches: [SNARE, COWBELL] })
    const b = applyRhythm(r, { targetPitches: [SNARE, COWBELL] })
    expect(a).toEqual(b)
  })
})

/** Cell→tick width for a rhythm — the engine's own helper (PPQ / stepsPerBeat). */
const cellTickOf = (r: ReturnType<typeof son>): number => cellTicks(r)
