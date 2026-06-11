import { describe, expect, it } from "vitest"
import { createDefaultDoc } from "../../model/document"
import type {
  BeatloungeDoc,
  FragmentRef,
  FragmentTrack,
} from "../../model/document"
import { newId } from "../../model/ids"
import { stepForTick, stepsInLoop, tickForStep } from "../../model/timing"
import {
  buildJamView,
  cellEventAt,
  clampPitch,
  laneLabel,
  planScramble,
} from "./jamModel"

const ref = (text: string, language = "es"): FragmentRef => ({
  id: newId("frg"),
  source: "ttsRender",
  text,
  language,
})

/** A doc with a bank of two snippets + an empty fragment track to sequence on. */
const fixture = (): { doc: BeatloungeDoc; track: FragmentTrack; bank: FragmentRef[] } => {
  const base = createDefaultDoc(0)
  const bank = [ref("agua"), ref("hola")]
  const track: FragmentTrack = {
    id: newId("trk"),
    kind: "fragment",
    name: "Phrase Jam",
    grid: { denominator: 16 },
    volume: 0.8,
    pan: 0,
    mute: false,
    solo: false,
    inserts: [],
    sends: [],
    automation: [],
    instrument: { kind: "ttsFragment" },
    fragments: [],
  }
  const doc: BeatloungeDoc = {
    ...base,
    fragmentLibrary: bank,
    tracks: [...base.tracks, track],
  }
  return { doc, track, bank }
}

describe("phrase-jam grid step↔tick mapping (mirrors the drum step grid)", () => {
  it("derives the visible step count from loop + grid (one 4/4 bar = 16)", () => {
    const { doc, track, bank } = fixture()
    const view = buildJamView(doc, track, bank)
    expect(view.steps).toBe(stepsInLoop(doc.loopLengthTicks, track.grid))
    expect(view.steps).toBe(16)
    expect(view.stepsPerBeat).toBe(4)
  })

  it("makes one lane per bank snippet, in bank order", () => {
    const { doc, track, bank } = fixture()
    const view = buildJamView(doc, track, bank)
    expect(view.lanes).toHaveLength(2)
    expect(view.lanes.map((l) => l.ref.id)).toEqual(bank.map((b) => b.id))
    expect(view.lanes[0].langTag).toBe("ES")
  })

  it("round-trips step → tick → step on the track grid", () => {
    const { track } = fixture()
    for (let s = 0; s < 16; s++) {
      expect(stepForTick(tickForStep(s, track.grid), track.grid)).toBe(s)
    }
  })

  it("lights a cell exactly where a FragmentEvent references that snippet at that tick", () => {
    const { doc, track, bank } = fixture()
    const placed: FragmentTrack = {
      ...track,
      fragments: [
        { id: newId("fev"), tick: tickForStep(4, track.grid), fragmentId: bank[0].id, gain: 0.9, pitchSemis: 0 },
        { id: newId("fev"), tick: tickForStep(8, track.grid), fragmentId: bank[1].id, gain: 0.9, pitchSemis: 5 },
      ],
    }
    const view = buildJamView(doc, placed, bank)
    expect(view.lanes[0].cells[4].on).toBe(true)
    expect(view.lanes[0].cells[0].on).toBe(false)
    expect(view.lanes[1].cells[8].on).toBe(true)
    // per-lane pitch default tracks the latest placed event's pitch
    expect(view.lanes[1].pitchSemis).toBe(5)
  })

  it("cellEventAt resolves the placed event id for removeFragment", () => {
    const { track, bank } = fixture()
    const ev = { id: newId("fev"), tick: tickForStep(2, track.grid), fragmentId: bank[0].id, gain: 0.9, pitchSemis: 0 }
    const placed: FragmentTrack = { ...track, fragments: [ev] }
    expect(cellEventAt(placed, bank[0].id, 2)?.id).toBe(ev.id)
    expect(cellEventAt(placed, bank[0].id, 3)).toBeUndefined()
  })

  it("laneLabel trims long snippet text and falls back gracefully", () => {
    expect(laneLabel(ref("hola"))).toBe("hola")
    expect(laneLabel(ref("a".repeat(40))).endsWith("…")).toBe(true)
    expect(laneLabel({ id: "x", source: "ttsRender" })).toBe("snippet")
  })
})

describe("planScramble (pure, reproducible)", () => {
  const seeded = (seed: number) => {
    let a = seed >>> 0
    return () => {
      a |= 0
      a = (a + 0x6d2b79f5) | 0
      let t = Math.imul(a ^ (a >>> 15), 1 | a)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  it("is deterministic given the same seed", () => {
    const a = planScramble(3, 16, seeded(42), 0.6)
    const b = planScramble(3, 16, seeded(42), 0.6)
    expect(a).toEqual(b)
  })

  it("never exceeds one placement per step column and stays in range", () => {
    const plan = planScramble(4, 16, seeded(7), 1)
    const steps = plan.map((p) => p.step)
    expect(new Set(steps).size).toBe(steps.length) // no dup columns
    for (const p of plan) {
      expect(p.step).toBeGreaterThanOrEqual(0)
      expect(p.step).toBeLessThan(16)
      expect(p.laneIndex).toBeGreaterThanOrEqual(0)
      expect(p.laneIndex).toBeLessThan(4)
      expect(p.pitchSemis).toBeGreaterThanOrEqual(-24)
      expect(p.pitchSemis).toBeLessThanOrEqual(24)
    }
  })

  it("keeps pitches MODEST + MUSICAL: bounded to ±12 and never all the same", () => {
    // Regression for the old runaway ladder that pinned a full bar to +24.
    // Across many seeds the pitches must stay within an octave either side of
    // centre and show real variation (not a monotone climb to the ceiling).
    let sawVariation = false
    for (let seed = 1; seed <= 40; seed++) {
      const plan = planScramble(4, 16, seeded(seed), 1)
      const pitches = plan.map((p) => p.pitchSemis)
      for (const semis of pitches) {
        expect(semis).toBeGreaterThanOrEqual(-12)
        expect(semis).toBeLessThanOrEqual(12)
      }
      if (pitches.length > 4 && new Set(pitches).size > 1) sawVariation = true
      // pitches must NOT be monotonically increasing with column position
      const increasing = pitches.every(
        (v, i) => i === 0 || v >= pitches[i - 1]
      )
      if (pitches.length > 6) expect(increasing).toBe(false)
    }
    expect(sawVariation).toBe(true)
  })

  it("density 0 places nothing; empty bank/grid is a no-op", () => {
    expect(planScramble(3, 16, seeded(1), 0)).toEqual([])
    expect(planScramble(0, 16, seeded(1), 1)).toEqual([])
    expect(planScramble(3, 0, seeded(1), 1)).toEqual([])
  })

  it("clampPitch rounds and clamps to ±24", () => {
    expect(clampPitch(3.4)).toBe(3)
    expect(clampPitch(99)).toBe(24)
    expect(clampPitch(-99)).toBe(-24)
  })
})
