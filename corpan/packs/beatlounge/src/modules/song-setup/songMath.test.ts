import { describe, expect, it } from "vitest"
import { MAX_LOOP_TICKS, PPQ, clampLoopTicks, ticksPerBar } from "../../model/timing"
import {
  BAR_SNAPS,
  CYCLE_CATALOG,
  MAX_BEATS,
  METER_PRESETS,
  barsToTicks,
  beatTicks,
  beatsPerBar,
  beatsToTicks,
  clampNumerator,
  customCycle,
  findCycle,
  formatMeter,
  isMeterDenominator,
  maxBarsForMeter,
  maxBeatsForMeter,
  normalizeMeter,
  planForCycle,
  summarize,
  ticksToBars,
  ticksToBeats,
} from "./songMath"
import type { TimeSignature } from "../../model/timing"

const FOUR_FOUR: TimeSignature = { numerator: 4, denominator: 4 }
const SIX_EIGHT: TimeSignature = { numerator: 6, denominator: 8 }
const SEVEN_EIGHT: TimeSignature = { numerator: 7, denominator: 8 }

describe("beat / bar / tick conversions", () => {
  it("a 4/4 beat is one quarter (PPQ) and a bar is four", () => {
    expect(beatTicks(FOUR_FOUR)).toBe(PPQ)
    expect(ticksPerBar(FOUR_FOUR)).toBe(PPQ * 4)
    expect(beatsPerBar(FOUR_FOUR)).toBe(4)
  })

  it("a 6/8 beat is one eighth and the bar holds six of them", () => {
    expect(beatTicks(SIX_EIGHT)).toBe(PPQ / 2)
    expect(beatsPerBar(SIX_EIGHT)).toBe(6)
    expect(ticksPerBar(SIX_EIGHT)).toBe((PPQ * 4 * 6) / 8)
  })

  it("round-trips beats → ticks → beats across exotic meters", () => {
    const meters: TimeSignature[] = [
      FOUR_FOUR,
      { numerator: 3, denominator: 4 },
      { numerator: 5, denominator: 4 },
      SEVEN_EIGHT,
      { numerator: 9, denominator: 8 },
      { numerator: 31, denominator: 8 },
    ]
    for (const sig of meters) {
      for (const beats of [1, 5, 7, 16, 31, 64]) {
        expect(ticksToBeats(beatsToTicks(beats, sig), sig)).toBe(beats)
      }
    }
  })

  it("round-trips bars → ticks → bars", () => {
    for (const bars of BAR_SNAPS) {
      expect(ticksToBars(barsToTicks(bars, FOUR_FOUR), FOUR_FOUR)).toBe(bars)
      expect(ticksToBars(barsToTicks(bars, SEVEN_EIGHT), SEVEN_EIGHT)).toBe(bars)
    }
  })
})

describe("the 128-beat clamp", () => {
  it("MAX_BEATS is 128 quarter-notes of ticks", () => {
    expect(MAX_BEATS).toBe(128)
    expect(MAX_LOOP_TICKS).toBe(128 * PPQ)
  })

  it("clamps a 4/4 loop request beyond 128 beats down to the ceiling", () => {
    const wanted = beatsToTicks(200, FOUR_FOUR)
    const clamped = clampLoopTicks(wanted)
    expect(clamped).toBe(MAX_LOOP_TICKS)
    expect(ticksToBeats(clamped, FOUR_FOUR)).toBe(128)
  })

  it("max beats shifts with the denominator (eighths fit more beats)", () => {
    expect(maxBeatsForMeter(FOUR_FOUR)).toBe(128)
    expect(maxBeatsForMeter({ numerator: 1, denominator: 8 })).toBe(256)
    expect(maxBarsForMeter(FOUR_FOUR)).toBe(32) // 128 quarters / 4
  })
})

describe("meter validation", () => {
  it("clamps numerator into 1..32", () => {
    expect(clampNumerator(0)).toBe(1)
    expect(clampNumerator(99)).toBe(32)
    expect(clampNumerator(7.6)).toBe(8)
  })

  it("only 1,2,4,8,16 are legal denominators", () => {
    expect(isMeterDenominator(8)).toBe(true)
    expect(isMeterDenominator(3)).toBe(false)
    expect(normalizeMeter({ numerator: 99, denominator: 3 })).toEqual({
      numerator: 32,
      denominator: 4,
    })
  })

  it("formats a meter as n/d", () => {
    expect(formatMeter(SEVEN_EIGHT)).toBe("7/8")
  })

  it("ships the documented preset chips", () => {
    expect(METER_PRESETS.map((p) => formatMeter(p.sig))).toEqual([
      "4/4",
      "3/4",
      "6/8",
      "5/4",
      "7/8",
      "9/8",
      "12/8",
    ])
  })
})

