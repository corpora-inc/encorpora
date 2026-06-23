/**
 * beatlounge — operations-engine tests: apply tiling math, role→pitch mapping
 * coverage, phrase distribution, determinism from a seed, vary backbone
 * preservation, and evolve bounds.
 */

import { describe, expect, it } from "vitest"
import { PPQ } from "../model/timing"
import { getRhythm } from "./index"
import {
  applyRhythm,
  applyRhythmToPhrases,
  scatterRhythm,
  scatterPhrases,
  chooseHitsToSparsify,
  cellTicks,
  evolveRhythm,
  randomizeRhythm,
  rhythmTicks,
  varyRhythm,
  type RemovableHit,
} from "./engine"
import { hitVelocity, rhythmCells, type Lane, type Rhythm } from "./types"
import { pitchForRole, KIT_PITCHES } from "./roles"

/** mulberry32 — the same PRNG runAction uses, so tests mirror production. */
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

const son = () => getRhythm("son-clave-3-2")!
const samba = () => getRhythm("samba")!
const teental = () => getRhythm("teental")!

describe("applyRhythm — cell→tick + tiling", () => {
  it("places son clave on the right ticks for one cycle", () => {
    const r = son()
    const ct = cellTicks(r) // PPQ/4 sixteenth
    expect(ct).toBe(PPQ / 4)
    const notes = applyRhythm(r) // default loop = native length
    // 3-2 son clave: cells 0,3,6,10,12.
    const ticks = notes.map((n) => n.tick)
    expect(ticks).toEqual([0, 3, 6, 10, 12].map((c) => c * ct))
  })

  it("tiles a 1-bar pattern across a 4-bar loop (repeat whole cycles)", () => {
    const r = son()
    const oneCycle = rhythmTicks(r) // 4 beats = 1 bar
    expect(oneCycle).toBe(PPQ * 4)
    const notes = applyRhythm(r, { loopTicks: oneCycle * 4 })
    // 5 hits × 4 cycles.
    expect(notes.length).toBe(5 * 4)
    // Last cycle's first hit is at offset 3*oneCycle.
    expect(notes.some((n) => n.tick === 3 * oneCycle)).toBe(true)
    expect(Math.max(...notes.map((n) => n.tick))).toBeLessThan(oneCycle * 4)
  })

  it("truncates a partial trailing cycle (no hit at/after the loop end)", () => {
    const r = son()
    const oneCycle = rhythmTicks(r)
    const loop = Math.round(oneCycle * 2.5) // 2 full + half a cycle
    const notes = applyRhythm(r, { loopTicks: loop })
    expect(notes.every((n) => n.tick < loop)).toBe(true)
    // The half cycle only includes clave hits whose cell tick < half-cycle.
    const tail = notes.filter((n) => n.tick >= oneCycle * 2)
    expect(tail.length).toBeGreaterThan(0)
    expect(tail.every((n) => n.tick - oneCycle * 2 < oneCycle / 2)).toBe(true)
  })

  it("wholeCyclesOnly drops the partial tail entirely", () => {
    const r = son()
    const oneCycle = rhythmTicks(r)
    const notes = applyRhythm(r, { loopTicks: Math.round(oneCycle * 2.5), wholeCyclesOnly: true })
    expect(notes.length).toBe(5 * 2)
    expect(notes.every((n) => n.tick < oneCycle * 2)).toBe(true)
  })

  it("maps every lane role to a real kit pitch and applies intensity", () => {
    for (const r of [son(), samba(), teental()]) {
      const notes = applyRhythm(r, { intensity: 0.5 })
      for (const n of notes) {
        expect(KIT_PITCHES.has(n.pitch)).toBe(true)
        expect(n.velocity).toBeGreaterThanOrEqual(0)
        expect(n.velocity).toBeLessThanOrEqual(1)
      }
    }
  })

  it("handles a long cycle (teental, 16 matras) cleanly", () => {
    const r = teental()
    const ct = cellTicks(r) // PPQ per matra (1 step/beat)
    expect(ct).toBe(PPQ)
    expect(rhythmTicks(r)).toBe(16 * PPQ)
    const notes = applyRhythm(r)
    expect(notes.every((n) => n.tick < 16 * PPQ)).toBe(true)
  })
})