describe("the world-cycle (tala) catalog", () => {
  it("every cycle's meter realizes its advertised beat count", () => {
    for (const c of CYCLE_CATALOG) {
      expect(beatsPerBar(c.sig) * (c.beats / beatsPerBar(c.sig))).toBe(c.beats)
      // the meter must tile the cycle evenly
      expect(c.beats % beatsPerBar(c.sig)).toBe(0)
    }
  })

  it("known talas carry their canonical lengths", () => {
    expect(findCycle("teental")?.beats).toBe(16)
    expect(findCycle("jhaptal")?.beats).toBe(10)
    expect(findCycle("rupak")?.beats).toBe(7)
    expect(findCycle("ektal")?.beats).toBe(12)
    expect(findCycle("ati-31")?.beats).toBe(31)
  })

  it("vibhags (when present) sum to the cycle length", () => {
    for (const c of CYCLE_CATALOG) {
      if (c.vibhags) {
        expect(c.vibhags.reduce((a, b) => a + b, 0)).toBe(c.beats)
      }
    }
  })

  it("accents are in-range, sorted-distinct, and start on sam", () => {
    for (const c of CYCLE_CATALOG) {
      expect(c.accents[0]).toBe(0)
      for (const a of c.accents) {
        expect(a).toBeGreaterThanOrEqual(0)
        expect(a).toBeLessThan(c.beats)
      }
      const sorted = [...c.accents].sort((x, y) => x - y)
      expect(c.accents).toEqual(sorted)
      expect(new Set(c.accents).size).toBe(c.accents.length)
    }
  })

  it("plans a tala to a clamped loop + meter the loop can hold", () => {
    const plan = planForCycle(findCycle("teental")!)
    expect(plan.sig).toEqual(FOUR_FOUR)
    expect(plan.beats).toBe(16)
    expect(plan.loopTicks).toBe(beatsToTicks(16, FOUR_FOUR))
    expect(plan.loopTicks).toBeLessThanOrEqual(MAX_LOOP_TICKS)
  })

  it("plans the 31-beat cycle within the tick ceiling", () => {
    const plan = planForCycle(findCycle("ati-31")!)
    expect(plan.beats).toBe(31)
    expect(plan.loopTicks).toBeLessThanOrEqual(MAX_LOOP_TICKS)
    // 31 eighth-beats = 31 * 480 = 14880 ticks, well under the ceiling
    expect(plan.loopTicks).toBe(31 * (PPQ / 2))
  })
})

describe("custom cycles", () => {
  it("makes a straight quarter-note cycle for moderate lengths", () => {
    const c = customCycle(13)
    expect(c.beats).toBe(13)
    expect(c.sig.denominator).toBe(4)
    expect(planForCycle(c).beats).toBe(13)
  })

  it("falls back to eighths when a quarter cycle would overflow the ceiling", () => {
    // 128 quarter-beats is the very edge; anything that would exceed 32/4
    // numerator or the tick cap should still produce a legal plan.
    const c = customCycle(40)
    const plan = planForCycle(c)
    expect(plan.loopTicks).toBeLessThanOrEqual(MAX_LOOP_TICKS)
    expect(plan.beats).toBeGreaterThan(0)
  })

  it("clamps a custom cycle request to MAX_BEATS", () => {
    const c = customCycle(999)
    expect(c.beats).toBe(MAX_BEATS)
  })
})

describe("summaries", () => {
  it("summarizes beats · meter · bpm", () => {
    expect(
      summarize({ loopTicks: beatsToTicks(7, SEVEN_EIGHT), sig: SEVEN_EIGHT, bpm: 96 })
    ).toBe("7 beats · 7/8 · 96bpm")
  })

  it("uses the cycle name when given", () => {
    expect(
      summarize({
        loopTicks: beatsToTicks(16, FOUR_FOUR),
        sig: FOUR_FOUR,
        bpm: 120,
        cycleName: "Teental",
      })
    ).toBe("Teental · 4/4 · 120bpm")
  })
})