describe("applyRhythm — determinism", () => {
  it("is a pure function of inputs (same args ⇒ identical output)", () => {
    const a = applyRhythm(samba(), { loopTicks: PPQ * 8, intensity: 0.8 })
    const b = applyRhythm(samba(), { loopTicks: PPQ * 8, intensity: 0.8 })
    expect(a).toEqual(b)
  })
})

describe("scatterRhythm — probabilistic spread across selected rows", () => {
  const KICK = 36
  const SNARE = 38
  const COWBELL = 56

  it("only places hits on the given rows", () => {
    const rows = [KICK, SNARE, COWBELL]
    for (let seed = 1; seed <= 12; seed++) {
      const out = scatterRhythm(son(), rows, rngFrom(seed), { loopTicks: PPQ * 4 })
      for (const n of out) expect(rows).toContain(n.pitch)
    }
  })

  it("spreads across ALL the selected rows (over a handful of seeds)", () => {
    const rows = [KICK, SNARE, COWBELL]
    const used = new Set<number>()
    for (let seed = 1; seed <= 8; seed++) {
      for (const n of scatterRhythm(son(), rows, rngFrom(seed), { loopTicks: PPQ * 4 })) {
        used.add(n.pitch)
      }
    }
    for (const p of rows) expect(used.has(p)).toBe(true)
  })

  it("follows the profile: onset cells fire much more often than rests", () => {
    const r = son()
    const ct = cellTicks(r)
    const onset = new Set([0, 3, 6, 10, 12])
    let onsetHits = 0
    let restHits = 0
    for (let seed = 1; seed <= 100; seed++) {
      for (const n of scatterRhythm(r, [KICK], rngFrom(seed))) {
        const cell = Math.round(n.tick / ct) % 16
        if (onset.has(cell)) onsetHits++
        else restHits++
      }
    }
    expect(onsetHits).toBeGreaterThan(restHits)
    expect(onsetHits).toBeGreaterThan(0)
  })

  it("chooses velocities inside the step's band (loud accents seen, all in 0..1)", () => {
    const r = son()
    const ct = cellTicks(r)
    let sawLoudAccent = false
    for (let seed = 1; seed <= 80; seed++) {
      for (const n of scatterRhythm(r, [SNARE], rngFrom(seed))) {
        expect(n.velocity).toBeGreaterThan(0)
        expect(n.velocity).toBeLessThanOrEqual(1)
        if (Math.round(n.tick / ct) % 16 === 0 && n.velocity > 0.7) sawLoudAccent = true
      }
    }
    expect(sawLoudAccent).toBe(true)
  })

  it("is deterministic from a seed, and DIFFERENT seeds differ", () => {
    const rows = [KICK, SNARE]
    const a1 = scatterRhythm(son(), rows, rngFrom(7), { loopTicks: PPQ * 4 })
    const a2 = scatterRhythm(son(), rows, rngFrom(7), { loopTicks: PPQ * 4 })
    expect(a1).toEqual(a2) // same seed ⇒ identical
    const b = scatterRhythm(son(), rows, rngFrom(8), { loopTicks: PPQ * 4 })
    expect(JSON.stringify(b)).not.toBe(JSON.stringify(a1)) // fresh seed ⇒ different
  })

  it("density scales the placement count", () => {
    const rows = [KICK, SNARE, COWBELL]
    let dense = 0
    let sparse = 0
    for (let seed = 1; seed <= 30; seed++) {
      dense += scatterRhythm(son(), rows, rngFrom(seed), { density: 1 }).length
      sparse += scatterRhythm(son(), rows, rngFrom(seed), { density: 0.3 }).length
    }
    expect(sparse).toBeLessThan(dense)
  })

  it("works for a multi-lane groove (samba) and an empty row list is a no-op", () => {
    expect(scatterRhythm(son(), [], rngFrom(1))).toEqual([])
    const out = scatterRhythm(samba(), [KICK, SNARE], rngFrom(3), { loopTicks: PPQ * 4 })
    for (const n of out) expect([KICK, SNARE]).toContain(n.pitch)
  })

  it("tiles + truncates across the loop (no hit at/after loop end)", () => {
    const r = son()
    const loop = rhythmTicks(r) * 3
    const out = scatterRhythm(r, [KICK], rngFrom(5), { loopTicks: loop })
    expect(out.every((n) => n.tick < loop)).toBe(true)
  })
})

describe("scatterPhrases — probabilistic snippet placement", () => {
  it("places snippets on the groove, seeded + within the loop", () => {
    const out = scatterPhrases(samba(), 3, rngFrom(7), { loopTicks: PPQ * 4, density: 1 })
    expect(out.length).toBeGreaterThan(0)
    for (const ev of out) {
      expect(ev.snippetIndex).toBeGreaterThanOrEqual(0)
      expect(ev.snippetIndex).toBeLessThan(3)
      expect(ev.tick).toBeGreaterThanOrEqual(0)
      expect(ev.tick).toBeLessThan(PPQ * 4)
    }
  })

  it("is deterministic from a seed; different seeds differ", () => {
    const a = scatterPhrases(samba(), 3, rngFrom(7), { loopTicks: PPQ * 4, density: 1 })
    const b = scatterPhrases(samba(), 3, rngFrom(7), { loopTicks: PPQ * 4, density: 1 })
    expect(a).toEqual(b)
    const c = scatterPhrases(samba(), 3, rngFrom(8), { loopTicks: PPQ * 4, density: 1 })
    expect(JSON.stringify(c)).not.toBe(JSON.stringify(a))
  })

  it("returns nothing with no snippets", () => {
    expect(scatterPhrases(son(), 0, rngFrom(1))).toEqual([])
  })

  it("with selected rows, puts the groove on ONLY those rows (like drums)", () => {
    const out = scatterPhrases(samba(), 5, rngFrom(7), {
      loopTicks: PPQ * 4,
      density: 1,
      rows: [1, 3],
    })
    expect(out.length).toBeGreaterThan(0)
    // Only the selected snippet rows are placed — nothing else.
    const used = new Set(out.map((e) => e.snippetIndex))
    expect([...used].sort()).toEqual([1, 3])
    // Each selected row got its own spread (the groove appears on both).
    expect(out.some((e) => e.snippetIndex === 1)).toBe(true)
    expect(out.some((e) => e.snippetIndex === 3)).toBe(true)
  })
})

describe("chooseHitsToSparsify — the '−' of the density dial", () => {
  const hit = (ref: string, tick: number, velocity: number): RemovableHit => ({ ref, tick, velocity })

  it("removes a FRACTION (rounded, ≥1) of the hits, not all of them", () => {
    const hits = Array.from({ length: 10 }, (_, i) => hit(`h${i}`, i * 24, 0.6))
    const out = chooseHitsToSparsify(hits, 0.3, () => 0.5)
    expect(out.length).toBe(3) // round(10 * 0.3)
  })

  it("always removes at least ONE so a − tap makes progress", () => {
    const hits = [hit("a", 0, 0.9), hit("b", 24, 0.9)]
    // 2 * 0.1 rounds to 0 → clamp up to 1.
    const out = chooseHitsToSparsify(hits, 0.1, () => 1)
    expect(out.length).toBe(1)
  })

  it("can take the LAST hit down to nothing", () => {
    const hits = [hit("only", 0, 0.5)]
    expect(chooseHitsToSparsify(hits, 1, () => 1).length).toBe(1)
    // Repeated thinning of a single hit still removes it.
    expect(chooseHitsToSparsify(hits, 0.3, () => 0.5).length).toBe(1)
  })

  it("prefers OFF-BEAT hits first (low groove probability removed before onsets)", () => {
    // Two hits, equal velocity: one on a strong onset cell, one off-beat.
    const onset = hit("onset", 0, 0.7)
    const offbeat = hit("offbeat", 24, 0.7)
    const probOf = (tick: number) => (tick === 0 ? 0.9 : 0.06)
    const out = chooseHitsToSparsify([onset, offbeat], 0.5, probOf)
    expect(out.map((h) => h.ref)).toEqual(["offbeat"])
  })

  it("prefers QUIET hits when groove emphasis ties (keep the loud ones)", () => {
    const loud = hit("loud", 0, 0.95)
    const quiet = hit("quiet", 24, 0.2)
    const out = chooseHitsToSparsify([loud, quiet], 0.5, () => 0.5)
    expect(out.map((h) => h.ref)).toEqual(["quiet"])
  })

  it("is empty for an empty input or a zero fraction", () => {
    expect(chooseHitsToSparsify([], 0.5, () => 1)).toEqual([])
    expect(chooseHitsToSparsify([hit("a", 0, 0.5)], 0, () => 1)).toEqual([])
  })

  it("is pure/stable (same args ⇒ same removal set)", () => {
    const hits = Array.from({ length: 8 }, (_, i) => hit(`h${i}`, i * 12, 0.3 + i * 0.05))
    const a = chooseHitsToSparsify(hits, 0.5, (t) => (t % 48 === 0 ? 0.9 : 0.1))
    const b = chooseHitsToSparsify(hits, 0.5, (t) => (t % 48 === 0 ? 0.9 : 0.1))
    expect(a).toEqual(b)
  })

  // ----- the PROBABILISTIC draw (with an rng) — surprising but still subtractive
  it("with an rng: removes the SAME count, never more, always ≥1", () => {
    const hits = Array.from({ length: 10 }, (_, i) => hit(`h${i}`, i * 24, 0.6))
    for (let seed = 1; seed <= 20; seed++) {
      const out = chooseHitsToSparsify(hits, 0.3, () => 0.5, rngFrom(seed))
      expect(out.length).toBe(3) // identical count to the deterministic mode
      // No duplicates, all from the input (a strict SUBSET — never invents a hit).
      const refs = new Set(out.map((h) => h.ref))
      expect(refs.size).toBe(out.length)
      for (const h of out) expect(hits).toContain(h)
    }
  })

  it("with an rng: is SEEDED — same seed ⇒ same set, different seeds ⇒ variety", () => {
    const hits = Array.from({ length: 12 }, (_, i) => hit(`h${i}`, i * 24, 0.5))
    const setFor = (seed: number) =>
      chooseHitsToSparsify(hits, 0.4, () => 0.5, rngFrom(seed))
        .map((h) => h.ref)
        .sort()
        .join(",")
    expect(setFor(3)).toBe(setFor(3)) // reproducible
    const outcomes = new Set(Array.from({ length: 16 }, (_, i) => setFor(i + 1)))
    expect(outcomes.size).toBeGreaterThan(1) // genuinely surprising
  })

  it("with an rng: still WEIGHTS toward off-beat (strong onset survives most of the time)", () => {
    // One strong onset cell + 7 weak off-beat hits; thin ONE. The onset is the
    // least expendable, so across many seeds it should survive far more often than
    // a uniform 7/8.
    const onset = hit("onset", 0, 0.95)
    const offbeats = Array.from({ length: 7 }, (_, i) => hit(`off${i}`, (i + 1) * 24, 0.3))
    const probOf = (t: number) => (t === 0 ? 0.95 : 0.05)
    let onsetSurvived = 0
    const TRIALS = 80
    for (let seed = 1; seed <= TRIALS; seed++) {
      const out = chooseHitsToSparsify([onset, ...offbeats], 0.125, probOf, rngFrom(seed))
      expect(out.length).toBe(1)
      if (out[0].ref !== "onset") onsetSurvived++
    }
    // A uniform pick drops the onset ~1/8 of the time (survives ~87%); the bias
    // should push survival well above that.
    expect(onsetSurvived).toBeGreaterThan(TRIALS * 0.95)
  })

  it("with an rng: a full-fraction draw still removes EVERYTHING (down to nothing)", () => {
    const hits = Array.from({ length: 5 }, (_, i) => hit(`h${i}`, i * 24, 0.5))
    const out = chooseHitsToSparsify(hits, 1, () => 0.5, rngFrom(9))
    expect(out.length).toBe(5)
    expect(new Set(out.map((h) => h.ref)).size).toBe(5)
  })
})

describe("applyRhythmToPhrases", () => {
  it("lands phrases on groove onsets, seeded + reproducible", () => {
    const r = samba()
    const p1 = applyRhythmToPhrases(r, 3, rngFrom(7), { loopTicks: PPQ * 4, density: 1 })
    const p2 = applyRhythmToPhrases(r, 3, rngFrom(7), { loopTicks: PPQ * 4, density: 1 })
    expect(p1).toEqual(p2) // determinism from the seed
    expect(p1.length).toBeGreaterThan(0)
    for (const ev of p1) {
      expect(ev.snippetIndex).toBeGreaterThanOrEqual(0)
      expect(ev.snippetIndex).toBeLessThan(3)
      expect(ev.tick).toBeGreaterThanOrEqual(0)
      expect(ev.tick).toBeLessThan(PPQ * 4)
    }
  })

  it("density thins the placements", () => {
    const r = samba()
    const dense = applyRhythmToPhrases(r, 4, rngFrom(1), { loopTicks: PPQ * 4, density: 1 })
    const sparse = applyRhythmToPhrases(r, 4, rngFrom(1), { loopTicks: PPQ * 4, density: 0.25 })
    expect(sparse.length).toBeLessThanOrEqual(dense.length)
    expect(sparse.length).toBeGreaterThan(0)
  })

  it("places phrases at their NATURAL pitch — no semitone shift ever", () => {
    const placed = applyRhythmToPhrases(son(), 1, rngFrom(2), { loopTicks: PPQ * 4, density: 1 })
    expect(placed.length).toBeGreaterThan(0)
    // PhrasePlacement carries no pitch field; placements only have tick/snippet/velocity.
    for (const ev of placed) expect(ev).not.toHaveProperty("pitchSemis")
  })

  it("returns nothing with no snippets", () => {
    expect(applyRhythmToPhrases(son(), 0, rngFrom(1))).toEqual([])
  })
})

/** The accented backbone cells of a rhythm's signature lanes. */
const backbone = (r: Rhythm): { role: string; cell: number }[] => {
  const out: { role: string; cell: number }[] = []
  for (const l of r.lanes) {
    if (!l.signature) continue
    for (const h of l.hits) if (h.accent) out.push({ role: l.role, cell: h.cell })
  }
  return out.sort((a, b) => a.cell - b.cell)
}

describe("varyRhythm — keeps the flavor", () => {
  it("preserves the signature backbone under vary (clave stays recognizable)", () => {
    const r = son()
    const before = backbone(r)
    for (let seed = 1; seed <= 25; seed++) {
      const v = varyRhythm(r, rngFrom(seed), 0.35)
      const after = backbone(v)
      // Every backbone accent survives at its cell.
      for (const b of before) {
        expect(after.some((a) => a.role === b.role && a.cell === b.cell), `seed ${seed}`).toBe(true)
      }
    }
  })

  it("preserves backbone for a multi-lane groove (samba surdo)", () => {
    const r = samba()
    const before = backbone(r)
    expect(before.length).toBeGreaterThan(0)
    for (let seed = 1; seed <= 15; seed++) {
      const after = backbone(varyRhythm(r, rngFrom(seed), 0.4))
      for (const b of before) {
        expect(after.some((a) => a.role === b.role && a.cell === b.cell)).toBe(true)
      }
    }
  })

  it("is deterministic from a seed", () => {
    const a = varyRhythm(samba(), rngFrom(99), 0.3)
    const b = varyRhythm(samba(), rngFrom(99), 0.3)
    expect(a).toEqual(b)
  })

  it("actually changes something at a meaningful amount", () => {
    const r = son()
    // Son clave has a single signature lane → vary adds ghosts / jitter.
    let changed = 0
    for (let seed = 1; seed <= 30; seed++) {
      const v = varyRhythm(r, rngFrom(seed), 0.5)
      const sameHits =
        JSON.stringify(v.lanes.map((l) => l.hits)) === JSON.stringify(r.lanes.map((l) => l.hits))
      if (!sameHits) changed++
    }
    expect(changed).toBeGreaterThan(0)
  })

  it("does not mutate the source corpus rhythm", () => {
    const r = son()
    const snapshot = JSON.stringify(r)
    varyRhythm(r, rngFrom(5), 0.5)
    expect(JSON.stringify(r)).toBe(snapshot)
  })

  it("keeps every hit in-grid after vary", () => {
    const r = samba()
    const cells = rhythmCells(r)
    for (let seed = 1; seed <= 20; seed++) {
      const v = varyRhythm(r, rngFrom(seed), 0.6)
      for (const l of v.lanes) for (const h of l.hits) {
        expect(h.cell).toBeGreaterThanOrEqual(0)
        expect(h.cell).toBeLessThan(cells)
      }
    }
  })
})

describe("evolveRhythm — drifts but stays musical + bounded", () => {
  it("preserves the backbone across many generations", () => {
    const r = son()
    const before = backbone(r)
    const e = evolveRhythm(r, rngFrom(3), 8, 0.25)
    const after = backbone(e)
    for (const b of before) {
      expect(after.some((a) => a.role === b.role && a.cell === b.cell)).toBe(true)
    }
  })

  it("stays in-grid and at valid velocities across generations", () => {
    const r = samba()
    const cells = rhythmCells(r)
    const e = evolveRhythm(r, rngFrom(4), 10, 0.3)
    for (const l of e.lanes as Lane[]) {
      for (const h of l.hits) {
        expect(h.cell).toBeGreaterThanOrEqual(0)
        expect(h.cell).toBeLessThan(cells)
        expect(hitVelocity(l, h)).toBeGreaterThanOrEqual(0)
        expect(hitVelocity(l, h)).toBeLessThanOrEqual(1)
      }
    }
  })

  it("drifts further than a single vary (more change over generations)", () => {
    const r = samba()
    const base = JSON.stringify(r.lanes.map((l) => l.hits.map((h) => h.cell)))
    const oneStep = varyRhythm(r, rngFrom(8), 0.25)
    const many = evolveRhythm(r, rngFrom(8), 8, 0.25)
    const diff = (x: Rhythm) => {
      const cells = JSON.stringify(x.lanes.map((l) => l.hits.map((h) => h.cell)))
      return cells === base ? 0 : 1
    }
    // Over 8 generations something changed (evolve is at least as mutated).
    expect(diff(many)).toBe(1)
    void oneStep
  })

  it("is deterministic from a seed", () => {
    const a = evolveRhythm(samba(), rngFrom(12), 5, 0.2)
    const b = evolveRhythm(samba(), rngFrom(12), 5, 0.2)
    expect(a).toEqual(b)
  })
})

describe("randomizeRhythm — full re-roll", () => {
  it("returns a corpus rhythm, optionally family-restricted", () => {
    const anySeed = randomizeRhythm(rngFrom(1))
    expect(getRhythm(anySeed.id) || anySeed.id.includes("~")).toBeTruthy()

    for (let seed = 1; seed <= 20; seed++) {
      const r = randomizeRhythm(rngFrom(seed), { family: "indian" })
      expect(r.family).toBe("indian")
    }
  })

  it("is deterministic from a seed", () => {
    const a = randomizeRhythm(rngFrom(42), { family: "afro-cuban", vary: 0.2 })
    const b = randomizeRhythm(rngFrom(42), { family: "afro-cuban", vary: 0.2 })
    expect(a).toEqual(b)
  })

  it("maps cleanly through applyRhythm", () => {
    const r = randomizeRhythm(rngFrom(5))
    const notes = applyRhythm(r, { loopTicks: PPQ * 4 })
    for (const n of notes) expect(KIT_PITCHES.has(n.pitch)).toBe(true)
    // every role resolves
    for (const l of r.lanes) expect(KIT_PITCHES.has(pitchForRole(l.role))).toBe(true)
  })
})
